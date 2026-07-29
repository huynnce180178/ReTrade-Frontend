import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import { formatDateTimeGmt7, parseBackendUtcDate } from '../../../utils/dateTime';
import './OrderStatusUpdate.css';

const SHIPPING_PROVIDER = 'GHN';
const numberFormatter = new Intl.NumberFormat('vi-VN');

export default function OrderStatusUpdate() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  const statusLabels = useMemo(() => ({
    AwaitingPayment: isVi ? 'Chờ thanh toán' : 'Awaiting Payment',
    Pending: isVi ? 'Chờ xử lý' : 'Pending',
    Confirmed: isVi ? 'Đã xác nhận' : 'Confirmed',
    Shipping: isVi ? 'Đang giao' : 'Shipping',
    Delivered: isVi ? 'Đã giao' : 'Delivered',
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
    DeliveryFailed: 'delivery-failed',
    Returned: 'returned',
    ReturnRequested: 'return-requested',
    ReturnRejected: 'return-rejected',
    Cancelled: 'cancelled',
  };

  const statusChoiceMeta = useMemo(() => ({
    Confirmed: {
      icon: 'fact_check',
      title: isVi ? 'Xác Nhận Đơn Hàng' : 'Confirm Order',
      description: isVi ? 'Chấp nhận đơn hàng và chuẩn bị đóng gói.' : 'Mark this order as accepted and ready for fulfillment.',
    },
    Shipping: {
      icon: 'local_shipping',
      title: isVi ? 'Bàn Giao Cho GHN' : 'Ship with GHN',
      description: isVi ? 'Chuyển sang trạng thái giao hàng.' : 'Move the order into delivery.',
    },
    Delivered: {
      icon: 'task_alt',
      title: isVi ? 'Đã Giao Hàng' : 'Delivered',
      description: isVi ? 'Giao hàng thành công.' : 'Carrier delivery completed successfully.',
    },
    Cancelled: {
      icon: 'cancel',
      title: isVi ? 'Hủy Đơn Hàng' : 'Cancel Order',
      description: isVi ? 'Hủy đơn hàng chưa giao.' : 'Cancel an unpaid or not-yet-shipped order.',
      tone: 'danger',
    },
  }), [isVi]);

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
      showToast(isVi ? 'Vui lòng chọn trạng thái tiếp theo.' : 'Please select a status transition.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const updated = await orderService.updateSellerOrderStatus(orderId, {
        status: selectedStatus,
      });

      showToast(isVi ? `Đã cập nhật trạng thái đơn hàng sang ${statusLabels[selectedStatus] || selectedStatus}.` : `Order updated to ${statusLabels[selectedStatus] || selectedStatus}.`, 'success');
      navigate(`/seller-dashboard/orders/${updated?.orderId || orderId}`);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể cập nhật trạng thái đơn hàng.' : 'Failed to update order status.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveReturn = async () => {
    if (!orderId) return;
    try {
      setSaving(true);
      await orderService.approveReturnRequest(orderId);
      showToast(isVi ? 'Đã chấp nhận yêu cầu trả hàng.' : 'Return request approved successfully.', 'success');
      navigate(`/seller-dashboard/orders/${orderId}`);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể chấp nhận trả hàng.' : 'Failed to approve return request.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectReturn = async () => {
    if (!orderId) return;
    const reason = window.prompt(isVi ? 'Nhập lý do từ chối trả hàng:' : 'Enter reason for rejecting return request:');
    if (reason === null) return;
    try {
      setSaving(true);
      await orderService.rejectReturnRequest(orderId, reason);
      showToast(isVi ? 'Đã từ chối yêu cầu trả hàng.' : 'Return request rejected successfully.', 'info');
      navigate(`/seller-dashboard/orders/${orderId}`);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể từ chối trả hàng.' : 'Failed to reject return request.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const getLockedMessage = (orderData) => {
    if (!orderData?.status) return isVi ? 'Đơn hàng không khả dụng.' : 'Order data unavailable.';
    switch (orderData.status) {
      case 'Shipping':
        return isVi ? 'Đơn hàng đang giao với GHN. Trạng thái sẽ cập nhật tự động khi đơn vị vận chuyển giao hàng.' : 'Order is in transit with GHN. Delivery status updates automatically upon carrier handoff.';
      case 'Delivered':
        return isVi ? 'Đơn hàng đã được giao thành công. Đang chờ người mua xác nhận hoàn tất.' : 'Order is already delivered. Awaiting final buyer completion.';
      case 'Completed':
        return isVi ? 'Đơn hàng đã hoàn tất thành công.' : 'Order has reached its completed terminal state.';
      case 'Cancelled':
        return isVi ? 'Đơn hàng này đã bị hủy.' : 'This order was cancelled.';
      case 'Returned':
        return isVi ? 'Đơn hàng đã được trả lại.' : 'Order was returned to seller.';
      default:
        return isVi ? 'Trạng thái đơn hàng hiện tại không hỗ trợ chuyển tiếp trực tiếp.' : 'Current order state does not permit further direct manual updates.';
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{isVi ? 'Đang tải đơn hàng...' : 'Loading order...'}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="osu-page animate-fade-in">
      <div className="osu-breadcrumb">
        <Link to="/seller-dashboard/orders">{isVi ? 'Đơn Hàng' : 'Orders'}</Link>
        <Link to={`/seller-dashboard/orders/${orderId}`}>{order?.orderCode || orderId}</Link>
        <strong>{isVi ? 'Cập Nhật Trạng Thái' : 'Update Status'}</strong>
      </div>

      {loading ? (
        <div className="osu-empty">{isVi ? 'Đang tải...' : 'Loading status update...'}</div>
      ) : !order ? (
        <div className="osu-empty">{isVi ? 'Không tìm thấy đơn hàng.' : 'Order not found.'}</div>
      ) : (
        <>
          <header className="osu-header">
            <div>
              <span className="osu-eyebrow">{isVi ? 'Quản Lý Đơn Hàng' : 'Fulfillment Control'}</span>
              <h1>{isVi ? 'Cập Nhật Trạng Thái Đơn Hàng' : 'Update Order Status'}</h1>
              <p>{isVi ? 'Đơn hàng' : 'Order'} #{order.orderCode || order.orderId} - {isVi ? 'Người mua:' : 'for'} {order.buyerName || (isVi ? 'Khách hàng' : 'Unknown Buyer')}</p>
            </div>
            <Link className="osu-back-btn" to={`/seller-dashboard/orders/${order.orderId}`}>
              <span className="material-symbols-outlined">visibility</span>
              {isVi ? 'Xem Chi Tiết' : 'View Detail'}
            </Link>
          </header>

          <div className="osu-layout">
            <main className="osu-main">
              <section className="osu-card">
                <div className="osu-current">
                  <span>{isVi ? 'Trạng Thái Hiện Tại' : 'Current Status'}</span>
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
                      {saving ? (isVi ? 'Đang xử lý...' : 'Processing...') : (isVi ? 'Chấp Nhận Trả Hàng' : 'Approve Return')}
                    </button>
                    <button
                      type="button"
                      className="osu-return-reject danger"
                      onClick={handleRejectReturn}
                      disabled={saving}
                    >
                      {saving ? (isVi ? 'Đang xử lý...' : 'Processing...') : (isVi ? 'Từ Chối Trả Hàng' : 'Reject Return')}
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
                          description: isVi ? 'Chuyển đơn hàng sang trạng thái này.' : 'Move this order to the selected status.',
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
                          <span>{isVi ? 'Đơn Vị Vận Chuyển' : 'Shipping Provider'}</span>
                          <strong>{SHIPPING_PROVIDER}</strong>
                        </label>
                        <label>
                          <span>{isVi ? 'Thời gian giao' : 'Carrier Result'}</span>
                          <strong>{isVi ? 'Tự động sau 30 giây' : 'Auto after 30 seconds'}</strong>
                        </label>
                      </div>
                    )}

                    <div className="osu-submit-row">
                      <Link to="/seller-dashboard/orders">{isVi ? 'Quay lại danh sách' : 'Back to Orders'}</Link>
                      <button
                        type="submit"
                        className={selectedChoice.tone || 'primary'}
                        disabled={!selectedStatus || saving}
                      >
                        <span className="material-symbols-outlined">save</span>
                        {saving ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? `Cập nhật sang ${statusLabels[selectedStatus] || selectedStatus}` : `Update${selectedStatus ? ` to ${statusLabels[selectedStatus] || selectedStatus}` : ''}`)}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="osu-locked">
                    <span className="material-symbols-outlined">lock</span>
                    <strong>{isVi ? 'Không có thao tác khả dụng' : 'No further update available'}</strong>
                    <p>{getLockedMessage(order)}</p>
                  </div>
                )}
              </section>
            </main>

            <aside className="osu-side">
              <article className="osu-card">
                <h3>{isVi ? 'Khách Hàng' : 'Buyer'}</h3>
                <strong>{order.buyerName || (isVi ? 'Khách hàng' : 'Unknown Buyer')}</strong>
              </article>
              <article className="osu-card">
                <h3>{isVi ? 'Sản Phẩm' : 'Product'}</h3>
                <strong>{order.productName || (isVi ? 'Sản phẩm' : 'Untitled product')}</strong>
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
