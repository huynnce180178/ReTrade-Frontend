import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/SellerDashboard.css';

export default function SellerLayout() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="seller-dashboard-page">
      {/* Mobile Top Header */}
      <div className="seller-mobile-header">
        <button className="seller-mobile-toggle" onClick={() => setIsSidebarOpen(true)}>
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h2>Seller Dashboard</h2>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="seller-sidebar-overlay" onClick={closeSidebar}></div>
      )}

      <aside className={`seller-dash-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <button className="seller-sidebar-close" onClick={closeSidebar}>
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="seller-dash-profile">
          <div className="seller-dash-avatar">
            {user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} /> : initials}
          </div>
          <h3>{displayName}</h3>
          <span>Pro Seller</span>
        </div>

        <nav className="seller-dash-menu">
          <p>Dashboard</p>
          <NavLink
            to="/seller-dashboard"
            end
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">dashboard</span>Overview
          </NavLink>
          <NavLink
            to="/seller-dashboard/products"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${location.pathname.includes('/seller-dashboard/products') ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">inventory_2</span>My Products
          </NavLink>
          <NavLink
            to="/seller-dashboard/sales-statistics"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">monitoring</span>Sales Statistics
          </NavLink>
          <Link to="/auction" onClick={closeSidebar}><span className="material-symbols-outlined">gavel</span>Auction Room</Link>
          <NavLink
            to="/seller-dashboard/orders"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${location.pathname.includes('/seller-dashboard/orders') ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">orders</span>Order Management
          </NavLink>
          <p>Personal</p>
          <Link to="/profile" onClick={closeSidebar}><span className="material-symbols-outlined">person</span>My Profile</Link>
        </nav>
      </aside>

      <main className="seller-dash-main">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
