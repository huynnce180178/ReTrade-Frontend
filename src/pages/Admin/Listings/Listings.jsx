import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatDateTimeGmt7 } from '../../../utils/dateTime';
import { createNotificationHubConnection } from '../../../services/notificationRealtimeService';
import './Listings.css';

export default function Listings() {
  const { showToast } = useToast();
  const { t, formatCurrency } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 5;
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal Detail states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  // Approval action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const rejectReasonRef = useRef(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: '', // 'approve' | 'reject'
    product: null,
    reason: ''
  });

  useEffect(() => {
    if (showRejectInput && rejectReasonRef.current) {
      rejectReasonRef.current.focus();
    }
  }, [showRejectInput]);

  useEffect(() => {
    fetchCategories();
  }, []);

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
    fetchProducts();
  }, [statusFilter, categoryFilter, searchTerm, page, refreshTrigger]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const filterParts = [];
      if (statusFilter === 'Pending') {
        filterParts.push("(Status eq 'Pending' or Status eq 'Waiting')");
      } else if (statusFilter === 'Approved') {
        filterParts.push("(Status eq 'Accepted' or Status eq 'Ready')");
      } else if (statusFilter === 'Rejected') {
        filterParts.push("(Status eq 'SaleRejected' or Status eq 'AuctionRejected')");
      } else if (statusFilter === 'Sold') {
        filterParts.push("Status eq 'Sold'");
      } else if (statusFilter === 'Inactive') {
        filterParts.push("Status eq 'Inactive'");
      }

      if (categoryFilter !== 'All') {
        filterParts.push(`CategoryName eq '${categoryFilter}'`);
      }

      if (searchTerm.trim() !== '') {
        const term = searchTerm.trim().toLowerCase().replace(/'/g, "''");
        filterParts.push(`(contains(tolower(Name), '${term}') or contains(tolower(SellerName), '${term}'))`);
      }

      const params = {};
      if (filterParts.length > 0) {
        params['$filter'] = filterParts.join(' and ');
      }

      params['$orderby'] = 'CreatedAt desc';
      params['$top'] = pageSize;
      params['$skip'] = (page - 1) * pageSize;
      params['$count'] = 'true';

      const res = await productService.getForApproval(params);
      const items = Array.isArray(res) ? res : (res?.value || res?.items || []);
      setProducts(items);
      
      if (res && res['@odata.count']) {
        setTotalItems(parseInt(res['@odata.count'], 10));
      } else if (res && res.totalCount !== undefined) {
        setTotalItems(res.totalCount);
      } else {
        setTotalItems(items.length);
      }
    } catch (error) {
      const msg = typeof error?.response?.data === 'string' ? error.response.data : error?.message || t('common.load_error');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await categoryService.getAll();
      setCategories(Array.isArray(res) ? res : (res?.value || []));
    } catch (e) {
    }
  };

  const openProductDetail = async (product) => {
    try {
      const fullDetail = await productService.getAdminProductById(product.productId);
      setSelectedProduct(fullDetail);
      setActiveImage(fullDetail?.images?.find(i => i.isMain)?.imageUrl || fullDetail?.images?.[0]?.imageUrl || null);
      setShowDetailModal(true);
      setShowRejectInput(false);
      setRejectReason('');
    } catch (e) {
      showToast(t('common.load_error'), 'error');
    }
  };

  const closeDetailModal = () => {
    if (actionLoading) return;
    setShowDetailModal(false);
    setSelectedProduct(null);
    setActiveImage(null);
    setShowRejectInput(false);
    setRejectReason('');
  };

  const promptApprove = (product) => {
    if (!product) return;
    const category = categories.find(c => 
      (product.categoryId && c.categoryId === product.categoryId) || 
      (product.categoryName && c.name === product.categoryName)
    );
    const isCategoryActive = category?.status === 'Active';
    if (!isCategoryActive) {
      showToast(t('admin.listings.category_inactive_error'), 'error');
      return;
    }

    setConfirmModal({
      open: true,
      action: 'approve',
      product,
      reason: ''
    });
  };

  const promptReject = (product) => {
    if (!product) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (!rejectReason.trim()) {
      showToast(t('admin.listings.reject_reason_required'), 'warning');
      if (rejectReasonRef.current) {
        rejectReasonRef.current.focus();
      }
      return;
    }

    setConfirmModal({
      open: true,
      action: 'reject',
      product,
      reason: rejectReason.trim()
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmModal.product) return;
    const { action, product, reason } = confirmModal;

    try {
      setActionLoading(true);
      if (action === 'approve') {
        showToast(t('admin.listings.approve_confirm_msg'), 'info');
        await productService.approve(product.productId, true, null);
        showToast(t('admin.listings.approve_success_msg'), 'success');
      } else {
        showToast(t('admin.listings.reject_confirm_msg'), 'info');
        await productService.approve(product.productId, false, reason);
        showToast(t('admin.listings.reject_success_msg'), 'success');
      }
      setConfirmModal({ open: false, action: '', product: null, reason: '' });
      closeDetailModal();
      await fetchProducts();
    } catch (error) {
      showToast(error?.response?.data || error?.message || t('common.save_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickRejectClick = (product) => {
    setSelectedProduct(product);
    setShowRejectInput(true);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span className="badge badge-pending">{t('seller_dashboard.status_pending')}</span>;
      case 'Accepted':
        return <span className="badge badge-approved">{t('seller_dashboard.status_accepted')}</span>;
      case 'SaleRejected':
        return <span className="badge badge-rejected">{t('seller_dashboard.status_rejected')}</span>;
      case 'Waiting':
        return <span className="badge badge-pending-auction">{t('seller_dashboard.status_waiting')}</span>;
      case 'Ready':
        return <span className="badge badge-approved-auction">{t('seller_dashboard.status_ready')}</span>;
      case 'AuctionRejected':
        return <span className="badge badge-rejected">{t('seller_dashboard.status_auction_rejected')}</span>;
      case 'Sold':
        return <span className="badge badge-sold">{t('seller_dashboard.status_sold')}</span>;
      case 'Inactive':
        return <span className="badge badge-inactive">{t('seller_dashboard.status_inactive')}</span>;
      default:
        return <span className="badge badge-unknown">{status}</span>;
    }
  };

  const getConditionLabel = (condition) => {
    if (!condition) return t('common.na');

    const conditionKeyMap = {
      New: 'admin.listings.condition_new',
      LikeNew: 'admin.listings.condition_like_new',
      Excellent: 'admin.listings.condition_excellent',
      Good: 'admin.listings.condition_good',
      Fair: 'admin.listings.condition_fair',
      Used: 'admin.listings.condition_used',
      Damaged: 'admin.listings.condition_damaged',
      ForParts: 'admin.listings.condition_for_parts'
    };

    const key = conditionKeyMap[condition];
    return key ? t(key) : condition;
  };

  const isCategoryApproved = selectedProduct 
    ? categories.find(c => c.categoryId === selectedProduct.categoryId)?.status === 'Active'
    : true;

  return (
    <div className="admin-listings-page animate-fade-in">
      <section className="admin-listings-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.listings.hero_title')}</h1>
          <p className="admin-hero-copy">
            {t('admin.listings.hero_sub')}
          </p>
        </div>
      </section>

      <section className="admin-listings-panel">
        <header className="admin-panel-header">
          <div>
            <h2>{t('admin.listings.list_title')}</h2>
            <p>{t('admin.listings.list_sub')}</p>
          </div>

          <div className="admin-panel-actions">
            <div className="admin-search-row">
              <label className="admin-search-box">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  placeholder={t('admin.listings.search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </label>

              <label className="admin-select-box">
                <span className="material-symbols-outlined">filter_alt</span>
                <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                  <option value="All">{t('admin.listings.all_categories')}</option>
                  {categories.map((c) => (
                    <option key={c.categoryId} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="admin-pill-group">
              <button
                className={`admin-pill ${statusFilter === 'All' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('All'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_all')}
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Pending' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('Pending'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_pending')}
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Approved' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('Approved'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_approved')}
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Rejected' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('Rejected'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_rejected')}
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Sold' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('Sold'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_sold')}
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Inactive' ? 'active' : ''}`}
                onClick={() => { setStatusFilter('Inactive'); setPage(1); }}
                type="button"
              >
                {t('admin.listings.tab_inactive')}
              </button>
            </div>
          </div>
        </header>

        <div className="admin-listings-table-wrap">
          {loading ? (
            <div className="admin-empty-state">
              <span className="btn-spinner"></span>
              <p>{t('common.loading')}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="admin-empty-state">
              <span className="material-symbols-outlined">verified</span>
              <h3>{t('admin.listings.no_products')}</h3>
              <p>{t('admin.listings.no_products_sub')}</p>
            </div>
          ) : (
            <table className="admin-listings-table">
              <thead>
                <tr>
                  <th>{t('admin.listings.col_stt')}</th>
                  <th>{t('admin.listings.col_product')}</th>
                  <th>{t('admin.listings.col_category')}</th>
                  <th>{t('admin.listings.col_price_type')}</th>
                  <th>{t('admin.users.col_status')}</th>
                  <th>{t('admin.listings.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, index) => {
                  const isAuction = p.status === 'Waiting' || p.status === 'Ready' || p.status === 'AuctionRejected';
                  return (
                    <tr key={p.productId} className="clickable-row" onClick={() => openProductDetail(p)}>
                      <td>{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <div className="admin-listing-identity">
                          <div className="admin-listing-thumbnail">
                            {p.mainImageUrl ? (
                              <img src={p.mainImageUrl} alt={p.name} />
                            ) : (
                              <span className="material-symbols-outlined">image</span>
                            )}
                          </div>
                          <div>
                            <strong>{p.name}</strong>
                            <span className="admin-subtle-id">{p.productId}</span>
                          </div>
                        </div>
                      </td>
                      <td>{p.categoryName}</td>
                      <td>
                        {isAuction && p.status === 'Waiting' ? (
                          <span className="badge badge-auction">Auction</span>
                        ) : (
                          <strong>{p.price ? formatCurrency(p.price) : t('seller_dashboard.contact')}</strong>
                        )}
                      </td>
                      <td>{getStatusBadge(p.status)}</td>
                      <td>
                        {(p.status === 'Pending' || p.status === 'Waiting') ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="admin-action-btn success"
                              onClick={(e) => {
                                e.stopPropagation();
                                promptApprove(p);
                              }}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              {t('admin.approve')}
                            </button>
                            <button
                              type="button"
                              className="admin-action-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickRejectClick(p);
                              }}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              {t('admin.reject')}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#888' }}>{t('admin.listings.processed')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {products.length > 0 && totalItems > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '30px', paddingBottom: '30px' }}>
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                style={{ 
                  width: '36px', height: '36px', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', 
                  backgroundColor: 'white', border: '1px solid #eaeaea', 
                  borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#ccc' : '#333'
                }}
              >
                &lt;
              </button>
              
              {Array.from({ length: Math.ceil(totalItems / pageSize) || 1 }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => setPage(num)}
                  style={{
                    width: '36px', height: '36px', 
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    backgroundColor: page === num ? '#0a2a1f' : 'white',
                    color: page === num ? 'white' : '#333',
                    border: page === num ? 'none' : '1px solid #eaeaea',
                    borderRadius: '6px',
                    fontWeight: page === num ? '600' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  {num}
                </button>
              ))}

              <button 
                disabled={page >= Math.ceil(totalItems / pageSize)} 
                onClick={() => setPage(p => p + 1)}
                style={{ 
                  width: '36px', height: '36px', 
                  display: 'flex', justifyContent: 'center', alignItems: 'center', 
                  backgroundColor: 'white', border: '1px solid #eaeaea', 
                  borderRadius: '6px', cursor: page >= Math.ceil(totalItems / pageSize) ? 'not-allowed' : 'pointer',
                  color: page >= Math.ceil(totalItems / pageSize) ? '#ccc' : '#333'
                }}
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal chi tiết sản phẩm */}
      {showDetailModal && selectedProduct && createPortal(
        <div className="admin-modal-overlay" onClick={closeDetailModal}>
          <div className="admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className={`badge ${selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? 'badge-auction' : 'badge-pending'}`}>
                  {selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? t('admin.listings.auction_listing') : t('admin.listings.regular_listing')}
                </span>
                <h3>{selectedProduct.name}</h3>
                <p>Mã SP: {selectedProduct.productId} · Người bán: {selectedProduct.sellerName}</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={closeDetailModal} disabled={actionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-product-preview-layout">
                {/* Cột trái: Hình ảnh */}
                <div className="preview-gallery">
                  <div className="main-preview-image">
                    {activeImage ? (
                      <img src={activeImage} alt="Preview" />
                    ) : (
                      <div className="no-image-placeholder">
                        <span className="material-symbols-outlined">image</span>
                      </div>
                    )}
                  </div>
                  <div className="gallery-thumbnails">
                    {selectedProduct.images?.map((img) => (
                      <button
                        key={img.imageId}
                        className={`thumb-btn ${activeImage === img.imageUrl ? 'active' : ''} ${img.isMain ? 'main-thumb' : ''}`}
                        onClick={() => setActiveImage(img.imageUrl)}
                        type="button"
                      >
                        <img src={img.imageUrl} alt={img.altText} />
                        {img.isMain && <span className="main-dot"></span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cột phải: Thông tin */}
                <div className="preview-details">
                  <div className="detail-section">
                    <h4>{t('admin.listings.basic_info')}</h4>
                    <table className="preview-info-table">
                      <tbody>
                        <tr>
                          <td>{t('admin.listings.category')}:</td>
                          <td>
                            <strong>{selectedProduct.categoryName}</strong>
                            {!isCategoryApproved && (
                              <span className="badge badge-pending" style={{ marginLeft: '8px', fontSize: '11px' }}>{t('admin.listings.category_not_active')}</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t('admin.listings.price')}:</td>
                          <td>
                            {selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? (
                              <span className="badge badge-auction">{t('admin.listings.configured_in_auction')}</span>
                            ) : (
                              <strong className="text-primary">{selectedProduct.price ? formatCurrency(selectedProduct.price) : t('admin.listings.contact_seller')}</strong>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t('admin.listings.stock')}:</td>
                          <td>{selectedProduct.stockQuantity}</td>
                        </tr>
                        <tr>
                          <td>{t('admin.listings.condition')}:</td>
                          <td>{getConditionLabel(selectedProduct.condition)}</td>
                        </tr>
                        <tr>
                          <td>{t('admin.listings.status')}:</td>
                          <td>{getStatusBadge(selectedProduct.status)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="detail-section">
                    <h4>{t('admin.listings.dimensions_weight')}</h4>
                    <table className="preview-info-table">
                      <tbody>
                        <tr>
                          <td>{t('admin.listings.weight')}:</td>
                          <td>{selectedProduct.weightGram ? `${selectedProduct.weightGram} g` : t('admin.listings.no_weight')}</td>
                        </tr>
                        <tr>
                          <td>{t('admin.listings.dimensions')}:</td>
                          <td>
                            {selectedProduct.lengthCm && selectedProduct.widthCm && selectedProduct.heightCm
                              ? `${selectedProduct.lengthCm} x ${selectedProduct.widthCm} x ${selectedProduct.heightCm} cm`
                              : t('admin.listings.no_dimensions')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {selectedProduct.attributes?.length > 0 && (
                    <div className="detail-section">
                      <h4>{t('admin.listings.category_specs')}</h4>
                      <table className="preview-info-table">
                        <tbody>
                          {selectedProduct.attributes.map((attr) => (
                            <tr key={attr.attributeId}>
                              <td>{attr.attributeName}:</td>
                              <td>
                                <strong>
                                  {attr.value} {attr.unit}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="detail-section">
                    <h4>{t('admin.listings.product_desc')}</h4>
                    <p className="product-description-text">{selectedProduct.description || t('admin.listings.no_description')}</p>
                  </div>
                </div>
              </div>

              {showRejectInput && (
                <div className="reject-reason-box animate-fade-in" style={{ marginTop: '20px' }}>
                  <label>
                    <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                      {t('admin.listings.reject_reason')}
                    </span>
                    <textarea
                      ref={rejectReasonRef}
                      placeholder={t('admin.listings.reject_reason_placeholder')}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      disabled={actionLoading}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              {showRejectInput && (
                <button
                  type="button"
                  className="admin-action-btn outline"
                  onClick={() => setShowRejectInput(false)}
                  disabled={actionLoading}
                >
                  {t('common.cancel')}
                </button>
              )}
              {(selectedProduct.status === 'Pending' || selectedProduct.status === 'Waiting') && (
                <>
                  <button
                    type="button"
                    className="admin-action-btn danger"
                    onClick={() => promptReject(selectedProduct)}
                    disabled={actionLoading}
                  >
                    {actionLoading && showRejectInput 
                      ? t('common.loading') 
                      : showRejectInput 
                        ? `${t('admin.reject')} (${t('common.confirm')})` 
                        : t('admin.reject')}
                  </button>
                  {!showRejectInput && (
                    <button
                      type="button"
                      className="admin-action-btn success"
                      onClick={() => promptApprove(selectedProduct)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? t('common.loading') : t('admin.approve')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal Portal */}
      {confirmModal.open && confirmModal.product && createPortal(
        <div className="admin-modal-overlay" onClick={() => !actionLoading && setConfirmModal({ open: false, action: '', product: null, reason: '' })} style={{ zIndex: 100000 }}>
          <div className="status-confirm-modal animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', padding: '24px', borderRadius: '12px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: confirmModal.action === 'approve' ? '#10b981' : '#ef4444' }}>
                {confirmModal.action === 'approve' ? 'verified' : 'cancel'}
              </span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                {confirmModal.action === 'approve' ? t('admin.listings.confirm_approve_title') : t('admin.listings.confirm_reject_title')}
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {confirmModal.action === 'approve'
                ? t('admin.listings.confirm_approve_text').replace('{{name}}', confirmModal.product.name)
                : t('admin.listings.confirm_reject_text').replace('{{name}}', confirmModal.product.name).replace('{{reason}}', confirmModal.reason)}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="admin-action-btn outline"
                onClick={() => setConfirmModal({ open: false, action: '', product: null, reason: '' })}
                disabled={actionLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={`admin-action-btn ${confirmModal.action === 'approve' ? 'success' : 'danger'}`}
                onClick={handleConfirmAction}
                disabled={actionLoading}
              >
                {actionLoading ? <span className="btn-spinner"></span> : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
