import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotification } from '../../context/NotificationContext';
import subscriptionService from '../../services/subscriptionService';
import userSearchService from '../../services/userSearchService';
import chatService from '../../services/chatService';
import { createChatHubConnection } from '../../services/chatRealtimeService';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import { formatNotificationContent } from '../../utils/notificationUtils';

import './Header.css';

const SEARCH_HISTORY_KEY = 'retrade_search_history';

const normalizeSearchTerm = (entry) => {
  if (typeof entry === 'string') return entry.trim();
  return (entry?.keyword || entry?.Keyword || '').trim();
};

const normalizeSearchHistory = (data) => {
  const raw = Array.isArray(data) ? data : (data?.items || data?.value || []);
  return raw
    .map((entry) => {
      const keyword = normalizeSearchTerm(entry);
      if (!keyword) return null;
      return {
        ...((typeof entry === 'object' && entry !== null) ? entry : {}),
        searchId: entry?.searchId || entry?.SearchId || entry?.id || entry?.Id || null,
        keyword,
      };
    })
    .filter(Boolean);
};

const readLocalSearchHistory = () => {
  try {
    return normalizeSearchHistory(JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'));
  } catch {
    return [];
  }
};

const saveLocalSearchTerm = (term) => {
  const keyword = term.trim();
  if (!keyword) return readLocalSearchHistory();
  const next = [
    { keyword },
    ...readLocalSearchHistory().filter((item) => item.keyword.toLowerCase() !== keyword.toLowerCase()),
  ].slice(0, 20);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next.map((item) => item.keyword)));
  return next;
};

const removeLocalSearchTerm = (term) => {
  const keyword = term.trim().toLowerCase();
  const next = readLocalSearchHistory().filter((item) => item.keyword.toLowerCase() !== keyword);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next.map((item) => item.keyword)));
  return next;
};

export default function Header() {
  const { user, logout } = useAuth();
  const { t, language, formatCurrency } = useLanguage();
  const { unreadCount, notifications, markAsRead, markAllAsRead, deleteNotification } = useNotification();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search History
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Subscription Modal
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [activePackages, setActivePackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [purchaseLoadingId, setPurchaseLoadingId] = useState(null);

  // Unread chat messages count
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const searchRef = useRef(null);
  const packagesLoadedRef = useRef(false);

  // Close dropdowns on outside click or Escape key
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
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNotifOpen(false);
        setShowHistory(false);
        setSubscriptionModalOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch search history (API for logged-in users, local fallback for guests)
  useEffect(() => {
    let disposed = false;

    const loadSearchHistory = async () => {
      if (user) {
        try {
          const history = await userSearchService.getHistory();
          if (!disposed) setSearchHistory(normalizeSearchHistory(history));
          return;
        } catch {
          // Fall back to local history if the API is temporarily unavailable.
        }
      }
      if (!disposed) setSearchHistory(readLocalSearchHistory());
    };

    loadSearchHistory();
    return () => {
      disposed = true;
    };
  }, [user]);


  useEffect(() => {
    if (!subscriptionModalOpen) {
      return;
    }

    const loadData = async () => {
      setLoadingPackages(true);
      try {
        if (!packagesLoadedRef.current) {
          const data = await subscriptionService.getAll();
          setPackages(Array.isArray(data) ? data : []);
          packagesLoadedRef.current = true;
        }

        if (user) {
          const myData = await subscriptionService.getMyActiveSubscriptions();
          setActivePackages(Array.isArray(myData) ? myData : []);
        }
      } catch (error) {
        console.error('Failed to load subscription packages:', error);
      } finally {
        setLoadingPackages(false);
      }
    };

    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionModalOpen]);

  useEffect(() => {
    if (!user) {
      setChatUnreadCount(0);
      return undefined;
    }

    const fetchInitialUnread = async () => {
      try {
        const total = await chatService.getUnreadCount();
        setChatUnreadCount(total);
      } catch {
        // Silently fail
      }
    };

    fetchInitialUnread();

    const connection = createChatHubConnection();
    let isSubscribed = true;

    connection.on('ReceiveMessage', (message) => {
      if (!isSubscribed) return;
      const uId = user.userId || user.id;
      if (message && message.senderId !== uId) {
        setChatUnreadCount((prev) => prev + 1);
      }
    });

    connection.start().catch(() => { });

    return () => {
      isSubscribed = false;
      connection.stop().catch(() => { });
    };
  }, [user]);

  const persistSearchTerm = async (term) => {
    const localHistory = saveLocalSearchTerm(term);
    setSearchHistory(localHistory);

    if (!user) return;
    try {
      await userSearchService.saveSearch(term);
      const history = await userSearchService.getHistory();
      setSearchHistory(normalizeSearchHistory(history));
    } catch {
      // Search navigation should still work even if saving history fails.
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;

    persistSearchTerm(term);

    setShowHistory(false);
    navigate(`/product?search=${encodeURIComponent(term)}`);
  };

  const handleSelectHistoryItem = (entry) => {
    const term = normalizeSearchTerm(entry);
    if (!term) return;
    setSearchQuery(term);
    setShowHistory(false);
    persistSearchTerm(term);
    navigate(`/product?search=${encodeURIComponent(term)}`);
  };

  const handleRemoveHistoryItem = async (e, entry) => {
    e.stopPropagation();
    const term = normalizeSearchTerm(entry);
    const searchId = entry?.searchId || entry?.SearchId || entry?.id || entry?.Id;

    setSearchHistory((current) => current.filter((item) => normalizeSearchTerm(item).toLowerCase() !== term.toLowerCase()));
    removeLocalSearchTerm(term);

    if (user && searchId) {
      try {
        await userSearchService.deleteSearch(searchId);
      } catch {
        // Keep optimistic UI; next load will resync.
      }
    }
  };

  const handleClearAllHistory = async (e) => {
    e.stopPropagation();
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setSearchHistory([]);
    if (user) {
      try {
        await userSearchService.clearAll();
      } catch {
        // Keep UI cleared locally.
      }
    }
  };

  const handleLogoutClick = () => {
    logout();
    showToast(t('toast.logout_success'), 'info');
    navigate('/login');
  };

  const getInitials = () => {
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
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

  const getPackageVisual = (serviceId) => {
    switch (serviceId) {
      case 'SERVICE_UPGRADE_SELLER':
      case 'sub_20260701_100001':
        return {
          cardClass: 'sub-card featured-card',
          iconWrapClass: 'sub-icon-wrap member-bg',
          icon: 'storefront',
          tagline: t('subscriptions.tagline_seller'),
          buttonClass: 'sub-card-btn white-btn',
          note: ''
        };
      case 'SERVICE_VOUCHER_FEATURE':
      case 'sub_20260701_100002':
        return {
          cardClass: 'sub-card featured-card',
          iconWrapClass: 'sub-icon-wrap member-bg',
          icon: 'workspace_premium',
          tagline: t('subscriptions.tagline_voucher'),
          buttonClass: 'sub-card-btn primary-btn',
          note: ''
        };
      case 'SERVICE_PRIORITY_LISTING':
      case 'sub_20260701_100003':
        return {
          cardClass: 'sub-card dark-card',
          iconWrapClass: 'sub-icon-wrap featured-bg',
          icon: 'stars',
          tagline: t('subscriptions.tagline_priority'),
          buttonClass: 'sub-card-btn green-btn',
          note: ''
        };
      default:
        return {
          cardClass: 'sub-card',
          iconWrapClass: 'sub-icon-wrap seller-bg',
          icon: 'workspace_premium',
          tagline: t('subscriptions.tagline_default'),
          buttonClass: 'sub-card-btn primary-btn',
          note: ''
        };
    }
  };

  const getFeatureLines = (pkg) =>
    (pkg?.benefitsDescription || '')
      .split(/[.;]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handlePurchasePackage = async (serviceId) => {
    if (!user) {
      showToast(t('auth.login_title'), 'warning');
      setSubscriptionModalOpen(false);
      navigate('/login');
      return;
    }

    setPurchaseLoadingId(serviceId);
    try {
      const response = await subscriptionService.purchase(serviceId);
      const targetUrl = response?.paymentUrl || response?.url || (typeof response === 'string' ? response : null);
      if (targetUrl && typeof targetUrl === 'string' && targetUrl.startsWith('http')) {
        window.location.href = targetUrl;
      } else {
        showToast(language === 'vi' ? 'Không thể tạo liên kết thanh toán VNPAY.' : 'Failed to create VNPAY payment URL', 'error');
      }
    } catch (err) {
      console.error('Package purchase error:', err);
      const serverErr = err?.response?.data;
      let msg = '';
      if (typeof serverErr === 'string') {
        msg = serverErr;
      } else if (serverErr?.message) {
        msg = serverErr.message;
      } else if (serverErr?.title) {
        msg = serverErr.title;
      } else {
        msg = err?.message || t('common.error_occurred');
      }
      showToast(msg, 'error');
    } finally {
      setPurchaseLoadingId(null);
    }
  };

  const messagesPath = user?.roles?.includes('Seller') ? '/seller-dashboard/messages' : '/chat';

  return (
    <>
      <header className={`site-header ${location.pathname === '/' ? 'is-home' : ''}`}>
        <div className="header-container">

          {/* Logo & Mobile Menu Toggle */}
          <div className="header-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>

            <Link to="/" className="header-logo">
              <span>RETRADE</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className={`header-nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/product" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {t('nav.product')}
            </NavLink>
            <NavLink to="/auction" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {t('nav.auction')}
            </NavLink>
            <NavLink to="/category" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {t('nav.category')}
            </NavLink>
            <NavLink to="/wishlist" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {t('nav.wishlist')}
            </NavLink>
            <NavLink to={messagesPath} className={({ isActive }) => `nav-link nav-chat-link ${isActive ? 'active' : ''}`} onClick={() => { setMobileMenuOpen(false); setChatUnreadCount(0); }}>
              {t('nav.chat')}
              {chatUnreadCount > 0 && <span className="nav-chat-badge">{chatUnreadCount}</span>}
            </NavLink>

            {/* Mobile Drawer Actions */}
            <div className="mobile-drawer-footer">
              <LanguageSwitcher className="mobile-lang-switcher" />
              {user ? (
                <div className="mobile-user-info">
                  <div className="avatar-circle">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="user-avatar-img" />
                    ) : (
                      getInitials()
                    )}
                  </div>
                  <span className="mobile-username">{getDisplayName()}</span>
                </div>
              ) : (
                <div className="mobile-auth-btns">
                  <Link to="/login" className="btn btn-outline" onClick={() => setMobileMenuOpen(false)}>{t('nav.login')}</Link>
                  <Link to="/register" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>{t('nav.register')}</Link>
                </div>
              )}
            </div>
          </nav>

          {/* Search Bar */}
          <div className="header-search" ref={searchRef}>
            <form onSubmit={handleSearchSubmit}>
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('common.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                />
                <button type="submit" className="search-btn-inside" aria-label={t('common.search')}>
                  <span className="material-symbols-outlined">search</span>
                </button>
              </div>
            </form>

            {showHistory && searchHistory.length > 0 && (
              <div className="search-history-dropdown">
                <div className="search-history-header">
                  <span>{language === 'vi' ? 'Lịch sử tìm kiếm' : 'Search History'}</span>
                  <button type="button" onClick={handleClearAllHistory} className="search-history-clear-all">
                    {language === 'vi' ? 'Xóa tất cả' : 'Clear all'}
                  </button>
                </div>
                <ul className="search-history-list">
                  {searchHistory.map((entry, index) => {
                    const term = normalizeSearchTerm(entry);
                    const key = entry?.searchId || entry?.SearchId || entry?.id || entry?.Id || `${term}-${index}`;
                    return (
                    <li key={key} className="search-history-item" onClick={() => handleSelectHistoryItem(entry)}>
                      <span className="material-symbols-outlined history-icon">history</span>
                      <span className="search-history-keyword">{term}</span>
                      <button
                        type="button"
                        className="search-history-delete"
                        onClick={(e) => handleRemoveHistoryItem(e, entry)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Desktop Right Actions */}
          <div className="header-actions">

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Subscription Upgrade Button */}
            <button
              className="btn-subscription"
              onClick={() => setSubscriptionModalOpen(true)}
            >
              <span className="sub-glow"></span>
              {t('nav.my_subscriptions')}
            </button>

            {/* Notifications Dropdown */}
            <div className="notification-wrapper" ref={notifRef}>
              <button
                className="icon-btn"
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header">
                    <h4>{t('nav.notifications')}</h4>
                    {unreadCount > 0 && (
                      <button className="text-btn" onClick={markAllAsRead}>
                        {language === 'vi' ? 'Đánh dấu tất cả đã đọc' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length > 0 ? (
                      notifications.map((item) => {
                        const { translatedTitle, translatedMessage } = formatNotificationContent(item.title, item.message || item.content, language);
                        return (
                          <div
                            key={item.notificationId || item.id}
                            className={`notif-item ${!item.isRead ? 'unread' : ''}`}
                            onClick={() => markAsRead(item.notificationId || item.id)}
                          >
                            <div className="notif-content-wrap">
                              <div className="notif-title">{translatedTitle}</div>
                              <div className="notif-text">{translatedMessage}</div>
                              <div className="notif-time">
                                {item.createdAt ? new Date(item.createdAt).toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : (language === 'vi' ? 'Vừa xong' : 'Just now')}
                              </div>
                            </div>
                            <button
                              className="notif-delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(item.notificationId || item.id);
                              }}
                              title={language === 'vi' ? 'Xóa' : 'Delete'}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="notif-empty">{t('common.no_data')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Account / Profile Dropdown */}
            {user ? (
              <div className="user-dropdown-wrapper" ref={dropdownRef}>
                <button
                  className="user-profile-trigger"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                >
                  <div className="avatar-circle">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="user-avatar-img" />
                    ) : (
                      getInitials()
                    )}
                  </div>
                  <span className="username-text">{getDisplayName()}</span>
                  <span className={`material-symbols-outlined dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>
                    expand_more
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="user-dropdown">
                    <div className="dropdown-user-info">
                      <div className="dropdown-name">{getDisplayName()}</div>
                      <div className="dropdown-email">{user.email}</div>
                    </div>
                    <hr className="dropdown-divider" />

                    {(user.roles?.some((r) => String(r).toLowerCase() === 'seller') || user.roles?.includes('Seller')) && (
                      <Link to="/seller-dashboard" className="dropdown-item dropdown-item-highlight seller-highlight" onClick={() => setDropdownOpen(false)}>
                        <span className="material-symbols-outlined item-symbol-icon">storefront</span>
                        <span>{t('nav.seller_center')}</span>
                        <span className="highlight-badge">Seller</span>
                      </Link>
                    )}

                    {(user.roles?.some((r) => String(r).toLowerCase() === 'admin') || user.roles?.includes('Admin')) && (
                      <Link to="/admin" className="dropdown-item dropdown-item-highlight admin-highlight" onClick={() => setDropdownOpen(false)}>
                        <span className="material-symbols-outlined item-symbol-icon">admin_panel_settings</span>
                        <span>{t('nav.admin_center')}</span>
                        <span className="highlight-badge admin-tag">Admin</span>
                      </Link>
                    )}

                    <Link to="/my-account" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <span className="material-symbols-outlined item-symbol-icon">person</span>
                      {t('nav.profile')}
                    </Link>

                    <Link to="/address-book" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <span className="material-symbols-outlined item-symbol-icon">location_on</span>
                      {t('nav.address_book')}
                    </Link>

                    <Link to="/purchase-history" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <span className="material-symbols-outlined item-symbol-icon">shopping_bag</span>
                      {t('nav.purchase_history')}
                    </Link>

                    <Link to="/bid-history" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <span className="material-symbols-outlined item-symbol-icon">gavel</span>
                      {t('nav.bid_history')}
                    </Link>

                    <Link to="/refund-history" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <span className="material-symbols-outlined item-symbol-icon">currency_exchange</span>
                      {t('nav.refund_history')}
                    </Link>

                    <Link to={messagesPath} className="dropdown-item" onClick={() => { setDropdownOpen(false); setChatUnreadCount(0); }}>
                      <span className="material-symbols-outlined item-symbol-icon">forum</span>
                      {t('nav.chat')}
                      {chatUnreadCount > 0 && <span className="dropdown-chat-badge">{chatUnreadCount}</span>}
                    </Link>

                    <button className="dropdown-item logout-item" onClick={handleLogoutClick}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="item-icon">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn-login-link">{t('nav.login')}</Link>
                <Link to="/register" className="btn btn-primary btn-register-nav">{t('nav.register')}</Link>
              </div>
            )}
          </div>
        </div>
      </header>
      {subscriptionModalOpen && (
        <div className="sub-modal-overlay animate-fade-in" onClick={() => setSubscriptionModalOpen(false)}>
          <div className="sub-modal-container" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sub-modal-title">
            <button className="sub-modal-close" onClick={() => setSubscriptionModalOpen(false)} aria-label={t('common.close')}>
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="sub-modal-header">
              <h2 id="sub-modal-title">{t('subscriptions.title')}</h2>
              <p>{t('subscriptions.subtitle')}</p>
            </div>
            <div className="sub-modal-grid">
              {loadingPackages ? (
                <div className="sub-loading-state">{t('subscriptions.loading')}</div>
              ) : packages.length === 0 ? (
                <div className="sub-empty-state">{t('subscriptions.empty')}</div>
              ) : (
                packages.map((pkg) => {
                  if (!pkg) return null;
                  const visual = getPackageVisual(pkg.serviceId);
                  const featureLines = getFeatureLines(pkg);
                  const activePackage = activePackages.find(a => a?.serviceId === pkg.serviceId);

                  let daysLeft = 0;
                  if (activePackage && activePackage.endDate) {
                    const diffTime = Math.abs(new Date(activePackage.endDate) - new Date());
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  const pkgNameStr = String(pkg.name || '');
                  const pkgServiceIdStr = String(pkg.serviceId || '');
                  const pkgNameLower = pkgNameStr.toLowerCase();
                  const pkgServiceIdLower = pkgServiceIdStr.toLowerCase();

                  let displayName = pkgNameStr;
                  if (language === 'vi') {
                    if (pkgServiceIdLower.includes('seller') || pkgServiceIdLower === 'sub_20260701_100001' || pkgNameLower.includes('seller')) {
                      displayName = 'Gói Nâng Cấp Người Bán';
                    } else if (pkgServiceIdLower.includes('voucher') || pkgServiceIdLower === 'sub_20260701_100002' || pkgNameLower.includes('voucher')) {
                      displayName = 'Gói Voucher Ưu Đãi';
                    } else if (pkgServiceIdLower.includes('priority') || pkgServiceIdLower === 'sub_20260701_100003' || pkgNameLower.includes('priority')) {
                      displayName = 'Gói Ưu Tiên Hiển Thị';
                    }
                  }

                  return (
                    <div key={pkg.serviceId || pkg.id} className={visual.cardClass}>
                      {(pkgServiceIdLower.includes('seller') || pkgServiceIdStr === 'sub_20260701_100001') && (
                        <div className="popular-badge">{t('subscriptions.popular')}</div>
                      )}
                      <div className="sub-card-header">
                        <div className={visual.iconWrapClass}>
                          <span className="material-symbols-outlined">{visual.icon}</span>
                        </div>
                        <h3>{displayName}</h3>
                        <p>{visual.tagline}</p>
                      </div>
                      <div className="sub-role-badge">
                        {(pkgServiceIdLower.includes('voucher') || pkgServiceIdLower === 'sub_20260701_100002' || pkgNameLower.includes('voucher'))
                          ? (language === 'vi' ? 'ĐỐI TƯỢNG: TẤT CẢ NGƯỜI DÙNG' : 'TARGET: ALL USERS')
                          : t('subscriptions.target_role', { role: pkg.targetRole === 'Buyer' ? t('subscriptions.buyer') : t('subscriptions.seller') })}
                      </div>
                      <div className="sub-price">
                        <span className="price-num">{formatCurrency(pkg.price)}</span>
                        <span className="price-period"> {t('subscriptions.days_suffix', { days: pkg.durationDays || 30 })}</span>
                      </div>
                      <ul className="sub-features">
                        {featureLines.map((feature, featureIndex) => {
                          const translatedFeature = language === 'vi' ? {
                            'Unlock Seller privileges': 'Mở khóa đặc quyền Người bán',
                            'Allowed to list products for sale': 'Được phép đăng bán sản phẩm',
                            'Professional store management': 'Quản lý cửa hàng chuyên nghiệp',
                            'Receive 30 exclusive discount & freeship vouchers': 'Nhận 30 voucher giảm giá & freeship độc quyền',
                            'Valid for 30 days of shopping': 'Có hiệu lực trong 30 ngày mua sắm',
                            'Unlock progressive savings every week': 'Mở khóa ưu đãi tiết kiệm mỗi tuần',
                            'Activate priority display rights': 'Kích hoạt quyền hiển thị ưu tiên',
                            'Bring products to the top of search results': 'Đưa sản phẩm lên top tìm kiếm',
                            'Reach tens of thousands of potential buyers': 'Tiếp cận hàng chục ngàn người mua tiềm năng',
                          }[feature] || feature : feature;

                          return (
                            <li key={`${pkg.serviceId}-${featureIndex}`}>
                              <span className="material-symbols-outlined check-icon">check_circle</span>
                              <span>{translatedFeature}</span>
                            </li>
                          );
                        })}
                        {visual.note && (
                          <li className="note-li"><p>{visual.note}</p></li>
                        )}
                      </ul>

                      {activePackage ? (
                        <button className="sub-card-btn white-btn active-package-btn" disabled>
                          <span className="material-symbols-outlined">verified</span>
                          {t('subscriptions.activated', { days: daysLeft })}
                        </button>
                      ) : (user?.roles?.includes('Seller') && (pkgServiceIdLower.includes('seller') || pkgServiceIdLower === 'sub_20260701_100001' || pkgNameLower.includes('seller'))) ? (
                        <button
                          className="sub-card-btn white-btn active-package-btn"
                          disabled
                          style={{
                            background: '#e7f7ec',
                            color: '#1b7a3d',
                            border: '1px solid #cfe9d6',
                            opacity: 1,
                            cursor: 'default',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '10px 6px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>verified</span>
                          {language === 'vi' ? 'Đã là Người bán (Vô hạn)' : 'Already Seller (Unlimited)'}
                        </button>
                      ) : (user && user.roles && !user.roles.includes(pkg.targetRole) && !pkgServiceIdLower.includes('voucher') && pkgServiceIdLower !== 'sub_20260701_100002' && !pkgNameLower.includes('voucher')) ? (
                        <button
                          className={`${visual.buttonClass} role-blocked-btn`}
                          disabled
                          style={{ opacity: 0.5, cursor: 'not-allowed', padding: '10px' }}
                          title={t('subscriptions.requires_role', { role: pkg.targetRole })}
                        >
                          {t('subscriptions.requires_role', { role: pkg.targetRole })}
                        </button>
                      ) : (
                        <button
                          className={visual.buttonClass}
                          disabled={purchaseLoadingId === pkg.serviceId}
                          onClick={() => handlePurchasePackage(pkg.serviceId)}
                        >
                          {purchaseLoadingId === pkg.serviceId ? t('subscriptions.redirecting') : t('subscriptions.buy_now')}
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
