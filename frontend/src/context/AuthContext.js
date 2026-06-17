import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { db, auth as firebaseClientAuth } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    const firebaseToken = localStorage.getItem('firebaseToken');

    const initAuth = async () => {
      if (storedUser && storedUser !== 'undefined' && token) {
        try {
          setUser(JSON.parse(storedUser));
          if (firebaseToken) {
            await syncFirebaseAuth(firebaseToken);
          } else {
            try {
              const res = await api.get('/auth/firebase-token');
              const freshToken = res.data.firebaseToken;
              localStorage.setItem('firebaseToken', freshToken);
              await signInWithCustomToken(firebaseClientAuth, freshToken);
            } catch (e) {
              console.warn('Could not fetch Firebase token on init:', e.message);
            }
          }
        } catch (e) {
          console.error('Error parsing stored user:', e);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('firebaseToken');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Sync authentication across multiple browser tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        if (!e.newValue) {
          setUser(null);
        } else {
          const storedUser = localStorage.getItem('user');
          if (storedUser && storedUser !== 'undefined') {
            try {
              setUser(JSON.parse(storedUser));
            } catch (e) {
              setUser(null);
            }
          }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Real-time listener to detect if this session was invalidated by another login
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const decoded = parseJwt(token);
    const mySessionToken = decoded?.sessionToken;
    if (!mySessionToken) return;

    // Listen to changes in the user's Firestore document
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentSession = data.currentSession;
        
        // If current session is null, or it has a different session token, we are logged out!
        if (!currentSession || currentSession.sessionToken !== mySessionToken) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('firebaseToken');
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          toast.error('Session expired. Another device logged in.', { id: 'session-conflict-toast' });
          
          // Force a storage event update locally so other tabs are notified
          try {
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'token',
              newValue: null,
              storageArea: localStorage
            }));
          } catch (e) {}

          // Redirect to home if they are on a protected route
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
      }
    }, (error) => {
      console.error('Firestore user snapshot error:', error);
    });

    return () => unsub();
  }, [user]);

  // Handle automatic JWT expiration logout
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('firebaseToken');
        setUser(null);
        signOut(firebaseClientAuth).catch(() => {});
      } else if (decoded) {
        const timeUntilExpiry = decoded.exp * 1000 - Date.now();
        const timeoutId = setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('firebaseToken');
          setUser(null);
          signOut(firebaseClientAuth).catch(() => {});
          // Force a storage event update locally so other tabs are notified
          try {
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'token',
              newValue: null,
              storageArea: localStorage
            }));
          } catch (e) {}
        }, timeUntilExpiry);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [user]);

  const getOrCreateDeviceId = () => {
    let devId = localStorage.getItem('deviceId');
    if (!devId) {
      devId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('firebaseToken');
    try {
      await signOut(firebaseClientAuth);
    } catch (e) {}
    setUser(null);
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const closeAuth = () => setShowAuthModal(false);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, loginWithToken, showAuthModal, openAuth, closeAuth, authMode, setAuthMode }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
