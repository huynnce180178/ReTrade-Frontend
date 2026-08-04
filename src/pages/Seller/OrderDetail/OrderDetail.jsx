import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import { formatDateTimeGmt7 } from '../../../utils/dateTime';
import './OrderDetail.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const SHIPPING_PROVIDER = 'GHN';

export default function OrderDetail() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const statusLabels = useMemo(() => ({
    AwaitingPayment: t('order_status.awaiting_payment'),
    Pending: t('order_status.pending'),
    Confirmed: t('order_status.confirmed'),
    Shipping: t('order_status.shipping'),
    Delivered: t('order_status.delivered'),
    Completed: t('order_status.completed'),
    DeliveryFailed: t('order_status.delivery_failed'),
    Returned: t('order_status.returned'),
    ReturnRequested: t('order_status.return_requested'),
    ReturnRejected: t('order_status.return_rejected'),
    Cancelled: t('order_status.cancelled'),
  }), [t]);

  const statusClass = {
    AwaitingPayment: 'awaiting',
    Pending: 'pending',
    Confirmed: 'confirmed',
    Shipping: 'shipping',
    Delivered: 'delivered',
    Completed: 'completed',
    DeliveryFailed: 'delivery-failed',
    Returned: 'returned',
    ReturnRequested: 'return-requested',
    ReturnRejected: 'return-rejected',
    Cancelled: 'cancelled',
  };

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
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast, user?.userId, t]);

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
      connection.stop().catch(() => {});
    };
  }, [isSeller, loadOrder, orderId, user?.userId]);

  const totals = useMemo(() => {
    const subtotal = Number(order?.totalPrice ?? order?.unitPrice ?? 0);
    const shipping = Number(order?.shippingFee ?? 0);
    const discount = Number(order?.discountAmount ?? 0);
    const final = Number(order?.finalAmount ?? subtotal + shipping - discount);
    return { subtotal, shipping, discount, final };
  }, [order]);

  const timeline = useMemo(() => getOrderTimeline(order, t), [order, t]);

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{t('common.loading')}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="sod-page animate-fade-in">
      <div className="sod-breadcrumb">
        <Link to="/seller-dashboard/orders">{t('seller.orders_management')}</Link>
        <strong>{order?.orderCode || orderId}</strong>
      </div>

      {loading ? (
        <div className="sod-empty">{t('common.loading')}</div>
      ) : !order ? (
        <div className="sod-empty">{t('common.no_data')}</div>
      ) : (
        <>
          <header className="sod-header">
            <div>
              <div className="sod-title-line">
                <h1>{t('order_detail.title', { id: order.orderCode || order.orderId })}</h1>
                <em className={`sod-status ${statusClass[order.status] || 'default'}`}>
                  {statusLabels[order.status] || order.status}
                </em>
              </div>
              <p>{t('history.order_date')} {formatDateTime(order.createdAt)} • {t('order_detail.buyer_info')} {order.buyerName || t('common.unknown_buyer')}</p>
            </div>
            <Link className="sod-back-btn" to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">arrow_back</span>
              {t('common.back')}
            </Link>
          </header>

          <div className="sod-layout">
            <section className="sod-main">
              <article className="sod-card sod-timeline-card">
                <h2><span className="material-symbols-outlined">route</span>{t('history.order_status')}</h2>
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
                <h2><span className="material-symbols-outlined">inventory_2</span>{t('order_detail.items_info')}</h2>
                <div className="sod-item-row">
                  <div className="sod-product">
                    <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || t('nav.product')} />
                    <div>
                      <strong>{order.productName || t('nav.product')}</strong>
                      <small>{order.productId}</small>
                    </div>
                  </div>
                  <div className="sod-qty-cell">
                    <span>{t('common.quantity')}</span>
                    <strong>{order.quantity || 0}</strong>
                  </div>
                  <div className="sod-price-cell">
                    <span>{t('common.price')}</span>
                    <strong>{formatVnd(order.unitPrice || 0)}</strong>
                  </div>
                  <div className="sod-price-cell total">
                    <span>{t('checkout.total_payment')}</span>
                    <strong>{formatVnd(order.finalAmount || 0)}</strong>
                  </div>
                </div>
              </article>

              <article className="sod-card">
                <h2><span className="material-symbols-outlined">receipt_long</span>{t('checkout.order_summary')}</h2>
                <div className="sod-snapshot-grid">
                  <div>
                    <span>{t('common.status')}</span>
                    <strong>{statusLabels[order.status] || order.status || '-'}</strong>
                  </div>
                  <div>
                    <span>{t('order_detail.shipping_unit')}</span>
                    <strong>{order.shippingProvider || SHIPPING_PROVIDER}</strong>
                  </div>
                  <div>
                    <span>{t('history.order_date')}</span>
                    <strong>{formatDateTime(order.expectedDeliveryTime)}</strong>
                  </div>
                  <div>
                    <span>{t('common.updated_at')}</span>
                    <strong>{formatDateTime(order.updatedAt)}</strong>
                  </div>
                </div>
              </article>
            </section>

            <aside className="sod-side">
              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">person</span>{t('order_detail.buyer_info')}</h3>
                <strong>{order.buyerName || t('common.unknown_buyer')}</strong>
                <p><span className="material-symbols-outlined">mail</span>{order.buyerEmail || '-'}</p>
                <p><span className="material-symbols-outlined">call</span>{order.buyerPhone || getPhoneFromAddressSnapshot(order.addressSnapshot) || '-'}</p>
              </article>

              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">local_shipping</span>{t('order_detail.shipping_info')}</h3>
                <dl>
                  <div><dt>{t('order_detail.shipping_unit')}</dt><dd>{order.shippingProvider || SHIPPING_PROVIDER}</dd></div>
                  {order.trackingCode && <div><dt>{t('order_detail.tracking_number')}</dt><dd>{order.trackingCode}</dd></div>}
                  <div><dt>{t('history.order_date')}</dt><dd>{formatDateTime(order.expectedDeliveryTime)}</dd></div>
                </dl>
              </article>

              <article className="sod-summary-card">
                <h3>{t('order_detail.payment_summary')}</h3>
                <div><span>{t('checkout.subtotal')}</span><strong>{formatVnd(totals.subtotal)}</strong></div>
                <div><span>{t('checkout.shipping_fee')}</span><strong>{formatVnd(totals.shipping)}</strong></div>
                <div><span>{t('checkout.discount')}</span><strong>-{formatVnd(totals.discount)}</strong></div>
                <hr />
                <div className="total"><span>{t('checkout.total_payment')}</span><strong>{formatVnd(totals.final)}</strong></div>
              </article>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function formatDateTime(value) {
  return formatDateTimeGmt7(value);
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function getOrderTimeline(order, t) {
  if (!order) return [];

  if (order.status === 'Cancelled') {
    return [
      timelineStep('placed', t('history.status_pending'), formatDateTime(order.createdAt), 'done', 'check'),
      timelineStep('cancelled', t('history.status_cancelled'), formatDateTime(order.updatedAt), 'danger', 'close'),
    ];
  }

  const rank = getStatusRank(order.status);
  const stateFor = (status) => {
    const targetRank = getStatusRank(status);
    if (order.status === status) return 'current';
    return rank > targetRank ? 'done' : 'pending';
  };

  const steps = [
    timelineStep('placed', t('history.status_pending'), formatDateTime(order.createdAt), 'done', 'check'),
    timelineStep(
      'payment',
      t('sales_stats.confirmed'),
      order.status === 'AwaitingPayment' ? t('sales_stats.awaiting_payment') : formatDateTime(order.updatedAt || order.createdAt),
      order.status === 'AwaitingPayment' ? 'current' : stateFor('Pending'),
      rank > getStatusRank('Pending') ? 'check' : 'schedule'
    ),
    timelineStep(
      'confirmed',
      t('sales_stats.confirmed'),
      rank >= getStatusRank('Confirmed') ? formatDateTime(order.updatedAt) : t('history.status_pending'),
      stateFor('Confirmed'),
      rank > getStatusRank('Confirmed') ? 'check' : 'inventory'
    ),
    timelineStep(
      'shipping',
      t('sales_stats.shipping'),
      rank >= getStatusRank('Shipping')
        ? `${t('order_detail.shipping_unit')}: ${order.shippingProvider || SHIPPING_PROVIDER}`
        : t('sales_stats.shipping'),
      stateFor('Shipping'),
      'local_shipping'
    ),
  ];

  if (order.status === 'DeliveryFailed') {
    steps.push(timelineStep('delivery-failed', t('sales_stats.delivery_failed'), formatDateTime(order.updatedAt), 'danger', 'report'));
    return steps;
  }

  steps.push(
    timelineStep(
      'delivered',
      t('sales_stats.delivered'),
      rank >= getStatusRank('Delivered')
        ? formatDateTime(order.updatedAt)
        : `${t('history.order_date')}: ${formatDateTime(order.expectedDeliveryTime)}`,
      stateFor('Delivered'),
      rank > getStatusRank('Delivered') ? 'check' : 'radio_button_unchecked'
    ),
    timelineStep(
      'completed',
      t('sales_stats.completed'),
      order.status === 'Completed' ? formatDateTime(order.updatedAt) : t('history.status_delivered'),
      stateFor('Completed'),
      order.status === 'Completed' ? 'verified' : 'task_alt'
    )
  );

  if (['ReturnRequested', 'ReturnRejected', 'Returned'].includes(order.status)) {
    if (order.status === 'ReturnRequested') {
      steps.push(timelineStep('return-requested', t('history.refund_reason'), formatDateTime(order.updatedAt), 'info', 'assignment_return'));
    } else if (order.status === 'ReturnRejected') {
      steps.push(timelineStep('return-rejected', t('admin.reject'), formatDateTime(order.updatedAt), 'danger', 'assignment_return'));
    } else {
      steps.push(timelineStep('returned', t('sales_stats.returned'), formatDateTime(order.updatedAt), 'warning', 'assignment_return'));
    }
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
    DeliveryFailed: 4,
    Completed: 5,
    Returned: 6,
    ReturnRequested: 6,
    ReturnRejected: 6,
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
