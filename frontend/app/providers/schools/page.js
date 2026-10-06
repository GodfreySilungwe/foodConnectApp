'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { compressImage } from '@/utils/images';
import { matchesSearch } from '@/utils/search';
import '@/styles/pages/Auth.css';
import '@/styles/pages/ProviderSchools.css';
import '@/styles/components/ProfileImageUpload.css';

export default function ProviderSchoolsPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
  const [providerName, setProviderName] = useState('');
  const [providerDescription, setProviderDescription] = useState('');
  const [providerImage, setProviderImage] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'provider') {
      setLoading(false);
      return;
    }

    let active = true;
    const loadCoverage = async () => {
      try {
        const schoolResult = await api.getSchools();
        if (!active) return;
        setSchools(schoolResult.data || []);
        setProviderName(user.name || '');

        if (user.providerId) {
          try {
            const providerResult = await api.getProvider(user.providerId);
            if (!active) return;
            setHasProviderProfile(true);
            setProviderName(providerResult.data.name || user.name || '');
            setProviderDescription(providerResult.data.description || '');
            setProviderImage(providerResult.data.image || '');
            setSelectedSchoolIds(providerResult.data.schoolIds || []);
          } catch (providerError) {
            if (providerError.message !== 'Provider not found') throw providerError;
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Could not load schools');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCoverage();
    return () => { active = false; };
  }, [authLoading, user]);

  const toggleSchool = (schoolId) => {
    setSelectedSchoolIds((current) => current.includes(schoolId)
      ? current.filter((selectedId) => selectedId !== schoolId)
      : [...current, schoolId]);
  };

  const selectProviderImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setProviderImage(await compressImage(file, 150000));
    } catch (imageError) {
      showNotification(imageError.message || 'Could not process provider image', 'error');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedSchoolIds.length) {
      showNotification('Select at least one school you serve.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (hasProviderProfile) {
        await api.updateProviderProfile(user.providerId, {
          name: providerName,
          description: providerDescription,
          image: providerImage || null,
        }, token);
        await api.updateProviderSchools(user.providerId, selectedSchoolIds, token);
      } else {
        await api.registerProvider({
          name: providerName,
          ownerName: user.name,
          email: user.email,
          schoolIds: selectedSchoolIds,
          description: providerDescription,
          image: providerImage || null,
        }, token);
        setHasProviderProfile(true);
      }
      showNotification('School coverage saved.', 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not save school coverage', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSchools = schools.filter((school) => matchesSearch(schoolQuery, school.name, school.location));

  return (
    <><AppHeader /><main className="auth-page provider-schools-page">
      <div className="auth-container">
        <section className="auth-card provider-schools-card">
          <header className="auth-header">
            <span className="auth-icon" aria-hidden="true">⌖</span>
            <h1>Schools you serve</h1>
            <p className="auth-subtitle">Choose any registered schools to associate with your provider profile.</p>
          </header>
          {authLoading || loading ? <p>Loading school coverage...</p> : !user ? (
            <div className="auth-form">
              <p>Sign in with a provider account to set your school coverage.</p>
              <Link href="/register?role=provider" className="btn btn-primary btn-lg btn-block">Create provider account</Link>
              <Link href="/login" className="auth-link">Already have an account? Sign in</Link>
            </div>
          ) : user.role !== 'provider' ? (
            <div className="auth-form"><p>Provider accounts are required to manage school coverage.</p></div>
          ) : error ? (
            <p className="checkout-error" role="alert">{error}</p>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <div className="form-group"><label htmlFor="provider-name">Provider or kitchen name</label><input id="provider-name" value={providerName} onChange={(event) => setProviderName(event.target.value)} required maxLength={120} disabled={submitting} /></div>
              <div className="form-group"><label htmlFor="provider-description">Short description or advert</label><textarea id="provider-description" value={providerDescription} onChange={(event) => setProviderDescription(event.target.value)} maxLength={240} rows={3} placeholder="Describe your kitchen or today's offer" disabled={submitting} /></div>
              <div className="form-group"><label htmlFor="provider-image">Provider card image</label><input id="provider-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProviderImage} disabled={submitting} /><small>Choose one image; it will be cropped and compressed.</small></div>
              {providerImage && <div className="profile-image-preview"><img src={providerImage} alt="Provider card preview" /><button type="button" onClick={() => setProviderImage('')} disabled={submitting}>Remove image</button></div>}
              <fieldset className="provider-school-options">
                <legend>Schools you provide food to</legend>
                <p><Link href="/schools/register">Register a new school</Link></p>
                {schools.length > 4 && <SearchField value={schoolQuery} onChange={setSchoolQuery} placeholder="Filter schools" label="Filter schools you serve" />}
                {filteredSchools.length ? filteredSchools.map((school) => (
                  <label className="provider-school-option" key={school.id}>
                    <input type="checkbox" checked={selectedSchoolIds.includes(school.id)} onChange={() => toggleSchool(school.id)} disabled={submitting} />
                    <span><strong>{school.name}</strong><small>{school.location || 'Location not specified'}</small></span>
                  </label>
                )) : <p>No schools match your search. <Link href="/schools/register">Register a school</Link>.</p>}
              </fieldset>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting || !schools.length}>{submitting ? 'Saving coverage...' : hasProviderProfile ? 'Save school coverage' : 'Register provider and schools'}</button>
            </form>
          )}
        </section>
      </div>
    </main></>
  );
}