'use client';

import Link from 'next/link';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import '@/styles/components/Header.css';

export default function AppHeader() {
  const { user, logout } = useContext(AuthContext);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-icon">✦</span>
          <span>FoodConnect</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/menu" className="header-nav-link">Menu</Link>
          <Link href="/providers" className="header-nav-link">Providers</Link>
          {user?.role === 'provider' && <Link href="/orders" className="header-nav-link">Orders</Link>}
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
