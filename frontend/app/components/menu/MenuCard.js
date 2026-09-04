'use client';

import { useState, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import Link from 'next/link';
import '@/styles/components/MenuCard.css';

export default function MenuCard({ item, showProvider = false }) {
  const { user, token } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [quantity, setQuantity] = useState(1);
  const [isOrdering, setIsOrdering] = useState(false);

  const handleOrder = async () => {
    if (!user) {
      showNotification('Please sign in to place an order', 'warning');
      return;
    }

    if (user.role === 'provider') {
      showNotification('Providers cannot place orders', 'error');
      return;
    }

    setIsOrdering(true);
    try {
      const orderData = {
        providerId: item.providerId,
        items: [
          {
            menuId: item.id,
            quantity: quantity,
            price: item.price,
          },
        ],
        deliveryType: 'collection',
        scheduledFor: null,
      };

      const result = await api.createOrder(orderData, token);
      showNotification('Order placed successfully!', 'success');
      setQuantity(1);
    } catch (error) {
      showNotification(error.message || 'Failed to place order', 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="menu-card">
      <div className="menu-card-image">
        {item.image ? (
          <img src={item.image} alt={item.name} />
        ) : (
          <div className="menu-card-image-placeholder">🍲</div>
        )}
        {item.available === false && (
          <span className="menu-card-unavailable">Unavailable</span>
        )}
      </div>
      <div className="menu-card-body">
        <div className="menu-card-header">
          <h3 className="menu-card-name">{item.name}</h3>
          <span className="menu-card-price">${item.price.toFixed(2)}</span>
        </div>
        {showProvider && item.providerName && (
          <Link
            href={`/providers/${item.providerId}`}
            className="menu-card-provider"
          >
            🏪 {item.providerName}
          </Link>
        )}
        {item.description && (
          <p className="menu-card-description">{item.description}</p>
        )}
        <div className="menu-card-actions">
          <div className="menu-card-quantity">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              −
            </button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleOrder}
            disabled={isOrdering || item.available === false}
          >
            {isOrdering ? 'Ordering...' : 'Book Now'}
          </button>
        </div>
      </div>
    </div>
  );
}