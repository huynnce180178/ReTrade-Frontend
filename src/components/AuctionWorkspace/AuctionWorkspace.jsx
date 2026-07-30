import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import auctionService from '../../services/auctionService';
import { createAuctionHubConnection } from '../../services/auctionRealtimeService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../utils/auctionTime';
import './AuctionWorkspace.css';

const statusOptions = ['All', 'Upcoming', 'Ongoing', 'Ended'];
const DEFAULT_AUCTION_START_OFFSET_MS = 0;

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
  return isEndedStatus(status) ? 'ended' : String(status || '').toLowerCase();
}

function canEditAuction(auction) {
  return !getAuctionEditBlockReason(auction);
}

function getAuctionEditBlockReason(auction) {
  if (!auction) return 'Auction data is not available.';
  if (auction.status !== 'Upcoming') return 'Only upcoming auctions can be updated.';
  if (Number(auction.bidCount || 0) > 0) return 'Auctions with existing bids cannot be updated.';

  const startTime = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  if (!startTime || startTime <= Date.now()) return 'Auction start time has passed.';

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
  if (requireProduct && !form.productId) return 'Please select an auction-ready product.';

  const startingPrice = Number(form.startingPrice);
  const minIncrement = Number(form.minIncrement);
  const buyNowPrice = form.buyNowPrice === '' ? null : Number(form.buyNowPrice);
  const start = parseAuctionDateTime(form.startTime);
  const end = parseAuctionDateTime(form.endTime);

  if (!form.startingPrice || Number.isNaN(startingPrice) || startingPrice <= 0) return 'Starting bid must be greater than 0.';
  if (!form.minIncrement || Number.isNaN(minIncrement) || minIncrement <= 0) return 'Bid step must be greater than 0.';
  if (form.buyNowPrice === '' || Number.isNaN(buyNowPrice)) return 'Buy now price is required.';
  if (buyNowPrice <= startingPrice) return 'Buy now price must be greater than the starting bid.';
  if (!form.startTime || !start || Number.isNaN(start.getTime())) return 'Please choose a valid start time.';
  if (!form.endTime || !end || Number.isNaN(end.getTime())) return 'Please choose a valid end time.';
  if (requireFutureStart && start <= new Date()) return 'Start time must remain in the future.';
  if (end <= start) return 'End time must be after start time.';

  return '';
}

export default function AuctionWorkspace({ mode = 'seller', title, subtitle }) {
  const isAdmin = mode === 'admin';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [auctions, setAuctions] = useState([]);
  const [eligibleProducts, setEligibleProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [form, setForm] = useState(getDefaultForm);
  const [editingAuction, setEditingAuction] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const stats = useMemo(() => {
    const total = auctions.length;
    const live = auctions.filter(a => a.status === 'Ongoing').length;
    const upcoming = auctions.filter(a => a.status === 'Upcoming').length;
    const ended = auctions.filter(a => isEndedStatus(a.status)).length;
    return { total, live, upcoming, ended };
  }, [auctions]);

  const loadAuctions = async () => {
    try {
      setLoading(true);
      const params = {
        PageSize: isAdmin ? 100 : 50,
        SortBy: 'newest',
        IncludeEnded: isAdmin,
      };
      if (searchTerm.trim()) params.SearchTerm = searchTerm.trim();
      if (statusFilter !== 'All') params.Status = statusFilter;

      const data = isAdmin
        ? await auctionService.getAll(params)
        : await auctionService.getMyAuctions(params);
      setAuctions(data?.items || []);
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

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
  }, [statusFilter, realtimeTick]);

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
    loadAuctions();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreateAuction = async (event) => {
    event.preventDefault();
    const validationError = validateAuctionForm(form, { requireProduct: true });
    if (validationError) {
      showToast(validationError, 'warning');
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
      await Promise.all([loadEligibleProducts(), loadAuctions()]);
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
    const blockReason = getAuctionEditBlockReason(auction);
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
      showToast(validationError, 'warning');
      return;
    }

    try {
      setCreating(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast(t('common.saved_success'), 'success');
      closeEditModal();
      await loadAuctions();
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`auction-workspace ${isAdmin ? 'admin-mode' : 'seller-mode'}`}>
      {loading && (
        <div className="auction-workspace-loader">
          <span className="btn-spinner"></span>
        </div>
      )}

      <header className="auction-workspace-hero">
        <div>
          <span>{isAdmin ? t('admin.auctions.hero_title') : 'Seller Auctions'}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <Link to="/auction" className="auction-workspace-live">
          <span className="material-symbols-outlined">open_in_new</span>
          {t('admin.auctions.live_room')}
        </Link>
      </header>

      <section className="auction-stats-grid">
        <article>
          <span className="material-symbols-outlined">gavel</span>
          <div>
            <small>{t('admin.auctions.total_auctions')}</small>
            <strong>{stats.total}</strong>
          </div>
        </article>
        <article>
          <span className="material-symbols-outlined">bolt</span>
          <div>
            <small>{t('admin.auctions.ongoing')}</small>
            <strong>{stats.live}</strong>
          </div>
        </article>
        <article>
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <small>{t('admin.auctions.upcoming')}</small>
            <strong>{stats.upcoming}</strong>
          </div>
        </article>
        <article>
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
              <h2>{isAdmin ? t('admin.auctions.list_title') : 'My Auction List'}</h2>
              <p>{isAdmin ? t('admin.auctions.list_sub') : 'Track every auction you have created.'}</p>
            </div>
          </div>

          <form className="auction-toolbar" onSubmit={handleSearchSubmit}>
            <label>
              <span className="material-symbols-outlined">search</span>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('admin.auctions.search_placeholder')} />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="submit">
              <span className="material-symbols-outlined">tune</span>
              {t('admin.auctions.apply_filter')}
            </button>
          </form>

          {auctions.length === 0 ? (
            <div className="auction-table-empty">
              <span className="material-symbols-outlined">gavel</span>
              <h3>{t('admin.auctions.no_auctions')}</h3>
              <p>{t('admin.listings.no_products_sub')}</p>
            </div>
          ) : (
            <div className="auction-workspace-list">
              {auctions.map((auction) => (
                <article key={auction.auctionId} className="auction-workspace-card">
                  <img src={auction.productImageUrl || 'https://placehold.co/160'} alt={auction.productName || 'Auction'} />
                  <div className="auction-workspace-card-main">
                    <div className="auction-card-title-row">
                      <div>
                        <strong>{auction.productName || 'Unnamed auction'}</strong>
                        <span>{auction.categoryName || 'Uncategorized'} - {auction.condition || 'No condition'}</span>
                      </div>
                      <em className={`auction-status ${getStatusClass(auction.status)}`}>{auction.status}</em>
                    </div>
                    <div className="auction-progress-line">
                      <i><b style={{ width: `${getProgress(auction)}%` }} /></i>
                      <small>{t('admin.auctions.progress', { percent: getProgress(auction) })}</small>
                    </div>
                    <div className="auction-card-meta">
                      <span>{t('admin.auctions.current_price')} <b>{formatCurrency(auction.currentPrice)}</b></span>
                      <span>{t('admin.auctions.bid_step')} <b>{formatCurrency(auction.minIncrement)}</b></span>
                      <span>Bids <b>{auction.bidCount || 0}</b></span>
                    </div>
                    <div className="auction-card-time">
                      <span>{formatDateTime(auction.startTime)}</span>
                      <span>{formatDateTime(auction.endTime)}</span>
                    </div>
                  </div>
                  <div className="auction-workspace-card-actions">
                    <button type="button" onClick={() => navigate(`/auction/${auction.auctionId}`)} title={t('admin.users.detail')}>
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(auction)}
                      aria-disabled={!canEditAuction(auction)}
                      title={getAuctionEditBlockReason(auction) || t('admin.auctions.update_auction')}
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
              <div>
                <h2>{t('admin.auctions.update_auction')}</h2>
                <p>{editingAuction.productName}</p>
              </div>
              <button type="button" onClick={closeEditModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="auction-form-two">
              <label>
                <span>{t('admin.auctions.starting_bid')}</span>
                <input name="startingPrice" type="number" min="1" value={editForm.startingPrice} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>{t('admin.auctions.bid_step')}</span>
                <input name="minIncrement" type="number" min="1" value={editForm.minIncrement} onChange={handleEditFormChange} required />
              </label>
            </div>

            <div className="auction-form-two">
              <label>
                <span>{t('admin.auctions.start_time')}</span>
                <input name="startTime" type="datetime-local" value={editForm.startTime} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>{t('admin.auctions.end_time')}</span>
                <input name="endTime" type="datetime-local" value={editForm.endTime} onChange={handleEditFormChange} required />
              </label>
            </div>

            <label>
              <span>{t('admin.auctions.buy_now_price')}</span>
              <input name="buyNowPrice" type="number" min="0" value={editForm.buyNowPrice} onChange={handleEditFormChange} />
            </label>

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

