import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import subscriptionService from '../../services/subscriptionService';
import userSearchService from '../../services/userSearchService';
import chatService from '../../services/chatService';
import { createChatHubConnection } from '../../services/chatRealtimeService';

import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = useRef(null);

  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [activePackages, setActivePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [purchaseLoadingId, setPurchaseLoadingId] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const chatHubRef = useRef(null);
  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const messagesPath = isSeller ? '/seller-dashboard/messages' : '/chat';

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
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch search history (Local Storage)
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('retrade_search_history') || '[]');
    setSearchHistory(history);
  }, []);

  useEffect(() => {
    if (!subscriptionModalOpen) {
      return;
    }

    const loadData = async () => {
      setLoadingPackages(true);
      try {
        if (packages.length === 0) {
          const data = await subscriptionService.getAll();
          setPackages(Array.isArray(data) ? data : []);
        }

        if (user) {
          const myData = await subscriptionService.getMyActiveSubscriptions();
          setActivePackages(Array.isArray(myData) ? myData : []);
        }
      } catch (error) {
        console.error('Failed to load service packages:', error);
        showToast('Failed to load subscription packages.', 'error');
      } finally {
        setLoadingPackages(false);
      }
    };

    loadData();
  }, [subscriptionModalOpen, user, packages.length, showToast]);

  useEffect(() => {
    if (!user) {
      setChatUnreadCount(0);
      return undefined;
    }

    let disposed = false;

    const loadUnread = async () => {
      try {
        const rooms = await chatService.getRooms();
        if (!disposed) {
          setChatUnreadCount((Array.isArray(rooms) ? rooms : []).reduce((sum, room) => sum + (room.unreadCount || 0), 0));
        }
      } catch {
        if (!disposed) setChatUnreadCount(0);
      }
    };

    loadUnread();

    const connection = createChatHubConnection();
    chatHubRef.current = connection;

    const handleNotification = () => {
      if (location.pathname.startsWith(messagesPath)) {
        loadUnread();
        return;
      }
      loadUnread();
    };

    connection.on('ChatNotification', handleNotification);
    connection.onreconnected(() => {
      connection.invoke('JoinUserNotifications').catch(() => {});
      loadUnread();
    });
    connection.start()
      .then(() => connection.invoke('JoinUserNotifications'))
      .catch(() => {});

    return () => {
      disposed = true;
      connection.off('ChatNotification', handleNotification);
      connection.stop().catch(() => {});
    };
  }, [location.pathname, messagesPath, user]);

  const handleLogoutClick = () => {
    logout();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const isValidAvatarUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (
      !trimmed ||
      trimmed === 'Avatar' ||
      trimmed === 'Profile' ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed === '[object Object]'
    ) {
      return false;
    }
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/')
    );
  };

  const getInitials = () => {
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2).toUpperCase();
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = () => {
    if (!user) return '';
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value || 0);

  const getPackageVisual = (serviceId) => {
    switch (serviceId) {
      case 'SERVICE_UPGRADE_SELLER':
      case 'sub_20260701_100001':
        return {
          cardClass: 'sub-card featured-card',
          iconWrapClass: 'sub-icon-wrap member-bg',
          icon: 'storefront',
          tagline: 'Unlock your selling journey on ReTrade.',
          buttonClass: 'sub-card-btn white-btn',
          note: ''
        };
      case 'SERVICE_VOUCHER_FEATURE':
      case 'sub_20260701_100002':
        return {
          cardClass: 'sub-card featured-card',
          iconWrapClass: 'sub-icon-wrap member-bg',
          icon: 'workspace_premium',
          tagline: 'Receive 30 exclusive discount & freeship vouchers for 30 days of shopping.',
          buttonClass: 'sub-card-btn primary-btn',
          note: ''
        };
      case 'SERVICE_PRIORITY_LISTING':
      case 'sub_20260701_100003':
        return {
          cardClass: 'sub-card dark-card',
          iconWrapClass: 'sub-icon-wrap featured-bg',
          icon: 'stars',
          tagline: 'Increase visibility and priority on the interface.',
          buttonClass: 'sub-card-btn green-btn',
          note: ''
        };
      default:
        return {
          cardClass: 'sub-card',
          iconWrapClass: 'sub-icon-wrap seller-bg',
          icon: 'workspace_premium',
          tagline: 'Subscription package for your account.',
          buttonClass: 'sub-card-btn primary-btn',
          note: ''
        };
    }
  };

  const getFeatureLines = (pkg) =>
    (pkg.benefitsDescription || '')
      .split(/[.;]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handlePurchasePackage = async (serviceId) => {
    if (!user) {
      showToast('Please login to purchase a subscription package.', 'warning');
      setSubscriptionModalOpen(false);
      navigate('/login');
      return;
    }

    setPurchaseLoadingId(serviceId);
    try {
      const result = await subscriptionService.purchase(serviceId);
      if (!result?.paymentUrl) {
        throw new Error('Failed to create payment link.');
      }

      window.location.href = result.paymentUrl;
    } catch (error) {
      console.error('Failed to create payment url:', error);
      const message = error.response?.data?.message || error.response?.data || error.message || 'Failed to create VNPAY payment.';
      showToast(String(message), 'error');
    } finally {
      setPurchaseLoadingId('');
    }
  };

  const saveSearchToHistory = (keyword) => {
    if (!keyword) return;
    const history = JSON.parse(localStorage.getItem('retrade_search_history') || '[]');
    const newHistory = [keyword, ...history.filter(item => item !== keyword)].slice(0, 6);
    localStorage.setItem('retrade_search_history', JSON.stringify(newHistory));
    setSearchHistory(newHistory);
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    saveSearchToHistory(searchTerm.trim());

    if (user) {
      try {
        await userSearchService.addSearch(searchTerm.trim());
      } catch {
        // Ignore
      }
    }
    
    setShowHistory(false);
    navigate(`/product?search=${encodeURIComponent(searchTerm.trim())}`);
  };

  const handleHistoryClick = (keyword) => {
    setSearchTerm(keyword);
    saveSearchToHistory(keyword);
    setShowHistory(false);
    navigate(`/product?search=${encodeURIComponent(keyword)}`);
  };

  const handleDeleteHistory = async (e, keyword) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(item => item !== keyword);
    localStorage.setItem('retrade_search_history', JSON.stringify(newHistory));
    setSearchHistory(newHistory);
  };

  const handleClearAllHistory = async (e) => {
    e.stopPropagation();
    localStorage.removeItem('retrade_search_history');
    setSearchHistory([]);
    if (user) {
      try {
        await userSearchService.clearAll();
      } catch {
        // Ignore
      }
    }
  };

  return (
    <>
      <header className="site-header glass-panel">
        <div className="header-container">
          <div className="header-left">
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
              <NavLink to="/category" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
                Category
              </NavLink>
              <NavLink to="/wishlist" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} onClick={() => setMobileMenuOpen(false)}>
                Wishlist
              </NavLink>
              {user && (
                <NavLink to={messagesPath} className={({ isActive }) => isActive ? "nav-link active nav-chat-link" : "nav-link nav-chat-link"} onClick={() => { setMobileMenuOpen(false); setChatUnreadCount(0); }}>
                  Messages
                  {chatUnreadCount > 0 && <span className="nav-chat-badge">{chatUnreadCount}</span>}
                </NavLink>
              )}

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
                    <Link to={messagesPath} className="nav-link nav-chat-link" onClick={() => { setMobileMenuOpen(false); setChatUnreadCount(0); }}>
                      Messages
                      {chatUnreadCount > 0 && <span className="nav-chat-badge">{chatUnreadCount}</span>}
                    </Link>
                    {isSeller && <Link to="/seller-dashboard" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Seller Dashboard</Link>}
                    <button className="nav-link logout-item-btn" onClick={handleLogoutClick}>Logout</button>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <form className="header-search desktop-only-search" onSubmit={handleSearchSubmit} ref={searchRef} style={{ position: 'relative' }}>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => searchHistory.length > 0 && setShowHistory(true)}
                placeholder="Search products..."
              />
              <button type="submit" className="search-btn-inside">
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffffff', fontWeight: 'bold' }}>search</span>
              </button>
            </div>

            {/* Search History Dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <div className="search-history-dropdown">
                <div className="search-history-header">
                  <span>Recent Searches</span>
                  <button type="button" className="search-history-clear-all" onClick={handleClearAllHistory}>Clear All</button>
                </div>
                {searchHistory.map((item, index) => (
                  <div
                    key={index}
                    className="search-history-item"
                    onClick={() => handleHistoryClick(item)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span className="search-history-keyword">{item}</span>
                    <button
                      type="button"
                      className="search-history-delete"
                      onClick={(e) => handleDeleteHistory(e, item)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>

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
                    {isValidAvatarUrl(user?.avatarUrl) && !avatarError ? (
                      <img
                        src={user.avatarUrl}
                        alt="Avatar"
                        className="user-avatar-img"
                        onError={() => setAvatarError(true)}
                      />
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

                    {isSeller && (
                      <Link to="/seller-dashboard" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <span className="material-symbols-outlined item-symbol-icon">storefront</span>
                        Seller Dashboard
                      </Link>
                    )}

                    <Link to={messagesPath} className="dropdown-item" onClick={() => { setDropdownOpen(false); setChatUnreadCount(0); }}>
                      <span className="material-symbols-outlined item-symbol-icon">forum</span>
                      Messages
                      {chatUnreadCount > 0 && <span className="dropdown-chat-badge">{chatUnreadCount}</span>}
                    </Link>

                    {user.roles?.includes('Admin') && (
                      <Link to="/admin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                        Admin Panel
                      </Link>
                    )}


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
              <h2>Elevate your experience</h2>
              <p>Choose a subscription package suitable for your role and pay immediately with VNPAY.</p>
            </div>
            <div className="sub-modal-grid">
              {loadingPackages ? (
                <div className="sub-loading-state">Loading subscription packages...</div>
              ) : packages.length === 0 ? (
                <div className="sub-empty-state">No subscription packages to display.</div>
              ) : (
                packages.map((pkg, index) => {
                  const visual = getPackageVisual(pkg.serviceId);
                  const featureLines = getFeatureLines(pkg);
                  const activePackage = activePackages.find(a => a.serviceId === pkg.serviceId);

                  let daysLeft = 0;
                  if (activePackage && activePackage.endDate) {
                    const diffTime = Math.abs(new Date(activePackage.endDate) - new Date());
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  return (
                    <div key={pkg.serviceId} className={visual.cardClass}>
                      {(pkg.serviceId === 'SERVICE_UPGRADE_SELLER' || pkg.serviceId === 'sub_20260701_100001') && <div className="popular-badge">POPULAR</div>}
                      <div className="sub-card-header">
                        <div className={visual.iconWrapClass}>
                          <span className="material-symbols-outlined">{visual.icon}</span>
                        </div>
                        <h3>{pkg.name}</h3>
                        <p>{visual.tagline}</p>
                      </div>
                      <div className="sub-role-badge">Target: {pkg.targetRole}</div>
                      <div className="sub-price">
                        <span className="price-num">{formatCurrency(pkg.price)}</span>
                        <span className="price-period"> / {pkg.durationDays} days</span>
                      </div>
                      <ul className="sub-features">
                        {featureLines.map((feature, featureIndex) => (
                          <li key={`${pkg.serviceId}-${featureIndex}`}>
                            <span className="material-symbols-outlined check-icon">check_circle</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                        {visual.note && (
                          <li className="note-li"><p>{visual.note}</p></li>
                        )}
                      </ul>

                      {activePackage ? (
                        <button className="sub-card-btn white-btn active-package-btn" disabled>
                          <span className="material-symbols-outlined">verified</span>
                          Activated ({daysLeft} days left)
                        </button>
                      ) : (user && user.roles && !user.roles.includes(pkg.targetRole)) ? (
                        <button
                          className={`${visual.buttonClass} role-blocked-btn`}
                          disabled
                          style={{ opacity: 0.5, cursor: 'not-allowed', padding: '10px' }}
                          title={`This package is only available for ${pkg.targetRole} role`}
                        >
                          Requires purchasing {pkg.targetRole} package to buy this
                        </button>
                      ) : (
                        <button
                          className={visual.buttonClass}
                          disabled={purchaseLoadingId === pkg.serviceId}
                          onClick={() => handlePurchasePackage(pkg.serviceId)}
                        >
                          {purchaseLoadingId === pkg.serviceId ? 'Redirecting to VNPAY...' : 'Buy via VNPAY'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
