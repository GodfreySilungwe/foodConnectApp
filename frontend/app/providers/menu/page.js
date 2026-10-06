'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import MenuGrid from '@/components/menu/MenuGrid';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { compressImage } from '@/utils/images';
import { matchesSearch } from '@/utils/search';
import '@/styles/pages/ProviderMenu.css';

const MAX_IMAGES = 4;
const MAX_IMAGE_LENGTH = 60000;

export default function ProviderMenuPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editingItemId, setEditingItemId] = useState('');
  const [draft, setDraft] = useState({ name: '', description: '', price: '', images: [], available: true });

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'provider') {
      setLoading(false);
      return;
    }

    let active = true;
    api.getMyMenu(token)
      .then((result) => {
        if (active) setItems(result.data || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load your menu');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [authLoading, user, token]);

  const selectImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (draft.images.length + files.length > MAX_IMAGES) {
      showNotification('A menu item can have up to four images.', 'warning');
      return;
    }

    try {
      const compressedImages = await Promise.all(files.map((file) => compressImage(file, MAX_IMAGE_LENGTH)));
      const allImages = [...draft.images, ...compressedImages];
      if (allImages.reduce((total, image) => total + image.length, 0) > 240000) {
        throw new Error('The selected images exceed the total upload limit. Choose smaller images.');
      }
      setDraft((current) => ({ ...current, images: [...current.images, ...compressedImages] }));
    } catch (imageError) {
      showNotification(imageError.message || 'Could not process selected images', 'error');
    }
  };

  const saveMenuItem = async (event) => {
    event.preventDefault();
    if (!user?.providerId) {
      showNotification('Your provider account is not linked to a provider profile.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const menuData = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price: Number(draft.price),
        available: draft.available,
        images: draft.images,
      };
      const result = editingItemId
        ? await api.updateMenuItem(user.providerId, editingItemId, menuData, token)
        : await api.createMenuItem(user.providerId, menuData, token);
      setItems((current) => editingItemId
        ? current.map((item) => item.id === editingItemId ? result.data : item)
        : [result.data, ...current]);
      setEditingItemId('');
      setDraft({ name: '', description: '', price: '', images: [], available: true });
      showNotification(editingItemId ? 'Menu item updated.' : 'Menu item created.', 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not create menu item', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const editMenuItem = (item) => {
    setEditingItemId(item.id);
    setDraft({
      name: item.name || '',
      description: item.description || '',
      price: String(item.price ?? ''),
      images: item.images?.length ? item.images : item.image ? [item.image] : [],
      available: item.available !== false,
    });
    document.getElementById('provider-menu-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingItemId('');
    setDraft({ name: '', description: '', price: '', images: [], available: true });
  };

  const filteredItems = items.filter((item) => matchesSearch(
    query,
    item.name,
    item.description,
    item.availableSchools?.map((school) => school.name).join(' ')
  ));

  const updateAvailability = async (item, available) => {
    try {
      const result = await api.updateMenuAvailability(user.providerId, item.id, available, token);
      setItems((current) => current.map((entry) => entry.id === item.id ? result.data : entry));
      showNotification(`Menu item ${available ? 'available' : 'unavailable'}.`, 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not update menu availability', 'error');
    }
  };

  return (
    <><AppHeader /><main className="container page-content">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Provider workspace</p><h1>My menu</h1></div>
      {authLoading || loading ? <p>Loading your menu...</p> : user?.role !== 'provider' ? (
        <p>Sign in with a provider account to view its menu.</p>
      ) : <>
        <section className="provider-menu-editor">
          <h2>{editingItemId ? 'Edit menu item' : 'Add menu item'}</h2>
          <form id="provider-menu-editor" className="provider-menu-form" onSubmit={saveMenuItem}>
            <label className="provider-menu-field">Dish name
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={120} disabled={submitting} />
            </label>
            <label className="provider-menu-field">Description
              <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} rows={3} disabled={submitting} />
            </label>
            <label className="provider-menu-field">Price (MWK)
              <input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} required disabled={submitting} />
            </label>
            <label className="provider-menu-field">Dish photos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages} disabled={submitting || draft.images.length >= MAX_IMAGES} />
              <small>{draft.images.length} of {MAX_IMAGES} photos selected</small>
            </label>
            {draft.images.length > 0 && <div className="provider-menu-previews">
              {draft.images.map((image, index) => <div className="provider-menu-preview" key={`${index}-${image.slice(-16)}`}>
                <img src={image} alt={`Menu item preview ${index + 1}`} />
                <button type="button" onClick={() => setDraft((current) => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))} aria-label={`Remove photo ${index + 1}`} disabled={submitting}>Remove</button>
              </div>)}
            </div>}
            <label className="provider-menu-availability"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} disabled={submitting} />Available to order</label>
            {editingItemId && <button className="btn" type="button" onClick={cancelEdit} disabled={submitting}>Cancel edit</button>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving item...' : editingItemId ? 'Save menu item' : 'Add menu item'}</button>
          </form>
        </section>
        <section className="provider-menu-list">
          <h2>Current menu <span>{items.length}</span></h2>
          <SearchField value={query} onChange={setQuery} placeholder="Search your menu items" label="Search your menu" />
          {error ? <p role="alert">{error}</p> : filteredItems.length ? <MenuGrid items={filteredItems} providerControls onAvailabilityChange={updateAvailability} onEditItem={editMenuItem} /> : <p>{items.length ? 'No menu items match your search.' : 'Your menu is empty.'}</p>}
        </section>
      </>}
    </main></>
  );
}