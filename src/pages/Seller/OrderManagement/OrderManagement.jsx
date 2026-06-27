import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderManagement.css';

const pageSize = 5;
const SHIPPING_PROVIDER = 'GHN';
const numberFormatter = new Intl.NumberFormat('vi-VN');
const awaitingPaymentCancelDelayMs = 15 * 60 * 1000;
const defaultShippingDelayMs = 30 * 1000;

const tabs = [
  { key: '', label: 'All' },
  { key: 'AwaitingPayment', label: 'Awaiting Payment' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Shipping', label: 'Shipping' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Completed', label: 'Completed' },
  { key: 'DeliveryFailed', label: 'Delivery Failed' },
  { key: 'Returned', label: 'Returned' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const statusMeta = {
  AwaitingPayment: { label: 'Awaiting Payment', className: 'awaiting' },
  Pending: { label: 'Pending', className: 'pending' },
  Confirmed: { label: 'Confirmed', className: 'confirmed' },
  Shipping: { label: 'Shipping', className: 'shipping' },
  Delivered: { label: 'Delivered', className: 'delivered' },
  Completed: { label: 'Completed', className: 'completed' },
  DeliveryFailed: { label: 'Delivery Failed', className: 'delivery-failed' },
  Returned: { label: 'Returned', className: 'returned' },
  ReturnRequested: { label: 'Return Requested', className: 'return-requested' },
  ReturnRejected: { label: 'Return Rejected', className: 'return-rejected' },
  Cancelled: { label: 'Cancelled', className: 'cancelled' },
};

const nextActionByStatus = {
  Pending: { label: 'Confirm', status: 'Confirmed', tone: 'primary' },
  Confirmed: { label: 'Ship', status: 'Shipping', tone: 'info' },
};

const initialFilterForm = {
  sortBy: 'newest',
};

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total_desc', label: 'Highest total' },
  { value: 'total_asc', label: 'Lowest total' },
];

export default function OrderManagement() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const skipNextFilterAutoApply = useRef(false);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterForm, setFilterForm] = useState(initialFilterForm);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

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
    if (!sellerId) {
      return;
    }

    try {
      setLoading(true);
      const effectiveStatus = appliedFilters?.status || activeStatus || undefined;

      const data = await orderService.getSellerOrders({
        SellerId: sellerId,
        Status: effectiveStatus,
        SearchTerm: appliedSearchTerm || undefined,
        SortBy: appliedFilters?.sortBy || 'newest',
        Page: page,
        PageSize: pageSize,
      });

      setOrders(data?.items || []);
      setTotalItems(data?.totalItems || 0);
      setTotalPages(data?.totalPages || 1);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load seller orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, appliedFilters, appliedSearchTerm, page, sellerId, showToast]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      fetchOrders();
    }
  }, [fetchOrders, isAdmin, isSeller, user]);

  useEffect(() => {
    if (!sellerId || !isSeller) {
      return undefined;
    }

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderStatusChanged = (payload) => {
      const eventType = payload?.eventType || payload?.EventType;
      const isNewSellerOrder = eventType === 'Created' || eventType === 'PaymentConfirmed';
      const realtimeOrder = toRealtimeOrder(payload);

      if (isNewSellerOrder) {
        showToast('New seller order received.', 'success');
        if (realtimeOrder) {
          setOrders((value) => upsertOrder(value, realtimeOrder));
        }

        if (activeStatus || appliedSearchTerm || appliedFilters || page !== 1) {
          setActiveStatus('');
          setAppliedSearchTerm('');
          setSearchTerm('');
          setAppliedFilters(null);
          setPage(1);
          return;
        }
      }

      if (realtimeOrder) {
        setOrders((value) => upsertOrder(value, realtimeOrder));
      }
      fetchOrders();
    };

    connection.on('SellerOrderStatusChanged', handleOrderStatusChanged);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinSellerOrderGroup', sellerId);
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
        connection.invoke('LeaveSellerOrderGroup', sellerId).catch(() => { });
      }
      connection.stop().catch(() => { });
    };
  }, [activeStatus, appliedFilters, appliedSearchTerm, fetchOrders, isSeller, page, sellerId, showToast]);

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const firstVisibleItem = orders.length ? (page - 1) * pageSize + 1 : 0;
  const lastVisibleItem = orders.length ? firstVisibleItem + orders.length - 1 : 0;

  const stats = useMemo(() => {
    const awaiting = orders.filter((order) => order.status === 'AwaitingPayment' || order.status === 'Pending').length;
    const confirmed = orders.filter((order) => order.status === 'Confirmed').length;
    const shipping = orders.filter((order) => order.status === 'Shipping').length;

    return [
      { label: 'Total Orders', icon: 'shopping_cart', value: totalItems, note: 'All matched orders' },
      { label: 'Need Confirm', icon: 'fact_check', value: awaiting, note: 'Waiting seller action', hot: true },
      { label: 'Confirmed', icon: 'inventory', value: confirmed, note: 'Ready to ship' },
      { label: 'Shipping', icon: 'local_shipping', value: shipping, note: 'In transit' },
    ];
  }, [orders, totalItems]);

  const handleSearch = (event) => {
    event.preventDefault();
    setAppliedSearchTerm(searchTerm.trim());
    setPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilterForm((current) => ({ ...current, [field]: value }));
  };

  const resetFilterFormSilently = () => {
    if (!isDefaultFilterForm(filterForm)) {
      skipNextFilterAutoApply.current = true;
    }
    setFilterForm(initialFilterForm);
  };

  const handleResetFilters = () => {
    resetFilterFormSilently();
    setAppliedFilters(null);
    setAppliedSearchTerm('');
    setSearchTerm('');
    setActiveStatus('');
    setPage(1);
  };

  const handleInlineStatusUpdate = async (order) => {
    const action = getNextAction(order);
    if (!action?.status || !sellerId) {
      return;
    }

    try {
      setUpdatingOrderId(order.orderId);
      const updated = await orderService.updateStatus(
        order.orderId,
        buildStatusPayload(order, action.status),
        { sellerId }
      );

      const updatedOrder = { ...order, ...(updated || {}), status: updated?.status || action.status };
      setOrders((current) => current.map((item) => (
        item.orderId === order.orderId ? { ...item, ...updatedOrder } : item
      )));
      showToast(`Order status updated to ${getStatusLabel(updatedOrder.status)}.`, 'success');
      fetchOrders();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update order status.', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleApproveReturn = async (orderId) => {
    if (!sellerId) return;

    try {
      setUpdatingOrderId(orderId);
      await orderService.approveReturn(orderId, sellerId);
      showToast('Return approved successfully.', 'success');
      fetchOrders();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to approve return.', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRejectReturn = async (orderId) => {
    if (!sellerId) return;

    try {
      setUpdatingOrderId(orderId);
      await orderService.rejectReturn(orderId, sellerId);
      showToast('Return rejected successfully.', 'success');
      fetchOrders();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to reject return.', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>Loading orders...</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="om-page animate-fade-in">
      <header className="om-header">
        <div className="om-header-copy">
          <span className="om-eyebrow">Seller Orders</span>
          <h1>Order Management</h1>
          <p>Review buyer orders, confirm processing, and keep fulfillment status current.</p>
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
              placeholder="Search orders, products, buyers..."
            />
          </form>
          <label className="om-sort-control">
            <span>Sort</span>
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
            aria-label="Reset filters"
            title="Reset filters"
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
                <th>Customer</th>
                <th>Product Details</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">Loading orders...</div></td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6"><div className="om-empty">No seller orders found.</div></td>
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
                        <strong>{order.buyerName || 'Unknown Buyer'}</strong>
                      </td>
                      <td>
                        <div className="om-product">
                          <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                          <div>
                            <strong>{order.productName || 'Untitled product'}</strong>
                              <span>Qty {order.quantity || 0}</span>
                              {order.returnReason ? (
                                <div className="om-return-reason">Return reason: {order.returnReason}</div>
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
                            Details
                          </button>
                          {order.status === 'ReturnRequested' ? (
                            <>
                              <button
                                type="button"
                                className="om-primary-action primary"
                                disabled={isUpdating}
                                onClick={() => handleApproveReturn(order.orderId)}
                              >
                                {isUpdating === order.orderId ? 'Processing...' : 'Approve Return'}
                              </button>
                              <button
                                type="button"
                                className="om-primary-action danger"
                                disabled={isUpdating}
                                onClick={() => handleRejectReturn(order.orderId)}
                              >
                                {isUpdating === order.orderId ? 'Processing...' : 'Reject Return'}
                              </button>
                            </>
                          ) : action ? (
                            <button
                              type="button"
                              className={`om-primary-action ${action.tone || 'primary'}`}
                              disabled={isUpdating}
                              onClick={() => handleInlineStatusUpdate(order)}
                            >
                              {isUpdating ? 'Updating...' : action.label}
                            </button>
                          ) : (
                            <span className="om-action-spacer" aria-hidden="true" />
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

        <footer className="om-footer">
          <span>Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems} orders</span>
          <nav className="om-pagination" aria-label="Order list pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {paginationItems.map((item, index) => (
              item === 'ellipsis' ? (
                <span key={`${item}-${index}`} className="om-pagination-ellipsis">...</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={page === item ? 'active' : ''}
                  onClick={() => setPage(item)}
                  aria-current={page === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            ))}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next page">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </nav>
        </footer>
      </section>
    </div>
  );
}

function normalizeFilterForm(form) {
  const nextFilters = {
    sortBy: form.sortBy,
  };

  const hasFilters = nextFilters.sortBy !== initialFilterForm.sortBy;

  return hasFilters ? nextFilters : null;
}

function isDefaultFilterForm(form) {
  return form.sortBy === initialFilterForm.sortBy;
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function buildStatusPayload(order, status) {
  return {
    status,
    trackingCode: order.trackingCode || null,
    shippingProvider: status === 'Shipping' ? SHIPPING_PROVIDER : order.shippingProvider || null,
    expectedDeliveryTime: status === 'Shipping'
      ? new Date(Date.now() + defaultShippingDelayMs).toISOString()
      : null,
  };
}

function getStatusLabel(status) {
  return statusMeta[status]?.label || status || 'Unknown';
}

function getNextAction(order) {
  if (order?.status === 'AwaitingPayment') {
    return isAwaitingPaymentExpired(order)
      ? { label: 'Cancel', status: 'Cancelled', tone: 'danger' }
      : null;
  }

  return nextActionByStatus[order?.status] || null;
}

function isAwaitingPaymentExpired(order) {
  if (!order?.createdAt) return false;
  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return Date.now() - createdAt.getTime() >= awaitingPaymentCancelDelayMs;
}

function toRealtimeOrder(payload) {
  if (!payload) return null;

  const orderId = payload.orderId || payload.OrderId;
  if (!orderId) return null;

  return {
    orderId,
    orderCode: payload.orderCode || payload.OrderCode,
    productId: payload.productId || payload.ProductId,
    productName: payload.productName || payload.ProductName,
    productImageUrl: payload.productImageUrl || payload.ProductImageUrl,
    buyerId: payload.buyerId || payload.BuyerId,
    buyerName: payload.buyerName || payload.BuyerName,
    buyerEmail: payload.buyerEmail || payload.BuyerEmail,
    sellerId: payload.sellerId || payload.SellerId,
    quantity: payload.quantity ?? payload.Quantity,
    unitPrice: payload.unitPrice ?? payload.UnitPrice,
    totalAmount: payload.totalAmount ?? payload.TotalAmount,
    shippingFee: payload.shippingFee ?? payload.ShippingFee,
    discountAmount: payload.discountAmount ?? payload.DiscountAmount,
    finalAmount: payload.finalAmount ?? payload.FinalAmount,
    status: payload.status || payload.Status,
    trackingCode: payload.trackingCode || payload.TrackingCode,
    shippingProvider: payload.shippingProvider || payload.ShippingProvider,
    expectedDeliveryTime: payload.expectedDeliveryTime || payload.ExpectedDeliveryTime,
    createdAt: payload.createdAt || payload.CreatedAt,
    updatedAt: payload.updatedAt || payload.UpdatedAt,
  };
}

function upsertOrder(orders, nextOrder) {
  const exists = orders.some((order) => order.orderId === nextOrder.orderId);
  if (!exists) return [nextOrder, ...orders].slice(0, pageSize);

  return orders.map((order) => (
    order.orderId === nextOrder.orderId ? { ...order, ...nextOrder } : order
  ));
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 4) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 2) {
    return [1, 2, 3, 'ellipsis'];
  }

  if (currentPage >= totalPages - 1) {
    return ['ellipsis', totalPages - 2, totalPages - 1, totalPages];
  }

  return ['ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis'];
}
