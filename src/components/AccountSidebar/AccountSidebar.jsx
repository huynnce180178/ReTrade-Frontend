import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './AccountSidebar.css';

export default function AccountSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const isAdmin = user?.roles?.includes('Admin') || false;
  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');

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

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const isActiveSection = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`) ? 'active' : '';
  };

  return (
    <aside className="profile-sidebar glass-panel">
      <div className="profile-avatar-section">
        <div className="large-avatar-circle">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="large-avatar-img" />
          ) : (
            getInitials()
          )}
        </div>
        <h3>{getDisplayName()}</h3>
        <p className="profile-username-tag">@{user.username}</p>
        {user.roles && (
          <div className="profile-role-badges">
            {user.roles.map((role, index) => (
              <span key={index} className="badge badge-success">{role}</span>
            ))}
          </div>
        )}
      </div>

      <hr className="profile-divider" />

      <nav className="profile-sidebar-menu">
        <p className="sidebar-group-title">Account</p>
        <Link to="/profile" className={`menu-item ${isActive('/profile')}`}>
          <span className="material-symbols-outlined">account_circle</span>
          Profile
        </Link>
        <Link to="/change-password" className={`menu-item ${isActive('/change-password')}`}>
          <span className="material-symbols-outlined">shield_lock</span>
          Change Password
        </Link>
        <Link to="/address-book" className={`menu-item ${isActive('/address-book')}`}>
          <span className="material-symbols-outlined">location_on</span>
          Address Book
        </Link>

        {isSeller && (
          <Link to="/seller-dashboard" className={`menu-item ${isActive('/seller-dashboard')}`}>
            <span className="material-symbols-outlined">storefront</span>
            Seller Dashboard
          </Link>
        )}

        <p className="sidebar-group-title mt-4">Activity</p>
        <Link to="/purchase-history" className={`menu-item ${isActiveSection('/purchase-history')}`}>
          <span className="material-symbols-outlined">receipt_long</span>
          Purchase History
        </Link>
        <Link to="/bid-history" className={`menu-item ${isActive('/bid-history')}`}>
          <span className="material-symbols-outlined">gavel</span>
          Bid History
        </Link>

        {isAdmin && (
          <>
            <p className="sidebar-group-title mt-4">Management</p>
            <Link to="/category" className={`menu-item ${isActive('/category')}`}>
              <span className="material-symbols-outlined">category</span>
              Categories
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
