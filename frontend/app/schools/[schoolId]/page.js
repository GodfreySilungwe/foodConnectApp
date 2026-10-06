'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import MenuGrid from '@/components/menu/MenuGrid';
import SearchField from '@/components/common/SearchField';
import { matchesSearch } from '@/utils/search';
import { compressImage } from '@/utils/images';
import LocationPicker from '@/components/common/LocationPicker';
import '@/styles/components/ProfileImageUpload.css';

export default function SchoolDetailsPage() {
  const { schoolId } = useParams();
  const { user, token } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [school, setSchool] = useState(null);
  const [providers, setProviders] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState('');
  const [query, setQuery] = useState('');
  const [schoolImage, setSchoolImage] = useState('');
  const [schoolLocation, setSchoolLocation] = useState('');
  const [coordinates, setCoordinates] = useState({ latitude: null, longitude: null });
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    setProvidersLoading(true);
    Promise.all([api.getSchool(schoolId), api.getSchoolProviders(schoolId), api.getSchools()])
      .then(async ([schoolResult, providerResult, schoolsResult]) => {
        if (!active) return;
        setSchool(schoolResult.data);
        setSchoolImage(schoolResult.data.image || '');
        setSchoolLocation(schoolResult.data.location || '');
        setCoordinates({
          latitude: schoolResult.data.latitude ?? null,
          longitude: schoolResult.data.longitude ?? null,
        });
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

  const selectSchoolImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setSchoolImage(await compressImage(file, 150000));
    } catch (imageError) {
      showNotification(imageError.message || 'Could not process school image', 'error');
    }
  };

  const saveSchoolImage = async (event) => {
    event.preventDefault();
    if (!schoolLocation.trim() || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
      showNotification('Enter a school location and select its map pin.', 'warning');
      return;
    }
    setSavingImage(true);
    try {
      const result = await api.updateSchool(schoolId, {
        image: schoolImage || null,
        location: schoolLocation,
        ...coordinates,
      }, token);
      setSchool(result.data);
      showNotification('School image updated.', 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not update school image', 'error');
    } finally {
      setSavingImage(false);
    }
  };

  const visibleProviders = providers.map((provider) => {
    const providerSchools = allSchools.filter((entry) => (provider.schoolIds || []).includes(entry.id));
    const providerMatches = matchesSearch(query, provider.name, provider.description, providerSchools.map((entry) => entry.name).join(' '));
    const menu = provider.menu || [];
    const matchedMenu = menu.filter((item) => matchesSearch(query, item.name, item.description));
    return { ...provider, providerSchools, visibleMenu: providerMatches ? menu : matchedMenu, providerMatches };
  }).filter((provider) => provider.providerMatches || provider.visibleMenu.length > 0);

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      {providersError && <p role="alert">{providersError}</p>}
      {school && <div className="page-heading"><p className="eyebrow">Community partner</p><h1>{school.name}</h1><p>{school.location} · {school.studentCount} students</p>{school.image && <img className="school-profile-image" src={school.image} alt={`${school.name} campus`} />}</div>}
      {school && (user?.role === 'admin' || school.registeredBy === user?.userId) && <form className="school-image-editor" onSubmit={saveSchoolImage}>
        <label htmlFor="school-edit-location">School location</label>
        <input id="school-edit-location" value={schoolLocation} onChange={(event) => setSchoolLocation(event.target.value)} required maxLength={160} placeholder="Town, district, or address" disabled={savingImage} />
        <LocationPicker value={coordinates} onChange={setCoordinates} label="Update school map pin" />
        <label htmlFor="school-card-image">School card image</label>
        <input id="school-card-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectSchoolImage} disabled={savingImage} />
        {schoolImage && <img src={schoolImage} alt="School image preview" />}
        <button className="btn btn-sm" type="submit" disabled={savingImage}>{savingImage ? 'Saving...' : 'Save school location and image'}</button>
      </form>}
      {school && <section>
        <h2>Registered food providers</h2>
        <SearchField value={query} onChange={setQuery} placeholder="Search this school, providers, or dishes" label="Search school providers and menus" />
        {providersLoading ? <p>Loading providers...</p> : visibleProviders.length ? (
          <ul>
            {visibleProviders.map((provider) => {
              return <li className="school-provider" key={provider.id}>
                <h3><Link href={`/providers/${provider.id}`}>{provider.name}</Link></h3>
                {provider.providerSchools.length > 0 && <p>Registered schools: {provider.providerSchools.map((entry, index) => <span key={entry.id}>{index > 0 ? ', ' : ''}<Link href={`/schools/${entry.id}`}>{entry.name}</Link></span>)}</p>}
                {provider.visibleMenu.length ? <MenuGrid items={provider.visibleMenu} showProvider /> : <p>No available menu items at this school.</p>}
              </li>;
            })}
          </ul>
        ) : <p>No providers or dishes match your search.</p>}
      </section>}
    </main></>
  );
}
