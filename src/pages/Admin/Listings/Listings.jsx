import React, { useEffect, useState } from 'react';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import { useToast } from '../../../context/ToastContext';
import './Listings.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function Listings() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Pending', 'Approved', 'Rejected', 'Sold', 'Inactive'

  // Modal Detail states
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  // Approval action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch products automatically when filters or search terms change
  useEffect(() => {
    fetchProducts();
  }, [statusFilter, categoryFilter, searchTerm]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const filterParts = [];
      
      // 1. Status Filter via OData
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

      // 2. Category Filter via OData
      if (categoryFilter !== 'All') {
        filterParts.push(`CategoryName eq '${categoryFilter}'`);
      }

      // 3. Search Term via OData
      if (searchTerm.trim() !== '') {
        const term = searchTerm.trim().toLowerCase().replace(/'/g, "''");
        filterParts.push(`(contains(tolower(Name), '${term}') or contains(tolower(SellerName), '${term}'))`);
      }

      const params = {};
      if (filterParts.length > 0) {
        params['$filter'] = filterParts.join(' and ');
      }

      // Default sorting by CreatedAt Desc
      params['$orderby'] = 'CreatedAt desc';

      const res = await productService.getForApproval(params);
      // Map OData value array or flat array
      const items = Array.isArray(res) ? res : (res?.value || res?.items || []);
      setProducts(items);
    } catch (error) {
      const msg = typeof error?.response?.data === 'string' ? error.response.data : error?.message || 'Failed to load products.';
      showToast(msg, 'error');
      console.error('Fetch products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await categoryService.getAll();
      setCategories(Array.isArray(res) ? res : (res?.value || []));
    } catch (e) {
      // ignore silently
    }
  };

  const openProductDetail = async (product) => {
    try {
      // Get full details including dynamic attributes
      const fullDetail = await productService.getAdminProductById(product.productId);
      setSelectedProduct(fullDetail);
      setActiveImage(fullDetail?.images?.find(i => i.isMain)?.imageUrl || fullDetail?.images?.[0]?.imageUrl || null);
      setShowDetailModal(true);
      setShowRejectInput(false);
      setRejectReason('');
    } catch (e) {
      showToast('Failed to load product details.', 'error');
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

  const handleApprove = async () => {
    if (!selectedProduct) return;
    try {
      setActionLoading(true);
      await productService.approve(selectedProduct.productId, true, null);
      showToast('Product listing approved successfully.', 'success');
      closeDetailModal();
      await fetchProducts();
    } catch (error) {
      showToast(error?.response?.data || error?.message || 'An error occurred during approval.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProduct) return;
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      await productService.approve(selectedProduct.productId, false, rejectReason);
      showToast('Product listing rejected.', 'success');
      closeDetailModal();
      await fetchProducts();
    } catch (error) {
      showToast(error?.response?.data || error?.message || 'An error occurred during rejection.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return <span className="badge badge-pending">Pending Approval</span>;
      case 'Accepted':
        return <span className="badge badge-approved">Approved (Sale)</span>;
      case 'SaleRejected':
        return <span className="badge badge-rejected">Sale Rejected</span>;
      case 'Waiting':
        return <span className="badge badge-pending-auction">Pending Auction</span>;
      case 'Ready':
        return <span className="badge badge-approved-auction">Ready for Auction</span>;
      case 'AuctionRejected':
        return <span className="badge badge-rejected">Auction Rejected</span>;
      case 'Sold':
        return <span className="badge badge-sold">Sold</span>;
      case 'Inactive':
        return <span className="badge badge-inactive">Inactive</span>;
      default:
        return <span className="badge badge-unknown">{status}</span>;
    }
  };

  return (
    <div className="admin-listings-page animate-fade-in">
      <section className="admin-listings-hero">
        <div>
          <p className="admin-eyebrow">Platform Controller</p>
          <h1>Product Management</h1>
          <p className="admin-hero-copy">
            Query and manage all seller products in the platform. Filter and review listings dynamically.
          </p>
        </div>
      </section>

      <section className="admin-listings-panel">
        <header className="admin-panel-header">
          <div>
            <h2>Product List</h2>
            <p>Verify details, specifications, and update status of all platform listings.</p>
          </div>

          <div className="admin-panel-actions">
            <div className="admin-pill-group">
              <button
                className={`admin-pill ${statusFilter === 'All' ? 'active' : ''}`}
                onClick={() => setStatusFilter('All')}
                type="button"
              >
                All
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Pending')}
                type="button"
              >
                Pending
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Approved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Approved')}
                type="button"
              >
                Approved
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Rejected' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Rejected')}
                type="button"
              >
                Rejected
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Sold' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Sold')}
                type="button"
              >
                Sold
              </button>
              <button
                className={`admin-pill ${statusFilter === 'Inactive' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Inactive')}
                type="button"
              >
                Inactive
              </button>
            </div>

            <div className="admin-search-row">
              <label className="admin-search-box">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  placeholder="Search by product name, seller..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>

              <label className="admin-select-box">
                <span className="material-symbols-outlined">filter_alt</span>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.categoryId} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </header>

        <div className="admin-listings-table-wrap">
          {loading ? (
            <div className="admin-empty-state">
              <span className="btn-spinner"></span>
              <p>Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="admin-empty-state">
              <span className="material-symbols-outlined">verified</span>
              <h3>No products found</h3>
              <p>Try resetting filters or search query.</p>
            </div>
          ) : (
            <table className="admin-listings-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price / Type</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Seller</th>
                  <th>Date Posted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isAuction = p.status === 'Waiting' || p.status === 'Ready' || p.status === 'AuctionRejected';
                  return (
                    <tr key={p.productId} className="clickable-row" onClick={() => openProductDetail(p)}>
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
                          <strong>{p.price ? moneyFormatter.format(p.price) : 'Contact'}</strong>
                        )}
                      </td>
                      <td>{p.stockQuantity}</td>
                      <td>{getStatusBadge(p.status)}</td>
                      <td>{p.sellerName || 'N/A'}</td>
                      <td>{p.createdAt ? dateFormatter.format(new Date(p.createdAt)) : '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-action-btn outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductDetail(p);
                          }}
                        >
                          <span className="material-symbols-outlined">visibility</span>
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Modal chi tiết sản phẩm */}
      {showDetailModal && selectedProduct && (
        <div className="admin-modal-overlay" onClick={closeDetailModal}>
          <div className="admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <span className={`badge ${selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? 'badge-auction' : 'badge-pending'}`}>
                  {selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? 'Auction Listing' : 'Regular Listing'}
                </span>
                <h3>{selectedProduct.name}</h3>
                <p>Product ID: {selectedProduct.productId} · Seller: {selectedProduct.sellerName}</p>
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
                    <h4>Basic Information</h4>
                    <table className="preview-info-table">
                      <tbody>
                        <tr>
                          <td>Category:</td>
                          <td><strong>{selectedProduct.categoryName}</strong></td>
                        </tr>
                        <tr>
                          <td>Price:</td>
                          <td>
                            {selectedProduct.status === 'Waiting' || selectedProduct.status === 'Ready' || selectedProduct.status === 'AuctionRejected' ? (
                              <span className="badge badge-auction">Configured in Auction</span>
                            ) : (
                              <strong className="text-primary">{selectedProduct.price ? moneyFormatter.format(selectedProduct.price) : 'Contact'}</strong>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>Stock:</td>
                          <td>{selectedProduct.stockQuantity}</td>
                        </tr>
                        <tr>
                          <td>Condition:</td>
                          <td>{selectedProduct.condition || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td>Status:</td>
                          <td>{getStatusBadge(selectedProduct.status)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="detail-section">
                    <h4>Dimensions & Weight</h4>
                    <table className="preview-info-table">
                      <tbody>
                        <tr>
                          <td>Weight:</td>
                          <td>{selectedProduct.weightGram ? `${selectedProduct.weightGram} g` : 'Not provided'}</td>
                        </tr>
                        <tr>
                          <td>Dimensions (L x W x H):</td>
                          <td>
                            {selectedProduct.lengthCm && selectedProduct.widthCm && selectedProduct.heightCm
                              ? `${selectedProduct.lengthCm} x ${selectedProduct.widthCm} x ${selectedProduct.heightCm} cm`
                              : 'Not provided'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {selectedProduct.attributes?.length > 0 && (
                    <div className="detail-section">
                      <h4>Category Specifications</h4>
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
                    <h4>Product Description</h4>
                    <p className="product-description-text">{selectedProduct.description || 'No description provided.'}</p>
                  </div>
                </div>
              </div>

              {showRejectInput && (
                <div className="reject-reason-box animate-fade-in">
                  <label>
                    <span>Rejection Reason:</span>
                    <textarea
                      placeholder="Enter the details for rejection reason to notify the seller..."
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
                  Back
                </button>
              )}
              {/* Only show Approve/Reject buttons if product is awaiting approval */}
              {(selectedProduct.status === 'Pending' || selectedProduct.status === 'Waiting') && (
                <>
                  <button
                    type="button"
                    className="admin-action-btn danger"
                    onClick={handleReject}
                    disabled={actionLoading}
                  >
                    {actionLoading && showRejectInput ? 'Processing...' : 'Reject'}
                  </button>
                  {!showRejectInput && (
                    <button
                      type="button"
                      className="admin-action-btn success"
                      onClick={handleApprove}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Processing...' : 'Approve'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
