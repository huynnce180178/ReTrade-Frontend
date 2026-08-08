import React, { useEffect, useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import auctionService from '../../../services/auctionService';
import '../../../styles/MyAccount.css';
import './BidHistory.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function formatCompactVnd(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000000) return `${numberFormatter.format(amount / 1000000000)}B`;
  if (amount >= 1000000) return `${numberFormatter.format(amount / 1000000)}M`;
  return formatVnd(amount);
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function groupBidsByAuction(bids) {
  const groups = new Map();

  bids.forEach((bid) => {
    const key = bid.auctionId || bid.productId || bid.bidId;
    const current = groups.get(key) || [];
    current.push(bid);
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => {
    const sortedByHighest = [...group].sort((a, b) => {
      const amountDiff = Number(b.bidAmount || 0) - Number(a.bidAmount || 0);
      if (amountDiff !== 0) return amountDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    const displayBid = sortedByHighest[0];
    return {
      ...displayBid,
      bidHistory: [...group].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
      bidRoundCount: group.length,
      highestUserBidAmount: displayBid.bidAmount,
    };
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

const filterTabs = [
  { key: 'all', label: 'All Bids' },
  { key: 'active', label: 'Ongoing' },
  { key: 'winning', label: 'Winning / Won' },
  { key: 'outbid', label: 'Outbid / Lost' },
];

function resolveBidOutcome(bidStatus, auctionStatus, language) {
  const isVi = language === 'vi';
  const normalizedBidStatus = String(bidStatus || '').toLowerCase();
  const normalizedAuctionStatus = String(auctionStatus || '').toLowerCase();
  const isTerminal = ['ended', 'endedbybuynow', 'endedbytime', 'endednobid'].includes(normalizedAuctionStatus);

  if (normalizedAuctionStatus === 'cancelled') {
    return { label: isVi ? 'Đã hủy' : 'Cancelled', className: 'cancelled' };
  }
  if (normalizedAuctionStatus === 'ongoing') {
    if (normalizedBidStatus === 'highest' || normalizedBidStatus === 'winning' || normalizedBidStatus === 'won') {
      return { label: isVi ? 'Đang dẫn đầu' : 'Winning', className: 'winning' };
    }
    if (normalizedBidStatus === 'outbid' || normalizedBidStatus === 'lost') {
      return { label: isVi ? 'Bị vượt giá' : 'Outbid', className: 'outbid' };
    }
  }
  if (normalizedAuctionStatus === 'upcoming') {
    return { label: isVi ? 'Sắp diễn ra' : 'Upcoming', className: 'upcoming' };
  }
  if (isTerminal) {
    if (normalizedBidStatus === 'highest' || normalizedBidStatus === 'winning' || normalizedBidStatus === 'won') {
      return { label: isVi ? 'Đã thắng' : 'Won', className: 'won' };
    }
    if (normalizedBidStatus === 'outbid' || normalizedBidStatus === 'lost') {
      return { label: isVi ? 'Đã thua' : 'Lost', className: 'lost' };
    }
  }
  return { label: bidStatus || (isVi ? 'Không xác định' : 'Unknown'), className: 'default' };
}

export default function BidHistory() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBidGroup, setSelectedBidGroup] = useState(null);
  const pageSize = 5;

  const loadBids = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await auctionService.getMyBids();
      setBids(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể tải lịch sử đấu giá.' : 'Failed to load bid history.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBids();
    }
  }, [user]);

  // Scroll to top when page changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }, [page]);

  // Reset page when filter or search term changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm]);

  const groupedBids = useMemo(() => groupBidsByAuction(bids), [bids]);

  // Filter highest bid per auction by status & search term
  const filteredBids = useMemo(() => {
    return groupedBids.filter((bid) => {
      const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus, language);
      const matchesSearch =
        !searchTerm.trim() ||
        (bid.productName || '').toLowerCase().includes(searchTerm.toLowerCase().trim());

      if (!matchesSearch) return false;

      if (activeTab === 'active') {
        return bid.auctionStatus === 'Ongoing';
      }
      if (activeTab === 'winning') {
        return ['Winning', 'Won', 'Đang dẫn đầu', 'Đã thắng'].includes(outcome.label);
      }
      if (activeTab === 'outbid') {
        return ['Outbid', 'Lost', 'Bị vượt giá', 'Đã thua'].includes(outcome.label);
      }
      return true;
    });
  }, [groupedBids, activeTab, searchTerm, language]);

  // Total count after filtering
  const totalItems = filteredBids.length;

  // Slice for current page
  const paginatedBids = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBids.slice(start, start + pageSize);
  }, [filteredBids, page, pageSize]);

  // Calculate summary counts & metrics from all bids
  const summaries = useMemo(() => {
    let committedValue = 0;
    let activeCount = 0;
    let wonCount = 0;

    groupedBids.forEach((bid) => {
      const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus, language);
      const amount = Number(bid.bidAmount || 0);

      committedValue += amount;

      if (bid.auctionStatus === 'Ongoing') {
        activeCount += 1;
      }
      if (['Winning', 'Won', 'Đang dẫn đầu', 'Đã thắng'].includes(outcome.label)) {
        wonCount += 1;
      }
    });

    return {
      totalCount: groupedBids.length,
      activeCount,
      wonCount,
      committedValue,
    };
  }, [groupedBids, language]);

  // Calculate counts per tab
  const tabCounts = useMemo(() => {
    return groupedBids.reduce(
      (acc, bid) => {
        const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus, language);
        acc.all += 1;
        if (bid.auctionStatus === 'Ongoing') {
          acc.active += 1;
        }
        if (['Winning', 'Won', 'Đang dẫn đầu', 'Đã thắng'].includes(outcome.label)) {
          acc.winning += 1;
        }
        if (['Outbid', 'Lost', 'Bị vượt giá', 'Đã thua'].includes(outcome.label)) {
          acc.outbid += 1;
        }
        return acc;
      },
      { all: 0, active: 0, winning: 0, outbid: 0 }
    );
  }, [groupedBids, language]);

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{isVi ? 'Đang tải lịch sử đấu giá...' : 'Loading bid history...'}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="bid-layout">
            <section className="bid-main-col">
              <div className="ma-card bid-hero-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">gavel</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">{isVi ? 'Lịch Sử Đấu Giá' : 'Bid History'}</h1>
                    <p className="ma-subtitle">{isVi ? 'Theo dõi lượt ra giá, trạng thái hiện tại và kết quả phiên đấu giá của bạn.' : 'Track your bidding actions, current status, and auction outcomes.'}</p>
                  </div>
                </div>
              </div>

              <section className="bid-filter-card">
                <div className="bid-tabs">
                  {filterTabs.map((tab) => {
                    const tabMapVi = {
                      all: 'Tất cả lượt ra giá',
                      active: 'Đang diễn ra',
                      winning: 'Dẫn đầu / Thắng',
                      outbid: 'Bị vượt giá / Thua',
                    };
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'active' : ''}
                        onClick={() => setActiveTab(tab.key)}
                      >
                        {isVi ? (tabMapVi[tab.key] || tab.label) : tab.label}
                        <span>{tabCounts[tab.key] || 0}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="bid-search">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={isVi ? 'Tìm theo tên sản phẩm...' : 'Search by product name...'}
                  />
                </label>
              </section>

              <section className="bid-list">
                {loading ? (
                  <div className="bid-empty-state">
                    <span className="btn-spinner"></span>
                    <p>{isVi ? 'Đang tải danh sách đấu giá...' : 'Loading your bids...'}</p>
                  </div>
                ) : paginatedBids.length === 0 ? (
                  <div className="bid-empty-state">
                    <span className="material-symbols-outlined">gavel</span>
                    <h3>{isVi ? 'Không tìm thấy lượt ra giá nào' : 'No bids found'}</h3>
                    <p>{isVi ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Try a different filter or search term.'}</p>
                  </div>
                ) : (
                  paginatedBids.map((bid) => {
                    const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus, language);
                    return (
                      <article
                        key={bid.bidId}
                        className="bid-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedBidGroup(bid)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedBidGroup(bid);
                          }
                        }}
                      >
                        <header className="bid-card-header">
                          <div className="bid-card-header-left">
                            <strong className="bid-card-order-code">{isVi ? 'Lượt ra giá #' : 'Bid #'}{bid.bidId.split('_').pop().toUpperCase()}</strong>
                            <span className="bid-card-date">{formatDate(bid.createdAt)}</span>
                            {bid.bidRoundCount > 1 && (
                              <span className="bid-round-count">
                                {bid.bidRoundCount} {isVi ? 'lÆ°á»£t' : 'rounds'}
                              </span>
                            )}
                          </div>
                          <em className={`bid-status ${outcome.className}`}>{outcome.label}</em>
                        </header>

                        <div className="bid-card-body">
                          <div className="bid-product-item">
                            <img
                              className="bid-product-img"
                              src={bid.productImageUrl || '/vite.svg'}
                              alt={bid.productName}
                            />
                            <div className="bid-product-details">
                              <Link
                                to={`/auction/${bid.auctionId}`}
                                className="bid-product-title-link"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <h3 className="bid-product-title">{bid.productName}</h3>
                              </Link>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {isVi ? 'Kết thúc:' : 'End Time:'} {formatDate(bid.endTime)}
                              </span>
                            </div>
                          </div>

                          <div className="bid-detail-row">
                            <div className="bid-info-group">
                              <span className="bid-info-label">{isVi ? 'Giá cao nhất của bạn' : 'Your Highest Bid'}</span>
                              <button
                                type="button"
                                className="bid-info-value my-bid bid-history-trigger"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedBidGroup(bid);
                                }}
                              >
                                {formatVnd(bid.highestUserBidAmount)}
                              </button>
                            </div>
                            <div className="bid-info-group" style={{ alignItems: 'flex-end' }}>
                              <span className="bid-info-label">{isVi ? 'Giá đấu hiện tại' : 'Current Auction Price'}</span>
                              <strong className="bid-info-value">{formatVnd(bid.currentPrice)}</strong>
                            </div>
                          </div>
                        </div>

                        <footer className="bid-card-actions">
                          <Link
                            to={`/auction/${bid.auctionId}`}
                            className="bid-primary-btn"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {isVi ? 'Xem chi tiết đấu giá' : 'View Auction Detail'}
                          </Link>
                        </footer>
                      </article>
                    );
                  })
                )}
              </section>

              {totalItems > 0 && (
                <footer className="bid-list-footer">
                  <div>
                    <span>
                      {isVi 
                        ? `Hiển thị ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalItems)} trong ${totalItems} phiên đấu giá`
                        : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalItems)} of ${totalItems} auctions`}
                    </span>
                  </div>
                  <div className="bid-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      {isVi ? 'Trước' : 'Prev'}
                    </button>
                    <span className="page-indicator">{isVi ? 'Trang' : 'Page'} {page}</span>
                    <button type="button" disabled={page * pageSize >= totalItems} onClick={() => setPage((p) => p + 1)}>
                      {isVi ? 'Tiếp' : 'Next'}
                    </button>
                  </div>
                </footer>
              )}
            </section>

            <aside className="bid-side-col">
              <div className="bid-side-sticky glass-panel">
                <section className="bid-summary-card">
                  <h2>{isVi ? 'Tổng Quan Đấu Giá' : 'Bidding Summary'}</h2>
                  <div className="bid-total-spent">
                    <span>{isVi ? 'Tổng Vốn Đấu Giá' : 'Total Bid Capital'}</span>
                    <strong>{formatVnd(summaries.committedValue)}</strong>
                  </div>
                  <div className="bid-summary-grid">
                    <div>
                      <span>{isVi ? 'Tổng phiên đã tham gia' : 'Joined Auctions'}</span>
                      <strong>{summaries.totalCount}</strong>
                    </div>
                    <div>
                      <span>{isVi ? 'Đang diễn ra' : 'Active Bids'}</span>
                      <strong>{summaries.activeCount}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span>{isVi ? 'Phiên đấu giá đã thắng' : 'Auctions Won'}</span>
                      <strong>{summaries.wonCount} {isVi ? 'Phiên' : (summaries.wonCount === 1 ? 'Auction' : 'Auctions')}</strong>
                    </div>
                  </div>
                </section>

                <section className="bid-insights-card">
                  <h2>{isVi ? 'Tỷ Lệ Trạng Thái Đấu Giá' : 'Bid Status Percentages'}</h2>
                  <InsightBar label={isVi ? `Dẫn đầu / Thắng (${tabCounts.winning})` : `Winning / Won (${tabCounts.winning})`} value={getPercent(tabCounts.winning, summaries.totalCount)} />
                  <InsightBar label={isVi ? `Bị vượt giá / Thua (${tabCounts.outbid})` : `Outbid / Lost (${tabCounts.outbid})`} value={getPercent(tabCounts.outbid, summaries.totalCount)} />
                  <InsightBar label={isVi ? `Đang diễn ra (${tabCounts.active})` : `Ongoing Active (${tabCounts.active})`} value={getPercent(tabCounts.active, summaries.totalCount)} muted />
                  
                  <div className="bid-insight-note">
                    <span className="material-symbols-outlined">gavel</span>
                    <p>{isVi ? 'Lượt ra giá của bạn có tính pháp lý ràng buộc. Hãy kiểm tra thời gian kết thúc thường xuyên để theo dõi phiên đấu giá.' : 'Your bids represent legally binding commitments. Check end times regularly to monitor leading bids.'}</p>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {selectedBidGroup && (
        <div className="bid-history-modal-overlay" role="dialog" aria-modal="true">
          <div className="bid-history-modal">
            <header>
              <div>
                <span>{isVi ? 'Lịch sử ra giá' : 'Bid Rounds'}</span>
                <h2>{selectedBidGroup.productName}</h2>
              </div>
              <button type="button" onClick={() => setSelectedBidGroup(null)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="bid-history-modal-list">
              {selectedBidGroup.bidHistory.map((historyBid) => {
                const historyOutcome = resolveBidOutcome(historyBid.bidStatus, historyBid.auctionStatus, language);
                return (
                  <article key={historyBid.bidId} className="bid-history-modal-row">
                    <div>
                      <strong>{formatVnd(historyBid.bidAmount)}</strong>
                      <span>{isVi ? 'Mã lượt bid:' : 'Bid ID:'} {historyBid.bidId}</span>
                      <span>{formatDate(historyBid.createdAt)}</span>
                    </div>
                    <em className={`bid-status ${historyOutcome.className}`}>{historyOutcome.label}</em>
                  </article>
                );
              })}
            </div>

            <footer>
              <span className="bid-history-modal-current">
                {isVi ? 'Giá hiện tại:' : 'Current price:'} {formatVnd(selectedBidGroup.currentPrice)}
              </span>
              <Link to={`/auction/${selectedBidGroup.auctionId}`} className="bid-primary-btn">
                {isVi ? 'Xem chi tiết đấu giá' : 'View Auction Detail'}
              </Link>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightBar({ label, value, muted = false }) {
  return (
    <div className="bid-insight-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="bid-insight-track">
        <div className={`bid-insight-fill ${muted ? 'muted' : ''}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
