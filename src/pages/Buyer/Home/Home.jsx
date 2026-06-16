import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import productService from '../../../services/productService';
import wishlistService from '../../../services/wishlistService';
import categoryService from '../../../services/categoryService';
import userFavoriteService from '../../../services/userFavoriteService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import FavoriteCategoriesModal from '../../../components/FavoriteCategoriesModal/FavoriteCategoriesModal';
import '../../../styles/Home.css';

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export default function Home() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isLoggedIn = !!user;

  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [togglingId, setTogglingId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [favoriteProducts, setFavoriteProducts] = useState({});
  const [showFavModal, setShowFavModal] = useState(false);

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

  // Fetch favorites
  useEffect(() => {
    if (!isLoggedIn) {
      fetchProducts();
      return;
    }
    fetchFavorites();
  }, [isLoggedIn]);

  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const data = await userFavoriteService.getFavorites();
      const favs = Array.isArray(data) ? data : [];
      setFavorites(favs);
      if (favs.length === 0) {
        fetchProducts();
        
        // Show modal if no favorites
        if (user && user.userId) {
          setShowFavModal(true);
        }
      } else {
        // Fetch products for each favorite category
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
      fetchProducts();
    } finally {
      setLoadingFavorites(false);
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await productService.getAll({ status: 'Accepted', pageSize: 8 });
      setProducts(res.items ?? []);
    } catch {
      showToast('Failed to load products.', 'error');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const data = await wishlistService.getWishlist();
      const ids = new Set((data.items ?? []).map(i => i.productId));
      setWishlistIds(ids);
    } catch {
    }
  }, [user]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/product?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/product`);
    }
  };

  const handleTagClick = (tag) => {
    navigate(`/product?search=${encodeURIComponent(tag)}`);
  };

  const handleToggleWishlist = async (product) => {
    if (!user) {
      showToast('Please sign in to use the wishlist.', 'error');
      return;
    }
    if (product.sellerId === user.userId || product.sellerId === user.id) {
      showToast('You cannot add your own product to your wishlist.', 'error');
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
          showToast('Removed from wishlist.', 'success');
        }
      } else {
        await wishlistService.addToWishlist(product.productId);
        setWishlistIds(prev => new Set([...prev, product.productId]));
        showToast('Added to wishlist!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Something went wrong.';
      showToast(msg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="home-page animate-fade-in">
      <section className="hero-section">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>
        
        <div className="container hero-container">
          <div className="hero-content">
            <span className="hero-badge">✨ Next-Generation Trading Platform</span>
            <h1 className="hero-title">
              Trade Smarter.<br />
              Live <span className="gradient-primary-text">Sustainably.</span>
            </h1>
            <p className="hero-subtitle">
              Buy, sell, and host auctions for quality pre-loved goods. Fully secured, verified, and community-driven.
            </p>

            <form className="hero-search-form" onSubmit={handleSearchSubmit}>
              <div className="search-input-wrapper">
                <svg className="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  placeholder="Search products…"
                />
              </div>
              <button type="submit" className="btn btn-primary search-btn">
                Search
              </button>
            </form>

            <div className="hero-tags">
              <span className="tag-label">Popular:</span>
              <button className="tag-btn" onClick={() => handleTagClick('iPhone')}>iPhone</button>
              <button className="tag-btn" onClick={() => handleTagClick('Motorcycle')}>Motorcycle</button>
              <button className="tag-btn" onClick={() => handleTagClick('Camera')}>Camera</button>
              <button className="tag-btn" onClick={() => handleTagClick('Laptop')}>Laptop</button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card main-visual-card">
              <div className="card-header">
                <span className="card-badge">LIVE AUCTION</span>
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
                    <span className="price-label">Current Bid</span>
                    <p className="price-value">$2,450</p>
                  </div>
                  <button className="btn btn-primary bid-btn">Place Bid</button>
                </div>
              </div>
            </div>
            
            <div className="visual-card floating-card-1">
              <div className="float-badge">🚀 Fast Deal</div>
              <p>MacBook Pro M2 - $1,100</p>
            </div>
            <div className="visual-card floating-card-2">
              <div className="float-badge">⭐ Top Seller</div>
              <p>Alex Johnson (4.9★)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Category List */}
      {categories.length > 0 && (
        <section className="home-categories-section">
          <div className="container">
            <div className="home-categories-list">
              {categories.map(cat => (
                <Link to={`/category/${cat.categoryId}`} key={cat.categoryId} className="home-category-card">
                  <div className="home-category-icon">
                    {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} /> : <span>🏷️</span>}
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
            <p>Trading Volume</p>
          </div>
          <div className="stat-card glass-card">
            <h3>45,000+</h3>
            <p>Items Traded</p>
          </div>
          <div className="stat-card glass-card">
            <h3>12,000+</h3>
            <p>Verified Traders</p>
          </div>
          <div className="stat-card glass-card">
            <h3>99.4%</h3>
            <p>Success Rate</p>
          </div>
        </div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Latest <span className="gradient-primary-text">Products</span></h2>
            <p className="section-subtitle">Fresh listings from verified sellers — save the ones you love.</p>
          </div>

          {loadingProducts ? (
            <div className="home-products-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="home-product-skeleton" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="home-products-empty">
              <span>🛍️</span>
              <p>No approved products yet. Check back soon!</p>
            </div>
          ) : (
            <div className="home-products-grid">
              {products.map(product => (
                <HomeProductCard
                  key={product.productId}
                  product={product}
                  isWishlisted={wishlistIds.has(product.productId)}
                  toggling={togglingId === product.productId}
                  onToggleWishlist={handleToggleWishlist}
                />
              ))}
            </div>
          )}

          <div className="home-products-cta">
            <Link to="/product" className="btn btn-outline">View All Products →</Link>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose <span className="gradient-primary-text">ReTrade</span>?</h2>
            <p className="section-subtitle">We provide a premium, modern, and highly secure environment for both buyers and sellers.</p>
          </div>

          <div className="features-grid grid-3-col">
            <div className="feature-item glass-card">
              <div className="feature-icon">🛡️</div>
              <h3>Verified Members</h3>
              <p>All members require active email OTP confirmation and background checks to prevent spamming and fraud.</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Trading</h3>
              <p>Get in touch directly with sellers and buy items instantly or save them to your custom wishlist.</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">📈</div>
              <h3>Live Auctions</h3>
              <p>Put premium, high-value items up for bidding. Experience real-time price updates and dynamic competition.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass-panel">
            <h2>Ready to declutter or find amazing deals?</h2>
            <p>Create an account within minutes, confirm your email and start listing your products.</p>
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary">Create Account Now</Link>
              <Link to="/product" className="btn btn-secondary">Browse Products</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Favorite Categories Modal */}
      <FavoriteCategoriesModal
        isOpen={showFavModal}
        onClose={() => setShowFavModal(false)}
        currentFavorites={favorites}
        onUpdate={fetchFavorites}
      />
    </div>
  );
}

function HomeProductCard({ product, isWishlisted, toggling, onToggleWishlist }) {
  const isOutOfStock = product.status === 'SoldOut' || product.status === 'Sold' || product.status === 'Inactive' || product.stockQuantity <= 0;
  const navigate = useNavigate();

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
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {toggling
              ? <span className="home-wl-spinner" />
              : <span className="material-symbols-outlined home-wishlist-heart">
                  {isWishlisted ? 'favorite' : 'favorite'}
                </span>
            }
          </button>
        )}
        {product.condition && (
          <span className="home-product-condition">{product.condition}</span>
        )}
      </div>

      <div className="home-product-body">
        <p className="home-product-seller">{product.sellerName ?? 'Unknown Seller'}</p>
        <h3 className="home-product-name">{product.name}</h3>
        <div className="home-product-footer">
          <span className="home-product-price">
            {product.price != null
              ? `${Number(product.price).toLocaleString('vi-VN')} ₫`
              : 'Auction'}
          </span>
        </div>
      </div>
    </div>
  );
}
