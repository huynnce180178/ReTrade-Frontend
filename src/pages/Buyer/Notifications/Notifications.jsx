import React, { useState, useEffect } from 'react';
import { useNotification } from '../../../context/NotificationContext';
import './Notifications.css';

export default function Notifications() {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, loading } = useNotification();
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [localNotifs, setLocalNotifs] = useState([]);
  
  const types = ['All', 'Order', 'Payment', 'Offer', 'Auction', 'Account', 'System'];
  const statuses = ['All', 'Unread', 'Read'];

  useEffect(() => {
    // Initial fetch to get more than just the top 10
    fetchNotifications({ page: 1, pageSize: 50 });
  }, [fetchNotifications]);

  useEffect(() => {
    let filtered = [...notifications];
    
    if (filterType !== 'All') {
      filtered = filtered.filter(n => n.type === filterType);
    }
    
    if (filterStatus === 'Unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (filterStatus === 'Read') {
      filtered = filtered.filter(n => n.isRead);
    }
    
    setLocalNotifs(filtered);
  }, [notifications, filterType, filterStatus]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const then = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'Order': return 'local_shipping';
      case 'Payment': return 'payments';
      case 'Offer': return 'local_offer';
      case 'Auction': return 'gavel';
      case 'Account': return 'person';
      case 'System': return 'info';
      default: return 'notifications';
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <div className="notifications-actions">
          <button className="mark-all-btn" onClick={markAllAsRead}>
            <span className="material-symbols-outlined">done_all</span>
            Mark all as read
          </button>
        </div>
      </div>

      <div className="notifications-filters">
        <div className="filter-group">
          <label>Type</label>
          <div className="filter-chips">
            {types.map(type => (
              <button 
                key={type} 
                className={`filter-chip ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        <div className="filter-group">
          <label>Status</label>
          <div className="filter-chips">
            {statuses.map(status => (
              <button 
                key={status} 
                className={`filter-chip ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="notifications-container glass-panel">
        {loading && notifications.length === 0 ? (
          <div className="notifications-loading">
            <div className="spinner"></div>
            <p>Loading notifications...</p>
          </div>
        ) : localNotifs.length === 0 ? (
          <div className="notifications-empty">
            <span className="material-symbols-outlined empty-icon">notifications_off</span>
            <h3>No notifications found</h3>
            <p>We'll notify you when something important happens.</p>
          </div>
        ) : (
          <div className="notifications-list">
            {localNotifs.map(n => (
              <div 
                key={n.notificationId} 
                className={`notification-card ${!n.isRead ? 'unread' : ''}`}
                onClick={() => !n.isRead && markAsRead(n.notificationId)}
              >
                <div className="notif-card-icon">
                  <span className="material-symbols-outlined">{getIconForType(n.type)}</span>
                </div>
                
                <div className="notif-card-content">
                  <div className="notif-card-header">
                    <h4>{n.title}</h4>
                    <span className="notif-card-time">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="notif-card-message">{n.message}</p>
                </div>
                
                <div className="notif-card-actions">
                  <button 
                    className="delete-notif-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.notificationId);
                    }}
                    title="Delete notification"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
