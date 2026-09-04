'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';

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
    <main className="container page-content">
      <Link href="/">Back to home</Link>
      {error && <p>{error}</p>}
      {school && <><h1>{school.name}</h1><p>{school.location}</p><p>{school.studentCount} students</p></>}
    </main>
  );
}
