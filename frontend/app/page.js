'use client';

import { useEffect, useState, useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import ProviderCard from '@/components/provider/ProviderCard';
import MenuGrid from '@/components/menu/MenuGrid';
import SchoolCard from '@/components/school/SchoolCard';
import DashboardStats from '@/dashboard/DashboardStats';
import AppHeader from '@/components/common/AppHeader';
import SearchField from '@/components/common/SearchField';
import { api } from '@/services/api';
import { matchesSearch } from '@/utils/search';
import '@/styles/pages/Home.css';

export default function HomePage() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const [featuredProviders, setFeaturedProviders] = useState([]);
  const [featuredMenu, setFeaturedMenu] = useState([]);
  const [schools, setSchools] = useState([]);
  const [parentOrders, setParentOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [stats, setStats] = useState({
    totalProviders: 0,
    totalSchools: 0,
    totalOrders: 0,
    activeOrders: 0,
  });

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const location = user && Number.isFinite(user.latitude) && Number.isFinite(user.longitude)
          ? { latitude: user.latitude, longitude: user.longitude }
          : null;
        if (active) setUserLocation(location);

        const [providersRes, menuRes, schoolsRes] = await Promise.all([
          api.getProviders(),
          api.getFeaturedMenu(),
          api.getSchools(location ? `?latitude=${location.latitude}&longitude=${location.longitude}` : ''),
        ]);

        if (!active) return;
        setFeaturedProviders(providersRes.data || []);
        setFeaturedMenu(menuRes.data || []);
        setSchools(schoolsRes.data || []);

        setStats({
          totalProviders: providersRes.data?.length || 0,
          totalSchools: schoolsRes.data?.length || 0,
          totalOrders: 156,
          activeOrders: 23,
        });

        if (user?.role === 'customer' && token) {
          try {
            const ordersRes = await api.getOrders(token, { limit: 100 });
            if (active) setParentOrders(ordersRes.data || []);
          } catch (error) {
            console.error('Failed to load parent order history for homepage personalization:', error);
          }
        } else {
          if (active) setParentOrders([]);
        }
      } catch (error) {
        if (active) console.error('Failed to load data:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [authLoading, user, token]);

  const schoolDistanceById = new Map(schools.map((school) => [school.id, school.distanceKm]));
  const getNearestServedSchoolDistance = (schoolIds = []) => schoolIds
    .map((schoolId) => schoolDistanceById.get(schoolId))
    .filter(Number.isFinite)
    .reduce((nearest, distance) => Math.min(nearest, distance), Infinity);
  const sortedSchools = userLocation ? [...schools].sort((left, right) => {
    const leftDistance = Number.isFinite(left.distanceKm) ? left.distanceKm : Infinity;
    const rightDistance = Number.isFinite(right.distanceKm) ? right.distanceKm : Infinity;
    return leftDistance - rightDistance;
  }) : schools;
  const sortedProviders = userLocation
    ? featuredProviders.map((provider) => ({
      ...provider,
      distanceKm: getNearestServedSchoolDistance(provider.schoolIds),
      distanceLabel: 'to a served school',
    })).sort((left, right) => left.distanceKm - right.distanceKm)
    : featuredProviders;
  const sortedMenu = userLocation ? [...featuredMenu].sort((left, right) => {
    const leftDistance = getNearestServedSchoolDistance((left.availableSchools || []).map((school) => school.id));
    const rightDistance = getNearestServedSchoolDistance((right.availableSchools || []).map((school) => school.id));
    return leftDistance - rightDistance;
  }) : featuredMenu;

  const filteredSchools = sortedSchools.filter((school) => matchesSearch(query, school.name, school.location));
  const filteredMenu = sortedMenu.filter((item) => matchesSearch(
    query,
    item.name,
    item.description,
    item.providerName,
    item.availableSchools?.map((school) => school.name).join(' ')
  ));
  const filteredProviders = sortedProviders.filter((provider) => matchesSearch(
    query,
    provider.name,
    provider.ownerName,
    provider.description,
    provider.location,
    schools.filter((school) => (provider.schoolIds || []).includes(school.id)).map((school) => school.name).join(' ')
  ));
  const hasQuery = Boolean(query.trim());
  const visibleSchools = hasQuery ? filteredSchools : filteredSchools.slice(0, 3);
  const visibleMenu = hasQuery ? filteredMenu : filteredMenu.slice(0, 6);
  const visibleProviders = hasQuery ? filteredProviders : filteredProviders.slice(0, 4);
  const familyChildren = [...new Map(parentOrders
    .filter((order) => order.studentName)
    .map((order) => {
      const key = `${order.studentName.trim().toLowerCase()}:${order.schoolId || ''}`;
      const schoolName = order.schoolName || schools.find((school) => school.id === order.schoolId)?.name;
      return [key, {
        key,
        name: order.studentName,
        studentClass: order.studentClass,
        schoolName,
      }];
    })).values()];
  const familySchools = [...new Set(familyChildren.map((child) => child.schoolName).filter(Boolean))];

  if (loading || authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p role="status">Loading menu items, providers, and schools...</p>
      </div>
    );
  }

  return (
    <div className="home-page">
      <AppHeader />
      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-content">
            <div className="hero-intro">
              <span className="foodconnect-wordmark" aria-label="FoodConnect">
                FoodC<span className="foodconnect-wordmark-dot" aria-hidden="true" />nnect
              </span>
              <div className="hero-tag">Fast delivery · Fresh meals</div>
            </div>
            <h1 className="hero-title">
              School Lunch,
              <br /><span className="hero-highlight">in Minutes</span>
            </h1>
            <p className="hero-description">
              Discover trusted school and community food providers near you,
              then order hot meals in minutes.
            </p>
            <div className="hero-actions">
              <Link href="/menu" className="btn btn-primary btn-lg hero-primary-action">
                Browse menu <span aria-hidden="true">→</span>
              </Link>
              <div className="hero-secondary-actions" aria-label="Explore FoodConnect">
                <Link href="/providers" className="hero-secondary-action">
                  <span className="hero-secondary-icon" aria-hidden="true">⌖</span>
                  <span>Find providers</span>
                </Link>
                <Link href="/schools" className="hero-secondary-action">
                  <span className="hero-secondary-icon" aria-hidden="true">▤</span>
                  <span>Choose your school</span>
                </Link>
              </div>
            </div>
            <div className="hero-stats">
              <div>
                <span className="hero-stat-number">{stats.totalProviders}+</span>
                <span className="hero-stat-label">Providers</span>
              </div>
              <div>
                <span className="hero-stat-number">{stats.totalSchools}+</span>
                <span className="hero-stat-label">Schools</span>
              </div>
              <div>
                <span className="hero-stat-number">{stats.totalOrders}+</span>
                <span className="hero-stat-label">Meals delivered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {user?.role === 'customer' && (
        <section className="home-family-section" aria-labelledby="home-family-title">
          <div className="container">
            <div className="home-family-card">
              <div>
                <p className="home-family-eyebrow">Your FoodConnect</p>
                <h2 id="home-family-title">Welcome back, {user.name}</h2>
                {familyChildren.length ? (
                  <>
                    <p className="home-family-description">Quickly find meals connected to your family.</p>
                    <div className="home-family-list">
                      {familyChildren.slice(0, 4).map((child) => (
                        <span className="home-family-chip" key={child.key}>
                          <strong>{child.name}</strong>
                          {child.studentClass ? ` · ${child.studentClass}` : ''}
                          {child.schoolName ? ` · ${child.schoolName}` : ''}
                        </span>
                      ))}
                    </div>
                    {familySchools.length > 0 && <p className="home-family-schools">Schools in your recent orders: {familySchools.join(', ')}</p>}
                  </>
                ) : (
                  <p className="home-family-description">Place an order for your child to see their name and school here.</p>
                )}
              </div>
              <Link href={familyChildren.length ? '/orders' : '/menu'} className="btn btn-primary">
                {familyChildren.length ? 'View orders' : 'Browse meals'}
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className={`section ${hasQuery ? 'home-search-results-section' : ''}`}>
        <div className="container">
          <SearchField value={query} onChange={setQuery} placeholder="Search dishes, providers, or schools" label="Search dishes, providers, and schools" />
          {hasQuery ? (
            <div className="home-search-results" aria-label="Search results">
              <h2>Search results</h2>
              <section className="home-search-group" aria-labelledby="home-search-menu-title">
                <div className="section-header">
                  <h3 id="home-search-menu-title">Menu</h3>
                  <Link href="/menu" className="btn btn-ghost">Full menu →</Link>
                </div>
                {filteredMenu.length ? <MenuGrid items={filteredMenu} showProvider /> : <p className="home-search-empty">No menu items match your search.</p>}
              </section>
              <section className="home-search-group" aria-labelledby="home-search-providers-title">
                <div className="section-header">
                  <h3 id="home-search-providers-title">Providers</h3>
                  <Link href="/providers" className="btn btn-ghost">All providers →</Link>
                </div>
                {filteredProviders.length ? (
                  <div className="provider-grid">
                    {filteredProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
                  </div>
                ) : <p className="home-search-empty">No providers match your search.</p>}
              </section>
              <section className="home-search-group" aria-labelledby="home-search-schools-title">
                <div className="section-header">
                  <h3 id="home-search-schools-title">Schools</h3>
                  <Link href="/schools" className="btn btn-ghost">All schools →</Link>
                </div>
                {filteredSchools.length ? (
                  <div className="school-grid">
                    {filteredSchools.map((school) => <SchoolCard key={school.id} school={school} />)}
                  </div>
                ) : <p className="home-search-empty">No schools match your search.</p>}
              </section>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div>
                  <h2>Popular Dishes</h2>
                  <p className="section-subtitle">Recommended for nearby schools</p>
                </div>
                <Link href="/menu" className="btn btn-ghost">View Full Menu →</Link>
              </div>
              {visibleMenu.length ? <MenuGrid items={visibleMenu} showProvider /> : <p className="home-search-empty">No menu items are available yet.</p>}
            </>
          )}
        </div>
      </section>

      {!hasQuery && <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Top Providers</h2>
              <p className="section-subtitle">Ranked by distance to the schools they serve</p>
            </div>
            <Link href="/providers" className="btn btn-ghost">View All →</Link>
          </div>
          <div className="provider-grid">
            {visibleProviders.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
          </div>
        </div>
      </section>}

      {!hasQuery && <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Registered Schools</h2>
              <p className="section-subtitle">Schools ranked by distance from your saved home location</p>
            </div>
            <Link href="/schools" className="btn btn-ghost">All Schools →</Link>
          </div>
          {visibleSchools.length ? <div className="school-grid">
            {visibleSchools.map((school) => <SchoolCard key={school.id} school={school} />)}
          </div> : <p className="home-search-empty">No schools are registered yet.</p>}
        </div>
      </section>}

      {/* Dashboard Stats for Authenticated Users */}
      {user && user.role !== 'customer' && (
        <section className="section">
          <div className="container">
            <DashboardStats stats={stats} />
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container cta-inner">
          <div className="cta-content">
            <h2>Ready to get started?</h2>
            <p>
              Join FoodConnect today and connect with local food providers
              or register your business.
            </p>
            <div className="cta-actions">
              <Link href="/register" className="btn btn-white btn-lg">
                Get Started
              </Link>
              <Link href="/providers" className="btn btn-white-outline btn-lg">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}