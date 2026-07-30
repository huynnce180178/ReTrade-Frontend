import api from './api';

const get = (url, config) => api.get(url, config).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const put = (url, data) => api.put(url, data).then(r => r.data);
const del = (url) => api.delete(url).then(r => r.data);

const productService = {
  // Public & Seller endpoints
  getAll: (params) => get('/Product', { params }),
  getSellerProducts: (sellerId, params) => get('/Product', { params: { sellerId, ...params } }),
  getById: (id) => get(`/Product/${id}`),
  create: (data) => post('/Product', data),
  update: (id, data) => put(`/Product/${id}`, data),
  delete: (id) => del(`/Product/${id}`),
  uploadImage: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/Product/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },

  // Admin endpoints
  getForApproval: (params) => get('/AdminProduct', { params }),
  getAdminProductById: (id) => get(`/AdminProduct/${id}`),
  approve: (id, isApproved, rejectReason) => put(`/AdminProduct/${id}/approve`, { isApproved, rejectReason })
};

export default productService;
