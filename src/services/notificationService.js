import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);
const patch = (url, data, config) => api.patch(url, data, config).then((r) => r.data);
const del = (url, config) => api.delete(url, config).then((r) => r.data);

const notificationService = {
  getNotifications: (params) => get('/Notification', { params }),
  getUnreadCount: (userId) => get('/Notification/unread-count', { params: { userId } }),
  markAsRead: (notificationId, userId) => patch(`/Notification/${notificationId}/read`, null, { params: { userId } }),
  markAllAsRead: (userId) => patch('/Notification/read-all', null, { params: { userId } }),
  deleteNotification: (notificationId, userId) => del(`/Notification/${notificationId}`, { params: { userId } }),
};

export default notificationService;
