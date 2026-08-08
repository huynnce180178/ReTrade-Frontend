import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import ReviewModal from '../../../components/ReviewModal/ReviewModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import purchaseService from '../../../services/purchaseService';
import reviewService from '../../../services/reviewService';
import productService from '../../../services/productService';

import paymentService from '../../../services/paymentService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import '../../../styles/MyAccount.css';
import './PurchaseHistory.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const getJourneySteps = (t, status) => {
  const normStatus = String(status || '').toLowerCase();

  const steps = [
    { key: 'AwaitingPayment', label: t('order_status.awaiting_payment'), icon: 'receipt_long' },
    { key: 'Pending', label: t('order_status.pending'), icon: 'inventory' },
    { key: 'Confirmed', label: t('order_status.confirmed'), icon: 'verified_user' },
    { key: 'Shipping', label: t('order_status.shipping'), icon: 'local_shipping' },
  ];

  if (normStatus === 'deliveryfailed') {
    steps.push({ key: 'DeliveryFailed', label: t('order_status.delivery_failed'), icon: 'report' });
  } else {
    steps.push({ key: 'Delivered', label: t('order_status.delivered'), icon: 'package_2' });
  }

  if (normStatus === 'cancelled') {
    steps.push({ key: 'Cancelled', label: t('order_status.cancelled'), icon: 'block' });
  } else if (normStatus === 'returnrequested') {
    steps.push({ key: 'Completed', label: t('order_status.completed'), icon: 'check_circle' });
    steps.push({ key: 'ReturnRequested', label: t('order_status.return_requested'), icon: 'assignment_return' });
  } else if (normStatus === 'returnrejected') {
    steps.push({ key: 'Completed', label: t('order_status.completed'), icon: 'check_circle' });
    steps.push({ key: 'ReturnRejected', label: t('order_status.return_rejected'), icon: 'do_not_disturb_on' });
  } else if (normStatus === 'returned') {
    steps.push({ key: 'Completed', label: t('order_status.completed'), icon: 'check_circle' });
    steps.push({ key: 'Returned', label: t('order_status.returned'), icon: 'assignment_turned_in' });
  } else {
    steps.push({ key: 'Completed', label: t('order_status.completed'), icon: 'check_circle' });
  }

  return steps;
};

function getActiveStepIndex(status, steps) {
  const normStatus = String(status || '').toLowerCase();
  if (normStatus === 'cancelled') return steps.findIndex((s) => s.key === 'Cancelled');
  if (normStatus === 'deliveryfailed') return steps.findIndex((s) => s.key === 'DeliveryFailed');
  if (normStatus === 'returnrequested') return steps.findIndex((s) => s.key === 'ReturnRequested');
  if (normStatus === 'returnrejected') return steps.findIndex((s) => s.key === 'ReturnRejected');
  if (normStatus === 'returned') return steps.findIndex((s) => s.key === 'Returned');

  const stdOrder = ['AwaitingPayment', 'Pending', 'Confirmed', 'Shipping', 'Delivered', 'Completed'];
  const idx = stdOrder.findIndex((s) => s.toLowerCase() === normStatus);
  return idx >= 0 ? idx : steps.length - 1;
}

const returnRequestWindowMs = 7 * 24 * 60 * 60 * 1000;

export default function PurchaseDetail() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();

  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const buyerId = user?.userId;

  const loadPurchase = useCallback(async () => {
    if (!buyerId || !orderId) return;

    try {
      setLoading(true);
      const data = await purchaseService.getDetail(buyerId, orderId);
      setPurchase(data);
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể tải chi tiết đơn hàng.' : 'Failed to load purchase detail.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [buyerId, orderId, showToast, language]);

  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);

  useEffect(() => {
    if (!buyerId || !orderId) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleBuyerOrderStatusChanged = (payload) => {
      const payloadOrderId = payload?.orderId || payload?.OrderId;
      const payloadBuyerId = payload?.buyerId || payload?.BuyerId;
      if (payloadBuyerId && payloadBuyerId !== buyerId) return;
      if (payloadOrderId && payloadOrderId !== orderId) return;
      loadPurchase();
    };

    connection.on('BuyerOrderStatusChanged', handleBuyerOrderStatusChanged);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinBuyerOrderGroup', buyerId);
        }
      } catch (error) {
        console.error('Failed to connect buyer order hub:', error);
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('BuyerOrderStatusChanged', handleBuyerOrderStatusChanged);
      if (connection.state === 'Connected') {
        connection.invoke('LeaveBuyerOrderGroup', buyerId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [buyerId, loadPurchase, orderId]);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {}
  }, []);

  const totals = useMemo(
    () => ({
      subtotal: Number(purchase?.totalAmount || 0),
      shipping: Number(purchase?.shippingFee || 0),
      discount: Number(purchase?.discountAmount || 0),
      final: Number(purchase?.finalAmount || 0),
    }),
    [purchase]
  );

  const completePurchase = async () => {
    if (!buyerId || !purchase?.orderId) return;

    try {
      setUpdating(true);
      const updated = await purchaseService.complete(buyerId, purchase.orderId);
      setPurchase(updated);
      showToast(language === 'vi' ? 'Đã xác nhận hoàn thành đơn hàng!' : 'Purchase marked as completed.', 'success');
      setReviewTarget(updated ? { ...purchase, ...updated } : purchase);
      setReviewModalOpen(true);
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể hoàn thành đơn hàng.' : 'Failed to complete purchase.'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const openReviewModal = () => {
    setReviewTarget(purchase);
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async ({ rating, comment, proofs }) => {
    if (!buyerId || !reviewTarget?.orderId) return;

    try {
      setReviewSubmitting(true);
      const proofUrls = [];
      if (Array.isArray(proofs) && proofs.length > 0) {
        for (const p of proofs) {
          if (p?.file) {
            try {
              const res = await productService.uploadImage(p.file);
              const url = res?.url || res?.imageUrl || res?.path || res;
              if (typeof url === 'string') proofUrls.push(url);
            } catch {
              // Ignore single upload failure
            }
          }
        }
      }

      await reviewService.create(buyerId, {
        orderId: reviewTarget.orderId,
        rating,
        comment,
        proofUrls,
      });
      setPurchase((prev) => (prev ? { ...prev, hasReview: true, isReviewed: true } : prev));
      showToast(language === 'vi' ? 'Đã gửi đánh giá thành công!' : 'Review submitted successfully.', 'success');
      setReviewModalOpen(false);
      setReviewTarget(null);
      loadPurchase();

    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.response?.data || error?.message;
      showToast(errorMsg || (language === 'vi' ? 'Không thể gửi đánh giá.' : 'Failed to submit review.'), 'error');
      if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already reviewed')) {
        setReviewModalOpen(false);
        setReviewTarget(null);
        loadPurchase();
      }
    } finally {
      setReviewSubmitting(false);
    }
  };



  const openReturnModal = () => {
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const closeReturnModal = () => {
    if (returnSubmitting) return;
    setReturnModalOpen(false);
    setReturnReason('');
  };

  const handleSubmitReturn = async (event) => {
    event.preventDefault();
    if (!buyerId || !purchase?.orderId) return;

    const reason = returnReason.trim();
    if (!reason) {
      showToast(language === 'vi' ? 'Vui lòng nhập lý do trả hàng.' : 'Please enter a return reason.', 'warning');
      return;
    }

    try {
      setReturnSubmitting(true);
      setUpdating(true);
      const updated = await purchaseService.requestReturn(buyerId, purchase.orderId, reason);
      setPurchase(updated);
      setReturnModalOpen(false);
      setReturnReason('');
      showToast(language === 'vi' ? 'Yêu cầu trả hàng đã được gửi!' : 'Return request submitted.', 'success');
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể gửi yêu cầu trả hàng.' : 'Failed to submit return request.'), 'error');
    } finally {
      setReturnSubmitting(false);
      setUpdating(false);
    }
  };

  const payAgain = async () => {
    if (!buyerId || !purchase?.orderId) return;

    try {
      setUpdating(true);
      const payload = {
        orderId: purchase.orderId,
        amount: totals.final,
        orderDescription: `Payment for order ${purchase.orderCode || purchase.orderId}`,
      };

      const resp = await paymentService.createVnpayPaymentUrl(payload);
      const url = typeof resp === 'string' ? resp : resp?.paymentUrl || resp?.url || resp?.paymentLink || null;

      if (!url) {
        showToast(language === 'vi' ? 'Không nhận được liên kết thanh toán.' : 'Payment URL not returned from server.', 'error');
        return;
      }

      window.location.href = url;
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể tạo liên kết thanh toán.' : 'Failed to create payment link.'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const cancelPurchase = async () => {
    if (!buyerId || !purchase?.orderId) return;

    try {
      setUpdating(true);
      const updated = await purchaseService.cancel(buyerId, purchase.orderId);
      setPurchase(updated);
      showToast(language === 'vi' ? 'Hủy đơn hàng thành công!' : 'Purchase cancelled successfully.', 'success');
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể hủy đơn hàng.' : 'Failed to cancel purchase.'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{language === 'vi' ? 'Đang tải chi tiết đơn hàng...' : 'Loading purchase detail...'}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="purchase-detail-page">
            <nav className="purchase-breadcrumb">
              <Link to="/profile">{language === 'vi' ? 'Hồ Sơ Cá Nhân' : 'Profile'}</Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <Link to="/purchase-history">{language === 'vi' ? 'Lịch Sử Mua Hàng' : 'Purchase History'}</Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <strong>#{purchase?.orderCode || orderId}</strong>
            </nav>

            {loading ? (
              <div className="purchase-empty-state">
                <span className="btn-spinner"></span>
                <p>{language === 'vi' ? 'Đang tải chi tiết đơn hàng...' : 'Loading purchase detail...'}</p>
              </div>
            ) : !purchase ? (
              <div className="purchase-empty-state">
                <span className="material-symbols-outlined">receipt_long</span>
                <h3>{language === 'vi' ? 'Không tìm thấy đơn hàng' : 'Purchase not found'}</h3>
                <p>{language === 'vi' ? 'Đơn hàng này không tồn tại hoặc đã bị xóa.' : 'This order may have been removed or is not available for this account.'}</p>
              </div>
            ) : (
              <>
                <header className="purchase-detail-header">
                  <div>
                    <h1 className="purchase-detail-title">
                      <span>{language === 'vi' ? 'Đơn hàng' : 'Order'}</span>
                      <span className="order-code-tag">#{purchase.orderCode || purchase.orderId}</span>
                    </h1>
                    <p>{language === 'vi' ? 'Đặt hàng lúc' : 'Placed on'} {formatDateTime(purchase.createdAt)}</p>
                  </div>
                  <div>
                    <span>{language === 'vi' ? 'Tổng Tiền Thanh Toán' : 'Total Amount'}</span>
                    <strong>{formatVnd(totals.final)}</strong>
                  </div>
                </header>

                <div className="purchase-detail-layout">
                  <section className="purchase-detail-main">
                    <article className="purchase-detail-card">
                      <h2><span className="material-symbols-outlined">route</span>{language === 'vi' ? 'Hành Trình Đơn Hàng' : 'Order Journey'}</h2>
                      <Journey status={purchase.status} createdAt={purchase.createdAt} updatedAt={purchase.updatedAt} t={t} />
                    </article>

                    <article className="purchase-detail-card">
                      <h2>{language === 'vi' ? 'Sản Phẩm Đã Đặt' : 'Items Ordered'}</h2>
                      <div className="purchase-detail-item">
                        <img src={purchase.productImageUrl || '/vite.svg'} alt={purchase.productName || t('common.unnamed_product')} />
                        <div>
                          <div className="purchase-detail-item-top">
                            <h3>{purchase.productName || t('common.unnamed_product')}</h3>
                            <em className={`purchase-status ${getStatusClassName(purchase.status)}`}>
                              {getStatusLabel(purchase.status, t)}
                            </em>
                          </div>
                          <p>{language === 'vi' ? 'Người bán:' : 'Seller:'} {purchase.sellerName || purchase.sellerEmail || '-'}</p>
                          <p>{language === 'vi' ? 'Số lượng:' : 'Quantity:'} {purchase.quantity || 0}</p>
                          <strong>{formatVnd(purchase.unitPrice || purchase.finalAmount || 0)}</strong>
                        </div>
                      </div>
                    </article>

                    <article className="purchase-help-card">
                      <div>
                        <span className="material-symbols-outlined">support_agent</span>
                        <div>
                          <h2>{language === 'vi' ? 'Bạn cần trợ giúp về đơn hàng này?' : 'Need help with this order?'}</h2>
                          <p>{language === 'vi' ? 'Đội ngũ hỗ trợ của chúng tôi sẵn sàng giải đáp thắc mắc về thanh toán, giao hàng và trả hàng.' : 'Our support team can help with payment, shipping, and return questions.'}</p>
                        </div>
                      </div>
                      <Link to="/support">{language === 'vi' ? 'Liên Hệ Hỗ Trợ' : 'Contact Support'}</Link>
                    </article>
                  </section>

                  <aside className="purchase-detail-side">
                    <section className="purchase-detail-card">
                      <h2><span className="material-symbols-outlined">location_on</span>{language === 'vi' ? 'Địa Chỉ Giao Hàng' : 'Shipping Address'}</h2>
                      <p className="purchase-address">{purchase.addressSnapshot || (language === 'vi' ? 'Chưa có thông tin địa chỉ.' : 'No address snapshot available.')}</p>
                      <dl className="purchase-detail-dl">
                        <div><dt>{language === 'vi' ? 'Đơn vị vận chuyển' : 'Courier'}</dt><dd>{purchase.shippingProvider || '-'}</dd></div>
                        <div><dt>{language === 'vi' ? 'Mã vận đơn' : 'Tracking No.'}</dt><dd>{purchase.trackingCode || '-'}</dd></div>
                        <div><dt>{language === 'vi' ? 'Dự kiến giao' : 'Expected'}</dt><dd>{formatDateTime(purchase.expectedDeliveryTime)}</dd></div>
                      </dl>
                    </section>

                    <section className="purchase-payment-card">
                      <h2>{language === 'vi' ? 'Tóm Tắt Thanh Toán' : 'Payment Summary'}</h2>
                      <div><span>{language === 'vi' ? 'Tạm tính' : 'Subtotal'}</span><strong>{formatVnd(totals.subtotal)}</strong></div>
                      <div><span>{language === 'vi' ? 'Phí vận chuyển' : 'Shipping'}</span><strong>{formatVnd(totals.shipping)}</strong></div>
                      <div><span>{language === 'vi' ? 'Giảm giá Voucher' : 'Voucher Discount'}</span><strong>-{formatVnd(totals.discount)}</strong></div>
                      <hr />
                      <div className="total"><span>{language === 'vi' ? 'Tổng cộng' : 'Grand Total'}</span><strong>{formatVnd(totals.final)}</strong></div>
                    </section>

                    <section className="purchase-detail-actions">
                      {purchase.status === 'AwaitingPayment' && (
                        <button type="button" className="purchase-primary-btn" disabled={updating} onClick={payAgain}>
                          {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...') : (language === 'vi' ? 'Thanh toán lại' : 'Pay Again')}
                        </button>
                      )}
                      {purchase.status === 'Delivered' && (
                        <button type="button" className="purchase-primary-btn" disabled={updating} onClick={completePurchase}>
                          {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Updating...') : (language === 'vi' ? 'Xác nhận đã nhận hàng' : 'Mark Completed')}
                        </button>
                      )}
                      {purchase.status === 'Completed' && !purchase.hasReview && (
                        <button type="button" className="purchase-primary-btn" onClick={openReviewModal}>
                          {language === 'vi' ? 'Đánh giá' : 'Write Review'}
                        </button>
                      )}
                      {purchase.status === 'Completed' && isWithinReturnRequestWindow(purchase) && (
                        <button type="button" className="purchase-detail-btn request-return" disabled={updating} onClick={openReturnModal}>
                          {language === 'vi' ? 'Yêu cầu trả hàng' : 'Request Return'}
                        </button>
                      )}
                    </section>
                  </aside>
                </div>
              </>
            )}
          </div>

          <ReviewModal
            isOpen={reviewModalOpen}
            title={language === 'vi' ? 'Viết Đánh Giá' : 'Write a Review'}
            purchase={reviewTarget}
            submitting={reviewSubmitting}
            onClose={() => {
              setReviewModalOpen(false);
              setReviewTarget(null);
            }}
            onSubmit={handleSubmitReview}
          />

          {returnModalOpen && (
            <ReturnRequestModal
              purchase={purchase}
              reason={returnReason}
              submitting={returnSubmitting}
              onReasonChange={setReturnReason}
              onClose={closeReturnModal}
              onSubmit={handleSubmitReturn}
              language={language}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ReturnRequestModal({ purchase, reason, submitting, onReasonChange, onClose, onSubmit, language }) {
  return createPortal(
    <div className="purchase-return-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="purchase-return-modal" role="dialog" aria-modal="true" aria-labelledby="return-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="purchase-return-modal-close" onClick={onClose} disabled={submitting} aria-label="Close return request form">
          <span className="material-symbols-outlined">close</span>
        </button>
        <header>
          <h2 id="return-modal-title">{language === 'vi' ? 'Yêu Cầu Trả Hàng' : 'Request Return'}</h2>
          <p>{language === 'vi' ? 'Đơn hàng #' : 'Order #'}{purchase?.orderCode || purchase?.orderId}</p>
        </header>
        <form onSubmit={onSubmit}>
          <label className="purchase-return-reason">
            <span>{language === 'vi' ? 'Lý do trả hàng' : 'Return reason'}</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={language === 'vi' ? 'Mô tả lý do bạn muốn trả lại sản phẩm này...' : 'Describe why you want to return this purchase...'}
              rows={5}
              maxLength={1000}
              disabled={submitting}
            />
          </label>
          <div className="purchase-return-modal-actions">
            <button type="button" className="purchase-detail-btn" onClick={onClose} disabled={submitting}>
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button type="submit" className="purchase-primary-btn" disabled={submitting || !reason.trim()}>
              {submitting ? (language === 'vi' ? 'Đang gửi...' : 'Submitting...') : (language === 'vi' ? 'Gửi Yêu Cầu' : 'Submit Request')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Journey({ status, createdAt, updatedAt, t }) {
  if (!status) return null;
  const steps = getJourneySteps(t, status);
  const activeIndex = getActiveStepIndex(status, steps);
  const normStatus = String(status || '').toLowerCase();
  const dateStr = formatDateTime(updatedAt || createdAt);

  return (
    <div className="purchase-journey-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="purchase-journey" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, index) => {
          const isDone = index <= activeIndex;
          const isCurrent = index === activeIndex;
          const isSpecial = ['cancelled', 'deliveryfailed', 'returnrequested', 'returnrejected', 'returned'].includes(step.key.toLowerCase());

          return (
            <div
              key={step.key}
              className={`purchase-journey-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''} ${isSpecial && isCurrent ? step.key.toLowerCase() : ''}`}
            >
              <div>
                <span className="material-symbols-outlined">
                  {isDone && !isCurrent ? 'check' : step.icon}
                </span>
              </div>
              <strong>{step.label}</strong>
              <small>
                {isDone
                  ? formatDateTime(isCurrent ? updatedAt || createdAt : createdAt)
                  : t('order_status.pending')}
              </small>
            </div>
          );
        })}
      </div>

      {normStatus === 'cancelled' && (
        <div className="purchase-empty-state" style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>block</span>
          <h3 style={{ color: '#991b1b', margin: '4px 0' }}>{t('order_status.order_cancelled_title')}</h3>
          <p style={{ margin: 0, color: '#7f1d1d' }}>{t('order_status.order_cancelled_msg', { date: dateStr })}</p>
        </div>
      )}

      {normStatus === 'returnrequested' && (
        <div className="purchase-empty-state" style={{ padding: '16px', background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: '#7c3aed' }}>assignment_return</span>
          <h3 style={{ color: '#5b21b6', margin: '4px 0' }}>{t('order_status.return_requested_title')}</h3>
          <p style={{ margin: 0, color: '#6b21a8' }}>{t('order_status.return_requested_msg', { date: dateStr })}</p>
        </div>
      )}

      {normStatus === 'returnrejected' && (
        <div className="purchase-empty-state" style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>do_not_disturb_on</span>
          <h3 style={{ color: '#991b1b', margin: '4px 0' }}>{t('order_status.return_rejected_title')}</h3>
          <p style={{ margin: 0, color: '#7f1d1d' }}>{t('order_status.return_rejected_msg', { date: dateStr })}</p>
        </div>
      )}

      {normStatus === 'returned' && (
        <div className="purchase-empty-state" style={{ padding: '16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: '#d97706' }}>assignment_turned_in</span>
          <h3 style={{ color: '#92400e', margin: '4px 0' }}>{t('order_status.returned_title')}</h3>
          <p style={{ margin: 0, color: '#78350f' }}>{t('order_status.returned_msg', { date: dateStr })}</p>
        </div>
      )}
    </div>
  );
}


function isWithinReturnRequestWindow(purchase) {
  const updatedAt = Date.parse(purchase?.updatedAt || '');
  if (Number.isNaN(updatedAt)) return false;

  const elapsed = Date.now() - updatedAt;
  return elapsed >= 0 && elapsed <= returnRequestWindowMs;
}

function formatDateTime(value) {
  if (!value) return '-';
  return dateTimeFormatter.format(new Date(value));
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function getStatusLabel(status, t) {
  if (!status) return '-';
  const statusKeys = {
    AwaitingPayment: 'order_status.awaiting_payment',
    Pending: 'order_status.pending',
    Confirmed: 'order_status.confirmed',
    Shipping: 'order_status.shipping',
    Delivered: 'order_status.delivered',
    Completed: 'order_status.completed',
    DeliveryFailed: 'order_status.delivery_failed',
    ReturnRequested: 'order_status.return_requested',
    ReturnRejected: 'order_status.return_rejected',
    Returned: 'order_status.returned',
    Cancelled: 'order_status.cancelled',
  };
  const key = statusKeys[status];
  return key && typeof t === 'function' ? t(key) : status;
}

function getStatusClassName(status) {
  const classes = {
    AwaitingPayment: 'awaiting',
    Pending: 'pending',
    Confirmed: 'confirmed',
    Shipping: 'shipping',
    Delivered: 'delivered',
    Completed: 'completed',
    DeliveryFailed: 'delivery-failed',
    ReturnRequested: 'return-requested',
    ReturnRejected: 'return-rejected',
    Returned: 'returned',
    Cancelled: 'cancelled',
  };
  return classes[status] || 'default';
}
