import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import productService from '../../../services/productService';
import wishlistService from '../../../services/wishlistService';
import '../../../styles/ProductDetail.css';

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN').format(price);
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
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const images = product?.images || [];
  const sortedImages = [...images].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const handleOpenLightbox = () => {
    if (sortedImages.length > 0) {
      setLightboxIndex(mainImageIndex);
      setLightboxOpen(true);
    }
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev === 0 ? sortedImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setLightboxIndex((prev) => (prev === sortedImages.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') handlePrevImage(e);
      if (e.key === 'ArrowRight') handleNextImage(e);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, sortedImages.length]);

  useEffect(() => {
    const fetchWishlistStatus = async () => {
      if (!user || !productId) return;
      try {
        const data = await wishlistService.getWishlist();
        const item = (data.items ?? []).find(i => i.productId === productId);
        setIsWishlisted(!!item);
      } catch (err) {
      }
    };
    fetchWishlistStatus();
  }, [user, productId]);

  const handleToggleWishlist = async () => {
    if (!user) {
      showToast('Please sign in to use the wishlist.', 'error');
      return;
    }
    if (product?.sellerId === user.userId || product?.sellerId === user.id || product?.sellerId === user.accountId) {
      showToast('You cannot add your own product to your wishlist.', 'error');
      return;
    }
    setTogglingWishlist(true);
    try {
      if (isWishlisted) {
        const data = await wishlistService.getWishlist();
        const item = (data.items ?? []).find(i => i.productId === product.productId);
        if (item) {
          await wishlistService.removeItem(item.wishlistItemId);
          setIsWishlisted(false);
          showToast('Removed from wishlist.', 'success');
        }
      } else {
        await wishlistService.addToWishlist(product.productId);
        setIsWishlisted(true);
        showToast('Added to wishlist!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Something went wrong.';
      showToast(msg, 'error');
    } finally {
      setTogglingWishlist(false);
    }
  };

  const handleGoToCheckout = () => {
    if (!product?.productId) return;
    navigate(`/checkout/${product.productId}`, { state: { product } });
  };

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
          <div 
            className="pd-main-image-wrapper" 
            onClick={handleOpenLightbox}
            style={{ cursor: mainImage?.imageUrl ? 'zoom-in' : 'default' }}
          >
            {mainImage?.imageUrl ? (
              <>
                <img src={mainImage.imageUrl} alt={mainImage.altText || product.name} />
                <div className="pd-main-image-overlay">
                  <span className="material-symbols-outlined">zoom_in</span>
                  <span>Click to expand</span>
                </div>
              </>
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
          <div className="pd-date-info">
            <div className="pd-date-item">
              <span>Listed</span>
              <strong>{formatDate(product.createdAt)}</strong>
            </div>
            {product.updatedAt && product.updatedAt !== product.createdAt && (
              <div className="pd-date-item">
                <span>Updated</span>
                <strong>{formatDate(product.updatedAt)}</strong>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pd-actions">
            {product.price != null ? (
              <button className="btn btn-primary pd-btn-buy" onClick={handleGoToCheckout}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_cart</span>
                Buy Now
              </button>
            ) : (
              <button className="btn btn-primary pd-btn-buy" onClick={handleGoToCheckout}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>gavel</span>
                Place Bid
              </button>
            )}
            
            <div className="pd-actions-icons">
              <button className="btn btn-outline pd-btn-icon" title="Contact Seller">
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>chat</span>
              </button>
              <button 
                className={`btn ${isWishlisted ? 'btn-primary' : 'btn-outline'} pd-btn-icon`}
                onClick={handleToggleWishlist}
                disabled={togglingWishlist}
                title={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
              >
                {togglingWishlist ? (
                  <span className="pd-wl-spinner" />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: isWishlisted ? "'FILL' 1" : "'FILL' 0" }}>
                    favorite
                  </span>
                )}
              </button>
            </div>
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

      {/* Lightbox Modal via Portal */}
      {lightboxOpen && sortedImages.length > 0 && createPortal(
        <div className="pd-lightbox-overlay" onClick={() => setLightboxOpen(false)}>
          <button className="pd-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close lightbox">
            <span className="material-symbols-outlined">close</span>
          </button>
          
          {sortedImages.length > 1 && (
            <button className="pd-lightbox-arrow left" onClick={handlePrevImage} aria-label="Previous image">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          )}

          <div className="pd-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={sortedImages[lightboxIndex]?.imageUrl} 
              alt={sortedImages[lightboxIndex]?.altText || product.name} 
              className="pd-lightbox-img"
            />
            {sortedImages[lightboxIndex]?.altText && (
              <div className="pd-lightbox-caption">
                {sortedImages[lightboxIndex].altText}
              </div>
            )}
          </div>

          {sortedImages.length > 1 && (
            <button className="pd-lightbox-arrow right" onClick={handleNextImage} aria-label="Next image">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          )}

          {sortedImages.length > 1 && (
            <div className="pd-lightbox-thumbnails" onClick={(e) => e.stopPropagation()}>
              {sortedImages.map((img, idx) => (
                <div
                  key={img.imageId || idx}
                  className={`pd-lightbox-thumb ${idx === lightboxIndex ? 'active' : ''}`}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img src={img.imageUrl} alt={img.altText || `Thumb ${idx + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
