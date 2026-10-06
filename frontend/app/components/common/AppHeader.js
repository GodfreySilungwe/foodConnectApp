'use client';

import Link from 'next/link';
import { useContext } from 'react';
import { usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import '@/styles/components/Header.css';

export default function AppHeader() {
  const { user, logout } = useContext(AuthContext);
  const pathname = usePathname();
  const linkClassName = (href) => `header-nav-link${pathname === href || pathname.startsWith(`${href}/`) ? ' active' : ''}`;

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="header-logo">
          <span className="header-logo-icon">✦</span>
          <span>FoodConnect</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          {user?.role !== 'provider' && <Link href="/menu" className={linkClassName('/menu')}>Menu</Link>}
          <Link href="/schools" className={linkClassName('/schools')}>Schools</Link>
          {user?.role !== 'provider' && <Link href="/providers" className={linkClassName('/providers')}>Providers</Link>}
          {user?.role === 'provider' && <Link href="/providers/menu" className={linkClassName('/providers/menu')}>My menu</Link>}
          {user?.role === 'provider' && <Link href="/providers/schools" className={linkClassName('/providers/schools')}>School coverage</Link>}
          {['provider', 'customer'].includes(user?.role) && <Link href="/orders" className={linkClassName('/orders')}>{user.role === 'provider' ? 'Orders' : 'My orders'}</Link>}
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
