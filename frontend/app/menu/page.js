'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getFeaturedMenu()
      .then((result) => setItems(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const filteredItems = items.filter((item) => matchesSearch(
    query,
    item.name,
    item.description,
    item.providerName,
    item.availableSchools?.map((school) => school.name).join(' ')
  ));

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Explore FoodConnect</p><h1>Featured menu</h1><p>Fresh choices from trusted local providers.</p></div>
      <SearchField value={query} onChange={setQuery} placeholder="Search dishes, providers, or schools" label="Search menu" />
      {error ? <p>{error}</p> : filteredItems.length ? <MenuGrid items={filteredItems} showProvider /> : <p>No dishes match your search.</p>}
    </main></>
  );
}
