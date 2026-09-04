'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';

export default function ProviderDetailsPage() {
  const { providerId } = useParams();
  const [provider, setProvider] = useState(null);
  const [menu, setMenu] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!providerId) return;
    Promise.all([api.getProvider(providerId), api.getMenu(providerId)])
      .then(([providerResult, menuResult]) => {
        setProvider(providerResult.data);
        setMenu(menuResult.data || []);
      })
      .catch((requestError) => setError(requestError.message));
  }, [providerId]);

  return (
    <main className="container page-content">
      <Link href="/providers">Back to providers</Link>
      {error && <p>{error}</p>}
      {provider && <><h1>{provider.name}</h1><p>{provider.ownerName} · {provider.status}</p><MenuGrid items={menu} /></>}
    </main>
  );
}
