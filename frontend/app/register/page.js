'use client';

import { useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import AppHeader from '@/components/common/AppHeader';
import '@/styles/pages/Auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
  const { register } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const router = useRouter();

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await register(form);
      showNotification('Your account is ready.', 'success');
      router.push('/');
    } catch (error) {
      showNotification(error.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <><AppHeader /><main className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <header className="auth-header">
            <span className="auth-icon">✦</span>
            <h1>Create your account</h1>
            <p className="auth-subtitle">Join the local food network in under a minute.</p>
          </header>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="name">Full name</label><input id="name" value={form.name} onChange={update('name')} placeholder="Your name" required disabled={loading} /></div>
            <div className="form-group"><label htmlFor="email">Email address</label><input id="email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required disabled={loading} /></div>
            <div className="form-group"><label htmlFor="password">Password</label><input id="password" type="password" minLength="6" value={form.password} onChange={update('password')} placeholder="At least 6 characters" required disabled={loading} /></div>
            <div className="form-group"><label htmlFor="role">I am joining as</label><select id="role" value={form.role} onChange={update('role')} disabled={loading}><option value="customer">Customer</option><option value="provider">Food provider</option></select></div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
          <footer className="auth-footer"><p>Already have an account? <Link href="/login" className="auth-link">Sign in</Link></p></footer>
        </div>
      </div>
    </main></>
  );
}
