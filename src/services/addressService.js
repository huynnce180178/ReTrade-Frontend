import api from './api';

const addressService = {
  getMyAddresses: () => api.get('/Address/my-addresses').then((r) => r.data),
  createAddress: (data) => api.post('/Address', data).then((r) => r.data),
  updateAddress: (addressId, data) => api.put(`/Address/${addressId}`, data).then((r) => r.data),
  setDefault: (addressId) => api.patch(`/Address/${addressId}/set-default`).then((r) => r.data),
  deleteAddress: (addressId) => api.delete(`/Address/${addressId}`).then((r) => r.data),
};

export default addressService;
