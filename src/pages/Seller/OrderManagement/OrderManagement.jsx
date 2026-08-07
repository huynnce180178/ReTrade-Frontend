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
import SellerPagination from '../../../components/SellerPagination/SellerPagination';
import ReturnApprovalModal from '../../../components/ReturnApprovalModal/ReturnApprovalModal';

const pageSize = 5;
const numberFormatter = new Intl.NumberFormat('vi-VN');
function formatVnd(val) {
  return `${numberFormatter.format(Number(val) || 0)} VND`;
}
const REPORT_ALLOWED_STATUSES = [
  'Delivered',
  'DeliveryFailed',
  'Completed',
  'ReturnRequested',
  'ReturnRejected',
  'Returned',
];

const canReportOrder = (status) => REPORT_ALLOWED_STATUSES
  .some((allowed) => allowed.toLowerCase() === String(status || '').toLowerCase());

const SELLER_ORDER_EVENTS = [
  { name: 'SellerOrderCreated', resetToFirstPage: true },
  { name: 'SellerOrderPlaced', resetToFirstPage: true },
  { name: 'NewSellerOrder', resetToFirstPage: true },
  { name: 'NewOrder', resetToFirstPage: true },
  { name: 'OrderCreated', resetToFirstPage: true },
  { name: 'ReceiveOrderNotification', resetToFirstPage: true },
  { name: 'SellerOrderStatusChanged', resetToFirstPage: false },
  { name: 'OrderStatusUpdated', resetToFirstPage: false },
];

const getPayloadSellerId = (payload) => (
  payload?.sellerId ||
  payload?.SellerId ||
  payload?.order?.sellerId ||
  payload?.Order?.SellerId ||
  payload?.data?.sellerId ||
  payload?.Data?.SellerId
);

export default function OrderManagement() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const skipNextFilterAutoApply = useRef(false);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterForm, setFilterForm] = useState({ sortBy: 'newest' });
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [allSellerOrders, setAllSellerOrders] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [returnModalTarget, setReturnModalTarget] = useState(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const latestFetchOrdersRef = useRef(null);
  const latestFetchAllOrdersRef = useRef(null);
  const latestPageRef = useRef(1);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');
  const sellerId = user?.userId || user?.id || user?.accountId;

  const statusMeta = useMemo(() => ({
    AwaitingPayment: { label: t('order_status.awaiting_payment'), className: 'awaiting' },
    Pending: { label: t('order_status.pending'), className: 'pending' },
    Confirmed: { label: t('order_status.confirmed'), className: 'confirmed' },
    Shipping: { label: t('order_status.shipping'), className: 'shipping' },
    Delivered: { label: t('order_status.delivered'), className: 'delivered' },
    Completed: { label: t('order_status.completed'), className: 'completed' },
    DeliveryFailed: { label: t('order_status.delivery_failed'), className: 'delivery-failed' },
    Returned: { label: t('order_status.returned'), className: 'returned' },
    ReturnRequested: { label: t('order_status.return_requested'), className: 'return-requested' },
    ReturnRejected: { label: t('order_status.return_rejected'), className: 'return-rejected' },
    Cancelled: { label: t('order_status.cancelled'), className: 'cancelled' },
  }), [t]);

  const tabs = useMemo(() => [
    { key: '', label: t('common.all') },
    { key: 'Pending', label: t('order_status.pending') },
    { key: 'Confirmed', label: t('order_status.confirmed') },
    { key: 'Shipping', label: t('order_status.shipping') },
    { key: 'Delivered', label: t('order_status.delivered') },
    { key: 'Completed', label: t('order_status.completed') },
    { key: 'ReturnRequested', label: t('order_status.return_requested') },
    { key: 'Returned', label: t('order_status.returned') },
    { key: 'ReturnRejected', label: t('order_status.return_rejected') },
    { key: 'Cancelled', label: t('order_status.cancelled') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { value: 'newest', label: t('product.sort_newest') },
    { value: 'price_desc', label: t('product.sort_price_desc') },
    { value: 'price_asc', label: t('product.sort_price_asc') },
  ], [t]);

  const hasActiveControls = Boolean(
    activeStatus || appliedSearchTerm || (appliedFilters && appliedFilters.sortBy !== 'newest')
  );

  useEffect(() => {
    if (skipNextFilterAutoApply.current) {
      skipNextFilterAutoApply.current = false;
      return;
    }

    const nextNormalized = normalizeFilterForm(filterForm);
    setAppliedFilters((current) => {
      if (JSON.stringify(current) === JSON.stringify(nextNormalized)) {
        return current;
      }
      return nextNormalized;
    });

    setPage(1);
  }, [filterForm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearchTerm(searchTerm.trim());
      setPage(1);
    }, 400);

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
        Page: page,
        PageSize: pageSize,
      });

      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const nextTotalCount = data?.totalCount ?? data?.totalItems ?? items.length;
      setOrders(items);
      setTotalCount(nextTotalCount);
      setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil(nextTotalCount / pageSize)));
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, appliedFilters, appliedSearchTerm, filterForm.sortBy, page, sellerId, showToast, t]);

  const fetchAllOrdersForStats = useCallback(async () => {
    if (!sellerId) return;
    try {
      const data = await orderService.getSellerOrders({
        SellerId: sellerId,
        Page: 1,
        PageSize: 1000,
      });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setAllSellerOrders(items);
    } catch {
      setAllSellerOrders([]);
    }
  }, [sellerId]);

  useEffect(() => {
    latestFetchOrdersRef.current = fetchOrders;
  }, [fetchOrders]);

  useEffect(() => {
    latestFetchAllOrdersRef.current = fetchAllOrdersForStats;
  }, [fetchAllOrdersForStats]);

  useEffect(() => {
    latestPageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      fetchOrders();
      fetchAllOrdersForStats();
    }
  }, [fetchAllOrdersForStats, fetchOrders, isAdmin, isSeller, user]);

  useEffect(() => {
    if (authLoading || !user || !sellerId || (!isSeller && !isAdmin)) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleSellerOrderEvent = (payload, resetToFirstPage = false) => {
      if (disposed) return;

      const payloadSellerId = getPayloadSellerId(payload);
      if (payloadSellerId && sellerId && String(payloadSellerId) !== String(sellerId)) {
        return;
      }

      latestFetchAllOrdersRef.current?.();

      if (resetToFirstPage && latestPageRef.current !== 1) {
        setPage(1);
        return;
      }

      latestFetchOrdersRef.current?.();
    };

    const handlers = SELLER_ORDER_EVENTS.map((event) => {
      const handler = (payload) => handleSellerOrderEvent(payload, event.resetToFirstPage);
      connection.on(event.name, handler);
      return { eventName: event.name, handler };
    });

    connection.start()
      .then(() => {
        if (!disposed) {
          connection.invoke('JoinSellerOrderGroup', sellerId).catch(() => { });
          connection.invoke('JoinSellerOrders').catch(() => { });
        }
      })
      .catch(() => { });

    return () => {
      disposed = true;
      handlers.forEach(({ eventName, handler }) => {
        connection.off(eventName, handler);
      });
      connection.stop().catch(() => { });
    };
  }, [authLoading, isAdmin, isSeller, sellerId, user]);

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
    const targetOrders = allSellerOrders.length > 0 ? allSellerOrders : orders;
    const pendingCount = targetOrders.filter((o) => o.status === 'Pending').length;
    const confirmedCount = targetOrders.filter((o) => o.status === 'Confirmed').length;
    const shippingCount = targetOrders.filter((o) => o.status === 'Shipping').length;
    const returnRequestedCount = targetOrders.filter((o) => o.status === 'ReturnRequested').length;
    const totalRevenue = targetOrders
      .filter((o) => o.status === 'Completed' || o.status === 'Delivered')
      .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

    return [
      {
        icon: 'hourglass_top',
        label: t('order_status.pending'),
        value: pendingCount,
        note: t('my_products.subtitle'),
        hot: pendingCount > 0,
      },
      {
        icon: 'package_2',
        label: t('order_status.confirmed'),
        value: confirmedCount,
        note: t('my_products.subtitle'),
        hot: confirmedCount > 0,
      },
      {
        icon: 'local_shipping',
        label: t('order_status.shipping'),
        value: shippingCount,
        note: t('order_status.shipping'),
      },
      {
        icon: 'assignment_return',
        label: t('order_status.return_requested'),
        value: returnRequestedCount,
        note: t('order_status.return_requested'),
        hot: returnRequestedCount > 0,
      },
      {
        icon: 'payments',
        label: t('seller.total_revenue'),
        value: formatVnd(totalRevenue),
        note: t('sales_stats.desc'),
      },
    ];
  }, [allSellerOrders, orders, t]);

  const handleUpdateStatus = async (order, targetStatus) => {
    try {
      setUpdatingOrderId(order.orderId);
      await orderService.updateSellerOrderStatus(
        order.orderId,
        { status: targetStatus },
        { sellerId: user.userId }
      );
      showToast(t('order_status_update.update_success'), 'success');
      await fetchOrders();
      await fetchAllOrdersForStats();
    } catch (error) {
      showToast(error?.response?.data || t('order_status_update.update_error'), 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getNextAction = (order) => {
    if (order.status === 'Pending') {
      return { label: t('common.confirm'), status: 'Confirmed', tone: 'primary' };
    }
    if (order.status === 'Confirmed') {
      return { label: t('sales_stats.shipping'), status: 'Shipping', tone: 'info' };
    }
    return null;
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);

  const submitBuyerReport = async (payload) => {
    if (!reportTarget?.orderId) return;
    try {
      setReportSubmitting(true);
      await reportService.reportBuyer(reportTarget.orderId, payload);
      showToast(t('reports.report_success'), 'success');
      setReportTarget(null);
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleApproveReturnModal = async (targetOrder) => {
    if (!targetOrder?.orderId || !sellerId) return;
    try {
      setReturnSubmitting(true);
      await orderService.approveReturnRequest(targetOrder.orderId, sellerId);
      showToast(t('order_status_update.update_success'), 'success');
      setReturnModalTarget(null);
      await fetchOrders();
      await fetchAllOrdersForStats();
    } catch (error) {
      showToast(error?.response?.data || t('order_status_update.update_error'), 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleRejectReturnModal = async (targetOrder, reason) => {
    if (!targetOrder?.orderId || !sellerId) return;
    try {
      setReturnSubmitting(true);
      await orderService.rejectReturnRequest(targetOrder.orderId, reason, sellerId);
      showToast(t('order_status_update.update_success'), 'success');
      setReturnModalTarget(null);
      await fetchOrders();
      await fetchAllOrdersForStats();
    } catch (error) {
      showToast(error?.response?.data || t('order_status_update.update_error'), 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>{t('common.loading')}</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="om-page animate-fade-in">
      <header className="om-header">
        <div className="om-header-copy">
          <span className="om-eyebrow">{t('seller.orders_management')}</span>
          <h1>{t('order_management.title')}</h1>
          <p>{t('order_management.subtitle')}</p>
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
              placeholder={t('common.search_placeholder')}
            />
          </form>
          <label className="om-sort-control">
            <span>{t('common.sort')}</span>
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
            aria-label={t('common.reset')}
            title={t('common.reset')}
          >
            <span className="material-symbols-outlined">restart_alt</span>
          </button>
        </div>
        <div className="om-tab-strip">
          {tabs.map((tab) => (
            <button
              key={tab.key || 'all'}
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
                <th>{t('common.stt')}</th>
                <th>{t('order_management.th_buyer')}</th>
                <th>{t('my_products.th_product')}</th>
                <th>{t('order_management.th_total')}</th>
                <th>{t('order_management.th_status')}</th>
                <th>{t('order_management.th_action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">{t('common.loading')}</div></td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">{t('common.no_data')}</div></td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const meta = statusMeta[order.status] || { label: order.status || t('common.unknown'), className: 'default' };
                  const action = getNextAction(order);
                  const orderNumber = (page - 1) * pageSize + index + 1;
                  const isUpdating = updatingOrderId === order.orderId;

                  return (
                    <tr key={order.orderId}>
                      <td className="om-index-cell">
                        <strong>{orderNumber}</strong>
                      </td>
                      <td>
                        <strong>{order.buyerName || t('common.unknown_buyer')}</strong>
                      </td>
                      <td>
                        <div className="om-product">
                          <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || t('nav.product')} />
                          <div>
                            <strong>{order.productName || t('nav.product')}</strong>
                            <span>{t('common.quantity')} {order.quantity || 0}</span>
                            {order.returnReason ? (
                              <div className="om-return-reason">{t('history.refund_reason')}: {order.returnReason}</div>
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
                            {t('common.detail')}
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
                              onClick={() => setReturnModalTarget(order)}
                            >
                              {t('order_status.review_return')}
                            </button>
                          ) : null}
                          {canReportOrder(order.status) && (
                            <button
                              type="button"
                              className="om-report-btn"
                              onClick={() => setReportTarget(order)}
                            >
                              {t('reports.report_button')}
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <SellerPagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalCount}
          disabled={loading}
          onPageChange={setPage}
        />
      </section>

      {reportTarget ? (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          onSubmit={submitBuyerReport}
          targetName={reportTarget.buyerName || t('common.unknown_buyer')}
          targetType="User"
          reportType="Buyer"
          submitting={reportSubmitting}
        />
      ) : null}

      {returnModalTarget ? (
        <ReturnApprovalModal
          isOpen={Boolean(returnModalTarget)}
          order={returnModalTarget}
          submitting={returnSubmitting}
          onClose={() => setReturnModalTarget(null)}
          onApprove={handleApproveReturnModal}
          onReject={handleRejectReturnModal}
        />
      ) : null}
    </div>
  );
}

function normalizeFilterForm(form) {
  return {
    sortBy: form.sortBy || 'newest',
  };
}
