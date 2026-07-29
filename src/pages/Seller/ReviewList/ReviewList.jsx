import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

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

  const ratingFilterOptions = useMemo(() => [
    { value: '', label: isVi ? 'Tất cả đánh giá' : 'All ratings' },
    { value: '5', label: '5 sao' },
    { value: '4', label: '4 sao' },
    { value: '3', label: '3 sao' },
    { value: '2', label: '2 sao' },
    { value: '1', label: '1 sao' },
  ], [isVi]);

  const statusFilterOptions = useMemo(() => [
    { value: '', label: isVi ? 'Tất cả trạng thái' : 'All reviews' },
    { value: 'Unreported', label: isVi ? 'Chưa báo cáo' : 'Unreported' },
    { value: 'Reported', label: isVi ? 'Đã báo cáo' : 'Reported' },
  ], [isVi]);

  const sortOptions = useMemo(() => [
    { value: 'newest', label: isVi ? 'Mới nhất' : 'Newest first' },
    { value: 'oldest', label: isVi ? 'Cũ nhất' : 'Oldest first' },
    { value: 'rating_desc', label: isVi ? 'Điểm đánh giá cao nhất' : 'Highest rating' },
    { value: 'rating_asc', label: isVi ? 'Điểm đánh giá thấp nhất' : 'Lowest rating' },
    { value: 'reported', label: isVi ? 'Báo cáo nhiều nhất' : 'Most reported' },
  ], [isVi]);

  const reportReasons = useMemo(() => [
    isVi ? 'Thông tin sai sự thật' : 'False Information',
    isVi ? 'Nội dung không phù hợp' : 'Inappropriate Content',
    isVi ? 'Spam / Rác' : 'Spam',
    isVi ? 'Quấy rối / Độc hại' : 'Harassment',
    isVi ? 'Gây hiểu lầm' : 'Misleading',
    isVi ? 'Khác' : 'Other',
  ], [isVi]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchSummary = useCallback(async () => {
    if (!user?.userId) return;

    try {
      setSummaryLoading(true);
      let data;
      try {
        data = await reviewService.getSellerSummary(user.userId);
      } catch {
        data = await reviewService.getPublicSellerSummary(user.userId);
      }
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
    } catch (error) {
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
      showToast(isVi ? 'Vui lòng chọn lý do báo cáo.' : 'Please select a report reason.', 'warning');
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

      showToast(isVi ? 'Đã gửi báo cáo đánh giá thành công!' : 'Review reported successfully.', 'success');
      closeReportModal();
      fetchSummary();
      fetchReviews();
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể gửi báo cáo đánh giá.' : 'Failed to report review.'), 'error');
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
          <p>{isVi ? 'Đang tải tài khoản...' : 'Loading seller account...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-review-page animate-fade-in">
      <header className="seller-review-header">
        <div>
          <span>{isVi ? 'Quản Lý Đánh Giá' : 'Review Management'}</span>
          <h1>{isVi ? 'Đánh Giá Từ Người Mua' : 'View Reviews'}</h1>
          <p>{isVi ? 'Theo dõi phản hồi từ khách hàng, kiểm tra nội dung và báo cáo các đánh giá vi phạm quy chuẩn.' : 'Track buyer feedback, inspect review context, and report reviews that need admin review.'}</p>
        </div>
      </header>

      <section className="seller-review-summary-grid" aria-label="Review summary">
        <article className="seller-review-summary-card">
          <span className="material-symbols-outlined">reviews</span>
          <div>
            <p>{isVi ? 'Tổng Số Đánh Giá' : 'Total Reviews'}</p>
            <strong>{summaryLoading ? '-' : summary.totalReviews}</strong>
          </div>
        </article>
        <article className="seller-review-summary-card">
          <span className="material-symbols-outlined">star</span>
          <div>
            <p>{isVi ? 'Điểm Trung Bình' : 'Average Rating'}</p>
            <strong>{summaryLoading ? '-' : summary.averageRating.toFixed(1)}</strong>
          </div>
        </article>
        <article className="seller-review-summary-card warning">
          <span className="material-symbols-outlined">flag</span>
          <div>
            <p>{isVi ? 'Đánh Giá Bị Báo Cáo' : 'Reported Reviews'}</p>
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
            placeholder={isVi ? 'Tìm theo tên người đánh giá, đơn hàng, sản phẩm hoặc bình luận...' : 'Search reviewer, order, product, or comment'}
          />
        </div>

        <select value={ratingFilter} onChange={handleFilterChange(setRatingFilter)} aria-label="Filter by rating">
          {ratingFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={handleFilterChange(setStatusFilter)} aria-label="Filter by report status">
          {statusFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={sortBy} onChange={handleFilterChange(setSortBy)} aria-label="Sort reviews">
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      <section className="seller-review-results">
        <div className="seller-review-results-head">
          <span>
            {isVi ? 'Hiển thị' : 'Showing'} <strong>{firstItem}-{lastItem}</strong> {isVi ? 'trên' : 'of'} <strong>{totalItems}</strong> {isVi ? 'đánh giá' : 'reviews'}
          </span>
          <span>{isVi ? 'Trang' : 'Page'} {page} / {totalPages}</span>
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
            <h2>{isVi ? 'Không tìm thấy đánh giá nào' : 'No reviews found'}</h2>
            <p>{isVi ? 'Không có đánh giá nào của người mua khớp với từ khóa hoặc bộ lọc.' : 'No buyer reviews match the current search or filters.'}</p>
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
                    <span>{isVi ? 'Sản phẩm' : 'Product'}</span>
                    <Link to={review.productId ? `/product/${review.productId}` : '#'}>{review.productName || (isVi ? 'Sản phẩm chưa đặt tên' : 'Unknown product')}</Link>
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
                      <span>{isVi ? 'Người mua' : 'Buyer'}</span>
                      <strong>{review.reviewerName || (isVi ? 'Khách hàng' : 'Unknown buyer')}</strong>
                      <small>{review.reviewerEmail || (isVi ? 'Chưa cập nhật email' : 'No email available')}</small>
                    </div>
                  </div>

                  <div className="seller-review-card-top">
                    <div>
                      <StarRating value={review.rating} />
                      <p>{review.comment || (isVi ? 'Không có bình luận chữ.' : 'No written comment.')}</p>
                    </div>
                    <div className={`seller-review-report-badge ${review.reportCount ? 'reported' : ''}`}>
                      <span className="material-symbols-outlined">flag</span>
                      {review.reportCount ? `${review.reportCount} ${isVi ? 'báo cáo' : `report${review.reportCount > 1 ? 's' : ''}`}` : (isVi ? 'Chưa có báo cáo' : 'No report')}
                    </div>
                  </div>

                  <dl className="seller-review-meta-grid">
                    <div>
                      <dt>{isVi ? 'Mã Đánh Giá' : 'Review ID'}</dt>
                      <dd>{review.reviewId}</dd>
                    </div>
                    <div>
                      <dt>{isVi ? 'Đối Tượng' : 'Target Type'}</dt>
                      <dd>{review.targetType || 'Review'}</dd>
                    </div>
                    <div>
                      <dt>{isVi ? 'Đơn Hàng' : 'Order'}</dt>
                      <dd>{review.orderCode || review.orderId || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt>{isVi ? 'Người Đánh Giá' : 'Reviewer'}</dt>
                      <dd>{review.reviewerName || (isVi ? 'Khách hàng' : 'Unknown buyer')}</dd>
                    </div>
                    <div>
                      <dt>{isVi ? 'Ngày Tạo' : 'Created At'}</dt>
                      <dd>{formatDate(review.createdAt)}</dd>
                    </div>
                  </dl>

                  {review.reportedByCurrentUser ? (
                    <div className="seller-review-current-report">
                      <span className="material-symbols-outlined">task_alt</span>
                      <p>
                        {isVi ? 'Bạn đã báo cáo đánh giá này vì lý do: ' : 'You reported this review for '}
                        <strong>{review.currentUserReport?.reason || review.latestReportReason || (isVi ? 'Vi phạm quy định' : 'policy review')}</strong>.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="seller-review-actions">
                  <button
                    type="button"
                    className="seller-review-report-btn"
                    onClick={() => openReportModal(review)}
                  >
                    <span className="material-symbols-outlined">flag</span>
                    {review.reportedByCurrentUser ? (isVi ? 'Đã Báo Cáo' : 'Reported') : (isVi ? 'Báo Cáo Vi Phạm' : 'Report Review')}
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
              {isVi ? 'Trước' : 'Previous'}
            </button>
            {paginationItems.map((item, index) => {
              if (typeof item === 'string') {
                return <span key={`${item}-${index}`}>...</span>;
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
              {isVi ? 'Sau' : 'Next'}
            </button>
          </div>
        ) : null}
      </section>

      {/* Report Modal */}
      {reportingReview ? (
        <div className="seller-review-modal-backdrop animate-fade-in" onClick={closeReportModal}>
          <div className="seller-review-modal-card" onClick={(event) => event.stopPropagation()}>
            <header className="seller-review-modal-head">
              <h3>{isVi ? 'Báo Cáo Đánh Giá Vi Phạm' : 'Report Review'}</h3>
              <button type="button" onClick={closeReportModal} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <form onSubmit={handleReportSubmit} className="seller-review-modal-body">
              <div className="seller-review-modal-context">
                <strong>{reportingReview.productName || (isVi ? 'Sản phẩm' : 'Product')}</strong>
                <p>"{reportingReview.comment || (isVi ? 'Không có bình luận chữ' : 'No comment')}"</p>
                <small>{isVi ? 'Người đánh giá:' : 'By'} {reportingReview.reviewerName || (isVi ? 'Khách hàng' : 'Buyer')}</small>
              </div>

              <div className="seller-review-field">
                <label htmlFor="seller-report-reason">{isVi ? 'Lý do báo cáo *' : 'Reason *'}</label>
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
                <label htmlFor="seller-report-desc">{isVi ? 'Mô tả chi tiết' : 'Details / Description'}</label>
                <textarea
                  id="seller-report-desc"
                  rows={4}
                  value={reportDescription}
                  onChange={(event) => setReportDescription(event.target.value)}
                  placeholder={isVi ? 'Giải thích lý do tại sao đánh giá này vi phạm quy định...' : 'Explain why this review violates policies...'}
                />
              </div>

              <footer className="seller-review-modal-actions">
                <button type="button" className="secondary" onClick={closeReportModal} disabled={reportSubmitting}>
                  {isVi ? 'Hủy Bỏ' : 'Cancel'}
                </button>
                <button type="submit" className="primary" disabled={reportSubmitting}>
                  {reportSubmitting ? (isVi ? 'Đang gửi...' : 'Submitting...') : (isVi ? 'Gửi Báo Cáo' : 'Submit Report')}
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
              <h3>{isVi ? 'Xem Trước Đánh Giá' : 'Review Context'}</h3>
              <button type="button" onClick={closePreviewModal} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-review-modal-body">
              {previewReview.productImageUrl ? (
                <img className="seller-review-preview-img" src={previewReview.productImageUrl} alt={previewReview.productName || 'Product'} />
              ) : null}
              <strong>{previewReview.productName || (isVi ? 'Sản phẩm' : 'Product')}</strong>
              <StarRating value={previewReview.rating} />
              <p>"{previewReview.comment || (isVi ? 'Không có bình luận chữ' : 'No comment')}"</p>
              <footer className="seller-review-modal-actions">
                <button type="button" className="primary" onClick={closePreviewModal}>{isVi ? 'Đóng' : 'Close'}</button>
              </footer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
