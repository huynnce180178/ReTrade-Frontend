import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import reviewService from '../../../services/reviewService';
import reportService from '../../../services/reportService';
import { useToast } from '../../../context/ToastContext';
import './ReviewList.css';

const PAGE_SIZE = 8;

const RATING_FILTERS = [
  { value: '', label: 'All ratings' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All reviews' },
  { value: 'Unreported', label: 'Unreported' },
  { value: 'Reported', label: 'Reported' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'rating_desc', label: 'Highest rating' },
  { value: 'rating_asc', label: 'Lowest rating' },
  { value: 'reported', label: 'Most reported' },
];

const REPORT_REASONS = [
  'False Information',
  'Inappropriate Content',
  'Spam',
  'Harassment',
  'Misleading',
  'Other',
];

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

function StarRating({ value, compact = false }) {
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

function getBuyerInitials(name) {
  const cleanName = String(name || 'Buyer').trim();
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
  const [previewReview, setPreviewReview] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo(() => {
    const params = {
      Page: page,
      PageSize: PAGE_SIZE,
      SortBy: sortBy,
    };

    if (ratingFilter) params.Rating = Number(ratingFilter);
    if (statusFilter) params.Status = statusFilter;
    if (searchTerm) params.SearchTerm = searchTerm;

    return params;
  }, [page, ratingFilter, searchTerm, sortBy, statusFilter]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reviewService.getSellerReviews(queryParams);
      setReviews(data?.items || []);
      setTotalItems(Number(data?.totalItems || 0));
      setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
    } catch (error) {
      setReviews([]);
      setTotalItems(0);
      setTotalPages(1);
      showToast(error?.response?.data || 'Failed to load reviews.', 'error');
    } finally {
      setLoading(false);
    }
  }, [queryParams, showToast]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await reviewService.getSellerSummary({});
      setSummary({
        totalReviews: Number(data?.totalReviews || 0),
        averageRating: Number(data?.averageRating || 0),
        reportedReviews: Number(data?.reportedReviews || 0),
        ratingStats: data?.ratingStats || {},
      });
    } catch {
      setSummary({
        totalReviews: 0,
        averageRating: 0,
        reportedReviews: 0,
        ratingStats: {},
      });
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const paginationItems = useMemo(() => getPaginationItems(page, totalPages), [page, totalPages]);
  const firstItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);
  const ratingStats = summary.ratingStats || {};

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const openReportModal = (review) => {
    setReportingReview(review);
    setReportReason('');
    setReportDescription('');
  };

  const openPreviewModal = (review) => {
    setPreviewReview(review);
  };

  const closePreviewModal = () => {
    setPreviewReview(null);
  };

  const closeReportModal = () => {
    setReportingReview(null);
    setReportReason('');
    setReportDescription('');
    setReportSubmitting(false);
  };

  const submitReport = async (event) => {
    event.preventDefault();

    if (!reportingReview || !reportReason.trim()) {
      showToast('Please select a report reason.', 'error');
      return;
    }

    setReportSubmitting(true);
    try {
      await reportService.reportReview(reportingReview.reviewId, {
        reason: reportReason.trim(),
        description: reportDescription.trim() || null,
      });
      showToast('Review report submitted.', 'success');
      closeReportModal();
      fetchReviews();
      fetchSummary();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to report this review.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="seller-review-page">
        <div className="seller-review-state">
          <span className="btn-spinner"></span>
          <p>Loading seller account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-review-page animate-fade-in">
      <header className="seller-review-header">
        <div>
          <span>Review Management</span>
          <h1>View Reviews</h1>
          <p>Track buyer feedback, inspect review context, and report reviews that need admin review.</p>
        </div>
      </header>

      <section className="seller-review-summary-grid" aria-label="Review summary">
        <article className="seller-review-summary-card">
          <span className="material-symbols-outlined">reviews</span>
          <div>
            <p>Total Reviews</p>
            <strong>{summaryLoading ? '-' : summary.totalReviews}</strong>
          </div>
        </article>
        <article className="seller-review-summary-card">
          <span className="material-symbols-outlined">star</span>
          <div>
            <p>Average Rating</p>
            <strong>{summaryLoading ? '-' : summary.averageRating.toFixed(1)}</strong>
          </div>
        </article>
        <article className="seller-review-summary-card warning">
          <span className="material-symbols-outlined">flag</span>
          <div>
            <p>Reported Reviews</p>
            <strong>{summaryLoading ? '-' : summary.reportedReviews}</strong>
          </div>
        </article>
      </section>

      <section className="seller-review-rating-strip" aria-label="Rating distribution">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = Number(ratingStats[rating] ?? ratingStats[String(rating)] ?? 0);
          const width = summary.totalReviews ? Math.round((count / summary.totalReviews) * 100) : 0;

          return (
            <div className="seller-review-rating-row" key={rating}>
              <span>{rating}</span>
              <span className="material-symbols-outlined">star</span>
              <div>
                <i style={{ width: `${width}%` }}></i>
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </section>

      <section className="seller-review-toolbar">
        <div className="seller-review-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search reviewer, order, product, or comment"
          />
        </div>

        <select value={ratingFilter} onChange={handleFilterChange(setRatingFilter)} aria-label="Filter by rating">
          {RATING_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={handleFilterChange(setStatusFilter)} aria-label="Filter by report status">
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={sortBy} onChange={handleFilterChange(setSortBy)} aria-label="Sort reviews">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      <section className="seller-review-results">
        <div className="seller-review-results-head">
          <span>
            Showing <strong>{firstItem}-{lastItem}</strong> of <strong>{totalItems}</strong> reviews
          </span>
          <span>Page {page} of {totalPages}</span>
        </div>

        {loading ? (
          <div className="seller-review-list">
            {Array.from({ length: 4 }).map((_, index) => (
              <article className="seller-review-card skeleton" key={index}>
                <span></span>
                <div></div>
              </article>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="seller-review-empty">
            <span className="material-symbols-outlined">rate_review</span>
            <h2>No reviews found</h2>
            <p>No buyer reviews match the current search or filters.</p>
          </div>
        ) : (
          <div className="seller-review-list">
            {reviews.map((review) => (
              <article className="seller-review-card" key={review.reviewId}>
                <div className="seller-review-product">
                  <button
                    type="button"
                    className="seller-review-product-media"
                    onClick={() => openPreviewModal(review)}
                    aria-label={`Preview ${review.productName || 'reviewed product'}`}
                  >
                    {review.productImageUrl ? (
                      <img src={review.productImageUrl} alt={review.productName || 'Reviewed product'} loading="lazy" />
                    ) : (
                      <span className="material-symbols-outlined">inventory_2</span>
                    )}
                  </button>
                  <div>
                    <span>Product</span>
                    <Link to={review.productId ? `/product/${review.productId}` : '#'}>{review.productName || 'Unknown product'}</Link>
                    <small>{review.productId || 'No product id'}</small>
                  </div>
                </div>

                <div className="seller-review-content">
                  <div className="seller-review-buyer-strip">
                    <div className="seller-review-buyer-avatar">
                      {review.reviewerAvatarUrl ? (
                        <img src={review.reviewerAvatarUrl} alt={review.reviewerName || 'Buyer'} loading="lazy" />
                      ) : (
                        getBuyerInitials(review.reviewerName)
                      )}
                    </div>
                    <div>
                      <span>Buyer</span>
                      <strong>{review.reviewerName || 'Unknown buyer'}</strong>
                      <small>{review.reviewerEmail || 'No email available'}</small>
                    </div>
                  </div>

                  <div className="seller-review-card-top">
                    <div>
                      <StarRating value={review.rating} />
                      <p>{review.comment || 'No written comment.'}</p>
                    </div>
                    <div className={`seller-review-report-badge ${review.reportCount ? 'reported' : ''}`}>
                      <span className="material-symbols-outlined">flag</span>
                      {review.reportCount ? `${review.reportCount} report${review.reportCount > 1 ? 's' : ''}` : 'No report'}
                    </div>
                  </div>

                  <dl className="seller-review-meta-grid">
                    <div>
                      <dt>Review ID</dt>
                      <dd>{review.reviewId}</dd>
                    </div>
                    <div>
                      <dt>Target Type</dt>
                      <dd>{review.targetType || 'Review'}</dd>
                    </div>
                    <div>
                      <dt>Order</dt>
                      <dd>{review.orderCode || review.orderId || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt>Reviewer</dt>
                      <dd>{review.reviewerName || 'Unknown buyer'}</dd>
                    </div>
                    <div>
                      <dt>Created At</dt>
                      <dd>{formatDate(review.createdAt)}</dd>
                    </div>
                  </dl>

                  {review.reportedByCurrentUser ? (
                    <div className="seller-review-current-report">
                      <span className="material-symbols-outlined">task_alt</span>
                      <p>
                        You reported this review for <strong>{review.currentUserReport?.reason || review.latestReportReason || 'policy review'}</strong>.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="seller-review-actions">
                  <button
                    type="button"
                    className="seller-review-report-btn"
                    onClick={() => openReportModal(review)}
                    disabled={review.reportedByCurrentUser}
                  >
                    <span className="material-symbols-outlined">outlined_flag</span>
                    {review.reportedByCurrentUser ? 'Reported' : 'Report'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <nav className="seller-review-pagination" aria-label="Review pagination">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <span className="material-symbols-outlined">chevron_left</span>
              Prev
            </button>
            {paginationItems.map((item, index) => (
              item === 'start-ellipsis' || item === 'end-ellipsis' ? (
                <span key={`${item}-${index}`} className="seller-review-pagination-ellipsis">...</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={page === item ? 'active' : ''}
                  onClick={() => setPage(item)}
                  aria-current={page === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            ))}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </nav>
        )}
      </section>

      {reportingReview && (
        <div className="seller-review-modal-backdrop" role="presentation">
          <section className="seller-review-modal" role="dialog" aria-modal="true" aria-labelledby="seller-review-report-title">
            <header>
              <div>
                <span>Report Target</span>
                <h2 id="seller-review-report-title">Report Review</h2>
              </div>
              <button type="button" onClick={closeReportModal} aria-label="Close report modal">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-review-modal-target">
              <dl>
                <div>
                  <dt>Target Type</dt>
                  <dd>{reportingReview.targetType || 'Review'}</dd>
                </div>
                <div>
                  <dt>Target ID</dt>
                  <dd>{reportingReview.reviewId}</dd>
                </div>
                <div>
                  <dt>Order</dt>
                  <dd>{reportingReview.orderCode || reportingReview.orderId || 'N/A'}</dd>
                </div>
                <div>
                  <dt>Reviewer</dt>
                  <dd>{reportingReview.reviewerName || 'Unknown buyer'}</dd>
                </div>
              </dl>
              <div>
                <StarRating value={reportingReview.rating} compact />
                <p>{reportingReview.comment || 'No written comment.'}</p>
              </div>
            </div>

            <form onSubmit={submitReport}>
              <label>
                Reason
                <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
                  <option value="">Select a reason</option>
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </label>

              <label>
                Description
                <textarea
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value.slice(0, 500))}
                  rows="4"
                  placeholder="Add context for the admin team"
                />
                <span>{reportDescription.length}/500</span>
              </label>

              <footer>
                <button type="button" onClick={closeReportModal} disabled={reportSubmitting}>
                  Cancel
                </button>
                <button type="submit" disabled={reportSubmitting || !reportReason.trim()}>
                  {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {previewReview && (
        <div className="seller-review-modal-backdrop" role="presentation" onMouseDown={closePreviewModal}>
          <section
            className="seller-review-modal seller-review-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-review-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Review Preview</span>
                <h2 id="seller-review-preview-title">{previewReview.productName || 'Reviewed Product'}</h2>
              </div>
              <button type="button" onClick={closePreviewModal} aria-label="Close review preview">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-review-detail-media">
              {previewReview.productImageUrl ? (
                <img src={previewReview.productImageUrl} alt={previewReview.productName || 'Reviewed product'} />
              ) : (
                <span className="material-symbols-outlined">inventory_2</span>
              )}
            </div>

            <div className="seller-review-detail-body">
              <div className="seller-review-detail-buyer">
                <div className="seller-review-buyer-avatar">
                  {previewReview.reviewerAvatarUrl ? (
                    <img src={previewReview.reviewerAvatarUrl} alt={previewReview.reviewerName || 'Buyer'} />
                  ) : (
                    getBuyerInitials(previewReview.reviewerName)
                  )}
                </div>
                <div>
                  <span>Buyer</span>
                  <strong>{previewReview.reviewerName || 'Unknown buyer'}</strong>
                  <small>{previewReview.orderCode || previewReview.orderId || 'N/A'}</small>
                </div>
              </div>
              <StarRating value={previewReview.rating} />
              <p>{previewReview.comment || 'No written comment.'}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
