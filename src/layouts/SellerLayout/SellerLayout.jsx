import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import chatService from '../../services/chatService';
import { createChatHubConnection } from '../../services/chatRealtimeService';
import '../../styles/SellerDashboard.css';

export default function SellerLayout() {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const chatHubRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

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

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');

  useEffect(() => {
    if (!user || !isSeller) {
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
  }, [isSeller, location.pathname, user]);

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
            {isValidAvatarUrl(user?.avatarUrl) && !avatarError ? (
              <img src={user.avatarUrl} alt={displayName} onError={() => setAvatarError(true)} />
            ) : (
              initials
            )}
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
            to="/seller-dashboard/sales-statistics"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">monitoring</span>Sales Statistics
          </NavLink>
          <NavLink
            to="/seller-dashboard/products"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${location.pathname.includes('/seller-dashboard/products') ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">inventory_2</span>My Products
          </NavLink>
          <NavLink
            to="/seller-dashboard/offers"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${location.pathname.includes('/seller-dashboard/offers') ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">local_offer</span>Offers
          </NavLink>
          <NavLink
            to="/seller-dashboard/messages"
            onClick={() => { setChatUnreadCount(0); closeSidebar(); }}
            className={({ isActive }) => `seller-menu-btn ${location.pathname.includes('/seller-dashboard/messages') ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">forum</span>
            <span className="seller-menu-label">Messages</span>
            {chatUnreadCount > 0 && <span className="seller-menu-badge">{chatUnreadCount}</span>}
          </NavLink>
          <NavLink
            to="/seller-dashboard/auctions"
            onClick={closeSidebar}
            className={({ isActive }) => `seller-menu-btn ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">gavel</span>My Auctions
          </NavLink>
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
