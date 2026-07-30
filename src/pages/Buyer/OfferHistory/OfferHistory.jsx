import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import offerService from '../../../services/offerService';
import addressService from '../../../services/addressService';
import checkoutService from '../../../services/checkoutService';
import { createVnPayPaymentUrl } from '../../../services/paymentService';
import '../../../styles/MyAccount.css';
import './OfferHistory.css';

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN').format(price);
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('vi-VN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getOfferStatusConfig(status) {
  switch (status) {
    case 'Pending': return { label: 'Pending', color: '#f59e0b', bg: '#fef3c7', icon: 'schedule' };
    case 'Accepted': return { label: 'Accepted', color: '#0f7b5f', bg: '#e6f5ef', icon: 'check_circle' };
    case 'CounterOffer': return { label: 'Counter Offer', color: '#6366f1', bg: '#e0e7ff', icon: 'swap_horiz' };
    case 'Rejected': return { label: 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: 'cancel' };
    case 'Cancelled': return { label: 'Cancelled', color: '#6b7280', bg: '#f3f4f6', icon: 'block' };
    case 'Completed': return { label: 'Completed', color: '#2563eb', bg: '#dbeafe', icon: 'verified' };
    default: return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: 'help' };
  }
}

/* =============================================
   OFFER CHECKOUT MODAL
   ============================================= */
function OfferCheckoutModal({ offer, onClose, onSuccess }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [shippingFee, setShippingFee] = useState(null);
  const [loadingFee, setLoadingFee] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const data = await addressService.getMyAddresses();
        const addrs = Array.isArray(data) ? data : (data?.data || []);
        setAddresses(addrs);
        const def = addrs.find(a => a.isDefault) || addrs[0];
        if (def) {
          const id = def.addressId || def.id;
          setSelectedAddressId(id);
          calcFee(id, offer.productId);
        }
      } catch { }
    };
    loadAddresses();
  }, [offer.productId]);

  const calcFee = async (addrId, prodId) => {
    if (!addrId || !prodId) return;
    setLoadingFee(true);
    try {
      const res = await checkoutService.calculateShippingFee({
        productId: prodId,
        addressId: addrId,
      });
      setShippingFee(res.shippingFee || 0);
    } catch {
      setShippingFee(0);
    } finally {
      setLoadingFee(false);
    }
  };

  const handleAddressChange = (e) => {
    setSelectedAddressId(e.target.value);
    calcFee(e.target.value, offer.productId);
  };

  const totalAmount = (offer.offerPrice || 0) + (shippingFee || 0);

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      showToast('Please select a delivery address.', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await offerService.checkoutFromOffer(offer.offerId, selectedAddressId, paymentMethod);
      showToast('Order placed successfully!', 'success');

      if (paymentMethod === 'vnpay') {
        try {
          const payRes = await createVnPayPaymentUrl({
            orderId: res.orderId || res.OrderId,
            amount: totalAmount,
            orderDescription: `Payment for offer order`
          });
          if (payRes?.paymentUrl) {
            window.location.href = payRes.paymentUrl;
            return;
          }
        } catch { }
      }
      onSuccess();
      navigate('/purchase-history');
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.checkout_error');
      showToast(typeof msg === 'string' ? msg : 'Checkout failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return createPortal(
    <div className="offer-modal-overlay" onClick={onClose}>
      <div className="offer-modal offer-checkout-modal" onClick={e => e.stopPropagation()}>
        <div className="offer-modal-header">
          <div className="offer-modal-header-left">
            <span className="material-symbols-outlined offer-modal-icon" style={{ background: 'linear-gradient(135deg,#0f7b5f,#02241b)' }}>shopping_cart_checkout</span>
            <div>
              <h2 className="offer-modal-title">Checkout with Offer</h2>
              <p className="offer-modal-subtitle">Complete the purchase at the agreed offer price</p>
            </div>
          </div>
          <button className="offer-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="offer-checkout-body">
          {/* Offer summary */}
          <div className="offer-checkout-summary">
            <div className="offer-checkout-row">
              <span>Offer Price</span>
              <strong className="offer-checkout-highlight">{formatPrice(offer.offerPrice)} VND</strong>
            </div>
            <div className="offer-checkout-row">
              <span>Shipping Fee (GHN)</span>
              <strong>
                {loadingFee
                  ? <span className="offer-spinner-sm" />
                  : shippingFee != null ? `${formatPrice(shippingFee)} VND` : '—'}
              </strong>
            </div>
            <div className="offer-checkout-row offer-checkout-total">
              <span>Total</span>
              <strong>{shippingFee != null ? `${formatPrice(totalAmount)} VND` : '—'}</strong>
            </div>
          </div>

          {/* Address selector */}
          <div className="offer-field">
            <label className="offer-label">Delivery Address</label>
            {addresses.length > 0 ? (
              <select
                className="offer-select"
                value={selectedAddressId}
                onChange={handleAddressChange}
              >
                {addresses.map(a => {
                  const id = a.addressId || a.id;
                  return (
                    <option key={id} value={id}>
                      {a.receiverName} – {a.street}, {a.receiverPhone}
                      {a.isDefault ? ' (Default)' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <p className="offer-no-address">No addresses found. Please add one in Address Book.</p>
            )}
          </div>

          {/* Payment method */}
          <div className="offer-field">
            <label className="offer-label">Payment Method</label>
            <div className="offer-payment-options">
              {[
                { value: 'vnpay', label: 'VNPAY', icon: 'qr_code_2' },
                { value: 'cod', label: 'COD', icon: 'payments' },
              ].map(m => (
                <label key={m.value} className={`offer-payment-opt ${paymentMethod === m.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="offerPayment"
                    value={m.value}
                    checked={paymentMethod === m.value}
                    onChange={() => setPaymentMethod(m.value)}
                  />
                  <span className="material-symbols-outlined">{m.icon}</span>
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="offer-modal-actions">
          <button type="button" className="offer-btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="offer-btn-submit offer-btn-checkout"
            onClick={handleCheckout}
            disabled={processing || !selectedAddressId}
          >
            {processing
              ? <><span className="offer-spinner" /> Processing...</>
              : <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span> Place Order</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =============================================
   OFFER HISTORY PAGE
   ============================================= */
export default function OfferHistory() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOffer, setCheckoutOffer] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const data = await offerService.getMyOffers();
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Failed to load offer history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOffers(); }, []);

  const handleCancel = async (offerId) => {
    setCancelling(offerId);
    try {
      await offerService.cancelOffer(offerId);
      showToast('Offer cancelled.', 'success');
      loadOffers();
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.cancel_error');
      showToast(typeof msg === 'string' ? msg : 'Failed to cancel.', 'error');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="ma-col-left">
              <div className="ma-card ma-header-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
                    <span className="material-symbols-outlined">history</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">{language === 'vi' ? 'Lịch Sử Trả Giá' : 'Offer History'}</h1>
                    <p className="ma-subtitle">{language === 'vi' ? 'Theo dõi các đề xuất giá và thương lượng mua hàng của bạn' : 'Track your offers and negotiate purchases'}</p>
                  </div>
                </div>
              </div>

              <div className="ma-card ma-info-card">
                {loading ? (
                  <div className="offer-history-loading">
                    <span className="offer-spinner-lg" />
                    <span>{language === 'vi' ? 'Đang tải danh sách trả giá...' : 'Loading offers...'}</span>
                  </div>
                ) : offers.length === 0 ? (
                  <div className="offer-history-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', opacity: 0.25 }}>inbox</span>
                    <p>{language === 'vi' ? 'Bạn chưa tạo đề xuất trả giá nào.' : "You haven't made any offers yet."}</p>
                  </div>
                ) : (
                  <div className="offer-history-list">
                    {offers.map(offer => {
                      const status = getOfferStatusConfig(offer.status);
                      const isExpired = offer.expiresAt && new Date(offer.expiresAt) < new Date();
                      return (
                        <div key={offer.offerId} className="offer-history-card">

                          {/* Product Header */}
                          <div className="offer-history-product-strip" onClick={() => navigate(`/product/${offer.productId}`)}>
                            {offer.productImageUrl ? (
                              <img src={offer.productImageUrl} alt={offer.productName} className="offer-product-thumb" />
                            ) : (
                              <div className="offer-product-thumb-placeholder">📦</div>
                            )}
                            <div className="offer-product-meta">
                              <span className="offer-product-title">{offer.productName}</span>
                              <span className="offer-product-link">View Product <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span></span>
                            </div>
                          </div>

                          <div className="offer-history-card-top">
                            <div className="offer-history-prices">
                              <span className="offer-history-offer-price">
                                {formatPrice(offer.offerPrice)} <span>VND</span>
                              </span>
                              {offer.originalPrice && (
                                <span className="offer-history-original">
                                  Listed: {formatPrice(offer.originalPrice)} VND
                                </span>
                              )}
                            </div>
                            <div
                              className="offer-history-status"
                              style={{ color: status.color, background: status.bg }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{status.icon}</span>
                              {status.label}
                              {isExpired && (offer.status === 'Accepted' || offer.status === 'CounterOffer') && (
                                <span className="offer-expired-badge">Expired</span>
                              )}
                            </div>
                          </div>

                          {offer.message && (
                            <p className="offer-history-message">
                              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#78908a' }}>chat_bubble</span>
                              {offer.message}
                            </p>
                          )}

                          <div className="offer-history-meta">
                            <span>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>calendar_today</span>
                              {formatDateTime(offer.createdAt)}
                            </span>
                            {offer.expiresAt && (
                              <span>
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>timer</span>
                                Expires {formatDateTime(offer.expiresAt)}
                              </span>
                            )}
                          </div>

                          <div className="offer-history-card-actions">
                            {offer.status === 'Pending' && (
                              <button
                                className="offer-history-btn offer-history-btn-cancel"
                                onClick={() => handleCancel(offer.offerId)}
                                disabled={cancelling === offer.offerId}
                              >
                                {cancelling === offer.offerId
                                  ? <><span className="offer-spinner-sm" /> Cancelling...</>
                                  : <><span className="material-symbols-outlined" style={{ fontSize: '15px' }}>block</span> Cancel Offer</>
                                }
                              </button>
                            )}
                            {(offer.status === 'Accepted' || offer.status === 'CounterOffer') && !isExpired && (
                              <button
                                className="offer-history-btn offer-history-btn-checkout"
                                onClick={() => setCheckoutOffer(offer)}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>shopping_cart_checkout</span>
                                Checkout — {formatPrice(offer.offerPrice)} VND
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {checkoutOffer && (
          <OfferCheckoutModal
            offer={checkoutOffer}
            onClose={() => setCheckoutOffer(null)}
            onSuccess={() => { setCheckoutOffer(null); loadOffers(); }}
          />
        )}
      </div>
    </div>
  );
}
