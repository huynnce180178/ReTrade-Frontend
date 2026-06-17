import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SellerDashboard.css';

export default function SellerLayout() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const location = useLocation();
  const navigate = useNavigate();

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');

  if (loading) {
    return (
      <div className="seller-dashboard-loading">
        <span className="btn-spinner"></span>
        <p>Loading Seller Info...</p>
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
          <p>Dashboard</p>
          <button
            type="button"
            className={`seller-menu-btn ${location.pathname === '/seller-dashboard' && activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dashboard');
              navigate('/seller-dashboard');
            }}
          >
            <span className="material-symbols-outlined">dashboard</span>Overview
          </button>
          <button
            type="button"
            className={`seller-menu-btn ${location.pathname === '/seller-dashboard' && activeTab === 'products' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('products');
              navigate('/seller-dashboard');
            }}
          >
            <span className="material-symbols-outlined">inventory_2</span>My Products
          </button>
          <NavLink
            to="/seller-dashboard/sales-statistics"
            className={location.pathname.startsWith('/seller-dashboard/sales-statistics') ? 'active' : ''}
            onClick={() => setActiveTab('sales-statistics')}
          >
            <span className="material-symbols-outlined">monitoring</span>Sales Statistics
          </NavLink>
          <Link to="/auction"><span className="material-symbols-outlined">gavel</span>Auction Room</Link>
          <NavLink
            to="/seller-dashboard/orders"
            className={location.pathname.startsWith('/seller-dashboard/orders') ? 'active' : ''}
            onClick={() => setActiveTab('orders')}
          >
            <span className="material-symbols-outlined">orders</span>Order Management
          </NavLink>
          <p>Personal</p>
          <Link to="/profile"><span className="material-symbols-outlined">person</span>My Profile</Link>
        </nav>
      </aside>

      <main className="seller-dash-main">
        <Outlet context={{ user, activeTab, setActiveTab }} />
      </main>
    </div>
  );
}
