import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderManagement.css';
import ReportModal from '../../../components/ReportModal/ReportModal';
import reportService from '../../../services/reportService';

const pageSize = 5;
const SHIPPING_PROVIDER = 'GHN';
const numberFormatter = new Intl.NumberFormat('vi-VN');
const awaitingPaymentCancelDelayMs = 15 * 60 * 1000;
const defaultShippingDelayMs = 30 * 1000;

export default function OrderManagement() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const skipNextFilterAutoApply = useRef(false);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterForm, setFilterForm] = useState({ sortBy: 'newest' });
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const tabs = useMemo(() => [
    { key: '', label: isVi ? 'Tất cả' : 'All' },
    { key: 'AwaitingPayment', label: isVi ? 'Chờ thanh toán' : 'Awaiting Payment' },
    { key: 'Pending', label: isVi ? 'Chờ xử lý' : 'Pending' },
    { key: 'Confirmed', label: isVi ? 'Đã xác nhận' : 'Confirmed' },
    { key: 'Shipping', label: isVi ? 'Đang giao' : 'Shipping' },
    { key: 'Delivered', label: isVi ? 'Đã giao' : 'Delivered' },
    { key: 'Completed', label: isVi ? 'Hoàn thành' : 'Completed' },
    { key: 'DeliveryFailed', label: isVi ? 'Giao thất bại' : 'Delivery Failed' },
    { key: 'Returned', label: isVi ? 'Đã trả hàng' : 'Returned' },
    { key: 'Cancelled', label: isVi ? 'Đã hủy' : 'Cancelled' },
  ], [isVi]);

  const statusMeta = useMemo(() => ({
    AwaitingPayment: { label: isVi ? 'Chờ thanh toán' : 'Awaiting Payment', className: 'awaiting' },
    Pending: { label: isVi ? 'Chờ xử lý' : 'Pending', className: 'pending' },
    Confirmed: { label: isVi ? 'Đã xác nhận' : 'Confirmed', className: 'confirmed' },
    Shipping: { label: isVi ? 'Đang giao' : 'Shipping', className: 'shipping' },
    Delivered: { label: isVi ? 'Đã giao' : 'Delivered', className: 'delivered' },
    Completed: { label: isVi ? 'Hoàn thành' : 'Completed', className: 'completed' },
    DeliveryFailed: { label: isVi ? 'Giao thất bại' : 'Delivery Failed', className: 'delivery-failed' },
    Returned: { label: isVi ? 'Đã trả hàng' : 'Returned', className: 'returned' },
    ReturnRequested: { label: isVi ? 'Yêu cầu trả hàng' : 'Return Requested', className: 'return-requested' },
    ReturnRejected: { label: isVi ? 'Từ chối trả hàng' : 'Return Rejected', className: 'return-rejected' },
    Cancelled: { label: isVi ? 'Đã hủy' : 'Cancelled', className: 'cancelled' },
  }), [isVi]);

  const sortOptions = useMemo(() => [
    { value: 'newest', label: isVi ? 'Mới nhất trước' : 'Newest first' },
    { value: 'oldest', label: isVi ? 'Cũ nhất trước' : 'Oldest first' },
    { value: 'total_desc', label: 'Tổng tiền cao nhất' },
    { value: 'total_asc', label: 'Tổng tiền thấp nhất' },
  ], [isVi]);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');
  const sellerId = user?.userId || user?.id;
  const hasActiveControls = Boolean(activeStatus || appliedSearchTerm || appliedFilters);

  useEffect(() => {
    if (skipNextFilterAutoApply.current) {
      skipNextFilterAutoApply.current = false;
      return undefined;
    }

    const timer = setTimeout(() => {
      const nextFilters = normalizeFilterForm(filterForm);
      setAppliedFilters(nextFilters);
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [filterForm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOrders = useCallback(async () => {
    if (!sellerId) return;

    try {
      setLoading(true);
      const effectiveStatus = appliedFilters?.status || activeStatus || undefined;

      const data = await orderService.getSellerOrders({
        SellerId: sellerId,
        Status: effectiveStatus,
        SearchTerm: appliedSearchTerm || undefined,
        SortBy: appliedFilters?.sortBy || filterForm.sortBy || 'newest',
        PageNumber: page,
        PageSize: pageSize,
      });

      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setOrders(items);
      setTotalItems(data?.totalCount ?? items.length);
      setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil((data?.totalCount ?? items.length) / pageSize)));
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể tải danh sách đơn hàng.' : 'Failed to load seller orders.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, appliedFilters, appliedSearchTerm, filterForm.sortBy, page, sellerId, showToast, isVi]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      fetchOrders();
    }
  }, [fetchOrders, isAdmin, isSeller, user]);

  useEffect(() => {
    if (authLoading || !user || (!isSeller && !isAdmin)) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderUpdate = () => {
      if (!disposed) fetchOrders();
    };

    connection.on('ReceiveOrderNotification', handleOrderUpdate);
    connection.on('OrderStatusUpdated', handleOrderUpdate);

    connection.start()
      .then(() => {
        if (!disposed) connection.invoke('JoinSellerOrders').catch(() => { });
      })
      .catch(() => { });

    return () => {
      disposed = true;
      connection.off('ReceiveOrderNotification', handleOrderUpdate);
      connection.off('OrderStatusUpdated', handleOrderUpdate);
      connection.stop().catch(() => { });
    };
  }, [authLoading, fetchOrders, isAdmin, isSeller, user]);

  const handleFilterChange = (field, value) => {
    setFilterForm((current) => ({ ...current, [field]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setAppliedSearchTerm(searchTerm.trim());
    setPage(1);
  };

  const resetFilterFormSilently = () => {
    skipNextFilterAutoApply.current = true;
    setFilterForm({ sortBy: 'newest' });
  };

  const handleResetFilters = () => {
    resetFilterFormSilently();
    setAppliedFilters(null);
    setSearchTerm('');
    setAppliedSearchTerm('');
    setActiveStatus('');
    setPage(1);
  };

  const stats = useMemo(() => {
    const pendingCount = orders.filter((o) => o.status === 'Pending').length;
    const confirmedCount = orders.filter((o) => o.status === 'Confirmed').length;
    const shippingCount = orders.filter((o) => o.status === 'Shipping').length;
    const totalRevenue = orders
      .filter((o) => o.status === 'Completed' || o.status === 'Delivered')
      .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

    return [
      {
        icon: 'hourglass_top',
        label: isVi ? 'Chờ Xử Lý' : 'Pending',
        value: pendingCount,
        note: isVi ? 'Cần xác nhận ngay' : 'Requires seller confirmation',
        hot: pendingCount > 0,
      },
      {
        icon: 'package_2',
        label: isVi ? 'Chờ Giao Hang' : 'To Ship',
        value: confirmedCount,
        note: isVi ? 'Đang chuẩn bị gói hàng' : 'Ready for shipping provider',
        hot: confirmedCount > 0,
      },
      {
        icon: 'local_shipping',
        label: isVi ? 'Đang Giao' : 'In Transit',
        value: shippingCount,
        note: isVi ? 'Đang vận chuyển' : 'Currently with courier',
      },
      {
        icon: 'payments',
        label: isVi ? 'Doanh Thu Đơn' : 'Settled Revenue',
        value: formatVnd(totalRevenue),
        note: isVi ? 'Đơn hàng đã giao / hoàn thành' : 'Delivered and completed orders',
      },
    ];
  }, [orders, isVi]);

  const handleUpdateStatus = async (order, targetStatus) => {
    try {
      setUpdatingOrderId(order.orderId);
      await orderService.updateSellerOrderStatus(order.orderId, { status: targetStatus });
      showToast(isVi ? `Đã cập nhật trạng thái đơn hàng sang ${statusMeta[targetStatus]?.label || targetStatus}.` : `Order status updated to ${statusMeta[targetStatus]?.label || targetStatus}.`, 'success');
      await fetchOrders();
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể cập nhật trạng thái đơn hàng.' : 'Failed to update order status.'), 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getNextAction = (order) => {
    if (order.status === 'Pending') {
      return { label: isVi ? 'Xác Nhận' : 'Confirm', status: 'Confirmed', tone: 'primary' };
    }
    if (order.status === 'Confirmed') {
      return { label: isVi ? 'Giao Hàng' : 'Ship', status: 'Shipping', tone: 'info' };
    }
    return null;
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);

  const submitBuyerReport = async (payload) => {
    if (!reportTarget?.orderId) return;
    try {
      setReportSubmitting(true);
      await reportService.reportBuyer(reportTarget.orderId, payload);
      showToast(isVi ? 'Gửi báo cáo người mua thành công.' : 'Report submitted successfully.', 'success');
      setReportTarget(null);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể gửi báo cáo.' : 'Failed to submit report.'), 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{isVi ? 'Đang tải đơn hàng...' : 'Loading orders...'}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="om-page animate-fade-in">
      <header className="om-header">
        <div className="om-header-copy">
          <span className="om-eyebrow">{isVi ? 'Quản Lý Đơn Hàng' : 'Seller Orders'}</span>
          <h1>{isVi ? 'Danh Sách Đơn Hàng' : 'Order Management'}</h1>
          <p>{isVi ? 'Kiểm tra đơn hàng của người mua, xác nhận xử lý và đóng gói giao hàng.' : 'Review buyer orders, confirm processing, and keep fulfillment status current.'}</p>
        </div>
      </header>

      <section className="om-stats">
        {stats.map((stat) => (
          <article key={stat.label} className={`om-stat ${stat.hot ? 'hot' : ''}`}>
            <div>
              <span className="material-symbols-outlined">{stat.icon}</span>
              <span>{stat.label}</span>
            </div>
            <strong>{typeof stat.value === 'number' ? String(stat.value).padStart(2, '0') : stat.value}</strong>
            <p>{stat.note}</p>
          </article>
        ))}
      </section>

      <section className="om-list-controls">
        <div className="om-control-tools">
          <form className="om-search om-list-search" onSubmit={handleSearch}>
            <span className="material-symbols-outlined">search</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isVi ? 'Tìm kiếm đơn hàng, sản phẩm, người mua...' : 'Search orders, products, buyers...'}
            />
          </form>
          <label className="om-sort-control">
            <span>{isVi ? 'Sắp xếp' : 'Sort'}</span>
            <select value={filterForm.sortBy} onChange={(event) => handleFilterChange('sortBy', event.target.value)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="om-reset-button"
            disabled={!hasActiveControls}
            onClick={handleResetFilters}
            aria-label={isVi ? 'Đặt lại bộ lọc' : 'Reset filters'}
            title={isVi ? 'Đặt lại bộ lọc' : 'Reset filters'}
          >
            <span className="material-symbols-outlined">restart_alt</span>
          </button>
        </div>
        <div className="om-tab-strip">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              className={activeStatus === tab.key ? 'active' : ''}
              onClick={() => {
                setAppliedFilters(null);
                resetFilterFormSilently();
                setActiveStatus(tab.key);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="om-panel">
        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>{isVi ? 'STT' : 'STT'}</th>
                <th>{isVi ? 'Khách Hàng' : 'Customer'}</th>
                <th>{isVi ? 'Chi Tiết Sản Phẩm' : 'Product Details'}</th>
                <th>{isVi ? 'Tổng Tiền' : 'Total Amount'}</th>
                <th>{isVi ? 'Trạng Thái' : 'Status'}</th>
                <th>{isVi ? 'Thao Tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">{isVi ? 'Đang tải đơn hàng...' : 'Loading orders...'}</div></td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">{isVi ? 'Không tìm thấy đơn hàng nào.' : 'No seller orders found.'}</div></td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const meta = statusMeta[order.status] || { label: order.status || 'Unknown', className: 'default' };
                  const action = getNextAction(order);
                  const orderNumber = (page - 1) * pageSize + index + 1;
                  const isUpdating = updatingOrderId === order.orderId;

                  return (
                    <tr key={order.orderId}>
                      <td className="om-index-cell">
                        <strong>{orderNumber}</strong>
                      </td>
                      <td>
                        <strong>{order.buyerName || (isVi ? 'Khách hàng' : 'Unknown Buyer')}</strong>
                      </td>
                      <td>
                        <div className="om-product">
                          <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                          <div>
                            <strong>{order.productName || (isVi ? 'Sản phẩm chưa đặt tên' : 'Untitled product')}</strong>
                            <span>{isVi ? 'Số lượng' : 'Qty'} {order.quantity || 0}</span>
                            {order.returnReason ? (
                              <div className="om-return-reason">{isVi ? 'Lý do trả hàng:' : 'Return reason:'} {order.returnReason}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatVnd(order.finalAmount || 0)}</strong>
                      </td>
                      <td><em className={`om-status ${meta.className}`}>{meta.label}</em></td>
                      <td>
                        <div className="om-actions">
                          <button
                            type="button"
                            className="om-detail-btn"
                            onClick={() => openDetail(order.orderId)}
                          >
                            {isVi ? 'Chi Tiết' : 'Details'}
                          </button>
                          {action ? (
                            <button
                              type="button"
                              className={`om-action-btn ${action.tone}`}
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(order, action.status)}
                            >
                              {isUpdating ? <span className="btn-spinner sm"></span> : action.label}
                            </button>
                          ) : null}
                          {order.status === 'ReturnRequested' ? (
                            <button
                              type="button"
                              className="om-action-btn primary"
                              onClick={() => openDetail(order.orderId)}
                            >
                              {isVi ? 'Xem Yêu Cầu Trả Hàng' : 'Review Return Request'}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="om-report-btn"
                            onClick={() => setReportTarget(order)}
                          >
                            {isVi ? 'Báo Cáo' : 'Report'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="om-pagination">
            <button
              type="button"
              disabled={page === 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {isVi ? 'Trước' : 'Previous'}
            </button>
            <span>
              {isVi ? 'Trang' : 'Page'} {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {isVi ? 'Sau' : 'Next'}
            </button>
          </div>
        )}
      </section>

      {reportTarget ? (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          onSubmit={submitBuyerReport}
          targetName={reportTarget.buyerName || (isVi ? 'Người mua' : 'Buyer')}
          targetType="User"
          reportType="Buyer"
          submitting={reportSubmitting}
        />
      ) : null}
    </div>
  );
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function normalizeFilterForm(form) {
  return {
    sortBy: form.sortBy || 'newest',
  };
}
