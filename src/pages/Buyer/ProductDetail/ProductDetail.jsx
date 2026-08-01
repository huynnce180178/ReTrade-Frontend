import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import productService from '../../../services/productService';
import wishlistService from '../../../services/wishlistService';
import offerService from '../../../services/offerService';
import addressService from '../../../services/addressService';
import checkoutService from '../../../services/checkoutService';
import { createVnPayPaymentUrl } from '../../../services/paymentService';
import chatService from '../../../services/chatService';
import '../../../styles/ProductDetail.css';

function formatDate(dateStr, language) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateTime(dateStr, language) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getSellerInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

const isProductUnavailable = (product) => (
  product?.status === 'SoldOut' ||
  product?.status === 'Sold' ||
  product?.status === 'Inactive' ||
  Number(product?.stockQuantity ?? 0) <= 0
);

function getOfferStatusConfig(status, language) {
  switch (status) {
    case 'Pending': return { label: language === 'vi' ? 'Chờ duyệt' : 'Pending', color: '#f59e0b', bg: '#fef3c7', icon: 'schedule' };
    case 'Accepted': return { label: language === 'vi' ? 'Đã chấp nhận' : 'Accepted', color: '#0f7b5f', bg: '#e6f5ef', icon: 'check_circle' };
    case 'Rejected': return { label: language === 'vi' ? 'Bị từ chối' : 'Rejected', color: '#dc2626', bg: '#fee2e2', icon: 'cancel' };
    case 'Cancelled': return { label: language === 'vi' ? 'Đã hủy' : 'Cancelled', color: '#6b7280', bg: '#f3f4f6', icon: 'block' };
    case 'Completed': return { label: language === 'vi' ? 'Đã hoàn tất' : 'Completed', color: '#2563eb', bg: '#dbeafe', icon: 'verified' };
    default: return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: 'help' };
  }
}

/* =============================================
   MAKE OFFER MODAL
   ============================================= */
function MakeOfferModal({ product, onClose, onSuccess }) {
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();
  const [offerPrice, setOfferPrice] = useState('');
  const [message, setMessage] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [submitting, setSubmitting] = useState(false);

  const originalPrice = product?.price;
  const parsedOffer = parseFloat(offerPrice.replace(/\D/g, '')) || 0;
  // Offer must be LOWER than listed price (bargaining only)
  const isPriceInvalid = parsedOffer > 0 && originalPrice != null && parsedOffer >= originalPrice;
  const discount = originalPrice && parsedOffer > 0 && !isPriceInvalid
    ? Math.round(((originalPrice - parsedOffer) / originalPrice) * 100)
    : 0;

  const handlePriceInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setOfferPrice(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!parsedOffer || parsedOffer <= 0) {
      showToast(language === 'vi' ? 'Vui lòng nhập giá đề xuất hợp lệ.' : 'Please enter a valid offer price.', 'error');
      return;
    }
    if (isPriceInvalid) {
      showToast(language === 'vi' ? `Mức giá trả phải nhỏ hơn giá niêm yết (${formatCurrency(originalPrice)}).` : `Offer must be lower than the listed price (${formatCurrency(originalPrice)}).`, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await offerService.makeOffer(
        product.productId, parsedOffer, message, expiresInHours
      );
      showToast(language === 'vi' ? 'Đã gửi đề xuất trả giá thành công!' : 'Offer submitted successfully!', 'success');
      onSuccess(result);
      onClose();
    } catch (err) {
      const msg = err.response?.data || err.message || (language === 'vi' ? 'Không thể gửi đề xuất trả giá.' : 'Failed to submit offer.');
      showToast(typeof msg === 'string' ? msg : (language === 'vi' ? 'Không thể gửi đề xuất trả giá.' : 'Failed to submit offer.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="offer-modal-overlay" onClick={onClose}>
      <div className="offer-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="offer-modal-header">
          <div className="offer-modal-header-left">
            <span className="material-symbols-outlined offer-modal-icon">local_offer</span>
            <div>
              <h2 className="offer-modal-title">{language === 'vi' ? 'Đề xuất trả giá' : 'Make an Offer'}</h2>
              <p className="offer-modal-subtitle">{language === 'vi' ? 'Thương lượng mức giá mong muốn với người bán' : 'Negotiate a price with the seller'}</p>
            </div>
          </div>
          <button className="offer-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Product preview */}
        <div className="offer-product-preview">
          {product?.images?.[0]?.imageUrl ? (
            <img
              src={product.images.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0].imageUrl}
              alt={product.name}
              className="offer-product-img"
            />
          ) : (
            <div className="offer-product-img-placeholder">📦</div>
          )}
          <div className="offer-product-info">
            <span className="offer-product-name">{product?.name}</span>
            <span className="offer-product-price">
              {language === 'vi' ? 'Giá niêm yết:' : 'Listed at:'} <strong>{formatCurrency(originalPrice)}</strong>
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="offer-form">
          {/* Price input */}
          <div className="offer-field">
            <label className="offer-label">{language === 'vi' ? 'Mức giá bạn đề xuất (VND) *' : 'Your Offer Price (VND) *'}</label>
            <div className="offer-price-input-wrapper">
              <input
                type="text"
                className={`offer-price-input${isPriceInvalid ? ' offer-price-input-error' : ''}`}
                value={offerPrice}
                onChange={handlePriceInput}
                placeholder={originalPrice ? (language === 'vi' ? `Tối đa ${formatCurrency(originalPrice - 1)}` : `Max ${formatCurrency(originalPrice - 1)}`) : '1,500,000'}
                required
                autoFocus
              />
              {parsedOffer > 0 && originalPrice && !isPriceInvalid && (
                <div className="offer-discount-badge down">
                  -{discount}%
                </div>
              )}
              {isPriceInvalid && (
                <div className="offer-discount-badge up">
                  {language === 'vi' ? 'Quá cao!' : 'Too high!'}
                </div>
              )}
            </div>
            {isPriceInvalid ? (
              <span className="offer-price-error">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
                {language === 'vi' ? `Mức giá trả phải nhỏ hơn giá niêm yết (${formatCurrency(originalPrice)})` : `Offer must be lower than the listed price (${formatCurrency(originalPrice)})`}
              </span>
            ) : parsedOffer > 0 ? (
              <span className="offer-price-preview">{formatCurrency(parsedOffer)} — {language === 'vi' ? `tiết kiệm ${formatCurrency(originalPrice - parsedOffer)}` : `save ${formatCurrency(originalPrice - parsedOffer)}`}</span>
            ) : null}
          </div>

          {/* Message */}
          <div className="offer-field">
            <label className="offer-label">{language === 'vi' ? 'Lời nhắn gửi người bán (không bắt buộc)' : 'Message to Seller (optional)'}</label>
            <textarea
              className="offer-textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={language === 'vi' ? 'Giải thích lý do bạn trả mức giá này...' : "Explain why you're offering this price..."}
              rows={3}
              maxLength={300}
            />
            <span className="offer-char-count">{message.length}/300</span>
          </div>

          {/* Expiry */}
          <div className="offer-field">
            <label className="offer-label">{language === 'vi' ? 'Thời hạn đề xuất' : 'Offer expires in'}</label>
            <div className="offer-expiry-options">
              {[24, 48, 72].map(h => (
                <button
                  key={h}
                  type="button"
                  className={`offer-expiry-btn ${expiresInHours === h ? 'active' : ''}`}
                  onClick={() => setExpiresInHours(h)}
                >
                  {h}{language === 'vi' ? 'giờ' : 'h'}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="offer-modal-actions">
            <button type="button" className="offer-btn-cancel" onClick={onClose}>
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button type="submit" className="offer-btn-submit" disabled={submitting || !parsedOffer || isPriceInvalid}>
              {submitting ? (
                <><span className="offer-spinner" /> {language === 'vi' ? 'Đang gửi...' : 'Submitting...'}</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>price_check</span> {language === 'vi' ? 'Gửi trả giá' : 'Make Offer'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

/* =============================================
   MAIN COMPONENT
   ============================================= */
export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { language, formatCurrency } = useLanguage();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [showMakeOffer, setShowMakeOffer] = useState(false);
  const [myPendingOffer, setMyPendingOffer] = useState(null);

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

  // Check if user has a pending/accepted offer on this product
  useEffect(() => {
    const checkMyOffer = async () => {
      if (!user || !productId) return;
      try {
        const offers = await offerService.getMyOffers(productId);
        const pending = (Array.isArray(offers) ? offers : []).find(
          o => o.status === 'Pending' || o.status === 'Accepted'
        );
        setMyPendingOffer(pending || null);
      } catch { }
    };
    checkMyOffer();
  }, [user, productId]);

  const handleToggleWishlist = async () => {
    if (!user) {
      showToast(language === 'vi' ? 'Vui lòng đăng nhập để dùng danh sách yêu thích.' : 'Please sign in to use the wishlist.', 'error');
      return;
    }
    if (product?.sellerId === user.userId || product?.sellerId === user.id || product?.sellerId === user.accountId) {
      showToast(language === 'vi' ? 'Bạn không thể thêm sản phẩm của chính mình vào danh sách yêu thích.' : 'You cannot add your own product to your wishlist.', 'error');
      return;
    }
    if (!isWishlisted && isProductUnavailable(product)) {
      showToast(language === 'vi' ? 'Sáº£n pháº©m Ä‘Ã£ háº¿t hÃ ng.' : 'This product is out of stock.', 'warning');
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
          showToast(language === 'vi' ? 'Đã xóa khỏi danh sách yêu thích.' : 'Removed from wishlist.', 'success');
        }
      } else {
        await wishlistService.addToWishlist(product.productId);
        setIsWishlisted(true);
        showToast(language === 'vi' ? 'Đã thêm vào danh sách yêu thích!' : 'Added to wishlist!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data || err.message || (language === 'vi' ? 'Đã xảy ra lỗi.' : 'Something went wrong.');
      showToast(msg, 'error');
    } finally {
      setTogglingWishlist(false);
    }
  };

  const handleGoToCheckout = () => {
    if (!product?.productId) return;
    if (isProductUnavailable(product)) {
      showToast(language === 'vi' ? 'Sáº£n pháº©m Ä‘Ã£ háº¿t hÃ ng, khÃ´ng thá»ƒ mua ngay.' : 'This product is out of stock and cannot be purchased.', 'warning');
      return;
    }
    navigate(`/checkout/${product.productId}`, { state: { product } });
  };

  const handlePlaceBid = () => {
    if (product?.auctionId) {
      navigate(`/auction/${product.auctionId}`);
    } else {
      navigate('/auction');
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      showToast(language === 'vi' ? 'Vui lòng đăng nhập để nhắn tin với người bán.' : 'Please sign in to contact the seller.', 'warning');
      navigate('/login');
      return;
    }

    if (isSeller) {
      showToast(language === 'vi' ? 'Bạn không thể tự nhắn tin cho sản phẩm của mình.' : 'You cannot chat with yourself about your own product.', 'warning');
      return;
    }

    try {
      const room = await chatService.getOrCreateRoom(product.productId);
      if (room?.roomId) {
        navigate(`/chat/${room.roomId}`);
      }
    } catch (error) {
      const msg = error.response?.data || error.message || (language === 'vi' ? 'Không thể mở cuộc trò chuyện.' : 'Failed to open chat.');
      showToast(String(msg), 'error');
    }
  };

  const handleMakeOfferSuccess = (newOffer) => {
    setMyPendingOffer(newOffer);
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
          showToast(language === 'vi' ? 'Không thể tải chi tiết sản phẩm.' : 'Failed to load product details.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };
    if (productId) {
      fetchProduct();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [productId, language, showToast]);

  // Determine if current user is the seller
  const isSeller = user && product && (
    product.sellerId === user.userId ||
    product.sellerId === user.id ||
    product.sellerId === user.accountId
  );

  // Loading state
  if (loading) {
    return (
      <div className="product-detail-page container animate-fade-in">
        <div className="pd-loading">
          <div className="product-loading-spinner" />
          <p>{language === 'vi' ? 'Đang tải thông tin sản phẩm...' : 'Loading product details...'}</p>
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
          <h2>{language === 'vi' ? 'Không tìm thấy sản phẩm' : 'Product Not Found'}</h2>
          <p>{language === 'vi' ? 'Sản phẩm bạn tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.' : "The product you're looking for doesn't exist or has been removed."}</p>
          <Link to="/product" className="btn btn-primary" style={{ marginTop: '8px' }}>
            {language === 'vi' ? 'Xem tất cả sản phẩm' : 'Browse All Products'}
          </Link>
        </div>
      </div>
    );
  }

  const mainImage = sortedImages[mainImageIndex] || null;
  const attributes = (product.attributes || []).filter(a => a.value);
  const hasDimensions = product.weightGram || product.lengthCm || product.widthCm || product.heightCm;
  const isOutOfStock = isProductUnavailable(product);

  return (
    <div className="product-detail-page container animate-fade-in">
      {/* Breadcrumb */}
      <nav className="pd-breadcrumb">
        <Link to="/">{language === 'vi' ? 'Trang chủ' : 'Home'}</Link>
        <span className="sep">›</span>
        <Link to="/product">{language === 'vi' ? 'Sản phẩm' : 'Products'}</Link>
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
                  <span>{language === 'vi' ? 'Nhấn để xem ảnh lớn' : 'Click to expand'}</span>
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
                <span className="pd-price">{formatCurrency(product.price)}</span>
              </>
            ) : (
              <span className="pd-price" style={{ fontSize: '22px', color: 'var(--accent)' }}>{language === 'vi' ? 'Sản phẩm Đấu giá' : 'Auction Item'}</span>
            )}
          </div>

          {/* Meta: Condition + Stock */}
          <div className="pd-meta-row">
            {product.condition && (
              <div className="pd-meta-tag">
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                </svg>
                <span className="meta-label">{language === 'vi' ? 'Tình trạng' : 'Condition'}</span>
                <span className="meta-val">{product.condition}</span>
              </div>
            )}
            {product.stockQuantity != null && (
              <div className={`pd-meta-tag ${isOutOfStock ? 'out-of-stock' : ''}`}>
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span className="meta-label">{language === 'vi' ? 'Kho hàng' : 'Stock'}</span>
                <span className="meta-val">
                  {isOutOfStock ? (language === 'vi' ? 'Hết hàng' : 'Out of stock') : `${product.stockQuantity} ${language === 'vi' ? 'sản phẩm' : 'available'}`}
                </span>
              </div>
            )}
            {product.status && (
              <div className="pd-meta-tag">
                <svg className="meta-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="meta-label">{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
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
              <span className="pd-seller-label">{language === 'vi' ? 'Người bán' : 'Seller'}</span>
              <span className="pd-seller-name">{product.sellerName || t('common.unknown_seller')}</span>
            </div>
            {product.sellerId && (
              <span className="pd-seller-link">
                {language === 'vi' ? 'Xem hồ sơ' : 'View Profile'}
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
              <span>{language === 'vi' ? 'Ngày đăng' : 'Listed'}</span>
              <strong>{formatDate(product.createdAt, language)}</strong>
            </div>
            {product.updatedAt && product.updatedAt !== product.createdAt && (
              <div className="pd-date-item">
                <span>{language === 'vi' ? 'Cập nhật' : 'Updated'}</span>
                <strong>{formatDate(product.updatedAt, language)}</strong>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pd-actions">
            {product.price != null ? (
              <button className="btn btn-primary pd-btn-buy" onClick={handleGoToCheckout} disabled={isOutOfStock}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>shopping_cart</span>
                {isOutOfStock ? (language === 'vi' ? 'Hết hàng' : 'Out of Stock') : (language === 'vi' ? 'Mua ngay' : 'Buy Now')}
              </button>
            ) : (
              <button className="btn btn-primary pd-btn-buy" onClick={handlePlaceBid} disabled={isOutOfStock}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>gavel</span>
                {language === 'vi' ? 'Đặt giá thầu' : 'Place Bid'}
              </button>
            )}

            <div className="pd-actions-icons">
              <button className="btn btn-outline pd-btn-icon" title={language === 'vi' ? 'Nhắn tin người bán' : 'Contact Seller'} onClick={handleContactSeller}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>chat</span>
              </button>
              <button
                className={`btn ${isWishlisted ? 'btn-primary' : 'btn-outline'} pd-btn-icon`}
                onClick={handleToggleWishlist}
                disabled={togglingWishlist || (!isWishlisted && isOutOfStock)}
                title={isWishlisted ? (language === 'vi' ? 'Xóa khỏi yêu thích' : 'Remove from Wishlist') : (language === 'vi' ? 'Thêm vào yêu thích' : 'Add to Wishlist')}
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

          {/* Offer Actions — shown only to non-seller buyers when product has a price */}
          {product.price != null && user && !isSeller && !isOutOfStock && (
            <div className="pd-offer-section">
              <div className="pd-offer-label">
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#0f7b5f' }}>local_offer</span>
                {language === 'vi' ? 'Thương lượng giá' : 'Negotiate Price'}
              </div>

              {myPendingOffer ? (
                <div className="pd-offer-existing">
                  <div className="pd-offer-existing-info">
                    <span className="pd-offer-existing-price">
                      {language === 'vi' ? 'Giá bạn trả:' : 'Your offer:'} <strong>{formatCurrency(myPendingOffer.offerPrice)}</strong>
                    </span>
                    <span
                      className="pd-offer-existing-status"
                      style={{
                        color: getOfferStatusConfig(myPendingOffer.status, language).color,
                        background: getOfferStatusConfig(myPendingOffer.status, language).bg
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {getOfferStatusConfig(myPendingOffer.status, language).icon}
                      </span>
                      {getOfferStatusConfig(myPendingOffer.status, language).label}
                    </span>
                  </div>
                  <button
                    className="pd-offer-btn pd-offer-btn-history"
                    onClick={() => navigate('/offer-history')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                    {language === 'vi' ? 'Xem lịch sử trả giá' : 'View Offer History'}
                  </button>
                </div>
              ) : (
                <div className="pd-offer-buttons">
                  <button
                    className="pd-offer-btn pd-offer-btn-make"
                    onClick={() => {
                      if (!user) { showToast(language === 'vi' ? 'Vui lòng đăng nhập để đề xuất trả giá.' : 'Please sign in to make an offer.', 'error'); return; }
                      setShowMakeOffer(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>local_offer</span>
                    {language === 'vi' ? 'Đề xuất trả giá' : 'Make an Offer'}
                  </button>
                  <button
                    className="pd-offer-btn pd-offer-btn-history-alt"
                    onClick={() => navigate('/offer-history')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                    {language === 'vi' ? 'Xem lịch sử' : 'View History'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sections (span full width) */}
      <div className="pd-bottom-sections">
        {/* Offer Alerts */}
        {myPendingOffer && myPendingOffer.status === 'Accepted' && (
          <div className="pd-offer-alert accepted">
            <span className="material-symbols-outlined">check_circle</span>
            <div className="pd-offer-alert-text">
              <strong>{language === 'vi' ? 'Đề xuất giá đã được chấp nhận!' : 'Offer Accepted!'}</strong>
              <span>{language === 'vi' ? `Người bán đã đồng ý mức giá ${formatCurrency(myPendingOffer.offerPrice)}.` : `The seller accepted your offer of ${formatCurrency(myPendingOffer.offerPrice)}.`}</span>
            </div>
            <button className="pd-offer-alert-btn" onClick={() => navigate('/offer-history')}>
              {language === 'vi' ? 'Thanh toán ngay' : 'Checkout Now'}
            </button>
          </div>
        )}

        {myPendingOffer && myPendingOffer.status === 'Pending' && (
          <div className="pd-offer-alert pending">
            <span className="material-symbols-outlined">schedule</span>
            <div className="pd-offer-alert-text">
              <strong>{language === 'vi' ? 'Đang chờ người bán phản hồi' : 'Offer Pending'}</strong>
              <span>{language === 'vi' ? `Bạn có đề xuất trả giá ${formatCurrency(myPendingOffer.offerPrice)}.` : `You have a pending offer of ${formatCurrency(myPendingOffer.offerPrice)}.`}</span>
            </div>
            <button className="pd-offer-alert-btn" onClick={() => navigate('/offer-history')}>
              {language === 'vi' ? 'Xem trạng thái' : 'View Status'}
            </button>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="pd-description-section">
            <h2 className="pd-section-title">{language === 'vi' ? 'Mô tả sản phẩm' : 'Description'}</h2>
            <div className="pd-description-text">{product.description}</div>
          </div>
        )}

        {/* Attributes */}
        {attributes.length > 0 && (
          <div className="pd-attributes-section">
            <h2 className="pd-section-title">{language === 'vi' ? 'Thông số kỹ thuật' : 'Specifications'}</h2>
            <div className="pd-attributes-grid">
              {attributes.map((attr, idx) => (
                <div key={attr.attributeId || idx} className="pd-attr-item">
                  <span className="pd-attr-label">
                    {attr.attributeName || t('common.attribute')}
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
            <h2 className="pd-section-title">{language === 'vi' ? 'Kích thước & Trọng lượng' : 'Dimensions & Weight'}</h2>
            <div className="pd-dimensions-grid">
              {product.weightGram != null && (
                <div className="pd-dim-card">
                  <span className="pd-dim-value">{product.weightGram}g</span>
                  <span className="pd-dim-label">{language === 'vi' ? 'Trọng lượng' : 'Weight'}</span>
                </div>
              )}
              {product.lengthCm != null && (
                <div className="pd-dim-card">
                  <span className="pd-dim-value">{product.lengthCm}cm</span>
                  <span className="pd-dim-label">{language === 'vi' ? 'Chiều dài' : 'Length'}</span>
                </div>
              )}
              {product.widthCm != null && (
                <div className="pd-dim-card">
                  <span className="pd-dim-value">{product.widthCm}cm</span>
                  <span className="pd-dim-label">{language === 'vi' ? 'Chiều rộng' : 'Width'}</span>
                </div>
              )}
              {product.heightCm != null && (
                <div className="pd-dim-card">
                  <span className="pd-dim-value">{product.heightCm}cm</span>
                  <span className="pd-dim-label">{language === 'vi' ? 'Chiều cao' : 'Height'}</span>
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

      {/* Offer Modals */}
      {showMakeOffer && (
        <MakeOfferModal
          product={product}
          onClose={() => setShowMakeOffer(false)}
          onSuccess={handleMakeOfferSuccess}
        />
      )}
    </div>
  );
}
