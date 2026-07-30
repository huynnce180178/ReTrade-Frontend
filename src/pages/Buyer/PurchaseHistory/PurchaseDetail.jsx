import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import ReviewModal from '../../../components/ReviewModal/ReviewModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import purchaseService from '../../../services/purchaseService';
import reviewService from '../../../services/reviewService';
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

const getJourneySteps = (language) => [
  { key: 'AwaitingPayment', label: language === 'vi' ? 'Chờ thanh toán' : 'Awaiting Payment', icon: 'receipt_long' },
  { key: 'Pending', label: language === 'vi' ? 'Đang xử lý' : 'Processing', icon: 'inventory' },
  { key: 'Confirmed', label: language === 'vi' ? 'Đã xác nhận' : 'Confirmed', icon: 'verified_user' },
  { key: 'Shipping', label: language === 'vi' ? 'Đang giao' : 'Shipping', icon: 'local_shipping' },
  { key: 'Delivered', label: language === 'vi' ? 'Đã giao' : 'Delivered', icon: 'package_2' },
  { key: 'Completed', label: language === 'vi' ? 'Hoàn thành' : 'Completed', icon: 'check_circle' },
];

const statusOrder = ['AwaitingPayment', 'Pending', 'Confirmed', 'Shipping', 'Delivered', 'Completed'];
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

  const handleSubmitReview = async ({ rating, comment }) => {
    if (!buyerId || !reviewTarget?.orderId) return;

    try {
      setReviewSubmitting(true);
      await reviewService.create(buyerId, {
        orderId: reviewTarget.orderId,
        rating,
        comment,
      });
      showToast(language === 'vi' ? 'Đã gửi đánh giá thành công!' : 'Review submitted successfully.', 'success');
      setReviewModalOpen(false);
      setReviewTarget(null);
      loadPurchase();
    } catch (error) {
      showToast(error?.response?.data || (language === 'vi' ? 'Không thể gửi đánh giá.' : 'Failed to submit review.'), 'error');
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
                    <h1>{language === 'vi' ? 'Đơn hàng #' : 'Order #'}{purchase.orderCode || purchase.orderId}</h1>
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
                      <Journey status={purchase.status} createdAt={purchase.createdAt} updatedAt={purchase.updatedAt} language={language} />
                    </article>

                    <article className="purchase-detail-card">
                      <h2>{language === 'vi' ? 'Sản Phẩm Đã Đặt' : 'Items Ordered'}</h2>
                      <div className="purchase-detail-item">
                        <img src={purchase.productImageUrl || '/vite.svg'} alt={purchase.productName || t('common.unnamed_product')} />
                        <div>
                          <div className="purchase-detail-item-top">
                            <h3>{purchase.productName || t('common.unnamed_product')}</h3>
                            <em className={`purchase-status ${getStatusClassName(purchase.status)}`}>
                              {getStatusLabel(purchase.status, language)}
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
                      {['AwaitingPayment', 'Pending', 'Confirmed'].includes(purchase.status) && (
                        <button type="button" className="purchase-text-danger" disabled={updating} onClick={cancelPurchase}>
                          {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Updating...') : (language === 'vi' ? 'Hủy đơn hàng' : 'Cancel Purchase')}
                        </button>
                      )}
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
  return (
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
    </div>
  );
}

function Journey({ status, createdAt, updatedAt, language }) {
  if (!status) return null;
  const isVi = language === 'vi';

  if (String(status).toLowerCase() === 'cancelled') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">block</span>
        <h3>{isVi ? 'Đơn Hàng Đã Bị Hủy' : 'Order Cancelled'}</h3>
        <p>{isVi ? `Đơn hàng này đã bị hủy vào ${formatDateTime(updatedAt || createdAt)}.` : `This order was cancelled on ${formatDateTime(updatedAt || createdAt)}.`}</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'deliveryfailed') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">report</span>
        <h3>{isVi ? 'Giao Hàng Thất Bại' : 'Delivery Failed'}</h3>
        <p>{isVi ? `Đơn vị vận chuyển không thể hoàn tất giao hàng vào ${formatDateTime(updatedAt || createdAt)}.` : `The carrier could not complete delivery on ${formatDateTime(updatedAt || createdAt)}.`}</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returnrequested') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">assignment_return</span>
        <h3>{isVi ? 'Đã Gửi Yêu Cầu Trả Hàng' : 'Return Requested'}</h3>
        <p>{isVi ? `Yêu cầu trả hàng của bạn đã gửi vào ${formatDateTime(updatedAt || createdAt)}.` : `Your return request was submitted on ${formatDateTime(updatedAt || createdAt)}.`}</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returnrejected') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">do_not_disturb_on</span>
        <h3>{isVi ? 'Yêu Cầu Trả Hàng Bị Từ Chối' : 'Return Rejected'}</h3>
        <p>{isVi ? `Người bán đã từ chối yêu cầu trả hàng vào ${formatDateTime(updatedAt || createdAt)}.` : `The seller rejected this return request on ${formatDateTime(updatedAt || createdAt)}.`}</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returned') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">assignment_turned_in</span>
        <h3>{isVi ? 'Đã Trả Hàng Thành Công' : 'Returned'}</h3>
        <p>{isVi ? `Đơn hàng đã được duyệt trả hàng vào ${formatDateTime(updatedAt || createdAt)}.` : `This purchase was approved for return on ${formatDateTime(updatedAt || createdAt)}.`}</p>
      </div>
    );
  }

  const steps = getJourneySteps(language);
  const activeIndex = statusOrder.indexOf(status);
  const hasActive = activeIndex >= 0;

  return (
    <div className="purchase-journey">
      {steps.map((step, index) => {
        const isDone = hasActive && index <= activeIndex;
        const isCurrent = hasActive && index === activeIndex;

        return (
          <div key={step.key} className={`purchase-journey-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
            <div>
              <span className="material-symbols-outlined">{isDone ? 'check' : step.icon}</span>
            </div>
            <strong>{step.label}</strong>
            <small>{isDone ? formatDateTime(isCurrent ? updatedAt || createdAt : createdAt) : (isVi ? 'Chờ xử lý' : 'Pending')}</small>
          </div>
        );
      })}
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

function getStatusLabel(status, language) {
  if (!status) return 'Unknown';
  const labelsVi = {
    AwaitingPayment: 'Chờ thanh toán',
    Pending: 'Đang xử lý',
    Confirmed: 'Đã xác nhận',
    Shipping: 'Đang giao hàng',
    Delivered: 'Đã giao hàng',
    Completed: 'Hoàn thành',
    DeliveryFailed: 'Giao hàng thất bại',
    ReturnRequested: 'Yêu cầu trả hàng',
    ReturnRejected: 'Bị từ chối trả hàng',
    Returned: 'Đã trả hàng',
    Cancelled: 'Đã hủy',
  };
  const labelsEn = {
    AwaitingPayment: 'Waiting for Payment',
    Pending: 'Processing',
    Confirmed: 'Confirmed',
    Shipping: 'Shipping',
    Delivered: 'Delivered',
    Completed: 'Completed',
    DeliveryFailed: 'Delivery Failed',
    ReturnRequested: 'Return Requested',
    ReturnRejected: 'Return Rejected',
    Returned: 'Returned',
    Cancelled: 'Cancelled',
  };
  return language === 'vi' ? (labelsVi[status] || status) : (labelsEn[status] || status);
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
