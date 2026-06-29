import React, { useEffect, useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
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

const filterTabs = [
  { key: 'all', label: 'All Bids' },
  { key: 'active', label: 'Ongoing' },
  { key: 'winning', label: 'Winning / Won' },
  { key: 'outbid', label: 'Outbid / Lost' },
];

function resolveBidOutcome(bidStatus, auctionStatus) {
  const normalizedBidStatus = String(bidStatus || '').toLowerCase();
  const normalizedAuctionStatus = String(auctionStatus || '').toLowerCase();
  const isTerminal = ['ended', 'endedbybuynow', 'endedbytime', 'endednobid'].includes(normalizedAuctionStatus);

  if (normalizedAuctionStatus === 'cancelled') {
    return { label: 'Cancelled', className: 'cancelled' };
  }
  if (normalizedAuctionStatus === 'ongoing') {
    if (normalizedBidStatus === 'highest' || normalizedBidStatus === 'winning' || normalizedBidStatus === 'won') {
      return { label: 'Winning', className: 'winning' };
    }
    if (normalizedBidStatus === 'outbid' || normalizedBidStatus === 'lost') {
      return { label: 'Outbid', className: 'outbid' };
    }
  }
  if (normalizedAuctionStatus === 'upcoming') {
    return { label: 'Upcoming', className: 'upcoming' };
  }
  if (isTerminal) {
    if (normalizedBidStatus === 'highest' || normalizedBidStatus === 'winning' || normalizedBidStatus === 'won') {
      return { label: 'Won', className: 'won' };
    }
    if (normalizedBidStatus === 'outbid' || normalizedBidStatus === 'lost') {
      return { label: 'Lost', className: 'lost' };
    }
  }
  return { label: bidStatus || 'Unknown', className: 'default' };
}

export default function BidHistory() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const loadBids = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await auctionService.getMyBids();
      setBids(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load bid history.', 'error');
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
    } catch (e) {
      // ignore
    }
  }, [page, activeTab]);

  // Client-side search and filtering
  const filteredBids = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return bids.filter((bid) => {
      const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus);

      // Search keyword match
      const matchesKeyword = !keyword || bid.productName.toLowerCase().includes(keyword);

      // Tab match
      let matchesTab = true;
      if (activeTab === 'active') {
        matchesTab = bid.auctionStatus === 'Ongoing';
      } else if (activeTab === 'winning') {
        matchesTab = ['Winning', 'Won'].includes(outcome.label);
      } else if (activeTab === 'outbid') {
        matchesTab = ['Outbid', 'Lost'].includes(outcome.label);
      }

      return matchesKeyword && matchesTab;
    });
  }, [bids, activeTab, searchTerm]);

  // Pagination bounds
  const totalItems = filteredBids.length;
  const paginatedBids = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBids.slice(start, start + pageSize);
  }, [filteredBids, page]);

  // Reset page to 1 when tab or search changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm]);

  // Summaries
  const summaries = useMemo(() => {
    const totalCount = bids.length;
    const activeCount = bids.filter(b => b.auctionStatus === 'Ongoing').length;
    
    // Count won bids
    const wonCount = bids.filter(b => {
      const outcome = resolveBidOutcome(b.bidStatus, b.auctionStatus);
      return outcome.label === 'Won';
    }).length;

    // Committed value (max bid amount per unique auction)
    const uniqueAuctionsMaxBid = {};
    bids.forEach(b => {
      if (!uniqueAuctionsMaxBid[b.auctionId] || uniqueAuctionsMaxBid[b.auctionId] < b.bidAmount) {
        uniqueAuctionsMaxBid[b.auctionId] = b.bidAmount;
      }
    });
    const committedValue = Object.values(uniqueAuctionsMaxBid).reduce((sum, val) => sum + val, 0);

    return { totalCount, activeCount, wonCount, committedValue };
  }, [bids]);

  // Dynamic counts for each filter tab (without keyword filter)
  const tabCounts = useMemo(() => {
    return bids.reduce(
      (acc, bid) => {
        const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus);
        acc.all += 1;
        if (bid.auctionStatus === 'Ongoing') {
          acc.active += 1;
        }
        if (['Winning', 'Won'].includes(outcome.label)) {
          acc.winning += 1;
        }
        if (['Outbid', 'Lost'].includes(outcome.label)) {
          acc.outbid += 1;
        }
        return acc;
      },
      { all: 0, active: 0, winning: 0, outbid: 0 }
    );
  }, [bids]);

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading bid history...</p>
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
                    <h1 className="ma-headline">Bid History</h1>
                    <p className="ma-subtitle">Track your bidding actions, current status, and auction outcomes.</p>
                  </div>
                </div>
              </div>

              <section className="bid-filter-card">
                <div className="bid-tabs">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={activeTab === tab.key ? 'active' : ''}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                      <span>{tabCounts[tab.key] || 0}</span>
                    </button>
                  ))}
                </div>

                <label className="bid-search">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by product name..."
                  />
                </label>
              </section>

              <section className="bid-list">
                {loading ? (
                  <div className="bid-empty-state">
                    <span className="btn-spinner"></span>
                    <p>Loading your bids...</p>
                  </div>
                ) : paginatedBids.length === 0 ? (
                  <div className="bid-empty-state">
                    <span className="material-symbols-outlined">gavel</span>
                    <h3>No bids found</h3>
                    <p>Try a different filter or search term.</p>
                  </div>
                ) : (
                  paginatedBids.map((bid) => {
                    const outcome = resolveBidOutcome(bid.bidStatus, bid.auctionStatus);
                    return (
                      <article key={bid.bidId} className="bid-card">
                        <header className="bid-card-header">
                          <div className="bid-card-header-left">
                            <strong className="bid-card-order-code">Bid #{bid.bidId.split('_').pop().toUpperCase()}</strong>
                            <span className="bid-card-date">{formatDate(bid.createdAt)}</span>
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
                              <Link to={`/auction/${bid.auctionId}`} className="bid-product-title-link">
                                <h3 className="bid-product-title">{bid.productName}</h3>
                              </Link>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                End Time: {formatDate(bid.endTime)}
                              </span>
                            </div>
                          </div>

                          <div className="bid-detail-row">
                            <div className="bid-info-group">
                              <span className="bid-info-label">Your Bid</span>
                              <strong className="bid-info-value my-bid">{formatVnd(bid.bidAmount)}</strong>
                            </div>
                            <div className="bid-info-group" style={{ alignItems: 'flex-end' }}>
                              <span className="bid-info-label">Current Auction Price</span>
                              <strong className="bid-info-value">{formatVnd(bid.currentPrice)}</strong>
                            </div>
                          </div>
                        </div>

                        <footer className="bid-card-actions">
                          <Link to={`/auction/${bid.auctionId}`} className="bid-primary-btn">
                            View Auction Detail
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
                      Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} of {totalItems} bids
                    </span>
                  </div>
                  <div className="bid-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Prev
                    </button>
                    <span className="page-indicator">Page {page}</span>
                    <button type="button" disabled={page * pageSize >= totalItems} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </button>
                  </div>
                </footer>
              )}
            </section>

            <aside className="bid-side-col">
              <div className="bid-side-sticky glass-panel">
                <section className="bid-summary-card">
                  <h2>Bidding Summary</h2>
                  <div className="bid-total-spent">
                    <span>Total Bid Capital</span>
                    <strong>{formatVnd(summaries.committedValue)}</strong>
                  </div>
                  <div className="bid-summary-grid">
                    <div>
                      <span>Total Bids</span>
                      <strong>{summaries.totalCount}</strong>
                    </div>
                    <div>
                      <span>Active Bids</span>
                      <strong>{summaries.activeCount}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span>Auctions Won</span>
                      <strong>{summaries.wonCount} {summaries.wonCount === 1 ? 'Auction' : 'Auctions'}</strong>
                    </div>
                  </div>
                </section>

                <section className="bid-insights-card">
                  <h2>Bid Status Percentages</h2>
                  <InsightBar label={`Winning / Won (${tabCounts.winning})`} value={getPercent(tabCounts.winning, summaries.totalCount)} />
                  <InsightBar label={`Outbid / Lost (${tabCounts.outbid})`} value={getPercent(tabCounts.outbid, summaries.totalCount)} />
                  <InsightBar label={`Ongoing Active (${tabCounts.active})`} value={getPercent(tabCounts.active, summaries.totalCount)} muted />
                  
                  <div className="bid-insight-note">
                    <span className="material-symbols-outlined">gavel</span>
                    <p>Your bids represent legally binding commitments. Check end times regularly to monitor leading bids.</p>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>
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
        <span className={muted ? 'muted' : ''} style={{ width: `${value}%` }}></span>
      </div>
    </div>
  );
}
