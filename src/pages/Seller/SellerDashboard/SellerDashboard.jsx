import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import productService from '../../../services/productService';

const numberFormatter = new Intl.NumberFormat('vi-VN');

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

export default function SellerDashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const fetchMyProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const params = { 
        sellerId: user.userId,
        SortBy: 'newest',
        PageSize: 50
      };
      const res = await productService.getAll(params);
      setMyProducts(res?.items || []);
    } catch {
      showToast(t('seller_dashboard.load_error'), 'error');
    } finally {
      setProductsLoading(false);
    }
  }, [user?.userId, showToast, t]);

  useEffect(() => {
    if (user?.userId) {
      fetchMyProducts();
    }
  }, [user?.userId, fetchMyProducts]);

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return { text: t('seller_dashboard.status_pending'), cls: 'status-pending' };
      case 'Accepted': return { text: t('seller_dashboard.status_accepted'), cls: 'status-accepted' };
      case 'SaleRejected': return { text: t('seller_dashboard.status_rejected'), cls: 'status-rejected' };
      case 'Waiting': return { text: t('seller_dashboard.status_waiting'), cls: 'status-waiting' };
      case 'Ready': return { text: t('seller_dashboard.status_ready'), cls: 'status-ready' };
      case 'AuctionRejected': return { text: t('seller_dashboard.status_auction_rejected'), cls: 'status-rejected' };
      case 'Sold': return { text: t('seller_dashboard.status_sold'), cls: 'status-sold' };
      case 'Inactive': return { text: t('seller_dashboard.status_inactive'), cls: 'status-inactive' };
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
    { 
      icon: 'inventory_2', 
      label: t('seller_dashboard.total_listings'), 
      value: productStats.total, 
      note: t('seller_dashboard.total_note') 
    },
    { 
      icon: 'verified', 
      label: t('seller_dashboard.approved'), 
      value: productStats.approved, 
      note: t('seller_dashboard.approved_note') 
    },
    { 
      icon: 'hourglass_top', 
      label: t('seller_dashboard.in_review'), 
      value: productStats.pending, 
      note: t('seller_dashboard.in_review_note') 
    },
    { 
      icon: 'priority_high', 
      label: t('seller_dashboard.low_stock'), 
      value: productStats.lowStock, 
      note: t('seller_dashboard.low_stock_note'), 
      hot: productStats.lowStock > 0 
    },
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
            <span>{t('seller_dashboard.overview_title')}</span>
            <h1>{t('seller_dashboard.welcome_user', { name: user?.firstName || user?.username || t('seller_dashboard.seller') })}</h1>
            <p>{t('seller_dashboard.welcome_sub')}</p>
          </div>
          <div className="seller-overview-actions">
            <button type="button" className="seller-list-btn" onClick={() => navigate('/seller-dashboard/products/new')}>
              <span className="material-symbols-outlined">add</span>{t('seller_dashboard.add_new_product')}
            </button>
            <Link to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">orders</span>{t('seller_dashboard.manage_orders')}
            </Link>
            <Link to="/seller-dashboard/sales-statistics">
              <span className="material-symbols-outlined">monitoring</span>{t('seller_dashboard.sales_stats')}
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
                <h2>{t('seller_dashboard.listing_health')}</h2>
                <p>{t('seller_dashboard.listing_health_sub')}</p>
              </div>
            </div>
            <div className="seller-health-overview">
              <div className="seller-health-score">
                <svg className="health-ring-svg" viewBox="0 0 100 100">
                  <circle className="health-ring-bg" cx="50" cy="50" r="42" />
                  <circle
                    className="health-ring-fill"
                    cx="50"
                    cy="50"
                    r="42"
                    style={{
                      strokeDasharray: 264,
                      strokeDashoffset: 264 - (264 * productStats.approvalRate) / 100
                    }}
                  />
                </svg>
                <div className="health-score-inner">
                  <strong>{productStats.approvalRate}%</strong>
                  <span>{t('seller_dashboard.approval_rate')}</span>
                </div>
              </div>
              <div className="seller-health-lines">
                <div>
                  <span>{t('seller_dashboard.approved_listings')}</span>
                  <b>{productStats.approved}/{productStats.total || 0}</b>
                  <i><em style={{ width: `${productStats.approvalRate}%` }} /></i>
                </div>
                <div>
                  <span>{t('seller_dashboard.auction_ready')}</span>
                  <b>{productStats.auctionReady}</b>
                  <i><em style={{ width: `${Math.min(100, productStats.auctionReady * 20)}%` }} /></i>
                </div>
                <div>
                  <span>{t('seller_dashboard.needs_fix')}</span>
                  <b>{productStats.rejected + productStats.lowStock}</b>
                  <i><em className="warning" style={{ width: `${Math.min(100, (productStats.rejected + productStats.lowStock) * 18)}%` }} /></i>
                </div>
              </div>
            </div>
          </section>

          <section className="seller-panel seller-action-panel">
            <h2>{t('seller_dashboard.today_focus')}</h2>
            <div className="seller-focus-list">
              <button type="button" onClick={() => navigate('/seller-dashboard/products')}>
                <span className="material-symbols-outlined">inventory</span>
                <strong>{t('seller_dashboard.review_product_list')}</strong>
                <small>{t('seller_dashboard.pending_count', { count: productStats.pending })}</small>
              </button>
              <Link to="/seller-dashboard/orders">
                <span className="material-symbols-outlined">local_shipping</span>
                <strong>{t('seller_dashboard.check_fulfillment')}</strong>
                <small>{t('seller_dashboard.confirm_orders_sub')}</small>
              </Link>
              <button type="button" onClick={() => navigate('/seller-dashboard/products/new')}>
                <span className="material-symbols-outlined">add_box</span>
                <strong>{t('seller_dashboard.create_new_listing')}</strong>
                <small>{t('seller_dashboard.add_photos_specs')}</small>
              </button>
            </div>
          </section>
        </div>

        <section className="seller-panel seller-recent-panel">
          <div className="seller-panel-header">
            <div>
              <h2>{t('seller_dashboard.recent_listings')}</h2>
              <p>{t('seller_dashboard.recent_listings_sub')}</p>
            </div>
            <button type="button" onClick={() => navigate('/seller-dashboard/products')}>{t('seller_dashboard.view_all')}</button>
          </div>
          {recentProducts.length === 0 ? (
            <div className="seller-overview-empty">
              <span className="material-symbols-outlined">inventory</span>
              <strong>{t('seller_dashboard.no_listings')}</strong>
              <p>{t('seller_dashboard.no_listings_sub')}</p>
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
                      <span>{product.categoryName || t('common.none')} · {t('seller_dashboard.stock_count', { count: product.stockQuantity ?? 0 })}</span>
                    </div>
                    <em className={`seller-status-chip ${status.cls}`}>{status.text}</em>
                    <b>{product.price ? formatVnd(product.price) : t('seller_dashboard.contact')}</b>
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
