'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';

export default function ProviderDetailsPage() {
  const { providerId } = useParams();
  const [provider, setProvider] = useState(null);
  const [menu, setMenu] = useState([]);
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!providerId) return;
    Promise.all([api.getProvider(providerId), api.getMenu(providerId), api.getSchools()])
      .then(([providerResult, menuResult, schoolsResult]) => {
        setProvider(providerResult.data);
        setMenu(menuResult.data || []);
        const schoolIds = providerResult.data.schoolIds || [];
        setSchools((schoolsResult.data || []).filter((school) => schoolIds.includes(school.id)));
      })
      .catch((requestError) => setError(requestError.message));
  }, [providerId]);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/providers" className="page-back">Back to providers</Link>
      {error && <p>{error}</p>}
      {provider && <>
        <div className="page-heading"><p className="eyebrow">Provider profile</p><h1>{provider.name}</h1><p>{provider.ownerName} · {provider.status}</p></div>
        <section>
          <h2>Registered schools</h2>
          {schools.length ? <ul>{schools.map((school) => <li key={school.id}><Link href={`/schools/${school.id}`}>{school.name}</Link></li>)}</ul> : <p>No schools are associated with this provider.</p>}
        </section>
        <MenuGrid items={menu} />
      </>}
    </main></>
  );
}
