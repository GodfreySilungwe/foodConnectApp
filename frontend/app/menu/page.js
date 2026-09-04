'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getFeaturedMenu()
      .then((result) => setItems(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <main className="container page-content">
      <Link href="/">Back to home</Link>
      <h1>Featured menu</h1>
      {error ? <p>{error}</p> : <MenuGrid items={items} showProvider />}
    </main>
  );
}
