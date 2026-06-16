import api from './api';

const checkoutService = {
  calculateShippingFee: (data) => api.post('/Checkout/shipping-fee', data).then(r => r.data),
  createOrder: (data) => api.post('/Checkout/order', data).then(r => r.data),
};

export default checkoutService;
