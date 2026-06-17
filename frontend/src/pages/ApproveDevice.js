import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';

const ApproveDevice = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | approved | denied | error
  const [errorMsg, setErrorMsg] = useState('');
  const apiCalled = useRef(false);

  useEffect(() => {
    if (apiCalled.current) return;
    apiCalled.current = true;

    const token = params.get('token');
    const requestId = params.get('requestId');
    const allow = params.get('allow');

    if (!token || !requestId) {
      setStatus('error');
      setErrorMsg('Invalid link — missing token or request ID.');
      toast.error('Invalid approval link.', { id: 'approve-result', duration: 6000 });
      return;
    }

    api.post('/auth/approve-device', { token, requestId, allow })
      .then(() => {
        if (allow === 'true') {
          setStatus('approved');
          toast.success('✅ Device approved! The new device is now logged in.', {
            id: 'approve-result',
            duration: 6000,
          });
        } else {
          setStatus('denied');
          toast('🚫 Login denied. Your current session remains active.', {
            id: 'approve-result',
            icon: '🔒',
            duration: 6000,
          });
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.error || 'This approval link has expired or is invalid.';
        setStatus('error');
        setErrorMsg(msg);
        toast.error(msg, { id: 'approve-result', duration: 7000 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface)',
      padding: 24
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
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
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Device Approved!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 12, lineHeight: '1.6' }}>
              The new device login has been approved. You can <strong>close this tab</strong> and return to the login screen — it will log in automatically.
            </p>
          </>
        )}

        {status === 'denied' && (
          <>
            <div style={{ width: 72, height: 72, background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FaTimes size={32} color="#DC2626" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)' }}>Login Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              The new device login was denied. Your current session remains active.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: 72, height: 72, background: '#FEF3C7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FaTimes size={32} color="#D97706" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--error)' }}>Invalid or Expired Link</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {errorMsg || 'This approval link has expired or is invalid. Please try logging in again.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ApproveDevice;
