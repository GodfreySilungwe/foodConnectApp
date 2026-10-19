'use client';

import { useState, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import LocationPicker from '@/components/common/LocationPicker';
import { api, getProviderImageUrl } from '@/services/api';
import { getCoordinatesOrCurrentPosition } from '@/utils/location';
import { malawiDistricts } from '@/utils/malawiDistricts';
import { formatMWK } from '@/utils/formatCurrency';
import Link from 'next/link';
import '@/styles/components/MenuCard.css';

const distanceKmBetween = (first, second) => {
  if (!Number.isFinite(first?.latitude) || !Number.isFinite(first?.longitude) || !Number.isFinite(second?.latitude) || !Number.isFinite(second?.longitude)) {
    return null;
  }

  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) * 10) / 10;
};

export default function MenuCard({ item, showProvider = false, providerControls = false, onAvailabilityChange, onEditItem }) {
  const { user, token, register, login } = useContext(AuthContext);
  const { showNotification } = useContext(NotificationContext);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showAllImages, setShowAllImages] = useState(false);
  const touchStartX = useRef(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [showSignin, setShowSignin] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', phone: '', district: '', latitude: null, longitude: null });
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState(null);
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [schools, setSchools] = useState([]);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [foodPreferences, setFoodPreferences] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [schoolError, setSchoolError] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const images = item.images?.length ? item.images : item.image ? [item.image] : [];

  useEffect(() => {
    if (!showAllImages) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowAllImages(false);
    };

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAllImages]);

  const expandCardImages = (event) => {
    if (!images.length || event.target.closest('a, button, input, label, select, textarea')) return;
    setShowAllImages(true);
  };

  const handleCardKeyDown = (event) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setShowAllImages(true);
  };

  const showPreviousImage = () => setActiveImageIndex((index) => (index + images.length - 1) % images.length);
  const showNextImage = () => setActiveImageIndex((index) => (index + 1) % images.length);

  const handleGalleryTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 45 || images.length < 2) return;
    setActiveImageIndex((index) => (index + (distance < 0 ? 1 : images.length - 1)) % images.length);
  };

  const openCheckout = async () => {
    if (user && user.role !== 'customer') {
      showNotification('Only parent accounts can place orders', 'error');
      return;
    }

    if (isLoadingSchools) return;
    setShowSignup(false);
    setShowSignin(false);
    setShowCheckout(true);
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

      const parentLocation = user && Number.isFinite(user.latitude) && Number.isFinite(user.longitude)
        ? { latitude: user.latitude, longitude: user.longitude }
        : null;
      const providerLocation = Number.isFinite(providerResult.data?.latitude) && Number.isFinite(providerResult.data?.longitude)
        ? { latitude: providerResult.data.latitude, longitude: providerResult.data.longitude }
        : null;
      setEstimatedDistanceKm(parentLocation && providerLocation ? distanceKmBetween(parentLocation, providerLocation) : null);

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

    let coordinates;
    try {
      coordinates = await getCoordinatesOrCurrentPosition(signupForm);
      setSignupForm((current) => ({ ...current, ...coordinates }));
    } catch (error) {
      showNotification(error.message, 'error');
      setIsOrdering(false);
      return;
    }

    try {
      const session = await register({ ...signupForm, ...coordinates, role: 'customer' });
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
      setSignupForm({ name: '', email: '', password: '', phone: '', district: '', latitude: null, longitude: null });
      setShowSignup(false);
      setShowCheckout(false);
    } catch (error) {
      if (error.message?.toLowerCase().includes('already exists')) {
        setSignupError('An account with this email already exists. Sign in to place your order.');
      } else {
        showNotification(error.message || 'Could not create account or place order', 'error');
      }
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
    <article
      className={`menu-card${images.length ? ' menu-card-has-images' : ''}`}
      onClick={expandCardImages}
      onKeyDown={handleCardKeyDown}
      tabIndex={images.length ? 0 : undefined}
      aria-label={images.length ? `${item.name}. Activate to expand photos.` : undefined}
    >
      <div className="menu-card-image">
        {images.length ? (
          <img src={getProviderImageUrl(images[Math.min(activeImageIndex, images.length - 1)])} alt={item.name} />
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
          <span className="menu-card-price">{formatMWK(item.price)}</span>
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
          <button type="button" className="menu-card-gallery-toggle" onClick={() => setShowAllImages(true)}>
            View {images.length === 1 ? 'photo and details' : `${images.length} photos and details`}
          </button>
        </>}
        {Array.isArray(item.availableSchools) && (
          <p className="menu-card-description">Available at: {item.availableSchools.length ? item.availableSchools.map((school, index) => <span key={school.id}>{index > 0 && ', '}<strong>{school.name}</strong>{school.distanceKm !== null && school.distanceKm !== undefined ? ` · ${school.distanceKm} km · approx. ${school.estimatedMinutes} min delivery` : ''}</span>) : 'No registered schools'}</p>
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
            onClick={(event) => {
              event.stopPropagation();
              openCheckout();
            }}
            disabled={isOrdering || item.available === false}
          >
            Order for student
          </button>
        </div>}
      </div>
    </article>
    {showAllImages && createPortal(
      <div className="menu-expanded-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowAllImages(false)}>
        <section className="menu-expanded-dialog" role="dialog" aria-modal="true" aria-labelledby={`menu-expanded-title-${item.id}`}>
          <header className="menu-expanded-header">
            <button type="button" className="menu-expanded-back" onClick={() => setShowAllImages(false)}>
              <span aria-hidden="true">←</span> Back to menu
            </button>
            <Link href="/" className="menu-expanded-home" onClick={() => setShowAllImages(false)}>Home</Link>
            <button type="button" className="menu-expanded-close" onClick={() => setShowAllImages(false)} aria-label="Close expanded menu item">×</button>
          </header>
          <div className="menu-expanded-content">
            <div className="menu-expanded-gallery">
              <div
                className="menu-card-gallery-stage"
                onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
                onTouchEnd={handleGalleryTouchEnd}
              >
                <img className="menu-card-expanded-photo" src={getProviderImageUrl(images[Math.min(activeImageIndex, images.length - 1)])} alt={`${item.name}, photo ${activeImageIndex + 1}`} />
                {images.length > 1 && <>
                  <button type="button" className="menu-card-gallery-previous" onClick={showPreviousImage} aria-label="Previous photo">‹</button>
                  <span className="menu-card-gallery-count">{activeImageIndex + 1} / {images.length}</span>
                  <button type="button" className="menu-card-gallery-next" onClick={showNextImage} aria-label="Next photo">›</button>
                </>}
              </div>
              {images.length > 1 && <div className="menu-card-image-gallery">
                {images.map((image, index) => <button type="button" key={`${item.id}-image-${index}`} onClick={() => setActiveImageIndex(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={activeImageIndex === index}>
                  <img src={getProviderImageUrl(image)} alt={`${item.name}, photo ${index + 1}`} />
                </button>)}
              </div>}
            </div>
            <div className="menu-expanded-details">
              <p className="menu-expanded-eyebrow">{item.available === false ? 'Currently unavailable' : 'Freshly prepared'}</p>
              <h2 id={`menu-expanded-title-${item.id}`}>{item.name}</h2>
              <p className="menu-expanded-price">{formatMWK(item.price)}</p>
              {showProvider && item.providerName && (
                <Link href={`/providers/${item.providerId}`} className="menu-card-provider" onClick={() => setShowAllImages(false)}>
                  🏪 {item.providerName} <span aria-hidden="true">→</span>
                </Link>
              )}
              {item.description && <p className="menu-expanded-description">{item.description}</p>}
              {Array.isArray(item.availableSchools) && (
                <section className="menu-expanded-availability">
                  <h3>Available at</h3>
                  {item.availableSchools.length ? (
                    <ul>{item.availableSchools.map((school) => (
                      <li key={school.id}>
                        <span>{school.name}</span>
                        {school.distanceKm !== null && school.distanceKm !== undefined && (
                          <small>{school.distanceKm} km · approx. {school.estimatedMinutes} min delivery</small>
                        )}
                      </li>
                    ))}</ul>
                  ) : <p>No registered schools are available for this item.</p>}
                </section>
              )}
              {!providerControls && <div className="menu-expanded-order">
                <div className="menu-card-quantity" aria-label="Quantity">
                  <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((current) => current + 1)} aria-label="Increase quantity">+</button>
                </div>
                <button type="button" className="btn btn-primary" onClick={openCheckout} disabled={isOrdering || item.available === false}>
                  {isOrdering ? 'Loading...' : 'Order for student'}
                </button>
              </div>}
            </div>
          </div>
        </section>
      </div>,
      document.body
    )}
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
              <label className="checkout-field" htmlFor={`parent-phone-${item.id}`}>Phone number
                <input id={`parent-phone-${item.id}`} type="tel" value={signupForm.phone} onChange={(event) => setSignupForm({ ...signupForm, phone: event.target.value })} required autoComplete="tel" />
              </label>
              <label className="checkout-field" htmlFor={`parent-district-${item.id}`}>District
                <select id={`parent-district-${item.id}`} value={signupForm.district} onChange={(event) => setSignupForm({ ...signupForm, district: event.target.value })} required>
                  <option value="">Choose your district</option>
                  {malawiDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
                </select>
              </label>
              <label className="checkout-field" htmlFor={`parent-password-${item.id}`}>Password
                <input id={`parent-password-${item.id}`} type="password" minLength={6} value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} required autoComplete="new-password" />
              </label>
              <LocationPicker
                value={{ latitude: signupForm.latitude, longitude: signupForm.longitude }}
                onChange={(coordinates) => setSignupForm((current) => ({ ...current, ...coordinates }))}
                label="Select your home or pickup location"
                autoLocate
              />
              {estimatedDistanceKm !== null && <p className="checkout-hint">Estimated distance from your saved location to this provider: {estimatedDistanceKm.toFixed(1)} km</p>}
              {signupError && <p className="checkout-error" role="alert">{signupError} <button type="button" className="checkout-inline-action" onClick={() => { setSigninForm((current) => ({ ...current, email: signupForm.email })); setSignupError(''); setShowSignup(false); setShowSignin(true); }}>Sign in</button></p>}
              {!signupError && <p className="checkout-hint">Already have an account? <button type="button" className="checkout-inline-action" onClick={() => { setSigninForm((current) => ({ ...current, email: signupForm.email })); setShowSignup(false); setShowSignin(true); }}>Sign in</button></p>}
            </> : showSignin ? <>
              <label className="checkout-field" htmlFor={`signin-email-${item.id}`}>Email address
                <input id={`signin-email-${item.id}`} type="email" value={signinForm.email} onChange={(event) => setSigninForm({ ...signinForm, email: event.target.value })} required autoComplete="email" autoFocus />
              </label>
              <label className="checkout-field" htmlFor={`signin-password-${item.id}`}>Password
                <input id={`signin-password-${item.id}`} type="password" value={signinForm.password} onChange={(event) => setSigninForm({ ...signinForm, password: event.target.value })} required autoComplete="current-password" />
              </label>
              <p className="checkout-hint">New to FoodConnect? <button type="button" className="checkout-inline-action" onClick={() => { setShowSignin(false); setShowSignup(true); }}>Create an account</button></p>
            </> : <>
              {!user && <p className="checkout-hint">Already have an account? <button type="button" className="checkout-inline-action" onClick={() => { setShowSignin(true); setShowSignup(false); }}>Sign in</button></p>}
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
              {user && Number.isFinite(user.latitude) && Number.isFinite(user.longitude) && estimatedDistanceKm !== null && (
                <p className="checkout-hint">Estimated distance from your saved home location: {estimatedDistanceKm.toFixed(1)} km</p>
              )}
            </>}
            {schoolError && <p className="checkout-error" role="alert">{schoolError}</p>}
            {!showSignup && !schoolError && !schools.length && <p className="checkout-hint">No schools are available yet. A school administrator or provider can register one from the <Link href="/schools">school directory</Link>.</p>}
            <div className="checkout-actions">
              <button type="button" className="btn btn-sm" onClick={() => { setShowCheckout(false); setShowSignup(false); setShowSignin(false); }}>Cancel</button>
              {(showSignup || showSignin) && <button type="button" className="btn btn-sm" onClick={() => { setShowSignup(false); setShowSignin(false); }} disabled={isOrdering}><span aria-hidden="true">← </span>Back to order</button>}
              <button type="submit" className="btn btn-primary btn-sm" disabled={isOrdering || (!showSignup && !showSignin && (isLoadingSchools || !schools.length))}>{isOrdering ? 'Submitting...' : showSignup ? 'Create account and place order' : showSignin ? 'Sign in and place order' : user ? 'Place order' : 'Continue to sign up'}</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
}