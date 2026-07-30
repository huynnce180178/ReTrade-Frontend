import React, { useState, useEffect } from 'react';
import { useNotification } from '../../../context/NotificationContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatNotificationContent } from '../../../utils/notificationUtils';
import './Notifications.css';

export default function Notifications() {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, loading } = useNotification();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [localNotifs, setLocalNotifs] = useState([]);

  const types = ['All', 'Order', 'Payment', 'Offer', 'Auction', 'Account', 'System'];
  const statuses = ['All', 'Unread', 'Read'];

  useEffect(() => {
    fetchNotifications({ page: 1, pageSize: 50 });
  }, [fetchNotifications]);

  useEffect(() => {
    let filtered = [...notifications];

    if (filterType !== 'All') {
      filtered = filtered.filter((n) => n.type === filterType);
    }

    if (filterStatus === 'Unread') {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (filterStatus === 'Read') {
      filtered = filtered.filter((n) => n.isRead);
    }

    setLocalNotifs(filtered);
  }, [notifications, filterType, filterStatus]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const then = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return isVi ? 'Vừa xong' : 'Just now';
    if (diff < 3600) return isVi ? `${Math.floor(diff / 60)} phút trước` : `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return isVi ? `${Math.floor(diff / 3600)} giờ trước` : `${Math.floor(diff / 3600)} hours ago`;
    return isVi ? `${Math.floor(diff / 86400)} ngày trước` : `${Math.floor(diff / 86400)} days ago`;
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'Order':
        return 'local_shipping';
      case 'Payment':
        return 'payments';
      case 'Offer':
        return 'local_offer';
      case 'Auction':
        return 'gavel';
      case 'Account':
        return 'person';
      case 'System':
        return 'info';
      default:
        return 'notifications';
    }
  };

  const translateTypeLabel = (type) => {
    if (!isVi) return type;
    const map = {
      All: 'Tất cả',
      Order: 'Đơn hàng',
      Payment: 'Thanh toán',
      Offer: 'Trị giá / Trả giá',
      Auction: 'Đấu giá',
      Account: 'Tài khoản',
      System: 'Hệ thống',
    };
    return map[type] || type;
  };

  const translateStatusLabel = (status) => {
    if (!isVi) return status;
    const map = {
      All: 'Tất cả',
      Unread: 'Chưa đọc',
      Read: 'Đã đọc',
    };
    return map[status] || status;
  };

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1>{isVi ? 'Thông Báo' : 'Notifications'}</h1>
        <div className="notifications-actions">
          <button className="mark-all-btn" onClick={markAllAsRead}>
            <span className="material-symbols-outlined">done_all</span>
            {isVi ? 'Đánh dấu tất cả đã đọc' : 'Mark all as read'}
          </button>
        </div>
      </div>

      <div className="notifications-filters">
        <div className="filter-group">
          <label>{isVi ? 'Loại' : 'Type'}</label>
          <div className="filter-chips">
            {types.map((type) => (
              <button
                key={type}
                className={`filter-chip ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {translateTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>{isVi ? 'Trạng thái' : 'Status'}</label>
          <div className="filter-chips">
            {statuses.map((status) => (
              <button
                key={status}
                className={`filter-chip ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {translateStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="notifications-container glass-panel">
        {loading && notifications.length === 0 ? (
          <div className="notifications-loading">
            <div className="spinner"></div>
            <p>{isVi ? 'Đang tải thông báo...' : 'Loading notifications...'}</p>
          </div>
        ) : localNotifs.length === 0 ? (
          <div className="notifications-empty">
            <span className="material-symbols-outlined empty-icon">notifications_off</span>
            <h3>{isVi ? 'Không tìm thấy thông báo nào' : 'No notifications found'}</h3>
            <p>{isVi ? 'Chúng tôi sẽ thông báo cho bạn khi có sự kiện quan trọng.' : "We'll notify you when something important happens."}</p>
          </div>
        ) : (
          <div className="notifications-list">
            {localNotifs.map((n) => {
              const { translatedTitle, translatedMessage } = formatNotificationContent(n.title, n.message || n.content, language);
              return (
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
                      <h4>{translatedTitle}</h4>
                      <span className="notif-card-time">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="notif-card-message">{translatedMessage}</p>
                  </div>

                  <div className="notif-card-actions">
                    <button
                      className="delete-notif-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.notificationId);
                      }}
                      title={isVi ? 'Xóa thông báo' : 'Delete notification'}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
