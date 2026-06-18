import React, { useEffect, useState, useMemo } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';

const numberFormatter = new Intl.NumberFormat('vi-VN');

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

export default function SellerDashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    if (user?.userId) {
      fetchMyProducts();
    }
  }, [user]);

  const fetchMyProducts = async () => {
    try {
      setProductsLoading(true);
      const params = { 
        sellerId: user.userId,
        SortBy: 'newest',
        PageSize: 50
      };
      const res = await productService.getAll(params);
      setMyProducts(res?.items || []);
    } catch (e) {
      showToast('Failed to load your product list.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return { text: 'Pending Approval', cls: 'status-pending' };
      case 'Accepted': return { text: 'Approved for Sale', cls: 'status-accepted' };
      case 'SaleRejected': return { text: 'Sale Rejected', cls: 'status-rejected' };
      case 'Waiting': return { text: 'Pending Auction', cls: 'status-waiting' };
      case 'Ready': return { text: 'Ready for Auction', cls: 'status-ready' };
      case 'AuctionRejected': return { text: 'Auction Rejected', cls: 'status-rejected' };
      case 'Sold': return { text: 'Sold', cls: 'status-sold' };
      case 'Inactive': return { text: 'Inactive', cls: 'status-inactive' };
      default: return { text: status, cls: 'status-unknown' };
    }
  };

  const productStats = useMemo(() => {
    const total = myProducts.length;
    const approved = myProducts.filter((product) => product.status === 'Accepted').length;
    const pending = myProducts.filter((product) => product.status === 'Pending' || product.status === 'Waiting').length;
    const auctionReady = myProducts.filter((product) => product.status === 'Ready').length;
    const sold = myProducts.filter((product) => product.status === 'Sold').length;
    const rejected = myProducts.filter((product) => product.status === 'SaleRejected' || product.status === 'AuctionRejected').length;
    const lowStock = myProducts.filter((product) => Number(product.stockQuantity || 0) <= 2 && product.status !== 'Sold').length;

    return {
      total,
      approved,
      pending,
      auctionReady,
      sold,
      rejected,
      lowStock,
      approvalRate: total ? Math.round((approved / total) * 100) : 0,
    };
  }, [myProducts]);

  const overviewMetrics = [
    { icon: 'inventory_2', label: 'Total Listings', value: productStats.total, note: 'Products in your shop' },
    { icon: 'verified', label: 'Approved', value: productStats.approved, note: 'Ready for buyers' },
    { icon: 'hourglass_top', label: 'In Review', value: productStats.pending, note: 'Waiting platform action' },
    { icon: 'priority_high', label: 'Low Stock', value: productStats.lowStock, note: 'Needs attention', hot: productStats.lowStock > 0 },
  ];

  const recentProducts = myProducts.slice(0, 4);

  return (
    <>
      {productsLoading && (
        <div className="seller-loader-overlay">
          <span className="btn-spinner"></span>
        </div>
      )}

      <div className="tab-dashboard animate-fade-in">
        <header className="seller-overview-hero">
          <div className="seller-overview-copy">
            <span>Seller Overview</span>
            <h1>Good to see you, {user?.firstName || user?.username || 'Seller'}.</h1>
            <p>Keep listings healthy, prepare orders, and move quickly on products that need attention.</p>
          </div>
          <div className="seller-overview-actions">
            <button type="button" className="seller-list-btn" onClick={() => navigate('/seller-dashboard/products/new')}>
              <span className="material-symbols-outlined">add</span>Add New Product
            </button>
            <Link to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">orders</span>Manage Orders
            </Link>
            <Link to="/seller-dashboard/sales-statistics">
              <span className="material-symbols-outlined">monitoring</span>Sales Statistics
            </Link>
          </div>
        </header>

        <section className="seller-metric-grid">
          {overviewMetrics.map((metric) => (
            <article key={metric.label} className={`seller-metric-card ${metric.hot ? 'attention' : ''}`}>
              <div className="seller-metric-top">
                <span className="material-symbols-outlined">{metric.icon}</span>
                <em>{metric.note}</em>
              </div>
              <p>{metric.label}</p>
              <strong>{String(metric.value).padStart(2, '0')}</strong>
            </article>
          ))}
        </section>

        <div className="seller-overview-grid">
          <section className="seller-panel seller-health-panel">
            <div className="seller-panel-header">
              <div>
                <h2>Listing Health</h2>
                <p>Track approval, stock, and auction readiness from your current catalog.</p>
              </div>
            </div>
            <div className="seller-health-overview">
              <div className="seller-health-score">
                <strong>{productStats.approvalRate}%</strong>
                <span>Approval Rate</span>
              </div>
              <div className="seller-health-lines">
                <div>
                  <span>Approved listings</span>
                  <b>{productStats.approved}/{productStats.total || 0}</b>
                  <i><em style={{ width: `${productStats.approvalRate}%` }} /></i>
                </div>
                <div>
                  <span>Auction ready</span>
                  <b>{productStats.auctionReady}</b>
                  <i><em style={{ width: `${Math.min(100, productStats.auctionReady * 20)}%` }} /></i>
                </div>
                <div>
                  <span>Needs fix</span>
                  <b>{productStats.rejected + productStats.lowStock}</b>
                  <i><em className="warning" style={{ width: `${Math.min(100, (productStats.rejected + productStats.lowStock) * 18)}%` }} /></i>
                </div>
              </div>
            </div>
          </section>

          <section className="seller-panel seller-action-panel">
            <h2>Today Focus</h2>
            <div className="seller-focus-list">
              <button type="button" onClick={() => navigate('/seller-dashboard/products')}>
                <span className="material-symbols-outlined">inventory</span>
                <strong>Review product list</strong>
                <small>{productStats.pending} listing waiting for approval</small>
              </button>
              <Link to="/seller-dashboard/orders">
                <span className="material-symbols-outlined">local_shipping</span>
                <strong>Check fulfillment</strong>
                <small>Confirm and ship buyer orders</small>
              </Link>
              <button type="button" onClick={() => navigate('/seller-dashboard/products/new')}>
                <span className="material-symbols-outlined">add_box</span>
                <strong>Create new listing</strong>
                <small>Add photos, specs, and stock</small>
              </button>
            </div>
          </section>
        </div>

        <section className="seller-panel seller-recent-panel">
          <div className="seller-panel-header">
            <div>
              <h2>Recent Listings</h2>
              <p>Newest products from your shop catalog.</p>
            </div>
            <button type="button" onClick={() => navigate('/seller-dashboard/products')}>View All</button>
          </div>
          {recentProducts.length === 0 ? (
            <div className="seller-overview-empty">
              <span className="material-symbols-outlined">inventory</span>
              <strong>No listings yet</strong>
              <p>Start by creating your first product listing.</p>
            </div>
          ) : (
            <div className="seller-recent-list">
              {recentProducts.map((product) => {
                const status = getStatusText(product.status);

                return (
                  <article key={product.productId}>
                    <img src={product.mainImageUrl || 'https://placehold.co/100'} alt={product.name} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.categoryName || 'Uncategorized'} · Stock {product.stockQuantity ?? 0}</span>
                    </div>
                    <em className={`seller-status-chip ${status.cls}`}>{status.text}</em>
                    <b>{product.price ? formatVnd(product.price) : 'Contact'}</b>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
