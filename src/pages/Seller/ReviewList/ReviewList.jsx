import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { Link, useOutletContext } from 'react-router-dom';
import reviewService from '../../../services/reviewService';
import reportService from '../../../services/reportService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import SellerPagination from '../../../components/SellerPagination/SellerPagination';
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

function StarRating({ value = 0, compact = false }) {
  const rating = Number(value || 0);

  return (
    <div className={`seller-review-stars ${compact ? 'compact' : ''}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`material-symbols-outlined ${star <= rating ? 'filled' : 'empty'}`}>
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

  const reportReasons = useMemo(() => {
    const getLabel = (key, fallback) => {
      const val = t(key);
      return (!val || val === key) ? fallback : val;
    };
    return [
      getLabel('reports.reason_spam', 'Spam hoặc quảng cáo không phù hợp'),
      getLabel('reports.reason_prohibited', 'Ngôn từ thô tục, lăng mạ hoặc xúc phạm'),
      getLabel('reports.reason_fraud', 'Thông tin sai sự thật hoặc gian lận'),
      getLabel('reports.reason_counterfeit', 'Nghi ngờ hàng giả / hàng nhái'),
      getLabel('reports.reason_harassment', 'Quấy rối hoặc tiết lộ thông tin cá nhân'),
      getLabel('reports.reason_other', 'Lý do vi phạm khác'),
    ];
  }, [t]);

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
      let allReviews = [];
      try {
        const res = await reviewService.getSellerReviews(user.userId, { pageSize: 1000 });
        allReviews = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      } catch {
        const res = await reviewService.getPublicSellerReviews(user.userId, { pageSize: 1000 });
        allReviews = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      }

      if (allReviews.length > 0) {
        const activeReviews = allReviews.filter((r) => {
          const normStatus = (r?.latestReportStatus || '').toLowerCase();
          const isRemoved = Boolean(
            r?.isReportApproved ||
            r?.IsReportApproved ||
            r?.isRemoved ||
            r?.IsRemoved ||
            ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(normStatus) ||
            ['hidden', 'removed', 'deleted'].includes(r?.status?.toLowerCase())
          );
          return !isRemoved;
        });

        const reportedCount = allReviews.filter((r) => {
          const normStatus = (r?.latestReportStatus || '').toLowerCase();
          return Boolean(
            r?.reportCount > 0 ||
            r?.reportedByCurrentUser ||
            r?.latestReportReason ||
            ['accepted', 'approved', 'resolved', 'pending', 'acceptedreview'].includes(normStatus)
          );
        }).length;

        const totalActive = activeReviews.length;
        const sumRating = activeReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
        const avgRating = totalActive > 0 ? sumRating / totalActive : 0;

        const stats = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        activeReviews.forEach((r) => {
          const star = Math.round(Number(r.rating || 0));
          if (stats[star] !== undefined) {
            stats[star] += 1;
          }
        });

        setSummary({
          totalReviews: totalActive,
          averageRating: avgRating,
          reportedReviews: reportedCount,
          ratingStats: stats,
        });
      } else {
        const data = await reviewService.getSellerSummary(user.userId);
        setSummary({
          totalReviews: Number(data?.totalReviews || 0),
          averageRating: Number(data?.averageRating || 0),
          reportedReviews: Number(data?.reportedReviews || 0),
          ratingStats: data?.ratingStats || {},
        });
      }
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

  const forceCloseReportModal = () => {
    setReportingReview(null);
    setReportReason('');
    setReportDescription('');
  };

  const closeReportModal = () => {
    if (reportSubmitting) return;
    forceCloseReportModal();
  };

  const handleReportSubmit = async (event) => {
    event.preventDefault();
    if (!reportingReview || !reportReason.trim()) {
      showToast(t('reports.select_reason'), 'warning');
      return;
    }

    try {
      setReportSubmitting(true);
      await reportService.reportReview(reportingReview.reviewId, {
        reason: reportReason.trim(),
        description: reportDescription.trim() || reportReason.trim(),
      });

      showToast(t('reports.report_success'), 'success');
      forceCloseReportModal();
      fetchSummary();
      fetchReviews();
    } catch (error) {
      const rawMsg = String(error?.response?.data?.message || error?.response?.data || error?.message || '');
      const isAlreadyHandled = rawMsg.toLowerCase().includes('already') || rawMsg.toLowerCase().includes('hidden');
      
      const toastType = isAlreadyHandled ? 'info' : 'error';
      const displayMsg = isAlreadyHandled 
        ? t('reports.already_reported')
        : (rawMsg || t('common.error_occurred'));

      showToast(displayMsg, toastType);
      forceCloseReportModal();
      fetchSummary();
      fetchReviews();
    } finally {
      setReportSubmitting(false);
    }
  };

  const openPreviewModal = (review) => setPreviewReview(review);
  const closePreviewModal = () => setPreviewReview(null);

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
            {reviews.map((review) => {
              const normStatus = (review.latestReportStatus || '').toLowerCase();
              const isApprovedReport = Boolean(
                review.isReportApproved ||
                review.IsReportApproved ||
                ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(normStatus)
              );
              const isRejectedReport = Boolean(
                review.isReportRejected ||
                review.IsReportRejected ||
                ['rejected', 'declined', 'dismissed', 'refused'].includes(normStatus)
              );
              const isPendingReport = review.reportCount > 0 && !isApprovedReport && !isRejectedReport;

              return (
                <article className={`seller-review-card ${isApprovedReport ? 'report-approved' : ''}`} key={review.reviewId}>
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

                    <div className="seller-review-card-header-right">
                      {isApprovedReport ? (
                        <div className="seller-review-report-badge danger">
                          <span className="material-symbols-outlined">block</span>
                          {t('review_list.status_violated_removed')}
                        </div>
                      ) : isRejectedReport ? (
                        <div className="seller-review-report-badge rejected">
                          <span className="material-symbols-outlined">cancel</span>
                          {t('review_list.status_report_rejected')}
                        </div>
                      ) : isPendingReport ? (
                        <div className="seller-review-report-badge pending">
                          <span className="material-symbols-outlined">schedule</span>
                          {t('review_list.status_processing')} ({review.reportCount})
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="card-top-icon-btn preview"
                        title={t('common.view_detail')}
                        onClick={() => openPreviewModal(review)}
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </button>

                      {!isApprovedReport && (
                        <button
                          type="button"
                          className={`card-top-icon-btn report ${review.reportedByCurrentUser ? 'reported' : ''}`}
                          title={review.reportedByCurrentUser ? t('reports.report_success') : t('reports.report_button')}
                          onClick={() => openReportModal(review)}
                        >
                          <span className="material-symbols-outlined">flag</span>
                        </button>
                      )}
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
                        className={`seller-review-product-media ${isApprovedReport ? 'blurred-media' : ''}`}
                        onClick={() => openPreviewModal(review)}
                        aria-label={`Preview ${review.productName || ''}`}
                      >
                        {review.productImageUrl ? (
                          <img src={review.productImageUrl} alt={review.productName || t('common.reviewed_product')} loading="lazy" />
                        ) : (
                          <span className="material-symbols-outlined">inventory_2</span>
                        )}
                        {isApprovedReport && (
                          <span className="media-removed-overlay">
                            {t('review_list.removed_tag')}
                          </span>
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
                      <div className={`seller-review-current-report ${isApprovedReport ? 'approved' : isRejectedReport ? 'rejected' : ''}`}>
                        <span className="material-symbols-outlined">{isApprovedReport ? 'check_circle' : isRejectedReport ? 'cancel' : 'task_alt'}</span>
                        <p>
                          {isApprovedReport
                            ? t('review_list.report_approved_notice')
                            : isRejectedReport
                            ? t('review_list.report_rejected_notice')
                            : t('reports.report_success')}:{' '}
                          <strong>{review.currentUserReport?.reason || review.latestReportReason || t('reports.report_button')}</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <SellerPagination
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          disabled={loading}
          onPageChange={setPage}
        />
      </section>

      {/* Report Modal */}
      {reportingReview ? createPortal(
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
        </div>,
        document.body
      ) : null}

      {/* Preview Detail Modal */}
      {previewReview ? (() => {
        const isApprovedReportModal = Boolean(
          previewReview.isReportApproved ||
          previewReview.IsReportApproved ||
          ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(previewReview.latestReportStatus?.toLowerCase())
        );

        return createPortal(
          <div className="seller-review-modal-backdrop animate-fade-in" onClick={closePreviewModal}>
            <div className="seller-review-modal-card detail-modal" onClick={(event) => event.stopPropagation()}>
              <header className="seller-review-modal-head">
                <div className="modal-title-group">
                  <span className="material-symbols-outlined">rate_review</span>
                  <h3>{t('common.view_detail')}</h3>
                </div>
                <button type="button" onClick={closePreviewModal} aria-label="Close" className="modal-close-btn">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              <div className="seller-review-modal-body detail-modal-body">
                {isApprovedReportModal && (
                  <div className="modal-alert-banner danger">
                    <span className="material-symbols-outlined">block</span>
                    <div>
                      <strong>{t('review_list.violation_modal_title')}</strong>
                      <p>{t('review_list.violation_modal_desc')}</p>
                    </div>
                  </div>
                )}

                <div className="modal-buyer-section">
                  <div className="modal-buyer-avatar">
                    {previewReview.reviewerAvatarUrl ? (
                      <img src={previewReview.reviewerAvatarUrl} alt={previewReview.reviewerName || t('common.unknown_buyer')} />
                    ) : (
                      getBuyerInitials(previewReview.reviewerName)
                    )}
                  </div>
                  <div className="modal-buyer-info">
                    <strong>{previewReview.reviewerName || t('common.unknown_buyer')}</strong>
                    <small>{previewReview.reviewerEmail || ''}</small>
                    <span className="modal-review-date">
                      <span className="material-symbols-outlined">calendar_today</span>
                      {formatDate(previewReview.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="modal-rating-section">
                  <StarRating value={previewReview.rating} />
                  <span className="modal-rating-score">{previewReview.rating?.toFixed(1)} / 5.0</span>
                </div>

                <blockquote className="modal-comment-box">
                  &quot;{previewReview.comment || t('common.no_data')}&quot;
                </blockquote>

                <div className="modal-product-card">
                  <div className={`modal-product-image ${isApprovedReportModal ? 'blurred-media' : ''}`}>
                    {previewReview.productImageUrl ? (
                      <img src={previewReview.productImageUrl} alt={previewReview.productName || t('nav.product')} />
                    ) : (
                      <span className="material-symbols-outlined">inventory_2</span>
                    )}
                    {isApprovedReportModal && (
                      <span className="media-removed-overlay">
                        {t('review_list.removed_tag')}
                      </span>
                    )}
                  </div>
                  <div className="modal-product-details">
                    <span className="product-label">{t('my_products.th_product')}</span>
                    <strong className="product-title">{previewReview.productName || t('nav.product')}</strong>
                    {previewReview.orderCode && (
                      <span className="order-code-chip">
                        <span className="material-symbols-outlined">receipt_long</span>
                        {t('seller.orders_management')}: {previewReview.orderCode}
                      </span>
                    )}
                    <small className="product-id">ID: {previewReview.productId || previewReview.reviewId}</small>
                  </div>
                </div>

                {previewReview.latestReportReason && (
                  <div className="modal-report-history">
                    <span className="material-symbols-outlined">flag</span>
                    <div>
                      <strong>{t('reports.reason')}:</strong> {previewReview.latestReportReason}
                      {previewReview.latestReportStatus && (
                        <span className={`report-status-tag ${previewReview.latestReportStatus.toLowerCase()}`}>
                          {t('common.status')}: {previewReview.latestReportStatus}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <footer className="seller-review-modal-actions">
                  <button type="button" className="secondary-btn" onClick={closePreviewModal}>
                    {t('common.close')}
                  </button>
                </footer>
              </div>
            </div>
          </div>,
          document.body
        );
      })() : null}
    </div>
  );
}
