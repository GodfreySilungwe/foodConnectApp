'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getFeaturedMenu()
      .then((result) => setItems(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Explore FoodConnect</p><h1>Featured menu</h1><p>Fresh choices from trusted local providers.</p></div>
      {error ? <p>{error}</p> : <MenuGrid items={items} showProvider />}
    </main></>
  );
}
