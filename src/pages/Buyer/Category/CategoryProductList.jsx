import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link, useParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import categoryService from '../../../services/categoryService';
import '../../../styles/Product.css';

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A → Z' },
  { value: 'name_desc', label: 'Name: Z → A' },
];

function formatPrice(price) {
  if (price == null) return null;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
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
        const data = await categoryService.getAllActive("?$filter=Status eq 'Active'&$orderby=Name asc");
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
          PageSize: 12,
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
        showToast('Failed to load products.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [currentPage, searchTerm, categoryId, condition, sortBy, minPriceParam, maxPriceParam]);

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
  }, [minPriceInput, maxPriceInput]);

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
    if (totalPages <= 1) return null;
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    pages.push(
      <button key="prev" className="pagination-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>
        ‹ Prev
      </button>
    );

    if (start > 1) {
      pages.push(<button key={1} className="pagination-btn" onClick={() => handlePageChange(1)}>1</button>);
      if (start > 2) pages.push(<span key="e1" className="pagination-ellipsis">…</span>);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button key={i} className={`pagination-btn ${i === currentPage ? 'active' : ''}`} onClick={() => handlePageChange(i)}>
          {i}
        </button>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push(<span key="e2" className="pagination-ellipsis">…</span>);
      pages.push(<button key={totalPages} className="pagination-btn" onClick={() => handlePageChange(totalPages)}>{totalPages}</button>);
    }

    pages.push(
      <button key="next" className="pagination-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
        Next ›
      </button>
    );

    return <div className="pagination-container">{pages}</div>;
  };

  const hasActiveFilters = condition || minPriceParam || maxPriceParam;

  return (
    <div className="product-page container animate-fade-in">
      {/* Page Header */}
      <div className="product-page-header">
        <div className="product-page-header-left">
          <div className="product-breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">›</span>
            <Link to="/product">Products</Link>
            {categoryName && (
              <>
                <span className="breadcrumb-sep">›</span>
                <span>{categoryName}</span>
              </>
            )}
          </div>
          <h1>{categoryName || 'Category Products'}</h1>
          <p>Discover quality pre-owned goods in this category</p>
        </div>
        <button className="mobile-filter-toggle" onClick={() => setShowMobileFilter(!showMobileFilter)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
          </svg>
          Filters
        </button>
      </div>

      <div className="product-layout">
        {/* Filter Sidebar */}
        <aside className={`filter-sidebar ${showMobileFilter ? 'show-mobile' : ''}`}>
          <div className="filter-sidebar-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="16" y2="12" /><line x1="4" y1="18" x2="12" y2="18" />
            </svg>
            Filters
          </div>

          {/* Category Filter */}
          <div className="filter-section">
            <div className="filter-section-title">Category</div>
            <div className="filter-category-list">
              <div
                className={`filter-category-item`}
                onClick={() => navigate('/product')}
              >
                All Categories
              </div>
              {rootCategories.map(cat => (
                <React.Fragment key={cat.categoryId}>
                  <div
                    className={`filter-category-item ${categoryId === cat.categoryId ? 'active' : ''}`}
                    onClick={() => navigate(`/category/${cat.categoryId}`)}
                  >
                    {cat.imageUrl && <img src={cat.imageUrl} alt={cat.name} />}
                    {cat.name}
                  </div>
                  {getCategoryChildren(cat.categoryId).map(child => (
                    <div
                      key={child.categoryId}
                      className={`filter-category-item ${categoryId === child.categoryId ? 'active' : ''}`}
                      style={{ paddingLeft: '32px', fontSize: '12px' }}
                      onClick={() => navigate(`/category/${child.categoryId}`)}
                    >
                      {child.name}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="filter-section">
            <div className="filter-section-title">Price Range</div>
            <div className="price-range-inputs">
              <input
                type="number"
                placeholder="Min"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                min="0"
              />
              <span className="price-range-sep">—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                min="0"
              />
            </div>
          </div>

          {/* Condition */}
          <div className="filter-section">
            <div className="filter-section-title">Condition</div>
            <div className="condition-chips">
              <button
                className={`condition-chip ${!condition ? 'active' : ''}`}
                onClick={() => updateParams({ condition: '' })}
              >
                All
              </button>
              {CONDITIONS.map(c => (
                <button
                  key={c}
                  className={`condition-chip ${condition === c ? 'active' : ''}`}
                  onClick={() => updateParams({ condition: condition === c ? '' : c })}
                >
                  {c}
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
              Reset Filters
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
              Search results for: <strong>"{searchTerm}"</strong>
              <button className="active-search-clear" onClick={handleClearSearch}>Clear</button>
            </div>
          )}

          {/* Toolbar: results count + sort */}
          <div className="product-toolbar">
            <div className="product-result-count">
              {loading ? 'Loading...' : (
                <>Showing <strong>{products.length}</strong> of <strong>{totalItems}</strong> products</>
              )}
            </div>
            <div className="product-sort-wrapper">
              <span className="product-sort-label">Sort:</span>
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
              <span className="product-empty-icon">🔍</span>
              <h3>No Products Found</h3>
              <p>
                {searchTerm
                  ? `We couldn't find any products matching "${searchTerm}". Try different keywords or remove some filters.`
                  : 'No products match your current filters. Try adjusting your search criteria.'}
              </p>
              {hasActiveFilters && (
                <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleResetFilters}>
                  Clear All Filters
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
                    <span className="product-card-category">{product.categoryName || 'Uncategorized'}</span>
                    <span className="product-card-name">{product.name}</span>
                    <span className="product-card-seller">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {product.sellerName || 'Unknown Seller'}
                    </span>
                  </div>
                  <div className="product-card-footer">
                    {product.price != null ? (
                      <span className="product-card-price">{formatPrice(product.price)}</span>
                    ) : (
                      <span className="product-card-price-no">Auction</span>
                    )}
                    <span className="product-card-date">{timeAgo(product.createdAt)}</span>
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
