const cron = require('node-cron');
const { getDb } = require('../config/firebase');
const { checkAccountUsage } = require('../config/cloudinary');

// Run every hour — check for expired access
const checkExpiredAccess = cron.schedule('0 * * * *', async () => {
  try {
    const db = getDb();
    const now = new Date();

    const snapshot = await db
      .collection('courseAccess')
      .where('hasAccess', '==', true)
      .get();

    const batch = db.batch();
    const notifications = [];

    // Filter in-memory to avoid requiring a Firestore composite index
    const expiredDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (!data.expiresAt) return false;
      const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      return expiresAt <= now;
    });

    for (const doc of expiredDocs) {
      const data = doc.data();
      batch.update(doc.ref, { hasAccess: false, isExpired: true });

      // Get user info
      const userDoc = await db.collection('users').doc(data.userId).get();
      const userData = userDoc.data();

      notifications.push({
        type: 'access_expired',
        title: 'Course Access Expired',
        message: `${userData?.name} (${userData?.email}) - access expired. Granted: ${data.grantedAt?.toDate?.()?.toLocaleDateString()}.`,
        userId: data.userId,
        userName: userData?.name,
        userEmail: userData?.email,
        isRead: false,
        createdAt: new Date(),
      });
    }

    await batch.commit();

    // Add notifications
    for (const notif of notifications) {
      await db.collection('notifications').add(notif);
    }

    if (notifications.length > 0) {
      console.log(`[CRON] Expired ${notifications.length} course access records`);
    }
  } catch (err) {
    console.error('[CRON] Error checking expired access:', err);
  }
});

// Run every 6 hours — check Cloudinary usage
const checkCloudinaryUsage = cron.schedule('0 */6 * * *', async () => {
  try {
    console.log('[CRON] Checking Cloudinary usage...');
    await checkAccountUsage();
  } catch (err) {
    console.error('[CRON] Cloudinary check error:', err);
  }
});

module.exports = { checkExpiredAccess, checkCloudinaryUsage };
