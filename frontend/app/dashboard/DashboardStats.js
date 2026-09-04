'use client';

import '@/styles/components/DashboardStarts.css';

export default function DashboardStats({ stats }) {
  const statItems = [
    { icon: '🏪', label: 'Total Providers', value: stats.totalProviders || 0 },
    { icon: '🏫', label: 'Total Schools', value: stats.totalSchools || 0 },
    { icon: '📦', label: 'Total Orders', value: stats.totalOrders || 0 },
    { icon: '🔄', label: 'Active Orders', value: stats.activeOrders || 0 },
    { icon: '💰', label: 'Revenue', value: stats.revenue ? `$${stats.revenue.toFixed(2)}` : '$0.00' },
    { icon: '👥', label: 'Active Users', value: stats.activeUsers || 0 },
  ];

  return (
    <div className="dashboard-stats">
      {statItems.map((item, index) => (
        <div key={index} className="dashboard-stat-card">
          <div className="dashboard-stat-icon">{item.icon}</div>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-value">{item.value}</span>
            <span className="dashboard-stat-label">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}