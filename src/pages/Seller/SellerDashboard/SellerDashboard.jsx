import React, { useEffect, useState, useMemo } from 'react';
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
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

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
      showToast(isVi ? 'Không thể tải danh sách sản phẩm.' : 'Failed to load your product list.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return { text: isVi ? 'Chờ phê duyệt' : 'Pending Approval', cls: 'status-pending' };
      case 'Accepted': return { text: isVi ? 'Được duyệt bán' : 'Approved for Sale', cls: 'status-accepted' };
      case 'SaleRejected': return { text: isVi ? 'Bị từ chối bán' : 'Sale Rejected', cls: 'status-rejected' };
      case 'Waiting': return { text: isVi ? 'Chờ đấu giá' : 'Pending Auction', cls: 'status-waiting' };
      case 'Ready': return { text: isVi ? 'Sẵn sàng đấu giá' : 'Ready for Auction', cls: 'status-ready' };
      case 'AuctionRejected': return { text: isVi ? 'Bị từ chối đấu giá' : 'Auction Rejected', cls: 'status-rejected' };
      case 'Sold': return { text: isVi ? 'Đã bán' : 'Sold', cls: 'status-sold' };
      case 'Inactive': return { text: isVi ? 'Đã ẩn' : 'Inactive', cls: 'status-inactive' };
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
      label: isVi ? 'Tổng sản phẩm' : 'Total Listings',
      value: productStats.total,
      note: isVi ? 'Sản phẩm trong gian hàng' : 'Products in your shop'
    },
    {
      icon: 'verified',
      label: isVi ? 'Đã duyệt' : 'Approved',
      value: productStats.approved,
      note: isVi ? 'Sẵn sàng bán' : 'Ready for buyers'
    },
    {
      icon: 'hourglass_top',
      label: isVi ? 'Đang duyệt' : 'In Review',
      value: productStats.pending,
      note: isVi ? 'Chờ kiểm duyệt' : 'Waiting platform action'
    },
    {
      icon: 'priority_high',
      label: isVi ? 'Sắp hết hàng' : 'Low Stock',
      value: productStats.lowStock,
      note: isVi ? 'Cần bổ sung' : 'Needs attention',
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
            <span>{isVi ? 'Tổng Quan Kênh Người Bán' : 'Seller Overview'}</span>
            <h1>{isVi ? `Rất vui được gặp lại, ${user?.firstName || user?.username || 'Người bán'}.` : `Good to see you, ${user?.firstName || user?.username || 'Seller'}.`}</h1>
            <p>{isVi ? 'Quản lý danh sách sản phẩm, chuẩn bị đơn hàng và xử lý nhanh các vấn đề cần lưu ý.' : 'Keep listings healthy, prepare orders, and move quickly on products that need attention.'}</p>
          </div>
          <div className="seller-overview-actions">
            <button type="button" className="seller-list-btn" onClick={() => navigate('/seller-dashboard/products/new')}>
              <span className="material-symbols-outlined">add</span>{isVi ? 'Đăng Sản Phẩm Mới' : 'Add New Product'}
            </button>
            <Link to="/seller-dashboard/orders">
              <span className="material-symbols-outlined">orders</span>{isVi ? 'Quản Lý Đơn Hàng' : 'Manage Orders'}
            </Link>
            <Link to="/seller-dashboard/sales-statistics">
              <span className="material-symbols-outlined">monitoring</span>{isVi ? 'Thống Kê Doanh Số' : 'Sales Statistics'}
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
                <h2>{isVi ? 'Chỉ Số Danh Mục' : 'Listing Health'}</h2>
                <p>{isVi ? 'Theo dõi tỷ lệ phê duyệt, tồn kho và trạng thái đấu giá trong gian hàng.' : 'Track approval, stock, and auction readiness from your current catalog.'}</p>
              </div>
            </div>
            <div className="seller-health-overview">
              <div className="seller-health-score">
                <strong>{productStats.approvalRate}%</strong>
                <span>{isVi ? 'Tỷ lệ phê duyệt' : 'Approval Rate'}</span>
              </div>
              <div className="seller-health-lines">
                <div>
                  <span>{isVi ? 'Sản phẩm được duyệt' : 'Approved listings'}</span>
                  <b>{productStats.approved}/{productStats.total || 0}</b>
                  <i><em style={{ width: `${productStats.approvalRate}%` }} /></i>
                </div>
                <div>
                  <span>{isVi ? 'Sẵn sàng đấu giá' : 'Auction ready'}</span>
                  <b>{productStats.auctionReady}</b>
                  <i><em style={{ width: `${Math.min(100, productStats.auctionReady * 20)}%` }} /></i>
                </div>
                <div>
                  <span>{isVi ? 'Cần chỉnh sửa / Nhập thêm' : 'Needs fix'}</span>
                  <b>{productStats.rejected + productStats.lowStock}</b>
                  <i><em className="warning" style={{ width: `${Math.min(100, (productStats.rejected + productStats.lowStock) * 18)}%` }} /></i>
                </div>
              </div>
            </div>
          </section>

          <section className="seller-panel seller-action-panel">
            <h2>{isVi ? 'Nhiệm Vụ Hôm Nay' : 'Today Focus'}</h2>
            <div className="seller-focus-list">
              <button type="button" onClick={() => navigate('/seller-dashboard/products')}>
                <span className="material-symbols-outlined">inventory</span>
                <strong>{isVi ? 'Kiểm tra danh sách sản phẩm' : 'Review product list'}</strong>
                <small>{productStats.pending} {isVi ? 'sản phẩm chờ duyệt' : 'listing waiting for approval'}</small>
              </button>
              <Link to="/seller-dashboard/orders">
                <span className="material-symbols-outlined">local_shipping</span>
                <strong>{isVi ? 'Kiểm tra xử lý đơn hàng' : 'Check fulfillment'}</strong>
                <small>{isVi ? 'Xác nhận và giao đơn hàng của người mua' : 'Confirm and ship buyer orders'}</small>
              </Link>
              <button type="button" onClick={() => navigate('/seller-dashboard/products/new')}>
                <span className="material-symbols-outlined">add_box</span>
                <strong>{isVi ? 'Đăng sản phẩm mới' : 'Create new listing'}</strong>
                <small>{isVi ? 'Thêm hình ảnh, thông số và tồn kho' : 'Add photos, specs, and stock'}</small>
              </button>
            </div>
          </section>
        </div>

        <section className="seller-panel seller-recent-panel">
          <div className="seller-panel-header">
            <div>
              <h2>{isVi ? 'Sản Phẩm Mới Đăng' : 'Recent Listings'}</h2>
              <p>{isVi ? 'Các sản phẩm mới nhất trong gian hàng của bạn.' : 'Newest products from your shop catalog.'}</p>
            </div>
            <button type="button" onClick={() => navigate('/seller-dashboard/products')}>{isVi ? 'Xem Tất Cả' : 'View All'}</button>
          </div>
          {recentProducts.length === 0 ? (
            <div className="seller-overview-empty">
              <span className="material-symbols-outlined">inventory</span>
              <strong>{isVi ? 'Chưa có sản phẩm nào' : 'No listings yet'}</strong>
              <p>{isVi ? 'Bắt đầu bằng việc đăng sản phẩm đầu tiên của bạn.' : 'Start by creating your first product listing.'}</p>
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
                      <span>{product.categoryName || (isVi ? 'Chưa phân loại' : 'Uncategorized')} · {isVi ? 'Tồn kho' : 'Stock'} {product.stockQuantity ?? 0}</span>
                    </div>
                    <em className={`seller-status-chip ${status.cls}`}>{status.text}</em>
                    <b>{product.price ? formatVnd(product.price) : (isVi ? 'Thương lượng' : 'Contact')}</b>
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
