import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderDetail.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const SHIPPING_PROVIDER = 'GHN';

const statusLabels = {
  AwaitingPayment: 'Awaiting Payment',
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Shipping: 'Shipping',
  Delivered: 'Delivered',
  Completed: 'Completed',
  Returned: 'Returned',
  Cancelled: 'Cancelled',
};

const statusClass = {
  AwaitingPayment: 'awaiting',
  Pending: 'pending',
  Confirmed: 'confirmed',
  Shipping: 'shipping',
  Delivered: 'delivered',
  Completed: 'completed',
  Returned: 'returned',
  Cancelled: 'cancelled',
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');

  const loadOrder = useCallback(async () => {
    if (!user?.userId) {
      return;
    }

    try {
      setLoading(true);
      const data = await orderService.getById(orderId, { sellerId: user.userId });
      setOrder(data);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load order detail.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast, user?.userId]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      loadOrder();
    }
  }, [isAdmin, isSeller, loadOrder, user]);

  useEffect(() => {
    if (!user?.userId || !isSeller) {
      return undefined;
    }

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderStatusChanged = (payload) => {
      if (payload?.orderId && payload.orderId !== orderId) {
        return;
      }

      setOrder((value) => (value ? { ...value, ...payload } : value));
      loadOrder();
    };

    connection.on('SellerOrderStatusChanged', handleOrderStatusChanged);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinSellerOrderGroup', user.userId);
        }
      } catch (error) {
        console.error('Failed to connect seller order hub:', error);
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('SellerOrderStatusChanged', handleOrderStatusChanged);
      if (connection.state === 'Connected') {
        connection.invoke('LeaveSellerOrderGroup', user.userId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [isSeller, loadOrder, orderId, user?.userId]);

  const totals = useMemo(
    () => ({
      subtotal: Number(order?.totalAmount || 0),
      shipping: Number(order?.shippingFee || 0),
      discount: Number(order?.discountAmount || 0),
      final: Number(order?.finalAmount || 0),
    }),
    [order]
  );
  const timeline = useMemo(() => getOrderTimeline(order), [order]);

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>Loading order...</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="sod-page animate-fade-in">
      <div className="sod-breadcrumb">
        <Link to="/seller-dashboard/orders">Orders</Link>
        <strong>{order?.orderCode || orderId}</strong>
      </div>

      {loading ? (
        <div className="sod-empty">Loading order detail...</div>
      ) : !order ? (
        <div className="sod-empty">Order not found.</div>
      ) : (
        <>
          <header className="sod-header">
            <div>
              <div className="sod-title-line">
                <h1>Order #{order.orderCode || order.orderId}</h1>
                <em className={`sod-status ${statusClass[order.status] || 'default'}`}>
                  {statusLabels[order.status] || order.status}
                </em>
              </div>
              <p>Created {formatDateTime(order.createdAt)} • Buyer {order.buyerName || 'Unknown Buyer'}</p>
            </div>
            <Link className="sod-back-btn" to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Orders
            </Link>
          </header>

          <div className="sod-layout">
            <section className="sod-main">
              <article className="sod-card sod-timeline-card">
                <h2><span className="material-symbols-outlined">route</span>Order Timeline</h2>
                <ol className="sod-timeline">
                  {timeline.map((step) => (
                    <li key={step.key} className={`sod-timeline-step ${step.state}`}>
                      <span className="sod-timeline-marker">
                        <span className="material-symbols-outlined">{step.icon}</span>
                      </span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>

              <article className="sod-card">
                <h2><span className="material-symbols-outlined">inventory_2</span>Order Item</h2>
                <div className="sod-item-row">
                  <div className="sod-product">
                    <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                    <div>
                      <strong>{order.productName || 'Untitled product'}</strong>
                      <small>{order.productId}</small>
                    </div>
                  </div>
                  <div className="sod-qty-cell">
                    <span>Quantity</span>
                    <strong>{order.quantity || 0}</strong>
                  </div>
                  <div className="sod-price-cell">
                    <span>Unit Price</span>
                    <strong>{formatVnd(order.unitPrice || 0)}</strong>
                  </div>
                  <div className="sod-price-cell total">
                    <span>Final Amount</span>
                    <strong>{formatVnd(order.finalAmount || 0)}</strong>
                  </div>
                </div>
              </article>

              <article className="sod-card">
                <h2><span className="material-symbols-outlined">receipt_long</span>Order Snapshot</h2>
                <div className="sod-snapshot-grid">
                  <div>
                    <span>Status</span>
                    <strong>{statusLabels[order.status] || order.status || '-'}</strong>
                  </div>
                  <div>
                    <span>Provider</span>
                    <strong>{order.shippingProvider || SHIPPING_PROVIDER}</strong>
                  </div>
                  <div>
                    <span>Expected Delivery</span>
                    <strong>{formatDateTime(order.expectedDeliveryTime)}</strong>
                  </div>
                  <div>
                    <span>Updated</span>
                    <strong>{formatDateTime(order.updatedAt)}</strong>
                  </div>
                </div>
              </article>
            </section>

            <aside className="sod-side">
              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">person</span>Buyer</h3>
                <strong>{order.buyerName || 'Unknown Buyer'}</strong>
                <p><span className="material-symbols-outlined">mail</span>{order.buyerEmail || '-'}</p>
                <p><span className="material-symbols-outlined">call</span>{order.buyerPhone || getPhoneFromAddressSnapshot(order.addressSnapshot) || '-'}</p>
              </article>

              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">local_shipping</span>Shipping</h3>
                <dl>
                  <div><dt>Provider</dt><dd>{order.shippingProvider || SHIPPING_PROVIDER}</dd></div>
                  {order.trackingCode && <div><dt>Tracking</dt><dd>{order.trackingCode}</dd></div>}
                  <div><dt>Expected</dt><dd>{formatDateTime(order.expectedDeliveryTime)}</dd></div>
                </dl>
              </article>

              <article className="sod-summary-card">
                <h3>Payment Summary</h3>
                <div><span>Subtotal</span><strong>{formatVnd(totals.subtotal)}</strong></div>
                <div><span>Shipping</span><strong>{formatVnd(totals.shipping)}</strong></div>
                <div><span>Discount</span><strong>-{formatVnd(totals.discount)}</strong></div>
                <hr />
                <div className="total"><span>Total</span><strong>{formatVnd(totals.final)}</strong></div>
              </article>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return dateTimeFormatter.format(new Date(value));
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function getOrderTimeline(order) {
  if (!order) return [];

  if (order.status === 'Cancelled') {
    return [
      timelineStep('placed', 'Order Placed', formatDateTime(order.createdAt), 'done', 'check'),
      timelineStep('cancelled', 'Order Cancelled', formatDateTime(order.updatedAt), 'danger', 'close'),
    ];
  }

  const rank = getStatusRank(order.status);
  const stateFor = (status) => {
    const targetRank = getStatusRank(status);
    if (order.status === status) return 'current';
    return rank > targetRank ? 'done' : 'pending';
  };

  const steps = [
    timelineStep('placed', 'Order Placed', formatDateTime(order.createdAt), 'done', 'check'),
    timelineStep(
      'payment',
      'Payment Confirmed',
      order.status === 'AwaitingPayment' ? 'Waiting for buyer payment' : formatDateTime(order.updatedAt || order.createdAt),
      order.status === 'AwaitingPayment' ? 'current' : stateFor('Pending'),
      rank > getStatusRank('Pending') ? 'check' : 'schedule'
    ),
    timelineStep(
      'confirmed',
      'Seller Confirmed',
      rank >= getStatusRank('Confirmed') ? formatDateTime(order.updatedAt) : 'Waiting for seller confirmation',
      stateFor('Confirmed'),
      rank > getStatusRank('Confirmed') ? 'check' : 'inventory'
    ),
    timelineStep(
      'shipping',
      'In Transit',
      rank >= getStatusRank('Shipping')
        ? `Provider: ${order.shippingProvider || SHIPPING_PROVIDER}`
        : 'Waiting for GHN handoff',
      stateFor('Shipping'),
      'local_shipping'
    ),
    timelineStep(
      'delivered',
      'Delivered',
      rank >= getStatusRank('Delivered')
        ? formatDateTime(order.updatedAt)
        : `Estimated Delivery: ${formatDateTime(order.expectedDeliveryTime)}`,
      stateFor('Delivered'),
      rank > getStatusRank('Delivered') ? 'check' : 'radio_button_unchecked'
    ),
    timelineStep(
      'completed',
      'Completed',
      order.status === 'Completed' ? formatDateTime(order.updatedAt) : 'Waiting for buyer confirmation',
      stateFor('Completed'),
      order.status === 'Completed' ? 'verified' : 'task_alt'
    ),
  ];

  if (order.status === 'Returned') {
    steps.push(timelineStep('returned', 'Returned', formatDateTime(order.updatedAt), 'warning', 'assignment_return'));
  }

  return steps;
}

function timelineStep(key, title, detail, state, icon) {
  return { key, title, detail, state, icon };
}

function getStatusRank(status) {
  const ranks = {
    AwaitingPayment: 0,
    Pending: 1,
    Confirmed: 2,
    Shipping: 3,
    Delivered: 4,
    Completed: 5,
    Returned: 6,
  };

  return ranks[status] ?? 0;
}

function getPhoneFromAddressSnapshot(snapshot) {
  if (!snapshot) return null;

  const parts = String(snapshot)
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.find((part) => /^\d{9,12}$/.test(part)) || null;
}
