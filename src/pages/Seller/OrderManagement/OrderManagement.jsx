import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import './OrderManagement.css';

const pageSize = 5;
const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const awaitingPaymentCancelDelayMs = 15 * 60 * 1000;

const tabs = [
  { key: '', label: 'All Orders' },
  { key: 'AwaitingPayment', label: 'Awaiting Payment' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Shipping', label: 'Shipping' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Returned', label: 'Returned' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const statusMeta = {
  AwaitingPayment: { label: 'Awaiting Payment', className: 'awaiting' },
  Pending: { label: 'Pending', className: 'pending' },
  Confirmed: { label: 'Confirmed', className: 'confirmed' },
  Shipping: { label: 'Shipping', className: 'shipping' },
  Delivered: { label: 'Delivered', className: 'delivered' },
  Returned: { label: 'Returned', className: 'returned' },
  Cancelled: { label: 'Cancelled', className: 'cancelled' },
};

const nextActionByStatus = {
  Pending: { label: 'Confirm', tone: 'primary' },
  Confirmed: { label: 'Ship', tone: 'primary' },
  Shipping: { label: 'Deliver', tone: 'primary' },
};

const initialFilterForm = {
  status: '',
  keyword: '',
  minTotal: '',
  fromDate: '',
  toDate: '',
  orderBy: 'CreatedAt desc',
};

const sortOptions = [
  { value: 'CreatedAt desc', label: 'Newest first' },
  { value: 'CreatedAt asc', label: 'Oldest first' },
  { value: 'FinalAmount desc', label: 'Highest total' },
  { value: 'FinalAmount asc', label: 'Lowest total' },
];

export default function OrderManagement() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterForm, setFilterForm] = useState(initialFilterForm);
  const [odataQuery, setOdataQuery] = useState(null);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');
  const sellerId = user?.userId || user?.id;

  const fetchOrders = useCallback(async () => {
    if (!sellerId) {
      return;
    }

    try {
      setLoading(true);
      const data = await orderService.getSellerOrders({
        sellerId,
        status: activeStatus || undefined,
        searchTerm: appliedSearchTerm || undefined,
        page,
        pageSize,
      });

      setOrders(data?.items || []);
      setTotalItems(data?.totalItems || 0);
      setTotalPages(data?.totalPages || 1);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load seller orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, appliedSearchTerm, page, sellerId, showToast]);

  const fetchFilteredOrders = useCallback(async (nextPage, query) => {
    if (!sellerId || !query) {
      return;
    }

    try {
      setLoading(true);
      const data = await orderService.getSellerOrdersOData({
        sellerId,
        ...query,
        $count: true,
        $skip: (nextPage - 1) * pageSize,
        $top: pageSize,
      });
      const items = normalizeODataItems(data);
      const count = data?.['@odata.count'] ?? data?.count ?? items.length;

      setOrders(items);
      setTotalItems(count);
      setTotalPages(Math.max(1, Math.ceil(count / pageSize)));
    } catch (error) {
      showToast(error?.response?.data || 'Failed to filter seller orders.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sellerId, showToast]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      if (odataQuery) {
        fetchFilteredOrders(page, odataQuery);
      } else {
        fetchOrders();
      }
    }
  }, [fetchFilteredOrders, fetchOrders, isAdmin, isSeller, odataQuery, page, user]);

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

        if (activeStatus || appliedSearchTerm || odataQuery || page !== 1) {
          setActiveStatus('');
          setAppliedSearchTerm('');
          setSearchTerm('');
          setOdataQuery(null);
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
        connection.invoke('LeaveSellerOrderGroup', sellerId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [activeStatus, appliedSearchTerm, fetchOrders, isSeller, odataQuery, page, sellerId, showToast]);

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
    setOdataQuery(null);
    setAppliedSearchTerm(searchTerm.trim());
    setPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilterForm((current) => ({ ...current, [field]: value }));
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    const query = buildSellerOrderODataQuery(filterForm);
    setOdataQuery(query);
    setAppliedSearchTerm('');
    setSearchTerm('');
    setActiveStatus('');
    setPage(1);
    setFiltersOpen(false);
  };

  const handleClearFilters = () => {
    setFilterForm(initialFilterForm);
    setOdataQuery(null);
    setPage(1);
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);
  const openStatusUpdate = (orderId) => navigate(`/seller-dashboard/orders/${orderId}/status`);

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
        <form className="om-search" onSubmit={handleSearch}>
          <span className="material-symbols-outlined">search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search orders, products, or customers..."
          />
        </form>
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

      <section className="om-command-bar">
        <div>
          <button
            type="button"
            className={`om-tool-button ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <span className="material-symbols-outlined">filter_alt</span>
            Filter Orders
          </button>
        </div>
        {odataQuery ? <span className="om-filter-badge">OData filter active</span> : null}
      </section>

      {filtersOpen ? (
        <form className="om-filter-panel" onSubmit={handleApplyFilters}>
          <label>
            <span>Status</span>
            <select value={filterForm.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
              <option value="">All statuses</option>
              {tabs.filter((tab) => tab.key).map((tab) => (
                <option key={tab.key} value={tab.key}>{tab.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Keyword</span>
            <input
              value={filterForm.keyword}
              onChange={(event) => handleFilterChange('keyword', event.target.value)}
              placeholder="Order, product, buyer..."
            />
          </label>
          <label>
            <span>Min total</span>
            <input
              type="number"
              min="0"
              value={filterForm.minTotal}
              onChange={(event) => handleFilterChange('minTotal', event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            <span>From date</span>
            <input
              type="date"
              value={filterForm.fromDate}
              onChange={(event) => handleFilterChange('fromDate', event.target.value)}
            />
          </label>
          <label>
            <span>To date</span>
            <input
              type="date"
              value={filterForm.toDate}
              onChange={(event) => handleFilterChange('toDate', event.target.value)}
            />
          </label>
          <label>
            <span>Sort</span>
            <select value={filterForm.orderBy} onChange={(event) => handleFilterChange('orderBy', event.target.value)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="om-filter-actions">
            <button type="button" onClick={handleClearFilters}>Clear</button>
            <button type="submit">Apply Filter</button>
          </div>
        </form>
      ) : null}

      <section className="om-panel">
        <div className="om-tabs">
          <div>
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={activeStatus === tab.key ? 'active' : ''}
                onClick={() => {
                  setOdataQuery(null);
                  setActiveStatus(tab.key);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="om-table-wrap">
          <table className="om-table">
            <thead>
              <tr>
                <th>Order ID & Date</th>
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
                orders.map((order) => {
                  const meta = statusMeta[order.status] || { label: order.status || 'Unknown', className: 'default' };
                  const action = getNextAction(order);

                  return (
                    <tr key={order.orderId}>
                      <td>
                        <strong>#{order.orderCode || order.orderId}</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </td>
                      <td>
                        <strong>{order.buyerName || 'Unknown Buyer'}</strong>
                        <span>{order.buyerEmail || order.buyerId || '-'}</span>
                      </td>
                      <td>
                        <div className="om-product">
                          <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                          <div>
                            <strong>{order.productName || 'Untitled product'}</strong>
                            <span>Qty {order.quantity || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatVnd(order.finalAmount || 0)}</strong>
                        <span>VND</span>
                      </td>
                      <td><em className={`om-status ${meta.className}`}>{meta.label}</em></td>
                      <td>
                        <div className="om-actions">
                          <button
                            type="button"
                            aria-label="View order detail"
                            title="Order detail"
                            onClick={() => openDetail(order.orderId)}
                          >
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          {action ? (
                            <button
                              type="button"
                              className={`om-primary-action ${action.tone || 'primary'}`}
                              onClick={() => openStatusUpdate(order.orderId)}
                            >
                              {action.label}
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

function normalizeODataItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.Value)) return data.Value;
  return [];
}

function buildSellerOrderODataQuery(form) {
  const filterParts = [];
  const keyword = form.keyword.trim().toLowerCase();
  const minTotal = Number(form.minTotal);

  if (form.status) {
    filterParts.push(`Status eq '${escapeODataString(form.status)}'`);
  }

  if (keyword) {
    const escapedKeyword = escapeODataString(keyword);
    filterParts.push([
      `(OrderCode ne null and contains(tolower(OrderCode),'${escapedKeyword}'))`,
      `(ProductName ne null and contains(tolower(ProductName),'${escapedKeyword}'))`,
      `(BuyerName ne null and contains(tolower(BuyerName),'${escapedKeyword}'))`,
      `(BuyerEmail ne null and contains(tolower(BuyerEmail),'${escapedKeyword}'))`,
    ].join(' or '));
  }

  if (Number.isFinite(minTotal) && minTotal > 0) {
    filterParts.push(`FinalAmount ge ${minTotal}`);
  }

  if (form.fromDate) {
    filterParts.push(`CreatedAt ge ${form.fromDate}T00:00:00Z`);
  }

  if (form.toDate) {
    filterParts.push(`CreatedAt le ${form.toDate}T23:59:59Z`);
  }

  return {
    ...(filterParts.length ? { $filter: filterParts.map((part) => `(${part})`).join(' and ') } : {}),
    $orderby: form.orderBy || 'CreatedAt desc',
  };
}

function escapeODataString(value) {
  return String(value || '').replace(/'/g, "''");
}

function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function getNextAction(order) {
  if (order?.status === 'AwaitingPayment') {
    return isAwaitingPaymentExpired(order)
      ? { label: 'Cancel', tone: 'danger' }
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
