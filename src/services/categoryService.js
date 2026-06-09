import api from './api';

const get = (url) => api.get(url).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const put = (url, data) => api.put(url, data).then(r => r.data);
const del = (url) => api.delete(url).then(r => r.data);
const patch = (url) => api.patch(url).then(r => r.data);

const categoryService = {
  getAll: (query = '') => get(`/Category${query}`),
  getAllActive: (query = '') => get(`/Category${query}`),
  getById: (id) => get(`/Category/${id}`),
  create: (data) => post('/Category', data),
  update: (id, data) => put(`/Category/${id}`, data),
  inactive: (id) => del(`/Category/${id}`),
  restore: (id) => patch(`/Category/${id}/restore`),
  uploadImage: (categoryId, file) => {
    const form = new FormData();
    form.append('categoryId', categoryId);
    form.append('image', file);
    return api.post('/CategoryImage/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
};

export default categoryService;
