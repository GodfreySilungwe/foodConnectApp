'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import LocationPicker from '@/components/common/LocationPicker';
import { compressImage } from '@/utils/images';
import { getCoordinatesOrCurrentPosition } from '@/utils/location';
import '@/styles/pages/Auth.css';
import '@/styles/components/ProfileImageUpload.css';

export default function ProviderProfilePage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    description: '',
    image: '',
    location: '',
    latitude: null,
    longitude: null,
  });
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'provider' || !user.providerId) {
      setLoading(false);
      return;
    }

    let active = true;
    api.getProvider(user.providerId)
      .then(({ data }) => {
        if (!active) return;
        setForm({
          name: data.name || '',
          phone: data.phone || user.phone || '',
          description: data.description || '',
          image: data.image || '',
          location: data.location || '',
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
        setHasProviderProfile(true);
      })
      .catch((requestError) => {
        if (requestError.message !== 'Provider not found' && active) {
          setError(requestError.message || 'Could not load provider profile');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [authLoading, user]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const image = await compressImage(file, 150000);
      setForm((current) => ({ ...current, image }));
    } catch (imageError) {
      showNotification(imageError.message || 'Could not process provider image', 'error');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.location.trim()) {
      showNotification('Enter a provider location.', 'warning');
      return;
    }

    setSaved(false);
    setSubmitting(true);
    try {
      const coordinates = await getCoordinatesOrCurrentPosition(form);
      const profile = {
        name: form.name.trim(),
        ownerName: user.name,
        email: user.email,
        phone: form.phone.trim(),
        description: form.description.trim(),
        image: form.image || null,
        location: form.location.trim(),
        ...coordinates,
        schoolIds: [],
      };
      if (hasProviderProfile) {
        await api.updateProviderProfile(user.providerId, profile, token);
      } else {
        await api.registerProvider(profile, token);
        setHasProviderProfile(true);
      }
      showNotification('Provider profile saved.', 'success');
      setSaved(true);
    } catch (requestError) {
      showNotification(requestError.message || 'Could not save provider profile', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <><AppHeader /><main className="auth-page">
      <div className="auth-container">
        <section className="auth-card">
          <header className="auth-header">
            <span className="auth-icon" aria-hidden="true">⌂</span>
            <h1>{hasProviderProfile ? 'Provider profile' : 'Complete your provider profile'}</h1>
          </header>
          {authLoading || loading ? <p>Loading your profile...</p> : !user ? (
            <div className="auth-form">
              <p>Sign in with a provider account to set up a provider profile.</p>
              <Link href="/register?role=provider" className="btn btn-primary btn-lg btn-block">Create provider account</Link>
              <Link href="/login" className="auth-link">Already have an account? Sign in</Link>
            </div>
          ) : user.role !== 'provider' ? (
            <p>Provider accounts are required to manage a provider profile.</p>
          ) : error ? (
            <p className="checkout-error" role="alert">{error}</p>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <div className="form-group">
                <label htmlFor="provider-name">Provider or kitchen name</label>
                <input id="provider-name" value={form.name} onChange={update('name')} required maxLength={120} disabled={submitting} />
              </div>
              <div className="form-group">
                <label htmlFor="provider-phone">Phone number</label>
                <input id="provider-phone" type="tel" value={form.phone} onChange={update('phone')} required autoComplete="tel" disabled={submitting} />
              </div>
              <div className="form-group">
                <label htmlFor="provider-description">Short description</label>
                <textarea id="provider-description" value={form.description} onChange={update('description')} maxLength={240} rows={3} placeholder="Describe your kitchen or meals" disabled={submitting} />
              </div>
              <div className="form-group">
                <label htmlFor="provider-location">Provider location</label>
                <input id="provider-location" value={form.location} onChange={update('location')} required maxLength={160} placeholder="Town, district, or address" disabled={submitting} />
              </div>
              <LocationPicker
                value={{ latitude: form.latitude, longitude: form.longitude }}
                onChange={(coordinates) => setForm((current) => ({ ...current, ...coordinates }))}
                label="Select your provider location"
                autoLocate={!hasProviderProfile}
              />
              <div className="form-group">
                <label htmlFor="provider-image">Provider card image</label>
                <input id="provider-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={submitting} />
                <small>Optional. The image will be cropped and compressed.</small>
              </div>
              {form.image && <div className="profile-image-preview">
                <img src={form.image} alt="Provider card preview" />
                <button type="button" onClick={() => setForm((current) => ({ ...current, image: '' }))} disabled={submitting}>Remove image</button>
              </div>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
                {submitting ? 'Saving profile...' : hasProviderProfile ? 'Save provider profile' : 'Save and finish provider setup'}
              </button>
              {saved && <p role="status" className="form-success">Provider profile saved successfully.</p>}
            </form>
          )}
          {hasProviderProfile && <footer className="auth-footer">
            <Link href="/providers/schools" className="auth-link">Set school coverage</Link>
            {' · '}
            <Link href="/schools/register?from=provider" className="auth-link">Register a school</Link>
          </footer>}
        </section>
      </div>
    </main></>
  );
}
