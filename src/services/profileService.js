import api from './api';

const get = (url) => api.get(url).then((r) => r.data);
const put = (url, data) => api.put(url, data).then((r) => r.data);
const post = (url) => api.post(url).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

const profileService = {
  getMyProfile: () => get('/Profile/me'),
  updateMyProfile: (data) => put('/Profile/me', data),
  getUserProfile: (userId) => get(`/Profile/user/${userId}`),
  getSellerInformation: (sellerId) => get(`/Seller/${sellerId}`),
  followSeller: (sellerId) => post(`/Seller/${sellerId}/follow`),
  unfollowSeller: (sellerId) => del(`/Seller/${sellerId}/follow`),
};

export default profileService;
