import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import ReviewModal from '../../../components/ReviewModal/ReviewModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
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

const journeySteps = [
  { key: 'AwaitingPayment', label: 'Awaiting Payment', icon: 'receipt_long' },
  { key: 'Pending', label: 'Processing', icon: 'inventory' },
  { key: 'Confirmed', label: 'Confirmed', icon: 'verified_user' },
  { key: 'Shipping', label: 'Shipping', icon: 'local_shipping' },
  { key: 'Delivered', label: 'Delivered', icon: 'package_2' },
  { key: 'Completed', label: 'Completed', icon: 'check_circle' },
];

const statusOrder = journeySteps.map((step) => step.key);
const returnRequestWindowMs = 7 * 24 * 60 * 60 * 1000;

export default function PurchaseDetail() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

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
      showToast(error?.response?.data || 'Failed to load purchase detail.', 'error');
    } finally {
      setLoading(false);
    }
  }, [buyerId, orderId, showToast]);

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

  // Ensure the page scrolls to top when viewing a detail
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
      // ignore non-browser environments
    }
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
      showToast('Purchase marked as completed.', 'success');
      setReviewTarget(updated ? { ...purchase, ...updated } : purchase);
      setReviewModalOpen(true);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to complete purchase.', 'error');
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
      showToast('Review submitted successfully.', 'success');
      setReviewModalOpen(false);
      setReviewTarget(null);
      loadPurchase();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to submit review.', 'error');
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
      showToast('Please enter a return reason.', 'warning');
      return;
    }

    try {
      setReturnSubmitting(true);
      setUpdating(true);
      const updated = await purchaseService.requestReturn(buyerId, purchase.orderId, reason);
      setPurchase(updated);
      setReturnModalOpen(false);
      setReturnReason('');
      showToast('Return request submitted.', 'success');
    } catch (error) {
      showToast(error?.response?.data || 'Failed to submit return request.', 'error');
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
        amount: Number(purchase.finalAmount || purchase.totalAmount || totals.final || 0),
        orderDescription: `Payment for order ${purchase.orderCode || purchase.orderId}`,
      };

      const resp = await paymentService.createVnpayPaymentUrl(payload);

      // Response may be a string URL or an object containing the URL
      const url =
        typeof resp === 'string'
          ? resp
          : resp?.paymentUrl || resp?.url || resp?.paymentLink || null;

      if (!url) {
        showToast('Payment URL not returned from server.', 'error');
        return;
      }

      // Redirect to VNPay
      window.location.href = url;
    } catch (error) {
      showToast(error?.response?.data || 'Failed to create payment link.', 'error');
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
      showToast('Purchase cancelled successfully.', 'success');
    } catch (error) {
      showToast(error?.response?.data || 'Failed to cancel purchase.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading purchase detail...</p>
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
              <Link to="/profile">Profile</Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <Link to="/purchase-history">Purchase History</Link>
              <span className="material-symbols-outlined">chevron_right</span>
              <strong>#{purchase?.orderCode || orderId}</strong>
            </nav>

              {loading ? (
              <div className="purchase-empty-state">
                <span className="btn-spinner"></span>
                <p>Loading purchase detail...</p>
              </div>
            ) : !purchase ? (
              <div className="purchase-empty-state">
                <span className="material-symbols-outlined">receipt_long</span>
                <h3>Purchase not found</h3>
                <p>This order may have been removed or is not available for this account.</p>
              </div>
            ) : (
              <>
                <header className="purchase-detail-header">
                  <div>
                    <h1>Order #{purchase.orderCode || purchase.orderId}</h1>
                    <p>Placed on {formatDateTime(purchase.createdAt)}</p>
                  </div>
                  <div>
                    <span>Total Amount</span>
                    <strong>{formatVnd(totals.final)}</strong>
                  </div>
                </header>

                <div className="purchase-detail-layout">
                  <section className="purchase-detail-main">
                    <article className="purchase-detail-card">
                      <h2><span className="material-symbols-outlined">route</span>Order Journey</h2>
                      <Journey status={purchase.status} createdAt={purchase.createdAt} updatedAt={purchase.updatedAt} />
                    </article>

                    <article className="purchase-detail-card">
                      <h2>Items Ordered</h2>
                      <div className="purchase-detail-item">
                        <img src={purchase.productImageUrl || '/vite.svg'} alt={purchase.productName || 'Purchased product'} />
                        <div>
                          <div className="purchase-detail-item-top">
                            <h3>{purchase.productName || 'Untitled product'}</h3>
                            <em className={`purchase-status ${getStatusClassName(purchase.status)}`}>
                              {getStatusLabel(purchase.status)}
                            </em>
                          </div>
                          <p>Seller: {purchase.sellerName || purchase.sellerEmail || '-'}</p>
                          <p>Quantity: {purchase.quantity || 0}</p>
                          <strong>{formatVnd(purchase.unitPrice || purchase.finalAmount || 0)}</strong>
                        </div>
                      </div>
                    </article>

                    <article className="purchase-help-card">
                      <div>
                        <span className="material-symbols-outlined">support_agent</span>
                        <div>
                          <h2>Need help with this order?</h2>
                          <p>Our support team can help with payment, shipping, and return questions.</p>
                        </div>
                      </div>
                      <Link to="/support">Contact Support</Link>
                    </article>
                  </section>

                  <aside className="purchase-detail-side">
                    <section className="purchase-detail-card">
                      <h2><span className="material-symbols-outlined">location_on</span>Shipping Address</h2>
                      <p className="purchase-address">{purchase.addressSnapshot || 'No address snapshot available.'}</p>
                      <dl className="purchase-detail-dl">
                        <div><dt>Courier</dt><dd>{purchase.shippingProvider || '-'}</dd></div>
                        <div><dt>Tracking No.</dt><dd>{purchase.trackingCode || '-'}</dd></div>
                        <div><dt>Expected</dt><dd>{formatDateTime(purchase.expectedDeliveryTime)}</dd></div>
                      </dl>
                    </section>

                    <section className="purchase-payment-card">
                      <h2>Payment Summary</h2>
                      <div><span>Subtotal</span><strong>{formatVnd(totals.subtotal)}</strong></div>
                      <div><span>Shipping</span><strong>{formatVnd(totals.shipping)}</strong></div>
                      <div><span>Voucher Discount</span><strong>-{formatVnd(totals.discount)}</strong></div>
                      <hr />
                      <div className="total"><span>Grand Total</span><strong>{formatVnd(totals.final)}</strong></div>
                    </section>

                    <section className="purchase-detail-actions">
                      {['AwaitingPayment', 'Pending', 'Confirmed'].includes(purchase.status) && (
                        <button type="button" className="purchase-text-danger" disabled={updating} onClick={cancelPurchase}>
                          {updating ? 'Updating...' : 'Cancel Purchase'}
                        </button>
                      )}
                      {purchase.status === 'AwaitingPayment' && (
                        <button type="button" className="purchase-primary-btn" disabled={updating} onClick={payAgain}>
                          {updating ? 'Processing...' : 'Pay Again'}
                        </button>
                      )}
                      {purchase.status === 'Delivered' && (
                        <button type="button" className="purchase-primary-btn" disabled={updating} onClick={completePurchase}>
                          {updating ? 'Updating...' : 'Mark Completed'}
                        </button>
                      )}
                      {purchase.status === 'Completed' && !purchase.hasReview && (
                        <button type="button" className="purchase-primary-btn" onClick={openReviewModal}>
                          Write Review
                        </button>
                      )}
                      {purchase.status === 'Completed' && isWithinReturnRequestWindow(purchase) && (
                        <button type="button" className="purchase-detail-btn request-return" disabled={updating} onClick={openReturnModal}>
                          Request Return
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
            title="Write a Review"
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
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ReturnRequestModal({ purchase, reason, submitting, onReasonChange, onClose, onSubmit }) {
  return (
    <div className="purchase-return-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="purchase-return-modal" role="dialog" aria-modal="true" aria-labelledby="return-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="purchase-return-modal-close" onClick={onClose} disabled={submitting} aria-label="Close return request form">
          <span className="material-symbols-outlined">close</span>
        </button>
        <header>
          <h2 id="return-modal-title">Request Return</h2>
          <p>Order #{purchase?.orderCode || purchase?.orderId}</p>
        </header>
        <form onSubmit={onSubmit}>
          <label className="purchase-return-reason">
            <span>Return reason</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Describe why you want to return this purchase..."
              rows={5}
              maxLength={1000}
              disabled={submitting}
            />
          </label>
          <div className="purchase-return-modal-actions">
            <button type="button" className="purchase-detail-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="purchase-primary-btn" disabled={submitting || !reason.trim()}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Journey({ status, createdAt, updatedAt }) {
  // If cancelled, show a clear cancelled state instead of the journey
  if (!status) return null;
  if (String(status).toLowerCase() === 'cancelled') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">block</span>
        <h3>Order Cancelled</h3>
        <p>This order was cancelled on {formatDateTime(updatedAt || createdAt)}.</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'deliveryfailed') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">report</span>
        <h3>Delivery Failed</h3>
        <p>The carrier could not complete delivery on {formatDateTime(updatedAt || createdAt)}.</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returnrequested') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">assignment_return</span>
        <h3>Return Requested</h3>
        <p>Your return request was submitted on {formatDateTime(updatedAt || createdAt)}.</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returnrejected') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">do_not_disturb_on</span>
        <h3>Return Rejected</h3>
        <p>The seller rejected this return request on {formatDateTime(updatedAt || createdAt)}.</p>
      </div>
    );
  }

  if (String(status).toLowerCase() === 'returned') {
    return (
      <div className="purchase-empty-state">
        <span className="material-symbols-outlined">assignment_turned_in</span>
        <h3>Returned</h3>
        <p>This purchase was approved for return on {formatDateTime(updatedAt || createdAt)}.</p>
      </div>
    );
  }

  const activeIndex = statusOrder.indexOf(status);
  const hasActive = activeIndex >= 0;

  return (
    <div className="purchase-journey">
      {journeySteps.map((step, index) => {
        const isDone = hasActive && index <= activeIndex;
        const isCurrent = hasActive && index === activeIndex;

        return (
          <div key={step.key} className={`purchase-journey-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
            <div>
              <span className="material-symbols-outlined">{isDone ? 'check' : step.icon}</span>
            </div>
            <strong>{step.label}</strong>
            <small>{isDone ? formatDateTime(isCurrent ? updatedAt || createdAt : createdAt) : 'Pending'}</small>
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

function getStatusLabel(status) {
  if (!status) return 'Unknown';
  const labels = {
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
  return labels[status] || status;
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
