import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import '../../../styles/SellerDashboard.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusOptions = [
  'AwaitingPayment',
  'Pending',
  'Confirmed',
  'Shipping',
  'Delivered',
  'Returned',
  'Cancelled',
];

const statusLabels = {
  AwaitingPayment: 'Awaiting Payment',
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Shipping: 'Shipping',
  Delivered: 'Delivered',
  Returned: 'Returned',
  Cancelled: 'Cancelled',
};

const statusClass = {
  AwaitingPayment: 'awaiting',
  Pending: 'pending',
  Confirmed: 'confirmed',
  Shipping: 'shipping',
  Delivered: 'delivered',
  Returned: 'returned',
  Cancelled: 'cancelled',
};

const statusOrder = ['AwaitingPayment', 'Pending', 'Confirmed', 'Shipping', 'Delivered'];

export default function OrderDetail() {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    status: 'Pending',
    trackingCode: '',
    shippingProvider: '',
    expectedDeliveryTime: '',
  });

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orderService.getById(orderId, { sellerId: user?.userId || user?.id });
      setOrder(data);
      setForm({
        status: data?.status || 'Pending',
        trackingCode: data?.trackingCode || '',
        shippingProvider: data?.shippingProvider || '',
        expectedDeliveryTime: toDateTimeInputValue(data?.expectedDeliveryTime),
      });
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load order detail.', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId, showToast, user]);

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const payload = {
        status: form.status,
        trackingCode: form.trackingCode || null,
        shippingProvider: form.shippingProvider || null,
        expectedDeliveryTime: form.expectedDeliveryTime ? new Date(form.expectedDeliveryTime).toISOString() : null,
      };
      const updated = await orderService.updateStatus(orderId, payload, { sellerId: user?.userId || user?.id });
      setOrder(updated);
      setForm({
        status: updated?.status || form.status,
        trackingCode: updated?.trackingCode || '',
        shippingProvider: updated?.shippingProvider || '',
        expectedDeliveryTime: toDateTimeInputValue(updated?.expectedDeliveryTime),
      });
      showToast('Order status updated successfully.', 'success');
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update order status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>Loading order...</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="seller-order-detail-page animate-fade-in">
      <div className="seller-order-breadcrumb">
        <Link to="/seller-dashboard/orders">Orders</Link>
        <strong>{order?.orderCode || orderId}</strong>
      </div>

      {loading ? (
        <div className="seller-orders-empty">Loading order detail...</div>
      ) : !order ? (
        <div className="seller-orders-empty">Order not found.</div>
      ) : (
        <>
          <header className="seller-order-detail-header">
            <div>
              <div className="seller-order-title-line">
                <h1>Order #{order.orderCode || order.orderId}</h1>
                <em className={`seller-order-status ${statusClass[order.status] || 'default'}`}>
                  {statusLabels[order.status] || order.status}
                </em>
              </div>
              <p>Created {formatDateTime(order.createdAt)} • Buyer {order.buyerName || 'Unknown Buyer'}</p>
            </div>
            <Link className="seller-order-back-btn" to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Orders
            </Link>
          </header>

          <div className="seller-order-detail-layout">
            <section className="seller-order-detail-main">
              <article className="seller-order-detail-card">
                <h2><span className="material-symbols-outlined">inventory_2</span>Order Item</h2>
                <div className="seller-order-item-row">
                  <div className="seller-order-detail-product">
                    <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                    <div>
                      <strong>{order.productName || 'Untitled product'}</strong>
                      <small>{order.productId}</small>
                    </div>
                  </div>
                  <span>Qty {order.quantity || 0}</span>
                  <strong>{formatVnd(order.unitPrice || 0)}</strong>
                  <strong className="amount">{formatVnd(order.finalAmount || 0)}</strong>
                </div>
              </article>

              <article className="seller-order-detail-card">
                <h2><span className="material-symbols-outlined">published_with_changes</span>Update Status</h2>
                <form className="seller-order-status-form" onSubmit={handleSubmit}>
                  <label>
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value }))}>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{statusLabels[status]}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Tracking Code</span>
                    <input
                      value={form.trackingCode}
                      onChange={(event) => setForm((value) => ({ ...value, trackingCode: event.target.value }))}
                      placeholder="VD: GHN-123456"
                    />
                  </label>

                  <label>
                    <span>Shipping Provider</span>
                    <input
                      value={form.shippingProvider}
                      onChange={(event) => setForm((value) => ({ ...value, shippingProvider: event.target.value }))}
                      placeholder="VD: GHN, GHTK, Viettel Post"
                    />
                  </label>

                  <label>
                    <span>Expected Delivery</span>
                    <input
                      type="datetime-local"
                      value={form.expectedDeliveryTime}
                      onChange={(event) => setForm((value) => ({ ...value, expectedDeliveryTime: event.target.value }))}
                    />
                  </label>

                  <button type="submit" disabled={saving}>
                    <span className="material-symbols-outlined">save</span>
                    {saving ? 'Saving...' : 'Save Status'}
                  </button>
                </form>
              </article>
            </section>

            <aside className="seller-order-detail-side">
              <article className="seller-order-side-card">
                <h3><span className="material-symbols-outlined">person</span>Buyer</h3>
                <strong>{order.buyerName || 'Unknown Buyer'}</strong>
                <p><span className="material-symbols-outlined">mail</span>{order.buyerEmail || '-'}</p>
                <p><span className="material-symbols-outlined">call</span>{order.buyerPhone || '-'}</p>
              </article>

              <article className="seller-order-side-card">
                <h3><span className="material-symbols-outlined">local_shipping</span>Shipping</h3>
                <dl>
                  <div><dt>Provider</dt><dd>{order.shippingProvider || '-'}</dd></div>
                  <div><dt>Tracking</dt><dd>{order.trackingCode || '-'}</dd></div>
                  <div><dt>Expected</dt><dd>{formatDateTime(order.expectedDeliveryTime)}</dd></div>
                </dl>
              </article>

              <article className="seller-order-summary-card">
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

function toDateTimeInputValue(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}
