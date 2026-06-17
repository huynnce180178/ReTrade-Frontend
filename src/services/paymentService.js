import api from './api';

const post = (url, payload) => api.post(url, payload).then((r) => r.data);

const createVnpayPaymentUrl = (payload) => post(`/Payment/vnpay/create-payment-url`, payload);

// Backwards-compatible named export used in some components
export const createVnPayPaymentUrl = createVnpayPaymentUrl;

const paymentService = {
  createVnpayPaymentUrl,
};

export default paymentService;

