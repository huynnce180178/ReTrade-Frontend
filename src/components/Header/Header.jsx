import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const header = document.querySelector('.site-header');
      if (header) {
        header.classList.toggle('scrolled', window.scrollY > 20);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    logout();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const getInitials = () => {
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (!user) return '';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  return (
    <>
      <header className="site-header glass-panel">
      <div className="header-container">
        <Link to="/" className="header-logo" style={{ textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}>
          <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-primary, #02241B)', letterSpacing: '1px' }}>RETRADE</span>
        </Link>

        <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
        </button>

        <nav className={`header-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/product" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
            Product
          </NavLink>
          <NavLink to="/auction" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
            Auction
          </NavLink>
          <NavLink to="/wishlist" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
            Wishlist
          </NavLink>
          
          <div className="mobile-only-menu-items">
            <div className="search-input-wrapper mobile-search-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="search-icon" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <button className="btn-subscription mobile-sub-btn" onClick={() => { setSubscriptionModalOpen(true); setMobileMenuOpen(false); }}>
              Subscription
            </button>
            {!user ? (
              <div className="mobile-auth-links">
                <Link to="/login" className="btn-login-link nav-link" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Register</Link>
              </div>
            ) : (
              <div className="mobile-auth-links">
                <Link to="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Profile</Link>
                <button className="nav-link logout-item-btn" onClick={handleLogoutClick}>Logout</button>
              </div>
            )}
          </div>
        </nav>

        <div className="header-search desktop-only-search">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-subscription" onClick={() => setSubscriptionModalOpen(true)}>
            <span className="sub-glow"></span>
            Subscription
          </button>

          <div className="notification-wrapper" ref={notifRef}>
            <button className="icon-btn notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
              <svg className="bell-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span className="notif-badge">3</span>
            </button>

            {notifOpen && (
              <div className="notif-dropdown animate-fade-in">
                <div className="notif-header">
                  <h4>Notifications</h4>
                  <button className="text-btn">Mark all read</button>
                </div>
                <div className="notif-list">
                  <div className="notif-item unread">
                    <p className="notif-text">Your item <strong>Vespa Sprint 2022</strong> has a new auction bid!</p>
                    <span className="notif-time">2 mins ago</span>
                  </div>
                  <div className="notif-item unread">
                    <p className="notif-text">Welcome to ReTrade! Get verified to start listing products.</p>
                    <span className="notif-time">1 hour ago</span>
                  </div>
                  <div className="notif-item">
                    <p className="notif-text">Your wishlist item <strong>iPhone 14 Pro Max</strong> drops in price!</p>
                    <span className="notif-time">Yesterday</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="user-dropdown-wrapper" ref={dropdownRef}>
              <button className="user-profile-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="avatar-circle">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="user-avatar-img" />
                  ) : (
                    getInitials()
                  )}
                </div>
                <span className="username-text">{getDisplayName()}</span>
                <span className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▾</span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown animate-fade-in">
                  <div className="dropdown-user-info">
                    <p className="dropdown-name">{getDisplayName()}</p>
                    <p className="dropdown-email">{user.email || `@${user.username}`}</p>
                    {user.roles && (
                      <div className="dropdown-roles">
                        {user.roles.map((r, idx) => (
                          <span key={idx} className="badge badge-success">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <hr className="dropdown-divider" />
                  <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Profile
                  </Link>


                  <button className="dropdown-item logout-item" onClick={handleLogoutClick}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn-login-link">Login</Link>
              <Link to="/register" className="btn btn-primary btn-register-nav">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
      {subscriptionModalOpen && (
        <div className="sub-modal-overlay animate-fade-in" onClick={() => setSubscriptionModalOpen(false)}>
          <div className="sub-modal-container" onClick={(e) => e.stopPropagation()}>
            <button className="sub-modal-close" onClick={() => setSubscriptionModalOpen(false)}>
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="sub-modal-header">
              <h2>Elevate Your Experience</h2>
              <p>Join our inner circle. Choose a plan tailored to your lifestyle, whether you're here to curate your wardrobe or build a fashion empire.</p>
            </div>
            <div className="sub-modal-grid">
              {/* Card 1: Seller Pack */}
              <div className="sub-card">
                <div className="sub-card-header">
                  <div className="sub-icon-wrap seller-bg">
                    <span className="material-symbols-outlined">storefront</span>
                  </div>
                  <h3>Seller Pack</h3>
                  <p>Perfect for rising entrepreneurs.</p>
                </div>
                <div className="sub-price">
                  <span className="price-num">100.000 VND</span>
                  <span className="price-period"> / month</span>
                </div>
                <ul className="sub-features">
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Post products easily</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Sell items effortlessly</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>First listing free</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Create auctions for more visibility</span></li>
                </ul>
                <button className="sub-card-btn primary-btn" onClick={() => { alert('Thank you for choosing Seller Pack!'); setSubscriptionModalOpen(false); }}>
                  Get Started
                </button>
              </div>

              {/* Card 2: Member Pack */}
              <div className="sub-card featured-card">
                <div className="popular-badge">POPULAR</div>
                <div className="sub-card-header">
                  <div className="sub-icon-wrap member-bg">
                    <span className="material-symbols-outlined">workspace_premium</span>
                  </div>
                  <h3>Member Pack</h3>
                  <p>Enhance your shopping journey.</p>
                </div>
                <div className="sub-price">
                  <span className="price-num">50.000 VND</span>
                  <span className="price-period"> / month</span>
                </div>
                <ul className="sub-features">
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Monthly vouchers</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Purchase products at discounted prices</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Shipping fee discounts</span></li>
                </ul>
                <button className="sub-card-btn white-btn" onClick={() => { alert('Thank you for subscribing to Member Pack!'); setSubscriptionModalOpen(false); }}>
                  Subscribe Now
                </button>
              </div>

              {/* Card 3: Featured Pack */}
              <div className="sub-card dark-card">
                <div className="sub-card-header">
                  <div className="sub-icon-wrap featured-bg">
                    <span className="material-symbols-outlined">stars</span>
                  </div>
                  <h3>Featured Pack</h3>
                  <p>Maximum exposure for your brand.</p>
                </div>
                <div className="sub-price">
                  <span className="price-num">60.000 VND</span>
                  <span className="price-period"> / month</span>
                </div>
                <ul className="sub-features">
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Highlight products at the top of the website</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Homepage feature spotlight</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Highlight auctions</span></li>
                  <li><span className="material-symbols-outlined check-icon">check_circle</span><span>Push notification advertisements for your shop</span></li>
                  <li className="note-li"><p>Note: Exclusive to active Seller Pack subscribers</p></li>
                </ul>
                <button className="sub-card-btn green-btn" onClick={() => { alert('Thank you for upgrading to Featured Pack!'); setSubscriptionModalOpen(false); }}>
                  Upgrade to Featured
                </button>
              </div>
            </div>
            <div className="sub-modal-footer">
              <p>All plans include our Authentication Guarantee. Billed monthly.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
