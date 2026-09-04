'use client';

import { useState, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import { NotificationContext } from '@/contexts/NotificationContext';
import '@/styles/components/Header.css';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useContext(AuthContext);
  const { notifications } = useContext(NotificationContext);
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/providers', label: 'Providers' },
    { href: '/schools', label: 'Schools' },
    { href: '/menu', label: 'Menu' },
  ];

  const authenticatedLinks = [
    { href: '/orders', label: 'My Orders' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <header className="header">
      <div className="container header-inner">
        <div className="header-logo">
          <span className="header-logo-icon">🍽️</span>
          <span>FoodConnect</span>
        </div>

        <nav className={`header-nav ${mobileMenuOpen ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="header-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user && authenticatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="header-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <form className="header-search" onSubmit={handleSearch}>
            <input
              type="text"
              className="header-search-input"
              placeholder="Search food, providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="header-search-icon">🔍</span>
          </form>

          {user ? (
            <>
              <div className="header-badge">
                <Link href="/notifications" className="header-nav-link">
                  🔔
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="header-badge-dot" />
                  )}
                </Link>
              </div>
              <div className="header-user" onClick={() => router.push('/profile')}>
                <div className="header-avatar">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="header-user-name">{user.name}</span>
              </div>
              <button
                onClick={logout}
                className="btn btn-ghost btn-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign In
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </>
          )}

          <button
            className="header-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </header>
  );
}