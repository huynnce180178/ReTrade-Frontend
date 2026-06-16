import api from './api';

const get = (url) => api.get(url).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const del = (url) => api.delete(url).then(r => r.data);

const userFavoriteService = {
  getFavorites: () => get('/UserFavorite'),
  addFavorite: (categoryId) => post('/UserFavorite', { categoryId }),
  removeFavorite: (categoryId) => del(`/UserFavorite/${categoryId}`),
};

export default userFavoriteService;
