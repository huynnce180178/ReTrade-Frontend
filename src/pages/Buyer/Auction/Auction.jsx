import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { formatAuctionDateTime, parseAuctionDateTime } from '../../../utils/auctionTime';
import './Auction.css';

function formatDuration(ms, language) {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (num) => String(num).padStart(2, '0');

  if (days > 0) {
    return language === 'vi' 
      ? `${days} ngày ${pad(hours)}g ${pad(minutes)}p ${pad(seconds)}s`
      : `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
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

function getTimeLabel(auction, now, language) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const effectiveStatus = getEffectiveAuctionStatus(auction, now);

  if (effectiveStatus === 'Upcoming' && start > now) {
    const diff = start - now;
    return language === 'vi' ? `Bắt đầu sau ${formatDuration(diff, language)}` : `Starts in ${formatDuration(diff, language)}`;
  }
  if (effectiveStatus === 'Ongoing' && end > now) {
    const diff = end - now;
    return language === 'vi' ? `Kết thúc sau ${formatDuration(diff, language)}` : `Ends in ${formatDuration(diff, language)}`;
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

function AuctionCountdown({ auction, now: externalNow, language }) {
  const [localNow, setLocalNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setLocalNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = externalNow || localNow;
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const effectiveStatus = getEffectiveAuctionStatus(auction, now);

  if (effectiveStatus === 'Upcoming' && start > now) {
    const diff = start - now;
    const parts = splitDuration(diff);
    return (
      <div className="auction-countdown-panel">
        <div className="auction-countdown-label">
          <span className="material-symbols-outlined">schedule</span>
          {language === 'vi' ? 'Sắp diễn ra' : 'Opening countdown'}
        </div>
        <div className="auction-countdown-grid">
          {parts.days > 0 && <CountdownUnit value={parts.days} label={language === 'vi' ? 'Ngày' : 'Days'} />}
          <CountdownUnit value={parts.hours} label={language === 'vi' ? 'Giờ' : 'Hours'} />
          <CountdownUnit value={parts.minutes} label={language === 'vi' ? 'Phút' : 'Mins'} />
          <CountdownUnit value={parts.seconds} label={language === 'vi' ? 'Giây' : 'Secs'} />
        </div>
      </div>
    );
  }

  if (effectiveStatus === 'Ongoing') {
    const diff = Math.max(0, end - now);
    const parts = splitDuration(diff);
    return (
      <div className="auction-countdown-panel live">
        <div className="auction-countdown-label">
          <span className="material-symbols-outlined">bolt</span>
          {language === 'vi' ? 'Đang diễn ra' : 'Live now'}
        </div>
        <div className="auction-countdown-grid compact">
          {parts.days > 0 && <CountdownUnit value={parts.days} label={language === 'vi' ? 'Ngày' : 'Days'} />}
          <CountdownUnit value={parts.hours} label={language === 'vi' ? 'Giờ' : 'Hours'} />
          <CountdownUnit value={parts.minutes} label={language === 'vi' ? 'Phút' : 'Mins'} />
          <CountdownUnit value={parts.seconds} label={language === 'vi' ? 'Giây' : 'Secs'} />
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
  const { t, language, formatCurrency, formatDate } = useLanguage();

  const sortOptions = [
    { value: 'ending_soon', label: language === 'vi' ? 'Sắp kết thúc' : 'Ending Soon' },
    { value: 'starting_soon', label: language === 'vi' ? 'Sắp diễn ra' : 'Starting Soon' },
    { value: 'newest', label: language === 'vi' ? 'Mới nhất' : 'Newest' },
    { value: 'price_asc', label: language === 'vi' ? 'Giá: Thấp đến Cao' : 'Current Bid: Low to High' },
    { value: 'price_desc', label: language === 'vi' ? 'Giá: Cao đến Thấp' : 'Current Bid: High to Low' },
  ];

  const [searchParams, setSearchParams] = useSearchParams();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [realtimeTick, setRealtimeTick] = useState(0);
  const currentTime = Date.now();

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
        showToast(error?.response?.data || t('common.error_occurred'), 'error');
      } finally {
        setLoading(false);
      }
    };

    loadAuctions();
  }, [authLoading, user, page, searchTerm, status, sort, showToast, realtimeTick, t]);

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
        <button disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>{t('common.previous')}</button>
        <span>{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>{t('common.next')}</button>
      </div>
    );
  };

  if (!authLoading && !user) {
    return (
      <div className="auction-page container animate-fade-in">
        <section className="auction-auth-panel">
          <span className="material-symbols-outlined">gavel</span>
          <h1>{t('auction.title')}</h1>
          <p>{t('auth.login_subtitle')}</p>
          <Link to="/login" className="auction-auth-link">{t('auth.login_title')}</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="auction-page container animate-fade-in">
      <section className="auction-page-hero">
        <div>
          <span>{t('home.live_auction')}</span>
          <h1>{t('auction.title')}</h1>
          <p>{t('home.why_choose_subtitle')}</p>
        </div>
      </section>

      <section className="auction-filter-panel">
        <form onSubmit={handleSearchSubmit} className="auction-search-box">
          <span className="material-symbols-outlined">search</span>
          <input name="search" defaultValue={searchTerm} placeholder={t('common.search_placeholder')} />
          <button type="submit">{t('common.search')}</button>
        </form>

        <div className="auction-filter-actions">
          <div className="auction-status-tabs">
            {[
              { key: 'All', label: t('common.all') },
              { key: 'Ongoing', label: t('auction.status_active') },
              { key: 'Upcoming', label: t('auction.status_upcoming') }
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
        {loading ? t('common.loading') : <>{t('common.page')} <strong>{page}</strong> {t('common.of')} <strong>{totalPages}</strong> ({totalItems} {t('nav.auction')})</>}
      </div>

      {loading ? (
        <div className="auction-grid">
          {[...Array(6)].map((_, index) => <div key={index} className="auction-card skeleton" />)}
        </div>
      ) : auctions.length === 0 ? (
        <div className="auction-empty">
          <span className="material-symbols-outlined">search_off</span>
          <h3>{t('common.no_data')}</h3>
          <p>{t('common.error_occurred')}</p>
        </div>
      ) : (
        <div className="auction-grid">
          {auctions.map((auction) => {
            const effectiveStatus = getEffectiveAuctionStatus(auction, currentTime);
            const translatedStatusLabel = effectiveStatus === 'Upcoming' ? t('auction.status_upcoming') : (effectiveStatus === 'Ongoing' ? t('auction.status_active') : t('auction.status_ended'));

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
                  <em className={`auction-card-status ${String(effectiveStatus || '').toLowerCase()}`}>{translatedStatusLabel}</em>
                  {effectiveStatus === 'Upcoming' && (
                    <div className="auction-card-watch-badge">
                      <span className="material-symbols-outlined">notifications_active</span>
                      {t('auction.status_upcoming')}
                    </div>
                  )}
                </div>
                <div className="auction-card-body">
                  <span className="auction-card-category">{auction.categoryName || t('common.none')}</span>
                  <h2>{auction.productName || 'Auction'}</h2>
                  <p>{auction.sellerName || auction.sellerId || 'Seller'}</p>
                  <AuctionCountdown auction={auction} now={currentTime} language={language} />
                  <div className="auction-bid-panel">
                    <div>
                      <small>{t('auction.current_bid')}</small>
                      <strong>{formatCurrency(auction.currentPrice)}</strong>
                    </div>
                    <div>
                      <small>{t('auction.min_step')}</small>
                      <strong>{formatCurrency(auction.minIncrement)}</strong>
                    </div>
                  </div>
                  <div className="auction-card-footer">
                    <span>{getTimeLabel(auction, currentTime, language)}</span>
                    <span>{auction.bidCount || 0} {t('auction.bid_count')}</span>
                  </div>
                  <div className="auction-card-dates">
                    <span>{formatDate(auction.startTime)}</span>
                    <span>{formatDate(auction.endTime)}</span>
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
