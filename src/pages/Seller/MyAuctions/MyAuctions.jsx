import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime, toAuctionDateTimeLocal } from '../../../utils/auctionTime';
import './MyAuctions.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

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

function getAuctionEditBlockReason(auction, isVi) {
  if (!auction) return isVi ? 'Dữ liệu đấu giá không có sẵn.' : 'Auction data is not available.';
  if (auction.status !== 'Upcoming') return isVi ? 'Chỉ có thể cập nhật các phiên đấu giá sắp diễn ra.' : 'Only upcoming auctions can be updated.';
  if (Number(auction.bidCount || 0) > 0) return isVi ? 'Phiên đấu giá đã có lượt ra giá không thể cập nhật.' : 'Auctions with existing bids cannot be updated.';

  const startTime = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  if (!startTime || startTime <= Date.now()) return isVi ? 'Thời gian bắt đầu đấu giá đã trôi qua.' : 'Auction start time has passed.';

  return '';
}

function validateAuctionForm(form, { requireProduct = false, requireFutureStart = false }, isVi) {
  if (requireProduct && !form.productId) return isVi ? 'Vui lòng chọn sản phẩm đã được duyệt để đấu giá.' : 'Please select a ready auction product.';

  const startingPrice = Number(form.startingPrice);
  const minIncrement = Number(form.minIncrement);
  const buyNowPrice = form.buyNowPrice === '' ? null : Number(form.buyNowPrice);
  const start = parseAuctionDateTime(form.startTime);
  const end = parseAuctionDateTime(form.endTime);

  if (!form.startingPrice || Number.isNaN(startingPrice) || startingPrice <= 0) return isVi ? 'Giá khởi điểm phải lớn hơn 0.' : 'Starting bid must be greater than 0.';
  if (!form.minIncrement || Number.isNaN(minIncrement) || minIncrement <= 0) return isVi ? 'Bước giá phải lớn hơn 0.' : 'Bid step must be greater than 0.';
  if (form.buyNowPrice === '' || Number.isNaN(buyNowPrice)) return isVi ? 'Giá mua ngay là bắt buộc.' : 'Buy now price is required.';
  if (buyNowPrice <= startingPrice) return isVi ? 'Giá mua ngay phải lớn hơn giá khởi điểm.' : 'Buy now price must be greater than the starting bid.';
  if (!form.startTime || !start || Number.isNaN(start.getTime())) return isVi ? 'Vui lòng chọn thời gian bắt đầu hợp lệ.' : 'Please choose a valid start time.';
  if (!form.endTime || !end || Number.isNaN(end.getTime())) return isVi ? 'Vui lòng chọn thời gian kết thúc hợp lệ.' : 'Please choose a valid end time.';
  if (requireFutureStart && start <= new Date()) return isVi ? 'Thời gian bắt đầu phải ở trong tương lai.' : 'Start time must remain in the future.';
  if (end <= start) return isVi ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : 'End time must be after start time.';

  return '';
}

export default function MyAuctions() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

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

  const statusOptions = useMemo(() => [
    { value: 'All', label: isVi ? 'Tất cả' : 'All' },
    { value: 'Upcoming', label: isVi ? 'Sắp diễn ra' : 'Upcoming' },
    { value: 'Ongoing', label: isVi ? 'Đang diễn ra' : 'Ongoing' },
    { value: 'Ended', label: isVi ? 'Đã kết thúc' : 'Ended' },
  ], [isVi]);

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
      showToast(error?.response?.data || (isVi ? 'Không thể tải danh sách đấu giá.' : 'Failed to load your auctions.'), 'error');
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
    const validationError = validateAuctionForm(createForm, { requireProduct: true }, isVi);
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
      showToast(isVi ? 'Tạo phiên đấu giá thành công.' : 'Auction created successfully.', 'success');
      setCreateForm(getDefaultCreateForm());
      setIsCreateModalOpen(false);
      await Promise.all([loadEligibleProducts(), loadAuctions()]);
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể tạo phiên đấu giá.' : 'Failed to create auction.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (auction) => {
    const blockReason = getAuctionEditBlockReason(auction, isVi);
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
    const validationError = validateAuctionForm(editForm, { requireFutureStart: true }, isVi);
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }

    try {
      setSaving(true);
      await auctionService.update(editingAuction.auctionId, toAuctionPayload(editForm));
      showToast(isVi ? 'Cập nhật phiên đấu giá thành công.' : 'Auction updated successfully.', 'success');
      closeEditModal();
      await loadAuctions();
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể cập nhật phiên đấu giá.' : 'Failed to update auction.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadAuctions();
  };

  const getAuctionStatusText = (status) => {
    switch (status) {
      case 'Upcoming': return isVi ? 'Sắp diễn ra' : 'Upcoming';
      case 'Ongoing': return isVi ? 'Đang diễn ra' : 'Ongoing';
      case 'Ended': case 'EndedByBuyNow': case 'EndedByTime': case 'EndedNoBid':
        return isVi ? 'Đã kết thúc' : 'Ended';
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
            <h1>{isVi ? 'Đấu Giá Của Tôi' : 'My Auctions'}</h1>
            <p>{isVi ? 'Tạo phòng đấu giá cho các sản phẩm đã duyệt và quản lý thông tin các phiên đấu giá sắp diễn ra.' : 'Create auction rooms from approved auction products and update upcoming auctions before they become active.'}</p>
          </div>
          <button
            type="button"
            className="seller-list-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <span className="material-symbols-outlined">add</span>{isVi ? 'Tạo Phiên Đấu Giá' : 'Create Auction'}
          </button>
        </header>

        <section className="seller-auctions-stat-grid">
          <article><small>{isVi ? 'Tổng số' : 'Total'}</small><strong>{stats.total}</strong></article>
          <article><small>{isVi ? 'Sắp diễn ra' : 'Upcoming'}</small><strong>{stats.upcoming}</strong></article>
          <article><small>{isVi ? 'Đang diễn ra' : 'Ongoing'}</small><strong>{stats.ongoing}</strong></article>
          <article><small>{isVi ? 'Đã kết thúc' : 'Ended'}</small><strong>{stats.ended}</strong></article>
        </section>

        <div className="seller-auctions-layout" style={{ gridTemplateColumns: '1fr' }}>
          <section className="seller-auctions-list-panel">
          <div className="seller-auctions-section-head split">
            <div>
              <h2>{isVi ? 'Danh Sách Phiên Đấu Giá' : 'My Auction List'}</h2>
              <p>{isVi ? 'Theo dõi tiến trình và cập nhật thông tin trước khi phòng đấu giá lên sóng.' : 'Track progress and update details before a room goes live.'}</p>
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
                    {opt.label} ({count})
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '320px', position: 'relative' }}>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={isVi ? 'Tìm kiếm phiên đấu giá...' : 'Search auction...'}
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
              <h3>{isVi ? 'Không tìm thấy phiên đấu giá nào' : 'No auctions found'}</h3>
              <p>{isVi ? 'Tạo đấu giá mới hoặc điều chỉnh bộ lọc của bạn.' : 'Create a new auction or adjust your filter.'}</p>
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
                          <strong>{auction.productName || (isVi ? 'Đấu giá chưa đặt tên' : 'Unnamed auction')}</strong>
                          <span>{auction.categoryName || (isVi ? 'Chưa phân loại' : 'Uncategorized')} - {auction.auctionId}</span>
                        </div>
                        <em className={`seller-auctions-status ${String(auction.status || '').toLowerCase()}`}>{getAuctionStatusText(auction.status)}</em>
                      </div>
                      <div className="seller-auctions-progress">
                        <i><b style={{ width: `${progress}%` }} /></i>
                        <small>{progress}%</small>
                      </div>
                      <div className="seller-auctions-meta">
                        <span>{isVi ? 'Giá hiện tại' : 'Current'} <b>{formatMoney(auction.currentPrice)}</b></span>
                        <span>{isVi ? 'Bước giá' : 'Step'} <b>{formatMoney(auction.minIncrement)}</b></span>
                        <span>{isVi ? 'Lượt ra giá' : 'Bids'} <b>{auction.bidCount || 0}</b></span>
                      </div>
                      <div className="seller-auctions-time">
                        <span>{formatDateTime(auction.startTime)}</span>
                        <span>{formatDateTime(auction.endTime)}</span>
                      </div>
                    </div>
                    <div className="seller-auctions-actions">
                      <Link to={`/auctions/${auction.auctionId}`} className="btn-secondary">
                        {isVi ? 'Phòng Đấu Giá' : 'Auction Room'}
                      </Link>
                      {auction.status === 'Upcoming' && Number(auction.bidCount || 0) === 0 && (
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={() => openEditModal(auction)}
                        >
                          {isVi ? 'Chỉnh Sửa' : 'Edit Details'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>

    {/* Create Auction Modal */}
    {isCreateModalOpen && (
      <div className="seller-auctions-modal-overlay" onClick={() => !saving && setIsCreateModalOpen(false)}>
        <div className="seller-auctions-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{isVi ? 'Tạo Phiên Đấu Giá Mới' : 'Create New Auction'}</h3>
            <button className="close-btn" onClick={() => !saving && setIsCreateModalOpen(false)}>×</button>
          </div>
          <form onSubmit={handleCreate} className="modal-body">
            <div className="form-group">
              <label>{isVi ? 'Chọn Sản Phẩm Đã Được Duyệt *' : 'Select Approved Product *'}</label>
              <select
                name="productId"
                value={createForm.productId}
                onChange={handleCreateChange}
                required
              >
                <option value="">{isVi ? '-- Chọn Sản Phẩm --' : '-- Select Product --'}</option>
                {eligibleProducts.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.productId})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{isVi ? 'Giá Khởi Điểm (VND) *' : 'Starting Price (VND) *'}</label>
                <input
                  type="number"
                  name="startingPrice"
                  value={createForm.startingPrice}
                  onChange={handleCreateChange}
                  required
                  min="1"
                  placeholder="e.g. 100000"
                />
              </div>
              <div className="form-group">
                <label>{isVi ? 'Bước Giá Tối Thiểu (VND) *' : 'Minimum Bid Increment (VND) *'}</label>
                <input
                  type="number"
                  name="minIncrement"
                  value={createForm.minIncrement}
                  onChange={handleCreateChange}
                  required
                  min="1"
                  placeholder="e.g. 50000"
                />
              </div>
            </div>

            <div className="form-group">
              <label>{isVi ? 'Giá Mua Ngay (VND) *' : 'Buy Now Price (VND) *'}</label>
              <input
                type="number"
                name="buyNowPrice"
                value={createForm.buyNowPrice}
                onChange={handleCreateChange}
                required
                min="1"
                placeholder="e.g. 1000000"
              />
            </div>

            <div className="form-group-row">
              <div className="form-group">
                <label>{isVi ? 'Thời Gian Bắt Đầu *' : 'Start Time *'}</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={createForm.startTime}
                  onChange={handleCreateChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{isVi ? 'Thời Gian Kết Thúc *' : 'End Time *'}</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={createForm.endTime}
                  onChange={handleCreateChange}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)} disabled={saving}>{isVi ? 'Hủy Bỏ' : 'Cancel'}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? (isVi ? 'Đang tạo...' : 'Creating...') : (isVi ? 'Tạo Đấu Giá' : 'Create Auction')}</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Edit Auction Modal */}
    {editingAuction && editForm && (
      <div className="seller-auctions-modal-overlay" onClick={closeEditModal}>
        <div className="seller-auctions-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{isVi ? 'Chỉnh Sửa Đấu Giá' : 'Edit Auction'}</h3>
            <button className="close-btn" onClick={closeEditModal}>×</button>
          </div>
          <form onSubmit={handleUpdate} className="modal-body">
            <div className="form-group-row">
              <div className="form-group">
                <label>{isVi ? 'Giá Khởi Điểm (VND) *' : 'Starting Price (VND) *'}</label>
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
                <label>{isVi ? 'Bước Giá Tối Thiểu (VND) *' : 'Minimum Bid Increment (VND) *'}</label>
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
              <label>{isVi ? 'Giá Mua Ngay (VND) *' : 'Buy Now Price (VND) *'}</label>
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
                <label>{isVi ? 'Thời Gian Bắt Đầu *' : 'Start Time *'}</label>
                <input
                  type="datetime-local"
                  name="startTime"
                  value={editForm.startTime}
                  onChange={handleEditChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{isVi ? 'Thời Gian Kết Thúc *' : 'End Time *'}</label>
                <input
                  type="datetime-local"
                  name="endTime"
                  value={editForm.endTime}
                  onChange={handleEditChange}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeEditModal} disabled={saving}>{isVi ? 'Hủy Bỏ' : 'Cancel'}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu Thay Đổi' : 'Save Changes')}</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
  );
}
