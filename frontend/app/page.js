'use client';

import { useEffect, useState } from 'react';
import { api } from '../src/services/api';

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px', border: '1px solid #c9c5ba', background: '#fffdf8', fontSize: '14px' };
const formStyle = { display: 'grid', gap: '9px' };

function ActionForm({ children, onSubmit }) {
  return <form style={formStyle} onSubmit={onSubmit}>{children}</form>;
}

export default function HomePage() {
  const [providers, setProviders] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('p-001');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [registration, setRegistration] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [provider, setProvider] = useState({ name: '', ownerName: '', email: '' });
  const [menu, setMenu] = useState({ providerId: 'p-001', name: '', price: '' });
  const [order, setOrder] = useState({ customerId: 'u-001', providerId: 'p-001', menuId: 'm-101', quantity: 1, price: 22.5 });
  const [message, setMessage] = useState('');
  const [session, setSession] = useState(null);
  const [orders, setOrders] = useState([]);

  const refreshProviders = () => api.getProviders().then((result) => setProviders(result.data || []));

  useEffect(() => {
    refreshProviders().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const storedSession = window.localStorage.getItem('foodconnect-session');
    if (storedSession) setSession(JSON.parse(storedSession));
  }, []);

  useEffect(() => {
    if (!session?.user?.userId || !session.token) return;
    setOrder((current) => ({ ...current, customerId: session.user.userId }));
    api.getOrders(session.user.userId, session.token)
      .then((result) => setOrders(result.data || []))
      .catch((error) => setMessage(error.message));
  }, [session]);

  useEffect(() => {
    if (!selectedProviderId) return;
    api.getMenu(selectedProviderId)
      .then((result) => {
        const items = (result.data || []).filter((item) => item.available);
        setCatalog(items);
        if (items.length > 0) {
          setOrder((current) => ({ ...current, providerId: selectedProviderId, menuId: items[0].id, price: items[0].price }));
        }
      })
      .catch((error) => setMessage(error.message));
  }, [selectedProviderId]);

  const submit = async (action, successMessage) => {
    try {
      await action();
      setMessage(successMessage);
      await refreshProviders();
      if (session?.user?.userId && session.token) {
        const result = await api.getOrders(session.user.userId, session.token);
        setOrders(result.data || []);
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loginUser = async (event) => {
    event.preventDefault();
    try {
      const result = await api.login(login);
      setSession(result.data);
      window.localStorage.setItem('foodconnect-session', JSON.stringify(result.data));
      setMessage(`Welcome, ${result.data.user.name}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const registerUser = async (event) => {
    event.preventDefault();
    try {
      await api.register(registration);
      setLogin({ email: registration.email, password: registration.password });
      const result = await api.login({ email: registration.email, password: registration.password });
      setSession(result.data);
      window.localStorage.setItem('foodconnect-session', JSON.stringify(result.data));
      setMessage('Registration successful. You are now signed in.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const logout = () => {
    window.localStorage.removeItem('foodconnect-session');
    setSession(null);
    setOrders([]);
    setMessage('You have been signed out.');
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div><p style={styles.eyebrow}>Food ordering workspace</p><h1 style={styles.title}>FoodConnect</h1><p style={styles.subtitle}>Discover providers, publish menus, and place an order from one workspace.</p></div>
        <div style={styles.headerActions}>{session ? <><span style={styles.status}>{session.user.name}</span><button type="button" onClick={logout}>Logout</button></> : <span style={styles.status}>Sprint 2 live</span>}</div>
      </header>
      {message && <p role="status" style={styles.message}>{message}</p>}
      <section style={styles.grid}>
        <article style={styles.panel}>
          <h2>Sign in</h2>
          <ActionForm onSubmit={loginUser}>
            <input style={inputStyle} aria-label="Email" placeholder="Email" type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required />
            <input style={inputStyle} aria-label="Password" placeholder="Password" type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required />
            <button type="submit">Login</button>
          </ActionForm>
          <h2 style={styles.subheading}>Create account</h2>
          <ActionForm onSubmit={registerUser}>
            <input style={inputStyle} aria-label="Registration name" placeholder="Name" value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} required />
            <input style={inputStyle} aria-label="Registration email" placeholder="Email" type="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} required />
            <input style={inputStyle} aria-label="Registration password" placeholder="Password" type="password" minLength="6" value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} required />
            <select style={inputStyle} aria-label="Account role" value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}><option value="customer">Customer</option><option value="provider">Provider</option></select>
            <button type="submit">Register</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Providers</h2>
          <div style={styles.providerList}>{providers.map((item) => <div key={item.id} style={styles.provider}><strong>{item.name}</strong><span>{item.status}</span></div>)}{providers.length === 0 && <p>No providers available.</p>}</div>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.registerProvider(provider, session?.token), 'Provider registered.'); }}>
            <input style={inputStyle} aria-label="Provider name" placeholder="Provider name" value={provider.name} onChange={(event) => setProvider({ ...provider, name: event.target.value })} required />
            <input style={inputStyle} aria-label="Owner name" placeholder="Owner name" value={provider.ownerName} onChange={(event) => setProvider({ ...provider, ownerName: event.target.value })} required />
            <input style={inputStyle} aria-label="Provider email" placeholder="Email" type="email" value={provider.email} onChange={(event) => setProvider({ ...provider, email: event.target.value })} required />
            <button type="submit">Register provider</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Publish menu item</h2>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.createMenuItem(menu.providerId, { name: menu.name, price: Number(menu.price) }, session?.token), 'Menu item created.'); }}>
            <input style={inputStyle} aria-label="Provider ID" placeholder="Provider ID" value={menu.providerId} onChange={(event) => setMenu({ ...menu, providerId: event.target.value })} required />
            <input style={inputStyle} aria-label="Menu item name" placeholder="Item name" value={menu.name} onChange={(event) => setMenu({ ...menu, name: event.target.value })} required />
            <input style={inputStyle} aria-label="Menu item price" placeholder="Price" type="number" min="0" step="0.01" value={menu.price} onChange={(event) => setMenu({ ...menu, price: event.target.value })} required />
            <button type="submit">Create menu item</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Place order</h2>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.createOrder({ customerId: session.user.userId, providerId: order.providerId, items: [{ menuId: order.menuId, quantity: Number(order.quantity), price: Number(order.price) }], deliveryType: 'collection' }, session?.token), 'Order created.'); }}>
            <input style={inputStyle} aria-label="Customer ID" placeholder="Sign in to order" value={session?.user?.userId || ''} readOnly required />
            <select style={inputStyle} aria-label="Order provider" value={selectedProviderId} onChange={(event) => { setSelectedProviderId(event.target.value); setOrder({ ...order, providerId: event.target.value, menuId: '' }); }} required>{providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select style={inputStyle} aria-label="Menu item" value={order.menuId} onChange={(event) => { const item = catalog.find((entry) => entry.id === event.target.value); setOrder({ ...order, menuId: item.id, price: item.price }); }} required>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name} - ${item.price.toFixed(2)}</option>)}</select>
            <input style={inputStyle} aria-label="Quantity" type="number" min="1" value={order.quantity} onChange={(event) => setOrder({ ...order, quantity: event.target.value })} required />
            {catalog.length === 0 && <p style={styles.helper}>This provider has no available menu items yet.</p>}
            <button type="submit" disabled={!session || session.user.role !== 'customer' || catalog.length === 0}>Create order</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Order history</h2>
          {!session && <p style={styles.helper}>Sign in to view your orders.</p>}
          {session && orders.length === 0 && <p style={styles.helper}>No orders yet.</p>}
          {orders.map((item) => <div key={item.id} style={styles.order}><strong>{item.id}</strong><span>{item.status}</span><b>${Number(item.total).toFixed(2)}</b></div>)}
        </article>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '48px max(24px, 7vw)', background: '#f4f1ea', color: '#1d2925', fontFamily: 'Georgia, serif' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'end', maxWidth: '1100px', margin: '0 auto 32px' },
  headerActions: { display: 'flex', gap: '10px', alignItems: 'center' },
  eyebrow: { margin: 0, color: '#b04a2b', textTransform: 'uppercase', letterSpacing: '2px', font: '600 12px Arial, sans-serif' },
  title: { margin: '8px 0', fontSize: 'clamp(42px, 7vw, 78px)', lineHeight: 0.95, fontWeight: 500 },
  subtitle: { margin: 0, maxWidth: '520px', font: '17px/1.5 Arial, sans-serif', color: '#52605a' },
  status: { padding: '9px 12px', border: '1px solid #b8c5b7', color: '#46634f', font: '600 12px Arial, sans-serif', textTransform: 'uppercase' },
  message: { maxWidth: '1100px', margin: '0 auto 20px', padding: '12px 16px', background: '#e6eee4', font: '14px Arial, sans-serif' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', maxWidth: '1100px', margin: '0 auto' },
  panel: { padding: '22px', background: '#fffdf8', border: '1px solid #d9d5cb', boxShadow: '5px 5px 0 #d9d5cb' },
  subheading: { marginTop: '26px' },
  providerList: { marginBottom: '18px', font: '14px Arial, sans-serif' },
  provider: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #e7e2d8' },
  helper: { color: '#6d746f', font: '13px/1.4 Arial, sans-serif' },
  order: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', padding: '12px 0', borderBottom: '1px solid #e7e2d8', font: '14px Arial, sans-serif' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }
};
