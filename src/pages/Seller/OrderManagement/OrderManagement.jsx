import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const tabs = [
  { key: '', label: 'All Orders' },
  { key: 'Pending', label: 'To Confirm' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'Shipping', label: 'Shipping' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Returned', label: 'Returned' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const statusMeta = {
  Pending: { label: 'Pending', className: 'pending' },
  Confirmed: { label: 'Confirmed', className: 'confirmed' },
  Shipping: { label: 'Shipping', className: 'shipping' },
  Delivered: { label: 'Delivered', className: 'delivered' },
  Returned: { label: 'Returned', className: 'returned' },
  Cancelled: { label: 'Cancelled', className: 'cancelled' },
};

export default function OrderManagement() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
    fetchOrders();
  }, [fetchOrders]);

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const firstVisibleItem = orders.length ? (page - 1) * pageSize + 1 : 0;
  const lastVisibleItem = orders.length ? firstVisibleItem + orders.length - 1 : 0;

  const stats = useMemo(() => {
    const awaiting = orders.filter((order) => order.status === 'Pending').length;
    const confirmed = orders.filter((order) => order.status === 'Confirmed').length;
    const delivered = orders.filter((order) => order.status === 'Delivered').length;
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.finalAmount || 0), 0);

    return [
      { label: 'Total Orders', icon: 'shopping_cart', value: String(totalItems).padStart(2, '0'), note: '+12%' },
      { label: 'Awaiting Confirmation', icon: 'inventory', value: String(awaiting).padStart(2, '0'), note: 'Require attention', hot: true },
      { label: 'Confirmed Orders', icon: 'fact_check', value: String(confirmed).padStart(2, '0'), note: 'Ready to ship' },
      { label: 'Delivered Sales', icon: 'check_circle', value: String(delivered).padStart(2, '0'), note: 'Success' },
      { label: 'Total Revenue', icon: 'payments', value: compactMoney(totalRevenue), note: 'VND', dark: true },
    ];
  }, [orders, totalItems]);

  const handleSearch = (event) => {
    event.preventDefault();
    setAppliedSearchTerm(searchTerm.trim());
    setPage(1);
  };

  const openDetail = (orderId) => navigate(`/seller-dashboard/orders/${orderId}`);

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
            <strong>{stat.value}</strong>
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
          <button type="button" className="advanced-filter-btn">
            <span className="material-symbols-outlined">filter_list</span>
            Advanced Filters
          </button>
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
                  <td colSpan="6">
                    <div className="seller-orders-empty">Loading orders...</div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="seller-orders-empty">No seller orders found.</div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const meta = statusMeta[order.status] || { label: order.status || 'Unknown', className: 'default' };
                  return (
                    <tr key={order.orderId}>
                      <td>
                        <strong>#{order.orderCode || order.orderId}</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </td>
                      <td>
                        <strong>{order.buyerName || 'Unknown Buyer'}</strong>
                        <span>{order.buyerId}</span>
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
                      <td>
                        <em className={`seller-order-status ${meta.className}`}>{meta.label}</em>
                      </td>
                      <td>
                        <div className="seller-order-actions">
                          <button type="button" onClick={() => openDetail(order.orderId)}>
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          <button type="button" className="primary-action" onClick={() => openDetail(order.orderId)}>
                            View Details
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

        <footer className="seller-orders-footer">
          <span>
            Showing {firstVisibleItem}-{lastVisibleItem} of {totalItems} orders
          </span>
          <nav className="seller-orders-pagination" aria-label="Order list pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous page">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {paginationItems.map((item, index) => (
              item === 'ellipsis' ? (
                <span key={`${item}-${index}`} className="seller-orders-pagination-ellipsis">
                  ...
                </span>
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
