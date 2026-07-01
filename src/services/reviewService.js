import api from './api';

const get = (url) => api.get(url).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);

const reviewService = {
  getByOrder: (buyerId, orderId) => get(`/Review/buyer/${buyerId}/order/${orderId}`),
  create: (buyerId, payload) => post(`/Review/buyer/${buyerId}`, payload),
  getSellerReviews: (params) => api.get('/Review/seller', { params }).then((response) => response.data),
  getSellerSummary: (params) => api.get('/Review/seller/summary', { params }).then((response) => response.data),
  getAdminReviews: (params) => api.get('/Review/admin', { params }).then((response) => response.data),
  getAdminSummary: (params) => api.get('/Review/admin/summary', { params }).then((response) => response.data),
  report: (reviewId, payload) => post(`/Review/${reviewId}/report`, payload),
};

export default reviewService;
