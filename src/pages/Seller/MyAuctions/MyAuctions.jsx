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
const DEFAULT_AUCTION_START_OFFSET_MS = 0;

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

function validateAuctionForm(form, { requireProduct = false, requireFutureStart = false } = {}) {
  if (requireProduct && !form.productId) return 'Please select a ready auction product.';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const selectedProduct = useMemo(() => {
    return eligibleProducts.find(p => p.productId === createForm.productId);
  }, [eligibleProducts, createForm.productId]);

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
    const validationError = validateAuctionForm(createForm, { requireProduct: true });
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
      showToast('Auction created successfully.', 'success');
      setCreateForm(getDefaultCreateForm());
      setIsCreateModalOpen(false);
      await Promise.all([loadEligibleProducts(), loadAuctions()]);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to create auction.', 'error');
    } finally {
      setSaving(false);
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
    if (saving) return;
    setEditingAuction(null);
    setEditForm(null);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingAuction || !editForm) return;
    const validationError = validateAuctionForm(editForm, { requireFutureStart: true });
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }

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
    <>
      <div className="seller-auctions-page animate-fade-in">
        {loading && (
          <div className="seller-auctions-loader">
            <span className="btn-spinner"></span>
          </div>
        )}

        <header className="seller-dash-header">
          <div>
            <h1>My Auctions</h1>
            <p>Create auction rooms from approved auction products and update upcoming auctions before they become active.</p>
          </div>
          <button
            type="button"
            className="seller-list-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <span className="material-symbols-outlined">add</span>Create Auction
          </button>
        </header>

        <section className="seller-auctions-stat-grid">
          <article><small>Total</small><strong>{stats.total}</strong></article>
          <article><small>Upcoming</small><strong>{stats.upcoming}</strong></article>
          <article><small>Ongoing</small><strong>{stats.ongoing}</strong></article>
          <article><small>Ended</small><strong>{stats.ended}</strong></article>
        </section>

        <div className="seller-auctions-layout" style={{ gridTemplateColumns: '1fr' }}>
          <section className="seller-auctions-list-panel">
          <div className="seller-auctions-section-head split">
            <div>
              <h2>My Auction List</h2>
              <p>Track progress and update details before a room goes live.</p>
            </div>
          </div>

          <div className="seller-auctions-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div className="seller-auctions-tabs" style={{ display: 'flex', gap: '8px' }}>
              {statusOptions.map((status) => {
                const count = status === 'All' ? stats.total :
                              status === 'Upcoming' ? stats.upcoming :
                              status === 'Ongoing' ? stats.ongoing : stats.ended;
                
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
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
                    {status} ({count})
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '320px', position: 'relative' }}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search auction..."
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
                      <button
                        type="button"
                        onClick={() => openEditModal(auction)}
                        aria-disabled={!canEditAuction(auction)}
                        title={getAuctionEditBlockReason(auction) || 'Update auction'}
                      >
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
    </div>

    {isCreateModalOpen && (
        <div className="seller-auctions-modal" role="dialog" aria-modal="true" onClick={() => setIsCreateModalOpen(false)}>
          <form className="seller-auctions-modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate} noValidate>
            <header style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h2>Create Auction</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Set rules for your approved auction product</p>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} disabled={saving} style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <label className="seller-auctions-field wide" style={{ marginBottom: '12px' }}>
              <span>Auction Product</span>
              <select name="productId" value={createForm.productId} onChange={handleCreateChange} required disabled={saving}>
                <option value="">Select product</option>
                {eligibleProducts.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.name} - {product.categoryName || 'Uncategorized'}
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct && (
              <div className="seller-auctions-selected-product-card" style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <img src={selectedProduct.mainImageUrl || '/vite.svg'} alt={selectedProduct.name} style={{ width: '80px', height: '72px', objectFit: 'cover', borderRadius: '8px', background: '#f3f4f6' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: 800 }}>{selectedProduct.name}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Category: {selectedProduct.categoryName || 'Uncategorized'}</span>
                </div>
              </div>
            )}

            <div className="seller-auctions-form-grid">
              <label className="seller-auctions-field">
                <span>Starting Bid</span>
                <input name="startingPrice" type="number" min="1" value={createForm.startingPrice} onChange={handleCreateChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>Bid Step</span>
                <input name="minIncrement" type="number" min="1" value={createForm.minIncrement} onChange={handleCreateChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>Start Time</span>
                <input name="startTime" type="datetime-local" value={createForm.startTime} onChange={handleCreateChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>End Time</span>
                <input name="endTime" type="datetime-local" value={createForm.endTime} onChange={handleCreateChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field wide">
                <span>Buy Now Price</span>
                <input name="buyNowPrice" type="number" min="0" value={createForm.buyNowPrice} onChange={handleCreateChange} disabled={saving} />
              </label>
            </div>

            {eligibleProducts.length === 0 && (
              <div className="seller-auctions-empty-inline" style={{ marginTop: '14px' }}>
                <span className="material-symbols-outlined">inventory_2</span>
                <p>No ready auction products are available.</p>
              </div>
            )}

            <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '18px' }}>
              <button type="button" className="seller-auctions-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="seller-auctions-primary" disabled={saving || eligibleProducts.length === 0}>
                {saving ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">add_circle</span>}
                Create Auction
              </button>
            </footer>
          </form>
        </div>
      )}

      {editingAuction && editForm && (
        <div className="seller-auctions-modal" role="dialog" aria-modal="true" onClick={closeEditModal}>
          <form className="seller-auctions-modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleUpdate} noValidate>
            <header>
              <div>
                <h2>Update Auction</h2>
                <p>{editingAuction.productName}</p>
              </div>
              <button type="button" onClick={closeEditModal} disabled={saving}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="seller-auctions-form-grid">
              <label className="seller-auctions-field">
                <span>Starting Bid</span>
                <input name="startingPrice" type="number" min="1" value={editForm.startingPrice} onChange={handleEditChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>Bid Step</span>
                <input name="minIncrement" type="number" min="1" value={editForm.minIncrement} onChange={handleEditChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>Start Time</span>
                <input name="startTime" type="datetime-local" value={editForm.startTime} onChange={handleEditChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field">
                <span>End Time</span>
                <input name="endTime" type="datetime-local" value={editForm.endTime} onChange={handleEditChange} required disabled={saving} />
              </label>
              <label className="seller-auctions-field wide">
                <span>Buy Now Price</span>
                <input name="buyNowPrice" type="number" min="0" value={editForm.buyNowPrice} onChange={handleEditChange} disabled={saving} />
              </label>
            </div>

            <footer>
              <button type="button" className="seller-auctions-secondary" onClick={closeEditModal} disabled={saving}>Cancel</button>
              <button type="submit" className="seller-auctions-primary" disabled={saving}>
                {saving ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">save</span>}
                Save Changes
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
