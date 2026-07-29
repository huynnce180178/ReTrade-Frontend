import api from './api';

const adminDashboardService = {
  getSubscriptionStatistics: () => api.get('/AdminDashboard/subscription-statistics').then(res => res.data),
  getSalesStatistics: (periodDays = 30) => api.get('/admin/sales-statistics', { params: { periodDays } }).then(res => res.data),
};

export default adminDashboardService;
