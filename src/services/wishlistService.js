import api from './api';

const get = (url, config) => api.get(url, config).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const del = (url) => api.delete(url).then(r => r.data);

const wishlistService = {
  getWishlist: () => get('/Wishlist'),
  addToWishlist: (productId) => post('/Wishlist', { productId }),
  removeItem: (wishlistItemId) => del(`/Wishlist/items/${wishlistItemId}`),
};

export default wishlistService;
