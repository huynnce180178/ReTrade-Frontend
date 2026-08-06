import { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import productService from '../../../services/productService';
import addressService from '../../../services/addressService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';
import SellerPagination from '../../../components/SellerPagination/SellerPagination';
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
  const { t } = useLanguage();

  const [myProducts, setMyProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatus, setSellerStatus] = useState('');
  const [sellerSort, setSellerSort] = useState('newest');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 5;

  // Detail Modal States
  const [detailModalProduct, setDetailModalProduct] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedModalImg, setSelectedModalImg] = useState('');

  // Delete Modal States
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDetailModal = async (productSummary) => {
    setDetailModalProduct(productSummary);
    setSelectedModalImg(productSummary.mainImageUrl || '');
    try {
      setDetailLoading(true);
      const fullDetail = await productService.getById(productSummary.productId);
      if (fullDetail) {
        setDetailModalProduct(fullDetail);
        if (fullDetail.mainImageUrl) {
          setSelectedModalImg(fullDetail.mainImageUrl);
        }
      }
    } catch {
      // Keep summary data if getById fails
    } finally {
      setDetailLoading(false);
    }
  };

  const [isAddressPopupOpen, setIsAddressPopupOpen] = useState(false);

  const fetchMyProducts = useCallback(async (page = currentPage) => {
    const sellerId = user?.userId || user?.id || user?.accountId;
    if (!sellerId) return;
    try {
      setProductsLoading(true);
      const params = {
        sellerId: sellerId,
        SortBy: sellerSort,
        PageSize: PAGE_SIZE,
        Page: page,
      };
      if (sellerSearch.trim()) params.SearchTerm = sellerSearch.trim();
      if (sellerStatus) params.Status = sellerStatus;

      const res = await productService.getAll(params);
      setMyProducts(res?.items || []);
      setTotalCount(res?.totalCount ?? res?.totalItems ?? 0);
      const pages = res?.totalPages ?? (res?.totalCount ? Math.ceil(res.totalCount / PAGE_SIZE) : 1);
      setTotalPages(Math.max(1, pages));
    } catch {
      showToast(t('my_products.fetch_error'), 'error');
    } finally {
      setProductsLoading(false);
    }
  }, [user, sellerSort, sellerSearch, sellerStatus, currentPage, showToast, t]);

  useEffect(() => {
    let disposed = false;
    const connection = createNotificationHubConnection();

    connection.on('ReceiveNotification', () => {
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
  }, [user, sellerStatus, sellerSort, refreshTrigger, fetchMyProducts]);

  const handleSellerSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMyProducts(1);
  };

  const handleStatusChange = (e) => {
    setSellerStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e) => {
    setSellerSort(e.target.value);
    setCurrentPage(1);
  };

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchMyProducts(page);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await productService.delete(productToDelete.productId);
      showToast(t('my_products.delete_success'), 'success');
      setProductToDelete(null);
      fetchMyProducts();
    } catch (e) {
      showToast(e?.response?.data || t('my_products.delete_error'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const initNewProductForm = async () => {
    try {
      setProductsLoading(true);
      const addresses = await addressService.getAddresses();
      if (!addresses || addresses.length === 0) {
        setIsAddressPopupOpen(true);
      } else {
        navigate('/seller-dashboard/products/new');
      }
    } catch {
      setIsAddressPopupOpen(true);
    } finally {
      setProductsLoading(false);
    }
  };

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
      case 'Deleted': return { text: t('my_products.tab_deleted'), cls: 'status-rejected' };
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
            <h1>{t('my_products.title')}</h1>
            <p>{t('my_products.subtitle')}</p>
          </div>
          <button className="seller-list-btn" onClick={initNewProductForm}>
            <span className="material-symbols-outlined">add</span>{t('my_products.add_product_btn')}
          </button>
        </header>

        <section className="seller-panel">
          <div className="seller-dash-filter-bar" style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleSellerSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '250px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder={t('my_products.search_placeholder')} 
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
                onChange={handleStatusChange}
                style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                <option value="">{t('common.all')}</option>
                <option value="Pending">{t('seller_dashboard.status_pending')}</option>
                <option value="Accepted">{t('seller_dashboard.status_accepted')}</option>
                <option value="Waiting">{t('seller_dashboard.status_waiting')}</option>
                <option value="Ready">{t('seller_dashboard.status_ready')}</option>
                <option value="SaleRejected">{t('seller_dashboard.status_rejected')}</option>
                <option value="AuctionRejected">{t('seller_dashboard.status_auction_rejected')}</option>
                <option value="Sold">{t('seller_dashboard.status_sold')}</option>
                <option value="Deleted">{t('my_products.tab_deleted')}</option>
              </select>

              <select 
                value={sellerSort} 
                onChange={handleSortChange}
                style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                <option value="newest">{t('product.sort_newest')}</option>
                <option value="price_asc">{t('product.sort_price_asc')}</option>
                <option value="price_desc">{t('product.sort_price_desc')}</option>
              </select>
            </div>
          </div>

          <div className="seller-products-table-wrap">
            {myProducts.length === 0 ? (
              <div className="seller-empty-products">
                <span className="material-symbols-outlined">inventory</span>
                <h3>{t('common.no_data')}</h3>
                <p>{t('my_products.subtitle')}</p>
                <button className="seller-list-btn" style={{ marginTop: '16px' }} onClick={initNewProductForm}>{t('my_products.add_product_btn')}</button>
              </div>
            ) : (
              <table className="seller-products-table">
                <thead>
                  <tr>
                    <th>{t('my_products.th_product')}</th>
                    <th>{t('my_products.th_category')}</th>
                    <th>{t('my_products.th_price')}</th>
                    <th>{t('my_products.th_stock')}</th>
                    <th>{t('my_products.th_status')}</th>
                    <th>{t('my_products.th_action')}</th>
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
                            <span className="badge-auct">{t('nav.auction')}</span>
                          ) : (
                            <strong>{p.price ? formatVnd(p.price) : t('seller_dashboard.contact')}</strong>
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
                              title={t('common.view_detail')}
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
                              title={t('common.edit')}
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
                              title={t('common.delete')}
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductToDelete(p);
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

          <SellerPagination
            page={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={totalCount}
            disabled={productsLoading}
            onPageChange={goToPage}
          />
        </section>
      </div>

      {/* Address Popup for New Product Address Check */}
      {isAddressPopupOpen && (
        <AddressPopup 
          onClose={() => setIsAddressPopupOpen(false)} 
          onSelect={() => {
            setIsAddressPopupOpen(false);
            showToast(t('address.add_success'), 'success');
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
                <span className="seller-modal-eyebrow">{t('common.detail')}</span>
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
                <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>{t('common.loading')}</p>
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
                        ? `🔨 ${t('nav.auction')}`
                        : `🏷️ ${t('home.fast_deal')}`}
                    </span>
                  </div>

                  <div className="seller-detail-price-box">
                    <span>{t('common.price')}</span>
                    <strong>{detailModalProduct.price ? formatVnd(detailModalProduct.price) : t('seller_dashboard.contact')}</strong>
                  </div>

                  <div className="seller-detail-grid">
                    <div>
                      <span>{t('common.category')}</span>
                      <strong>{detailModalProduct.categoryName || t('common.none')}</strong>
                    </div>
                    <div>
                      <span>{t('common.quantity')}</span>
                      <strong>{detailModalProduct.stockQuantity ?? 0}</strong>
                    </div>
                    <div>
                      <span>{t('product.condition')}</span>
                      <strong>{detailModalProduct.condition || t('common.none')}</strong>
                    </div>
                    <div>
                      <span>{t('common.created_at')}</span>
                      <strong>{formatDateGmt7(detailModalProduct.createdAt)}</strong>
                    </div>
                    {(detailModalProduct.weightGram || detailModalProduct.lengthCm) && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span>{t('common.description')}</span>
                        <strong>
                          {detailModalProduct.weightGram ? `${detailModalProduct.weightGram}g` : ''} 
                          {detailModalProduct.lengthCm ? ` • ${detailModalProduct.lengthCm}x${detailModalProduct.widthCm}x${detailModalProduct.heightCm} cm` : ''}
                        </strong>
                      </div>
                    )}
                  </div>

                  {detailModalProduct.description && (
                    <div className="seller-detail-description">
                      <h3>{t('common.description')}</h3>
                      <p>{detailModalProduct.description}</p>
                    </div>
                  )}

                  {Array.isArray(detailModalProduct.attributes) && detailModalProduct.attributes.length > 0 && (
                    <div className="seller-detail-attributes">
                      <h3>{t('product.specifications')}</h3>
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
                {t('common.view_detail')}
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
                {t('seller.edit_product')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="seller-modal-overlay animate-fade-in" onClick={() => !isDeleting && setProductToDelete(null)}>
          <div className="seller-modal-card seller-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="seller-modal-header" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="seller-confirm-icon danger">
                  <span className="material-symbols-outlined">warning</span>
                </div>
                <div>
                  <span className="seller-modal-eyebrow danger-text">{t('my_products.confirm_delete_title')}</span>
                  <h2 style={{ fontSize: '18px', margin: 0 }}>{t('common.confirm', 'Xác nhận')}</h2>
                </div>
              </div>
              <button
                type="button"
                className="seller-modal-close"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="seller-modal-body" style={{ padding: '24px' }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#2c322e' }}>
                {t('my_products.confirm_delete_msg', { name: productToDelete.name || productToDelete.productId })}
              </p>
            </div>

            <div className="seller-confirm-footer">
              <button
                type="button"
                className="seller-confirm-btn-cancel"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
              >
                {t('common.cancel', 'Hủy')}
              </button>
              <button
                type="button"
                className="seller-confirm-btn-delete"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting && <span className="btn-spinner"></span>}
                {t('common.delete', 'Xóa')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
