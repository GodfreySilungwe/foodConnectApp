'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import SchoolCard from '@/components/school/SchoolCard';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';

export default function SchoolsPage() {
  const { user } = useContext(AuthContext);
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSchools()
      .then((result) => setSchools(result.data || []))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const filteredSchools = schools.filter((school) => matchesSearch(query, school.name, school.location));

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Community network</p><h1>Registered schools</h1><p>Places where local food services are available to students and staff.</p>{['provider', 'school', 'admin'].includes(user?.role) && <Link href="/schools/register" className="btn btn-primary btn-sm">Register a school</Link>}</div>
      <SearchField value={query} onChange={setQuery} placeholder="Search schools by name or location" label="Search schools" />
      {error ? <p>{error}</p> : filteredSchools.length ? <div className="school-grid">{filteredSchools.map((school) => <SchoolCard key={school.id} school={school} />)}</div> : <p>No schools match your search.</p>}
    </main></>
  );
}
