import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import './SellerDashboard.css';

const metrics = [
  { icon: 'payments', label: 'Total Earnings', value: 'VND 142.5M', trend: '+12%' },
  { icon: 'groups', label: 'Total Visitors', value: '12,840', trend: '+8.2%' },
  { icon: 'shopping_cart', label: 'Total Sales', value: '342', trend: '+5.4%' },
  { icon: 'conversion_path', label: 'Conversion Rate', value: '2.68%', trend: '-0.4%', down: true },
];

const revenueBars = [
  ['JUL', 48, 58],
  ['AUG', 38, 54],
  ['SEP', 66, 62],
  ['OCT', 55, 60],
  ['NOV', 70, 65],
  ['DEC', 44, 61],
];

const products = [
  { name: 'Birkin 35 Leather', category: 'Handbags', stock: 'Low - 2', revenue: 'VND 85,000,000', image: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=120&q=80' },
  { name: 'Classic Silk Scarf', category: 'Accessories', stock: 'Normal - 12', revenue: 'VND 12,500,000', image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=120&q=80' },
];

const activities = [
  ['Sale Confirmed', 'Birkin 35 sold', 'New'],
  ['New Highest Bid', 'Classic scarf auction', 'Urgent'],
  ['Customer Message', 'Requesting more photos', '1 hour ago'],
];

export default function SellerDashboard() {
  const { user, loading } = useAuth();
  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');

  if (loading) {
    return (
      <div className="seller-dashboard-loading">
        <span className="btn-spinner"></span>
        <p>Loading seller dashboard...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller) return <Navigate to="/profile" replace />;

  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="seller-dashboard-page">
      <aside className="seller-dash-sidebar">
        <div className="seller-dash-profile">
          <div className="seller-dash-avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} /> : initials}
          </div>
          <h3>{displayName}</h3>
          <span>Pro Seller</span>
        </div>

        <nav className="seller-dash-menu">
          <p>Main Menu</p>
          <Link className="active" to="/seller-dashboard"><span className="material-symbols-outlined">dashboard</span>Dashboard</Link>
          <Link to="/product"><span className="material-symbols-outlined">inventory_2</span>My Products</Link>
          <Link to="/auction"><span className="material-symbols-outlined">gavel</span>Auction Manager</Link>
          <Link to="/purchase-history"><span className="material-symbols-outlined">orders</span>Orders</Link>
          <Link to="/support"><span className="material-symbols-outlined">mail</span>Messages</Link>
          <p>Information</p>
          <Link to="/profile"><span className="material-symbols-outlined">person</span>Personal Information</Link>
          <Link to={`/sellers/${user.userId || user.accountId}`}><span className="material-symbols-outlined">store</span>Shop Manager</Link>
          <Link to="/support"><span className="material-symbols-outlined">help</span>Help</Link>
        </nav>
      </aside>

      <main className="seller-dash-main">
        <header className="seller-dash-header">
          <div>
            <h1>Seller Dashboard</h1>
            <p>Manage your collection and monitor store growth.</p>
          </div>
          <Link className="seller-list-btn" to="/product">
            <span className="material-symbols-outlined">add</span>
            List New Product
          </Link>
        </header>

        <section className="seller-metric-grid">
          {metrics.map((metric) => (
            <article key={metric.label} className="seller-metric-card">
              <div className="seller-metric-top">
                <span className="material-symbols-outlined">{metric.icon}</span>
                <em className={metric.down ? 'down' : ''}>{metric.trend}</em>
              </div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </section>

        <div className="seller-dashboard-grid">
          <section className="seller-panel revenue-panel">
            <div className="seller-panel-header">
              <div>
                <h2>Revenue Analytics</h2>
                <p>Monthly breakdown of actual revenue vs. target</p>
              </div>
              <button type="button">Last 6 Months</button>
            </div>
            <div className="seller-chart">
              {revenueBars.map(([month, revenue, target]) => (
                <div className="seller-chart-month" key={month}>
                  <div className="seller-bars">
                    <span style={{ height: `${revenue}%` }}></span>
                    <span className="target" style={{ height: `${target}%` }}></span>
                  </div>
                  <small>{month}</small>
                </div>
              ))}
            </div>
          </section>

          <aside className="seller-side-stack">
            <section className="seller-panel compact">
              <h2>Shipping Status</h2>
              <div className="seller-shipping-grid">
                <div><strong>03</strong><span>To Ship</span></div>
                <div><strong>08</strong><span>In Transit</span></div>
                <div><strong>142</strong><span>Delivered</span></div>
              </div>
            </section>

            <section className="seller-panel compact">
              <h2>Store Health</h2>
              <div className="seller-health">
                <strong>4.9<span>Rating</span></strong>
                <div>
                  <p><span>Response Rate</span><b>98%</b></p>
                  <p><span>On-time Ship</span><b>94%</b></p>
                </div>
              </div>
            </section>
          </aside>

          <section className="seller-panel performance-panel">
            <div className="seller-panel-header">
              <h2>Product Performance</h2>
              <Link to="/product">Full Inventory</Link>
            </div>
            <div className="seller-product-table">
              {products.map((product) => (
                <div className="seller-product-row" key={product.name}>
                  <img src={product.image} alt={product.name} />
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category}</span>
                  </div>
                  <em className={product.stock.startsWith('Low') ? 'low' : ''}>{product.stock}</em>
                  <b>{product.revenue}</b>
                  <button type="button"><span className="material-symbols-outlined">more_vert</span></button>
                </div>
              ))}
            </div>
          </section>

          <aside className="seller-side-stack">
            <section className="seller-panel compact">
              <div className="seller-panel-header">
                <h2>Recent Activity</h2>
                <button type="button">View</button>
              </div>
              <div className="seller-activity-list">
                {activities.map(([title, detail, tag]) => (
                  <div key={title}>
                    <span className="material-symbols-outlined">notifications</span>
                    <p><strong>{title}</strong><small>{detail}</small></p>
                    <em>{tag}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className="seller-review-card">
              <h2>Latest Review</h2>
              <div className="seller-stars">★★★★★</div>
              <p>"The item arrived in perfect condition. Authentic as described and super fast shipping."</p>
              <span>Minh Hoang</span>
            </section>
          </aside>

          <section className="seller-promo-row">
            <article>
              <span className="material-symbols-outlined">campaign</span>
              <h3>Flash Auction Promotion</h3>
              <p>Your vintage watches collection is currently featured on the homepage.</p>
              <b>2 Days Remaining</b>
            </article>
            <article>
              <span className="material-symbols-outlined">workspace_premium</span>
              <h3>Power Seller Bonus</h3>
              <p>You unlocked 0% commission on your next 5 sales this month.</p>
              <b>3/5 Redeemed</b>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
