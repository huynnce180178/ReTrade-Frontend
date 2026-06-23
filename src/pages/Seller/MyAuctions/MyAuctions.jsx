import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../../utils/auctionTime';
import './MyAuctions.css';

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

function getDefaultCreateForm() {
  return {
    productId: '',
    startingPrice: '',
    minIncrement: '',
    buyNowPrice: '',
    startTime: getFutureAuctionDateTimeLocal(0),
    endTime: getFutureAuctionDateTimeLocal(24 * 60 * 60 * 1000),
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

function canEditAuction(auction) {
  return auction?.status === 'Upcoming' && Number(auction.bidCount || 0) === 0 && (parseAuctionDateTime(auction.startTime)?.getTime() || 0) > Date.now();
}

export default function MyAuctions() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [auctions, setAuctions] = useState([]);
  const [eligibleProducts, setEligibleProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [createForm, setCreateForm] = useState(getDefaultCreateForm);
  const [editingAuction, setEditingAuction] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const stats = useMemo(() => {
    return {
      total: auctions.length,
      upcoming: auctions.filter((auction) => auction.status === 'Upcoming').length,
      ongoing: auctions.filter((auction) => auction.status === 'Ongoing').length,
      ended: auctions.filter((auction) => isEndedStatus(auction.status)).length,
    };
  }, [auctions]);

  const loadAuctions = async () => {
    try {
      setLoading(true);
      const params = { PageSize: 50, SortBy: 'newest' };
      if (searchTerm.trim()) params.SearchTerm = searchTerm.trim();
      if (statusFilter !== 'All') params.Status = statusFilter;
      const data = await auctionService.getMyAuctions(params);
      setAuctions(data?.items || []);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load your auctions.', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    loadAuctions();
  }, [statusFilter, realtimeTick]);

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

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!createForm.productId) {
      showToast('Please select a ready auction product.', 'warning');
      return;
    }

    try {
      setSaving(true);
      await auctionService.create({
        productId: createForm.productId,
        ...toAuctionPayload(createForm),
      });
      showToast('Auction created successfully.', 'success');
      setCreateForm(getDefaultCreateForm());
      await Promise.all([loadEligibleProducts(), loadAuctions()]);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to create auction.', 'error');
    } finally {
      setSaving(false);
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
    if (saving) return;
    setEditingAuction(null);
    setEditForm(null);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingAuction || !editForm) return;

    try {
      setSaving(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast('Auction updated successfully.', 'success');
      closeEditModal();
      await loadAuctions();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update auction.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadAuctions();
  };

  return (
    <div className="seller-auctions-page animate-fade-in">
      {loading && (
        <div className="seller-auctions-loader">
          <span className="btn-spinner"></span>
        </div>
      )}

      <header className="seller-auctions-header">
        <div>
          <span>Seller Auctions</span>
          <h1>My Auctions</h1>
          <p>Create auction rooms from approved auction products and update upcoming auctions before they become active.</p>
        </div>
        <Link to="/auction" className="seller-auctions-live-link">
          <span className="material-symbols-outlined">open_in_new</span>
          Auction Room
        </Link>
      </header>

      <section className="seller-auctions-stat-grid">
        <article><small>Total</small><strong>{stats.total}</strong></article>
        <article><small>Upcoming</small><strong>{stats.upcoming}</strong></article>
        <article><small>Ongoing</small><strong>{stats.ongoing}</strong></article>
        <article><small>Ended</small><strong>{stats.ended}</strong></article>
      </section>

      <div className="seller-auctions-layout">
        <section className="seller-auctions-create">
          <div className="seller-auctions-section-head">
            <h2>Create Auction</h2>
            <p>Only products approved as Ready for Auction appear here.</p>
          </div>

          <form onSubmit={handleCreate} className="seller-auctions-form">
            <label className="seller-auctions-field wide">
              <span>Auction Product</span>
              <select name="productId" value={createForm.productId} onChange={handleCreateChange} required>
                <option value="">Select product</option>
                {eligibleProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.name} - {product.categoryName || 'Uncategorized'}
                  </option>
                ))}
              </select>
            </label>

            <div className="seller-auctions-form-grid">
              <label className="seller-auctions-field">
                <span>Starting Bid</span>
                <input name="startingPrice" type="number" min="1" value={createForm.startingPrice} onChange={handleCreateChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>Bid Step</span>
                <input name="minIncrement" type="number" min="1" value={createForm.minIncrement} onChange={handleCreateChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>Buy Now Price</span>
                <input name="buyNowPrice" type="number" min="0" value={createForm.buyNowPrice} onChange={handleCreateChange} />
              </label>
              <label className="seller-auctions-field">
                <span>Start Time</span>
                <input name="startTime" type="datetime-local" value={createForm.startTime} onChange={handleCreateChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>End Time</span>
                <input name="endTime" type="datetime-local" value={createForm.endTime} onChange={handleCreateChange} required />
              </label>
            </div>

            {eligibleProducts.length === 0 && (
              <div className="seller-auctions-empty-inline">
                <span className="material-symbols-outlined">inventory_2</span>
                <p>No ready auction products are available.</p>
              </div>
            )}

            <button className="seller-auctions-primary" type="submit" disabled={saving || eligibleProducts.length === 0}>
              {saving ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">add_circle</span>}
              Create Auction
            </button>
          </form>
        </section>

        <section className="seller-auctions-list-panel">
          <div className="seller-auctions-section-head split">
            <div>
              <h2>My Auction List</h2>
              <p>Track progress and update details before a room goes live.</p>
            </div>
          </div>

          <form className="seller-auctions-toolbar" onSubmit={handleSearchSubmit}>
            <label>
              <span className="material-symbols-outlined">search</span>
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search auction..." />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="submit">
              <span className="material-symbols-outlined">tune</span>
              Apply
            </button>
          </form>

          {auctions.length === 0 ? (
            <div className="seller-auctions-empty">
              <span className="material-symbols-outlined">gavel</span>
              <h3>No auctions found</h3>
              <p>Create a new auction or adjust your filter.</p>
            </div>
          ) : (
            <div className="seller-auctions-list">
              {auctions.map((auction) => {
                const progress = getProgress(auction);
                return (
                  <article key={auction.auctionId} className="seller-auctions-row">
                    <img src={auction.productImageUrl || 'https://placehold.co/140'} alt={auction.productName || 'Auction'} />
                    <div className="seller-auctions-row-main">
                      <div className="seller-auctions-row-top">
                        <div>
                          <strong>{auction.productName || 'Unnamed auction'}</strong>
                          <span>{auction.categoryName || 'Uncategorized'} - {auction.auctionId}</span>
                        </div>
                        <em className={`seller-auctions-status ${String(auction.status || '').toLowerCase()}`}>{auction.status}</em>
                      </div>
                      <div className="seller-auctions-progress">
                        <i><b style={{ width: `${progress}%` }} /></i>
                        <small>{progress}%</small>
                      </div>
                      <div className="seller-auctions-meta">
                        <span>Current <b>{formatMoney(auction.currentPrice)}</b></span>
                        <span>Step <b>{formatMoney(auction.minIncrement)}</b></span>
                        <span>Bids <b>{auction.bidCount || 0}</b></span>
                      </div>
                      <div className="seller-auctions-time">
                        <span>{formatDateTime(auction.startTime)}</span>
                        <span>{formatDateTime(auction.endTime)}</span>
                      </div>
                    </div>
                    <div className="seller-auctions-actions">
                      <button type="button" onClick={() => navigate(`/auction/${auction.auctionId}`)} title="View detail">
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button type="button" onClick={() => openEditModal(auction)} disabled={!canEditAuction(auction)} title="Update auction">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editingAuction && editForm && (
        <div className="seller-auctions-modal" role="dialog" aria-modal="true">
          <form className="seller-auctions-modal-card" onSubmit={handleUpdate}>
            <header>
              <div>
                <h2>Update Auction</h2>
                <p>{editingAuction.productName}</p>
              </div>
              <button type="button" onClick={closeEditModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-auctions-form-grid">
              <label className="seller-auctions-field">
                <span>Starting Bid</span>
                <input name="startingPrice" type="number" min="1" value={editForm.startingPrice} onChange={handleEditChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>Bid Step</span>
                <input name="minIncrement" type="number" min="1" value={editForm.minIncrement} onChange={handleEditChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>Buy Now Price</span>
                <input name="buyNowPrice" type="number" min="0" value={editForm.buyNowPrice} onChange={handleEditChange} />
              </label>
              <label className="seller-auctions-field">
                <span>Start Time</span>
                <input name="startTime" type="datetime-local" value={editForm.startTime} onChange={handleEditChange} required />
              </label>
              <label className="seller-auctions-field">
                <span>End Time</span>
                <input name="endTime" type="datetime-local" value={editForm.endTime} onChange={handleEditChange} required />
              </label>
            </div>

            <footer>
              <button type="button" className="seller-auctions-secondary" onClick={closeEditModal}>Cancel</button>
              <button type="submit" className="seller-auctions-primary" disabled={saving}>
                {saving ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">save</span>}
                Save Changes
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
