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
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const statusLabels = useMemo(() => ({
    AwaitingPayment: isVi ? 'Chờ thanh toán' : 'Awaiting Payment',
    Pending: isVi ? 'Chờ xử lý' : 'Pending',
    Confirmed: isVi ? 'Đã xác nhận' : 'Confirmed',
    Shipping: isVi ? 'Đang giao' : 'Shipping',
    Delivered: isVi ? 'Đã giao' : 'Delivered',
    Completed: isVi ? 'Hoàn thành' : 'Completed',
    DeliveryFailed: isVi ? 'Giao thất bại' : 'Delivery Failed',
    Returned: isVi ? 'Đã trả hàng' : 'Returned',
    ReturnRequested: isVi ? 'Yêu cầu trả hàng' : 'Return Requested',
    ReturnRejected: isVi ? 'Từ chối trả hàng' : 'Return Rejected',
    Cancelled: isVi ? 'Đã hủy' : 'Cancelled',
  }), [isVi]);

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
      showToast(error?.response?.data || (isVi ? 'Không thể tải chi tiết đơn hàng.' : 'Failed to load order detail.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast, user?.userId, isVi]);

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

  const timeline = useMemo(() => getOrderTimeline(order, isVi), [order, isVi]);

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{isVi ? 'Đang tải đơn hàng...' : 'Loading order...'}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="sod-page animate-fade-in">
      <div className="sod-breadcrumb">
        <Link to="/seller-dashboard/orders">{isVi ? 'Đơn Hàng' : 'Orders'}</Link>
        <strong>{order?.orderCode || orderId}</strong>
      </div>

      {loading ? (
        <div className="sod-empty">{isVi ? 'Đang tải chi tiết đơn hàng...' : 'Loading order detail...'}</div>
      ) : !order ? (
        <div className="sod-empty">{isVi ? 'Không tìm thấy đơn hàng.' : 'Order not found.'}</div>
      ) : (
        <>
          <header className="sod-header">
            <div>
              <div className="sod-title-line">
                <h1>{isVi ? 'Đơn Hàng' : 'Order'} #{order.orderCode || order.orderId}</h1>
                <em className={`sod-status ${statusClass[order.status] || 'default'}`}>
                  {statusLabels[order.status] || order.status}
                </em>
              </div>
              <p>{isVi ? 'Đặt hàng lúc' : 'Created'} {formatDateTime(order.createdAt)} • {isVi ? 'Người mua' : 'Buyer'} {order.buyerName || (isVi ? 'Khách hàng' : 'Unknown Buyer')}</p>
            </div>
            <Link className="sod-back-btn" to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">arrow_back</span>
              {isVi ? 'Quay lại danh sách' : 'Back to Orders'}
            </Link>
          </header>

          <div className="sod-layout">
            <section className="sod-main">
              <article className="sod-card sod-timeline-card">
                <h2><span className="material-symbols-outlined">route</span>{isVi ? 'Hành Trình Đơn Hàng' : 'Order Timeline'}</h2>
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
                <h2><span className="material-symbols-outlined">inventory_2</span>{isVi ? 'Sản Phẩm Trong Đơn' : 'Order Item'}</h2>
                <div className="sod-item-row">
                  <div className="sod-product">
                    <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                    <div>
                      <strong>{order.productName || (isVi ? 'Sản phẩm' : 'Untitled product')}</strong>
                      <small>{order.productId}</small>
                    </div>
                  </div>
                  <div className="sod-qty-cell">
                    <span>{isVi ? 'Số lượng' : 'Quantity'}</span>
                    <strong>{order.quantity || 0}</strong>
                  </div>
                  <div className="sod-price-cell">
                    <span>{isVi ? 'Đơn giá' : 'Unit Price'}</span>
                    <strong>{formatVnd(order.unitPrice || 0)}</strong>
                  </div>
                  <div className="sod-price-cell total">
                    <span>{isVi ? 'Tổng tiền' : 'Final Amount'}</span>
                    <strong>{formatVnd(order.finalAmount || 0)}</strong>
                  </div>
                </div>
              </article>

              <article className="sod-card">
                <h2><span className="material-symbols-outlined">receipt_long</span>{isVi ? 'Thông Tin Tổng Quan' : 'Order Snapshot'}</h2>
                <div className="sod-snapshot-grid">
                  <div>
                    <span>{isVi ? 'Trạng thái' : 'Status'}</span>
                    <strong>{statusLabels[order.status] || order.status || '-'}</strong>
                  </div>
                  <div>
                    <span>{isVi ? 'Đơn vị vận chuyển' : 'Provider'}</span>
                    <strong>{order.shippingProvider || SHIPPING_PROVIDER}</strong>
                  </div>
                  <div>
                    <span>{isVi ? 'Dự kiến giao' : 'Expected Delivery'}</span>
                    <strong>{formatDateTime(order.expectedDeliveryTime)}</strong>
                  </div>
                  <div>
                    <span>{isVi ? 'Cập nhật lần cuối' : 'Updated'}</span>
                    <strong>{formatDateTime(order.updatedAt)}</strong>
                  </div>
                </div>
              </article>
            </section>

            <aside className="sod-side">
              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">person</span>{isVi ? 'Thông Tin Người Mua' : 'Buyer'}</h3>
                <strong>{order.buyerName || (isVi ? 'Khách hàng' : 'Unknown Buyer')}</strong>
                <p><span className="material-symbols-outlined">mail</span>{order.buyerEmail || '-'}</p>
                <p><span className="material-symbols-outlined">call</span>{order.buyerPhone || getPhoneFromAddressSnapshot(order.addressSnapshot) || '-'}</p>
              </article>

              <article className="sod-side-card">
                <h3><span className="material-symbols-outlined">local_shipping</span>{isVi ? 'Vận Chuyển' : 'Shipping'}</h3>
                <dl>
                  <div><dt>{isVi ? 'Đơn vị' : 'Provider'}</dt><dd>{order.shippingProvider || SHIPPING_PROVIDER}</dd></div>
                  {order.trackingCode && <div><dt>{isVi ? 'Mã vận đơn' : 'Tracking'}</dt><dd>{order.trackingCode}</dd></div>}
                  <div><dt>{isVi ? 'Dự kiến' : 'Expected'}</dt><dd>{formatDateTime(order.expectedDeliveryTime)}</dd></div>
                </dl>
              </article>

              <article className="sod-summary-card">
                <h3>{isVi ? 'Tóm Tắt Thanh Toán' : 'Payment Summary'}</h3>
                <div><span>{isVi ? 'Tạm tính' : 'Subtotal'}</span><strong>{formatVnd(totals.subtotal)}</strong></div>
                <div><span>{isVi ? 'Phí vận chuyển' : 'Shipping'}</span><strong>{formatVnd(totals.shipping)}</strong></div>
                <div><span>{isVi ? 'Giảm giá' : 'Discount'}</span><strong>-{formatVnd(totals.discount)}</strong></div>
                <hr />
                <div className="total"><span>{isVi ? 'Tổng thanh toán' : 'Total'}</span><strong>{formatVnd(totals.final)}</strong></div>
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

function getOrderTimeline(order, isVi) {
  if (!order) return [];

  if (order.status === 'Cancelled') {
    return [
      timelineStep('placed', isVi ? 'Đã đặt hàng' : 'Order Placed', formatDateTime(order.createdAt), 'done', 'check'),
      timelineStep('cancelled', isVi ? 'Đã hủy đơn' : 'Order Cancelled', formatDateTime(order.updatedAt), 'danger', 'close'),
    ];
  }

  const rank = getStatusRank(order.status);
  const stateFor = (status) => {
    const targetRank = getStatusRank(status);
    if (order.status === status) return 'current';
    return rank > targetRank ? 'done' : 'pending';
  };

  const steps = [
    timelineStep('placed', isVi ? 'Đã đặt hàng' : 'Order Placed', formatDateTime(order.createdAt), 'done', 'check'),
    timelineStep(
      'payment',
      isVi ? 'Đã xác nhận thanh toán' : 'Payment Confirmed',
      order.status === 'AwaitingPayment' ? (isVi ? 'Chờ người mua thanh toán' : 'Waiting for buyer payment') : formatDateTime(order.updatedAt || order.createdAt),
      order.status === 'AwaitingPayment' ? 'current' : stateFor('Pending'),
      rank > getStatusRank('Pending') ? 'check' : 'schedule'
    ),
    timelineStep(
      'confirmed',
      isVi ? 'Người bán đã xác nhận' : 'Seller Confirmed',
      rank >= getStatusRank('Confirmed') ? formatDateTime(order.updatedAt) : (isVi ? 'Chờ người bán xác nhận' : 'Waiting for seller confirmation'),
      stateFor('Confirmed'),
      rank > getStatusRank('Confirmed') ? 'check' : 'inventory'
    ),
    timelineStep(
      'shipping',
      isVi ? 'Đang giao hàng' : 'In Transit',
      rank >= getStatusRank('Shipping')
        ? `${isVi ? 'Đơn vị' : 'Provider'}: ${order.shippingProvider || SHIPPING_PROVIDER}`
        : (isVi ? 'Chờ bàn giao cho GHN' : 'Waiting for GHN handoff'),
      stateFor('Shipping'),
      'local_shipping'
    ),
  ];

  if (order.status === 'DeliveryFailed') {
    steps.push(timelineStep('delivery-failed', isVi ? 'Giao hàng thất bại' : 'Delivery Failed', formatDateTime(order.updatedAt), 'danger', 'report'));
    return steps;
  }

  steps.push(
    timelineStep(
      'delivered',
      isVi ? 'Đã giao hàng' : 'Delivered',
      rank >= getStatusRank('Delivered')
        ? formatDateTime(order.updatedAt)
        : `${isVi ? 'Dự kiến giao' : 'Estimated Delivery'}: ${formatDateTime(order.expectedDeliveryTime)}`,
      stateFor('Delivered'),
      rank > getStatusRank('Delivered') ? 'check' : 'radio_button_unchecked'
    ),
    timelineStep(
      'completed',
      isVi ? 'Đã hoàn thành' : 'Completed',
      order.status === 'Completed' ? formatDateTime(order.updatedAt) : (isVi ? 'Chờ người mua xác nhận hoàn tất' : 'Waiting for buyer confirmation'),
      stateFor('Completed'),
      order.status === 'Completed' ? 'verified' : 'task_alt'
    )
  );

  if (['ReturnRequested', 'ReturnRejected', 'Returned'].includes(order.status)) {
    if (order.status === 'ReturnRequested') {
      steps.push(timelineStep('return-requested', isVi ? 'Yêu cầu trả hàng' : 'Return Requested', formatDateTime(order.updatedAt), 'info', 'assignment_return'));
    } else if (order.status === 'ReturnRejected') {
      steps.push(timelineStep('return-rejected', isVi ? 'Từ chối trả hàng' : 'Return Rejected', formatDateTime(order.updatedAt), 'danger', 'assignment_return'));
    } else {
      steps.push(timelineStep('returned', isVi ? 'Đã trả hàng' : 'Returned', formatDateTime(order.updatedAt), 'warning', 'assignment_return'));
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
