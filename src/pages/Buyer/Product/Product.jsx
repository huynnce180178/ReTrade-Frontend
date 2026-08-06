import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatFormattedNumber, parseRawNumber } from '../../../utils/numberUtils';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import wishlistService from '../../../services/wishlistService';
import { useAuth } from '../../../context/AuthContext';
import '../../../styles/Product.css';

function timeAgo(dateStr, language) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return language === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return language === 'vi' ? `${hrs} giờ trước` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return language === 'vi' ? `${days} ngày trước` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US');
}

function SkeletonCard() {
  return (
    <div className="product-card-skeleton">
      <div className="skeleton-image" />
      <div className="skeleton-body">
        <div className="skeleton-line short" />
        <div className="skeleton-line medium" />
        <div className="skeleton-line short" />
        <div className="skeleton-price" />
      </div>
    </div>
  );
}

const isProductUnavailable = (product) => (
  product?.status === 'SoldOut' ||
  product?.status === 'Sold' ||
  product?.status === 'Inactive' ||
  Number(product?.stockQuantity ?? 0) <= 0
);

export default function Product() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();

  const CONDITIONS = [
    { value: 'New', label: language === 'vi' ? 'Mới (100%)' : 'New (Sealed)' },
    { value: 'LikeNew', label: language === 'vi' ? 'Như mới (99%)' : 'Like New (99%)' },
    { value: 'Excellent', label: language === 'vi' ? 'Xuất sắc' : 'Excellent' },
    { value: 'Good', label: language === 'vi' ? 'Tốt' : 'Good' },
    { value: 'Fair', label: language === 'vi' ? 'Khá' : 'Fair' },
    { value: 'Used', label: language === 'vi' ? 'Đã sử dụng' : 'Used' },
    { value: 'Damaged', label: language === 'vi' ? 'Hỏng nhẹ' : 'Damaged' },
    { value: 'ForParts', label: language === 'vi' ? 'Lấy linh kiện' : 'For Parts' }
  ];

  const SORT_OPTIONS = [
    { value: 'newest', label: language === 'vi' ? 'Mới nhất' : 'Newest First' },
    { value: 'oldest', label: language === 'vi' ? 'Cũ nhất' : 'Oldest First' },
    { value: 'price_asc', label: language === 'vi' ? 'Giá: Thấp đến Cao' : 'Price: Low to High' },
    { value: 'price_desc', label: language === 'vi' ? 'Giá: Cao đến Thấp' : 'Price: High to Low' },
    { value: 'name_asc', label: language === 'vi' ? 'Tên: A → Z' : 'Name: A → Z' },
    { value: 'name_desc', label: language === 'vi' ? 'Tên: Z → A' : 'Name: Z → A' },
  ];

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [togglingId, setTogglingId] = useState(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchTerm = searchParams.get('search') || '';
  const condition = searchParams.get('condition') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';

  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  useEffect(() => {
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  useEffect(() => {
    categoryService.getAllActive("?$filter=Status eq 'Active'&$top=100")
      .then(res => {
        const arr = Array.isArray(res) ? res : (res?.value || []);
        setCategories(arr);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      wishlistService.getWishlist()
        .then(data => {
          const ids = new Set((data.items ?? []).map(i => i.productId));
          setWishlistIds(ids);
        })
        .catch(() => {});
    }
  }, [user]);

  const updateParams = useCallback((newParams) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) p.set(key, value);
        else p.delete(key);
      });
      if (!('page' in newParams)) p.set('page', '1');
      return p;
    });
  }, [setSearchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        Page: currentPage,
        PageSize: 6,
        SortBy: sortBy,
      };
      if (searchTerm) params.SearchTerm = searchTerm;
      if (condition) params.Condition = condition;
      if (minPriceParam) params.MinPrice = Number(minPriceParam);
      if (maxPriceParam) params.MaxPrice = Number(maxPriceParam);

      const data = await productService.getAll(params);
      const itemsList = Array.isArray(data) ? data : (data?.items || data?.value || []);
      const availableItems = itemsList.filter((item) => !isProductUnavailable(item));
      setProducts(availableItems);
      setTotalItems(data?.totalItems ?? availableItems.length);
      setTotalPages(data?.totalPages || Math.ceil((data?.totalItems ?? availableItems.length) / 6) || 1);
    } catch (err) {
      showToast(t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, condition, sortBy, minPriceParam, maxPriceParam, showToast, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (minPriceInput !== minPriceParam || maxPriceInput !== maxPriceParam) {
        updateParams({
          minPrice: minPriceInput || '',
          maxPrice: maxPriceInput || '',
        });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [minPriceInput, maxPriceInput, minPriceParam, maxPriceParam, updateParams]);

  const handlePageChange = (page) => {
    updateParams({ page: String(page) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearSearch = () => {
    updateParams({ search: '' });
  };

  const handleResetFilters = () => {
    setSearchParams({ page: '1' });
    setMinPriceInput('');
    setMaxPriceInput('');
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
    if (isProductUnavailable(product)) {
      showToast(language === 'vi' ? 'Sáº£n pháº©m Ä‘Ã£ háº¿t hÃ ng.' : 'This product is out of stock.', 'warning');
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
      const msg = err.response?.data || t('common.error_occurred');
      showToast(msg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const renderPagination = () => {
    if (products.length === 0) return null;
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return (
      <div className="pagination-container">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          ‹
        </button>

        {start > 1 && (
          <>
            <button type="button" className="pagination-btn" onClick={() => handlePageChange(1)}>1</button>
            {start > 2 && <span className="pagination-ellipsis">…</span>}
          </>
        )}

        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(num => (
          <button
            key={num}
            type="button"
            className={`pagination-btn ${num === currentPage ? 'active' : ''}`}
            onClick={() => handlePageChange(num)}
          >
            {num}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
            <button type="button" className="pagination-btn" onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
          </>
        )}

        <button
          type="button"
          className="pagination-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          ›
        </button>
      </div>
    );
  };

  const hasActiveFilters = condition || minPriceParam || maxPriceParam;

  return (
    <div className="product-page container animate-fade-in">
      <div className="product-page-top">
        <div className="product-breadcrumb">
          <Link to="/">{t('nav.home')}</Link>
          <span className="breadcrumb-sep">›</span>
          <span>{searchTerm ? `${t('common.search')} (${searchTerm})` : t('product.title')}</span>
        </div>
        
        <button className="mobile-filter-toggle" onClick={() => setShowMobileFilter(!showMobileFilter)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
          </svg>
          {t('common.filter')}
        </button>
      </div>

      <div className="product-layout">
          {showMobileFilter && (
            <div
              className="filter-mobile-backdrop"
              onClick={() => setShowMobileFilter(false)}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: 99,
              }}
            />
          )}

          <aside className={`filter-sidebar ${showMobileFilter ? 'show-mobile' : ''}`}>
            <div className="filter-sidebar-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
              </svg>
              {t('common.filter')}
            </div>

            <div className="filter-section">
              <div className="filter-section-title">{t('product.price_range')}</div>
              <div className="price-range-inputs">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t('product.min_price')}
                  value={formatFormattedNumber(minPriceInput)}
                  onChange={(e) => setMinPriceInput(parseRawNumber(e.target.value))}
                />
                <span className="price-range-sep">—</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t('product.max_price')}
                  value={formatFormattedNumber(maxPriceInput)}
                  onChange={(e) => setMaxPriceInput(parseRawNumber(e.target.value))}
                />
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-section-title">{t('product.condition')}</div>
              <div className="condition-chips">
                <button
                  className={`condition-chip ${!condition ? 'active' : ''}`}
                  onClick={() => updateParams({ condition: '' })}
                >
                  {t('common.all')}
                </button>
                {CONDITIONS.map(c => (
                  <button
                    key={c.value}
                    className={`condition-chip ${condition === c.value ? 'active' : ''}`}
                    onClick={() => updateParams({ condition: condition === c.value ? '' : c.value })}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button className="filter-reset-btn" onClick={handleResetFilters}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {t('common.reset')}
              </button>
            )}
          </aside>

          <div className="product-main-content">
            {searchTerm && (
              <div className="active-search-display">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--text-muted)', marginRight: '6px' }}>search</span>
                {t('common.search')}: <strong>"{searchTerm}"</strong>
                <button className="active-search-clear" onClick={handleClearSearch}>{t('common.reset')}</button>
              </div>
            )}

            <div className="product-toolbar">
              <div className="product-result-count">
                {loading ? t('common.loading') : (
                  <>{t('common.page')} <strong>{currentPage}</strong> {t('common.of')} <strong>{totalPages}</strong> ({totalItems} {t('nav.product')})</>
                )}
              </div>
              <div className="product-sort-wrapper">
                <span className="product-sort-label">{t('common.sort')}:</span>
                <select
                  className="product-sort-select"
                  value={sortBy}
                  onChange={(e) => updateParams({ sort: e.target.value })}
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="product-grid">
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="product-empty-state">
                <span className="material-symbols-outlined product-empty-icon-symbol" style={{ fontSize: '64px', color: 'var(--text-muted)', marginBottom: '16px' }}>search</span>
                <h3>{t('common.no_data')}</h3>
                <p>{t('home.latest_subtitle_user')}</p>
                {hasActiveFilters && (
                  <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleResetFilters}>
                    {t('common.reset')}
                  </button>
                )}
              </div>
            ) : (
              <div className="product-grid">
                {products.map(product => {
                  const currentUserId = user?.userId || user?.id || user?.accountId || user?.sub;
                  const pSellerId = product?.sellerId || product?.SellerId || product?.seller?.userId || product?.seller?.id;
                  const isOwn = Boolean(currentUserId && pSellerId && String(currentUserId).toLowerCase() === String(pSellerId).toLowerCase());

                  return (
                    <div
                      key={product.productId}
                      className="product-card"
                      onClick={() => navigate(`/product/${product.productId}`)}
                    >
                      <div className="product-card-image">
                        {product.mainImageUrl ? (
                          <img src={product.mainImageUrl} alt={product.name} loading="lazy" />
                        ) : (
                          <div className="product-card-image-placeholder">📦</div>
                        )}
                        {product.condition && (
                          <span className="product-card-condition">{product.condition}</span>
                        )}
                        {product.status !== 'SoldOut' && product.status !== 'Sold' && product.status !== 'Inactive' && product.stockQuantity > 0 && !isOwn && (
                          <>
                            <button
                              className={`product-wishlist-btn${wishlistIds.has(product.productId) ? ' active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleWishlist(product);
                              }}
                              disabled={togglingId === product.productId}
                              title={wishlistIds.has(product.productId) ? t('product.remove_from_wishlist') : t('product.add_to_wishlist')}
                            >
                              {togglingId === product.productId
                                ? <span className="product-wl-spinner" />
                                : <span
                                    className="material-symbols-outlined product-wishlist-heart"
                                    style={{ fontVariationSettings: wishlistIds.has(product.productId) ? "'FILL' 1" : "'FILL' 0" }}
                                  >
                                  favorite
                                 </span>
                              }
                            </button>
                            {product.price != null && (
                              <button
                                className="product-buy-now-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/checkout/${product.productId}`);
                                }}
                                title={t('product.buy_now')}
                              >
                                <span className="material-symbols-outlined">shopping_cart</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    <div className="product-card-body">
                      <span className="product-card-category">{product.categoryName || t('common.none')}</span>
                      <span className="product-card-name">{product.name}</span>
                      <span className="product-card-seller">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {product.sellerName || t('common.unknown_seller')}
                      </span>
                    </div>
                    <div className="product-card-footer">
                      {product.price != null ? (
                        <span className="product-card-price">{formatCurrency(product.price)}</span>
                      ) : (
                        <span className="product-card-price-no">{t('nav.auction')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            )}

          {!loading && renderPagination()}
        </div>
      </div>
    </div>
  );
}
