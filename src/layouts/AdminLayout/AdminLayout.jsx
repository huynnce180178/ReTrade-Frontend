import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../layouts/AdminLayout/AdminLayout.css';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');

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

          <div className="user-dropdown-wrapper" ref={dropdownRef} style={{ marginLeft: '8px' }}>
            <button className="user-profile-trigger" onClick={() => setDropdownOpen(!dropdownOpen)} style={{ padding: '4px 12px 4px 4px', border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: '40px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <div className="avatar-circle" style={{ width: '30px', height: '30px' }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="user-avatar-img" />
                ) : (
                  getInitials()
                )}
              </div>
              <span className="username-text" style={{ fontSize: '13px', fontWeight: '600' }}>{getDisplayName()}</span>
              <span className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▾</span>
            </button>

            {dropdownOpen && (
              <div className="user-dropdown animate-fade-in" style={{ top: '48px', right: 0, position: 'absolute', width: '260px', padding: '12px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', zIndex: 1000 }}>
                <div className="dropdown-user-info">
                  <p className="dropdown-name" style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>{getDisplayName()}</p>
                  <p className="dropdown-email" style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || `@${user.username}`}</p>
                  {user.roles && (
                    <div className="dropdown-roles" style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      {user.roles.map((r, idx) => (
                        <span key={idx} className="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px' }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
                <hr className="dropdown-divider" style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
                <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Profile
                </Link>

                {isSeller && (
                  <Link to="/seller-dashboard" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <span className="material-symbols-outlined item-symbol-icon" style={{ fontSize: '18px', marginRight: '8px' }}>storefront</span>
                    Seller Dashboard
                  </Link>
                )}

                <Link to="/" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <span className="material-symbols-outlined item-symbol-icon" style={{ fontSize: '18px', marginRight: '8px' }}>home</span>
                  Back to Live Site
                </Link>

                <button className="dropdown-item logout-item" onClick={handleLogoutClick}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Logout
                </button>
              </div>
            )}
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

            <Link to="/profile" className="admin-profile-link">
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
