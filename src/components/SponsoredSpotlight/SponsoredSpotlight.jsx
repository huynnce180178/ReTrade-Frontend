import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
import wishlistService from '../../services/wishlistService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import GradientWaves from '../GradientWaves/GradientWaves';
import DepthCarousel from '../DepthCarousel/DepthCarousel';
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
      <div className="sponsored-spotlight-waves">
        <GradientWaves
          horizonColor="#5227FF"
          waveColor="#FF9FFC"
          crestColor="#FFFFFF"
          speed={0.4}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1}
          opacity={1}
          mouseInteraction
          parallaxStrength={0.5}
          grain
          grainIntensity={0.05}
        />
      </div>

      <div className="sponsored-spotlight-content" style={{ position: 'relative', zIndex: 1 }}>
        <div className="sponsored-spotlight-header">
          <div className="sponsored-spotlight-title">
            <span className="sponsored-badge-pill">
              <span className="material-symbols-outlined star-icon">star</span>
              {language === 'vi' ? 'VIP Spotlight' : 'Sponsored VIP'}
            </span>
            <h3>{title || defaultTitle}</h3>
          </div>
        </div>

        {mode === 'carousel' ? (
          <div className="sponsored-carousel-wrapper" style={{ position: 'relative', height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DepthCarousel
              items={products.map(p => ({
                productId: p.productId,
                image: p.mainImageUrl || p.images?.find(i => i.isMain)?.imageUrl || p.images?.[0]?.imageUrl || '/placeholder.png',
                alt: p.name,
                title: p.name,
                price: formatCurrency(p.price),
                seller: p.sellerName || (language === 'vi' ? 'Thông tin người bán' : 'Seller info'),
                condition: p.condition
              }))}
              depth={140}
              spread={240}
              tilt={15}
              tiltDirection="right"
              perspective={1400}
              visibleCards={4}
              falloff={0.2}
              blur={4}
              autoplay
              loop
            />
          </div>
        ) : (
          <div className="sponsored-products-container">
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
        )}
      </div>
    </section>
  );
}
