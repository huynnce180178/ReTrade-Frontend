import api from './api';

export async function createVnPayPaymentUrl(payload) {
  const response = await api.post('/Payment/vnpay/create-payment-url', payload);
  return response.data;
}
