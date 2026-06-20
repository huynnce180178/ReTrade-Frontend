import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderStatusUpdate.css';

const SHIPPING_PROVIDER = 'GHN';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const awaitingPaymentCancelDelayMs = 15 * 60 * 1000;

const statusTransitions = {
  AwaitingPayment: ['Cancelled'],
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Shipping', 'Cancelled'],
};

const statusLabels = {
  AwaitingPayment: 'Awaiting Payment',
  Pending: 'Pending',
  Confirmed: 'Confirmed',
  Shipping: 'Shipping',
  Delivered: 'Delivered',
  DeliveryFailed: 'Delivery Failed',
  Returned: 'Returned',
  Cancelled: 'Cancelled',
};

const statusClass = {
  AwaitingPayment: 'awaiting',
  Pending: 'pending',
  Confirmed: 'confirmed',
  Shipping: 'shipping',
  Delivered: 'delivered',
  DeliveryFailed: 'delivery-failed',
  Returned: 'returned',
  Cancelled: 'cancelled',
};

const statusChoiceMeta = {
  Confirmed: {
    icon: 'fact_check',
    title: 'Confirm Order',
    description: 'Mark this order as accepted and ready for fulfillment.',
  },
  Shipping: {
    icon: 'local_shipping',
    title: 'Ship with GHN',
    description: 'Move the order into delivery. The carrier result is simulated automatically after 30 seconds.',
  },
  Delivered: {
    icon: 'task_alt',
    title: 'Delivered',
    description: 'Carrier delivery completed successfully.',
  },
  Cancelled: {
    icon: 'cancel',
    title: 'Cancel Order',
    description: 'Cancel an unpaid or not-yet-shipped order.',
    tone: 'danger',
  },
};

export default function OrderStatusUpdate() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');

  const loadOrder = useCallback(async () => {
    if (!user?.userId) return;

    try {
      setLoading(true);
      const data = await orderService.getById(orderId, { sellerId: user.userId });
      setOrder(data);
      setSelectedStatus('');
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
    if (!user?.userId || !isSeller) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderStatusChanged = (payload) => {
      if (payload?.orderId && payload.orderId !== orderId) return;
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

  const availableStatusOptions = useMemo(
    () => {
      const options = statusTransitions[order?.status] || [];
      if (order?.status !== 'AwaitingPayment') return options;
      return isAwaitingPaymentExpired(order) ? options : [];
    },
    [order]
  );
  const showShippingFields = selectedStatus === 'Shipping';
  const selectedChoice = statusChoiceMeta[selectedStatus] || {};

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user?.userId) {
      showToast('SellerId is missing. Please sign in again.', 'error');
      return;
    }

    if (!availableStatusOptions.includes(selectedStatus)) {
      showToast('Please choose a valid next status for this order.', 'error');
      return;
    }

    try {
      setSaving(true);
      const updated = await orderService.updateStatus(
        orderId,
        {
          status: selectedStatus,
          trackingCode: order.trackingCode || null,
          shippingProvider: SHIPPING_PROVIDER,
          expectedDeliveryTime: null,
        },
        { sellerId: user.userId }
      );

      showToast('Order status updated successfully.', 'success');
      navigate(`/seller-dashboard/orders/${updated?.orderId || orderId}`);
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
    <div className="osu-page animate-fade-in">
      <div className="osu-breadcrumb">
        <Link to="/seller-dashboard/orders">Orders</Link>
        <Link to={`/seller-dashboard/orders/${orderId}`}>{order?.orderCode || orderId}</Link>
        <strong>Update Status</strong>
      </div>

      {loading ? (
        <div className="osu-empty">Loading status update...</div>
      ) : !order ? (
        <div className="osu-empty">Order not found.</div>
      ) : (
        <>
          <header className="osu-header">
            <div>
              <span className="osu-eyebrow">Fulfillment Control</span>
              <h1>Update Order Status</h1>
              <p>Order #{order.orderCode || order.orderId} for {order.buyerName || 'Unknown Buyer'}</p>
            </div>
            <Link className="osu-back-btn" to={`/seller-dashboard/orders/${order.orderId}`}>
              <span className="material-symbols-outlined">visibility</span>
              View Detail
            </Link>
          </header>

          <div className="osu-layout">
            <main className="osu-main">
              <section className="osu-card">
                <div className="osu-current">
                  <span>Current Status</span>
                  <em className={`osu-status ${statusClass[order.status] || 'default'}`}>
                    {statusLabels[order.status] || order.status || '-'}
                  </em>
                </div>

                {availableStatusOptions.length > 0 ? (
                  <form onSubmit={handleSubmit}>
                    <div className="osu-choice-grid" role="radiogroup" aria-label="Next order status">
                      {availableStatusOptions.map((status) => {
                        const choice = statusChoiceMeta[status] || {
                          icon: 'published_with_changes',
                          title: statusLabels[status] || status,
                          description: 'Move this order to the selected status.',
                        };

                        return (
                          <button
                            key={status}
                            type="button"
                            className={`osu-choice ${choice.tone || 'primary'} ${selectedStatus === status ? 'active' : ''}`}
                            aria-pressed={selectedStatus === status}
                            onClick={() => setSelectedStatus(status)}
                          >
                            <span className="material-symbols-outlined">{choice.icon}</span>
                            <strong>{choice.title}</strong>
                            <small>{choice.description}</small>
                          </button>
                        );
                      })}
                    </div>

                    {showShippingFields && (
                      <div className="osu-shipping-panel">
                        <label>
                          <span>Shipping Provider</span>
                          <strong>{SHIPPING_PROVIDER}</strong>
                        </label>
                        <label>
                          <span>Carrier Result</span>
                          <strong>Auto after 30 seconds</strong>
                        </label>
                      </div>
                    )}

                    <div className="osu-submit-row">
                      <Link to="/seller-dashboard/orders">Back to Orders</Link>
                      <button
                        type="submit"
                        className={selectedChoice.tone || 'primary'}
                        disabled={!selectedStatus || saving}
                      >
                        <span className="material-symbols-outlined">save</span>
                        {saving ? 'Saving...' : `Update${selectedStatus ? ` to ${statusLabels[selectedStatus] || selectedStatus}` : ''}`}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="osu-locked">
                    <span className="material-symbols-outlined">lock</span>
                    <strong>No further update available</strong>
                    <p>{getLockedMessage(order)}</p>
                  </div>
                )}
              </section>
            </main>

            <aside className="osu-side">
              <section className="osu-side-card">
                <h2>Order Item</h2>
                <div className="osu-product">
                  <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                  <div>
                    <strong>{order.productName || 'Untitled product'}</strong>
                    <span>Qty {order.quantity || 0}</span>
                  </div>
                </div>
              </section>

              <section className="osu-side-card">
                <h2>Delivery</h2>
                <dl>
                  <div><dt>Provider</dt><dd>{order.shippingProvider || SHIPPING_PROVIDER}</dd></div>
                  {order.trackingCode && <div><dt>Tracking</dt><dd>{order.trackingCode}</dd></div>}
                  <div><dt>Expected</dt><dd>{formatDateTime(order.expectedDeliveryTime)}</dd></div>
                  <div><dt>Total</dt><dd>{formatVnd(order.finalAmount || 0)}</dd></div>
                </dl>
              </section>
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

function isAwaitingPaymentExpired(order) {
  if (!order?.createdAt) return false;
  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() >= awaitingPaymentCancelDelayMs;
}

function getLockedMessage(order) {
  if (order?.status === 'AwaitingPayment') {
    return 'Payment is still inside the 15-minute window, so the seller can only view this order for now.';
  }

  return 'This order is already in a final status.';
}
