import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productService from '../../../services/productService';
import wishlistService from '../../../services/wishlistService';
import categoryService from '../../../services/categoryService';
import userFavoriteService from '../../../services/userFavoriteService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import FavoriteCategoriesModal from '../../../components/FavoriteCategoriesModal/FavoriteCategoriesModal';
import '../../../styles/Home.css';

function HomeProductSlider({ children }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -360 : 360;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="home-product-slider-container">
      <button
        type="button"
        className="home-scroll-btn left"
        onClick={() => scroll('left')}
        aria-label="Previous products"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>

      <div className="home-product-scroll" ref={scrollRef}>
        {children}
      </div>

      <button
        type="button"
        className="home-scroll-btn right"
        onClick={() => scroll('right')}
        aria-label="Next products"
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, formatCurrency } = useLanguage();
  const navigate = useNavigate();
  const isLoggedIn = !!user;

  // Wishlist
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [togglingId, setTogglingId] = useState(null);

  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [favoriteProducts, setFavoriteProducts] = useState({});
  const [showFavModal, setShowFavModal] = useState(false);

  // Latest products
  const [latestProducts, setLatestProducts] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(true);

  // Priority products (recommended seller subscription products)
  const [priorityProducts, setPriorityProducts] = useState([]);
  const [loadingPriority, setLoadingPriority] = useState(true);

  // Categories
  const [categories, setCategories] = useState([]);

  // Fetch all root categories for the horizontal list
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc");
        const arr = Array.isArray(data) ? data : (data?.value || []);
        setCategories(arr.filter(c => !c.parentId));
      } catch {
        // Silently fail
      }
    };
    fetchCategories();
  }, []);

  const fetchLatestProducts = useCallback(async () => {
    setLoadingLatest(true);
    try {
      const data = await productService.getAll({
        Status: 'Accepted',
        Page: 1,
        PageSize: 8,
        SortBy: 'newest',
      });
      setLatestProducts(data.items || []);
    } catch {
      // Silently fail
    } finally {
      setLoadingLatest(false);
    }
  }, []);

  const fetchPriorityProducts = useCallback(async () => {
    setLoadingPriority(true);
    try {
      const data = await productService.getAll({
        IsPriorityOnly: true,
        Status: 'Accepted',
        Page: 1,
        PageSize: 4,
      });
      setPriorityProducts(data.items || []);
    } catch {
      // Silently fail
    } finally {
      setLoadingPriority(false);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    setLoadingFavorites(true);
    try {
      const data = await userFavoriteService.getFavorites();
      const favs = Array.isArray(data) ? data : [];
      setFavorites(favs);

      if (favs.length === 0) {
        if (user) {
          const uId = user.userId || user.accountId || 'global';
          const dismissed = localStorage.getItem(`retrade_dismissed_favorites_modal_${uId}`) ||
                            localStorage.getItem('retrade_dismissed_favorites_modal_global');
          if (!dismissed) {
            setShowFavModal(true);
          }
        }
      } else {
        const productMap = {};
        await Promise.all(
          favs.slice(0, 6).map(async (fav) => {
            try {
              const result = await productService.getAll({
                CategoryId: fav.categoryId,
                Status: 'Accepted',
                Page: 1,
                PageSize: 6,
              });
              productMap[fav.categoryId] = result.items || [];
            } catch {
              productMap[fav.categoryId] = [];
            }
          })
        );
        setFavoriteProducts(productMap);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingFavorites(false);
    }
  }, [user]);

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const data = await wishlistService.getWishlist();
      const ids = new Set((data.items ?? []).map(i => i.productId));
      setWishlistIds(ids);
    } catch {
    }
  }, [user]);

  useEffect(() => {
    fetchLatestProducts();
    fetchPriorityProducts();
  }, [fetchLatestProducts, fetchPriorityProducts]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchFavorites();
    }
  }, [isLoggedIn, fetchFavorites]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleTagClick = (tag) => {
    navigate(`/product?search=${encodeURIComponent(tag)}`);
  };

  const handleToggleWishlist = async (product) => {
    if (!user) {
      showToast(t('auth.login_title'), 'error');
      return;
    }
    if (product.sellerId === user.userId || product.sellerId === user.id) {
      showToast(t('common.warning'), 'error');
      return;
    }
    setTogglingId(product.productId);
    const isAdded = wishlistIds.has(product.productId);
    try {
      if (isAdded) {
        const data = await wishlistService.getWishlist();
        const item = (data.items ?? []).find(i => i.productId === product.productId);
        if (item) {
          await wishlistService.removeItem(item.wishlistItemId);
          setWishlistIds(prev => { const n = new Set(prev); n.delete(product.productId); return n; });
          showToast(t('product.remove_from_wishlist'), 'success');
        }
      } else {
        await wishlistService.addToWishlist(product.productId);
        setWishlistIds(prev => new Set([...prev, product.productId]));
        showToast(t('product.add_to_wishlist'), 'success');
      }
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.error_occurred');
      showToast(msg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handlePremiumMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  };

  return (
    <div className="home-page animate-fade-in">
      <section className="hero-section">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>

        <div className="container hero-container">
          <div className="hero-content">
            <span className="hero-badge">{t('home.hero_badge')}</span>
            <h1 className="hero-title">
              {t('home.hero_title_1')}<br />
              <span className="gradient-primary-text">{t('home.hero_title_2')}</span>
            </h1>
            <p className="hero-subtitle">
              {t('home.hero_subtitle')}
            </p>

            <div className="hero-tags">
              <span className="tag-label">{t('home.popular')}</span>
              <button className="tag-btn" onClick={() => handleTagClick('iPhone')}>iPhone</button>
              <button className="tag-btn" onClick={() => handleTagClick('Laptop')}>Laptop</button>
              <button className="tag-btn" onClick={() => handleTagClick('Sneakers')}>Sneakers</button>
              <button className="tag-btn" onClick={() => handleTagClick('Camera')}>Camera</button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card main-visual-card" onClick={() => navigate('/auction')} style={{ cursor: 'pointer' }}>
              <div className="card-header">
                <span className="card-badge">{t('home.live_auction')}</span>
                <span className="card-timer">02h 41m left</span>
              </div>
              <div className="card-image-placeholder">
                <span className="placeholder-text">Premium Vespa Sprint</span>
                <div className="image-overlay-glow"></div>
              </div>
              <div className="card-info">
                <h4>Vespa Sprint 150 ABS 2022</h4>
                <div className="price-row">
                  <div>
                    <span className="price-label">{t('home.current_bid')}</span>
                    <p className="price-value">{formatCurrency(65000000)}</p>
                  </div>
                  <button className="btn btn-primary bid-btn" onClick={(e) => { e.stopPropagation(); navigate('/auction'); }}>{t('home.place_bid')}</button>
                </div>
              </div>
            </div>

            <div className="visual-card floating-card-1" onClick={() => navigate('/product')} style={{ cursor: 'pointer' }}>
              <div className="float-badge">🚀 {t('home.fast_deal')}</div>
              <p>MacBook Pro M2 — {formatCurrency(26500000)}</p>
            </div>
            <div className="visual-card floating-card-2">
              <div className="float-badge">⭐ {t('home.top_seller')}</div>
              <p>Alex Johnson (4.9★)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Priority/Premium Recommended Listings */}
      {priorityProducts.length > 0 && (
        <section className="priority-recommendations-section">
          <div className="container">
            <div className="priority-header-row">
              <div className="section-title-wrap">
                <span className="premium-glow-badge">
                  <span className="material-symbols-outlined star-spin">stars</span>
                  {t('home.premium_listings')}
                </span>
                <h2 className="section-title">{t('home.sponsored_spotlight')}</h2>
                <p className="section-subtitle">{t('home.sponsored_subtitle')}</p>
              </div>
            </div>

            <div className="priority-grid">
              {priorityProducts.map(product => (
                <div key={product.productId} className="premium-card" onMouseMove={handlePremiumMouseMove}>
                  <div className="premium-card-glow"></div>
                  <div className="premium-image-wrapper">
                    <span className="premium-badge-tag">
                      <span className="material-symbols-outlined">workspace_premium</span>
                      VIP
                    </span>
                    {product.mainImageUrl ? (
                      <img src={product.mainImageUrl} alt={product.name} className="premium-img" />
                    ) : (
                      <div className="premium-image-placeholder">
                        <span className="material-symbols-outlined">image</span>
                      </div>
                    )}
                    <div className="premium-card-actions">
                      <button
                        className={`premium-action-btn ${wishlistIds.has(product.productId) ? 'active' : ''}`}
                        onClick={() => handleToggleWishlist(product)}
                        disabled={togglingId === product.productId}
                        title={t('product.add_to_wishlist')}
                      >
                        {togglingId === product.productId ? (
                          <span className="premium-spinner"></span>
                        ) : (
                          <span className="material-symbols-outlined">favorite</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="premium-card-body">
                    <div className="premium-seller-row">
                      <span className="premium-seller-name">
                        <span className="material-symbols-outlined">storefront</span>
                        {product.sellerName || t('product.seller_info')}
                      </span>
                      <span className="premium-condition-tag">{product.condition || t('product.condition')}</span>
                    </div>
                    <Link to={`/product/${product.productId}`} className="premium-product-name">
                      {product.name}
                    </Link>
                    <div className="premium-card-footer">
                      <div className="premium-price-wrap">
                        <span className="price-label">{t('product.buy_now')}</span>
                        <span className="premium-price">{formatCurrency(product.price)}</span>
                      </div>
                      <Link to={`/product/${product.productId}`} className="premium-view-btn">
                        {t('home.details')}
                        <span className="material-symbols-outlined">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Horizontal Category List */}
      {categories.length > 0 && (
        <section className="home-categories-section">
          <div className="container">
            <div className="home-categories-list">
              {categories.map(cat => (
                <Link to={`/category/${cat.categoryId}`} key={cat.categoryId} className="home-category-card">
                  <div className="home-category-icon">
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} /> : <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-muted)' }}>sell</span>}
                  </div>
                  <span className="home-category-name">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-main-section">
        <div className="container stats-grid grid-4-col">
          <div className="stat-card glass-card">
            <h3>$3.5M+</h3>
            <p>{t('home.trading_volume')}</p>
          </div>
          <div className="stat-card glass-card">
            <h3>45,000+</h3>
            <p>{t('home.items_traded')}</p>
          </div>
          <div className="stat-card glass-card">
            <h3>12,000+</h3>
            <p>{t('home.verified_traders')}</p>
          </div>
          <div className="stat-card glass-card">
            <h3>99.4%</h3>
            <p>{t('home.success_rate')}</p>
          </div>
        </div>
      </section>

      {/* Favorite Categories / Latest Products Section */}
      <section className="home-products-section">
        <div className="container">
          {isLoggedIn && favorites.length > 0 && (
            <>
              <div className="home-section-header">
                <div>
                  <h2 className="section-title">{t('home.your_favorites')}</h2>
                  <p className="section-subtitle">{t('home.favorites_subtitle')}</p>
                </div>
                <button className="btn btn-outline" onClick={() => setShowFavModal(true)} style={{ fontSize: '13px', padding: '8px 16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {t('home.edit_favorites')}
                </button>
              </div>
              {favorites.slice(0, 6).map(fav => {
                const products = favoriteProducts[fav.categoryId] || [];
                if (products.length === 0) return null;
                return (
                  <div key={fav.categoryId} className="home-category-section">
                    <div className="home-category-header">
                      <h3>{fav.categoryName || t('common.category')}</h3>
                      <Link to={`/category/${fav.categoryId}`} className="home-view-all-link">
                        {t('common.view_all')} →
                      </Link>
                    </div>
                    <HomeProductSlider>
                      {products.map(p => (
                        <HomeProductCard
                          key={p.productId}
                          product={p}
                          isWishlisted={wishlistIds.has(p.productId)}
                          toggling={togglingId === p.productId}
                          onToggleWishlist={handleToggleWishlist}
                        />
                      ))}
                    </HomeProductSlider>
                  </div>
                );
              })}
            </>
          )}

          {/* Always show Latest Products / Random Products at the bottom */}
          <div style={{ marginTop: isLoggedIn && favorites.length > 0 ? '60px' : '0' }}>
            <div className="home-section-header">
              <div>
                <h2 className="section-title">
                  {isLoggedIn ? t('home.products_interested') : t('home.latest_products')}
                </h2>
                <p className="section-subtitle">
                  {isLoggedIn ? t('home.latest_subtitle_user') : t('home.latest_subtitle_guest')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {isLoggedIn && (
                  <button className="btn btn-outline" onClick={() => setShowFavModal(true)} style={{ fontSize: '13px', padding: '8px 16px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }}>
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    {t('home.set_favorite_categories')}
                  </button>
                )}
                <Link to="/product" className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  {t('home.browse_all')} →
                </Link>
              </div>
            </div>

            {loadingLatest ? (
              <div className="home-products-loading">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="home-product-skeleton" />
                ))}
              </div>
            ) : latestProducts.length > 0 ? (
              <HomeProductSlider>
                {latestProducts.map(p => (
                  <HomeProductCard
                    key={p.productId}
                    product={p}
                    isWishlisted={wishlistIds.has(p.productId)}
                    toggling={togglingId === p.productId}
                    onToggleWishlist={handleToggleWishlist}
                  />
                ))}
              </HomeProductSlider>
            ) : (
              <div className="home-products-empty">
                <span>🛍️</span>
                <p>{t('common.no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">{t('home.why_choose_us')}</h2>
            <p className="section-subtitle">{t('home.why_choose_subtitle')}</p>
          </div>

          <div className="features-grid grid-3-col">
            <div className="feature-item glass-card">
              <div className="feature-icon">🛡️</div>
              <h3>{t('home.verified_sellers')}</h3>
              <p>{t('home.verified_sellers_desc')}</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">⚡</div>
              <h3>{t('home.secure_payment')}</h3>
              <p>{t('home.secure_payment_desc')}</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">📈</div>
              <h3>{t('home.ai_assistant')}</h3>
              <p>{t('home.ai_assistant_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass-panel">
            <h2>{t('home.cta_title')}</h2>
            <p>{t('home.cta_subtitle')}</p>
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary">{t('home.cta_create_btn')}</Link>
              <Link to="/product" className="btn btn-secondary">{t('home.cta_browse_btn')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Favorite Categories Modal */}
      <FavoriteCategoriesModal
        isOpen={showFavModal}
        onClose={() => {
          setShowFavModal(false);
          if (user) {
            const uId = user.userId || user.accountId || 'global';
            localStorage.setItem(`retrade_dismissed_favorites_modal_${uId}`, "true");
            localStorage.setItem('retrade_dismissed_favorites_modal_global', "true");
          }
        }}
        currentFavorites={favorites}
        onUpdate={() => {
          fetchFavorites();
          if (user) {
            const uId = user.userId || user.accountId || 'global';
            localStorage.setItem(`retrade_dismissed_favorites_modal_${uId}`, "true");
            localStorage.setItem('retrade_dismissed_favorites_modal_global', "true");
          }
        }}
      />
    </div>
  );
}

function HomeProductCard({ product, isWishlisted, toggling, onToggleWishlist }) {
  const isOutOfStock = product.status === 'SoldOut' || product.status === 'Sold' || product.status === 'Inactive' || product.stockQuantity <= 0;
  const navigate = useNavigate();
  const { t, formatCurrency } = useLanguage();

  return (
    <div
      className="home-product-card glass-card"
      onClick={() => navigate(`/product/${product.productId}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="home-product-img-wrap">
        {product.mainImageUrl ? (
          <img src={product.mainImageUrl} alt={product.name} className="home-product-img" />
        ) : (
          <div className="home-product-img-placeholder">🛍️</div>
        )}
        {!isOutOfStock && (
          <button
            className={`home-wishlist-btn${isWishlisted ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product);
            }}
            disabled={toggling}
            title={isWishlisted ? t('product.remove_from_wishlist') : t('product.add_to_wishlist')}
          >
            {toggling
              ? <span className="home-wl-spinner" />
              : <span
                  className="material-symbols-outlined home-wishlist-heart"
                  style={{ fontVariationSettings: isWishlisted ? "'FILL' 1" : "'FILL' 0" }}
                >
                favorite
              </span>
            }
          </button>
        )}
        {!isOutOfStock && product.price != null && (
          <button
            className="home-buy-now-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/checkout/${product.productId}`);
            }}
            title={t('product.buy_now')}
          >
            <span className="material-symbols-outlined">shopping_cart</span>
          </button>
        )}
        {product.condition && (
          <span className="home-product-condition">{product.condition}</span>
        )}
      </div>

      <div className="home-product-body">
        <p className="home-product-seller">{product.sellerName ?? t('product.seller_info')}</p>
        <h3 className="home-product-name">{product.name}</h3>
        <div className="home-product-footer">
          <span className="home-product-price">
            {product.price != null
              ? formatCurrency(product.price)
              : t('auction.title')}
          </span>
        </div>
      </div>
    </div>
  );
}
