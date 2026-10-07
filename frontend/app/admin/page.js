'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import AppHeader from '@/components/common/AppHeader';
import { api } from '@/services/api';
import '@/styles/pages/Admin.css';

const views = [
  { id: 'parents', label: 'Parents' },
  { id: 'providers', label: 'Providers' },
  { id: 'schoolAccounts', label: 'School admins' },
  { id: 'schools', label: 'Schools' },
];

const statusOf = (record) => record.status || 'active';

async function loadAdminData(token) {
  const [usersResult, providersResult, schoolsResult] = await Promise.all([
    api.getAdminUsers(token),
    api.getAdminProviders(token),
    api.getAdminSchools(token),
  ]);
  const users = usersResult.data || [];
  const providerAccounts = users.filter((user) => user.role === 'provider');
  const matchedAccountIds = new Set();
  const providers = (providersResult.data || []).map((provider) => {
    const account = providerAccounts.find((candidate) =>
      candidate.userId === provider.ownerUserId || candidate.providerId === provider.id || candidate.email === provider.email
    );
    if (account) matchedAccountIds.add(account.userId);
    return { ...provider, userId: account?.userId, status: account?.status || provider.status || 'active', hasProviderProfile: true };
  });
  providers.push(...providerAccounts.filter((account) => !matchedAccountIds.has(account.userId)).map((account) => ({
    ...account,
    id: account.providerId || account.userId,
    ownerName: account.name,
    status: account.status || 'active',
    hasProviderProfile: false,
  })));
  return {
    parents: users.filter((user) => user.role === 'customer'),
    providers,
    schoolAccounts: users.filter((user) => user.role === 'school'),
    schools: schoolsResult.data || [],
  };
}

export default function AdminPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [records, setRecords] = useState({ parents: [], providerAccounts: [], providers: [], schoolAccounts: [], schools: [] });
  const [activeView, setActiveView] = useState('parents');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setRecords(await loadAdminData(token));
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load account records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'superadmin') {
      setLoading(false);
      return;
    }
    let active = true;
    loadAdminData(token)
      .then((data) => { if (active) setRecords(data); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Could not load account records'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, token, user]);

  const setStatus = async (view, record, status) => {
    if (status === 'deleted' && !window.confirm(`Delete ${record.name || record.email || 'this record'}? It can be restored later.`)) return;
    const key = `${view}:${record.userId || record.id}`;
    setBusyKey(key);
    try {
      if (view === 'parents' || view === 'schoolAccounts') {
        await api.updateAdminUserStatus(record.userId, status, token);
      } else if (view === 'schools') {
        await api.updateAdminSchoolStatus(record.id, status, token);
      } else {
        const previousStatus = statusOf(record);
        if (record.hasProviderProfile) await api.updateAdminProviderStatus(record.id, status, token);
        try {
          if (record.userId) await api.updateAdminUserStatus(record.userId, status, token);
        } catch (accountError) {
          if (record.hasProviderProfile) await api.updateAdminProviderStatus(record.id, previousStatus, token).catch(() => {});
          throw accountError;
        }
      }
      setRecords(await loadAdminData(token));
      showNotification('Record status updated.', 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not update record status', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const currentRecords = records[activeView].filter((record) =>
    `${record.name || ''} ${record.ownerName || ''} ${record.email || ''} ${record.phone || ''} ${record.location || ''}`
      .toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <><AppHeader /><main className="container page-content admin-page">
      <header className="page-heading admin-heading">
        <p className="eyebrow">FoodConnect</p>
        <h1>Account management</h1>
      </header>
      {authLoading || loading ? <p>Loading records...</p> : user?.role !== 'superadmin' ? (
        <section className="admin-access-message">
          <p>Sign in with the super-admin account to manage records.</p>
          <Link href="/login" className="btn btn-primary btn-sm">Sign in</Link>
        </section>
      ) : error ? <p className="checkout-error" role="alert">{error}</p> : (
        <>
          <nav className="admin-tabs" role="tablist" aria-label="Account categories">
            {views.map((view) => <button key={view.id} type="button" role="tab" aria-selected={activeView === view.id} onClick={() => setActiveView(view.id)}>{view.label}<span>{records[view.id].length}</span></button>)}
          </nav>
          <label className="admin-search-label" htmlFor="admin-search">Search records</label>
          <input id="admin-search" className="admin-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, phone, or location" />
          <div className="admin-record-list" role="tabpanel">
            {currentRecords.map((record) => {
              const recordKey = `${activeView}:${record.userId || record.id}`;
              const status = statusOf(record);
              const details = activeView === 'schools'
                ? record.location
                : activeView === 'providers'
                  ? `${record.ownerName || 'Provider'}${record.location ? ` · ${record.location}` : ''}`
                  : `${record.role === 'customer' ? 'Parent account' : 'School administrator'}${record.phone ? ` · ${record.phone}` : ''}`;
              return <article className="admin-record" key={recordKey}>
                <div className="admin-record-identity"><strong>{record.name || record.email}</strong><small>{details || record.email || record.id}</small></div>
                <div className="admin-record-contact">{record.email && <span>{record.email}</span>}{activeView === 'providers' && record.phone && <span>{record.phone}</span>}</div>
                <span className={`admin-status admin-status-${status}`}>{status}</span>
                <div className="admin-record-actions">
                  {status !== 'active' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(activeView, record, 'active')} disabled={busyKey === recordKey}>Restore</button>}
                  {status === 'active' && <button type="button" className="btn btn-sm" onClick={() => setStatus(activeView, record, 'suspended')} disabled={busyKey === recordKey}>Suspend</button>}
                  {status !== 'deleted' && <button type="button" className="btn btn-sm admin-delete" onClick={() => setStatus(activeView, record, 'deleted')} disabled={busyKey === recordKey}>Delete</button>}
                </div>
              </article>;
            })}
            {!currentRecords.length && <p className="admin-empty">No matching records.</p>}
          </div>
          <button type="button" className="btn btn-sm admin-refresh" onClick={refresh} disabled={loading || Boolean(busyKey)}>Refresh records</button>
        </>
      )}
    </main></>
  );
}