import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useOutletContext } from 'react-router-dom';
import reviewService from '../../../services/reviewService';
import reportService from '../../../services/reportService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import './ReviewList.css';

const PAGE_SIZE = 8;

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'end-ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'start-ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
}

function StarRating({ value = 0, compact = false }) {
  const rating = Number(value || 0);

  return (
    <div className={`seller-review-stars ${compact ? 'compact' : ''}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`material-symbols-outlined ${star <= rating ? 'filled' : ''}`}>
          star
        </span>
      ))}
    </div>
  );
}

StarRating.propTypes = {
  value: PropTypes.number,
  compact: PropTypes.bool,
};

function getBuyerInitials(name) {
  const cleanName = String(name || 'B').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return (parts[0] || 'B').slice(0, 2).toUpperCase();
}

export default function ReviewList() {
  const outlet = useOutletContext();
  const { user } = outlet || {};
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [summary, setSummary] = useState({
    totalReviews: 0,
    averageRating: 0,
    reportedReviews: 0,
    ratingStats: {},
  });

  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [previewReview, setPreviewReview] = useState(null);

  const reportReasons = useMemo(() => [
    t('reports.reason_spam'),
    t('reports.reason_prohibited'),
    t('reports.reason_fraud'),
    t('reports.reason_counterfeit'),
    t('reports.reason_harassment'),
    t('reports.reason_other'),
  ], [t]);

  const ratingFilterOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: '5', label: t('review_list.star_5') },
    { value: '4', label: t('review_list.star_4') },
    { value: '3', label: t('review_list.star_3') },
    { value: '2', label: t('review_list.star_2') },
    { value: '1', label: t('review_list.star_1') },
  ], [t]);

  const statusFilterOptions = useMemo(() => [
    { value: '', label: t('common.all') },
    { value: 'reported', label: t('review_list.status_reported') },
    { value: 'unreported', label: t('review_list.status_unreported') },
  ], [t]);

  const sortOptions = useMemo(() => [
    { value: 'newest', label: t('product.sort_newest') },
    { value: 'oldest', label: t('product.sort_oldest') },
    { value: 'highest_rating', label: t('product.sort_price_desc') },
    { value: 'lowest_rating', label: t('product.sort_price_asc') },
  ], [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchSummary = useCallback(async () => {
    if (!user?.userId) return;

    try {
      setSummaryLoading(true);
      const data = await reviewService.getSellerSummary(user.userId);
      setSummary({
        totalReviews: Number(data?.totalReviews || 0),
        averageRating: Number(data?.averageRating || 0),
        reportedReviews: Number(data?.reportedReviews || 0),
        ratingStats: data?.ratingStats || {},
      });
    } catch {
      // Quiet fail
    } finally {
      setSummaryLoading(false);
    }
  }, [user?.userId]);

  const fetchReviews = useCallback(async () => {
    if (!user?.userId) return;

    try {
      setLoading(true);
      const params = {
        sellerId: user.userId,
        pageNumber: page,
        pageSize: PAGE_SIZE,
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        reportStatus: statusFilter || undefined,
        sortBy: sortBy || 'newest',
        searchTerm: searchTerm || undefined,
      };

      let data;
      try {
        data = await reviewService.getSellerReviews(user.userId, params);
      } catch {
        data = await reviewService.getPublicSellerReviews(user.userId, params);
      }

      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setReviews(items);
      setTotalItems(data?.totalCount ?? items.length);
      setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil((data?.totalCount ?? items.length) / PAGE_SIZE)));
    } catch {
      setReviews([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, ratingFilter, searchTerm, sortBy, statusFilter, user?.userId]);

  useEffect(() => {
    if (user?.userId) {
      fetchSummary();
    }
  }, [fetchSummary, user?.userId]);

  useEffect(() => {
    if (user?.userId) {
      fetchReviews();
    }
  }, [fetchReviews, user?.userId]);

  const ratingStats = summary.ratingStats || {};

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const openReportModal = (review) => {
    setReportingReview(review);
    setReportReason(reportReasons[0]);
    setReportDescription('');
  };

  const closeReportModal = () => {
    if (reportSubmitting) return;
    setReportingReview(null);
    setReportReason('');
    setReportDescription('');
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    if (!reportingReview || !reportReason.trim()) {
      showToast(t('reports.select_reason'), 'warning');
      return;
    }

    try {
      setReportSubmitting(true);
      await reportService.create({
        targetId: reportingReview.reviewId,
        targetType: 'Review',
        reportType: 'ReviewViolation',
        reason: reportReason.trim(),
        description: reportDescription.trim() || reportReason.trim(),
      });

      showToast(t('reports.report_success'), 'success');
      closeReportModal();
      fetchSummary();
      fetchReviews();
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  const openPreviewModal = (review) => setPreviewReview(review);
  const closePreviewModal = () => setPreviewReview(null);

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const firstItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);

  if (!user) {
    return (
      <div className="seller-review-page">
        <div className="seller-dashboard-loading">
          <span className="btn-spinner"></span>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-review-page animate-fade-in">
      <header className="seller-review-header">
        <div className="seller-review-header-title">
          <span className="seller-review-badge">
            <span className="material-symbols-outlined">verified</span>
            {t('seller.reviews')}
          </span>
          <h1>{t('review_list.title')}</h1>
          <p>{t('review_list.subtitle')}</p>
        </div>
      </header>

      <section className="seller-review-summary-grid" aria-label="Review summary">
        <article className="seller-review-summary-card">
          <div className="summary-icon-wrapper primary">
            <span className="material-symbols-outlined">rate_review</span>
          </div>
          <div className="summary-content">
            <p>{t('review_list.total_reviews')}</p>
            <strong>{summaryLoading ? '...' : summary.totalReviews}</strong>
          </div>
        </article>

        <article className="seller-review-summary-card star-card">
          <div className="summary-icon-wrapper rating">
            <span className="material-symbols-outlined">star</span>
          </div>
          <div className="summary-content">
            <p>{t('review_list.average_rating')}</p>
            <div className="summary-rating-num">
              <strong>{summaryLoading ? '...' : summary.averageRating.toFixed(1)}</strong>
              <small>/ 5.0</small>
            </div>
          </div>
        </article>

        <article className={`seller-review-summary-card ${summary.reportedReviews > 0 ? 'warning' : ''}`}>
          <div className="summary-icon-wrapper flag">
            <span className="material-symbols-outlined">flag</span>
          </div>
          <div className="summary-content">
            <p>{t('review_list.reported_reviews')}</p>
            <strong>{summaryLoading ? '...' : summary.reportedReviews}</strong>
          </div>
        </article>
      </section>

      <section className="seller-review-rating-strip" aria-label="Rating distribution">
        <div className="rating-strip-header">
          <span className="material-symbols-outlined">bar_chart</span>
          <span>{t('seller_profile.reviews_count')}</span>
        </div>
        <div className="rating-strip-grid">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = Number(ratingStats[rating] ?? ratingStats[String(rating)] ?? 0);
            const width = summary.totalReviews ? Math.round((count / summary.totalReviews) * 100) : 0;
            const isSelected = ratingFilter === String(rating);

            return (
              <button
                type="button"
                className={`seller-review-rating-row ${isSelected ? 'active' : ''}`}
                key={rating}
                onClick={() => {
                  if (isSelected) {
                    setRatingFilter('');
                  } else {
                    setRatingFilter(String(rating));
                    setStatusFilter('');
                  }
                  setPage(1);
                }}
              >
                <span className="rating-num">{rating}</span>
                <span className="material-symbols-outlined star-icon">star</span>
                <div className="bar-track">
                  <i style={{ width: `${width}%` }}></i>
                </div>
                <strong className="rating-count">{count}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="seller-review-filter-bar">
        <div className="seller-review-pills">
          <button
            type="button"
            className={`pill-btn ${ratingFilter === '' && statusFilter === '' ? 'active' : ''}`}
            onClick={() => {
              setRatingFilter('');
              setStatusFilter('');
              setPage(1);
            }}
          >
            {t('common.all')} ({summary.totalReviews})
          </button>
          {[5, 4, 3, 2, 1].map((stars) => (
            <button
              type="button"
              key={stars}
              className={`pill-btn ${ratingFilter === String(stars) && statusFilter === '' ? 'active' : ''}`}
              onClick={() => {
                setRatingFilter(String(stars));
                setStatusFilter('');
                setPage(1);
              }}
            >
              {stars} ★
            </button>
          ))}
          <button
            type="button"
            className={`pill-btn warning-pill ${statusFilter === 'reported' ? 'active' : ''}`}
            onClick={() => {
              setStatusFilter(statusFilter === 'reported' ? '' : 'reported');
              setRatingFilter('');
              setPage(1);
            }}
          >
            <span className="material-symbols-outlined">flag</span>
            {t('review_list.status_reported')} ({summary.reportedReviews})
          </button>
        </div>

        <div className="seller-review-toolbar-right">
          <div className="seller-review-search">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('common.search_placeholder')}
            />
            {searchInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          <div className="seller-review-select-wrapper">
            <span className="material-symbols-outlined select-icon">sort</span>
            <select value={sortBy} onChange={handleFilterChange(setSortBy)} aria-label="Sort reviews">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="seller-review-results">
        <div className="seller-review-results-head">
          <span className="results-count">
            {t('common.showing')} <strong>{firstItem}-{lastItem}</strong> {t('common.of')} <strong>{totalItems}</strong> {t('seller.reviews')}
          </span>
          <span className="results-page-indicator">{t('common.page')} {page} / {totalPages}</span>
        </div>

        {loading ? (
          <div className="seller-review-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="seller-review-card skeleton" key={index}>
                <div className="skeleton-thumb"></div>
                <div className="skeleton-lines">
                  <div className="skeleton-line title"></div>
                  <div className="skeleton-line text"></div>
                  <div className="skeleton-line text short"></div>
                </div>
              </article>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="seller-review-empty">
            <div className="empty-icon-circle">
              <span className="material-symbols-outlined">rate_review</span>
            </div>
            <h2>{t('review_list.no_reviews_title')}</h2>
            <p>{t('review_list.no_reviews_desc')}</p>
            {(ratingFilter || statusFilter || searchTerm) && (
              <button
                type="button"
                className="reset-filters-btn"
                onClick={() => {
                  setRatingFilter('');
                  setStatusFilter('');
                  setSearchInput('');
                  setPage(1);
                }}
              >
                <span className="material-symbols-outlined">refresh</span>
                {t('common.all')}
              </button>
            )}
          </div>
        ) : (
          <div className="seller-review-list">
            {reviews.map((review) => (
              <article className="seller-review-card" key={review.reviewId}>
                <div className="seller-review-card-header">
                  <div className="seller-review-buyer-info">
                    <div className="seller-review-buyer-avatar">
                      {review.reviewerAvatarUrl ? (
                        <img src={review.reviewerAvatarUrl} alt={review.reviewerName || t('common.unknown_buyer')} loading="lazy" />
                      ) : (
                        getBuyerInitials(review.reviewerName)
                      )}
                    </div>
                    <div className="seller-review-buyer-details">
                      <div className="buyer-name-row">
                        <strong>{review.reviewerName || t('common.unknown_buyer')}</strong>
                        <span className="buyer-tag">{t('order_management.th_buyer')}</span>
                      </div>
                      <div className="buyer-sub-row">
                        {review.reviewerEmail && <small className="buyer-email">{review.reviewerEmail}</small>}
                        <span className="review-date">
                          <span className="material-symbols-outlined">calendar_today</span>
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="seller-review-card-badges">
                    <div className={`seller-review-report-badge ${review.reportCount ? 'reported' : ''}`}>
                      <span className="material-symbols-outlined">flag</span>
                      {review.reportCount ? `${review.reportCount} ${t('reports.report_button')}` : t('review_list.status_unreported')}
                    </div>
                  </div>
                </div>

                <div className="seller-review-card-body">
                  <div className="seller-review-rating-block">
                    <StarRating value={review.rating} />
                    <span className="rating-score-pill">{review.rating?.toFixed(1)} / 5.0</span>
                  </div>

                  {review.comment && (
                    <blockquote className="seller-review-comment">
                      &quot;{review.comment}&quot;
                    </blockquote>
                  )}

                  <div className="seller-review-product-box">
                    <button
                      type="button"
                      className="seller-review-product-media"
                      onClick={() => openPreviewModal(review)}
                      aria-label={`Preview ${review.productName || ''}`}
                    >
                      {review.productImageUrl ? (
                        <img src={review.productImageUrl} alt={review.productName || t('common.reviewed_product')} loading="lazy" />
                      ) : (
                        <span className="material-symbols-outlined">inventory_2</span>
                      )}
                    </button>
                    <div className="product-box-info">
                      <span className="product-label">{t('my_products.th_product')}</span>
                      <Link to={review.productId ? `/product/${review.productId}` : '#'} className="product-title">
                        {review.productName || t('nav.product')}
                      </Link>
                      <div className="product-order-meta">
                        {review.orderCode && (
                          <span className="order-code-chip">
                            <span className="material-symbols-outlined">receipt_long</span>
                            {review.orderCode}
                          </span>
                        )}
                        <small className="product-id">{review.productId || ''}</small>
                      </div>
                    </div>
                  </div>

                  {review.reportedByCurrentUser && (
                    <div className="seller-review-current-report">
                      <span className="material-symbols-outlined">task_alt</span>
                      <p>
                        {t('reports.report_success')}:{' '}
                        <strong>{review.currentUserReport?.reason || review.latestReportReason || t('reports.report_button')}</strong>.
                      </p>
                    </div>
                  )}
                </div>

                <div className="seller-review-card-actions">
                  <button
                    type="button"
                    className="seller-review-preview-btn"
                    onClick={() => openPreviewModal(review)}
                  >
                    <span className="material-symbols-outlined">visibility</span>
                    {t('common.view_detail')}
                  </button>

                  <button
                    type="button"
                    className={`seller-review-report-btn ${review.reportedByCurrentUser ? 'reported' : ''}`}
                    onClick={() => openReportModal(review)}
                  >
                    <span className="material-symbols-outlined">flag</span>
                    {review.reportedByCurrentUser ? t('reports.report_success') : t('reports.report_button')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="seller-review-pagination">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((curr) => Math.max(1, curr - 1))}
            >
              <span className="material-symbols-outlined">chevron_left</span>
              {t('common.previous')}
            </button>
            {paginationItems.map((item, index) => {
              if (typeof item === 'string') {
                return <span key={`${item}-${index}`} className="seller-review-pagination-ellipsis">...</span>;
              }

              return (
                <button
                  type="button"
                  key={item}
                  className={page === item ? 'active' : ''}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((curr) => Math.min(totalPages, curr + 1))}
            >
              {t('common.next')}
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        ) : null}
      </section>

      {/* Report Modal */}
      {reportingReview ? (
        <div className="seller-review-modal-backdrop animate-fade-in" onClick={closeReportModal}>
          <div className="seller-review-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="seller-review-modal-head">
              <h3>{t('reports.report_title')}</h3>
              <button type="button" onClick={closeReportModal} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <form onSubmit={handleReportSubmit} className="seller-review-modal-body">
              <div className="seller-review-modal-context">
                <strong>{reportingReview.productName || t('nav.product')}</strong>
                <p>&quot;{reportingReview.comment || t('common.no_data')}&quot;</p>
                <small>{t('order_management.th_buyer')}: {reportingReview.reviewerName || t('common.unknown_buyer')}</small>
              </div>

              <div className="seller-review-field">
                <label htmlFor="seller-report-reason">{t('reports.reason_label')} *</label>
                <select
                  id="seller-report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  required
                >
                  {reportReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div className="seller-review-field">
                <label htmlFor="seller-report-desc">{t('reports.desc_label')}</label>
                <textarea
                  id="seller-report-desc"
                  rows={4}
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  placeholder={t('reports.desc_placeholder')}
                />
              </div>

              <footer className="seller-review-modal-actions">
                <button type="button" className="secondary" onClick={closeReportModal} disabled={reportSubmitting}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="primary" disabled={reportSubmitting}>
                  {reportSubmitting ? t('common.submitting') : t('reports.submit_report')}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Preview Modal */}
      {previewReview ? (
        <div className="seller-review-modal-backdrop animate-fade-in" onClick={closePreviewModal}>
          <div className="seller-review-modal-card preview-mode" onClick={(event) => event.stopPropagation()}>
            <header className="seller-review-modal-head">
              <h3>{t('common.view_detail')}</h3>
              <button type="button" onClick={closePreviewModal} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-review-modal-body">
              {previewReview.productImageUrl ? (
                <img className="seller-review-preview-img" src={previewReview.productImageUrl} alt={previewReview.productName || t('nav.product')} />
              ) : null}
              <strong>{previewReview.productName || t('nav.product')}</strong>
              <StarRating value={previewReview.rating} />
              <p>&quot;{previewReview.comment || t('common.no_data')}&quot;</p>
              <footer className="seller-review-modal-actions">
                <button type="button" className="primary" onClick={closePreviewModal}>{t('common.close')}</button>
              </footer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
