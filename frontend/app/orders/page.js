'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import '@/styles/pages/Orders.css';

const nextStatuses = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
};

export default function ProviderOrdersPage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role !== 'provider') {
      setLoading(false);
      return;
    }

    let active = true;
    Promise.all([api.getOrders(token), api.getMyMenu(token)])
      .then(([ordersResult, menuResult]) => {
        if (!active) return;
        setOrders(ordersResult.data || []);
        setMenuItems(menuResult.data || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load provider orders');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [authLoading, user, token]);

  const updateStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    try {
      const result = await api.updateOrderStatus(orderId, status, token);
      setOrders((current) => current.map((order) => order.id === orderId ? result.data : order));
      showNotification(`Order ${status}.`, 'success');
    } catch (requestError) {
      showNotification(requestError.message || 'Could not update order', 'error');
    } finally {
      setUpdatingOrderId('');
    }
  };

  const validOrders = orders.filter((order) => order.status !== 'cancelled');
  const grossSales = validOrders.reduce((total, order) => total + Number(order.total || 0), 0);
  const openOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length;
  const completedOrders = orders.filter((order) => order.status === 'completed').length;
  const completionRate = orders.length ? Math.round((completedOrders / orders.length) * 100) : 0;
  const topDishes = orders.reduce((totals, order) => {
    for (const item of order.items || []) {
      const name = item.name || item.menuId || 'Menu item';
      totals.set(name, (totals.get(name) || 0) + Number(item.quantity || 0));
    }
    return totals;
  }, new Map());
  const bestSellers = [...topDishes.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3);

  return (
    <><AppHeader /><main className="container page-content orders-page">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">Provider workspace</p><h1>Incoming orders</h1><p>Review and update orders placed with your provider account.</p></div>
      {authLoading || loading ? <p>Loading orders...</p> : user?.role !== 'provider' ? (
        <p>Sign in with a provider account to view incoming orders.</p>
      ) : error ? <p role="alert">{error}</p> : (
        <>
        <section className="provider-order-metrics" aria-label="Order performance">
          <article><span>Gross sales</span><strong>${grossSales.toFixed(2)}</strong></article>
          <article><span>Orders</span><strong>{orders.length}</strong></article>
          <article><span>Average order</span><strong>${(grossSales / Math.max(validOrders.length, 1)).toFixed(2)}</strong></article>
          <article><span>Open orders</span><strong>{openOrders}</strong></article>
          <article><span>Completion rate</span><strong>{completionRate}%</strong></article>
          <article><span>Available menu items</span><strong>{menuItems.filter((item) => item.available !== false).length} / {menuItems.length}</strong></article>
        </section>
        {bestSellers.length > 0 && <section className="provider-top-dishes">
          <h2>Top ordered dishes</h2>
          <ol>{bestSellers.map(([name, quantity]) => <li key={name}><span>{name}</span><strong>{quantity} ordered</strong></li>)}</ol>
        </section>}
        {orders.length ? <div className="provider-orders">
          {orders.map((order) => (
            <article className="provider-order" key={order.id}>
              <header className="provider-order-header">
                <h2>Order {order.id}</h2>
                <span className={`provider-order-status status-${order.status}`}>{order.status}</span>
              </header>
              <dl className="provider-order-details">
                <div><dt>Student</dt><dd>{order.studentName || 'Details unavailable'}{order.studentClass ? ` · ${order.studentClass}` : ''}</dd></div>
                <div><dt>School</dt><dd>{order.schoolName || order.schoolId || 'Not specified'}</dd></div>
                <div><dt>Items</dt><dd>{order.items?.length ? order.items.map((item) => `${item.quantity} × ${item.name || item.menuId}`).join(', ') : 'Order details unavailable'}</dd></div>
                <div><dt>Total</dt><dd>${Number(order.total || 0).toFixed(2)}</dd></div>
                <div><dt>Delivery</dt><dd>{order.deliveryType || 'collection'}</dd></div>
                {order.foodPreferences && <div><dt>Preferences</dt><dd>{order.foodPreferences}</dd></div>}
              </dl>
              {nextStatuses[order.status]?.length > 0 && <div className="provider-order-actions">
                {nextStatuses[order.status].map((status) => (
                  <button key={status} type="button" className={status === 'cancelled' ? 'btn btn-sm' : 'btn btn-primary btn-sm'} onClick={() => updateStatus(order.id, status)} disabled={updatingOrderId === order.id}>
                    {updatingOrderId === order.id ? 'Updating...' : status[0].toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>}
            </article>
          ))}
        </div> : <p>No incoming orders yet.</p>}
        </>
      )}
    </main></>
  );
}