'use client';

import { useEffect, useState, useContext } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';
import ProviderCard from '@/components/provider/ProviderCard';
import MenuGrid from '@/components/menu/MenuGrid';
import SchoolCard from '@/components/school/SchoolCard';
import DashboardStats from '@/dashboard/DashboardStats';
import AppHeader from '@/components/common/AppHeader';
import { api } from '@/services/api';
import '@/styles/pages/Home.css';

export default function HomePage() {
  const { user } = useContext(AuthContext);
  const [featuredProviders, setFeaturedProviders] = useState([]);
  const [featuredMenu, setFeaturedMenu] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProviders: 0,
    totalSchools: 0,
    totalOrders: 0,
    activeOrders: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [providersRes, menuRes, schoolsRes] = await Promise.all([
          api.getProviders(),
          api.getFeaturedMenu(),
          api.getSchools(),
        ]);

        setFeaturedProviders(providersRes.data?.slice(0, 4) || []);
        setFeaturedMenu(menuRes.data?.slice(0, 6) || []);
        setSchools(schoolsRes.data?.slice(0, 3) || []);

        setStats({
          totalProviders: providersRes.data?.length || 0,
          totalSchools: schoolsRes.data?.length || 0,
          totalOrders: 156,
          activeOrders: 23,
        });
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading FoodConnect...</p>
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
            <h1 className="hero-title">
              <span className="hero-highlight">Connect</span> with
              <br />Local Food Providers
            </h1>
            <p className="hero-description">
              Discover, order, and enjoy delicious meals from
              registered providers and schools in your area.
            </p>
            <div className="hero-actions">
              <Link href="/menu" className="btn btn-primary btn-lg">
                Browse Menu
              </Link>
              <Link href="/providers" className="btn btn-outline btn-lg">
                Find Providers
              </Link>
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
                <span className="hero-stat-label">Orders Delivered</span>
              </div>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-image-placeholder">
              🍱
              <span className="hero-image-label">Fresh Food, Happy People</span>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Stats for Authenticated Users */}
      {user && (
        <section className="section">
          <div className="container">
            <DashboardStats stats={stats} />
          </div>
        </section>
      )}

      {/* Featured Providers */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Top Providers</h2>
              <p className="section-subtitle">
                Discover the best food providers in your area
              </p>
            </div>
            <Link href="/providers" className="btn btn-ghost">
              View All →
            </Link>
          </div>
          <div className="provider-grid">
            {featuredProviders.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Menu */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Popular Dishes</h2>
              <p className="section-subtitle">
                Order directly from the menu
              </p>
            </div>
            <Link href="/menu" className="btn btn-ghost">
              View Full Menu →
            </Link>
          </div>
          <MenuGrid items={featuredMenu} showProvider />
        </div>
      </section>

      {/* Schools Section */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Registered Schools</h2>
              <p className="section-subtitle">
                Schools offering food services
              </p>
            </div>
            <Link href="/schools" className="btn btn-ghost">
              All Schools →
            </Link>
          </div>
          <div className="school-grid">
            {schools.map((school) => (
              <SchoolCard key={school.id} school={school} />
            ))}
          </div>
        </div>
      </section>

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