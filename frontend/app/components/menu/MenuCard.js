'use client';

import { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import { api } from '@/services/api';
import Link from 'next/link';
import '@/styles/components/MenuCard.css';

export default function MenuCard({ item, showProvider = false, providerControls = false, onAvailabilityChange, onEditItem }) {
  const { user, token, register, login } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showAllImages, setShowAllImages] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showSignin, setShowSignin] = useState(false);
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '' });
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [schools, setSchools] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [foodPreferences, setFoodPreferences] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolError, setSchoolError] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  const openCheckout = async () => {
    if (user && user.role !== 'customer') {
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
      const providerSchoolIds = providerResult.data?.schoolIds || [];
      const availableSchools = (schoolResult.data || []).filter((school) => providerSchoolIds.includes(school.id));
      setSchools(availableSchools);
      setSchoolId(availableSchools[0]?.id || '');
      if (!availableSchools.length) setSchoolError('This provider has no associated schools available for ordering yet.');
    } catch (error) {
      setSchoolError(error.message || 'Could not load registered schools');
    } finally {
      setIsLoadingSchools(false);
    }
  };

  const handleOrder = async (event) => {
    event.preventDefault();
    if (!user) {
      setShowSignup(true);
      return;
    }

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

  const handleSignupAndOrder = async (event) => {
    event.preventDefault();
    setIsOrdering(true);
    try {
      const session = await register({ ...signupForm, role: 'customer' });
      setShowSignup(false);
      const school = schools.find((entry) => entry.id === schoolId);
      await api.createOrder({
        providerId: item.providerId,
        items: [{ menuId: item.id, quantity, price: item.price }],
        deliveryType: 'collection',
        scheduledFor: null,
        studentName,
        studentClass,
        schoolId,
        schoolName: school?.name,
        foodPreferences,
      }, session.token);
      showNotification('Account created and order placed successfully!', 'success');
      setQuantity(1);
      setStudentName('');
      setStudentClass('');
      setFoodPreferences('');
      setSignupForm({ name: '', email: '', password: '' });
      setShowSignup(false);
      setShowCheckout(false);
    } catch (error) {
      showNotification(error.message || 'Could not create account or place order', 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  const handleSigninAndOrder = async (event) => {
    event.preventDefault();
    setIsOrdering(true);
    try {
      const session = await login(signinForm.email, signinForm.password);
      setShowSignin(false);
      const school = schools.find((entry) => entry.id === schoolId);
      await api.createOrder({
        providerId: item.providerId,
        items: [{ menuId: item.id, quantity, price: item.price }],
        deliveryType: 'collection',
        scheduledFor: null,
        studentName,
        studentClass,
        schoolId,
        schoolName: school?.name,
        foodPreferences,
      }, session.token);
      showNotification('Signed in and order placed successfully!', 'success');
      setQuantity(1);
      setStudentName('');
      setStudentClass('');
      setFoodPreferences('');
      setSigninForm({ email: '', password: '' });
      setShowCheckout(false);
    } catch (error) {
      showNotification(error.message || 'Could not sign in or place order', 'error');
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <>
    <div className="menu-card">
      <div className="menu-card-image">
        {images.length ? (
          <img src={images[Math.min(activeImageIndex, images.length - 1)]} alt={item.name} />
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
        {images.length > 0 && <>
          <button type="button" className="menu-card-gallery-toggle" onClick={() => setShowAllImages((current) => !current)} aria-expanded={showAllImages}>
            {showAllImages ? 'Hide photos' : `Expand ${images.length === 1 ? 'photo' : `${images.length} photos`}`}
          </button>
          {showAllImages && <div className="menu-card-expanded-gallery">
            <img className="menu-card-expanded-photo" src={images[Math.min(activeImageIndex, images.length - 1)]} alt={`${item.name}, selected photo`} />
            {images.length > 1 && <div className="menu-card-image-gallery">
              {images.map((image, index) => <button type="button" key={`${item.id}-image-${index}`} onClick={() => setActiveImageIndex(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={activeImageIndex === index}>
                <img src={image} alt={`${item.name}, photo ${index + 1}`} />
              </button>)}
            </div>}
          </div>}
        </>}
        {Array.isArray(item.availableSchools) && (
          <p className="menu-card-description">Available at: {item.availableSchools.length ? item.availableSchools.map((school) => school.name).join(', ') : 'No registered schools'}</p>
        )}
        {providerControls ? <div className="menu-card-provider-controls">
          <label className="menu-card-availability">
            <input type="checkbox" checked={item.available !== false} onChange={(event) => onAvailabilityChange?.(item, event.target.checked)} />
            {item.available === false ? 'Unavailable' : 'Available to order'}
          </label>
          <button type="button" className="menu-card-gallery-toggle" onClick={() => onEditItem?.(item)}>Edit item</button>
        </div> : <div className="menu-card-actions">
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
        </div>}
      </div>
    </div>
    {showCheckout && createPortal(
        <div className="checkout-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowCheckout(false)}>
          <form className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby={`checkout-title-${item.id}`} onSubmit={showSignup ? handleSignupAndOrder : showSignin ? handleSigninAndOrder : handleOrder}>
            <h2 id={`checkout-title-${item.id}`}>{showSignup ? 'Create an account to place your order' : showSignin ? 'Sign in to place your order' : 'Student order details'}</h2>
            <p>{item.name} · {quantity} {quantity === 1 ? 'meal' : 'meals'}</p>
            {showSignup ? <>
              <label className="checkout-field" htmlFor={`parent-name-${item.id}`}>Parent or guardian name
                <input id={`parent-name-${item.id}`} value={signupForm.name} onChange={(event) => setSignupForm({ ...signupForm, name: event.target.value })} required maxLength={100} autoFocus />
              </label>
              <label className="checkout-field" htmlFor={`parent-email-${item.id}`}>Email address
                <input id={`parent-email-${item.id}`} type="email" value={signupForm.email} onChange={(event) => setSignupForm({ ...signupForm, email: event.target.value })} required autoComplete="email" />
              </label>
              <label className="checkout-field" htmlFor={`parent-password-${item.id}`}>Password
                <input id={`parent-password-${item.id}`} type="password" minLength={6} value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} required autoComplete="new-password" />
              </label>
              <p className="checkout-hint">Already have an account? <button type="button" className="checkout-inline-action" onClick={() => { setShowSignup(false); setShowSignin(true); }}>Sign in</button></p>
            </> : showSignin ? <>
              <label className="checkout-field" htmlFor={`signin-email-${item.id}`}>Email address
                <input id={`signin-email-${item.id}`} type="email" value={signinForm.email} onChange={(event) => setSigninForm({ ...signinForm, email: event.target.value })} required autoComplete="email" autoFocus />
              </label>
              <label className="checkout-field" htmlFor={`signin-password-${item.id}`}>Password
                <input id={`signin-password-${item.id}`} type="password" value={signinForm.password} onChange={(event) => setSigninForm({ ...signinForm, password: event.target.value })} required autoComplete="current-password" />
              </label>
              <p className="checkout-hint">New to FoodConnect? <button type="button" className="checkout-inline-action" onClick={() => { setShowSignin(false); setShowSignup(true); }}>Create an account</button></p>
            </> : <>
              <label className="checkout-field" htmlFor={`student-name-${item.id}`}>Student name
                <input id={`student-name-${item.id}`} value={studentName} onChange={(event) => setStudentName(event.target.value)} required maxLength={100} autoFocus />
              </label>
              <label className="checkout-field" htmlFor={`student-class-${item.id}`}>Student class
                <input id={`student-class-${item.id}`} value={studentClass} onChange={(event) => setStudentClass(event.target.value)} placeholder="For example, Year 4" required maxLength={60} />
              </label>
              <label className="checkout-field" htmlFor={`school-${item.id}`}>School
                <select id={`school-${item.id}`} value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required disabled={!schools.length}>
                  {isLoadingSchools ? <option value="">Loading schools...</option> : schools.length ? schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>) : <option value="">No schools available</option>}
                </select>
              </label>
              <label className="checkout-field" htmlFor={`food-preferences-${item.id}`}>Food preferences or allergies
                <textarea id={`food-preferences-${item.id}`} value={foodPreferences} onChange={(event) => setFoodPreferences(event.target.value)} placeholder="Allergies, ingredients to avoid, or preparation requests" maxLength={500} rows={3} />
              </label>
            </>}
            {schoolError && <p className="checkout-error" role="alert">{schoolError}</p>}
            {!showSignup && !schoolError && !schools.length && <p className="checkout-hint">No schools are available yet. A school administrator or provider can register one from the <Link href="/schools">school directory</Link>.</p>}
            <div className="checkout-actions">
              <button type="button" className="btn btn-sm" onClick={() => { setShowCheckout(false); setShowSignup(false); setShowSignin(false); }}>Cancel</button>
              {(showSignup || showSignin) && <button type="button" className="btn btn-sm" onClick={() => { setShowSignup(false); setShowSignin(false); }} disabled={isOrdering}>Back to order</button>}
              <button type="submit" className="btn btn-primary btn-sm" disabled={isOrdering || (!showSignup && !showSignin && (isLoadingSchools || !schools.length))}>{isOrdering ? 'Submitting...' : showSignup ? 'Create account and place order' : showSignin ? 'Sign in and place order' : user ? 'Place order' : 'Continue to sign up'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}