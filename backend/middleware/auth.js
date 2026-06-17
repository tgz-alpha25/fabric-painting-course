const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify session is still valid in DB
    const db = getDb();
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    if (!userData.isActive) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Check session token matches (single device session)
    if (
      userData.currentSession &&
      userData.currentSession.sessionToken !== decoded.sessionToken
    ) {
      return res.status(401).json({
        error: 'Session expired. Another device logged in.',
        code: 'SESSION_CONFLICT',
      });
    }

    // Check if the current session's device was deleted/removed by admin
    if (
      userData.currentSession &&
      userData.currentSession.deviceId &&
      (!userData.devices || !userData.devices[userData.currentSession.deviceId])
    ) {
      return res.status(401).json({
        error: 'Session expired. Device removed by admin.',
        code: 'DEVICE_REMOVED',
      });
    }

    req.user = { ...decoded, ...userData, uid: decoded.uid };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const verifyAdmin = async (req, res, next) => {
  try {
    await verifyToken(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    });
  } catch (err) {
    next(err);
  }
};

const verifyCourseAccess = async (req, res, next) => {
  try {
    // Admin bypasses course access check
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    // Demo video is free — any logged-in user can watch it
    if (req.params.videoId === 'demo') {
      return next();
    }

    const db = getDb();

    const accessDoc = await db.collection('courseAccess').doc(req.user.uid).get();

    if (!accessDoc.exists) {
      return res.status(403).json({ error: 'No course access', code: 'NO_ACCESS' });
    }

    const access = accessDoc.data();

    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Course access denied', code: 'ACCESS_DENIED' });
    }

    if (access.expiresAt && access.expiresAt.toDate() < new Date()) {
      // Auto-mark expired
      await accessDoc.ref.update({ hasAccess: false, isExpired: true });

      // Create notification
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      const userData = userDoc.data();
      await db.collection('notifications').add({
        type: 'access_expired',
        title: 'Course Access Expired',
        message: `User ${userData?.name} (${userData?.email}) course access has expired.`,
        userId: req.user.uid,
        userName: userData?.name,
        userEmail: userData?.email,
        isRead: false,
        createdAt: new Date(),
      });

      return res.status(403).json({ error: 'Course access expired', code: 'ACCESS_EXPIRED' });
    }

    req.courseAccess = access;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyToken, verifyAdmin, verifyCourseAccess };
