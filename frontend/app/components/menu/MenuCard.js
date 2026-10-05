'use client';

import { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
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
  const [showCheckout, setShowCheckout] = useState(false);
  const [schools, setSchools] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [foodPreferences, setFoodPreferences] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolError, setSchoolError] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  const openCheckout = async () => {
    if (!user) {
      showNotification('Please sign in to place an order', 'warning');
      return;
    }

    if (user.role !== 'customer') {
      showNotification('Only parent accounts can place orders', 'error');
      return;
    }

    setShowCheckout(true);
    if (isLoadingSchools) return;
    setIsLoadingSchools(true);
    setSchoolError('');
    try {
      const [schoolResult, providerResult] = await Promise.all([
        api.getSchools(),
        api.getProvider(item.providerId),
      ]);
      const supportedSchoolIds = providerResult.data?.schoolIds || [];
      const supportedSchools = (schoolResult.data || []).filter((school) => supportedSchoolIds.includes(school.id));
      setSchools(supportedSchools);
      setSchoolId(supportedSchools[0]?.id || '');
      if (!supportedSchools.length) setSchoolError('This provider has not registered any schools for delivery yet.');
    } catch (error) {
      setSchoolError(error.message || 'Could not load registered schools');
    } finally {
      setIsLoadingSchools(false);
    }
  };

  const handleOrder = async (event) => {
    event.preventDefault();
    setIsOrdering(true);
    try {
      const school = schools.find((entry) => entry.id === schoolId);
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
        studentName,
        studentClass,
        schoolId,
        schoolName: school?.name,
        foodPreferences,
      };

      await api.createOrder(orderData, token);
      showNotification('Order placed successfully!', 'success');
      setQuantity(1);
      setStudentName('');
      setStudentClass('');
      setFoodPreferences('');
      setShowCheckout(false);
    } catch (error) {
      showNotification(error.message || 'Failed to place order', 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <>
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
            onClick={openCheckout}
            disabled={isOrdering || item.available === false}
          >
            Order for student
          </button>
        </div>
      </div>
    </div>
    {showCheckout && createPortal(
        <div className="checkout-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowCheckout(false)}>
          <form className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby={`checkout-title-${item.id}`} onSubmit={handleOrder}>
            <h2 id={`checkout-title-${item.id}`}>Student order details</h2>
            <p>{item.name} · {quantity} {quantity === 1 ? 'meal' : 'meals'}</p>
            <label className="checkout-field" htmlFor={`student-name-${item.id}`}>Student name
              <input id={`student-name-${item.id}`} value={studentName} onChange={(event) => setStudentName(event.target.value)} required maxLength={100} autoFocus />
            </label>
            <label className="checkout-field" htmlFor={`student-class-${item.id}`}>Student class
              <input id={`student-class-${item.id}`} value={studentClass} onChange={(event) => setStudentClass(event.target.value)} placeholder="For example, Year 4" required maxLength={60} />
            </label>
            <label className="checkout-field" htmlFor={`school-${item.id}`}>School
              <select id={`school-${item.id}`} value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required disabled={!schools.length}>
                {isLoadingSchools ? <option value="">Loading provider schools...</option> : schools.length ? schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>) : <option value="">No served schools available</option>}
              </select>
            </label>
            <label className="checkout-field" htmlFor={`food-preferences-${item.id}`}>Food preferences or allergies
              <textarea id={`food-preferences-${item.id}`} value={foodPreferences} onChange={(event) => setFoodPreferences(event.target.value)} placeholder="Allergies, ingredients to avoid, or preparation requests" maxLength={500} rows={3} />
            </label>
            {schoolError && <p className="checkout-error" role="alert">{schoolError}</p>}
            {!schoolError && !schools.length && <p className="checkout-hint">No schools are available yet. A school administrator can register one from the <Link href="/schools">school directory</Link>.</p>}
            <div className="checkout-actions">
              <button type="button" className="btn btn-sm" onClick={() => setShowCheckout(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isOrdering || isLoadingSchools || !schools.length}>{isOrdering ? 'Placing order...' : 'Place order'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}