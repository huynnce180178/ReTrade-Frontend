import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link, useParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatFormattedNumber, parseRawNumber } from '../../../utils/numberUtils';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import '../../../styles/Product.css';

function timeAgo(dateStr, language = 'en') {
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

// Skeleton Card
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

export default function CategoryProductList() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();

  const CONDITIONS = [
    { value: 'New', label: t('product_list.cond_new') },
    { value: 'Like New', label: t('product_list.cond_likenew') },
    { value: 'Good', label: t('product_list.cond_good') },
    { value: 'Fair', label: t('product_list.cond_fair') },
  ];

  const SORT_OPTIONS = [
    { value: 'newest', label: t('product_list.sort_newest') },
    { value: 'oldest', label: t('product_list.sort_oldest') },
    { value: 'price_asc', label: t('product_list.sort_price_asc') },
    { value: 'price_desc', label: t('product_list.sort_price_desc') },
    { value: 'name_asc', label: t('product_list.sort_name_asc') },
    { value: 'name_desc', label: t('product_list.sort_name_desc') },
  ];

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states — sync from URL
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchTerm = searchParams.get('search') || '';
  const condition = searchParams.get('condition') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';

  // Local states for price inputs (debounced)
  const [minPriceInput, setMinPriceInput] = useState(minPriceParam);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceParam);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  // Category name for breadcrumb
  const [categoryName, setCategoryName] = useState('');

  // Sync price inputs when URL changes
  useEffect(() => {
    setMinPriceInput(minPriceParam);
    setMaxPriceInput(maxPriceParam);
  }, [minPriceParam, maxPriceParam]);

  // Fetch categories (once)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc&$top=100");
        const arr = Array.isArray(data) ? data : (data?.value || []);
        setCategories(arr);
      } catch {
        // Silently fail
      }
    };
    fetchCategories();
  }, []);

  // Resolve category name from ID
  useEffect(() => {
    if (categoryId && categories.length > 0) {
      const found = categories.find(c => c.categoryId === categoryId);
      setCategoryName(found?.name || '');
    } else {
      setCategoryName('');
    }
  }, [categoryId, categories]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      if (!categoryId) return;
      setLoading(true);
      try {
        const params = {
          Status: 'Accepted',
          Page: currentPage,
          PageSize: 6,
          CategoryId: categoryId
        };
        if (searchTerm) params.SearchTerm = searchTerm;
        if (condition) params.Condition = condition;
        if (minPriceParam) params.MinPrice = parseFloat(minPriceParam);
        if (maxPriceParam) params.MaxPrice = parseFloat(maxPriceParam);
        if (sortBy) params.SortBy = sortBy;

        const data = await productService.getAll(params);
        setProducts(data.items || []);
        setTotalItems(data.totalItems || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        showToast(t('product_list.failed_load'), 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [currentPage, searchTerm, categoryId, condition, sortBy, minPriceParam, maxPriceParam, showToast, t]);

  // Update URL search params helper
  const updateParams = useCallback((updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val) {
        newParams.set(key, val);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change (except when explicitly setting page)
    if (!updates.page) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // Price filter debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (minPriceInput !== minPriceParam || maxPriceInput !== maxPriceParam) {
        updateParams({ minPrice: minPriceInput, maxPrice: maxPriceInput });
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

  // Build hierarchical categories (only root + 1 level for filter sidebar)
  const rootCategories = categories.filter(c => !c.parentId);
  const getCategoryChildren = (parentId) => categories.filter(c => c.parentId === parentId);

  // Pagination renderer
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
      {/* Breadcrumb */}
      <div className="product-breadcrumb" style={{ marginBottom: '16px' }}>
        <Link to="/">{t('product_list.home')}</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to="/product">{t('product_list.products')}</Link>
        {categoryName && (
          <>
            <span className="breadcrumb-sep">›</span>
            <span>{categoryName}</span>
          </>
        )}
      </div>

      {/* Category Hero Banner */}
      <div className="category-hero-banner">
        <div className="category-hero-content">
          <span className="category-hero-badge">{t('product_list.category_badge')}</span>
          <h1>{categoryName || t('product_list.category_products')}</h1>
          <p>{t('product_list.category_subtitle')}</p>
        </div>
        <button className="mobile-filter-toggle" onClick={() => setShowMobileFilter(!showMobileFilter)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
          </svg>
          {t('product_list.filters')}
        </button>
      </div>

      <div className="product-layout">
        {/* Filter Sidebar */}
        <aside className={`filter-sidebar ${showMobileFilter ? 'show-mobile' : ''}`}>
          <div className="filter-sidebar-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
            </svg>
            {t('product_list.filters')}
          </div>

          {/* Category Filter */}
          <div className="filter-section">
            <div className="filter-section-title">{t('product_list.category')}</div>
            <div className="filter-category-list">
              <div
                className={`filter-category-item ${!categoryId ? 'active' : ''}`}
                onClick={() => navigate('/product')}
              >
                <span>{t('product_list.all_categories')}</span>
              </div>
              {rootCategories.map(cat => (
                <React.Fragment key={cat.categoryId}>
                  <div
                    className={`filter-category-item ${categoryId === cat.categoryId ? 'active' : ''}`}
                    onClick={() => navigate(`/category/${cat.categoryId}`)}
                  >
                    {cat.imageUrl && <img src={cat.imageUrl} alt={cat.name} className="filter-category-thumb" />}
                    <span>{cat.name}</span>
                  </div>
                  {getCategoryChildren(cat.categoryId).map(child => (
                    <div
                      key={child.categoryId}
                      className={`filter-category-item ${categoryId === child.categoryId ? 'active' : ''}`}
                      style={{ paddingLeft: '32px', fontSize: '12px' }}
                      onClick={() => navigate(`/category/${child.categoryId}`)}
                    >
                      {child.imageUrl && <img src={child.imageUrl} alt={child.name} className="filter-category-thumb" />}
                      <span>{child.name}</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="filter-section">
            <div className="filter-section-title">{t('product_list.price_range')}</div>
            <div className="price-range-inputs">
              <input
                type="text"
                inputMode="numeric"
                placeholder={t('product_list.min')}
                value={formatFormattedNumber(minPriceInput)}
                onChange={(e) => setMinPriceInput(parseRawNumber(e.target.value))}
              />
              <span className="price-range-sep">—</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={t('product_list.max')}
                value={formatFormattedNumber(maxPriceInput)}
                onChange={(e) => setMaxPriceInput(parseRawNumber(e.target.value))}
              />
            </div>
          </div>

          {/* Condition */}
          <div className="filter-section">
            <div className="filter-section-title">{t('product_list.condition')}</div>
            <div className="condition-chips">
              <button
                className={`condition-chip ${!condition ? 'active' : ''}`}
                onClick={() => updateParams({ condition: '' })}
              >
                {t('product_list.all')}
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

          {/* Reset */}
          {hasActiveFilters && (
            <button className="filter-reset-btn" onClick={handleResetFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {t('product_list.reset_filters')}
            </button>
          )}
        </aside>

        {/* Main Content */}
        <div className="product-main-content">
          {/* Active Search Display */}
          {searchTerm && (
            <div className="active-search-display">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {t('product_list.search_results_for')} <strong>"{searchTerm}"</strong>
              <button className="active-search-clear" onClick={handleClearSearch}>{t('product_list.clear')}</button>
            </div>
          )}

          {/* Toolbar: results count + sort */}
          <div className="product-toolbar">
            <div className="product-result-count">
              {loading ? t('product_list.loading') : (
                t('product_list.showing_count', { count: products.length, total: totalItems })
              )}
            </div>
            <div className="product-sort-wrapper">
              <span className="product-sort-label">{t('product_list.sort')}</span>
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

          {/* Product Grid */}
          {loading ? (
            <div className="product-grid">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="product-empty-state">
              <span className="material-symbols-outlined product-empty-icon-symbol" style={{ fontSize: '64px', color: 'var(--text-muted)', marginBottom: '16px' }}>search</span>
              <h3>{t('product_list.no_products_found')}</h3>
              <p>
                {searchTerm
                  ? t('product_list.no_products_search_match', { search: searchTerm })
                  : t('product_list.no_products_filter_match')}
              </p>
              {hasActiveFilters && (
                <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleResetFilters}>
                  {t('product_list.clear_all_filters')}
                </button>
              )}
            </div>
          ) : (
            <div className="product-grid">
              {products.map(product => (
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
                  </div>
                  <div className="product-card-body">
                    <span className="product-card-category">{product.categoryName || t('product_list.uncategorized')}</span>
                    <span className="product-card-name">{product.name}</span>
                    <span className="product-card-seller">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {product.sellerName || t('product_list.unknown_seller')}
                    </span>
                  </div>
                  <div className="product-card-footer">
                    {product.price != null ? (
                      <span className="product-card-price">{formatCurrency(product.price)}</span>
                    ) : (
                      <span className="product-card-price-no">{t('product_list.auction')}</span>
                    )}
                    <span className="product-card-date">{timeAgo(product.createdAt, language)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && renderPagination()}
        </div>
      </div>
    </div>
  );
}
