'use client';

import { createContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('foodconnect-session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        setUser(session.user);
        setToken(session.token);
      } catch (e) {
        localStorage.removeItem('foodconnect-session');
      }
    }
    setLoading(false);
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
      // Auto-login after registration
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