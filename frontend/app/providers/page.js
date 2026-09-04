'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import ProviderCard from '@/components/provider/ProviderCard';
import AppHeader from '@/components/common/AppHeader';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProviders()
      .then((result) => setProviders(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">The local network</p><h1>Food providers</h1><p>Find reliable kitchens and community partners near you.</p></div>
      {error ? <p>{error}</p> : (
        <div className="provider-grid">
          {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
        </div>
      )}
    </main></>
  );
}
