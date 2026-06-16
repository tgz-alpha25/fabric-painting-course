import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { FaTimes, FaEye, FaEyeSlash, FaBrush } from 'react-icons/fa';
import './AuthModal.css';

const AuthModal = () => {
  const { showAuthModal, closeAuth, authMode, setAuthMode, login, register, loginWithToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=form, 2=OTP, 3=Waiting for Approval
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mouseDownTarget, setMouseDownTarget] = useState(null);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '', age: '', gender: '', native: '', mobile: '', email: '', password: '', confirm: ''
  });

  // Prevent body scroll when modal open
  useEffect(() => {
    if (showAuthModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setStep(1);
      setOtp('');
      setRequestId(null);
    }
    return () => { document.body.style.overflow = ''; };
  }, [showAuthModal]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(loginData.email, loginData.password);
      const displayName = result.user?.name?.split(' ')[0] || result.user?.email?.split('@')[0] || 'User';
      toast.success(`Welcome back, ${displayName}!`);
      closeAuth();
    } catch (err) {
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed';
      if (code === 'DEVICE_APPROVAL_REQUIRED') {
        const reqId = err.response?.data?.requestId;
        const msg = err.response?.data?.message || 'A verification email has been sent.';
        setRequestId(reqId);
        setApprovalMessage(msg);
        setStep(3); // Go to waiting for approval screen
        toast(msg, { icon: '📧', duration: 6000 });
      } else if (code === 'DEVICE_LIMIT_REACHED') {
        toast.error('Device limit reached. Contact admin to unlock.');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Polling for device approval
  useEffect(() => {
    if (authMode !== 'login' || step !== 3 || !requestId) return;

    let intervalId;
    const checkStatus = async () => {
      try {
        const res = await api.get(`/auth/check-approval?requestId=${requestId}`);
        if (res.data.approved) {
          clearInterval(intervalId);
          toast.success('Login approved! Welcome back.');
          loginWithToken(res.data.token, res.data.user);
          closeAuth();
        }
      } catch (err) {
        clearInterval(intervalId);
        const msg = err.response?.data?.error || err.response?.data?.message || 'Approval failed';
        toast.error(msg);
        setStep(1);
        setRequestId(null);
      }
    };

    intervalId = setInterval(checkStatus, 3000);
    
    // Run initial check immediately
    checkStatus();

    return () => {
      clearInterval(intervalId);
    };
  }, [authMode, step, requestId, loginWithToken, closeAuth]);

  const sendOTP = async () => {
    if (!registerData.email) return toast.error('Enter a valid email address');
    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email: registerData.email });
      setStep(2);
      toast.success(res.data.message || 'OTP sent to your email!');
    } catch (err) {
      console.error('Send OTP Error:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP. Please try again.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (registerData.password !== registerData.confirm) {
        return toast.error('Passwords do not match');
      }
      if (registerData.password.length < 6) return toast.error('Password must be 6+ characters');
      await sendOTP();
      return;
    }

    // Step 2: Verify OTP then register
    setLoading(true);
    try {
      const { confirm, ...data } = registerData;
      await register({ ...data, otp });
      toast.success('Registered successfully! Please login.');
      setAuthMode('login');
      setStep(1);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!showAuthModal) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && mouseDownTarget === e.currentTarget) {
      closeAuth();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onMouseDown={(e) => setMouseDownTarget(e.target)}
      onClick={handleOverlayClick}
    >
      <div className="modal-box">
        <button className="modal-close" onClick={closeAuth}><FaTimes /></button>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-logo"><FaBrush /></div>
          <h2 className="modal-title">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="modal-subtitle">
            {authMode === 'login'
              ? 'Sign in to access your course'
              : 'Join our fabric painting community'}
          </p>
        </div>

        {/* Tabs */}
        {step === 1 && (
          <div className="modal-tabs">
            <button className={`tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthMode('login'); setStep(1); }}>Login</button>
            <button className={`tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setStep(1); }}>Register</button>
          </div>
        )}

        {/* LOGIN FORM */}
        {authMode === 'login' && step === 1 && (
          <form onSubmit={handleLogin} className="modal-form">
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input className="input-field" type="email" placeholder="you@example.com" required
                value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="password-wrapper">
                <input className="input-field" type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password" required
                  value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In'}
            </button>
          </form>
        )}

        {/* WAITING FOR APPROVAL VIEW */}
        {authMode === 'login' && step === 3 && (
          <div className="modal-form waiting-approval" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, margin: '0 auto 20px', borderColor: 'var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h3 style={{ marginBottom: 12, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Waiting for Approval</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: '1.5', margin: '0 auto 20px', maxWidth: '300px' }}>
              {approvalMessage || 'A verification email has been sent.'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Please click <b>Allow</b> in that email to log in on this device.
            </p>
            <button 
              type="button" 
              className="btn btn-ghost" 
              style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
              onClick={() => { setStep(1); setRequestId(null); }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {authMode === 'register' && step === 1 && (
          <form onSubmit={handleRegister} className="modal-form">
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input className="input-field" type="text" placeholder="Your full name" required
                  value={registerData.name} onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Age</label>
                <input className="input-field" type="number" placeholder="Your age" min={10} max={100} required
                  value={registerData.age} onChange={(e) => setRegisterData({ ...registerData, age: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Gender</label>
                <select className="input-field" required value={registerData.gender}
                  onChange={(e) => setRegisterData({ ...registerData, gender: e.target.value })}>
                  <option value="">Select gender</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Native / City</label>
                <input className="input-field" type="text" placeholder="Your city" required
                  value={registerData.native} onChange={(e) => setRegisterData({ ...registerData, native: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Mobile Number</label>
              <input className="input-field" type="tel" placeholder="10-digit mobile number" required
                value={registerData.mobile} onChange={(e) => setRegisterData({ ...registerData, mobile: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input className="input-field" type="email" placeholder="your@email.com" required
                value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Password</label>
                <input className="input-field" type="password" placeholder="Create password" required minLength={6}
                  value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm Password</label>
                <input className="input-field" type="password" placeholder="Repeat password" required
                  value={registerData.confirm} onChange={(e) => setRegisterData({ ...registerData, confirm: e.target.value })} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Send OTP & Continue'}
            </button>
          </form>
        )}

        {/* OTP STEP */}
        {authMode === 'register' && step === 2 && (
          <form onSubmit={handleRegister} className="modal-form">
            <div className="otp-info">
              <p>OTP sent to <b>{registerData.email}</b></p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>Change Email</button>
            </div>
            <div className="input-group">
              <label className="input-label">Enter 6-digit OTP</label>
              <input className="input-field otp-input" type="text" inputMode="numeric" maxLength={6}
                placeholder="• • • • • •" value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading || otp.length < 6}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Verify & Register'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={sendOTP} disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Resend OTP</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
