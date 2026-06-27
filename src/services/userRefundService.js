import api from './api';

const get = (url, config) => api.get(url, config).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);
const put = (url, payload) => api.put(url, payload).then((response) => response.data);

const userRefundService = {
  getMyRefunds: () => get('/Refund/my'),
  updateBankDetails: (id, data) => put(`/Refund/${id}/bank-details`, data),
  confirmReceived: (id) => post(`/Refund/${id}/received`),
};

export default userRefundService;
