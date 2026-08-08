import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productService from '../../../services/productService';
import wishlistService from '../../../services/wishlistService';
import categoryService from '../../../services/categoryService';
import userFavoriteService from '../../../services/userFavoriteService';
import auctionService from '../../../services/auctionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import FavoriteCategoriesModal from '../../../components/FavoriteCategoriesModal/FavoriteCategoriesModal';
import GradientWaves from '../../../components/GradientWaves/GradientWaves';
import DepthCarousel from '../../../components/DepthCarousel/DepthCarousel';
import LightRays from '../../../components/LightRays/LightRays';
import ShinyText from '../../../components/ShinyText/ShinyText';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import '../../../styles/Home.css';

function HomeProductSlider({ children }) {
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const slides = React.Children.toArray(children);

  return (
    <div className="home-product-slider-container">
      <button
        type="button"
        ref={prevRef}
        className="home-scroll-btn left"
        aria-label="Previous products"
      >
        <span className="material-symbols-outlined">chevron_left</span>
      </button>

      <Swiper
        modules={[Navigation, Pagination, A11y]}
        spaceBetween={14}
        slidesPerView={2}
        loop={slides.length > 6}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onInit={(swiper) => {
          swiper.params.navigation.prevEl = prevRef.current;
          swiper.params.navigation.nextEl = nextRef.current;
          swiper.navigation.init();
          swiper.navigation.update();
        }}
        pagination={{ clickable: true }}
        breakpoints={{
          480: {
            slidesPerView: 3,
            spaceBetween: 12
          },
          768: {
            slidesPerView: 4,
            spaceBetween: 14
          },
          1024: {
            slidesPerView: 5,
            spaceBetween: 16
          },
          1280: {
            slidesPerView: 6,
            spaceBetween: 16
          }
        }}
        className="home-swiper"
      >
        {slides.map((slide, idx) => (
          <SwiperSlide key={idx}>
            {slide}
          </SwiperSlide>
        ))}
      </Swiper>

      <button
        type="button"
        ref={nextRef}
        className="home-scroll-btn right"
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
  const priorityTrackRef = useRef(null);

  // Ongoing & Upcoming auctions
  const [ongoingAuctions, setOngoingAuctions] = useState([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState([]);
  const [loadingAuctions, setLoadingAuctions] = useState(true);

  // Normal, Top & Random Products
  const [normalProducts, setNormalProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [randomProducts, setRandomProducts] = useState([]);

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
        PageSize: 8,
      });
      setPriorityProducts(data.items || []);
    } catch {
      // Silently fail
    } finally {
      setLoadingPriority(false);
    }
  }, []);

  const priorityCarouselItems = useMemo(() => {
    return priorityProducts.map(p => ({
      productId: p.productId,
      image: p.mainImageUrl || '/placeholder.png',
      alt: p.name,
      title: p.name,
      price: formatCurrency(p.price),
      seller: p.sellerName || t('product.seller_info'),
      condition: p.condition
    }));
  }, [priorityProducts, formatCurrency, t]);

  const fetchOngoingAuctions = useCallback(async () => {
    setLoadingAuctions(true);
    try {
      const [ongoingRes, upcomingRes] = await Promise.all([
        auctionService.getAll({ Page: 1, PageSize: 6, Status: 'Ongoing' }),
        auctionService.getAll({ Page: 1, PageSize: 6, Status: 'Upcoming' }),
      ]);
      setOngoingAuctions(ongoingRes?.items || []);
      setUpcomingAuctions(upcomingRes?.items || []);
    } catch {
      // Silently fail
    } finally {
      setLoadingAuctions(false);
    }
  }, []);

  const fetchProductSections = useCallback(async () => {
    try {
      const [normalRes, topRes] = await Promise.all([
        productService.getAll({ Status: 'Accepted', Page: 1, PageSize: 12, SortBy: 'newest' }),
        productService.getAll({ Status: 'Accepted', Page: 1, PageSize: 8, SortBy: 'top_seller' }),
      ]);
      const normItems = (normalRes?.items || []).filter(p => p.price != null);
      setNormalProducts(normItems);
      setTopProducts(topRes?.items || []);
      setRandomProducts([...normItems].sort(() => 0.5 - Math.random()));
    } catch {
      // Silently fail
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoadingFavorites(false);
      return;
    }
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
        const allFavItems = [];
        await Promise.all(
          favs.slice(0, 7).map(async (fav) => {
            try {
              const result = await productService.getAll({
                CategoryId: fav.categoryId,
                Status: 'Accepted',
                Page: 1,
                PageSize: 8,
                SortBy: 'newest'
              });
              const items = (result?.items || []).filter(p => p.price != null);
              productMap[fav.categoryId] = items;
              allFavItems.push(...items);
            } catch {
              productMap[fav.categoryId] = [];
            }
          })
        );
        setFavoriteProducts(productMap);

        const uniqueFavItems = Array.from(new Map(allFavItems.map(p => [p.productId, p])).values());
        if (uniqueFavItems.length > 0) {
          setNormalProducts(uniqueFavItems);
        }
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
    fetchOngoingAuctions();
    fetchProductSections();
  }, [fetchLatestProducts, fetchPriorityProducts, fetchOngoingAuctions, fetchProductSections]);

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
    const currentUserId = user?.userId || user?.id || user?.accountId || user?.sub;
    const productSellerId = product?.sellerId || product?.SellerId || product?.seller?.userId || product?.seller?.id;
    const isOwnProduct = Boolean(
      currentUserId &&
      productSellerId &&
      String(currentUserId).toLowerCase() === String(productSellerId).toLowerCase()
    );
    if (isOwnProduct) {
      showToast(t('product.cannot_wishlist_own_product'), 'error');
      return;
    }
    const isAdded = wishlistIds.has(product.productId);
    const isSold = product.status === 'SoldOut' || product.status === 'Sold' || product.status === 'Inactive' || Number(product.stockQuantity ?? 0) <= 0;
    if (!isAdded && isSold) {
      showToast(t('product.sold_out_cannot_add_wishlist'), 'warning');
      return;
    }
    setTogglingId(product.productId);
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

  const scrollPriority = (dir) => {
    if (priorityTrackRef.current) {
      const el = priorityTrackRef.current;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;

      if (dir === 'right') {
        if (el.scrollLeft >= maxScrollLeft - 15) {
          el.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          el.scrollBy({ left: 320, behavior: 'smooth' });
        }
      } else {
        if (el.scrollLeft <= 15) {
          el.scrollTo({ left: maxScrollLeft, behavior: 'smooth' });
        } else {
          el.scrollBy({ left: -320, behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <div className="home-page animate-fade-in">
      {priorityProducts.length > 0 && (
        <section className="priority-recommendations-section" style={{ paddingTop: '40px' }}>
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
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="priority-header-row">
              <div className="section-title-wrap">
                <span className="premium-glow-badge">
                  <span className="material-symbols-outlined star-spin">stars</span>
                  {t('home.premium_listings')}
                </span>
                <h2 className="section-title"><ShinyText text={t('home.sponsored_spotlight')} speed={3} color="#ffffff" shineColor="#ff9ffc" /></h2>
                <p className="section-subtitle">{t('home.sponsored_subtitle')}</p>
              </div>
            </div>

            <div className="priority-carousel-wrapper" style={{ position: 'relative', height: '480px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DepthCarousel
                items={priorityCarouselItems}
                depth={140}
                spread={240}
                tilt={15}
                tiltDirection="right"
                perspective={1400}
                visibleCards={4}
                falloff={0.2}
                blur={4}
                autoplay={true}
                autoplayDelay={2000}
                loop
              />
            </div>
          </div>
        </section>
      )}


      {/* Horizontal Category List */}
      {categories.length > 0 && (
        <section className="home-categories-section">
          <div className="container">
            <div className="home-section-header" style={{ marginBottom: '24px' }}>
              <div>
                <span className="live-pill-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>category</span>
                  {t('home.categories_badge') || 'Danh mục'}
                </span>
                <h2 className="section-title" style={{ marginTop: '8px' }}><ShinyText text={t('home.categories_title') || 'Khám Phá Theo Danh Mục'} speed={3} color="#1f2937" shineColor="#9ca3af" /></h2>
                <p className="section-subtitle">{t('home.categories_subtitle') || 'Tìm kiếm sản phẩm theo sở thích của bạn'}</p>
              </div>
              <Link to="/product" className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                {t('common.view_all') || 'Xem tất cả'} →
              </Link>
            </div>
            <div className="home-categories-list">
              {categories.map(cat => (
                <Link to={`/category/${cat.categoryId}`} key={cat.categoryId} className="home-category-card">
                  <div className="home-category-icon">
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} /> : <span className="material-symbols-outlined">sell</span>}
                  </div>
                  <span className="home-category-name">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Real Live Auctions Showcase Section */}
      {ongoingAuctions.length > 0 && (
        <section className="home-auctions-section" style={{ position: 'relative', overflow: 'hidden', background: '#0b1120' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <LightRays
              raysOrigin="top-left"
              raysColor="#34d399"
              raysSpeed={1.2}
              lightSpread={1.2}
              rayLength={2.0}
              pulsating
              followMouse
              mouseInfluence={0.12}
              noiseAmount={0.03}
              distortion={0.04}
              fadeDistance={1.8}
              saturation={1.0}
            />
          </div>
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="home-section-header">
              <div>
                <span className="live-pill-badge">
                  <span className="live-dot"></span>
                  {t('home.live_auction')}
                </span>
                <h2 className="section-title" style={{ marginTop: '8px', color: '#f1f5f9' }}><ShinyText text={t('home.live_auction_title')} speed={3} color="#f1f5f9" shineColor="#34d399" /></h2>
                <p className="section-subtitle" style={{ color: '#94a3b8' }}>{t('home.live_auction_subtitle')}</p>
              </div>
              <Link to="/auction" className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
                {t('home.view_all_auctions')}
              </Link>
            </div>

            <div className="home-auctions-grid">
              {ongoingAuctions.map((auction) => (
                <div
                  key={auction.auctionId}
                  className="home-auction-card glass-card"
                  onClick={() => navigate('/auction')}
                  style={{ cursor: 'pointer', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(12px)', borderColor: 'rgba(52, 211, 153, 0.12)' }}
                >
                  <div className="home-auction-img-wrap">
                    {auction.productImageUrl ? (
                      <img src={auction.productImageUrl} alt={auction.productName} className="home-auction-img" />
                    ) : (
                      <div className="home-auction-img-placeholder">⚡</div>
                    )}
                    <span className="home-auction-status-badge">
                      <span className="live-dot"></span> LIVE
                    </span>
                  </div>

                  <div className="home-auction-body">
                    <span className="home-auction-category" style={{ color: '#34d399' }}>{auction.categoryName || t('common.none')}</span>
                    <h3 className="home-auction-title" style={{ color: '#f1f5f9' }}>{auction.productName}</h3>

                    <div className="home-auction-price-box">
                      <div>
                        <span className="price-label" style={{ color: '#94a3b8' }}>{t('auction.current_bid')}</span>
                        <strong className="price-val" style={{ color: '#34d399' }}>{formatCurrency(auction.currentPrice)}</strong>
                      </div>
                      <div>
                        <span className="price-label" style={{ color: '#94a3b8' }}>{t('auction.bid_count')}</span>
                        <span className="bids-val" style={{ color: '#cbd5e1' }}>{auction.bidCount || 0} {t('home.bids_suffix')}</span>
                      </div>
                    </div>

                    <button
                      className="home-auction-bid-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/auction');
                      }}
                      style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>gavel</span>
                      {t('home.join_auction')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Auctions Section */}
      {upcomingAuctions.length > 0 && (
        <section className="home-auctions-section" style={{ position: 'relative', overflow: 'hidden', background: '#1a150a' }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <LightRays
              raysOrigin="top-right"
              raysColor="#fbbf24"
              raysSpeed={1.0}
              lightSpread={1.1}
              rayLength={1.8}
              pulsating
              followMouse
              mouseInfluence={0.1}
              noiseAmount={0.03}
              distortion={0.03}
              fadeDistance={1.6}
              saturation={1.0}
            />
          </div>
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="home-section-header">
              <div>
                <span className="live-pill-badge" style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>schedule</span>
                  {t('auction.status_upcoming')}
                </span>
                <h2 className="section-title" style={{ marginTop: '8px', color: '#fef3c7' }}><ShinyText text={t('home.upcoming_auction_title')} speed={3} color="#fef3c7" shineColor="#fbbf24" /></h2>
                <p className="section-subtitle" style={{ color: '#a3916a' }}>{t('home.upcoming_auction_subtitle')}</p>
              </div>
              <Link to="/auction" className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                {t('home.view_more_auctions')}
              </Link>
            </div>

            <div className="home-auctions-grid">
              {upcomingAuctions.map((auction) => (
                <div
                  key={auction.auctionId}
                  className="home-auction-card glass-card"
                  onClick={() => navigate('/auction')}
                  style={{ cursor: 'pointer', background: 'rgba(26, 21, 10, 0.75)', backdropFilter: 'blur(12px)', borderColor: 'rgba(251, 191, 36, 0.1)' }}
                >
                  <div className="home-auction-img-wrap">
                    {auction.productImageUrl ? (
                      <img src={auction.productImageUrl} alt={auction.productName} className="home-auction-img" />
                    ) : (
                      <div className="home-auction-img-placeholder">⏳</div>
                    )}
                    <span className="home-auction-status-badge" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}>
                      {t('home.upcoming_status')}
                    </span>
                  </div>

                  <div className="home-auction-body">
                    <span className="home-auction-category" style={{ color: '#fbbf24' }}>{auction.categoryName || t('common.none')}</span>
                    <h3 className="home-auction-title" style={{ color: '#fef3c7' }}>{auction.productName}</h3>

                    <div className="home-auction-price-box">
                      <div>
                        <span className="price-label" style={{ color: '#a3916a' }}>{t('auction.starting_price')}</span>
                        <strong className="price-val" style={{ color: '#fbbf24' }}>{formatCurrency(auction.startPrice || auction.currentPrice)}</strong>
                      </div>
                      <div>
                        <span className="price-label" style={{ color: '#a3916a' }}>{t('auction.min_step')}</span>
                        <span className="bids-val" style={{ color: '#d4c49a' }}>+{formatCurrency(auction.minIncrement)}</span>
                      </div>
                    </div>

                    <button
                      className="home-auction-bid-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/auction');
                      }}
                      style={{ background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>notifications_active</span>
                      {t('home.watch_auction')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Standard Buy-Now Products Section */}
      <section className="home-products-section">
        <div className="container">
          <div className="home-section-header">
            <div>
              <span className="live-pill-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>shopping_bag</span>
                {t('home.direct_sale_badge')}
              </span>
              <h2 className="section-title" style={{ marginTop: '8px' }}>
                <ShinyText text={isLoggedIn ? t('home.products_interested') : t('home.latest_products')} speed={3} color="#1f2937" shineColor="#9ca3af" />
              </h2>
              <p className="section-subtitle">{t('home.direct_sale_subtitle')}</p>
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

          {normalProducts.length > 0 ? (
            <HomeProductSlider>
              {normalProducts.map(p => (
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

          {/* Top Popular Products Showcase */}
          {topProducts.length > 0 && (
            <div style={{ marginTop: '50px' }}>
              <div className="home-section-header">
                <div>
                  <span className="live-pill-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                    {t('home.top_deals_badge')}
                  </span>
                  <h2 className="section-title" style={{ marginTop: '8px' }}><ShinyText text={t('home.top_deals_title')} speed={3} color="#1f2937" shineColor="#9ca3af" /></h2>
                  <p className="section-subtitle">{t('home.top_deals_subtitle')}</p>
                </div>
                <Link to="/product" className="home-view-all-link">
                  {t('common.view_all')} →
                </Link>
              </div>

              <HomeProductSlider>
                {topProducts.map(p => (
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
          )}

          {/* Random Discovery Section */}
          {randomProducts.length > 0 && (
            <div style={{ marginTop: '50px' }}>
              <div className="home-section-header">
                <div>
                  <span className="live-pill-badge" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', borderColor: 'rgba(236, 72, 153, 0.3)' }}>
                    {t('home.random_discovery_badge')}
                  </span>
                  <h2 className="section-title" style={{ marginTop: '8px' }}><ShinyText text={t('home.random_discovery_title')} speed={3} color="#1f2937" shineColor="#9ca3af" /></h2>
                  <p className="section-subtitle">{t('home.random_discovery_subtitle')}</p>
                </div>
                <Link to="/product" className="home-view-all-link">
                  {t('common.view_all')} →
                </Link>
              </div>

              <HomeProductSlider>
                {randomProducts.map(p => (
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
          )}
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
  const { user } = useAuth();

  const currentUserId = user?.userId || user?.id || user?.accountId || user?.sub;
  const pSellerId = product?.sellerId || product?.SellerId || product?.seller?.userId || product?.seller?.id;
  const isOwn = Boolean(currentUserId && pSellerId && String(currentUserId).toLowerCase() === String(pSellerId).toLowerCase());

  return (
    <div
      className={`home-product-card glass-card${isOutOfStock ? ' out-of-stock-card' : ''}`}
      onClick={() => navigate(`/product/${product.productId}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="home-product-img-wrap">
        {product.mainImageUrl ? (
          <img src={product.mainImageUrl} alt={product.name} className="home-product-img" />
        ) : (
          <div className="home-product-img-placeholder">🛍️</div>
        )}

        {isOutOfStock && (
          <span className="home-sold-out-badge">
            {t('product.out_of_stock')}
          </span>
        )}

        {!isOutOfStock && !isOwn && (
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
        {!isOutOfStock && !isOwn && product.price != null && (
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
        {product.condition && !isOutOfStock && (
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
