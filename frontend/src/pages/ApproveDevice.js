import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';

const ApproveDevice = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | approved | denied | error

  useEffect(() => {
    const token = params.get('token');
    const requestId = params.get('requestId');
    const allow = params.get('allow');

    if (!token || !requestId) {
      setStatus('error');
      return;
    }

    api.post('/auth/approve-device', { token, requestId, allow })
      .then((res) => {
        if (allow === 'true' && res.data.token) {
          localStorage.setItem('token', res.data.token);
          setStatus('approved');
          setTimeout(() => navigate('/course'), 2000);
        } else {
          setStatus('denied');
        }
      })
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        {status === 'loading' && (
          <>
            <FaSpinner size={48} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <h2 style={{ marginTop: 20, fontFamily: 'var(--font-display)' }}>Processing...</h2>
          </>
        )}
        {status === 'approved' && (
          <>
            <div style={{ width: 72, height: 72, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FaCheck size={32} color="#059669" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>Device Approved!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Redirecting to your course...</p>
          </>
        )}
        {status === 'denied' && (
          <>
            <div style={{ width: 72, height: 72, background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FaTimes size={32} color="#DC2626" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>Login Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>The new device login was denied. Your current session remains active.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--error)' }}>Invalid or Expired Link</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>This approval link has expired or is invalid. Please try logging in again.</p>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/')}>Go to Home</button>
          </>
        )}
      </div>
    </div>
  );
};

export default ApproveDevice;
