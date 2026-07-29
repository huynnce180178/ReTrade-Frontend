import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import voucherService from '../../../services/voucherService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/MyVouchers.css';

export default function MyVouchers() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [allVouchers, setAllVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'upcoming' | 'used' | 'expired'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Percentage' | 'Fixed'
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);

  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const params = {
        '$orderby': 'CreatedAt desc'
      };

      const res = await voucherService.getMyVouchers(params);
      const items = Array.isArray(res) ? res : (res?.value || res?.items || []);
      setAllVouchers(items);
    } catch (err) {
      showToast(typeof err?.response?.data === 'string' ? err.response.data : (isVi ? 'Không thể tải danh sách voucher.' : 'Failed to load vouchers.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadVouchers();
  }, [user]);

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{isVi ? 'Đang tải voucher của bạn...' : 'Loading your vouchers...'}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleCopyCode = (e, code, isUpcoming) => {
    e.stopPropagation();
    if (isUpcoming) {
      showToast(isVi ? 'Voucher này chưa có hiệu lực. Voucher sẽ mở khóa vào ngày bắt đầu!' : 'This voucher is not active yet. It will unlock on its start date!', 'info');
      return;
    }
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(isVi ? `Đã sao chép mã "${code}" vào bộ nhớ tạm!` : `Code "${code}" copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Helper to generate dynamic description based on language
  const getVoucherDescription = (mv) => {
    const minSpendStr = mv.minOrderValue && mv.minOrderValue > 0 
      ? `${mv.minOrderValue.toLocaleString(isVi ? 'vi-VN' : 'en-US')} VND` 
      : null;
    
    if (mv.discountType === 'Fixed') {
      const discountStr = mv.discountValue ? `${mv.discountValue.toLocaleString(isVi ? 'vi-VN' : 'en-US')} VND` : (isVi ? 'phí vận chuyển' : 'shipping');
      if (isVi) {
        if (minSpendStr) {
          return `Giảm giá vận chuyển đến ${discountStr} cho đơn từ ${minSpendStr}`;
        }
        return `Giảm giá vận chuyển đến ${discountStr} cho mọi đơn hàng`;
      }
      if (minSpendStr) {
        return `Free shipping discount up to ${discountStr} on orders from ${minSpendStr}`;
      }
      return `Free shipping discount up to ${discountStr} on all orders`;
    }

    // Percentage discount
    const pct = mv.discountValue || 0;
    const maxCapStr = mv.maxDiscountValue && mv.maxDiscountValue > 0 
      ? `${mv.maxDiscountValue.toLocaleString(isVi ? 'vi-VN' : 'en-US')} VND` 
      : null;

    if (isVi) {
      if (maxCapStr && minSpendStr) {
        return `Giảm ${pct}% tối đa ${maxCapStr} cho đơn hàng từ ${minSpendStr}`;
      }
      if (maxCapStr) {
        return `Giảm ${pct}% tối đa ${maxCapStr} cho đơn hàng`;
      }
      return `Giảm ${pct}% cho các đơn hàng hợp lệ`;
    }

    if (maxCapStr && minSpendStr) {
      return `${pct}% discount up to ${maxCapStr} for orders from ${minSpendStr}`;
    }
    if (maxCapStr) {
      return `${pct}% discount up to ${maxCapStr} on your purchase`;
    }
    return `${pct}% discount on eligible orders`;
  };

  // Filter vouchers by selected tab & type filter across all user vouchers
  const getFilteredVouchers = () => {
    const now = new Date();
    return allVouchers.filter((mv) => {
      const isExpired = mv.expirationDate ? new Date(mv.expirationDate) < now : false;
      const isUsed = mv.status === 'Used' || !!mv.usedAt;
      const isUpcoming = mv.startDate ? new Date(mv.startDate) > now : false;

      // Filter by type ('all', 'Percentage', 'Fixed')
      if (typeFilter !== 'all' && mv.discountType !== typeFilter) {
        return false;
      }

      if (activeTab === 'used') {
        return isUsed;
      }
      if (activeTab === 'expired') {
        return isExpired && !isUsed;
      }
      if (activeTab === 'upcoming') {
        return isUpcoming && !isUsed && !isExpired;
      }
      // 'active' tab: available right now
      return !isUsed && !isExpired && !isUpcoming;
    });
  };

  const filteredVouchers = getFilteredVouchers();
  const totalCount = filteredVouchers.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Pagination slice
  const paginatedVouchers = filteredVouchers.slice((page - 1) * pageSize, page * pageSize);

  // Tab count badges
  const now = new Date();
  const availableCount = allVouchers.filter(v => (!v.status || v.status === 'Active') && !v.usedAt && (!v.expirationDate || new Date(v.expirationDate) >= now) && (!v.startDate || new Date(v.startDate) <= now)).length;
  const upcomingCount = allVouchers.filter(v => (!v.usedAt) && (!v.expirationDate || new Date(v.expirationDate) >= now) && (v.startDate && new Date(v.startDate) > now)).length;
  const usedCount = allVouchers.filter(v => v.status === 'Used' || !!v.usedAt).length;
  const expiredCount = allVouchers.filter(v => !v.usedAt && v.expirationDate && new Date(v.expirationDate) < now).length;

  return (
    <>
      <div className="profile-page-wrapper container animate-fade-in">
        <div className="profile-grid">
          <AccountSidebar />

          <main className="ma-main">
            <div className="ma-card ma-header-card">
              <div className="ma-header-info">
                <div className="ma-header-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <span className="material-symbols-outlined">local_activity</span>
                </div>
                <div>
                  <h1 className="ma-headline">{isVi ? 'Voucher Của Tôi' : 'My Vouchers'}</h1>
                  <p className="ma-subtitle">{isVi ? 'Xem, sao chép và áp dụng các voucher giảm giá thành viên khi đặt hàng' : 'View, copy, and apply your member subscription vouchers during checkout'}</p>
                </div>
              </div>
            </div>

            <div className="voucher-tabs-card glass-panel">
              <div className="voucher-tabs">
                <button 
                  className={`v-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('active'); setPage(1); }}
                >
                  {isVi ? 'Khả dụng' : 'Available'} ({availableCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('upcoming'); setPage(1); }}
                >
                  {isVi ? 'Sắp có' : 'Upcoming'} ({upcomingCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'used' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('used'); setPage(1); }}
                >
                  {isVi ? 'Đã sử dụng' : 'Used'} ({usedCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('expired'); setPage(1); }}
                >
                  {isVi ? 'Đã hết hạn' : 'Expired'} ({expiredCount})
                </button>
              </div>

              {/* Sub-filter by Voucher Type */}
              <div className="v-subfilters-bar flex items-center justify-between pt-3 mt-3 border-t border-gray-100 flex-wrap gap-2 px-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <span>{isVi ? 'Lọc theo loại:' : 'Filter by Type:'}</span>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('all'); setPage(1); }}
                  >
                    {isVi ? 'Tất cả loại' : 'All Types'}
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'Percentage' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('Percentage'); setPage(1); }}
                  >
                    {isVi ? 'Giảm %' : 'Discount (%)'}
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'Fixed' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('Fixed'); setPage(1); }}
                  >
                    {isVi ? 'Miễn phí vận chuyển' : 'Free Shipping / Ship'}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="voucher-loading">
                <span className="btn-spinner"></span>
                <p>{isVi ? 'Đang tải voucher của bạn...' : 'Fetching your vouchers...'}</p>
              </div>
            ) : paginatedVouchers.length === 0 ? (
              <div className="voucher-empty glass-panel text-center">
                <h3>{isVi ? 'Không tìm thấy voucher nào' : 'No vouchers found'}</h3>
                <p>{isVi ? `Bạn hiện không có voucher nào trong mục ${activeTab === 'active' ? 'Khả dụng' : activeTab === 'upcoming' ? 'Sắp có' : activeTab === 'used' ? 'Đã sử dụng' : 'Đã hết hạn'}.` : `You don't have any vouchers in the ${activeTab} tab at the moment.`}</p>
              </div>
            ) : (
              <>
                <div className="vouchers-list">
                  {paginatedVouchers.map((mv) => {
                    const isUpcoming = mv.startDate ? new Date(mv.startDate) > now : false;
                    const formattedStartDate = mv.startDate
                      ? new Date(mv.startDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : (isVi ? 'Tức thì' : 'Immediate');

                    const formattedExpiry = mv.expirationDate 
                      ? new Date(mv.expirationDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : (isVi ? 'Không thời hạn' : 'No expiry');

                    const desc = getVoucherDescription(mv);

                    return (
                      <div 
                        key={mv.userVoucherId} 
                        className={`voucher-card glass-panel ${activeTab} ${isUpcoming ? 'upcoming' : ''} clickable`}
                        onClick={() => setSelectedVoucher(mv)}
                      >
                        <div className="voucher-left">
                          <div className="discount-badge">
                            {mv.discountType === 'Percentage' ? (
                              <>
                                <span className="val">{mv.discountValue}%</span>
                                <span className="lbl">{isVi ? 'GIẢM' : 'OFF'}</span>
                              </>
                            ) : (
                              <>
                                <span className="val" style={{ fontSize: '18px' }}>
                                  {(mv.discountValue || 0).toLocaleString('vi-VN')} VND
                                </span>
                                <span className="lbl">{isVi ? 'GIẢM' : 'Discount'}</span>
                              </>
                            )}
                          </div>
                          <div className="ticket-cutout"></div>
                        </div>
                        <div className="voucher-right">
                          <div className="voucher-details">
                            <div className="v-header">
                              <span className="v-code-tag">{mv.code}</span>
                              {isUpcoming && (
                                <span className="v-upcoming-badge">
                                  {isVi ? `Mở khóa ${formattedStartDate}` : `Unlocks ${formattedStartDate}`}
                                </span>
                              )}
                              {mv.sellerName && (
                                <span className="v-shop-name">{isVi ? 'Cửa hàng:' : 'Store:'} {mv.sellerName}</span>
                              )}
                            </div>

                            <div className="v-desc-text">
                              {desc}
                            </div>

                            <div className="v-expiry">
                              {isUpcoming ? (
                                <span>{isVi ? 'Hiệu lực:' : 'Valid:'} <strong>{formattedStartDate}</strong> - <strong>{formattedExpiry}</strong></span>
                              ) : (
                                <span>{isVi ? 'Hạn dùng:' : 'Expires on:'} <strong>{formattedExpiry}</strong></span>
                              )}
                            </div>
                          </div>
                          <div className="voucher-action">
                            {activeTab === 'active' ? (
                              <button 
                                className="btn btn-primary v-copy-btn"
                                onClick={(e) => handleCopyCode(e, mv.code, false)}
                              >
                                {copiedCode === mv.code ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao Chép Mã' : 'Copy Code')}
                              </button>
                            ) : activeTab === 'upcoming' ? (
                              <button 
                                className="btn btn-secondary v-copy-btn disabled"
                                onClick={(e) => handleCopyCode(e, mv.code, true)}
                              >
                                {isVi ? 'Sắp Có' : 'Upcoming'}
                              </button>
                            ) : (
                              <span className={`v-status-badge ${activeTab}`}>
                                {activeTab === 'used' ? (isVi ? 'ĐÃ SỬ DỤNG' : 'USED') : (isVi ? 'ĐÃ HẾT HẠN' : 'EXPIRED')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="v-pagination-bar glass-panel">
                    <span className="v-page-info">
                      {isVi 
                        ? `Trang ${page} / ${totalPages} (${totalCount} voucher trong mục này)`
                        : `Page ${page} of ${totalPages} (${totalCount} vouchers in this tab)`}
                    </span>
                    <div className="v-pagination-buttons">
                      <button 
                        className="btn btn-outline v-page-btn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {isVi ? 'Trước' : 'Previous'}
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          className={`v-page-num ${page === p ? 'active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      ))}

                      <button 
                        className="btn btn-outline v-page-btn"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        {isVi ? 'Tiếp' : 'Next'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Detail Modal Overlay */}
      {selectedVoucher && (
        <div className="v-modal-overlay" onClick={() => setSelectedVoucher(null)}>
          <div className="v-modal-card glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="v-modal-close" onClick={() => setSelectedVoucher(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className={`v-modal-ticket ${selectedVoucher.status === 'Used' ? 'used' : (selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date() ? 'expired' : (selectedVoucher.startDate && new Date(selectedVoucher.startDate) > new Date() ? 'upcoming' : 'active'))}`}>
              <div className="v-modal-left">
                <div className="v-modal-discount">
                  {selectedVoucher.discountType === 'Percentage' ? (
                    <>
                      <span className="amount">{selectedVoucher.discountValue}%</span>
                      <span className="label">{isVi ? 'GIẢM' : 'OFF'}</span>
                    </>
                  ) : (
                    <>
                      <span className="amount" style={{ fontSize: '24px' }}>
                        {(selectedVoucher.discountValue || 0).toLocaleString('vi-VN')} VND
                      </span>
                      <span className="label">{isVi ? 'GIẢM' : 'OFF'}</span>
                    </>
                  )}
                </div>
                <div className="v-modal-status-badge">
                  {selectedVoucher.status === 'Used' 
                    ? (isVi ? 'Đã sử dụng' : 'Used') 
                    : (selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date() 
                      ? (isVi ? 'Đã hết hạn' : 'Expired') 
                      : (selectedVoucher.startDate && new Date(selectedVoucher.startDate) > new Date()
                        ? (isVi ? 'Sắp có' : 'Upcoming')
                        : (isVi ? 'Khả dụng' : 'Available')))}
                </div>
              </div>

              <div className="v-modal-right">
                <div className="v-modal-header">
                  <h2>{isVi ? 'Chi Tiết Voucher' : 'Voucher Details'}</h2>
                  <p className="v-modal-desc-text">
                    {getVoucherDescription(selectedVoucher)}
                  </p>
                </div>

                <div className="v-modal-info-grid">
                  <div className="v-info-row">
                    <span className="v-info-lbl">{isVi ? 'Mã Voucher:' : 'Voucher Code:'}</span>
                    <div className="v-info-val-code">
                      <span className="code-font">{selectedVoucher.code}</span>
                      {selectedVoucher.status === 'Active' && !(selectedVoucher.startDate && new Date(selectedVoucher.startDate) > new Date()) && !(selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date()) && (
                        <button 
                          className="v-detail-copy-btn" 
                          onClick={(e) => handleCopyCode(e, selectedVoucher.code, false)}
                        >
                          {copiedCode === selectedVoucher.code ? (isVi ? 'Đã chép' : 'Copied') : (isVi ? 'Sao chép' : 'Copy')}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedVoucher.sellerName && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">{isVi ? 'Cửa Hàng Áp Dụng:' : 'Applicable Store:'}</span>
                      <span className="v-info-val">{isVi ? `Chỉ tại ${selectedVoucher.sellerName}` : `Only at ${selectedVoucher.sellerName}`}</span>
                    </div>
                  )}

                  <div className="v-info-row">
                    <span className="v-info-lbl">{isVi ? 'Đơn Hàng Tối Thiểu:' : 'Minimum Order Value:'}</span>
                    <span className="v-info-val">{selectedVoucher.minOrderValue ? `${selectedVoucher.minOrderValue.toLocaleString('vi-VN')} VND` : '0 VND'}</span>
                  </div>

                  {selectedVoucher.maxDiscountValue > 0 && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">{isVi ? 'Mức Giảm Tối Đa:' : 'Maximum Discount Cap:'}</span>
                      <span className="v-info-val">{selectedVoucher.maxDiscountValue.toLocaleString('vi-VN')} VND</span>
                    </div>
                  )}

                  <div className="v-info-row">
                    <span className="v-info-lbl">{isVi ? 'Bắt Đầu Từ:' : 'Valid From:'}</span>
                    <span className="v-info-val">
                      {selectedVoucher.startDate 
                        ? new Date(selectedVoucher.startDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'long' })
                        : (isVi ? 'Tức thì' : 'N/A')}
                    </span>
                  </div>

                  <div className="v-info-row">
                    <span className="v-info-lbl">{isVi ? 'Hạn Sử Dụng Đến:' : 'Expires On:'}</span>
                    <span className="v-info-val">
                      {selectedVoucher.expirationDate 
                        ? new Date(selectedVoucher.expirationDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'long' })
                        : (isVi ? 'Không thời hạn' : 'No expiry')}
                    </span>
                  </div>

                  {selectedVoucher.usedAt && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">{isVi ? 'Đã Sử Dụng Vào:' : 'Used On:'}</span>
                      <span className="v-info-val">
                        {new Date(selectedVoucher.usedAt).toLocaleString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'long', timeStyle: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="v-modal-terms">
              <h3>{isVi ? 'Điều Khoản & Điều Kiện' : 'Terms & Conditions'}</h3>
              <ul>
                <li>{isVi ? 'Voucher này không thể chuyển nhượng và dành riêng cho gói hội viên của bạn.' : 'This voucher is non-transferable and exclusive to your active subscription.'}</li>
                <li>{isVi ? 'Voucher phải được áp dụng tại bước thanh toán trước khi hoàn tất.' : 'Vouchers must be applied during checkout before completing payment.'}</li>
                <li>{isVi ? 'Mỗi voucher chỉ có thể sử dụng 1 lần trong thời hạn cho phép.' : 'Each voucher can only be redeemed once within its validity period.'}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
