import api from './api';

const get = (url, config) => api.get(url, config).then(r => r.data);
const post = (url, data) => api.post(url, data).then(r => r.data);
const patch = (url, config) => api.patch(url, null, config).then(r => r.data);

const offerService = {
  /** Buyer: submit a new offer */
  makeOffer: (productId, offerPrice, message = '', expiresInHours = 48) =>
    post('/Offer', { productId, offerPrice, message, expiresInHours }),

  /** Buyer: get all of my offers (optionally filter by productId) */
  getMyOffers: (productId = null) =>
    get('/Offer/my-offers', productId ? { params: { productId } } : undefined),

  /** Seller: get all offers for one product */
  getOffersForProduct: (productId, sellerId) =>
    get(`/Offer/product/${productId}`, { params: { sellerId } }),

  /** Seller: accept an offer */
  acceptOffer: (offerId, sellerId) =>
    patch(`/Offer/${offerId}/accept`, { params: { sellerId } }),

  /** Seller: reject an offer */
  rejectOffer: (offerId, sellerId) =>
    patch(`/Offer/${offerId}/reject`, { params: { sellerId } }),

  /** Buyer: cancel a pending offer */
  cancelOffer: (offerId) =>
    api.patch(`/Offer/${offerId}/cancel`).then(r => r.data),

  /** Buyer: checkout using an accepted offer */
  checkoutFromOffer: (offerId, addressId, paymentMethod = 'COD') =>
    post('/Offer/checkout', { offerId, addressId, paymentMethod }),

  /** Seller: get received offers for the logged in seller */
  getSellerOffers: () =>
    get('/seller-offers'),

  /** Seller: counter a buyer's offer */
  counterOffer: (offerId, counterPrice) =>
    api.patch('/seller-offers/counter-offer', { offerId, counterPrice }).then(r => r.data),

  /** Seller: accept a buyer's offer */
  acceptSellerOffer: (offerId) =>
    api.patch(`/seller-offers/${offerId}/response`, { accept: true }).then(r => r.data),

  /** Seller: reject a buyer's offer */
  rejectSellerOffer: (offerId) =>
    api.patch(`/seller-offers/${offerId}/response`, { accept: false }).then(r => r.data),
};

export default offerService;

