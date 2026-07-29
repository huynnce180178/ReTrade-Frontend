import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import productService from '../../../services/productService';
import addressService from '../../../services/addressService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';
import { formatDateGmt7 } from '../../../utils/dateTime';
import { createNotificationHubConnection } from '../../../services/notificationRealtimeService';

const numberFormatter = new Intl.NumberFormat('vi-VN');

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

export default function MyProducts() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatus, setSellerStatus] = useState('');
  const [sellerSort, setSellerSort] = useState('newest');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [isAddressPopupOpen, setIsAddressPopupOpen] = useState(false);

  // Detail Modal States
  const [detailModalProduct, setDetailModalProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedModalImg, setSelectedModalImg] = useState('');

  const openDetailModal = async (productSummary) => {
    setDetailModalProduct(productSummary);
    setSelectedModalImg(productSummary.mainImageUrl || '');
    setDetailLoading(true);
    try {
      const fullData = await productService.getById(productSummary.productId);
      if (fullData) {
        setDetailModalProduct(fullData);
        const imagesList = Array.isArray(fullData.imageUrls) ? fullData.imageUrls : (Array.isArray(fullData.images) ? fullData.images.map(i => i.imageUrl || i) : []);
        setSelectedModalImg(fullData.mainImageUrl || imagesList[0] || productSummary.mainImageUrl || '');
      }
    } catch {
      // Keep summary data if getById fails
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchMyProducts = async () => {
    if (!user?.userId) return;
    try {
      setProductsLoading(true);
      const params = { 
        sellerId: user.userId,
        SortBy: sellerSort,
        PageSize: 50
      };
      if (sellerSearch.trim()) params.SearchTerm = sellerSearch.trim();
      if (sellerStatus) params.Status = sellerStatus;

      const res = await productService.getAll(params);
      setMyProducts(res?.items || []);
    } catch (e) {
      showToast(isVi ? 'Không thể tải danh sách sản phẩm.' : 'Failed to load your product list.', 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    const connection = createNotificationHubConnection();

    connection.on('ReceiveNotification', (notification) => {
      if (!disposed) {
        setRefreshTrigger(prev => prev + 1);
      }
    });

    connection.start()
      .then(() => connection.invoke('JoinUserNotifications').catch(() => {}))
      .catch((err) => console.error('SignalR Hub Connection Error:', err));

    return () => {
      disposed = true;
      connection.off('ReceiveNotification');
      connection.stop().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchMyProducts();
    }
  }, [user, sellerStatus, sellerSort, refreshTrigger]);

  const handleSellerSearchSubmit = (e) => {
    e.preventDefault();
    fetchMyProducts();
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm(isVi ? 'Bạn có chắc chắn muốn xóa tin đăng sản phẩm này?' : 'Are you sure you want to delete this product listing?')) return;
    try {
      setProductsLoading(true);
      await productService.delete(productId);
      showToast(isVi ? 'Xóa sản phẩm thành công.' : 'Product deleted successfully.', 'success');
      fetchMyProducts();
    } catch (e) {
      showToast(e?.response?.data || (isVi ? 'Không thể xóa sản phẩm.' : 'Failed to delete product.'), 'error');
    } finally {
      setProductsLoading(false);
    }
  };

  const initNewProductForm = async () => {
    try {
      setProductsLoading(true);
      const data = await addressService.getMyAddresses();
      const addrList = Array.isArray(data) ? data : (data?.data || []);
      if (addrList.length === 0) {
        showToast(isVi ? 'Bạn cần thêm địa chỉ trước khi tạo sản phẩm!' : 'You need to add an address before creating a product!', 'warning');
        setIsAddressPopupOpen(true);
        return;
      }
      navigate('/seller-dashboard/products/new');
    } catch (error) {
      showToast(isVi ? 'Không thể xác thực thông tin địa chỉ giao hàng.' : 'Failed to verify shipping address information.', 'error');
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

  return (
    <>
      {productsLoading && (
        <div className="seller-loader-overlay">
          <span className="btn-spinner"></span>
        </div>
      )}

      <div className="tab-products animate-fade-in">
        <header className="seller-dash-header">
          <div>
            <h1>{isVi ? 'Sản Phẩm Của Tôi' : 'My Products'}</h1>
            <p>{isVi ? 'Xem chi tiết, chỉnh sửa hoặc xóa các sản phẩm bạn đang bán hoặc đấu giá.' : 'View, edit, or delete the products you are selling or auctioning.'}</p>
          </div>
          <button className="seller-list-btn" onClick={initNewProductForm}>
            <span className="material-symbols-outlined">add</span>{isVi ? 'Đăng Sản Phẩm Mới' : 'Add New Product'}
          </button>
        </header>

        <section className="seller-panel">
          <div className="seller-dash-filter-bar" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleSellerSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '250px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder={isVi ? 'Tìm theo tên sản phẩm...' : 'Search by product name...'} 
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 40px 10px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)' }}
              />
              <button type="submit" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined">search</span>
              </button>
            </form>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select 
                value={sellerStatus} 
                onChange={(e) => setSellerStatus(e.target.value)}
                style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                <option value="">{isVi ? 'Tất cả trạng thái' : 'All Statuses'}</option>
                <option value="Pending">{isVi ? 'Chờ phê duyệt' : 'Pending Approval'}</option>
                <option value="Accepted">{isVi ? 'Được duyệt (Bán)' : 'Approved (Sale)'}</option>
                <option value="Waiting">{isVi ? 'Chờ đấu giá' : 'Pending Auction'}</option>
                <option value="Ready">{isVi ? 'Sẵn sàng đấu giá' : 'Ready for Auction'}</option>
                <option value="SaleRejected">{isVi ? 'Từ chối bán' : 'Sale Rejected'}</option>
                <option value="AuctionRejected">{isVi ? 'Từ chối đấu giá' : 'Auction Rejected'}</option>
                <option value="Sold">{isVi ? 'Đã bán' : 'Sold'}</option>
                <option value="Inactive">{isVi ? 'Đã ẩn' : 'Inactive'}</option>
              </select>

              <select 
                value={sellerSort} 
                onChange={(e) => setSellerSort(e.target.value)}
                style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                <option value="newest">{isVi ? 'Mới nhất' : 'Newest First'}</option>
                <option value="oldest">{isVi ? 'Cũ nhất' : 'Oldest First'}</option>
                <option value="price_asc">{isVi ? 'Giá: Thấp đến Cao' : 'Price: Low to High'}</option>
                <option value="price_desc">{isVi ? 'Giá: Cao đến Thấp' : 'Price: High to Low'}</option>
              </select>
            </div>
          </div>

          <div className="seller-products-table-wrap">
            {myProducts.length === 0 ? (
              <div className="seller-empty-products">
                <span className="material-symbols-outlined">inventory</span>
                <h3>{isVi ? 'Không tìm thấy sản phẩm nào' : 'No products found'}</h3>
                <p>{isVi ? 'Thử điều chỉnh bộ lọc hoặc đăng một sản phẩm mới.' : 'Try adjusting your filters or post a new product.'}</p>
                <button className="seller-list-btn" style={{ marginTop: '16px' }} onClick={initNewProductForm}>{isVi ? 'Đăng Ngay' : 'Post Now'}</button>
              </div>
            ) : (
              <table className="seller-products-table">
                <thead>
                  <tr>
                    <th>{isVi ? 'Sản phẩm' : 'Product'}</th>
                    <th>{isVi ? 'Danh mục' : 'Category'}</th>
                    <th>{isVi ? 'Giá' : 'Price'}</th>
                    <th>{isVi ? 'Tồn kho' : 'Stock'}</th>
                    <th>{isVi ? 'Trạng thái' : 'Status'}</th>
                    <th>{isVi ? 'Thao tác' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {myProducts.map((p) => {
                    const status = getStatusText(p.status);
                    const isAuction = p.status === 'Waiting' || p.status === 'Ready' || p.status === 'AuctionRejected';
                    return (
                      <tr key={p.productId} className="seller-product-row-clickable" onClick={() => openDetailModal(p)}>
                        <td>
                          <div className="seller-prod-identity">
                            <img src={p.mainImageUrl || 'https://placehold.co/100'} alt={p.name} />
                            <div>
                              <strong>{p.name}</strong>
                              <small>{p.productId}</small>
                            </div>
                          </div>
                        </td>
                        <td>{p.categoryName}</td>
                        <td>
                          {isAuction ? (
                            <span className="badge-auct">{isVi ? 'Đấu giá' : 'Auction'}</span>
                          ) : (
                            <strong>{p.price ? formatVnd(p.price) : (isVi ? 'Thương lượng' : 'Contact')}</strong>
                          )}
                        </td>
                        <td>{p.stockQuantity}</td>
                        <td>
                          <span className={`seller-status-chip ${status.cls}`}>{status.text}</span>
                        </td>
                        <td>
                          <div className="seller-action-actions">
                            <button
                              type="button"
                              className="seller-icon-action"
                              title={isVi ? 'Xem chi tiết sản phẩm' : 'View Product Details'}
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(p);
                              }}
                            >
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            <button
                              type="button"
                              className="seller-icon-action"
                              title={isVi ? 'Chỉnh sửa' : 'Edit'}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/seller-dashboard/products/edit/${p.productId}`);
                              }}
                            >
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                              type="button"
                              className="seller-icon-action danger"
                              title={isVi ? 'Xóa' : 'Delete'}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(p.productId);
                              }}
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Address Popup for New Product Address Check */}
      {isAddressPopupOpen && (
        <AddressPopup 
          onClose={() => setIsAddressPopupOpen(false)} 
          onSelect={(selectedAddr) => {
            setIsAddressPopupOpen(false);
            showToast(isVi ? 'Đã thêm địa chỉ thành công! Giờ bạn có thể tạo sản phẩm.' : 'Address added successfully! You can now post a product.', 'success');
            navigate('/seller-dashboard/products/new');
          }} 
        />
      )}

      {/* Product Detail Modal */}
      {detailModalProduct && (
        <div className="seller-modal-overlay animate-fade-in" onClick={() => setDetailModalProduct(null)}>
          <div className="seller-modal-card seller-product-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seller-modal-header">
              <div>
                <span className="seller-modal-eyebrow">{isVi ? 'Chi Tiết Sản Phẩm' : 'Product Details'}</span>
                <h2>{detailModalProduct.name}</h2>
                <small>ID: {detailModalProduct.productId}</small>
              </div>
              <button type="button" className="seller-modal-close" onClick={() => setDetailModalProduct(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {detailLoading ? (
              <div className="seller-modal-body" style={{ textAlign: 'center', padding: '40px' }}>
                <span className="btn-spinner"></span>
                <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>{isVi ? 'Đang tải thông tin chi tiết...' : 'Loading product details...'}</p>
              </div>
            ) : (
              <div className="seller-modal-body seller-product-detail-body">
                <div className="seller-detail-gallery">
                  <div className="seller-detail-main-img">
                    <img
                      src={selectedModalImg || detailModalProduct.mainImageUrl || 'https://placehold.co/400'}
                      alt={detailModalProduct.name}
                    />
                  </div>
                  {Array.isArray(detailModalProduct.imageUrls || detailModalProduct.images) &&
                    (detailModalProduct.imageUrls || detailModalProduct.images).length > 0 && (
                      <div className="seller-detail-thumbs">
                        {(detailModalProduct.imageUrls || detailModalProduct.images.map(i => i.imageUrl || i)).map((imgUrl, idx) => (
                          <img
                            key={idx}
                            src={imgUrl}
                            alt=""
                            className={selectedModalImg === imgUrl ? 'active' : ''}
                            onClick={() => setSelectedModalImg(imgUrl)}
                          />
                        ))}
                      </div>
                    )}
                </div>

                <div className="seller-detail-info">
                  <div className="seller-detail-badge-bar">
                    <span className={`seller-status-chip ${getStatusText(detailModalProduct.status).cls}`}>
                      {getStatusText(detailModalProduct.status).text}
                    </span>
                    <span className="seller-detail-format-badge">
                      {detailModalProduct.isForAuction || detailModalProduct.status === 'Ready' || detailModalProduct.status === 'Waiting'
                        ? (isVi ? '🔨 Đấu giá' : '🔨 Auction')
                        : (isVi ? '🏷️ Bán thẳng' : '🏷️ Direct Sale')}
                    </span>
                  </div>

                  <div className="seller-detail-price-box">
                    <span>{isVi ? 'Giá Niêm Yết' : 'Price'}</span>
                    <strong>{detailModalProduct.price ? formatVnd(detailModalProduct.price) : (isVi ? 'Thương lượng' : 'Contact')}</strong>
                  </div>

                  <div className="seller-detail-grid">
                    <div>
                      <span>{isVi ? 'Danh Mục' : 'Category'}</span>
                      <strong>{detailModalProduct.categoryName || (isVi ? 'Chưa phân loại' : 'Uncategorized')}</strong>
                    </div>
                    <div>
                      <span>{isVi ? 'Số Lượng Tồn Kho' : 'Stock Quantity'}</span>
                      <strong>{detailModalProduct.stockQuantity ?? 0}</strong>
                    </div>
                    <div>
                      <span>{isVi ? 'Tình Trạng' : 'Condition'}</span>
                      <strong>{detailModalProduct.condition || (isVi ? 'Khác' : 'N/A')}</strong>
                    </div>
                    <div>
                      <span>{isVi ? 'Ngày Đăng' : 'Date Posted'}</span>
                      <strong>{formatDateGmt7(detailModalProduct.createdAt)}</strong>
                    </div>
                    {(detailModalProduct.weightGram || detailModalProduct.lengthCm) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span>{isVi ? 'Đóng Gói & Trọng Lượng' : 'Package Specs'}</span>
                        <strong>
                          {detailModalProduct.weightGram ? `${detailModalProduct.weightGram}g` : ''} 
                          {detailModalProduct.lengthCm ? ` • ${detailModalProduct.lengthCm}x${detailModalProduct.widthCm}x${detailModalProduct.heightCm} cm` : ''}
                        </strong>
                      </div>
                    )}
                  </div>

                  {detailModalProduct.description && (
                    <div className="seller-detail-description">
                      <h3>{isVi ? 'Mô Tả Sản Phẩm' : 'Description'}</h3>
                      <p>{detailModalProduct.description}</p>
                    </div>
                  )}

                  {Array.isArray(detailModalProduct.attributes) && detailModalProduct.attributes.length > 0 && (
                    <div className="seller-detail-attributes">
                      <h3>{isVi ? 'Thông Số Kỹ Thuật' : 'Specifications'}</h3>
                      <ul>
                        {detailModalProduct.attributes.map((attr, idx) => (
                          <li key={idx}>
                            <span>{attr.attributeName || attr.name}:</span>
                            <strong>{attr.value} {attr.unit || ''}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="seller-modal-footer">
              <a
                href={`/product/${detailModalProduct.productId}`}
                target="_blank"
                rel="noreferrer"
                className="seller-modal-btn outline"
              >
                <span className="material-symbols-outlined">open_in_new</span>
                {isVi ? 'Xem Trang Công Khai' : 'View Public Listing'}
              </a>
              <button
                type="button"
                className="seller-modal-btn primary"
                onClick={() => {
                  const pId = detailModalProduct.productId;
                  setDetailModalProduct(null);
                  navigate(`/seller-dashboard/products/edit/${pId}`);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
                {isVi ? 'Chỉnh Sửa Sản Phẩm' : 'Edit Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
