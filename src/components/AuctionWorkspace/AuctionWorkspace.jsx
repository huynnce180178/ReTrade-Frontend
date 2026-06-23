import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import auctionService from '../../services/auctionService';
import { createAuctionHubConnection } from '../../services/auctionRealtimeService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../utils/auctionTime';
import './AuctionWorkspace.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const statusOptions = ['All', 'Upcoming', 'Ongoing', 'Ended'];

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

function getDefaultForm() {
  return {
    productId: '',
    startingPrice: '',
    minIncrement: '',
    buyNowPrice: '',
    startTime: getFutureAuctionDateTimeLocal(0),
    endTime: getFutureAuctionDateTimeLocal(24 * 60 * 60 * 1000),
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
  return auction?.status === 'Upcoming' && Number(auction.bidCount || 0) === 0 && (parseAuctionDateTime(auction.startTime)?.getTime() || 0) > Date.now();
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

export default function AuctionWorkspace({ mode = 'seller', title, subtitle }) {
  const isAdmin = mode === 'admin';
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
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
      showToast(error?.response?.data || 'Failed to load auctions.', 'error');
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
    if (!form.productId) {
      showToast('Please select an auction-ready product.', 'warning');
      return;
    }

    const payload = {
      productId: form.productId,
      ...toAuctionPayload(form),
    };

    try {
      setCreating(true);
      const created = await auctionService.create(payload);
      showToast('Auction created successfully.', 'success');
      setForm(getDefaultForm());
      await Promise.all([loadEligibleProducts(), loadAuctions()]);
      if (created?.auctionId) {
        navigate(`/auction/${created.auctionId}`);
      }
    } catch (error) {
      showToast(error?.response?.data || 'Failed to create auction.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (auction) => {
    if (!canEditAuction(auction)) {
      showToast('Only upcoming auctions without bids can be updated.', 'warning');
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

    try {
      setCreating(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast('Auction updated successfully.', 'success');
      closeEditModal();
      await loadAuctions();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update auction.', 'error');
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
          <span>{isAdmin ? 'Auction Control' : 'Seller Auctions'}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <Link to="/auction" className="auction-workspace-live">
          <span className="material-symbols-outlined">open_in_new</span>
          Auction Room
        </Link>
      </header>

      <section className="auction-stats-grid">
        <article>
          <span className="material-symbols-outlined">gavel</span>
          <div>
            <small>Total Auctions</small>
            <strong>{stats.total}</strong>
          </div>
        </article>
        <article>
          <span className="material-symbols-outlined">bolt</span>
          <div>
            <small>Ongoing</small>
            <strong>{stats.live}</strong>
          </div>
        </article>
        <article>
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <small>Upcoming</small>
            <strong>{stats.upcoming}</strong>
          </div>
        </article>
        <article>
          <span className="material-symbols-outlined">flag</span>
          <div>
            <small>Ended</small>
            <strong>{stats.ended}</strong>
          </div>
        </article>
      </section>

      <div className="auction-workspace-grid">
        {!isAdmin && (
          <section className="auction-create-panel">
            <div className="auction-section-title">
              <div>
                <h2>Create Auction</h2>
                <p>Select a product approved for auction and configure the room.</p>
              </div>
            </div>

            <form onSubmit={handleCreateAuction} className="auction-create-form">
              <label>
                <span>Auction Product</span>
                <select name="productId" value={form.productId} onChange={handleFormChange} required>
                  <option value="">Select ready product</option>
                  {eligibleProducts.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.name} - {product.sellerName || product.sellerId}
                    </option>
                  ))}
                </select>
              </label>

              <div className="auction-form-two">
                <label>
                  <span>Starting Bid</span>
                  <input name="startingPrice" type="number" min="1" value={form.startingPrice} onChange={handleFormChange} required />
                </label>
                <label>
                  <span>Bid Step</span>
                  <input name="minIncrement" type="number" min="1" value={form.minIncrement} onChange={handleFormChange} required />
                </label>
              </div>

              <div className="auction-form-two">
                <label>
                  <span>Buy Now Price</span>
                  <input name="buyNowPrice" type="number" min="0" value={form.buyNowPrice} onChange={handleFormChange} />
                </label>
              </div>

              <div className="auction-form-two">
                <label>
                  <span>Start Time</span>
                  <input name="startTime" type="datetime-local" value={form.startTime} onChange={handleFormChange} required />
                </label>
                <label>
                  <span>End Time</span>
                  <input name="endTime" type="datetime-local" value={form.endTime} onChange={handleFormChange} required />
                </label>
              </div>

              {eligibleProducts.length === 0 && (
                <div className="auction-create-empty">
                  <span className="material-symbols-outlined">inventory_2</span>
                  <p>No ready auction products available.</p>
                </div>
              )}

              <button type="submit" className="auction-primary-action" disabled={creating || eligibleProducts.length === 0}>
                {creating ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">add_circle</span>}
                Create Auction
              </button>
            </form>
          </section>
        )}

        <section className="auction-list-panel">
          <div className="auction-section-title">
            <div>
              <h2>{isAdmin ? 'Auction Listings' : 'My Auction List'}</h2>
              <p>{isAdmin ? 'Monitor all platform auctions.' : 'Track every auction you have created.'}</p>
            </div>
          </div>

          <form className="auction-toolbar" onSubmit={handleSearchSubmit}>
            <label>
              <span className="material-symbols-outlined">search</span>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search auctions..." />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="submit">
              <span className="material-symbols-outlined">tune</span>
              Apply
            </button>
          </form>

          {auctions.length === 0 ? (
            <div className="auction-table-empty">
              <span className="material-symbols-outlined">gavel</span>
              <h3>No auctions found</h3>
              <p>Create a new auction or adjust your filters.</p>
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
                      <small>{getProgress(auction)}% progress</small>
                    </div>
                    <div className="auction-card-meta">
                      <span>Current <b>{formatMoney(auction.currentPrice)}</b></span>
                      <span>Step <b>{formatMoney(auction.minIncrement)}</b></span>
                      <span>Bids <b>{auction.bidCount || 0}</b></span>
                    </div>
                    <div className="auction-card-time">
                      <span>{formatDateTime(auction.startTime)}</span>
                      <span>{formatDateTime(auction.endTime)}</span>
                    </div>
                  </div>
                  <div className="auction-workspace-card-actions">
                    <button type="button" onClick={() => navigate(`/auction/${auction.auctionId}`)} title="View detail">
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button type="button" onClick={() => openEditModal(auction)} disabled={!canEditAuction(auction)} title="Update auction">
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
          <form className="auction-workspace-modal-card" onSubmit={handleUpdateAuction}>
            <header>
              <div>
                <h2>Update Auction</h2>
                <p>{editingAuction.productName}</p>
              </div>
              <button type="button" onClick={closeEditModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="auction-form-two">
              <label>
                <span>Starting Bid</span>
                <input name="startingPrice" type="number" min="1" value={editForm.startingPrice} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>Bid Step</span>
                <input name="minIncrement" type="number" min="1" value={editForm.minIncrement} onChange={handleEditFormChange} required />
              </label>
            </div>

            <div className="auction-form-two">
              <label>
                <span>Buy Now Price</span>
                <input name="buyNowPrice" type="number" min="0" value={editForm.buyNowPrice} onChange={handleEditFormChange} />
              </label>
            </div>

            <div className="auction-form-two">
              <label>
                <span>Start Time</span>
                <input name="startTime" type="datetime-local" value={editForm.startTime} onChange={handleEditFormChange} required />
              </label>
              <label>
                <span>End Time</span>
                <input name="endTime" type="datetime-local" value={editForm.endTime} onChange={handleEditFormChange} required />
              </label>
            </div>

            <footer>
              <button type="button" className="auction-secondary-action" onClick={closeEditModal}>Cancel</button>
              <button type="submit" className="auction-primary-action" disabled={creating}>
                {creating ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">save</span>}
                Save Changes
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
