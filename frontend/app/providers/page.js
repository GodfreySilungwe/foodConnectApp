'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import ProviderCard from '@/components/provider/ProviderCard';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';
import { getCurrentCoordinates } from '@/utils/location';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState('');

  useEffect(() => {
    let active = true;
    const loadProviders = async () => {
      let currentLocation = null;
      try {
        currentLocation = await getCurrentCoordinates();
        if (active) {
          setLocation(currentLocation);
          setLocationMessage('');
        }
      } catch (locationError) {
        if (active) {
          setLocation(null);
          setLocationMessage(`${locationError.message} Showing providers without distance sorting.`);
        }
      }

      try {
        const [providerResult, schoolResult] = await Promise.all([
          api.getProviders(currentLocation ? `?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}` : ''),
          api.getSchools(currentLocation ? `?latitude=${currentLocation.latitude}&longitude=${currentLocation.longitude}` : ''),
        ]);
        if (!active) return;
        setProviders(providerResult.data || []);
        setSchools(schoolResult.data || []);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProviders();
    return () => { active = false; };
  }, []);

  const sortedProviders = location ? [...providers].sort((left, right) => {
    const leftDistance = Number(left.distanceKm ?? Infinity);
    const rightDistance = Number(right.distanceKm ?? Infinity);
    return leftDistance - rightDistance;
  }) : providers;

  const filteredProviders = sortedProviders.filter((provider) => matchesSearch(
    query,
    provider.name,
    provider.ownerName,
    provider.description,
    provider.location,
    schools.filter((school) => (provider.schoolIds || []).includes(school.id)).map((school) => school.name).join(' ')
  ));

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">The local network</p><h1>Food providers</h1><p>Find reliable kitchens and community partners near you.</p></div>
      <SearchField value={query} onChange={setQuery} placeholder="Search providers or schools" label="Search providers and associated schools" />
      {loading ? <p className="data-loading" role="status"><span className="data-loading-spinner" aria-hidden="true" />Loading providers and schools...</p> : locationMessage && <p role="status">{locationMessage}</p>}
      {!loading && error ? <p role="alert">{error}</p> : !loading && (
        filteredProviders.length ? <div className="provider-grid">
          {filteredProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div> : <p>No providers match your search.</p>
      )}
    </main></>
  );
}
