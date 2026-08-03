import api from './api';

const get = (url, config) => api.get(url, config).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const put = (url, data) => api.put(url, data).then(r => r.data);

const auctionService = {
  getAll: (params) => get('/Auction', { params }),
  getById: (id) => get(`/Auction/${id}`),
  getMyAuctions: (params) => get('/Auction/my', { params }),
  getMyBids: () => get('/Auction/my-bids'),
  getEligibleProducts: (params) => get('/Auction/eligible-products', { params }),
  create: (data) => post('/Auction', data),
  update: (id, data) => put(`/Auction/${id}`, data),
  getMyDeposit: (id) => get(`/Auction/${id}/my-deposit`),
  createDepositPaymentUrl: (id, data) => post(`/Auction/${id}/deposit/payment-url`, data),
  placeBid: (id, data) => post(`/Auction/${id}/bid`, data),
  endAuction: (id) => post(`/Auction/${id}/end`),
  relistAuction: (id, data) => post(`/Auction/${id}/relist`, data),
};

export default auctionService;
