'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';

export default function ProviderDetailsPage() {
  const { providerId } = useParams();
  const { user, token } = useContext(AuthContext);
  const [provider, setProvider] = useState(null);
  const [menu, setMenu] = useState([]);
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchProvider = async () => {
    if (!providerId) return;
    try {
      const [providerResult, menuResult, schoolsResult] = await Promise.all([api.getProvider(providerId), api.getMenu(providerId), api.getSchools()]);
      setProvider(providerResult.data);
      setMenu(menuResult.data || []);
      const schoolIds = providerResult.data.schoolIds || [];
      setSchools((schoolsResult.data || []).filter((school) => schoolIds.includes(school.id)));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    fetchProvider();
  }, [providerId]);

  const filteredMenu = menu.filter((item) => matchesSearch(
    query,
    item.name,
    item.description,
    item.availableSchools?.map((school) => school.name).join(' ')
  ));
  const filteredSchools = schools.filter((school) => matchesSearch(query, school.name, school.location));
  const ratingValue = Number(provider?.rating ?? provider?.averageRating ?? 0) || 0;
  const starButtons = [1, 2, 3, 4, 5];

  const handleRatingSubmit = async () => {
    if (!providerId || !token || user?.role !== 'customer' || !selectedRating) {
      return;
    }

    setSubmittingRating(true);
    try {
      await api.submitProviderRating(providerId, selectedRating, token);
      await fetchProvider();
      setSelectedRating(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/providers" className="page-back">Back to providers</Link>
      {error && <p>{error}</p>}
      {provider && <>
        <div className="page-heading"><p className="eyebrow">Provider profile</p><h1>{provider.name}</h1><p>{provider.ownerName} · {provider.status}</p>{provider.phone && <p>Phone: <a href={`tel:${provider.phone}`}>{provider.phone}</a></p>}</div>
        {provider.description && <p>{provider.description}</p>}
        <div className="provider-card-meta">
          <span>⭐ {ratingValue ? `${'★'.repeat(Math.min(5, Math.round(ratingValue)))} ${ratingValue.toFixed(1)}` : 'No ratings yet'}</span>
          <span>📍 {provider.location || 'Nearby'}</span>
        </div>
        {user?.role === 'customer' && (
          <div className="provider-rating-box">
            <p>Rate this provider</p>
            <div className="provider-rating-stars">
              {starButtons.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRating(value)}
                  aria-label={`Rate ${value} out of 5`}
                  className={selectedRating >= value ? 'active' : ''}
                >
                  ★
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleRatingSubmit} disabled={!selectedRating || submittingRating}>
              {submittingRating ? 'Submitting...' : 'Submit rating'}
            </button>
          </div>
        )}
        <SearchField value={query} onChange={setQuery} placeholder="Search dishes or associated schools" label="Search provider listings" />
        <section>
          <h2>Registered schools</h2>
          {filteredSchools.length ? <ul>{filteredSchools.map((school) => <li key={school.id}><Link href={`/schools/${school.id}`}>{school.name}</Link></li>)}</ul> : <p>No associated schools match your search.</p>}
        </section>
        {filteredMenu.length ? <MenuGrid items={filteredMenu} /> : <p>No menu items match your search.</p>}
      </>}
    </main></>
  );
}
