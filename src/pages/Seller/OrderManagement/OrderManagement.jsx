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
const numberFormatter = new Intl.NumberFormat('vi-VN');

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
  const [filterForm, setFilterForm] = useState({ sortBy: 'newest' });
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');
  const sellerId = user?.userId;

  const statusMeta = useMemo(() => ({
    AwaitingPayment: { label: t('sales_stats.awaiting_payment'), className: 'awaiting' },
    Pending: { label: t('sales_stats.pending'), className: 'pending' },
    Confirmed: { label: t('sales_stats.confirmed'), className: 'confirmed' },
    Shipping: { label: t('sales_stats.shipping'), className: 'shipping' },
    Delivered: { label: t('sales_stats.delivered'), className: 'delivered' },
    Completed: { label: t('sales_stats.completed'), className: 'completed' },
    DeliveryFailed: { label: t('sales_stats.delivery_failed'), className: 'delivery-failed' },
    Returned: { label: t('sales_stats.returned'), className: 'returned' },
    ReturnRequested: { label: t('history.refund_reason'), className: 'return-requested' },
    ReturnRejected: { label: t('admin.reject'), className: 'return-rejected' },
    Cancelled: { label: t('sales_stats.cancelled'), className: 'cancelled' },
  }), [t]);

  const tabs = useMemo(() => [
    { key: '', label: t('common.all') },
    { key: 'Pending', label: t('sales_stats.pending') },
    { key: 'Confirmed', label: t('sales_stats.confirmed') },
    { key: 'Shipping', label: t('sales_stats.shipping') },
    { key: 'Delivered', label: t('sales_stats.delivered') },
    { key: 'Completed', label: t('sales_stats.completed') },
    { key: 'Cancelled', label: t('sales_stats.cancelled') },
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
        PageNumber: page,
        PageSize: pageSize,
      });

      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setOrders(items);
      setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil((data?.totalCount ?? items.length) / pageSize)));
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, appliedFilters, appliedSearchTerm, filterForm.sortBy, page, sellerId, showToast, t]);

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
        label: t('sales_stats.pending'),
        value: pendingCount,
        note: t('my_products.subtitle'),
        hot: pendingCount > 0,
      },
      {
        icon: 'package_2',
        label: t('sales_stats.confirmed'),
        value: confirmedCount,
        note: t('my_products.subtitle'),
        hot: confirmedCount > 0,
      },
      {
        icon: 'local_shipping',
        label: t('sales_stats.shipping'),
        value: shippingCount,
        note: t('sales_stats.shipping'),
      },
      {
        icon: 'payments',
        label: t('seller.total_revenue'),
        value: formatVnd(totalRevenue),
        note: t('sales_stats.desc'),
      },
    ];
  }, [orders, t]);

  const handleUpdateStatus = async (order, targetStatus) => {
    try {
      setUpdatingOrderId(order.orderId);
      await orderService.updateSellerOrderStatus(order.orderId, { status: targetStatus });
      showToast(t('order_status_update.update_success'), 'success');
      await fetchOrders();
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
                <th>STT</th>
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
                        <strong>{order.buyerName || 'Buyer'}</strong>
                      </td>
                      <td>
                        <div className="om-product">
                          <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
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
                              onClick={() => openDetail(order.orderId)}
                            >
                              {t('common.view_detail')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="om-report-btn"
                            onClick={() => setReportTarget(order)}
                          >
                            {t('reports.report_button')}
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
              {t('common.previous')}
            </button>
            <span>
              {t('common.page')} {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </section>

      {reportTarget ? (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          onSubmit={submitBuyerReport}
          targetName={reportTarget.buyerName || 'Buyer'}
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
