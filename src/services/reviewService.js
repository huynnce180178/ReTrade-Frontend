import api from './api';

const get = (url) => api.get(url).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);

const reviewService = {
  getByOrder: (buyerId, orderId) => get(`/Review/buyer/${buyerId}/order/${orderId}`),
  create: (buyerId, payload) => post(`/Review/buyer/${buyerId}`, payload),
};

export default reviewService;
