import React, { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../layouts/AdminLayout/AdminLayout.css';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <span className="btn-spinner"></span>
        <p>Loading Admin Space...</p>
      </div>
    );
  }

  // Role Protection Guard: Only Admin role allowed
  if (!user || !user.roles?.includes('Admin')) {
    return <Navigate to="/login" replace />;
  }

  const handleLogoutClick = () => {
    logout();
    navigate('/');
  };

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  return (
    <div className="admin-layout animate-fade-in">
      {/* Admin Header Bar */}
      <header className="admin-header">
        <div className="admin-header-left">
          <Link to="/" className="admin-logo-text">RETRADE</Link>
        </div>

        <div className="admin-header-center">
          <div className="admin-search-wrapper">
            <span className="material-symbols-outlined admin-search-icon">search</span>
            <input 
              type="text" 
              className="admin-search-input" 
              placeholder="Search platform..." 
              disabled
            />
          </div>
        </div>

        <div className="admin-header-right">
          <Link to="/" className="btn-view-live">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>open_in_new</span>
            View Live Site
          </Link>

          <button className="admin-icon-btn">
            <span className="material-symbols-outlined">notifications</span>
          </button>

          <button className="admin-icon-btn">
            <span className="material-symbols-outlined">settings</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '8px' }}>
            <div className="avatar-circle" style={{ width: '36px', height: '36px' }}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Admin Avatar" className="admin-avatar-img" />
              ) : (
                <div className="admin-avatar-placeholder">{getInitials()}</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Admin Workspace Grid */}
      <div className="admin-workspace">
        {/* Admin Left Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-top">
            <div className="admin-profile-header">
              <div className="admin-shield-icon">
                <span className="material-symbols-outlined">admin_panel_settings</span>
              </div>
              <div className="admin-title-group">
                <h3>RETRADE Admin</h3>
                <p>Platform Controller</p>
              </div>
            </div>

            <nav className="admin-sidebar-menu">
              <NavLink 
                to="/admin/dashboard" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">dashboard</span>
                Dashboard
              </NavLink>

              <NavLink 
                to="/admin/users" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">group</span>
                User Accounts
              </NavLink>

              <NavLink 
                to="/admin/category" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">category</span>
                Category Management
              </NavLink>

              <NavLink 
                to="/admin/listings" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">rule</span>
                Listing Approval
              </NavLink>

              <NavLink 
                to="/admin/auctions" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">gavel</span>
                Auction Control
              </NavLink>

              <NavLink 
                to="/admin/promos" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">campaign</span>
                Banners & Promos
              </NavLink>

              <NavLink 
                to="/admin/settings" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">settings_applications</span>
                System Settings
              </NavLink>

              <NavLink 
                to="/admin/audit" 
                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined admin-menu-item-icon">receipt_long</span>
                Audit Logs
              </NavLink>
            </nav>
          </div>

          <div className="admin-sidebar-bottom">
            <div className="system-status-indicator">
              <span className="status-dot"></span>
              <span>System Status: Optimal</span>
            </div>

            <Link to="/my-account" className="admin-profile-link">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>account_box</span>
              Admin Profile
            </Link>

            <button className="admin-logout-btn" onClick={handleLogoutClick}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
              Logout
            </button>
          </div>
        </aside>

        {/* Admin Main Content Area */}
        <main className="admin-content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
