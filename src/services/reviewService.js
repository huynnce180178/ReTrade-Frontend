import api from './api';

const get = (url) => api.get(url).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);

const reviewService = {
  getByOrder: (buyerId, orderId) => get(`/Review/buyer/${buyerId}/order/${orderId}`),
  create: (buyerId, payload) => post(`/Review/buyer/${buyerId}`, payload),
  getPublicSellerReviews: (sellerId, params) => api.get(`/Review/seller/${sellerId}`, { params }).then((response) => response.data),
  getPublicSellerSummary: (sellerId) => get(`/Review/seller/${sellerId}/summary`),
  getSellerReviews: (arg1, arg2) => {
    if (typeof arg1 === 'string') {
      const params = arg2 || {};
      return api.get(`/Review/seller/${arg1}`, { params }).then((response) => response.data);
    }
    return api.get('/Review/seller', { params: arg1 }).then((response) => response.data);
  },
  getSellerSummary: (arg1) => {
    if (typeof arg1 === 'string') {
      return get(`/Review/seller/${arg1}/summary`);
    }
    return api.get('/Review/seller/summary', { params: arg1 }).then((response) => response.data);
  },
  getAdminReviews: (params) => api.get('/Review/admin', { params }).then((response) => response.data),
  getAdminSummary: (params) => api.get('/Review/admin/summary', { params }).then((response) => response.data),
  report: (reviewId, payload) => post(`/Review/${reviewId}/report`, payload),
};

export default reviewService;
