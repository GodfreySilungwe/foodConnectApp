'use client';

import MenuCard from './MenuCard';
import '@/styles/components/MenuGrid.css';

export default function MenuGrid({ items, showProvider = false }) {
  if (!items || items.length === 0) {
    return (
      <div className="menu-grid-empty">
        <p>No menu items available</p>
      </div>
    );
  }

  return (
    <div className="menu-grid">
      {items.map((item) => (
        <MenuCard
          key={item.id}
          item={item}
          showProvider={showProvider}
        />
      ))}
    </div>
  );
}