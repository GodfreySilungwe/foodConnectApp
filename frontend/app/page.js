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
  const [login, setLogin] = useState({ email: '', password: '' });
  const [provider, setProvider] = useState({ name: '', ownerName: '', email: '' });
  const [menu, setMenu] = useState({ providerId: 'p-001', name: '', price: '' });
  const [order, setOrder] = useState({ customerId: 'u-001', providerId: 'p-001', menuId: 'm-101', quantity: 1, price: 22.5 });
  const [message, setMessage] = useState('');

  const refreshProviders = () => api.getProviders().then((result) => setProviders(result.data || []));

  useEffect(() => {
    refreshProviders().catch((error) => setMessage(error.message));
  }, []);

  const submit = async (action, successMessage) => {
    try {
      await action();
      setMessage(successMessage);
      await refreshProviders();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div><p style={styles.eyebrow}>Food ordering workspace</p><h1 style={styles.title}>FoodConnect</h1><p style={styles.subtitle}>Discover providers, publish menus, and place an order from one workspace.</p></div>
        <span style={styles.status}>Sprint 2 live</span>
      </header>
      {message && <p role="status" style={styles.message}>{message}</p>}
      <section style={styles.grid}>
        <article style={styles.panel}>
          <h2>Sign in</h2>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.login(login), 'Login successful.'); }}>
            <input style={inputStyle} aria-label="Email" placeholder="Email" type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required />
            <input style={inputStyle} aria-label="Password" placeholder="Password" type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required />
            <button type="submit">Login</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Providers</h2>
          <div style={styles.providerList}>{providers.map((item) => <div key={item.id} style={styles.provider}><strong>{item.name}</strong><span>{item.status}</span></div>)}{providers.length === 0 && <p>No providers available.</p>}</div>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.registerProvider(provider), 'Provider registered.'); }}>
            <input style={inputStyle} aria-label="Provider name" placeholder="Provider name" value={provider.name} onChange={(event) => setProvider({ ...provider, name: event.target.value })} required />
            <input style={inputStyle} aria-label="Owner name" placeholder="Owner name" value={provider.ownerName} onChange={(event) => setProvider({ ...provider, ownerName: event.target.value })} required />
            <input style={inputStyle} aria-label="Provider email" placeholder="Email" type="email" value={provider.email} onChange={(event) => setProvider({ ...provider, email: event.target.value })} required />
            <button type="submit">Register provider</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Publish menu item</h2>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.createMenuItem(menu.providerId, { name: menu.name, price: Number(menu.price) }), 'Menu item created.'); }}>
            <input style={inputStyle} aria-label="Provider ID" placeholder="Provider ID" value={menu.providerId} onChange={(event) => setMenu({ ...menu, providerId: event.target.value })} required />
            <input style={inputStyle} aria-label="Menu item name" placeholder="Item name" value={menu.name} onChange={(event) => setMenu({ ...menu, name: event.target.value })} required />
            <input style={inputStyle} aria-label="Menu item price" placeholder="Price" type="number" min="0" step="0.01" value={menu.price} onChange={(event) => setMenu({ ...menu, price: event.target.value })} required />
            <button type="submit">Create menu item</button>
          </ActionForm>
        </article>
        <article style={styles.panel}>
          <h2>Place order</h2>
          <ActionForm onSubmit={(event) => { event.preventDefault(); submit(() => api.createOrder({ customerId: order.customerId, providerId: order.providerId, items: [{ menuId: order.menuId, quantity: Number(order.quantity), price: Number(order.price) }], deliveryType: 'collection' }), 'Order created.'); }}>
            <input style={inputStyle} aria-label="Customer ID" placeholder="Customer ID" value={order.customerId} onChange={(event) => setOrder({ ...order, customerId: event.target.value })} required />
            <input style={inputStyle} aria-label="Order provider ID" placeholder="Provider ID" value={order.providerId} onChange={(event) => setOrder({ ...order, providerId: event.target.value })} required />
            <input style={inputStyle} aria-label="Menu ID" placeholder="Menu ID" value={order.menuId} onChange={(event) => setOrder({ ...order, menuId: event.target.value })} required />
            <div style={styles.row}><input style={inputStyle} aria-label="Quantity" type="number" min="1" value={order.quantity} onChange={(event) => setOrder({ ...order, quantity: event.target.value })} required /><input style={inputStyle} aria-label="Order price" type="number" min="0" step="0.01" value={order.price} onChange={(event) => setOrder({ ...order, price: event.target.value })} required /></div>
            <button type="submit">Create order</button>
          </ActionForm>
        </article>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '48px max(24px, 7vw)', background: '#f4f1ea', color: '#1d2925', fontFamily: 'Georgia, serif' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'end', maxWidth: '1100px', margin: '0 auto 32px' },
  eyebrow: { margin: 0, color: '#b04a2b', textTransform: 'uppercase', letterSpacing: '2px', font: '600 12px Arial, sans-serif' },
  title: { margin: '8px 0', fontSize: 'clamp(42px, 7vw, 78px)', lineHeight: 0.95, fontWeight: 500 },
  subtitle: { margin: 0, maxWidth: '520px', font: '17px/1.5 Arial, sans-serif', color: '#52605a' },
  status: { padding: '9px 12px', border: '1px solid #b8c5b7', color: '#46634f', font: '600 12px Arial, sans-serif', textTransform: 'uppercase' },
  message: { maxWidth: '1100px', margin: '0 auto 20px', padding: '12px 16px', background: '#e6eee4', font: '14px Arial, sans-serif' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', maxWidth: '1100px', margin: '0 auto' },
  panel: { padding: '22px', background: '#fffdf8', border: '1px solid #d9d5cb', boxShadow: '5px 5px 0 #d9d5cb' },
  providerList: { marginBottom: '18px', font: '14px Arial, sans-serif' },
  provider: { display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #e7e2d8' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }
};
