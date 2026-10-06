'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { formatMWK } from '@/utils/formatCurrency';
import { matchesSearch } from '@/utils/search';
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
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!['provider', 'customer'].includes(user?.role)) {
      setLoading(false);
      return;
    }

    let active = true;
    const requests = user.role === 'provider'
      ? Promise.all([api.getOrders(token), api.getMyMenu(token)])
      : api.getOrders(token).then((ordersResult) => [ordersResult, { data: [] }]);
    requests.then(([ordersResult, menuResult]) => {
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
  const isProvider = user?.role === 'provider';
  const visibleOrders = orders.filter((order) => matchesSearch(
    query,
    order.id,
    order.status,
    order.studentName,
    order.schoolName,
    order.items?.map((item) => item.name || item.menuId).join(' ')
  ));

  return (
    <><AppHeader /><main className="container page-content orders-page">
      <Link href="/" className="page-back">Back to home</Link>
      <div className="page-heading"><p className="eyebrow">{isProvider ? 'Provider workspace' : 'Parent workspace'}</p><h1>{isProvider ? 'Incoming orders' : 'My orders'}</h1><p>{isProvider ? 'Review and update orders placed with your provider account.' : 'Track the status of orders for your students.'}</p></div>
      {authLoading || loading ? <p>Loading orders...</p> : user?.role !== 'provider' ? (
        !['customer', 'provider'].includes(user?.role) ? <p>Sign in with a parent or provider account to view orders.</p> : error ? <p role="alert">{error}</p> : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder="Search orders, schools, or status" label="Search orders" />
            {visibleOrders.length ? <div className="provider-orders">
              {visibleOrders.map((order) => (
                <article className="provider-order" key={order.id}>
                  <header className="provider-order-header">
                    <h2>Order {order.id}</h2>
                    <span className={`provider-order-status status-${order.status}`}>{order.status}</span>
                  </header>
                  <dl className="provider-order-details">
                    <div><dt>Student</dt><dd>{order.studentName || 'Details unavailable'}{order.studentClass ? ` · ${order.studentClass}` : ''}</dd></div>
                    <div><dt>School</dt><dd>{order.schoolName || order.schoolId || 'Not specified'}</dd></div>
                    <div><dt>Items</dt><dd>{order.items?.length ? order.items.map((item) => `${item.quantity} × ${item.name || item.menuId}`).join(', ') : 'Order details unavailable'}</dd></div>
                    <div><dt>Total</dt><dd>{formatMWK(order.total)}</dd></div>
                    <div><dt>Delivery</dt><dd>{order.deliveryType || 'collection'}</dd></div>
                    {order.foodPreferences && <div><dt>Preferences</dt><dd>{order.foodPreferences}</dd></div>}
                  </dl>
                  {isProvider && nextStatuses[order.status]?.length > 0 && <div className="provider-order-actions">
                    {nextStatuses[order.status].map((status) => (
                      <button key={status} type="button" className={status === 'cancelled' ? 'btn btn-sm' : 'btn btn-primary btn-sm'} onClick={() => updateStatus(order.id, status)} disabled={updatingOrderId === order.id}>
                        {updatingOrderId === order.id ? 'Updating...' : status[0].toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>}
                </article>
              ))}
            </div> : <p>{orders.length ? 'No orders match your search.' : 'No orders yet.'}</p>}
          </>
        )
      ) : error ? <p role="alert">{error}</p> : (
        <>
        <SearchField value={query} onChange={setQuery} placeholder="Search orders, schools, or status" label="Search orders" />
        <section className="provider-order-metrics" aria-label="Order performance">
          <article><span>Gross sales</span><strong>{formatMWK(grossSales)}</strong></article>
          <article><span>Orders</span><strong>{orders.length}</strong></article>
          <article><span>Average order</span><strong>{formatMWK(grossSales / Math.max(validOrders.length, 1))}</strong></article>
          <article><span>Open orders</span><strong>{openOrders}</strong></article>
          <article><span>Completion rate</span><strong>{completionRate}%</strong></article>
          <article><span>Available menu items</span><strong>{menuItems.filter((item) => item.available !== false).length} / {menuItems.length}</strong></article>
        </section>
        {bestSellers.length > 0 && <section className="provider-top-dishes">
          <h2>Top ordered dishes</h2>
          <ol>{bestSellers.map(([name, quantity]) => <li key={name}><span>{name}</span><strong>{quantity} ordered</strong></li>)}</ol>
        </section>}
        {visibleOrders.length ? <div className="provider-orders">
          {visibleOrders.map((order) => (
            <article className="provider-order" key={order.id}>
              <header className="provider-order-header">
                <h2>Order {order.id}</h2>
                <span className={`provider-order-status status-${order.status}`}>{order.status}</span>
              </header>
              <dl className="provider-order-details">
                <div><dt>Student</dt><dd>{order.studentName || 'Details unavailable'}{order.studentClass ? ` · ${order.studentClass}` : ''}</dd></div>
                <div><dt>School</dt><dd>{order.schoolName || order.schoolId || 'Not specified'}</dd></div>
                <div><dt>Items</dt><dd>{order.items?.length ? order.items.map((item) => `${item.quantity} × ${item.name || item.menuId}`).join(', ') : 'Order details unavailable'}</dd></div>
                <div><dt>Total</dt><dd>{formatMWK(order.total)}</dd></div>
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
        </div> : <p>{orders.length ? 'No orders match your search.' : 'No incoming orders yet.'}</p>}
        </>
      )}
    </main></>
  );
}