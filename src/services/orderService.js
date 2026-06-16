import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId, params) => get(`/Order/${orderId}`, { params }),
  updateStatus: (orderId, payload, params) => api.patch(`/Order/${orderId}/status`, payload, { params }).then((r) => r.data),
};

export default orderService;
