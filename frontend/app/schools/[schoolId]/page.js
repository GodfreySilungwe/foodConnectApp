'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import MenuGrid from '@/components/menu/MenuGrid';

export default function SchoolDetailsPage() {
  const { schoolId } = useParams();
  const [school, setSchool] = useState(null);
  const [providers, setProviders] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState('');

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    setProvidersLoading(true);
    Promise.all([api.getSchool(schoolId), api.getSchoolProviders(schoolId), api.getSchools()])
      .then(async ([schoolResult, providerResult, schoolsResult]) => {
        if (!active) return;
        setSchool(schoolResult.data);
        setAllSchools(schoolsResult.data || []);
        const registeredProviders = providerResult.data || [];
        const providerMenus = await Promise.all(registeredProviders.map(async (provider) => {
          try {
            const menuResult = await api.getMenu(provider.id);
            const schoolMenu = (menuResult.data || []).filter((item) =>
              item.available !== false && (item.availableSchools || []).some((entry) => entry.id === schoolId)
            );
            return [provider.id, schoolMenu];
          } catch {
            return [provider.id, []];
          }
        }));
        const menuByProvider = new Map(providerMenus);
        setProviders(registeredProviders.map((provider) => ({
          ...provider,
          menu: menuByProvider.get(provider.id) || []
        })));
      })
      .catch((requestError) => {
        if (active) setProvidersError(requestError.message || 'Could not load school details');
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });
    return () => { active = false; };
  }, [schoolId]);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      {providersError && <p role="alert">{providersError}</p>}
      {school && <div className="page-heading"><p className="eyebrow">Community partner</p><h1>{school.name}</h1><p>{school.location} · {school.studentCount} students</p></div>}
      {school && <section>
        <h2>Registered food providers</h2>
        {providersLoading ? <p>Loading providers...</p> : providers.length ? (
          <ul>
            {providers.map((provider) => {
              const providerSchools = allSchools.filter((entry) => (provider.schoolIds || []).includes(entry.id));
              return <li className="school-provider" key={provider.id}>
                <h3><Link href={`/providers/${provider.id}`}>{provider.name}</Link></h3>
                {providerSchools.length > 0 && <p>Registered schools: {providerSchools.map((entry, index) => <span key={entry.id}>{index > 0 ? ', ' : ''}<Link href={`/schools/${entry.id}`}>{entry.name}</Link></span>)}</p>}
                {provider.menu.length ? <MenuGrid items={provider.menu} showProvider /> : <p>No available menu items at this school.</p>}
              </li>;
            })}
          </ul>
        ) : <p>No providers are registered for this school yet.</p>}
      </section>}
    </main></>
  );
}
