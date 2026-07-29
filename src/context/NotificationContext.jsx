import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';
import { createNotificationHubConnection } from '../services/notificationRealtimeService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const hubRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const data = await notificationService.getUnreadCount(user.userId);
      setUnreadCount(data.count ?? 0);
    } catch {
      // Ignore
    }
  }, [user?.userId]);

  const fetchNotifications = useCallback(async (params = {}) => {
    if (!user?.userId) return null;
    setLoading(true);
    try {
      const data = await notificationService.getNotifications({
        userId: user.userId,
        page: 1,
        pageSize: 10,
        ...params,
      });
      setNotifications(data.items || []);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!user?.userId) return;
    try {
      await notificationService.markAsRead(notificationId, user.userId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }, [user?.userId]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.userId) return;
    try {
      await notificationService.markAllAsRead(user.userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  }, [user?.userId]);

  const deleteNotification = useCallback(async (notificationId) => {
    if (!user?.userId) return;
    try {
      await notificationService.deleteNotification(notificationId, user.userId);
      const removed = notifications.find((n) => n.notificationId === notificationId);
      setNotifications((prev) => prev.filter((n) => n.notificationId !== notificationId));
      if (removed && !removed.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore
    }
  }, [user?.userId, notifications]);

  // SignalR connection lifecycle
  useEffect(() => {
    if (!token || !user?.userId) {
      setUnreadCount(0);
      setNotifications([]);
      return undefined;
    }

    fetchUnreadCount();
    fetchNotifications();

    const connection = createNotificationHubConnection();
    hubRef.current = connection;
    let disposed = false;

    const handleReceiveNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 20));
    };

    const handleUnreadCountUpdated = (data) => {
      setUnreadCount(data.count ?? 0);
    };

    const handleAllNotificationsRead = () => {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    };

    connection.on('ReceiveNotification', handleReceiveNotification);
    connection.on('UnreadCountUpdated', handleUnreadCountUpdated);
    connection.on('AllNotificationsRead', handleAllNotificationsRead);

    const startConnection = async () => {
      try {
        await connection.start();
      } catch (error) {
        console.error('Failed to connect notification hub:', error);
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('ReceiveNotification', handleReceiveNotification);
      connection.off('UnreadCountUpdated', handleUnreadCountUpdated);
      connection.off('AllNotificationsRead', handleAllNotificationsRead);
      connection.stop().catch(() => {});
    };
  }, [token, user?.userId]);

  const value = {
    unreadCount,
    notifications,
    loading,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
