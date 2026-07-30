import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderStatusUpdate.css';

const SHIPPING_PROVIDER = 'GHN';
const numberFormatter = new Intl.NumberFormat('vi-VN');

export default function OrderStatusUpdate() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const statusLabels = useMemo(() => ({
    AwaitingPayment: t('sales_stats.awaiting_payment'),
    Pending: t('sales_stats.pending'),
    Confirmed: t('sales_stats.confirmed'),
    Shipping: t('sales_stats.shipping'),
    Delivered: t('sales_stats.delivered'),
    Completed: t('sales_stats.completed'),
    DeliveryFailed: t('sales_stats.delivery_failed'),
    Returned: t('sales_stats.returned'),
    ReturnRequested: t('history.refund_reason'),
    ReturnRejected: t('admin.reject'),
    Cancelled: t('sales_stats.cancelled'),
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

  const statusChoiceMeta = useMemo(() => ({
    Confirmed: {
      icon: 'fact_check',
      title: t('sales_stats.confirmed'),
      description: t('my_products.subtitle'),
    },
    Shipping: {
      icon: 'local_shipping',
      title: t('sales_stats.shipping'),
      description: t('sales_stats.shipping'),
    },
    Delivered: {
      icon: 'task_alt',
      title: t('sales_stats.delivered'),
      description: t('sales_stats.delivered'),
    },
    Cancelled: {
      icon: 'cancel',
      title: t('sales_stats.cancelled'),
      description: t('sales_stats.cancelled'),
      tone: 'danger',
    },
  }), [t]);

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
    if (!user?.userId || !isSeller) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderStatusChanged = (payload) => {
      if (payload?.orderId && payload.orderId !== orderId) return;
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

  const availableStatusOptions = useMemo(() => {
    if (!order?.status) return [];
    const transitions = {
      AwaitingPayment: ['Cancelled'],
      Pending: ['Confirmed', 'Cancelled'],
      Confirmed: ['Shipping', 'Cancelled'],
    };
    return transitions[order.status] || [];
  }, [order?.status]);

  const selectedChoice = statusChoiceMeta[selectedStatus] || {};
  const showShippingFields = selectedStatus === 'Shipping';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStatus) {
      showToast(t('order_status_update.select_status'), 'warning');
      return;
    }

    try {
      setSaving(true);
      const updated = await orderService.updateSellerOrderStatus(
        orderId,
        { status: selectedStatus },
        { sellerId: user.userId }
      );

      showToast(t('order_status_update.update_success'), 'success');
      navigate(`/seller-dashboard/orders/${updated?.orderId || orderId}`);
    } catch (error) {
      showToast(error?.response?.data || t('order_status_update.update_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReturn = async () => {
    if (!orderId) return;
    try {
      setSaving(true);
      await orderService.approveReturnRequest(orderId, user.userId);
      showToast(t('toast.saved_success'), 'success');
      navigate(`/seller-dashboard/orders/${orderId}`);
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectReturn = async () => {
    if (!orderId) return;
    const reason = window.prompt(t('history.refund_reason'));
    if (reason === null) return;
    try {
      setSaving(true);
      await orderService.rejectReturnRequest(orderId, reason, user.userId);
      showToast(t('toast.saved_success'), 'info');
      navigate(`/seller-dashboard/orders/${orderId}`);
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const getLockedMessage = (orderData) => {
    if (!orderData?.status) return t('common.no_data');
    switch (orderData.status) {
      case 'Shipping':
        return t('sales_stats.shipping');
      case 'Delivered':
        return t('sales_stats.delivered');
      case 'Completed':
        return t('sales_stats.completed');
      case 'Cancelled':
        return t('sales_stats.cancelled');
      case 'Returned':
        return t('sales_stats.returned');
      default:
        return t('common.no_data');
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{t('common.loading')}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="osu-page animate-fade-in">
      <div className="osu-breadcrumb">
        <Link to="/seller-dashboard/orders">{t('seller.orders_management')}</Link>
        <Link to={`/seller-dashboard/orders/${orderId}`}>{order?.orderCode || orderId}</Link>
        <strong>{t('order_status_update.update_btn')}</strong>
      </div>

      {loading ? (
        <div className="osu-empty">{t('common.loading')}</div>
      ) : !order ? (
        <div className="osu-empty">{t('common.no_data')}</div>
      ) : (
        <>
          <header className="osu-header">
            <div>
              <span className="osu-eyebrow">{t('seller.orders_management')}</span>
              <h1>{t('order_status_update.title', { id: order.orderCode || order.orderId })}</h1>
              <p>{t('order_detail.buyer_info')}: {order.buyerName || t('common.unknown_buyer')}</p>
            </div>
            <Link className="osu-back-btn" to={`/seller-dashboard/orders/${order.orderId}`}>
              <span className="material-symbols-outlined">visibility</span>
              {t('common.view_detail')}
            </Link>
          </header>

          <div className="osu-layout">
            <main className="osu-main">
              <section className="osu-card">
                <div className="osu-current">
                  <span>{t('common.status')}</span>
                  <em className={`osu-status ${statusClass[order.status] || 'default'}`}>
                    {statusLabels[order.status] || order.status || '-'}
                  </em>
                </div>

                {order.status === 'ReturnRequested' && (
                  <div className="osu-return-actions">
                    <button
                      type="button"
                      className="osu-return-approve primary"
                      onClick={handleApproveReturn}
                      disabled={saving}
                    >
                      {saving ? t('common.submitting') : t('admin.approve')}
                    </button>
                    <button
                      type="button"
                      className="osu-return-reject danger"
                      onClick={handleRejectReturn}
                      disabled={saving}
                    >
                      {saving ? t('common.submitting') : t('admin.reject')}
                    </button>
                  </div>
                )}

                {availableStatusOptions.length > 0 ? (
                  <form onSubmit={handleSubmit}>
                    <div className="osu-choice-grid" role="radiogroup" aria-label="Next order status">
                      {availableStatusOptions.map((status) => {
                        const choice = statusChoiceMeta[status] || {
                          icon: 'published_with_changes',
                          title: statusLabels[status] || status,
                          description: t('order_status_update.select_status'),
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
                          <span>{t('order_detail.shipping_unit')}</span>
                          <strong>{SHIPPING_PROVIDER}</strong>
                        </label>
                      </div>
                    )}

                    <div className="osu-submit-row">
                      <Link to="/seller-dashboard/orders">{t('common.back')}</Link>
                      <button
                        type="submit"
                        className={selectedChoice.tone || 'primary'}
                        disabled={!selectedStatus || saving}
                      >
                        <span className="material-symbols-outlined">save</span>
                        {saving ? t('common.saving') : t('order_status_update.update_btn')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="osu-locked">
                    <span className="material-symbols-outlined">lock</span>
                    <strong>{t('common.no_data')}</strong>
                    <p>{getLockedMessage(order)}</p>
                  </div>
                )}
              </section>
            </main>

            <aside className="osu-side">
              <article className="osu-card">
                <h3>{t('order_detail.buyer_info')}</h3>
                <strong>{order.buyerName || t('common.unknown_buyer')}</strong>
              </article>
              <article className="osu-card">
                <h3>{t('my_products.th_product')}</h3>
                <strong>{order.productName || t('nav.product')}</strong>
                <p>{formatVnd(order.finalAmount || 0)}</p>
              </article>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}
