'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';
import '@/styles/pages/Auth.css';
import '@/styles/pages/ProviderSchools.css';

export default function ProviderSchoolsPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolIds, setSelectedSchoolIds] = useState([]);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

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
        if (user.providerId) {
          try {
            const providerResult = await api.getProvider(user.providerId);
            if (!active) return;
            setHasProviderProfile(true);
            setSelectedSchoolIds(providerResult.data.schoolIds || []);
          } catch (providerError) {
            if (providerError.message === 'Provider not found') {
              setHasProviderProfile(false);
            } else {
              throw providerError;
            }
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

  const submit = async (event) => {
    event.preventDefault();
    if (!user?.providerId || !hasProviderProfile) {
      showNotification('Save your provider profile before managing school coverage.', 'warning');
      return;
    }
    setSaved(false);
    setSubmitting(true);
    try {
      await api.updateProviderSchools(user.providerId, selectedSchoolIds, token);
      showNotification('School coverage saved.', 'success');
      setSaved(true);
    } catch (requestError) {
      showNotification(requestError.message || 'Could not save school coverage', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSchools = schools.filter((school) => matchesSearch(schoolQuery, school.name, school.location));

  return (
    <><AppHeader /><main className="container page-content provider-schools-page">
        <header className="page-heading">
          <p className="eyebrow">Provider workspace</p>
          <h1>School coverage</h1>
        </header>
          {authLoading || loading ? <p>Loading school coverage...</p> : !user ? (
            <div>
              <p>Sign in with a provider account to set your school coverage.</p>
              <Link href="/register?role=provider" className="btn btn-primary btn-lg btn-block">Create provider account</Link>
              <Link href="/login" className="auth-link">Already have an account? Sign in</Link>
            </div>
          ) : user.role !== 'provider' ? (
            <div><p>Provider accounts are required to manage school coverage.</p></div>
          ) : error ? (
            <p className="checkout-error" role="alert">{error}</p>
          ) : !hasProviderProfile ? (
            <section className="provider-coverage-empty">
              <h2>Finish your provider profile first</h2>
              <p>Your profile is saved separately. Once it is complete, you can choose schools here.</p>
              <Link href="/providers/profile" className="btn btn-primary">Set up provider profile</Link>
            </section>
          ) : (
            <form className="auth-form" onSubmit={submit}>
              <fieldset className="provider-school-options">
                <legend>Schools served</legend>
                <p><Link href="/schools/register?from=provider">Register a new school</Link></p>
                {schools.length > 4 && <SearchField value={schoolQuery} onChange={setSchoolQuery} placeholder="Search schools by name or location" label="Search schools you serve" />}
                {filteredSchools.length ? filteredSchools.map((school) => (
                  <label className="provider-school-option" key={school.id}>
                    <input type="checkbox" checked={selectedSchoolIds.includes(school.id)} onChange={() => toggleSchool(school.id)} disabled={submitting} />
                    <span><strong>{school.name}</strong><small>{school.location || 'Location not specified'}</small></span>
                  </label>
                )) : <p>No schools match your search. <Link href="/schools/register">Register a school</Link>.</p>}
              </fieldset>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>{submitting ? 'Saving coverage...' : 'Save school coverage'}</button>
              {saved && <p role="status" className="form-success">School coverage saved successfully.</p>}
            </form>
          )}
    </main></>
  );
}