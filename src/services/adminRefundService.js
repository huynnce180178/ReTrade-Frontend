import api from './api';

const get = (url, config) => api.get(url, config).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);

const adminRefundService = {
  getAll: () => get('/Admin/refunds'),
  markDone: (id) => post(`/Admin/refunds/${id}/done`),
  rejectRefund: (id, payload) => post(`/Admin/refunds/${id}/reject`, payload),
};

export default adminRefundService;
