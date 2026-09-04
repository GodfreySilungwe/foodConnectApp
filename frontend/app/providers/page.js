'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import ProviderCard from '@/components/provider/ProviderCard';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProviders()
      .then((result) => setProviders(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <main className="container page-content">
      <Link href="/">Back to home</Link>
      <h1>Food providers</h1>
      {error ? <p>{error}</p> : (
        <div className="provider-grid">
          {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div>
      )}
    </main>
  );
}
