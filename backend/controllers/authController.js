const { getDb, getAuth } = require('../config/firebase');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const { sendEmail } = require('../config/mailer');

const generateToken = (uid, sessionToken, role) => {
  return jwt.sign({ uid, sessionToken, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

const isAdminEmail = (email) => {
  if (!email) return false;
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.trim().toLowerCase());
};

const getDeviceInfo = (req) => {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  return {
    userAgent: req.headers['user-agent'],
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    device: result.device.type || 'desktop',
    ip: req.ip || req.connection.remoteAddress,
    lastLogin: new Date(),
  };
};

// SEND EMAIL OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDb();
    const authClient = getAuth();

    // Check if email already exists before sending OTP
    try {
      await authClient.getUserByEmail(email);
      return res.status(400).json({ error: 'Email already registered' });
    } catch (e) {
      // User doesn't exist - good
    }
    
    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save the OTP to Firestore
    await db.collection('otps').doc(email.toLowerCase()).set({
      email: email.toLowerCase(),
      otp,
      expiresAt,
      createdAt: new Date()
    });

    // Send the email containing the OTP
    await sendEmail({
      to: email,
      subject: `${otp} is your verification code - Fabric Painting Course`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7e5e4; border-radius: 10px; background-color: #fff8f0;">
          <h2 style="color: #7c3d12; text-align: center;">Verify Your Account</h2>
          <p>Hello,</p>
          <p>Thank you for registering for the Fabric Painting Course! Please use the following 6-digit One-Time Password (OTP) to complete your registration:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #7c3d12; letter-spacing: 5px; padding: 10px 20px; border: 2px dashed #7c3d12; border-radius: 5px; background-color: #fff;">${otp}</span>
          </div>
          <p style="color: #78716c; font-size: 14px;">This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e7e5e4; margin: 20px 0;">
          <p style="text-align: center; color: #78716c; font-size: 12px;">Fabric Painting Course &copy; 2026</p>
        </div>
      `,
    });

    res.json({ message: 'Verification OTP sent to your email.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
};

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, age, gender, native, mobile, email, password, otp } = req.body;

    if (!name || !age || !gender || !native || !mobile || !email || !password || !otp) {
      return res.status(400).json({ error: 'All fields including verification code are required' });
    }

    const db = getDb();
    const authClient = getAuth();

    // Check if email already exists
    try {
      await authClient.getUserByEmail(email);
      return res.status(400).json({ error: 'Email already registered' });
    } catch (e) {
      // User doesn't exist - good
    }

    // Verify OTP
    const otpDoc = await db.collection('otps').doc(email.toLowerCase()).get();
    if (!otpDoc.exists) {
      return res.status(400).json({ error: 'No verification code found for this email. Please request a new OTP.' });
    }

    const otpData = otpDoc.data();
    if (otpData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    const expiresAt = otpData.expiresAt.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new OTP.' });
    }

    // Delete the verified OTP
    await otpDoc.ref.delete();

    // Create Firebase Auth user (no phoneNumber - we use email OTP verification)
    const userRecord = await authClient.createUser({
      email,
      password,
      displayName: name,
    });

    // Save to Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      age: parseInt(age),
      gender,
      native,
      mobile,
      email,
      createdAt: new Date(),
      role: isAdminEmail(email) ? 'admin' : 'user',
      isActive: true,
      devices: {},
      deviceLimit: 3,
      currentSession: null,
    });

    // Notify admin of new registration
    await db.collection('notifications').add({
      type: 'new_registration',
      title: 'New User Registered',
      message: `${name} (${email}) just registered.`,
      userId: userRecord.uid,
      userName: name,
      userEmail: email,
      userMobile: mobile,
      isRead: false,
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'Registration successful. Please login.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId: clientDeviceId } = req.body;
    const db = getDb();
    const authClient = getAuth();

    // Verify credentials via Firebase Auth REST (admin SDK can't verify passwords)
    const fetch = (await import('node-fetch')).default;
    const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;

    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    const authData = await authRes.json();
    if (authData.error) {
      console.error('Firebase login error:', JSON.stringify(authData.error));
      const errCode = authData.error?.message || '';
      if (errCode.includes('EMAIL_NOT_FOUND') || errCode.includes('INVALID_PASSWORD') || errCode.includes('INVALID_LOGIN_CREDENTIALS')) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (errCode.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
        return res.status(429).json({ error: 'Too many failed attempts. Please wait and try again.' });
      }
      return res.status(401).json({ error: `Login failed: ${authData.error.message}` });
    }

    const uid = authData.localId;
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    let role = userData.role;

    if (isAdminEmail(email) && role !== 'admin') {
      role = 'admin';
      await userDoc.ref.update({ role: 'admin' });
    }

    if (!userData.isActive) {
      return res.status(403).json({ error: 'Account suspended. Contact admin.' });
    }

    const deviceInfo = getDeviceInfo(req);
    const devices = userData.devices || {};
    const deviceIds = Object.keys(devices);

    // Look up using clientDeviceId if provided. Fallback to userAgent/IP matching if clientDeviceId is missing
    let existingDeviceId = null;
    if (clientDeviceId) {
      if (devices[clientDeviceId]) {
        existingDeviceId = clientDeviceId;
      }
    } else {
      existingDeviceId = deviceIds.find(
        (id) => devices[id].userAgent === deviceInfo.userAgent && devices[id].ip === deviceInfo.ip
      );
    }

    const isNewDevice = !existingDeviceId;
    const isSessionConflict = !isNewDevice &&
      userData.currentSession &&
      userData.currentSession.deviceId &&
      userData.currentSession.deviceId !== existingDeviceId;

    // Login scenarios:
    // admin_login      → admin must verify by email on EVERY login (security)
    // new_device       → first time this browser logs in (one-time trust approval)
    // session_conflict → trusted device but another session is already active
    // null             → trusted device + no other session → direct login
    let loginScenario = null;
    if (role === 'admin') {
      loginScenario = 'admin_login';
    } else if (isNewDevice) {
      loginScenario = 'new_device';
    }

    const isVerificationRequired = loginScenario !== null;

    if (isNewDevice && deviceIds.length >= (userData.deviceLimit || 3)) {
      return res.status(403).json({
        error: `Device limit reached (${userData.deviceLimit || 3} devices). Contact admin to remove a device.`,
        code: 'DEVICE_LIMIT_REACHED',
        devices: deviceIds.map((id) => ({
          id,
          info: `${devices[id].browser} on ${devices[id].os}`,
          lastLogin: devices[id].lastLogin,
        })),
      });
    }

    const assignedDeviceId = clientDeviceId || existingDeviceId || uuidv4();
    const sessionToken = uuidv4();

    if (isVerificationRequired) {
      const requestId = uuidv4();
      const approvalToken = uuidv4();

      await db.collection('deviceApprovalRequests').doc(requestId).set({
        userId: uid,
        userEmail: email,
        newDeviceId: assignedDeviceId,
        newDeviceInfo: deviceInfo,
        token: approvalToken,
        status: 'pending',
        sessionToken,
        scenario: loginScenario,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const approveUrl = `${process.env.FRONTEND_URL}/approve-device?token=${approvalToken}&requestId=${requestId}&allow=true`;
      const denyUrl   = `${process.env.FRONTEND_URL}/approve-device?token=${approvalToken}&requestId=${requestId}&allow=false`;

      const btnStyle = 'display:inline-block;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin:6px';

      let emailSubject, emailHtml;

      if (loginScenario === 'admin_login') {
        emailSubject = '🔐 Admin Login Verification – MS Sri Meenakshi Academy';
        emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e7e5e4;border-radius:12px;background:#fff8f0">
            <h2 style="color:#7c3d12;text-align:center;margin-top:0">Admin Login Verification</h2>
            <p>Hello Admin,</p>
            <p>A login attempt was detected for the <strong>Admin account</strong>. Please verify it is you before access is granted.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4">
              <tr><td style="padding:10px 16px;color:#78716c;width:120px">Device</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.browser} on ${deviceInfo.os}</td></tr>
              <tr style="background:#fafaf9"><td style="padding:10px 16px;color:#78716c">IP Address</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.ip}</td></tr>
            </table>
            <div style="text-align:center;margin:28px 0">
              <a href="${approveUrl}" style="${btnStyle};background:#16a34a;color:white">✅ Allow Login</a>
              <a href="${denyUrl}"   style="${btnStyle};background:#dc2626;color:white">❌ Deny Login</a>
            </div>
            <p style="color:#78716c;font-size:13px;text-align:center">This link expires in 15 minutes. If you did not attempt this login, click <strong>Deny</strong> immediately.</p>
          </div>`;
      } else if (loginScenario === 'session_conflict') {
        emailSubject = '⚠️ Login Alert – Another Device Wants to Sign In';
        emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e7e5e4;border-radius:12px;background:#fff8f0">
            <h2 style="color:#7c3d12;text-align:center;margin-top:0">Login Attempt on Another Device</h2>
            <p>Hello,</p>
            <p>Someone is trying to log in to your account from a <strong>different device</strong> while you are currently logged in.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4">
              <tr><td style="padding:10px 16px;color:#78716c;width:120px">New Device</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.browser} on ${deviceInfo.os}</td></tr>
              <tr style="background:#fafaf9"><td style="padding:10px 16px;color:#78716c">IP Address</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.ip}</td></tr>
            </table>
            <p>👉 <strong>Allow</strong> — Your current session will be logged out and the new device will be granted access.</p>
            <p>🚫 <strong>Deny</strong> — The new login attempt is rejected. Your current session stays active.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${approveUrl}" style="${btnStyle};background:#16a34a;color:white">✅ Allow (Log me out)</a>
              <a href="${denyUrl}"   style="${btnStyle};background:#dc2626;color:white">❌ Deny (Keep me logged in)</a>
            </div>
            <p style="color:#78716c;font-size:13px;text-align:center">This link expires in 15 minutes. If this was not you, click <strong>Deny</strong> immediately and change your password.</p>
          </div>`;
      } else {
        // new_device
        emailSubject = '🔑 New Device Login – MS Sri Meenakshi Academy';
        emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e7e5e4;border-radius:12px;background:#fff8f0">
            <h2 style="color:#7c3d12;text-align:center;margin-top:0">New Device Login Request</h2>
            <p>Hello,</p>
            <p>A login was attempted from a <strong>new device</strong>. Once approved, this device will be trusted for future logins.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4">
              <tr><td style="padding:10px 16px;color:#78716c;width:120px">Device</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.browser} on ${deviceInfo.os}</td></tr>
              <tr style="background:#fafaf9"><td style="padding:10px 16px;color:#78716c">IP Address</td><td style="padding:10px 16px;font-weight:bold">${deviceInfo.ip}</td></tr>
            </table>
            <div style="text-align:center;margin:28px 0">
              <a href="${approveUrl}" style="${btnStyle};background:#16a34a;color:white">✅ Allow This Device</a>
              <a href="${denyUrl}"   style="${btnStyle};background:#dc2626;color:white">❌ Deny</a>
            </div>
            <p style="color:#78716c;font-size:13px;text-align:center">This link expires in 15 minutes. If you did not attempt this login, click <strong>Deny</strong>.</p>
          </div>`;
      }

      await sendEmail({ to: email, subject: emailSubject, html: emailHtml });

      const msgMap = {
        admin_login:      'Admin verification email sent. Please check your inbox and click Allow.',
        new_device:       'New device detected. An approval email has been sent to your inbox.',
        session_conflict: 'You are already logged in on another device. Check your email — click Allow to switch, or Deny to cancel.',
      };

      return res.status(202).json({
        code: 'DEVICE_APPROVAL_REQUIRED',
        message: msgMap[loginScenario],
        requestId,
        scenario: loginScenario,
      });
    }

    // Save device and session
    const deviceUpdate = {
      [`devices.${assignedDeviceId}`]: { ...deviceInfo, lastLogin: new Date() },
      currentSession: { deviceId: assignedDeviceId, sessionToken, loginAt: new Date() },
    };

    await userDoc.ref.update(deviceUpdate);

    const token = generateToken(uid, sessionToken, role);

    // Log attempt
    await db.collection('loginAttempts').add({
      email,
      ip: deviceInfo.ip,
      success: true,
      timestamp: new Date(),
      deviceId: assignedDeviceId,
    });

    res.json({
      token,
      user: {
        uid,
        name: userData.name,
        email: userData.email,
        role: role,
        mobile: userData.mobile,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    const db = getDb();
    await db.collection('users').doc(req.user.uid).update({
      currentSession: null,
    });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

// APPROVE DEVICE (from email link)
exports.approveDevice = async (req, res) => {
  try {
    const { token, requestId, allow } = req.body;
    const db = getDb();

    const requestDoc = await db.collection('deviceApprovalRequests').doc(requestId).get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestDoc.data();

    if (requestData.token !== token) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (requestData.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    if (requestData.expiresAt.toDate() < new Date()) {
      await requestDoc.ref.update({ status: 'expired' });
      return res.status(400).json({ error: 'Approval link expired' });
    }

    if (allow === 'false' || allow === false) {
      await requestDoc.ref.update({ status: 'denied' });
      return res.json({ message: 'Login denied' });
    }

    // Allow: update user session and device
    const userDoc = await db.collection('users').doc(requestData.userId).get();
    const userData = userDoc.data();
    let role = userData.role;

    if (isAdminEmail(requestData.userEmail) && role !== 'admin') {
      role = 'admin';
    }

    const newDeviceId = requestData.newDeviceId;
    const devices = userData.devices || {};
    const deviceIds = Object.keys(devices);
    const scenario = requestData.scenario || 'new_device';

    if (scenario === 'new_device') {
      // First time this device is trusted — add to trusted list; evict oldest if at limit
      if (!devices[newDeviceId] && deviceIds.length >= (userData.deviceLimit || 3)) {
        const oldest = deviceIds.sort((a, b) => {
          const da = devices[a].lastLogin?.toDate?.() || new Date(devices[a].lastLogin);
          const db2 = devices[b].lastLogin?.toDate?.() || new Date(devices[b].lastLogin);
          return da - db2;
        })[0];
        delete devices[oldest];
      }
    }
    // For admin_login and session_conflict the device is already trusted (or becomes so); just update lastLogin
    devices[newDeviceId] = { ...requestData.newDeviceInfo, lastLogin: new Date() };

    await userDoc.ref.update({
      role,
      devices,
      currentSession: {
        deviceId: newDeviceId,
        sessionToken: requestData.sessionToken,
        loginAt: new Date(),
      },
    });

    await requestDoc.ref.update({ status: 'approved' });

    res.json({ message: 'Device approved successfully' });
  } catch (err) {
    console.error('Approve device error:', err);
    res.status(500).json({ error: 'Failed to process approval' });
  }
};

// CHECK APPROVAL STATUS (for polling from waiting device)
exports.checkApproval = async (req, res) => {
  try {
    const { requestId } = req.query;
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const db = getDb();
    const requestDoc = await db.collection('deviceApprovalRequests').doc(requestId).get();

    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Request not found', code: 'APPROVAL_EXPIRED' });
    }

    const requestData = requestDoc.data();

    if (requestData.status === 'denied') {
      await requestDoc.ref.delete(); // Clean up request
      return res.status(400).json({ error: 'Login request denied.', code: 'APPROVAL_DENIED' });
    }

    if (requestData.expiresAt.toDate() < new Date()) {
      await requestDoc.ref.delete(); // Clean up expired request
      return res.status(400).json({ error: 'Approval link expired.', code: 'APPROVAL_EXPIRED' });
    }

    if (requestData.status === 'approved') {
      // Get updated user details
      const userDoc = await db.collection('users').doc(requestData.userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const role = userData.role;

      // Generate JWT Token for the waiting device
      const jwtToken = generateToken(requestData.userId, requestData.sessionToken, role);

      // Clean up/delete the request so it can't be claimed again
      await requestDoc.ref.delete();

      return res.json({
        approved: true,
        token: jwtToken,
        user: {
          uid: requestData.userId,
          name: userData.name,
          email: userData.email,
          role: role,
          mobile: userData.mobile,
        }
      });
    }

    // Still pending
    return res.json({ approved: false });
  } catch (err) {
    console.error('Check approval error:', err);
    res.status(500).json({ error: 'Failed to check approval status' });
  }
};

// GET PROFILE
exports.getProfile = async (req, res) => {
  try {
    const db = getDb();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();

    res.json({
      uid: req.user.uid,
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      role: userData.role,
      devices: Object.keys(userData.devices || {}).map((id) => ({
        id,
        info: `${userData.devices[id].browser || 'Unknown'} on ${userData.devices[id].os || 'Unknown'}`,
        lastLogin: userData.devices[id].lastLogin,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
};
