import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { db, auth as firebaseClientAuth } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// ─── Cross-tab messaging channel ───────────────────────────────────────────
// BroadcastChannel is supported in all modern browsers (Chrome, Firefox,
// Safari 15.4+). We use it to push auth state changes to sibling tabs
// instantly without relying on the storage event (which only fires in OTHER
// tabs, not the one that made the change).
const AUTH_CHANNEL = 'fabric_auth_sync';

// Message types
const MSG = {
  LOGGED_IN:       'LOGGED_IN',       // a tab just logged in
  LOGGED_OUT:      'LOGGED_OUT',      // a tab just logged out (voluntary or forced)
  SESSION_EXPIRED: 'SESSION_EXPIRED', // session killed by another device
  TOKEN_EXPIRED:   'TOKEN_EXPIRED',   // JWT expired naturally
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

const syncFirebaseAuth = async (firebaseToken) => {
  try {
    await signInWithCustomToken(firebaseClientAuth, firebaseToken);
  } catch (err) {
    if (err.code === 'auth/invalid-custom-token' || err.code === 'auth/argument-error') {
      console.warn('Firebase custom token invalid/expired, fetching fresh one...');
      try {
        const res = await api.get('/auth/firebase-token');
        const freshToken = res.data.firebaseToken;
        localStorage.setItem('firebaseToken', freshToken);
        await signInWithCustomToken(firebaseClientAuth, freshToken);
      } catch (tokenErr) {
        console.error('Failed to refresh Firebase token:', tokenErr.message);
      }
    } else {
      console.warn('Firebase sign-in error (non-blocking):', err.message);
    }
  }
};

const clearAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('firebaseToken');
};

// ─── Provider ───────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode]           = useState('login');

  // Keep a stable ref to the BroadcastChannel so we can post to it from
  // inside callbacks without stale-closure issues.
  const channelRef = useRef(null);

  // ── 1. Open BroadcastChannel once on mount ──────────────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      channelRef.current = new BroadcastChannel(AUTH_CHANNEL);
    }
    return () => {
      channelRef.current?.close();
    };
  }, []);

  // ── 2. Listen for messages from other tabs ──────────────────────────────
  useEffect(() => {
    if (!channelRef.current) return;

    const handleMessage = (event) => {
      const { type, userData } = event.data || {};

      switch (type) {
        case MSG.LOGGED_IN:
          // Another tab logged in — restore their session here too
          if (userData) {
            const storedToken = localStorage.getItem('token');
            const storedUser  = localStorage.getItem('user');
            if (storedToken && storedUser) {
              try { setUser(JSON.parse(storedUser)); } catch (e) { /* ignore */ }
            }
          }
          break;

        case MSG.LOGGED_OUT:
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          break;

        case MSG.SESSION_EXPIRED:
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          toast.error('Logged out — another device signed in.', {
            id: 'session-expired-cross-tab',
          });
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          break;

        case MSG.TOKEN_EXPIRED:
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          toast('Your session expired. Please log in again.', {
            id: 'token-expired-cross-tab',
            icon: '⏰',
          });
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          break;

        default:
          break;
      }
    };

    channelRef.current.addEventListener('message', handleMessage);
    return () => channelRef.current?.removeEventListener('message', handleMessage);
  }, []);

  // Helper to broadcast to sibling tabs
  const broadcast = (type, extra = {}) => {
    channelRef.current?.postMessage({ type, ...extra });
  };

  // ── 3. Restore session on initial load ──────────────────────────────────
  useEffect(() => {
    const storedUser    = localStorage.getItem('user');
    const token         = localStorage.getItem('token');
    const firebaseToken = localStorage.getItem('firebaseToken');

    const initAuth = async () => {
      if (storedUser && storedUser !== 'undefined' && token) {
        try {
          setUser(JSON.parse(storedUser));

          // Try to authenticate with Firebase Client SDK
          if (firebaseToken) {
            await syncFirebaseAuth(firebaseToken);
          } else {
            try {
              const res = await api.get('/auth/firebase-token');
              localStorage.setItem('firebaseToken', res.data.firebaseToken);
              await signInWithCustomToken(firebaseClientAuth, res.data.firebaseToken);
            } catch (e) {
              console.warn('Could not fetch Firebase token on init:', e.message);
            }
          }
        } catch (e) {
          console.error('Error restoring session:', e);
          clearAuthStorage();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // ── 4. Fallback: native storage event (for Safari < 15.4 / no BroadcastChannel)
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only act if BroadcastChannel is NOT available (fallback path)
      if (channelRef.current) return;

      if (e.key === 'token') {
        if (!e.newValue) {
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
        } else {
          const storedUser = localStorage.getItem('user');
          if (storedUser && storedUser !== 'undefined') {
            try { setUser(JSON.parse(storedUser)); } catch (err) { setUser(null); }
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── 5. Firestore real-time session listener (server-side forced logout) ──
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const decoded = parseJwt(token);
    const mySessionToken = decoded?.sessionToken;
    if (!mySessionToken) return;

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const currentSession = data.currentSession;

        if (!currentSession || currentSession.sessionToken !== mySessionToken) {
          clearAuthStorage();
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});

          // Tell all other tabs to also log out
          broadcast(MSG.SESSION_EXPIRED);

          toast.error('Session expired — another device logged in.', {
            id: 'session-conflict-toast',
          });

          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        } else if (data.sessionInvalidatedAt && mySessionToken && data.currentSession?.loginAt) {
          const invalidatedAt = data.sessionInvalidatedAt.toDate ? data.sessionInvalidatedAt.toDate() : new Date(data.sessionInvalidatedAt);
          const loginAt = data.currentSession.loginAt.toDate ? data.currentSession.loginAt.toDate() : new Date(data.currentSession.loginAt);
          if (invalidatedAt > loginAt) {
            clearAuthStorage();
            setUser(null);
            signOut(firebaseClientAuth).catch(() => {});
            broadcast(MSG.SESSION_EXPIRED);
            toast.error('Session invalidated by newer login.', { id: 'session-invalidated-toast' });
            if (window.location.pathname !== '/') {
              window.location.href = '/';
            }
          }
        }
      },
      (error) => console.error('Firestore user snapshot error:', error)
    );

    return () => unsub();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 6. JWT expiration auto-logout ────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const decoded = parseJwt(token);
    if (!decoded) return;

    if (decoded.exp * 1000 < Date.now()) {
      // Already expired on mount
      clearAuthStorage();
      setUser(null);
      signOut(firebaseClientAuth).catch(() => {});
      broadcast(MSG.TOKEN_EXPIRED);
      return;
    }

    const timeUntilExpiry = decoded.exp * 1000 - Date.now();
    const timeoutId = setTimeout(() => {
      clearAuthStorage();
      setUser(null);
      signOut(firebaseClientAuth).catch(() => {});

      // Notify all tabs
      broadcast(MSG.TOKEN_EXPIRED);

      toast('Your session expired. Please log in again.', {
        id: 'token-expired-toast',
        icon: '⏰',
      });

      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth actions ─────────────────────────────────────────────────────────
  const getOrCreateDeviceId = () => {
    let devId = localStorage.getItem('deviceId');
    if (!devId) {
      devId = 'device_' + Math.random().toString(36).substring(2, 15) +
                          Math.random().toString(36).substring(2, 15);
      localStorage.setItem('deviceId', devId);
    }
    return devId;
  };

  const login = async (email, password) => {
    const deviceId = getOrCreateDeviceId();
    const res = await api.post('/auth/login', { email, password, deviceId });
    if (res.status === 202) {
      const err = new Error(res.data.message || 'Device approval required');
      err.response = res;
      throw err;
    }
    const { token, firebaseToken, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (firebaseToken) {
      localStorage.setItem('firebaseToken', firebaseToken);
      await syncFirebaseAuth(firebaseToken);
    }
    setUser(userData);
    // Tell all other tabs this user just logged in
    broadcast(MSG.LOGGED_IN, { userData });
    return res.data;
  };

  const loginWithToken = async (token, firebaseToken, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (firebaseToken) {
      localStorage.setItem('firebaseToken', firebaseToken);
      await syncFirebaseAuth(firebaseToken);
    }
    setUser(userData);
    broadcast(MSG.LOGGED_IN, { userData });
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    return res.data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (e) {}
    clearAuthStorage();
    try { await signOut(firebaseClientAuth); } catch (e) {}
    setUser(null);
    // Tell all other tabs to log out too
    broadcast(MSG.LOGGED_OUT);
  };

  const openAuth  = (mode = 'login') => { setAuthMode(mode); setShowAuthModal(true); };
  const closeAuth = () => setShowAuthModal(false);

  return (
    <AuthContext.Provider
      value={{
        user, loading,
        login, register, logout, loginWithToken,
        showAuthModal, openAuth, closeAuth,
        authMode, setAuthMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
