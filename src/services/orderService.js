import api from './api';

const get = (url, config) => api.get(url, config).then((response) => response.data);
const patch = (url, data) => api.patch(url, data).then((response) => response.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId) => get(`/Order/${orderId}`),
  confirm: (orderId) => patch(`/Order/${orderId}/confirm`),
  updateStatus: (orderId, data) => patch(`/Order/${orderId}/status`, data),
};

export default orderService;
