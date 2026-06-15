const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const videoController = require('../controllers/videoController');
const adminController = require('../controllers/adminController');
const contactController = require('../controllers/contactController');
const { verifyToken, verifyAdmin, verifyCourseAccess } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

const videoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});

// AUTH ROUTES
router.post('/auth/send-otp', authLimiter, authController.sendOtp);
router.post('/auth/register', authLimiter, authController.register);
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/logout', verifyToken, authController.logout);
router.post('/auth/approve-device', authController.approveDevice);
router.get('/auth/profile', verifyToken, authController.getProfile);

// VIDEO ROUTES (requires login + course access)
router.get('/videos', verifyToken, verifyCourseAccess, videoController.getVideoList);
router.get('/videos/:videoId/stream', verifyToken, verifyCourseAccess, videoLimiter, videoController.getVideoStream);
router.post('/videos/:videoId/progress', verifyToken, verifyCourseAccess, videoController.updateProgress);

// Public video list (no stream URLs, just metadata)
router.get('/videos/public/list', videoController.getVideoList);

// CONTACT ROUTE
router.post('/contact', contactController.sendContactEmail);

// ADMIN ROUTES (admin only)
router.get('/admin/users', verifyAdmin, adminController.getUsers);
router.get('/admin/users/:userId', verifyAdmin, adminController.getUserDetails);
router.post('/admin/users/:userId/grant-access', verifyAdmin, adminController.grantAccess);
router.post('/admin/users/:userId/revoke-access', verifyAdmin, adminController.revokeAccess);
router.post('/admin/users/:userId/extend-access', verifyAdmin, adminController.extendAccess);
router.delete('/admin/users/:userId/devices/:deviceId', verifyAdmin, adminController.removeDevice);
router.patch('/admin/users/:userId/device-limit', verifyAdmin, adminController.updateDeviceLimit);
router.patch('/admin/users/:userId/status', verifyAdmin, adminController.toggleUserStatus);
router.get('/admin/notifications', verifyAdmin, adminController.getNotifications);
router.patch('/admin/notifications/:notifId/read', verifyAdmin, adminController.markNotificationRead);
router.delete('/admin/notifications/:notifId', verifyAdmin, adminController.deleteNotification);
router.get('/admin/cloudinary/status', verifyAdmin, adminController.getCloudinaryStatus);
router.post('/admin/cloudinary/accounts', verifyAdmin, adminController.upsertCloudinaryAccount);
router.post('/admin/videos', verifyAdmin, adminController.upsertVideo);
router.put('/admin/videos/:id', verifyAdmin, adminController.upsertVideo);

module.exports = router;
