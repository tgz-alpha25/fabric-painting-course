import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
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
    if (storedUser && storedUser !== 'undefined' && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
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

  // Handle automatic JWT expiration logout
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } else if (decoded) {
        const timeUntilExpiry = decoded.exp * 1000 - Date.now();
        const timeoutId = setTimeout(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
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

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return res.data;
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
    setUser(null);
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const closeAuth = () => setShowAuthModal(false);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, showAuthModal, openAuth, closeAuth, authMode, setAuthMode }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
