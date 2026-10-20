'use client';

import Link from 'next/link';
import { useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import '@/styles/components/Header.css';

export default function AppHeader() {
  const { user, logout } = useContext(AuthContext);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef(null);
  const toggleRef = useRef(null);
  const linkClassName = (href) => `header-nav-link${pathname === href || pathname.startsWith(`${href}/`) ? ' active' : ''}`;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const closeOnOutsideInteraction = (event) => {
      if (!navRef.current?.contains(event.target) && !toggleRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-icon">✦</span>
          <span className="foodconnect-wordmark" aria-label="FoodConnect">
            FoodC<span className="foodconnect-wordmark-dot" aria-hidden="true" />nnect
          </span>
        </Link>
        <button
          type="button"
          className="header-mobile-toggle"
          ref={toggleRef}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span><span>Menu</span>
        </button>
        <nav id="primary-navigation" ref={navRef} className={`header-nav${mobileMenuOpen ? ' open' : ''}`} aria-label="Main navigation">
          <Link href="/" className={linkClassName('/')} onClick={() => setMobileMenuOpen(false)}>Home</Link>
          {user?.role !== 'provider' && <Link href="/menu" className={linkClassName('/menu')} onClick={() => setMobileMenuOpen(false)}>Menu</Link>}
          <Link href="/schools" className={linkClassName('/schools')} onClick={() => setMobileMenuOpen(false)}>{user?.role === 'provider' ? 'All Schools' : 'Schools'}</Link>
          {user?.role !== 'provider' && <Link href="/providers" className={linkClassName('/providers')} onClick={() => setMobileMenuOpen(false)}>Providers</Link>}
          {user?.role === 'provider' && <Link href="/providers/menu" className={linkClassName('/providers/menu')} onClick={() => setMobileMenuOpen(false)}>My menu</Link>}
          {user?.role === 'provider' && <Link href="/providers/profile" className={linkClassName('/providers/profile')} onClick={() => setMobileMenuOpen(false)}>My Profile</Link>}
          {user?.role === 'provider' && <Link href="/providers/schools" className={linkClassName('/providers/schools')} onClick={() => setMobileMenuOpen(false)}>My Schools</Link>}
          {user?.role === 'superadmin' && <Link href="/admin" className={linkClassName('/admin')} onClick={() => setMobileMenuOpen(false)}>Admin</Link>}
          {['provider', 'customer'].includes(user?.role) && <Link href="/orders" className={linkClassName('/orders')} onClick={() => setMobileMenuOpen(false)}>{user.role === 'provider' ? 'Orders' : 'My orders'}</Link>}
          {user ? (
            <button type="button" className="header-nav-link header-nav-auth" onClick={() => { setMobileMenuOpen(false); logout(); }}>Sign out</button>
          ) : (
            <Link href="/login" className="header-nav-link header-nav-auth" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <span className="header-user-profile">
              <span className="header-user-name">{user.name}</span>
              <span className="header-profile-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 12a4.25 4.25 0 1 0 0-8.5A4.25 4.25 0 0 0 12 12Zm0 2c-4.2 0-7.5 2.2-7.5 5v1.5h15V19c0-2.8-3.3-5-7.5-5Z" fill="currentColor" />
                </svg>
              </span>
            </span>
          ) : (
            <>
              <Link href="/login" className="header-signin">Sign in</Link>
              <Link href="/register" className="header-register">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
