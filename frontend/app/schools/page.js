'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/services/api';
import SchoolCard from '@/components/school/SchoolCard';
import AppHeader from '@/components/common/AppHeader';

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSchools()
      .then((result) => setSchools(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Community network</p><h1>Registered schools</h1><p>Places where local food services are available to students and staff.</p></div>
      {error ? <p>{error}</p> : <div className="school-grid">{schools.map((school) => <SchoolCard key={school.id} school={school} />)}</div>}
    </main></>
  );
}
