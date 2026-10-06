'use client';

import { useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import { compressImage } from '@/utils/images';
import '@/styles/pages/Auth.css';
import '@/styles/components/ProfileImageUpload.css';

export default function RegisterSchoolPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [form, setForm] = useState({ name: '', location: '', studentCount: '0', image: '' });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await compressImage(file, 150000);
      setForm((current) => ({ ...current, image }));
    } catch (imageError) {
      showNotification(imageError.message || 'Could not process school image', 'error');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.registerSchool({
        name: form.name,
        location: form.location,
        studentCount: Number(form.studentCount) || 0,
        image: form.image || null,
      }, token);
      showNotification('School registered successfully.', 'success');
      router.push(`/schools/${result.data.id}`);
    } catch (error) {
      showNotification(error.message || 'School registration failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <><AppHeader /><main className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <header className="auth-header">
            <span className="auth-icon" aria-hidden="true">⌂</span>
            <h1>Register a school</h1>
            <p className="auth-subtitle">Add your school to the FoodConnect network.</p>
          </header>
          {authLoading ? <p>Checking your account...</p> : !user ? (
            <div className="auth-form">
              <p>Sign in with a provider or administrator account to register a school.</p>
              <Link href="/register?role=school" className="btn btn-primary btn-lg btn-block">Create school administrator account</Link>
              <Link href="/login" className="auth-link">Already registered? Sign in</Link>
            </div>
          ) : !['school', 'provider', 'admin'].includes(user.role) ? (
            <div className="auth-form">
              <p>This form is available to provider and administrator accounts.</p>
              <Link href="/register?role=school" className="auth-link">Create a school administrator account</Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <div className="form-group"><label htmlFor="school-name">School name</label><input id="school-name" value={form.name} onChange={update('name')} required maxLength={120} disabled={submitting} /></div>
              <div className="form-group"><label htmlFor="school-location">City or area</label><input id="school-location" value={form.location} onChange={update('location')} required maxLength={120} disabled={submitting} /></div>
              <div className="form-group"><label htmlFor="student-count">Approximate student count</label><input id="student-count" type="number" min="0" step="1" value={form.studentCount} onChange={update('studentCount')} disabled={submitting} /><small>Defaults to 0; you can change this estimate.</small></div>
              <div className="form-group"><label htmlFor="school-image">School card image</label><input id="school-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={submitting} /><small>Choose one image; it will be cropped and compressed.</small></div>
              {form.image && <div className="profile-image-preview"><img src={form.image} alt="School card preview" /><button type="button" onClick={() => setForm((current) => ({ ...current, image: '' }))} disabled={submitting}>Remove image</button></div>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>{submitting ? 'Registering school...' : 'Register school'}</button>
            </form>
          )}
          <footer className="auth-footer"><Link href="/schools" className="auth-link">Browse registered schools</Link></footer>
        </div>
      </div>
    </main></>
  );
}