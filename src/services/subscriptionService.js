import api from './api';

const subscriptionService = {
  async getAll() {
    const response = await api.get('/ServiceSubscription');
    return response.data;
  },

  async getMyActiveSubscriptions() {
    const response = await api.get('/ServiceSubscription/my');
    return response.data;
  },

  async purchase(serviceId) {
    const response = await api.post(`/ServiceSubscription/${serviceId}/purchase`);
    return response.data;
  }
};

export default subscriptionService;
