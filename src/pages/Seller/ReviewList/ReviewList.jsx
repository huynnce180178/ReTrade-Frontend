import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import reviewService from '../../../services/reviewService';
import { useToast } from '../../../context/ToastContext';
import './ReviewList.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

function formatMoney(value) {
  if (value == null) return '—';
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function ReviewList() {
  const outlet = useOutletContext();
  const { user } = outlet || {};
  const { showToast } = useToast();

  if (!user) {
    return <div className="p-6">Loading user data...</div>;
  }

  // State
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [summary, setSummary] = useState({
    totalReviews: 0,
    averageRating: 0,
    reportedReviews: 0,
    ratingStats: {},
  });

  // Report modal state
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const itemsPerPage = 10;

  // Fetch reviews from API
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = {
        Page: 1,
        PageSize: 100,
      };

      // Fetch reviews
      const data = await reviewService.getSellerReviews(params);
      setReviews(data?.items || []);

      // Fetch summary stats
      const summaryData = await reviewService.getSellerSummary({});
      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      showToast('Failed to load reviews.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Filter and search reviews
  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    // Filter by rating
    if (ratingFilter !== 'All') {
      const rating = Number(ratingFilter);
      result = result.filter((review) => review.rating === rating);
    }

    // Search by reviewer name, comment, or product
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (review) =>
          (review.reviewerName?.toLowerCase().includes(query)) ||
          (review.comment?.toLowerCase().includes(query)) ||
          (review.productName?.toLowerCase().includes(query))
      );
    }

    return result;
  }, [reviews, ratingFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage);
  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReviews.slice(start, start + itemsPerPage);
  }, [filteredReviews, currentPage]);

  const handleReportReview = (review) => {
    setReportingReview(review);
    setReportReason('');
    setReportDescription('');
  };

  const handleCloseReportModal = () => {
    setReportingReview(null);
    setReportReason('');
    setReportDescription('');
    setReportSubmitting(false);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) {
      showToast('Please select a reason for reporting.', 'error');
      return;
    }

    setReportSubmitting(true);
    try {
      await reviewService.report(reportingReview.reviewId, {
        reason: reportReason.trim(),
        description: reportDescription.trim() || null,
      });
      showToast('Review reported successfully.', 'success');
      handleCloseReportModal();
      fetchReviews();
    } catch (error) {
      console.error('Error reporting review:', error);
      showToast('Failed to report review.', 'error');
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-surface text-on-surface font-body-md bg-[#f9f9f8]">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <span className="btn-spinner"></span>
            <p>Loading reviews...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface text-on-surface font-body-md animate-fade-in bg-[#f9f9f8]">
      {/* Header */}
      <header className="mb-8">
        <div className="border-b border-gray-200/60 pb-6">
          <span className="text-secondary font-bold text-xs uppercase tracking-widest text-[#1b6b51]">Atelier Workspace</span>
          <h1 className="font-headline-md text-headline-md text-gray-900 mt-1 mb-2 font-serif text-3xl font-bold">
            View Reviews
          </h1>
          <p className="text-gray-500 font-body-md max-w-xl text-sm leading-relaxed">
            Monitor customer feedback and ratings for your products. Report reviews that violate platform policies.
          </p>
        </div>
      </header>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Reviews</p>
          <p className="text-2xl font-bold text-gray-900">{summary.totalReviews}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Average Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">{summary.averageRating?.toFixed(1)}</p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`material-symbols-outlined text-lg ${
                    star <= Math.round(summary.averageRating) ? 'text-amber-400' : 'text-gray-300'
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reported Reviews</p>
          <p className="text-2xl font-bold text-red-600">{summary.reportedReviews}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Filtered Results</p>
          <p className="text-2xl font-bold text-gray-900">{filteredReviews.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Rating</label>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b6b51]"
            >
              <option>All</option>
              <option>5</option>
              <option>4</option>
              <option>3</option>
              <option>2</option>
              <option>1</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by reviewer, comment, or product..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b6b51]"
            />
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Product & Reviewer</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Rating</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Comment</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Reports</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReviews.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    No reviews found
                  </td>
                </tr>
              ) : (
                paginatedReviews.map((review) => (
                  <tr key={review.reviewId} className="border-b border-gray-200 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {review.productImageUrl && (
                          <img
                            src={review.productImageUrl}
                            alt={review.productName}
                            className="w-10 h-10 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate text-xs">{review.productName}</p>
                          <p className="text-gray-500 text-xs">By: {review.reviewerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`material-symbols-outlined text-base ${
                              star <= review.rating ? 'text-amber-400' : 'text-gray-300'
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600 line-clamp-2 text-xs">{review.comment || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {formatDate(review.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {review.reportCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold">
                          <span className="material-symbols-outlined text-sm">flag</span>
                          {review.reportCount}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleReportReview(review)}
                        className="text-[#1b6b51] hover:text-[#0d3a2b] font-semibold text-xs transition"
                        title="Report this review"
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  currentPage === i + 1
                    ? 'bg-[#1b6b51] text-white'
                    : 'border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportingReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 animate-scale-in">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Report Review</h2>
            <p className="text-sm text-gray-600 mb-4">
              Report this review from <strong>{reportingReview.reviewerName}</strong> about{' '}
              <strong>{reportingReview.productName}</strong>
            </p>

            <form onSubmit={handleReportSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Report <span className="text-red-500">*</span>
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b6b51]"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="False Information">False Information</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Misleading">Misleading</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-gray-400 text-xs">(Optional, max 500 characters)</span>
                </label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value.slice(0, 500))}
                  placeholder="Provide additional details about why this review should be reported..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b6b51] resize-none"
                  rows="4"
                />
                <p className="text-xs text-gray-400 mt-1">{reportDescription.length}/500</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseReportModal}
                  disabled={reportSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting || !reportReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {reportSubmitting ? 'Reporting...' : 'Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
