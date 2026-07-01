import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { formatAuctionDateTime, parseAuctionDateTime } from '../../../utils/auctionTime';
import './Auction.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const sortOptions = [
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'starting_soon', label: 'Starting Soon' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Current Bid: Low to High' },
  { value: 'price_desc', label: 'Current Bid: High to Low' },
];

function formatMoney(value) {
  if (value == null) return '-';
  return moneyFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  return formatAuctionDateTime(value, { year: undefined });
}

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (num) => String(num).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getEffectiveAuctionStatus(auction, now = Date.now()) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const status = auction.status;

  if (['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid', 'Cancelled'].includes(status)) {
    return status;
  }

  if (end && end <= now) return 'Ended';
  if (start && start > now) return 'Upcoming';
  return 'Ongoing';
}

function getTimeLabel(auction, now) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const effectiveStatus = getEffectiveAuctionStatus(auction, now);

  if (effectiveStatus === 'Upcoming' && start > now) {
    const diff = start - now;
    return `Starts in ${formatDuration(diff)}`;
  }
  if (effectiveStatus === 'Ongoing' && end > now) {
    const diff = end - now;
    return `Ends in ${formatDuration(diff)}`;
  }
  return effectiveStatus || auction.status || 'Auction';
}

function splitDuration(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSecs / 86400),
    hours: Math.floor((totalSecs % 86400) / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
  };
}

function CountdownUnit({ value, label }) {
  return (
    <span className="auction-countdown-unit">
      <strong>{String(value).padStart(2, '0')}</strong>
      <small>{label}</small>
    </span>
  );
}

function AuctionCountdown({ auction, now }) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const effectiveStatus = getEffectiveAuctionStatus(auction, now);
  const target = effectiveStatus === 'Upcoming' ? start : end;
  const remaining = target ? target - now : 0;
  const parts = splitDuration(remaining);

  if (effectiveStatus === 'Upcoming') {
    return (
      <div className="auction-countdown-panel upcoming">
        <div className="auction-countdown-label">
          <span className="material-symbols-outlined">hourglass_top</span>
          Opening countdown
        </div>
        <div className="auction-countdown-grid">
          {parts.days > 0 && <CountdownUnit value={parts.days} label="Days" />}
          <CountdownUnit value={parts.hours} label="Hours" />
          <CountdownUnit value={parts.minutes} label="Mins" />
          <CountdownUnit value={parts.seconds} label="Secs" />
        </div>
      </div>
    );
  }

  if (effectiveStatus === 'Ongoing') {
    return (
      <div className="auction-countdown-panel live">
        <div className="auction-countdown-label">
          <span className="material-symbols-outlined">bolt</span>
          Live now
        </div>
        <div className="auction-countdown-grid compact">
          {parts.days > 0 && <CountdownUnit value={parts.days} label="Days" />}
          <CountdownUnit value={parts.hours} label="Hours" />
          <CountdownUnit value={parts.minutes} label="Mins" />
          <CountdownUnit value={parts.seconds} label="Secs" />
        </div>
      </div>
    );
  }

  return null;
}

export default function Auction() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const page = Number(searchParams.get('page') || 1);
  const searchTerm = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'All';
  const sort = searchParams.get('sort') || 'ending_soon';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const loadAuctions = async () => {
      try {
        setLoading(true);
        const params = {
          Page: page,
          PageSize: 12,
          SortBy: sort,
        };
        if (searchTerm) params.SearchTerm = searchTerm;
        if (status !== 'All') params.Status = status;

        const data = await auctionService.getAll(params);
        setAuctions(data?.items || []);
        setTotalItems(data?.totalItems || 0);
        setTotalPages(data?.totalPages || 1);
      } catch (error) {
        showToast(error?.response?.data || 'Failed to load auctions.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadAuctions();
  }, [authLoading, user, page, searchTerm, status, sort, showToast, realtimeTick]);

  useEffect(() => {
    if (authLoading || !user) return undefined;

    const connection = createAuctionHubConnection();
    let disposed = false;

    const joinList = async () => {
      if (disposed || connection.state !== 'Connected') return;
      await connection.invoke('JoinAuctionList');
    };

    const handleListChanged = (payload) => {
      const nextAuction = payload?.auction || payload?.Auction;
      const eventType = payload?.eventType || payload?.EventType;

      if (eventType === 'BidPlaced' && nextAuction?.auctionId) {
        setAuctions((current) => current.map((auction) => (
          auction.auctionId === nextAuction.auctionId ? { ...auction, ...nextAuction } : auction
        )));
        return;
      }

      setRealtimeTick((current) => current + 1);
    };

    connection.on('AuctionListChanged', handleListChanged);
    connection.onreconnected(() => {
      joinList().catch(() => {});
    });

    connection.start()
      .then(joinList)
      .catch(() => {});

    return () => {
      disposed = true;
      connection.off('AuctionListChanged', handleListChanged);
      connection.stop().catch(() => {});
    };
  }, [authLoading, user]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!updates.page) next.set('page', '1');
    setSearchParams(next);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search')?.toString().trim() || '';
    updateParams({ search: value });
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="auction-pagination">
        <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>Prev</button>
        <span>{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>Next</button>
      </div>
    );
  };

  if (!authLoading && !user) {
    return (
      <div className="auction-page container animate-fade-in">
        <section className="auction-auth-panel">
          <span className="material-symbols-outlined">gavel</span>
          <h1>Live Auctions</h1>
          <p>Please sign in to browse ongoing and upcoming product auctions.</p>
          <Link to="/login" className="auction-auth-link">Sign In</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="auction-page container animate-fade-in">
      <section className="auction-page-hero">
        <div>
          <span>Auction Room</span>
          <h1>Live Product Auctions</h1>
          <p>Browse ongoing and upcoming auction listings from verified sellers on ReTrade.</p>
        </div>
      </section>

      <section className="auction-filter-panel">
        <form onSubmit={handleSearchSubmit} className="auction-search-box">
          <span className="material-symbols-outlined">search</span>
          <input name="search" defaultValue={searchTerm} placeholder="Search auction products or sellers..." />
          <button type="submit">Search</button>
        </form>

        <div className="auction-filter-actions">
          <div className="auction-status-tabs">
            {[
              { key: 'All', label: 'All Active' },
              { key: 'Ongoing', label: 'Ongoing' },
              { key: 'Upcoming', label: 'Upcoming' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`auction-status-tab ${status === tab.key ? 'active' : ''}`}
                onClick={() => updateParams({ status: tab.key })}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => updateParams({ sort: e.target.value })}>
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="auction-result-line">
        {loading ? 'Loading auctions...' : <>Showing <strong>{auctions.length}</strong> of <strong>{totalItems}</strong> auctions</>}
      </div>

      {loading ? (
        <div className="auction-grid">
          {[...Array(6)].map((_, index) => <div key={index} className="auction-card skeleton" />)}
        </div>
      ) : auctions.length === 0 ? (
        <div className="auction-empty">
          <span className="material-symbols-outlined">search_off</span>
          <h3>No auctions found</h3>
          <p>Try a different search term or check back when sellers launch new auctions.</p>
        </div>
      ) : (
        <div className="auction-grid">
          {auctions.map((auction) => {
            const effectiveStatus = getEffectiveAuctionStatus(auction, currentTime);
            return (
            <article
              key={auction.auctionId}
              className={`auction-card ${effectiveStatus === 'Upcoming' ? 'is-upcoming' : ''} ${effectiveStatus === 'Ongoing' ? 'is-live' : ''}`}
              onClick={() => navigate(`/auction/${auction.auctionId}`)}
            >
              <div className="auction-card-image">
                {auction.productImageUrl ? (
                  <img src={auction.productImageUrl} alt={auction.productName || 'Auction product'} loading="lazy" />
                ) : (
                  <span className="material-symbols-outlined">inventory_2</span>
                )}
                <em className={`auction-card-status ${String(effectiveStatus || '').toLowerCase()}`}>{effectiveStatus}</em>
                {effectiveStatus === 'Upcoming' && (
                  <div className="auction-card-watch-badge">
                    <span className="material-symbols-outlined">notifications_active</span>
                    Starting soon
                  </div>
                )}
              </div>
              <div className="auction-card-body">
                <span className="auction-card-category">{auction.categoryName || 'Uncategorized'}</span>
                <h2>{auction.productName || 'Unnamed auction'}</h2>
                <p>{auction.sellerName || auction.sellerId || 'Unknown seller'}</p>
                <AuctionCountdown auction={auction} now={currentTime} />
                <div className="auction-bid-panel">
                  <div>
                    <small>Current Bid</small>
                    <strong>{formatMoney(auction.currentPrice)}</strong>
                  </div>
                  <div>
                    <small>Step</small>
                    <strong>{formatMoney(auction.minIncrement)}</strong>
                  </div>
                </div>
                <div className="auction-card-footer">
                  <span>{getTimeLabel(auction, currentTime)}</span>
                  <span>{auction.bidCount || 0} bids</span>
                </div>
                <div className="auction-card-dates">
                  <span>{formatDateTime(auction.startTime)}</span>
                  <span>{formatDateTime(auction.endTime)}</span>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}

      {!loading && renderPagination()}
    </div>
  );
}
