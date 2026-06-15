const { getDb, getAuth } = require('../config/firebase');
const { checkAccountUsage, getCloudinaryAccountsFromEnv } = require('../config/cloudinary');

// GET all users with stats
exports.getUsers = async (req, res) => {
  try {
    const db = getDb();
    const usersSnapshot = await db.collection('users').where('role', '==', 'user').get();

    const users = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const accessDoc = await db.collection('courseAccess').doc(doc.id).get();
        const access = accessDoc.exists ? accessDoc.data() : null;

        // Get watch summary
        const watchSnapshot = await db
          .collection('watchHistory')
          .doc(doc.id)
          .collection('videos')
          .get();

        const totalVideosWatched = watchSnapshot.size;
        const totalWatchTime = watchSnapshot.docs.reduce(
          (sum, d) => sum + (d.data().totalWatchTime || 0),
          0
        );

        return {
          uid: doc.id,
          name: data.name,
          email: data.email,
          mobile: data.mobile,
          gender: data.gender,
          native: data.native,
          age: data.age,
          createdAt: data.createdAt,
          isActive: data.isActive,
          deviceCount: Object.keys(data.devices || {}).length,
          deviceLimit: data.deviceLimit || 3,
          devices: Object.keys(data.devices || {}).map((id) => ({
            id,
            browser: data.devices[id].browser,
            os: data.devices[id].os,
            ip: data.devices[id].ip,
            lastLogin: data.devices[id].lastLogin,
          })),
          access: access
            ? {
                hasAccess: access.hasAccess,
                grantedAt: access.grantedAt,
                expiresAt: access.expiresAt,
                isExpired: access.expiresAt?.toDate?.() < new Date() || access.isExpired,
              }
            : null,
          stats: {
            totalVideosWatched,
            totalWatchTime,
          },
        };
      })
    );

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET specific user details with full watch history
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();
    const accessDoc = await db.collection('courseAccess').doc(userId).get();

    const watchSnapshot = await db
      .collection('watchHistory')
      .doc(userId)
      .collection('videos')
      .get();

    const watchHistory = watchSnapshot.docs.map((d) => ({
      videoId: d.id,
      ...d.data(),
    }));

    res.json({
      uid: userId,
      ...userData,
      devices: Object.keys(userData.devices || {}).map((id) => ({
        id,
        ...userData.devices[id],
      })),
      access: accessDoc.exists ? accessDoc.data() : null,
      watchHistory,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user details' });
  }
};

// GRANT course access
exports.grantAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const { durationMonths = 6 } = req.body;
    const db = getDb();

    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt);
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    await db.collection('courseAccess').doc(userId).set({
      userId,
      hasAccess: true,
      grantedAt,
      grantedBy: req.user.uid,
      expiresAt,
      isExpired: false,
      accessDuration: durationMonths,
    });

    res.json({ message: 'Access granted', expiresAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant access' });
  }
};

// REVOKE course access
exports.revokeAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    await db.collection('courseAccess').doc(userId).update({
      hasAccess: false,
      revokedAt: new Date(),
      revokedBy: req.user.uid,
    });

    // Mark related notification as read
    const notifSnapshot = await db
      .collection('notifications')
      .where('userId', '==', userId)
      .where('type', '==', 'access_expired')
      .get();

    const batch = db.batch();
    notifSnapshot.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
    await batch.commit();

    res.json({ message: 'Access revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke access' });
  }
};

// EXTEND access
exports.extendAccess = async (req, res) => {
  try {
    const { userId } = req.params;
    const { additionalMonths = 6 } = req.body;
    const db = getDb();

    const accessDoc = await db.collection('courseAccess').doc(userId).get();
    if (!accessDoc.exists) return res.status(404).json({ error: 'No access record' });

    const current = accessDoc.data();
    const currentExpiry = current.expiresAt?.toDate?.() || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);

    await accessDoc.ref.update({
      expiresAt: newExpiry,
      hasAccess: true,
      isExpired: false,
      extendedAt: new Date(),
      extendedBy: req.user.uid,
    });

    res.json({ message: 'Access extended', newExpiresAt: newExpiry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to extend access' });
  }
};

// REMOVE device footprint
exports.removeDevice = async (req, res) => {
  try {
    const { userId, deviceId } = req.params;
    const db = getDb();

    await db
      .collection('users')
      .doc(userId)
      .update({ [`devices.${deviceId}`]: require('firebase-admin').firestore.FieldValue.delete() });

    res.json({ message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove device' });
  }
};

// UPDATE device limit
exports.updateDeviceLimit = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceLimit } = req.body;
    const db = getDb();

    await db.collection('users').doc(userId).update({ deviceLimit: parseInt(deviceLimit) });
    res.json({ message: 'Device limit updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device limit' });
  }
};

// GET notifications
exports.getNotifications = async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const notifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// MARK notification as read
exports.markNotificationRead = async (req, res) => {
  try {
    const { notifId } = req.params;
    const db = getDb();
    await db.collection('notifications').doc(notifId).update({ isRead: true });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
};

// GET cloudinary account status
exports.getCloudinaryStatus = async (req, res) => {
  try {
    const accounts = await checkAccountUsage();
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Cloudinary status' });
  }
};

// ADD/UPDATE cloudinary account
exports.upsertCloudinaryAccount = async (req, res) => {
  try {
    const { id, name, cloudName, apiKey, apiSecret, order } = req.body;
    const db = getDb();

    const data = {
      name,
      cloudName,
      apiKey,
      apiSecret,
      isActive: true,
      isCurrentActive: false,
      usagePercent: 0,
      order: order || 1,
      lastChecked: new Date(),
    };

    if (id) {
      await db.collection('cloudinaryAccounts').doc(id).set(data, { merge: true });
    } else {
      await db.collection('cloudinaryAccounts').add(data);
    }

    res.json({ message: 'Cloudinary account saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save account' });
  }
};

// ADD/UPDATE video
exports.upsertVideo = async (req, res) => {
  try {
    const { id, classNumber, title, description, cloudinaryPublicIds, duration, thumbnail } = req.body;
    const db = getDb();

    const data = {
      classNumber: parseInt(classNumber),
      title,
      description,
      cloudinaryPublicIds: cloudinaryPublicIds || {},
      duration: duration || 0,
      thumbnail: thumbnail || '',
      order: parseInt(classNumber),
    };

    if (id) {
      await db.collection('videos').doc(id).update(data);
    } else {
      await db.collection('videos').add(data);
    }

    res.json({ message: 'Video saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save video' });
  }
};

// SUSPEND/ACTIVATE user
exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const db = getDb();
    await db.collection('users').doc(userId).update({ isActive });
    res.json({ message: `User ${isActive ? 'activated' : 'suspended'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// DELETE notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notifId } = req.params;
    const db = getDb();
    await db.collection('notifications').doc(notifId).delete();
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};
