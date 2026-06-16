import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import '../../../styles/SellerDashboard.css';

const pageSize = 10;
const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

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

const nextAction = {
  Pending: { label: 'Confirm', status: 'Confirmed' },
  Confirmed: { label: 'Ship', status: 'Shipping' },
  Shipping: { label: 'Deliver', status: 'Delivered' },
};

export default function OrderManagement() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await orderService.getSellerOrders({
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
  }, [activeStatus, appliedSearchTerm, page, showToast]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      fetchOrders();
    }
  }, [fetchOrders, isAdmin, isSeller, user]);

  useEffect(() => {
    if (!user?.userId || !isSeller) {
      return undefined;
    }

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleOrderStatusChanged = () => {
      fetchOrders();
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
  }, [fetchOrders, isSeller, user?.userId]);

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const firstVisibleItem = orders.length ? (page - 1) * pageSize + 1 : 0;
  const lastVisibleItem = orders.length ? firstVisibleItem + orders.length - 1 : 0;

  const stats = useMemo(() => {
    const awaiting = orders.filter((order) => order.status === 'AwaitingPayment' || order.status === 'Pending').length;
    const confirmed = orders.filter((order) => order.status === 'Confirmed').length;
    const shipping = orders.filter((order) => order.status === 'Shipping').length;
    const revenue = orders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);

    return [
      { label: 'Total Orders', icon: 'shopping_cart', value: totalItems, note: 'All matched orders' },
      { label: 'Need Confirm', icon: 'fact_check', value: awaiting, note: 'Waiting seller action', hot: true },
      { label: 'Confirmed', icon: 'inventory', value: confirmed, note: 'Ready to ship' },
      { label: 'Shipping', icon: 'local_shipping', value: shipping, note: 'In transit' },
      { label: 'Revenue', icon: 'payments', value: compactMoney(revenue), note: 'Current page', dark: true },
    ];
  }, [orders, totalItems]);

  const handleSearch = (event) => {
    event.preventDefault();
    setAppliedSearchTerm(searchTerm.trim());
    setPage(1);
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);

  const updateOrderStatus = async (order, status) => {
    try {
      setUpdatingId(order.orderId);
      await orderService.updateStatus(order.orderId, { status });
      showToast(`Order ${order.orderCode || order.orderId} updated to ${status}.`, 'success');
      fetchOrders();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update order status.', 'error');
    } finally {
      setUpdatingId('');
    }
  };

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>Loading orders...</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="seller-orders-page animate-fade-in">
      <header className="seller-orders-hero">
        <div>
          <h1>Order Management</h1>
          <p>Track and fulfill your ReTrade sales performance.</p>
        </div>
        <form className="seller-orders-search" onSubmit={handleSearch}>
          <span className="material-symbols-outlined">search</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search orders, products, or customers..."
          />
        </form>
      </header>

      <section className="seller-order-stats">
        {stats.map((stat) => (
          <article key={stat.label} className={`seller-order-stat ${stat.dark ? 'dark' : ''}`}>
            <div>
              <span>{stat.label}</span>
              <span className="material-symbols-outlined">{stat.icon}</span>
            </div>
            <strong>{typeof stat.value === 'number' ? String(stat.value).padStart(2, '0') : stat.value}</strong>
            <p className={stat.hot ? 'hot' : ''}>{stat.note}</p>
          </article>
        ))}
      </section>

      <section className="seller-orders-panel">
        <div className="seller-order-tabs">
          <div>
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                className={activeStatus === tab.key ? 'active' : ''}
                onClick={() => {
                  setActiveStatus(tab.key);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="seller-orders-table-wrap">
          <table className="seller-orders-table">
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
                  <td colSpan="6"><div className="seller-orders-empty">Loading orders...</div></td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6"><div className="seller-orders-empty">No seller orders found.</div></td>
                </tr>
              ) : (
                orders.map((order) => {
                  const meta = statusMeta[order.status] || { label: order.status || 'Unknown', className: 'default' };
                  const action = nextAction[order.status];

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
                        <div className="seller-order-product">
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
                      <td><em className={`seller-order-status ${meta.className}`}>{meta.label}</em></td>
                      <td>
                        <div className="seller-order-actions">
                          <button type="button" aria-label="View order" onClick={() => openDetail(order.orderId)}>
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          {action ? (
                            <button
                              type="button"
                              className="primary-action"
                              disabled={updatingId === order.orderId}
                              onClick={() => updateOrderStatus(order, action.status)}
                            >
                              {updatingId === order.orderId ? 'Updating...' : action.label}
                            </button>
                          ) : (
                            <button type="button" className="primary-action muted" onClick={() => openDetail(order.orderId)}>
                              Details
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

        <footer className="seller-orders-footer">
          <span>Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems} orders</span>
          <nav className="seller-orders-pagination" aria-label="Order list pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {paginationItems.map((item, index) => (
              item === 'ellipsis' ? (
                <span key={`${item}-${index}`} className="seller-orders-pagination-ellipsis">...</span>
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

function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

function compactMoney(value) {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value || 0);
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
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
