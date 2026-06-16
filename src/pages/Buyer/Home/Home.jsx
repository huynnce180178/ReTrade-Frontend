import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import userFavoriteService from '../../../services/userFavoriteService';
import categoryService from '../../../services/categoryService';
import FavoriteCategoriesModal from '../../../components/FavoriteCategoriesModal/FavoriteCategoriesModal';
import '../../../styles/Home.css';

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isLoggedIn = !!user;

  // Favorites
  const [favorites, setFavorites] = useState([]);
  const [favoriteProducts, setFavoriteProducts] = useState({}); // { categoryId: products[] }
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [showFavModal, setShowFavModal] = useState(false);

  // Latest products (for non-logged-in or no favorites)
  const [latestProducts, setLatestProducts] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(false);

  // All root categories
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

  // Fetch favorites
  useEffect(() => {
    if (!isLoggedIn) {
      fetchLatestProducts();
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
        fetchLatestProducts();
        
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
      fetchLatestProducts();
    } finally {
      setLoadingFavorites(false);
    }
  };

  const fetchLatestProducts = async () => {
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
  };


  const handleTagClick = (tag) => {
    navigate(`/product?search=${encodeURIComponent(tag)}`);
  };

  const renderProductCard = (product) => (
    <div
      key={product.productId}
      className="home-product-card"
      onClick={() => navigate(`/product/${product.productId}`)}
    >
      <div className="home-product-img">
        {product.mainImageUrl ? (
          <img src={product.mainImageUrl} alt={product.name} loading="lazy" />
        ) : (
          <div className="home-product-img-placeholder">📦</div>
        )}
      </div>
      <div className="home-product-info">
        <span className="home-product-name">{product.name}</span>
        <span className="home-product-price">
          {product.price != null ? formatPrice(product.price) : 'Auction'}
        </span>
      </div>
    </div>
  );

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

      {/* Favorite Categories / Latest Products Section */}
      <section className="home-products-section">
        <div className="container">
          {isLoggedIn && favorites.length > 0 && (
            <>
              <div className="home-section-header">
                <div>
                  <h2 className="section-title">Your <span className="gradient-primary-text">Favorites</span></h2>
                  <p className="section-subtitle">Products from your favorite categories</p>
                </div>
                <button className="btn btn-outline" onClick={() => setShowFavModal(true)} style={{ fontSize: '13px', padding: '8px 16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Favorites
                </button>
              </div>
              {favorites.slice(0, 6).map(fav => {
                const products = favoriteProducts[fav.categoryId] || [];
                if (products.length === 0) return null;
                return (
                  <div key={fav.categoryId} className="home-category-section">
                    <div className="home-category-header">
                      <h3>{fav.categoryName || 'Category'}</h3>
                      <Link to={`/category/${fav.categoryId}`} className="home-view-all-link">
                        View All →
                      </Link>
                    </div>
                    <div className="home-product-scroll">
                      {products.map(p => renderProductCard(p))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Always show Latest Products / Random Products at the bottom */}
          <div style={{ marginTop: '60px' }}>
            <div className="home-section-header">
                <div>
                  <h2 className="section-title">
                    {isLoggedIn ? 'Products You Might Be ' : 'Latest '}
                    <span className="gradient-primary-text">
                      {isLoggedIn ? 'Interested In' : 'Products'}
                    </span>
                  </h2>
                  <p className="section-subtitle">
                    {isLoggedIn 
                      ? 'Recently listed items from our verified sellers based on your preferences' 
                      : 'Recently listed items from our verified sellers'}
                  </p>
                </div>
                {isLoggedIn && (
                  <button className="btn btn-outline" onClick={() => setShowFavModal(true)} style={{ fontSize: '13px', padding: '8px 16px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    Set Favorite Categories
                  </button>
                )}
                <Link to="/product" className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  Browse All →
                </Link>
              </div>
              {loadingLatest ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="product-loading-spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : latestProducts.length > 0 ? (
                <div className="home-product-scroll">
                  {latestProducts.map(p => renderProductCard(p))}
                </div>
              ) : null}
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
