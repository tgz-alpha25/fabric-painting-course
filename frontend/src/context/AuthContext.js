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
            const storedFirebaseToken = localStorage.getItem('firebaseToken');
            if (storedToken && storedUser) {
              try {
                setUser(JSON.parse(storedUser));
                if (storedFirebaseToken) {
                  syncFirebaseAuth(storedFirebaseToken);
                }
              } catch (e) { /* ignore */ }
            }
          }
          break;

        case MSG.LOGGED_OUT:
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          break;

        case MSG.SESSION_EXPIRED:
          clearAuthStorage();
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          toast.error('Logged out — another device signed in.', {
            id: 'session-expired-cross-tab',
            duration: 5000,
          });
          if (['/course', '/admin'].some(p => window.location.pathname.startsWith(p))) {
            window.location.href = '/';
          }
          break;

        case MSG.TOKEN_EXPIRED:
          clearAuthStorage();
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          toast('Your session expired. Please log in again.', {
            id: 'token-expired-cross-tab',
            icon: '⏰',
            duration: 5000,
          });
          if (['/course', '/admin'].some(p => window.location.pathname.startsWith(p))) {
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
          const storedFirebaseToken = localStorage.getItem('firebaseToken');
          if (storedUser && storedUser !== 'undefined') {
            try {
              setUser(JSON.parse(storedUser));
              if (storedFirebaseToken) {
                syncFirebaseAuth(storedFirebaseToken);
              }
            } catch (err) { setUser(null); }
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── 5. Firestore real-time session listener + polling fallback ──────────
  //
  // Strategy A: Firestore onSnapshot (instant, real-time)
  //   - Requires Firebase Client Auth to be signed in.
  //   - We attempt to sign in with the stored Firebase custom token first;
  //     if the token is stale we refresh it from the backend.
  //   - If Firebase Auth cannot be established, we rely on Strategy B.
  //
  // Strategy B: Backend polling every 30 s (reliable fallback)
  //   - Calls /auth/profile which validates the JWT session server-side.
  //   - The backend returns SESSION_CONFLICT when currentSession no longer
  //     matches, which triggers an immediate local logout.
  //   - This works regardless of Firebase client auth state.
  //
  // Both strategies are active simultaneously. Whichever detects the session
  // invalidation first wins — the other simply becomes a no-op afterwards.
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const decoded = parseJwt(token);
    const mySessionToken = decoded?.sessionToken;
    if (!mySessionToken) return;

    let isMounted = true;

    // Shared forced-logout handler so both strategies call the same path
    const forceLogout = (reason = 'Session expired — another device logged in.') => {
      if (!isMounted) return;
      isMounted = false; // prevent double-trigger
      clearAuthStorage();
      setUser(null);                                    // instant React re-render
      signOut(firebaseClientAuth).catch(() => {});
      broadcast(MSG.SESSION_EXPIRED);
      toast.error(reason, { id: 'session-conflict-toast', duration: 5000 });
      // Redirect away from protected pages; on '/' setUser(null) already updates the UI
      const protectedPaths = ['/course', '/admin'];
      if (protectedPaths.some(p => window.location.pathname.startsWith(p))) {
        window.location.href = '/';
      }
    };

    // ── Strategy A: Firestore onSnapshot ──────────────────────────────────
    let unsubSnapshot = null;

    const setupFirestoreListener = () => {
      if (unsubSnapshot) return; // already subscribed
      unsubSnapshot = onSnapshot(
        doc(db, 'users', user.uid),
        (docSnap) => {
          if (!docSnap.exists() || !isMounted) return;
          const data = docSnap.data();
          const currentSession = data.currentSession;

          if (!currentSession || currentSession.sessionToken !== mySessionToken) {
            forceLogout('Session expired — another device logged in.');
          } else if (data.sessionInvalidatedAt && data.currentSession?.loginAt) {
            const invalidatedAt = data.sessionInvalidatedAt.toDate
              ? data.sessionInvalidatedAt.toDate()
              : new Date(data.sessionInvalidatedAt);
            const loginAt = data.currentSession.loginAt.toDate
              ? data.currentSession.loginAt.toDate()
              : new Date(data.currentSession.loginAt);
            if (invalidatedAt > loginAt) {
              forceLogout('Session invalidated by newer login.');
            }
          }
        },
        (error) => {
          console.warn('Firestore snapshot error (will rely on polling):', error.message);
          // Don't rethrow — Strategy B will cover us
        }
      );
    };

    // Attempt to sign in to Firebase Client Auth so Firestore rules pass
    const initFirestoreListener = async () => {
      try {
        const storedFirebaseToken = localStorage.getItem('firebaseToken');
        if (storedFirebaseToken) {
          await syncFirebaseAuth(storedFirebaseToken);
        } else {
          const res = await api.get('/auth/firebase-token');
          const freshToken = res.data.firebaseToken;
          localStorage.setItem('firebaseToken', freshToken);
          await syncFirebaseAuth(freshToken);
        }
        if (isMounted) setupFirestoreListener();
      } catch (err) {
        console.warn('Could not init Firebase auth for snapshot listener, using polling only:', err.message);
      }
    };

    initFirestoreListener();

    // Also listen for Firebase Auth state changes (handles token refresh mid-session)
    const unsubscribeAuth = firebaseClientAuth.onAuthStateChanged((firebaseUser) => {
      if (!isMounted) return;
      if (firebaseUser && firebaseUser.uid === user.uid) {
        setupFirestoreListener();
      }
    });

    // ── Strategy B: Backend polling fallback every 30 s ──────────────────
    const pollSession = async () => {
      if (!isMounted) return;
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;
      try {
        await api.get('/auth/profile');
        // 200 = session still valid, do nothing
      } catch (err) {
        if (!isMounted) return;
        const code = err.response?.data?.code;
        const status = err.response?.status;
        if (status === 401 && (code === 'SESSION_CONFLICT' || code === 'TOKEN_EXPIRED')) {
          forceLogout(
            code === 'SESSION_CONFLICT'
              ? 'Session expired — another device logged in.'
              : 'Your session expired. Please log in again.'
          );
        }
        // Other errors (network, 5xx) are transient — keep polling
      }
    };

    const pollIntervalId = setInterval(pollSession, 30000);
    // Run once immediately to catch a session change that happened while offline
    pollSession();

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubSnapshot) unsubSnapshot();
      clearInterval(pollIntervalId);
    };
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
    // If backend indicates device approval is required (status 202) or an error code, treat as error
    if (res.status !== 200) {
      const err = new Error(res.data?.message || 'Login error');
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
