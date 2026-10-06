'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import ProviderCard from '@/components/provider/ProviderCard';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProviders()
      .then((result) => setProviders(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const filteredProviders = providers.filter((provider) => matchesSearch(
    query,
    provider.name,
    provider.ownerName,
    provider.description,
    provider.location
  ));

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">The local network</p><h1>Food providers</h1><p>Find reliable kitchens and community partners near you.</p></div>
      <SearchField value={query} onChange={setQuery} placeholder="Search providers" label="Search providers" />
      {error ? <p>{error}</p> : (
        filteredProviders.length ? <div className="provider-grid">
          {filteredProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div> : <p>No providers match your search.</p>
      )}
    </main></>
  );
}
