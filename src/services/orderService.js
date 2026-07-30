import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);
const patch = (url, data, config) => api.patch(url, data, config).then((r) => r.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getSellerSalesStatistics: (params) => get('/Order/seller-orders/statistics', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId, params) => get(`/Order/${orderId}`, { params }),
  updateStatus: (orderId, payload, params) => patch(`/Order/${orderId}/status`, payload, { params }),
  updateSellerOrderStatus: (orderId, payload, params) => patch(`/Order/${orderId}/status`, payload, { params }),
  confirmOrder: (orderId, sellerId) => patch(`/Order/${orderId}/confirm`, null, { params: { sellerId } }),
  approveReturnRequest: (orderId, sellerId) => patch(`/Order/${orderId}/return/approve`, null, { params: { sellerId } }),
  rejectReturnRequest: (orderId, reason, sellerId) => patch(`/Order/${orderId}/return/reject`, { reason }, { params: { sellerId } }),
};

export default orderService;
