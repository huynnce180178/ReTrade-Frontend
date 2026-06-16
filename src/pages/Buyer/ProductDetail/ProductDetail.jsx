import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import '../../../styles/ProductDetail.css';

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function getSellerInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImageIndex, setMainImageIndex] = useState(0);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await productService.getById(productId);
        setProduct(data);
        setMainImageIndex(0);
      } catch (err) {
        if (err?.response?.status === 404) {
          setProduct(null);
        } else {
          showToast('Failed to load product details.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };
    if (productId) {
      fetchProduct();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [productId]);

  // Loading state
  if (loading) {
    return (
      <div className="product-detail-page container animate-fade-in">
        <div className="pd-loading">
          <div className="product-loading-spinner" />
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!product) {
    return (
      <div className="product-detail-page container animate-fade-in">
        <div className="pd-not-found">
          <span className="pd-not-found-icon">📦</span>
          <h2>Product Not Found</h2>
          <p>The product you're looking for doesn't exist or has been removed.</p>
          <Link to="/product" className="btn btn-primary" style={{ marginTop: '8px' }}>
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const sortedImages = [...images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const mainImage = sortedImages[mainImageIndex] || null;
  const attributes = (product.attributes || []).filter(a => a.value);
  const hasDimensions = product.weightGram || product.lengthCm || product.widthCm || product.heightCm;

  return (
    <div className="product-detail-page container animate-fade-in">
      {/* Breadcrumb */}
      <nav className="pd-breadcrumb">
        <Link to="/">Home</Link>
        <span className="sep">›</span>
        <Link to="/product">Products</Link>
        {product.categoryName && (
          <>
            <span className="sep">›</span>
            <Link to={`/product?category=${product.categoryId}`}>{product.categoryName}</Link>
          </>
        )}
        <span className="sep">›</span>
        <span className="current">{product.name}</span>
      </nav>

      {/* Main Layout */}
      <div className="pd-main-layout">
        {/* Left: Image Gallery */}
        <div className="pd-gallery">
          <div className="pd-main-image-wrapper">
            {mainImage?.imageUrl ? (
              <img src={mainImage.imageUrl} alt={mainImage.altText || product.name} />
            ) : (
              <div className="pd-main-image-placeholder">📦</div>
            )}
          </div>
          {sortedImages.length > 1 && (
            <div className="pd-thumbnails">
              {sortedImages.map((img, idx) => (
                <div
                  key={img.imageId || idx}
                  className={`pd-thumb ${idx === mainImageIndex ? 'active' : ''}`}
                  onClick={() => setMainImageIndex(idx)}
                >
                  <img src={img.imageUrl} alt={img.altText || `Image ${idx + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div className="pd-info">
          {/* Category Tag */}
          {product.categoryName && (
            <Link
              to={`/product?category=${product.categoryId}`}
              className="pd-category-tag"
              style={{ textDecoration: 'none' }}
            >
              {product.categoryName}
            </Link>
          )}

          {/* Title */}
          <h1 className="pd-title">{product.name}</h1>

          {/* Price */}
          <div className="pd-price-section">
            {product.price != null ? (
              <>
                <span className="pd-price">{formatPrice(product.price)}</span>
                <span className="pd-price-label">VND</span>
              </>
            ) : (
              <span className="pd-price" style={{ fontSize: '22px', color: 'var(--accent)' }}>Auction Item</span>
            )}
          </div>

          {/* Meta: Condition + Stock */}
          <div className="pd-meta-row">
            {product.condition && (
              <div className="pd-meta-tag">
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                </svg>
                <span className="meta-label">Condition</span>
                <span className="meta-val">{product.condition}</span>
              </div>
            )}
            {product.stockQuantity != null && (
              <div className="pd-meta-tag">
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span className="meta-label">Stock</span>
                <span className="meta-val">{product.stockQuantity} available</span>
              </div>
            )}
            {product.status && (
              <div className="pd-meta-tag">
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="meta-label">Status</span>
                <span className="meta-val">{product.status}</span>
              </div>
            )}
          </div>

          <div className="pd-divider" />

          {/* Seller Card */}
          <div
            className="pd-seller-card"
            onClick={() => product.sellerId && navigate(`/sellers/${product.sellerId}`)}
            style={{ cursor: product.sellerId ? 'pointer' : 'default' }}
          >
            <div className="pd-seller-avatar">
              {getSellerInitials(product.sellerName)}
            </div>
            <div className="pd-seller-info">
              <span className="pd-seller-label">Seller</span>
              <span className="pd-seller-name">{product.sellerName || 'Unknown Seller'}</span>
            </div>
            {product.sellerId && (
              <span className="pd-seller-link">
                View Profile
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            )}
          </div>

          <div className="pd-divider" />

          {/* Dates */}
          <div className="pd-meta-row">
            <div className="pd-meta-tag">
              <span className="meta-label">Listed</span>
              <span className="meta-val">{formatDate(product.createdAt)}</span>
            </div>
            {product.updatedAt && product.updatedAt !== product.createdAt && (
              <div className="pd-meta-tag">
                <span className="meta-label">Updated</span>
                <span className="meta-val">{formatDate(product.updatedAt)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pd-actions">
            <button className="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Contact Seller
            </button>
            <button className="btn btn-outline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Wishlist
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sections (span full width) */}
      <div className="pd-bottom-sections">
          {/* Description */}
          {product.description && (
            <div className="pd-description-section">
              <h2 className="pd-section-title">Description</h2>
              <div className="pd-description-text">{product.description}</div>
            </div>
          )}

          {/* Attributes */}
          {attributes.length > 0 && (
            <div className="pd-attributes-section">
              <h2 className="pd-section-title">Specifications</h2>
              <div className="pd-attributes-grid">
                {attributes.map((attr, idx) => (
                  <div key={attr.attributeId || idx} className="pd-attr-item">
                    <span className="pd-attr-label">
                      {attr.attributeName || 'Attribute'}
                      {attr.unit && ` (${attr.unit})`}
                    </span>
                    <span className="pd-attr-value">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions */}
          {hasDimensions && (
            <div className="pd-dimensions-section">
              <h2 className="pd-section-title">Dimensions & Weight</h2>
              <div className="pd-dimensions-grid">
                {product.weightGram != null && (
                  <div className="pd-dim-card">
                    <span className="pd-dim-value">{product.weightGram}g</span>
                    <span className="pd-dim-label">Weight</span>
                  </div>
                )}
                {product.lengthCm != null && (
                  <div className="pd-dim-card">
                    <span className="pd-dim-value">{product.lengthCm}cm</span>
                    <span className="pd-dim-label">Length</span>
                  </div>
                )}
                {product.widthCm != null && (
                  <div className="pd-dim-card">
                    <span className="pd-dim-value">{product.widthCm}cm</span>
                    <span className="pd-dim-label">Width</span>
                  </div>
                )}
                {product.heightCm != null && (
                  <div className="pd-dim-card">
                    <span className="pd-dim-value">{product.heightCm}cm</span>
                    <span className="pd-dim-label">Height</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
