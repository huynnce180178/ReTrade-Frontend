import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);
const patch = (url, data) => api.patch(url, data).then((r) => r.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId) => get(`/Order/${orderId}`),
  updateStatus: (orderId, payload) => patch(`/Order/${orderId}/status`, payload),
};

export default orderService;
