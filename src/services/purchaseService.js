import api from './api';

const get = (url, config) => api.get(url, config).then((r) => r.data);
const patch = (url) => api.patch(url).then((r) => r.data);

const purchaseService = {
  getByBuyer: (buyerId, params) => get(`/Purchase/buyer/${buyerId}`, { params }),
  getDetail: (buyerId, orderId) => get(`/Purchase/buyer/${buyerId}/${orderId}`),
  complete: (buyerId, orderId) => patch(`/Purchase/buyer/${buyerId}/${orderId}/complete`),
  cancel: (buyerId, orderId) => patch(`/Purchase/buyer/${buyerId}/${orderId}/cancel`),
};

export default purchaseService;
