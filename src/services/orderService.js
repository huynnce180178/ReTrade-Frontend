import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId) => get(`/Order/${orderId}`),
};

export default orderService;
