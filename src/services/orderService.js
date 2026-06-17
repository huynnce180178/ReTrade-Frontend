import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);
const patch = (url, data, config) => api.patch(url, data, config).then((r) => r.data);

const orderService = {
  getMyOrders: (params) => get('/Order/my-orders', { params }),
  getSellerOrders: (params) => get('/Order/seller-orders', { params }),
  getSellerOrdersOData: (params) => get('/Order/seller-orders/odata', { params }),
  getSellerSalesStatistics: (params) => get('/Order/seller-orders/statistics', { params }),
  getAllOrders: (params) => get('/Order/admin', { params }),
  getById: (orderId, params) => get(`/Order/${orderId}`, { params }),
  updateStatus: (orderId, payload, params) => patch(`/Order/${orderId}/status`, payload, { params }),
};

export default orderService;
