import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import auctionService from '../../services/auctionService';
import { createAuctionHubConnection } from '../../services/auctionRealtimeService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { auctionDateTimeLocalToApiValue, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../utils/auctionTime';
import './AuctionWorkspace.css';

const statusOptions = [
  { value: 'All', labelKey: 'admin.auctions.status_all' },
  { value: 'Upcoming', labelKey: 'admin.auctions.status_upcoming' },
  { value: 'Ongoing', labelKey: 'admin.auctions.status_ongoing' },
  { value: 'Ended', labelKey: 'admin.auctions.status_ended' },
];

const DEFAULT_AUCTION_START_OFFSET_MS = 0;
const STATS_PAGE_SIZE = 1;
const conditionKeyMap = {
  New: 'admin.auctions.condition_new',
  LikeNew: 'admin.auctions.condition_like_new',
  Excellent: 'admin.auctions.condition_excellent',
  Good: 'admin.auctions.condition_good',
  Fair: 'admin.auctions.condition_fair',
  Used: 'admin.auctions.condition_used',
  Damaged: 'admin.auctions.condition_damaged',
  ForParts: 'admin.auctions.condition_for_parts',
};

function isEndedStatus(status) {
  return ['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid'].includes(status);
}

function getDefaultForm() {
  return {
    productId: '',
    startingPrice: '',
    minIncrement: '',
    buyNowPrice: '',
    startTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS),
    endTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS + 24 * 60 * 60 * 1000),
  };
}

function getProgress(auction) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const now = Date.now();
  if (!start || !end || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function getStatusClass(status) {
  if (isEndedStatus(status)) return 'ended';
  return String(status || 'unknown').toLowerCase();
}

function getAuctionItems(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.value || [];
}

function getAuctionCount(data) {
  if (Array.isArray(data)) return data.length;
  const count = data?.totalItems ?? data?.totalCount ?? data?.TotalCount ?? data?.['@odata.count'] ?? data?.count;
  if (count !== undefined && count !== null) return Number(count) || 0;
  return getAuctionItems(data).length;
}

function canEditAuction(auction) {
  return !getAuctionEditBlockReasonKey(auction);
}

function getAuctionEditBlockReasonKey(auction) {
  if (!auction) return 'admin.auctions.err_auction_unavailable';
  if (auction.status !== 'Upcoming') return 'admin.auctions.err_edit_upcoming_only';
  if (Number(auction.bidCount || 0) > 0) return 'admin.auctions.err_edit_has_bids';

  const startTime = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  if (!startTime || startTime <= Date.now()) return 'admin.auctions.err_edit_started';

  return '';
}

function toAuctionPayload(form) {
  return {
    startingPrice: Number(form.startingPrice),
    minIncrement: Number(form.minIncrement),
    buyNowPrice: form.buyNowPrice ? Number(form.buyNowPrice) : null,
    startTime: auctionDateTimeLocalToApiValue(form.startTime),
    endTime: auctionDateTimeLocalToApiValue(form.endTime),
  };
}

function validateAuctionForm(form, { requireProduct = false, requireFutureStart = false } = {}) {
  if (requireProduct && !form.productId) return 'admin.auctions.err_select_product';

  const startingPrice = Number(form.startingPrice);
  const minIncrement = Number(form.minIncrement);
  const buyNowPrice = form.buyNowPrice === '' ? null : Number(form.buyNowPrice);
  const start = parseAuctionDateTime(form.startTime);
  const end = parseAuctionDateTime(form.endTime);

  if (!form.startingPrice || Number.isNaN(startingPrice) || startingPrice <= 0) return 'admin.auctions.err_starting_bid';
  if (!form.minIncrement || Number.isNaN(minIncrement) || minIncrement <= 0) return 'admin.auctions.err_bid_step';
  if (form.buyNowPrice === '' || Number.isNaN(buyNowPrice)) return 'admin.auctions.err_buy_now_required';
  if (buyNowPrice <= startingPrice) return 'admin.auctions.err_buy_now_gt_start';
  if (!form.startTime || !start || Number.isNaN(start.getTime())) return 'admin.auctions.err_start_time';
  if (!form.endTime || !end || Number.isNaN(end.getTime())) return 'admin.auctions.err_end_time';
  if (requireFutureStart && start <= new Date()) return 'admin.auctions.err_future_start';
  if (end <= start) return 'admin.auctions.err_end_after_start';

  return '';
}

export default function AuctionWorkspace({ mode = 'seller', title, subtitle }) {
  const isAdmin = mode === 'admin';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState({ total: 0, live: 0, upcoming: 0, ended: 0 });
  const [eligibleProducts, setEligibleProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [form, setForm] = useState(getDefaultForm);
  const [editingAuction, setEditingAuction] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const pageTitle = title || (isAdmin ? t('admin.auctions.hero_title') : t('my_auctions.title'));
  const pageSubtitle = subtitle || (isAdmin ? t('admin.auctions.hero_sub') : t('my_auctions.subtitle'));

  const getStatusLabel = (status) => {
    if (status === 'All') return t('admin.auctions.status_all');
    if (isEndedStatus(status)) return t('admin.auctions.status_ended');

    const labelMap = {
      Upcoming: 'admin.auctions.status_upcoming',
      Ongoing: 'admin.auctions.status_ongoing',
      Cancelled: 'admin.auctions.status_cancelled',
    };

    return t(labelMap[status] || 'admin.auctions.status_unknown');
  };

  const getConditionLabel = (condition) => {
    if (!condition) return t('admin.auctions.condition_unknown');
    const key = conditionKeyMap[condition];
    return key ? t(key) : condition;
  };

  const loadAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        PageSize: isAdmin ? 100 : 50,
        SortBy: 'newest',
        IncludeEnded: isAdmin,
      };
      if (appliedSearchTerm) params.SearchTerm = appliedSearchTerm;
      if (statusFilter !== 'All') params.Status = statusFilter;

      const data = isAdmin
        ? await auctionService.getAll(params)
        : await auctionService.getMyAuctions(params);
      setAuctions(getAuctionItems(data));
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [appliedSearchTerm, isAdmin, showToast, statusFilter, t]);

  const loadAuctionStats = useCallback(async () => {
    try {
      const baseParams = {
        PageSize: STATS_PAGE_SIZE,
        SortBy: 'newest',
        IncludeEnded: isAdmin,
      };

      const fetchCount = async (status) => {
        const params = status ? { ...baseParams, Status: status } : baseParams;
        const data = isAdmin
          ? await auctionService.getAll(params)
          : await auctionService.getMyAuctions(params);
        return getAuctionCount(data);
      };

      const [totalCount, live, upcoming, ended] = await Promise.all([
        fetchCount(),
        fetchCount('Ongoing'),
        fetchCount('Upcoming'),
        fetchCount('Ended'),
      ]);
      const statusTotal = live + upcoming + ended;
      setStats({
        total: Math.max(totalCount, statusTotal),
        live,
        upcoming,
        ended,
      });
    } catch (error) {
      setStats({ total: 0, live: 0, upcoming: 0, ended: 0 });
    }
  }, [isAdmin]);

  const loadEligibleProducts = async () => {
    try {
      const data = await auctionService.getEligibleProducts({ PageSize: 100 });
      setEligibleProducts(data?.items || []);
    } catch (error) {
      setEligibleProducts([]);
    }
  };

  useEffect(() => {
    loadEligibleProducts();
  }, []);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions, realtimeTick]);

  useEffect(() => {
    loadAuctionStats();
  }, [loadAuctionStats, realtimeTick]);

  useEffect(() => {
    if (authLoading || !user) return undefined;

    const connection = createAuctionHubConnection();
    let disposed = false;

    const joinRealtimeGroup = async () => {
      if (disposed || connection.state !== 'Connected') return;
      await connection.invoke(isAdmin ? 'JoinAuctionList' : 'JoinMySellerAuctionGroup');
    };

    const handleAuctionChanged = () => {
      setRealtimeTick((current) => current + 1);
    };

    connection.on(isAdmin ? 'AuctionListChanged' : 'SellerAuctionChanged', handleAuctionChanged);
    connection.onreconnected(() => {
      joinRealtimeGroup().catch(() => {});
    });

    connection.start()
      .then(joinRealtimeGroup)
      .catch(() => {});

    return () => {
      disposed = true;
      connection.off(isAdmin ? 'AuctionListChanged' : 'SellerAuctionChanged', handleAuctionChanged);
      connection.stop().catch(() => {});
    };
  }, [authLoading, user, isAdmin]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const nextSearchTerm = searchTerm.trim();
    if (nextSearchTerm === appliedSearchTerm) {
      loadAuctions();
      return;
    }
    setAppliedSearchTerm(nextSearchTerm);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateAuction = async (event) => {
    event.preventDefault();
    const validationError = validateAuctionForm(form, { requireProduct: true });
    if (validationError) {
      showToast(t(validationError), 'warning');
      return;
    }

    const payload = {
      productId: form.productId,
      ...toAuctionPayload(form),
    };

    try {
      setCreating(true);
      const created = await auctionService.create(payload);
      showToast(t('common.saved_success'), 'success');
      setForm(getDefaultForm());
      await Promise.all([loadEligibleProducts(), loadAuctions(), loadAuctionStats()]);
      if (created?.auctionId) {
        navigate(`/auction/${created.auctionId}`);
      }
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (auction) => {
    const blockReasonKey = getAuctionEditBlockReasonKey(auction);
    if (blockReasonKey) {
      showToast(t(blockReasonKey), 'warning');
      return;
    }
    setEditingAuction(auction);
    setEditForm({
      startingPrice: auction.startingPrice ?? '',
      minIncrement: auction.minIncrement ?? '',
      buyNowPrice: auction.buyNowPrice ?? '',
      startTime: toAuctionDateTimeLocal(auction.startTime),
      endTime: toAuctionDateTimeLocal(auction.endTime),
    });
  };

  const closeEditModal = () => {
    if (creating) return;
    setEditingAuction(null);
    setEditForm(null);
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleUpdateAuction = async (event) => {
    event.preventDefault();
    if (!editingAuction || !editForm) return;
    const validationError = validateAuctionForm(editForm, { requireFutureStart: true });
    if (validationError) {
      showToast(t(validationError), 'warning');
      return;
    }

    try {
      setCreating(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast(t('common.saved_success'), 'success');
      closeEditModal();
      await Promise.all([loadAuctions(), loadAuctionStats()]);
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`auction-workspace ${isAdmin ? 'admin-mode' : 'seller-mode'}`}>
      <header className="auction-workspace-hero">
        <div>
          <span className="auction-workspace-eyebrow">
            {isAdmin ? t('admin.auctions.eyebrow') : t('my_auctions.title')}
          </span>
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>
        <Link to="/auction" className="auction-workspace-live">
          <span className="material-symbols-outlined">open_in_new</span>
          {t('admin.auctions.live_room')}
        </Link>
      </header>

      <section className="auction-stats-grid">
        <article className="total">
          <span className="material-symbols-outlined">gavel</span>
          <div>
            <small>{t('admin.auctions.total_auctions')}</small>
            <strong>{stats.total}</strong>
          </div>
        </article>
        <article className="ongoing">
          <span className="material-symbols-outlined">bolt</span>
          <div>
            <small>{t('admin.auctions.ongoing')}</small>
            <strong>{stats.live}</strong>
          </div>
        </article>
        <article className="upcoming">
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <small>{t('admin.auctions.upcoming')}</small>
            <strong>{stats.upcoming}</strong>
          </div>
        </article>
        <article className="ended">
          <span className="material-symbols-outlined">flag</span>
          <div>
            <small>{t('admin.auctions.ended')}</small>
            <strong>{stats.ended}</strong>
          </div>
        </article>
      </section>

      <div className="auction-workspace-grid">
        {!isAdmin && (
          <section className="auction-create-panel">
            <div className="auction-section-title">
              <div>
                <h2>{t('admin.auctions.create_auction')}</h2>
                <p>{t('admin.auctions.create_sub')}</p>
              </div>
            </div>

            <form onSubmit={handleCreateAuction} className="auction-create-form" noValidate>
              <label>
                <span>{t('admin.auctions.select_product')}</span>
                <select name="productId" value={form.productId} onChange={handleFormChange} required>
                  <option value="">{t('admin.auctions.select_product_placeholder')}</option>
                  {eligibleProducts.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.name} - {product.sellerName || product.sellerId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="auction-form-two">
                <label>
                  <span>{t('admin.auctions.starting_bid')}</span>
                  <input name="startingPrice" type="number" min="1" value={form.startingPrice} onChange={handleFormChange} required />
                </label>
                <label>
                  <span>{t('admin.auctions.bid_step')}</span>
                  <input name="minIncrement" type="number" min="1" value={form.minIncrement} onChange={handleFormChange} required />
                </label>
              </div>

              <div className="auction-form-two">
                <label>
                  <span>{t('admin.auctions.start_time')}</span>
                  <input name="startTime" type="datetime-local" value={form.startTime} onChange={handleFormChange} required />
                </label>
                <label>
                  <span>{t('admin.auctions.end_time')}</span>
                  <input name="endTime" type="datetime-local" value={form.endTime} onChange={handleFormChange} required />
                </label>
              </div>

              <label>
                <span>{t('admin.auctions.buy_now_price')}</span>
                <input name="buyNowPrice" type="number" min="0" value={form.buyNowPrice} onChange={handleFormChange} />
              </label>

              {eligibleProducts.length === 0 && (
                <div className="auction-create-empty">
                  <span className="material-symbols-outlined">inventory_2</span>
                  <p>{t('common.no_data')}</p>
                </div>
              )}

              <button type="submit" className="auction-primary-action" disabled={creating || eligibleProducts.length === 0}>
                {creating ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">add_circle</span>}
                {t('admin.auctions.create_btn')}
              </button>
            </form>
          </section>
        )}

        <section className="auction-list-panel">
          <div className="auction-section-title">
            <div>
              <h2>{isAdmin ? t('admin.auctions.list_title') : t('my_auctions.title')}</h2>
              <p>{isAdmin ? t('admin.auctions.list_sub') : t('my_auctions.subtitle')}</p>
            </div>
          </div>

          <form className="auction-toolbar" onSubmit={handleSearchSubmit}>
            <label className="auction-search-field">
              <span className="material-symbols-outlined">search</span>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('admin.auctions.search_placeholder')} />
            </label>
            <div className="auction-status-filter" aria-label={t('admin.auctions.status_filter')}>
              {statusOptions.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  className={statusFilter === status.value ? 'active' : ''}
                  onClick={() => setStatusFilter(status.value)}
                >
                  {t(status.labelKey)}
                </button>
              ))}
            </div>
            <button type="submit" className="auction-filter-action">
              <span className="material-symbols-outlined">tune</span>
              {t('admin.auctions.apply_filter')}
            </button>
          </form>

          {loading && (
            <div className="auction-list-refresh" aria-live="polite">
              <span className="btn-spinner"></span>
              <span>{t('common.loading')}</span>
            </div>
          )}

          {!loading && auctions.length === 0 ? (
            <div className="auction-table-empty">
              <span className="material-symbols-outlined">gavel</span>
              <h3>{t('admin.auctions.no_auctions')}</h3>
              <p>{t('admin.listings.no_products_sub')}</p>
            </div>
          ) : (
            <div className="auction-workspace-list">
              {auctions.map((auction) => (
                <article key={auction.auctionId} className="auction-workspace-card">
                  <div className="auction-card-media">
                    <img src={auction.productImageUrl || 'https://placehold.co/160'} alt={auction.productName || t('admin.auctions.image_alt')} />
                  </div>
                  <div className="auction-workspace-card-main">
                    <div className="auction-card-title-row">
                      <div>
                        <strong>{auction.productName || t('admin.auctions.unnamed_auction')}</strong>
                        <span>{auction.categoryName || t('admin.auctions.uncategorized')} - {getConditionLabel(auction.condition)}</span>
                      </div>
                      <em className={`auction-status ${getStatusClass(auction.status)}`}>{getStatusLabel(auction.status)}</em>
                    </div>
                    <div className="auction-progress-line">
                      <i><b style={{ width: `${getProgress(auction)}%` }} /></i>
                      <small>{t('admin.auctions.progress', { percent: getProgress(auction) })}</small>
                    </div>
                    <div className="auction-card-metrics">
                      <span>
                        <small>{t('admin.auctions.current_price')}</small>
                        <b>{formatCurrency(auction.currentPrice)}</b>
                      </span>
                      <span>
                        <small>{t('admin.auctions.bid_step')}</small>
                        <b>{formatCurrency(auction.minIncrement)}</b>
                      </span>
                      <span>
                        <small>{t('admin.auctions.bids')}</small>
                        <b>{auction.bidCount || 0}</b>
                      </span>
                    </div>
                    <div className="auction-card-time">
                      <span>
                        <small>{t('admin.auctions.start_time')}</small>
                        <b>{formatDateTime(auction.startTime)}</b>
                      </span>
                      <span>
                        <small>{t('admin.auctions.end_time')}</small>
                        <b>{formatDateTime(auction.endTime)}</b>
                      </span>
                    </div>
                  </div>
                  <div className="auction-workspace-card-actions">
                    <button
                      type="button"
                      onClick={() => navigate(`/auction/${auction.auctionId}`)}
                      title={t('admin.auctions.view_auction')}
                      aria-label={t('admin.auctions.view_auction')}
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(auction)}
                      aria-disabled={!canEditAuction(auction)}
                      title={getAuctionEditBlockReasonKey(auction) ? t(getAuctionEditBlockReasonKey(auction)) : t('admin.auctions.update_auction')}
                      aria-label={t('admin.auctions.update_auction')}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingAuction && editForm && (
        <div className="auction-workspace-modal" role="dialog" aria-modal="true">
          <form className="auction-workspace-modal-card" onSubmit={handleUpdateAuction} noValidate>
            <header>
              <div className="auction-modal-heading">
                <span>{t('admin.auctions.edit_eyebrow')}</span>
                <h2>{t('admin.auctions.update_auction')}</h2>
                <p>{editingAuction.productName}</p>
              </div>
              <button type="button" onClick={closeEditModal} aria-label={t('admin.auctions.close_modal')}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="auction-modal-grid">
              <label>
                <span>{t('admin.auctions.starting_bid')}</span>
                <input name="startingPrice" type="number" min="1" value={editForm.startingPrice} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>{t('admin.auctions.bid_step')}</span>
                <input name="minIncrement" type="number" min="1" value={editForm.minIncrement} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>{t('admin.auctions.start_time')}</span>
                <input name="startTime" type="datetime-local" value={editForm.startTime} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>{t('admin.auctions.end_time')}</span>
                <input name="endTime" type="datetime-local" value={editForm.endTime} onChange={handleEditFormChange} required />
              </label>
              <label className="auction-modal-wide-field">
                <span>{t('admin.auctions.buy_now_price')}</span>
                <input name="buyNowPrice" type="number" min="0" value={editForm.buyNowPrice} onChange={handleEditFormChange} />
              </label>
            </div>

            <footer>
              <button type="button" className="auction-secondary-action" onClick={closeEditModal}>{t('common.cancel')}</button>
              <button type="submit" className="auction-primary-action" disabled={creating}>
                {creating ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">save</span>}
                {t('admin.auctions.save_changes')}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

AuctionWorkspace.propTypes = {
  mode: PropTypes.oneOf(['seller', 'admin']),
  title: PropTypes.string,
  subtitle: PropTypes.string,
};
