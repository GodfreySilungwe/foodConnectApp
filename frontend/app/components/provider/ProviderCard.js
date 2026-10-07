'use client';

import Link from 'next/link';
import Image from 'next/image';
import '@/styles/components/ProviderCard.css';

export default function ProviderCard({ provider }) {
  const statusColors = {
    active: 'status-active',
    inactive: 'status-inactive',
    suspended: 'status-suspended',
  };
  const ratingValue = Number(provider?.rating ?? provider?.averageRating ?? 0) || 0;
  const starCount = Math.min(5, Math.max(0, Math.round(ratingValue)));
  const stars = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

  return (
    <Link href={`/providers/${provider.id}`} className="provider-card">
      <div className="provider-card-image">
        {provider.image ? (
          <Image
            src={provider.image}
            alt={provider.name}
            width={300}
            height={200}
          />
        ) : (
          <div className="provider-card-image-placeholder">
            🏪
          </div>
        )}
        <span className={`provider-card-status ${statusColors[provider.status] || 'status-active'}`}>
          {provider.status || 'Active'}
        </span>
      </div>
      <div className="provider-card-body">
        <h3 className="provider-card-name">{provider.name}</h3>
        {provider.description && <p className="provider-card-description">{provider.description}</p>}
        <p className="provider-card-owner">{provider.ownerName}</p>
        <div className="provider-card-meta">
          <span>{stars} {ratingValue ? ratingValue.toFixed(1) : 'No ratings yet'}</span>
          <span>🕒 {provider.hours || '8:00 AM - 8:00 PM'}</span>
          <span>📍 {provider.location || 'Nearby'}</span>
        </div>
        <div className="provider-card-footer">
          <span className="provider-card-menu-count">
            {provider.menuCount || 12} items
          </span>
          <span className="provider-card-view">View Menu →</span>
        </div>
      </div>
    </Link>
  );
}