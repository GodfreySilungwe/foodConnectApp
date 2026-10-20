'use client';

import { createContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      const stored = localStorage.getItem('foodconnect-session');
      if (stored) {
        try {
          let session = JSON.parse(stored);
          setUser(session.user);
          setToken(session.token);

          if (session.user?.role === 'customer') {
            try {
              const refreshed = await api.refreshSession(session.token);
              session = refreshed.data;
              if (mounted) {
                setUser(session.user);
                setToken(session.token);
                localStorage.setItem('foodconnect-session', JSON.stringify(session));
              }
            } catch (error) {
              if (error.message === 'Invalid or expired token') {
                localStorage.removeItem('foodconnect-session');
                if (mounted) {
                  setUser(null);
                  setToken(null);
                }
              } else {
                console.error('Failed to refresh parent session:', error);
              }
            }
          }
        } catch (error) {
          localStorage.removeItem('foodconnect-session');
          if (error instanceof SyntaxError) {
            console.error('Stored FoodConnect session is invalid JSON:', error);
          } else {
            throw error;
          }
        }
      }
      if (mounted) setLoading(false);
    };

    restoreSession();
    return () => { mounted = false; };
  }, []);

  const login = async (email, password) => {
    const result = await api.login({ email, password });
    if (result.success && result.data) {
      const session = result.data;
      setUser(session.user);
      setToken(session.token);
      localStorage.setItem('foodconnect-session', JSON.stringify(session));
      return session;
    }
    throw new Error(result.error || 'Login failed');
  };

  const register = async (userData) => {
    const result = await api.register(userData);
    if (result.success && result.data) {
      if (result.data.token && result.data.user) {
        const session = { token: result.data.token, user: result.data.user };
        setUser(session.user);
        setToken(session.token);
        localStorage.setItem('foodconnect-session', JSON.stringify(session));
        return session;
      }
      return await login(userData.email, userData.password);
    }
    throw new Error(result.error || 'Registration failed');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('foodconnect-session');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}