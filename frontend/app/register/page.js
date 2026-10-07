'use client';

import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import AppHeader from '@/components/common/AppHeader';
import FormBackLink from '@/components/common/FormBackLink';
import LocationPicker from '@/components/common/LocationPicker';
import { getCoordinatesOrCurrentPosition } from '@/utils/location';
import '@/styles/pages/Auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'customer', latitude: null, longitude: null });
  const [loading, setLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const { register } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const router = useRouter();

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (requestedRole === 'school' || requestedRole === 'provider') {
      setForm((current) => ({ ...current, role: requestedRole }));
    }
  }, []);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoading(true);
    try {
      const coordinates = form.role === 'customer' ? await getCoordinatesOrCurrentPosition(form) : {};
      await register({ ...form, ...coordinates });
      showNotification('Your account is ready.', 'success');
      router.push(form.role === 'school' ? '/schools/register' : form.role === 'provider' ? '/providers/profile' : '/');
    } catch (error) {
      if (error.message?.toLowerCase().includes('already exists')) setEmailExists(true);
      else showNotification(error.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <><AppHeader /><main className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <FormBackLink />
          <header className="auth-header">
            <span className="auth-icon">✦</span>
            <h1>Create your account</h1>
            <p className="auth-subtitle">Create an account to connect students with local meals.</p>
          </header>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group"><label htmlFor="name">Full name</label><input id="name" value={form.name} onChange={update('name')} placeholder="Your name" required disabled={loading} /></div>
            <div className="form-group"><label htmlFor="email">Email address</label><input id="email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required disabled={loading} /></div>
            {['customer', 'provider'].includes(form.role) && <div className="form-group"><label htmlFor="phone">Phone number</label><input id="phone" type="tel" value={form.phone} onChange={update('phone')} placeholder="Your phone number" autoComplete="tel" required disabled={loading} /></div>}
            <div className="form-group"><label htmlFor="password">Password</label><input id="password" type="password" minLength="6" value={form.password} onChange={update('password')} placeholder="At least 6 characters" required disabled={loading} /></div>
            <div className="form-group"><label htmlFor="role">I am joining as</label><select id="role" value={form.role} onChange={update('role')} disabled={loading}><option value="customer">Parent or guardian</option><option value="provider">Food provider</option><option value="school">School administrator</option></select></div>
            {form.role === 'customer' && (
              <LocationPicker
                value={{ latitude: form.latitude, longitude: form.longitude }}
                onChange={(coordinates) => setForm((current) => ({ ...current, ...coordinates }))}
                label="Select your home or pickup location"
                autoLocate
              />
            )}
            {emailExists && <p className="checkout-error" role="alert">An account with this email already exists. <Link href="/login" className="auth-link">Sign in instead</Link></p>}
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
          <footer className="auth-footer"><p>Already have an account? <Link href="/login" className="auth-link">Sign in</Link></p></footer>
        </div>
      </div>
    </main></>
  );
}
