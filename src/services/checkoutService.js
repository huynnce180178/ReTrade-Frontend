import api from './api';

const checkoutService = {
  calculateShippingFee: (data) => api.post('/Checkout/calculate-fee', data).then(r => r.data),
  createOrder: (data) => api.post('/Checkout', data).then(r => r.data),
};

export default checkoutService;
