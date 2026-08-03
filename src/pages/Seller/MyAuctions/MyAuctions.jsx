import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../../utils/auctionTime';
import SellerPagination from '../../../components/SellerPagination/SellerPagination';
import './MyAuctions.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const DEFAULT_AUCTION_START_OFFSET_MS = 0;
const AUCTION_PAGE_SIZE = 5;

function isEndedStatus(status) {
  return ['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid'].includes(status);
}

function formatMoney(value) {
  if (value == null) return '-';
  return moneyFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  return formatAuctionDateTime(value);
}

function getDefaultCreateForm() {
  return {
    productId: '',
    startingPrice: '',
    minIncrement: '',
    buyNowPrice: '',
    startTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS),
    endTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS + 24 * 60 * 60 * 1000),
  };
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

function getProgress(auction) {
  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;
  const now = Date.now();
  if (!start || !end || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function getAuctionEditBlockReason(auction, t) {
  if (!auction) return t('common.no_data');
  if (auction.status !== 'Upcoming') return t('my_auctions.cancel_error');
  if (Number(auction.bidCount || 0) > 0) return t('auction.err_limit_exceeded');

  const startTime = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  if (!startTime || startTime <= Date.now()) return t('auction.auction_ended');

  return '';
}

function validateAuctionForm(form, { requireProduct = false, requireFutureStart = false }, t) {
  if (requireProduct && !form.productId) return t('validation.required');

  const startingPrice = Number(form.startingPrice);
  const minIncrement = Number(form.minIncrement);
  const buyNowPrice = form.buyNowPrice === '' ? null : Number(form.buyNowPrice);
  const start = parseAuctionDateTime(form.startTime);
  const end = parseAuctionDateTime(form.endTime);

  if (!form.startingPrice || Number.isNaN(startingPrice) || startingPrice <= 0) return t('auction.err_greater_than_zero');
  if (!form.minIncrement || Number.isNaN(minIncrement) || minIncrement <= 0) return t('auction.err_greater_than_zero');
  if (form.buyNowPrice === '' || Number.isNaN(buyNowPrice)) return t('validation.required');
  if (buyNowPrice <= startingPrice) return t('auction.err_buy_now_exceeded');
  if (!form.startTime || !start || Number.isNaN(start.getTime())) return t('validation.required');
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (requireFutureStart && start < todayStart) return t('auction.err_future_start');
  if (end <= start) return t('validation.required');

  return '';
}

export default function MyAuctions() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [auctions, setAuctions] = useState([]);
  const [eligibleProducts, setEligibleProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [createForm, setCreateForm] = useState(getDefaultCreateForm);
  const [editingAuction, setEditingAuction] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [endingAuction, setEndingAuction] = useState(null);
  const [relistingAuction, setRelistingAuction] = useState(null);
  const [relistForm, setRelistForm] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [auctionPage, setAuctionPage] = useState(1);
  const [auctionTotalPages, setAuctionTotalPages] = useState(1);
  const [auctionTotalItems, setAuctionTotalItems] = useState(0);
  const [auctionStats, setAuctionStats] = useState({
    total: 0,
    upcoming: 0,
    ongoing: 0,
    ended: 0,
  });

  const statusOptions = useMemo(() => [
    { value: 'All', label: t('common.all') },
    { value: 'Upcoming', label: t('my_auctions.tab_upcoming') },
    { value: 'Ongoing', label: t('my_auctions.tab_active') },
    { value: 'Ended', label: t('my_auctions.tab_ended') },
  ], [t]);

  const stats = auctionStats;

  useEffect(() => {
    setAuctionPage((current) => Math.min(current, auctionTotalPages));
  }, [auctionTotalPages]);

  const loadAuctions = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        PageSize: AUCTION_PAGE_SIZE,
        Page: page,
        SortBy: 'newest',
      };
      if (submittedSearchTerm) params.SearchTerm = submittedSearchTerm;
      if (statusFilter !== 'All') params.Status = statusFilter;
      const data = await auctionService.getMyAuctions(params);
      setAuctions(data?.items || []);
      const totalItems = data?.totalItems ?? data?.totalCount ?? 0;
      setAuctionTotalItems(totalItems);
      const totalPages = data?.totalPages ?? (totalItems ? Math.ceil(totalItems / AUCTION_PAGE_SIZE) : 1);
      setAuctionTotalPages(Math.max(1, totalPages));
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, submittedSearchTerm, showToast, t]);

  const loadAuctionStats = useCallback(async () => {
    try {
      const baseParams = {
        PageSize: 1,
        Page: 1,
        SortBy: 'newest',
      };
      if (submittedSearchTerm) baseParams.SearchTerm = submittedSearchTerm;

      const [allData, upcomingData, ongoingData, endedData] = await Promise.all([
        auctionService.getMyAuctions(baseParams),
        auctionService.getMyAuctions({ ...baseParams, Status: 'Upcoming' }),
        auctionService.getMyAuctions({ ...baseParams, Status: 'Ongoing' }),
        auctionService.getMyAuctions({ ...baseParams, Status: 'Ended' }),
      ]);

      const getTotal = (data) => data?.totalItems ?? data?.totalCount ?? 0;
      setAuctionStats({
        total: getTotal(allData),
        upcoming: getTotal(upcomingData),
        ongoing: getTotal(ongoingData),
        ended: getTotal(endedData),
      });
    } catch {
      setAuctionStats((current) => current);
    }
  }, [submittedSearchTerm]);

  const loadEligibleProducts = async () => {
    try {
      const data = await auctionService.getEligibleProducts({ PageSize: 100 });
      setEligibleProducts(data?.items || []);
    } catch {
      setEligibleProducts([]);
    }
  };

  useEffect(() => {
    loadEligibleProducts();
  }, []);

  useEffect(() => {
    loadAuctions(auctionPage);
  }, [auctionPage, realtimeTick, loadAuctions]);

  useEffect(() => {
    loadAuctionStats();
  }, [realtimeTick, loadAuctionStats]);

  useEffect(() => {
    if (authLoading || !user) return undefined;

    const connection = createAuctionHubConnection();
    let disposed = false;

    const joinSellerAuctions = async () => {
      if (disposed || connection.state !== 'Connected') return;
      await connection.invoke('JoinMySellerAuctionGroup');
    };

    const handleSellerAuctionChanged = () => {
      setRealtimeTick((current) => current + 1);
    };

    connection.on('SellerAuctionChanged', handleSellerAuctionChanged);
    connection.onreconnected(() => {
      joinSellerAuctions().catch(() => {});
    });

    connection.start()
      .then(joinSellerAuctions)
      .catch(() => {});

    return () => {
      disposed = true;
      connection.off('SellerAuctionChanged', handleSellerAuctionChanged);
      connection.stop().catch(() => {});
    };
  }, [authLoading, user]);

  const handleCreateChange = (event) => {
    const { name, value } = event.target;
    setCreateForm((current) => ({ ...current, [name]: value }));
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const validationError = validateAuctionForm(createForm, { requireProduct: true }, t);
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }

    try {
      setSaving(true);
      await auctionService.create({
        productId: createForm.productId,
        ...toAuctionPayload(createForm),
      });
      showToast(t('toast.saved_success'), 'success');
      setCreateForm(getDefaultCreateForm());
      setIsCreateModalOpen(false);
      setAuctionPage(1);
      await Promise.all([loadEligibleProducts(), loadAuctions(1), loadAuctionStats()]);
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (auction) => {
    const blockReason = getAuctionEditBlockReason(auction, t);
    if (blockReason) {
      showToast(blockReason, 'warning');
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
    if (saving) return;
    setEditingAuction(null);
    setEditForm(null);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingAuction || !editForm) return;
    const validationError = validateAuctionForm(editForm, { requireFutureStart: true }, t);
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }

    try {
      setSaving(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast(t('toast.saved_success'), 'success');
      closeEditModal();
      await Promise.all([loadAuctions(auctionPage), loadAuctionStats()]);
    } catch (error) {
      showToast(error?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEndModal = (auction) => {
    setEndingAuction(auction);
  };

  const closeEndModal = () => {
    if (saving) return;
    setEndingAuction(null);
  };

  const handleEndAuctionConfirm = async () => {
    if (!endingAuction) return;
    try {
      setSaving(true);
      await auctionService.endAuction(endingAuction.auctionId);
      showToast(t('my_auctions.end_success'), 'success');
      closeEndModal();
      await Promise.all([loadAuctions(auctionPage), loadAuctionStats()]);
    } catch (error) {
      showToast(error?.response?.data || t('my_auctions.end_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openRelistModal = (auction) => {
    setRelistingAuction(auction);
    setRelistForm({
      startingPrice: auction.startingPrice ?? '',
      minIncrement: auction.minIncrement ?? '',
      buyNowPrice: auction.buyNowPrice ?? '',
      startTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS),
      endTime: getFutureAuctionDateTimeLocal(DEFAULT_AUCTION_START_OFFSET_MS + 24 * 60 * 60 * 1000),
    });
  };

  const closeRelistModal = () => {
    if (saving) return;
    setRelistingAuction(null);
    setRelistForm(null);
  };

  const handleRelistChange = (event) => {
    const { name, value } = event.target;
    setRelistForm((current) => ({ ...current, [name]: value }));
  };

  const handleRelist = async (event) => {
    event.preventDefault();
    if (!relistingAuction || !relistForm) return;
    const validationError = validateAuctionForm(relistForm, { requireFutureStart: true }, t);
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }

    try {
      setSaving(true);
      await auctionService.relistAuction(relistingAuction.auctionId, toAuctionPayload(relistForm));
      showToast(t('my_auctions.relist_success'), 'success');
      closeRelistModal();
      await Promise.all([loadAuctions(auctionPage), loadAuctionStats()]);
    } catch (error) {
      showToast(error?.response?.data || t('my_auctions.relist_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAuctionPage(1);
    setSubmittedSearchTerm(searchTerm.trim());
  };

  const getAuctionStatusText = (status) => {
    switch (status) {
      case 'Upcoming': return t('my_auctions.tab_upcoming');
      case 'Ongoing': return t('my_auctions.tab_active');
      case 'Ended': case 'EndedByBuyNow': case 'EndedByTime': case 'EndedNoBid':
        return t('my_auctions.tab_ended');
      default: return status;
    }
  };

  return (
    <>
      <div className="seller-auctions-page animate-fade-in">
        {loading && (
          <div className="seller-auctions-loader">
            <span className="btn-spinner"></span>
          </div>
        )}

        <header className="seller-dash-header">
          <div>
            <h1>{t('my_auctions.title')}</h1>
            <p>{t('my_auctions.subtitle')}</p>
          </div>
          <button
            type="button"
            className="seller-list-btn"
            onClick={openCreateModal}
          >
            <span className="material-symbols-outlined">add</span>{t('my_auctions.create_auction_btn')}
          </button>
        </header>

        <section className="seller-auctions-stat-grid">
          <article><small>{t('common.all')}</small><strong>{stats.total}</strong></article>
          <article><small>{t('my_auctions.tab_upcoming')}</small><strong>{stats.upcoming}</strong></article>
          <article><small>{t('my_auctions.tab_active')}</small><strong>{stats.ongoing}</strong></article>
          <article><small>{t('my_auctions.tab_ended')}</small><strong>{stats.ended}</strong></article>
        </section>

        <div className="seller-auctions-layout" style={{ gridTemplateColumns: '1fr' }}>
          <section className="seller-auctions-list-panel">
          <div className="seller-auctions-section-head split">
            <div>
              <h2>{t('my_auctions.title')}</h2>
              <p>{t('my_auctions.subtitle')}</p>
            </div>
          </div>

          <div className="seller-auctions-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="seller-auctions-tabs" style={{ display: 'flex', gap: '8px' }}>
              {statusOptions.map((opt) => {
                const status = opt.value;
                const count = status === 'All' ? stats.total :
                              status === 'Upcoming' ? stats.upcoming :
                              status === 'Ongoing' ? stats.ongoing : stats.ended;
                
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setAuctionPage(1);
                      setStatusFilter(status);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '999px',
                      fontSize: '13px',
                      fontWeight: 700,
                      border: '1px solid var(--border-color)',
                      background: statusFilter === status ? 'var(--primary)' : '#ffffff',
                      color: statusFilter === status ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: statusFilter === status ? '0 4px 12px rgba(153, 27, 27, 0.2)' : 'none'
                    }}
                  >
                    {opt.label} ({count})
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '320px', position: 'relative' }}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('common.search_placeholder')}
                style={{
                  width: '100%',
                  padding: '10px 16px 10px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '20px' }}>
                search
              </span>
            </form>
          </div>

          {auctions.length === 0 ? (
            <div className="seller-auctions-empty">
              <span className="material-symbols-outlined">gavel</span>
              <h3>{t('common.no_data')}</h3>
              <p>{t('my_auctions.subtitle')}</p>
            </div>
          ) : (
            <div className="seller-auctions-list">
              {auctions.map((auction) => {
                const progress = getProgress(auction);
                return (
                  <article key={auction.auctionId} className="seller-auctions-row">
                    <img src={auction.productImageUrl || 'https://placehold.co/140'} alt={auction.productName || t('nav.auction')} />
                    <div className="seller-auctions-row-main">
                      <div className="seller-auctions-row-top">
                        <div>
                          <strong>{auction.productName || t('nav.auction')}</strong>
                          <span>{auction.categoryName || t('common.none')} - {auction.auctionId}</span>
                        </div>
                        <em className={`seller-auctions-status ${String(auction.status || '').toLowerCase()}`}>{getAuctionStatusText(auction.status)}</em>
                      </div>
                      <div className="seller-auctions-progress">
                        <i><b style={{ width: `${progress}%` }} /></i>
                        <small>{progress}%</small>
                      </div>
                      <div className="seller-auctions-meta">
                        <span>{t('auction.current_bid')} <b>{formatMoney(auction.currentPrice)}</b></span>
                        <span>{t('auction.min_step')} <b>{formatMoney(auction.minIncrement)}</b></span>
                        <span>{t('auction.bid_count')} <b>{auction.bidCount || 0}</b></span>
                      </div>
                      <div className="seller-auctions-time">
                        <span>{formatDateTime(auction.startTime)}</span>
                        <span>{formatDateTime(auction.endTime)}</span>
                      </div>
                    </div>
                    <div className="seller-auctions-actions">
                      <Link to={`/auction/${auction.auctionId}`} className="btn-secondary">
                        {t('auction.title')}
                      </Link>
                      {auction.status === 'Upcoming' && Number(auction.bidCount || 0) === 0 && (
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => openEditModal(auction)}
                        >
                          {t('common.edit')}
                        </button>
                      )}
                      {auction.status === 'Ongoing' && (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                          onClick={() => openEndModal(auction)}
                          disabled={saving}
                        >
                          {t('my_auctions.end_auction')}
                        </button>
                      )}
                      {(auction.status === 'EndedNoBid' || (isEndedStatus(auction.status) && Number(auction.bidCount || 0) === 0)) && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => openRelistModal(auction)}
                          disabled={saving}
                        >
                          {t('my_auctions.relist_auction')}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <SellerPagination
            page={auctionPage}
            totalPages={auctionTotalPages}
            pageSize={AUCTION_PAGE_SIZE}
            totalItems={auctionTotalItems}
            disabled={loading}
            onPageChange={setAuctionPage}
          />
        </section>
      </div>
    </div>

    {/* Create Auction Modal */}
    {isCreateModalOpen && (
      <div className="seller-auctions-modal-overlay">
        <div className="seller-auctions-modal-content animate-fade-in">
          <div className="modal-header">
            <h3>{t('my_auctions.create_auction_btn')}</h3>
            <button className="close-btn" onClick={() => !saving && setIsCreateModalOpen(false)}>×</button>
          </div>
          <form onSubmit={handleCreate} className="modal-body">
            <div className="form-group">
              <label>{t('my_auctions.th_product')} *</label>
              <select
                name="productId"
                value={createForm.productId}
                onChange={handleCreateChange}
                required
              >
                <option value="">{t('common.select')}</option>
                {eligibleProducts.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.productId})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.starting_price')} (VND) *</label>
                <input
                  type="number"
                  name="startingPrice"
                  value={createForm.startingPrice}
                  onChange={handleCreateChange}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>{t('auction.min_step')} (VND) *</label>
                <input
                  type="number"
                  name="minIncrement"
                  value={createForm.minIncrement}
                  onChange={handleCreateChange}
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('auction.buy_now_price')} (VND) *</label>
              <input
                type="number"
                name="buyNowPrice"
                value={createForm.buyNowPrice}
                onChange={handleCreateChange}
                required
                min="1"
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.start_time')} *</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={createForm.startTime}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('auction.end_time')} *</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={createForm.endTime}
                  onChange={handleCreateChange}
                  min={createForm.startTime || undefined}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={saving}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('my_auctions.create_auction_btn')}</button>
            </div>
          </form>
        </div>
      </div>
    )}
    {editingAuction && editForm && (
      <div className="seller-auctions-modal-overlay">
        <div className="seller-auctions-modal-content animate-fade-in">
          <div className="modal-header">
            <h3>{t('common.edit')}</h3>
            <button className="close-btn" onClick={closeEditModal}>×</button>
          </div>
          <form onSubmit={handleUpdate} className="modal-body">
            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.starting_price')} (VND) *</label>
                <input
                  type="number"
                  name="startingPrice"
                  value={editForm.startingPrice}
                  onChange={handleEditChange}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>{t('auction.min_step')} (VND) *</label>
                <input
                  type="number"
                  name="minIncrement"
                  value={editForm.minIncrement}
                  onChange={handleEditChange}
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('auction.buy_now_price')} (VND) *</label>
              <input
                type="number"
                name="buyNowPrice"
                value={editForm.buyNowPrice}
                onChange={handleEditChange}
                required
                min="1"
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.start_time')} *</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={editForm.startTime}
                  onChange={handleEditChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('auction.end_time')} *</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={editForm.endTime}
                  onChange={handleEditChange}
                  min={editForm.startTime || undefined}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={saving}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Relist Auction Modal */}
    {relistingAuction && relistForm && (
      <div className="seller-auctions-modal-overlay">
        <div className="seller-auctions-modal-content animate-fade-in">
          <div className="modal-header">
            <h3>{t('my_auctions.relist_title')} - {relistingAuction.productName}</h3>
            <button className="close-btn" onClick={closeRelistModal}>×</button>
          </div>
          <form onSubmit={handleRelist} className="modal-body">
            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.starting_price')} (VND) *</label>
                <input
                  type="number"
                  name="startingPrice"
                  value={relistForm.startingPrice}
                  onChange={handleRelistChange}
                  required
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>{t('auction.min_step')} (VND) *</label>
                <input
                  type="number"
                  name="minIncrement"
                  value={relistForm.minIncrement}
                  onChange={handleRelistChange}
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t('auction.buy_now_price')} (VND) *</label>
              <input
                type="number"
                name="buyNowPrice"
                value={relistForm.buyNowPrice}
                onChange={handleRelistChange}
                required
                min="1"
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{t('auction.start_time')} *</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={relistForm.startTime}
                  onChange={handleRelistChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('auction.end_time')} *</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={relistForm.endTime}
                  onChange={handleRelistChange}
                  min={relistForm.startTime || undefined}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeRelistModal} disabled={saving}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t('common.saving') : t('my_auctions.relist_auction')}</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* End Auction Confirmation Modal */}
    {endingAuction && (
      <div className="seller-auctions-modal-overlay">
        <div className="seller-auctions-modal-content animate-fade-in" style={{ maxWidth: '440px' }}>
          <div className="modal-header">
            <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>warning</span>
              {t('my_auctions.end_auction')}
            </h3>
            <button className="close-btn" onClick={closeEndModal} disabled={saving}>×</button>
          </div>
          <div className="modal-body" style={{ padding: '20px 24px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {t('my_auctions.confirm_end_msg')}
            </p>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn-secondary" onClick={closeEndModal} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              onClick={handleEndAuctionConfirm}
              disabled={saving}
            >
              {saving ? t('common.submitting') : t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
