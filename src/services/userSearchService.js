import api from './api';

const get = (url, config) => api.get(url, config).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const del = (url) => api.delete(url).then(r => r.data);

const userSearchService = {
  getHistory: (limit = 20) => get('/UserSearch', { params: { limit } }),
  saveSearch: (keyword, categoryId = null) => post('/UserSearch', { keyword, categoryId }),
  deleteSearch: (id) => del(`/UserSearch/${id}`),
  clearAll: () => del('/UserSearch'),
};

export default userSearchService;
