'use client';

import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import AppHeader from '@/components/common/AppHeader';
import '@/styles/pages/Auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      showNotification('Welcome back!', 'success');
      router.push('/');
    } catch (error) {
      showNotification(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <><AppHeader /><div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <span className="auth-icon">🍽️</span>
            <h1>Welcome Back</h1>
            <p className="auth-subtitle">
              Sign in to your FoodConnect account
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="auth-link">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div></>
  );
}