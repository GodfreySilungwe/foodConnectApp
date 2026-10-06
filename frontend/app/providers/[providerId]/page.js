'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';

export default function ProviderDetailsPage() {
  const { providerId } = useParams();
  const [provider, setProvider] = useState(null);
  const [menu, setMenu] = useState([]);
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState('');
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

  const filteredMenu = menu.filter((item) => matchesSearch(
    query,
    item.name,
    item.description,
    item.availableSchools?.map((school) => school.name).join(' ')
  ));
  const filteredSchools = schools.filter((school) => matchesSearch(query, school.name, school.location));

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/providers" className="page-back">Back to providers</Link>
      {error && <p>{error}</p>}
      {provider && <>
        <div className="page-heading"><p className="eyebrow">Provider profile</p><h1>{provider.name}</h1><p>{provider.ownerName} · {provider.status}</p></div>
        {provider.description && <p>{provider.description}</p>}
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
