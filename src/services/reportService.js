import api from './api';

const get = (url, config) => api.get(url, config).then((response) => response.data);
const post = (url, payload) => api.post(url, payload).then((response) => response.data);
const patch = (url, payload) => api.patch(url, payload).then((response) => response.data);

const reportService = {
  reportReview: (reviewId, payload) => post(`/Report/review/${reviewId}`, payload),
  reportBuyer: (orderId, payload) => post(`/Report/buyer/${orderId}`, payload),
  reportSeller: (orderId, payload) => post(`/Report/seller/${orderId}`, payload),
  getReports: (params) => get('/Report', { params }),
  getReportDetail: (reportId) => get(`/Report/${reportId}`),
  updateReportStatus: (reportId, status) => patch(`/Report/${reportId}/status`, { status }),
  getFlaggedUsers: (params) => get('/Report/flagged-users', { params }),
  getHistory: (params) => get('/Report/history', { params }),
};

export default reportService;
