'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';

export default function SchoolDetailsPage() {
  const { schoolId } = useParams();
  const [school, setSchool] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    api.getSchool(schoolId)
      .then((result) => setSchool(result.data))
      .catch((requestError) => setError(requestError.message));
  }, [schoolId]);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      {error && <p>{error}</p>}
      {school && <div className="page-heading"><p className="eyebrow">Community partner</p><h1>{school.name}</h1><p>{school.location} · {school.studentCount} students</p></div>}
    </main></>
  );
}
