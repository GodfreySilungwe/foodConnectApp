'use client';

import Link from 'next/link';
import { useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import '@/styles/components/Header.css';

export default function AppHeader() {
  const { user, logout } = useContext(AuthContext);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const linkClassName = (href) => `header-nav-link${pathname === href || pathname.startsWith(`${href}/`) ? ' active' : ''}`;

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-icon">✦</span>
          <span>FoodConnect</span>
        </Link>
        <button
          type="button"
          className="header-mobile-toggle"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span><span>Menu</span>
        </button>
        <nav id="primary-navigation" className={`header-nav${mobileMenuOpen ? ' open' : ''}`} aria-label="Main navigation">
          {user?.role !== 'provider' && <Link href="/menu" className={linkClassName('/menu')} onClick={() => setMobileMenuOpen(false)}>Menu</Link>}
          <Link href="/schools" className={linkClassName('/schools')} onClick={() => setMobileMenuOpen(false)}>{user?.role === 'provider' ? 'All Schools' : 'Schools'}</Link>
          {user?.role !== 'provider' && <Link href="/providers" className={linkClassName('/providers')} onClick={() => setMobileMenuOpen(false)}>Providers</Link>}
          {user?.role === 'provider' && <Link href="/providers/menu" className={linkClassName('/providers/menu')} onClick={() => setMobileMenuOpen(false)}>My menu</Link>}
          {user?.role === 'provider' && <Link href="/providers/profile" className={linkClassName('/providers/profile')} onClick={() => setMobileMenuOpen(false)}>My Profile</Link>}
          {user?.role === 'provider' && <Link href="/providers/schools" className={linkClassName('/providers/schools')} onClick={() => setMobileMenuOpen(false)}>My Schools</Link>}
          {user?.role === 'superadmin' && <Link href="/admin" className={linkClassName('/admin')} onClick={() => setMobileMenuOpen(false)}>Admin</Link>}
          {['provider', 'customer'].includes(user?.role) && <Link href="/orders" className={linkClassName('/orders')} onClick={() => setMobileMenuOpen(false)}>{user.role === 'provider' ? 'Orders' : 'My orders'}</Link>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="header-user-name">{user.name}</span>
              <button type="button" className="header-action-button" onClick={logout}>Sign out</button>
            </>
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
