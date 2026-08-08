import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
import wishlistService from '../../services/wishlistService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import './SponsoredSpotlight.css';

export default function SponsoredSpotlight({ mode = 'grid', limit = 6, currentProductId = null, title = null }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();
  const { language, formatCurrency } = useLanguage();
  const navigate = useNavigate();
  const [wishlistSet, setWishlistSet] = useState(new Set());
  const scrollRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    productService.getPriorityProducts(limit + 4)
      .then((res) => {
        if (!mounted) return;
        let items = res?.items || (Array.isArray(res) ? res : []);
        if (currentProductId) {
          items = items.filter(p => p.productId !== currentProductId);
        }
        setProducts(items.slice(0, limit));
      })
      .catch(() => {
        if (mounted) setProducts([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [limit, currentProductId]);

  const handleToggleWishlist = async (e, p) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showToast(language === 'vi' ? 'Vui lòng đăng nhập để lưu sản phẩm.' : 'Please log in to save items.', 'error');
      return;
    }
    const pid = p.productId;
    try {
      if (wishlistSet.has(pid)) {
        setWishlistSet(prev => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
        showToast(language === 'vi' ? 'Đã xóa khỏi yêu thích' : 'Removed from wishlist', 'info');
      } else {
        await wishlistService.addToWishlist(pid);
        setWishlistSet(prev => new Set(prev).add(pid));
        showToast(language === 'vi' ? 'Đã thêm vào yêu thích' : 'Added to wishlist', 'success');
      }
    } catch {
      showToast(language === 'vi' ? 'Không thể cập nhật yêu thích' : 'Failed to update wishlist', 'error');
    }
  };

  const handleScroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (loading || products.length === 0) return null;

  const defaultTitle = language === 'vi' ? 'Sản phẩm Ưu tiên Tài trợ' : 'Sponsored Spotlight';

  return (
    <section className={`sponsored-spotlight-section mode-${mode}`}>
      <div className="sponsored-spotlight-header">
        <div className="sponsored-spotlight-title">
          <span className="sponsored-badge-pill">
            <span className="material-symbols-outlined star-icon">star</span>
            {language === 'vi' ? 'VIP Spotlight' : 'Sponsored VIP'}
          </span>
          <h3>{title || defaultTitle}</h3>
        </div>
        {mode === 'carousel' && products.length > 3 && (
          <div className="sponsored-nav-arrows">
            <button type="button" onClick={() => handleScroll('left')} aria-label="Previous">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button type="button" onClick={() => handleScroll('right')} aria-label="Next">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      <div
        className={`sponsored-products-container ${mode === 'carousel' ? 'scrollable' : ''}`}
        ref={scrollRef}
      >
        {products.map((p) => {
          const mainImg = p.mainImageUrl || p.images?.find(i => i.isMain)?.imageUrl || p.images?.[0]?.imageUrl || '/placeholder.png';
          const isLiked = wishlistSet.has(p.productId);

          return (
            <div key={p.productId} className="sponsored-product-card">
              <div className="sponsored-card-badge">
                <span className="material-symbols-outlined">verified</span>
                {language === 'vi' ? 'Nổi Bật VIP' : 'Sponsored'}
              </div>

              <button
                type="button"
                className={`sponsored-wishlist-btn ${isLiked ? 'liked' : ''}`}
                onClick={(e) => handleToggleWishlist(e, p)}
                title={language === 'vi' ? 'Yêu thích' : 'Favorite'}
              >
                <span className="material-symbols-outlined">{isLiked ? 'favorite' : 'favorite_border'}</span>
              </button>

              <Link to={`/product/${p.productId}`} className="sponsored-card-img-link">
                <img src={mainImg} alt={p.name} loading="lazy" />
              </Link>

              <div className="sponsored-card-info">
                {p.sellerName && (
                  <span className="sponsored-seller-tag">
                    <span className="material-symbols-outlined">storefront</span>
                    {p.sellerName}
                  </span>
                )}
                <Link to={`/product/${p.productId}`} className="sponsored-card-name" title={p.name}>
                  {p.name}
                </Link>

                <div className="sponsored-card-footer">
                  <span className="sponsored-card-price">{formatCurrency(p.price)}</span>
                  <button
                    type="button"
                    className="sponsored-buy-btn"
                    onClick={() => navigate(`/checkout/${p.productId}`)}
                  >
                    {language === 'vi' ? 'Mua ngay' : 'Buy Now'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
