import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import voucherService from '../../../services/voucherService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import '../../../styles/MyVouchers.css';

export default function MyVouchers() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

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
      // Fetch all user vouchers with OData ordering
      const params = {
        '$orderby': 'CreatedAt desc'
      };

      const res = await voucherService.getMyVouchers(params);
      const items = Array.isArray(res) ? res : (res?.value || res?.items || []);
      setAllVouchers(items);
    } catch (err) {
      showToast(typeof err?.response?.data === 'string' ? err.response.data : 'Failed to load vouchers.', 'error');
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
        <p>Loading your vouchers...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleCopyCode = (e, code, isUpcoming) => {
    e.stopPropagation();
    if (isUpcoming) {
      showToast('This voucher is not active yet. It will unlock on its start date!', 'info');
      return;
    }
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Code "${code}" copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Helper to generate dynamic English description
  const getEnglishDescription = (mv) => {
    const minSpendStr = mv.minOrderValue && mv.minOrderValue > 0 
      ? `${mv.minOrderValue.toLocaleString('en-US')} VND` 
      : null;
    
    if (mv.discountType === 'Fixed') {
      const discountStr = mv.discountValue ? `${mv.discountValue.toLocaleString('en-US')} VND` : 'shipping';
      if (minSpendStr) {
        return `Free shipping discount up to ${discountStr} on orders from ${minSpendStr}`;
      }
      return `Free shipping discount up to ${discountStr} on all orders`;
    }

    // Percentage discount
    const pct = mv.discountValue || 0;
    const maxCapStr = mv.maxDiscountValue && mv.maxDiscountValue > 0 
      ? `${mv.maxDiscountValue.toLocaleString('en-US')} VND` 
      : null;

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
      // Available tab (Default)
      return !isUsed && !isExpired && !isUpcoming && (mv.status === 'Active' || !mv.status);
    });
  };

  const filteredAll = getFilteredVouchers();
  const totalCount = filteredAll.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Paginate current page
  const paginatedVouchers = filteredAll.slice((page - 1) * pageSize, page * pageSize);

  // Tab count badges
  const now = new Date();
  const availableCount = allVouchers.filter(mv => (mv.status === 'Active' || !mv.status) && !mv.usedAt && (mv.expirationDate ? new Date(mv.expirationDate) >= now : true) && (mv.startDate ? new Date(mv.startDate) <= now : true)).length;
  const upcomingCount = allVouchers.filter(mv => (mv.status === 'Active' || !mv.status) && !mv.usedAt && (mv.expirationDate ? new Date(mv.expirationDate) >= now : true) && (mv.startDate ? new Date(mv.startDate) > now : false)).length;
  const usedCount = allVouchers.filter(mv => mv.status === 'Used' || !!mv.usedAt).length;
  const expiredCount = allVouchers.filter(mv => mv.status !== 'Used' && !mv.usedAt && mv.expirationDate && new Date(mv.expirationDate) < now).length;

  return (
    <>
      <div className="profile-page-wrapper container animate-fade-in">
        <div className="profile-grid">
          <AccountSidebar />

          <main className="ma-main">
            <div className="ma-card ma-header-card">
              <div className="ma-header-info">
                <div className="ma-header-icon">
                  <span className="material-symbols-outlined">local_activity</span>
                </div>
                <div>
                  <h1 className="ma-headline">My Vouchers</h1>
                  <p className="ma-subtitle">View, copy, and apply your member subscription vouchers during checkout</p>
                </div>
              </div>
            </div>

            <div className="voucher-tabs-card glass-panel">
              <div className="voucher-tabs">
                <button 
                  className={`v-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('active'); setPage(1); }}
                >
                  Available ({availableCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('upcoming'); setPage(1); }}
                >
                  Upcoming ({upcomingCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'used' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('used'); setPage(1); }}
                >
                  Used ({usedCount})
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('expired'); setPage(1); }}
                >
                  Expired ({expiredCount})
                </button>
              </div>

              {/* Sub-filter by Voucher Type */}
              <div className="v-subfilters-bar flex items-center justify-between pt-3 mt-3 border-t border-gray-100 flex-wrap gap-2 px-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                  <span>Filter by Type:</span>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('all'); setPage(1); }}
                  >
                    All Types
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'Percentage' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('Percentage'); setPage(1); }}
                  >
                    Discount (%)
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${typeFilter === 'Fixed' ? 'bg-secondary text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => { setTypeFilter('Fixed'); setPage(1); }}
                  >
                    Free Shipping / Ship
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="voucher-loading">
                <span className="btn-spinner"></span>
                <p>Fetching your vouchers...</p>
              </div>
            ) : paginatedVouchers.length === 0 ? (
              <div className="voucher-empty glass-panel text-center">
                <h3>No vouchers found</h3>
                <p>You don't have any vouchers in the <strong>{activeTab}</strong> tab at the moment.</p>
              </div>
            ) : (
              <>
                <div className="vouchers-list">
                  {paginatedVouchers.map((mv) => {
                    const isUpcoming = mv.startDate ? new Date(mv.startDate) > now : false;
                    const formattedStartDate = mv.startDate
                      ? new Date(mv.startDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })
                      : 'Immediate';

                    const formattedExpiry = mv.expirationDate 
                      ? new Date(mv.expirationDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : 'No expiry';

                    const englishDesc = getEnglishDescription(mv);

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
                                <span className="lbl">OFF</span>
                              </>
                            ) : (
                              <>
                                <span className="val" style={{ fontSize: '18px' }}>
                                  {(mv.discountValue || 0).toLocaleString('vi-VN')} VND
                                </span>
                                <span className="lbl">Discount</span>
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
                                  Unlocks {formattedStartDate}
                                </span>
                              )}
                              {mv.sellerName && (
                                <span className="v-shop-name">Store: {mv.sellerName}</span>
                              )}
                            </div>

                            {/* Clear English Description */}
                            <div className="v-desc-text">
                              {englishDesc}
                            </div>

                            <div className="v-expiry">
                              {isUpcoming ? (
                                <span>Valid: <strong>{formattedStartDate}</strong> - <strong>{formattedExpiry}</strong></span>
                              ) : (
                                <span>Expires on: <strong>{formattedExpiry}</strong></span>
                              )}
                            </div>
                          </div>
                          <div className="voucher-action">
                            {activeTab === 'active' ? (
                              <button 
                                className="btn btn-primary v-copy-btn"
                                onClick={(e) => handleCopyCode(e, mv.code, false)}
                              >
                                {copiedCode === mv.code ? 'Copied' : 'Copy Code'}
                              </button>
                            ) : activeTab === 'upcoming' ? (
                              <button 
                                className="btn btn-secondary v-copy-btn disabled"
                                onClick={(e) => handleCopyCode(e, mv.code, true)}
                              >
                                Upcoming
                              </button>
                            ) : (
                              <span className={`v-status-badge ${activeTab}`}>
                                {activeTab.toUpperCase()}
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
                      Page {page} of {totalPages} ({totalCount} vouchers in this tab)
                    </span>
                    <div className="v-pagination-buttons">
                      <button 
                        className="btn btn-outline v-page-btn"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
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
                        Next
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
                      <span className="label">OFF</span>
                    </>
                  ) : (
                    <>
                      <span className="amount" style={{ fontSize: '24px' }}>
                        {(selectedVoucher.discountValue || 0).toLocaleString('vi-VN')} VND
                      </span>
                      <span className="label">OFF</span>
                    </>
                  )}
                </div>
                <div className="v-modal-status-badge">
                  {selectedVoucher.status === 'Used' 
                    ? 'Used' 
                    : (selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date() 
                      ? 'Expired' 
                      : (selectedVoucher.startDate && new Date(selectedVoucher.startDate) > new Date()
                        ? 'Upcoming'
                        : 'Available'))}
                </div>
              </div>

              <div className="v-modal-right">
                <div className="v-modal-header">
                  <h2>Voucher Details</h2>
                  <p className="v-modal-desc-text">
                    {getEnglishDescription(selectedVoucher)}
                  </p>
                </div>

                <div className="v-modal-info-grid">
                  <div className="v-info-row">
                    <span className="v-info-lbl">Voucher Code:</span>
                    <div className="v-info-val-code">
                      <span className="code-font">{selectedVoucher.code}</span>
                      {selectedVoucher.status === 'Active' && !(selectedVoucher.startDate && new Date(selectedVoucher.startDate) > new Date()) && !(selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date()) && (
                        <button 
                          className="v-detail-copy-btn" 
                          onClick={(e) => handleCopyCode(e, selectedVoucher.code, false)}
                        >
                          {copiedCode === selectedVoucher.code ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedVoucher.sellerName && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">Applicable Store:</span>
                      <span className="v-info-val">Only at {selectedVoucher.sellerName}</span>
                    </div>
                  )}

                  <div className="v-info-row">
                    <span className="v-info-lbl">Minimum Order Value:</span>
                    <span className="v-info-val">{selectedVoucher.minOrderValue ? `${selectedVoucher.minOrderValue.toLocaleString('vi-VN')} VND` : '0 VND'}</span>
                  </div>

                  {selectedVoucher.maxDiscountValue > 0 && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">Maximum Discount Cap:</span>
                      <span className="v-info-val">{selectedVoucher.maxDiscountValue.toLocaleString('vi-VN')} VND</span>
                    </div>
                  )}

                  <div className="v-info-row">
                    <span className="v-info-lbl">Valid From:</span>
                    <span className="v-info-val">
                      {selectedVoucher.startDate 
                        ? new Date(selectedVoucher.startDate).toLocaleDateString('en-US', { dateStyle: 'long' })
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="v-info-row">
                    <span className="v-info-lbl">Expires On:</span>
                    <span className="v-info-val">
                      {selectedVoucher.expirationDate 
                        ? new Date(selectedVoucher.expirationDate).toLocaleDateString('en-US', { dateStyle: 'long' })
                        : 'No expiry'}
                    </span>
                  </div>

                  {selectedVoucher.usedAt && (
                    <div className="v-info-row">
                      <span className="v-info-lbl">Used On:</span>
                      <span className="v-info-val">
                        {new Date(selectedVoucher.usedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="v-modal-terms">
              <h3>Terms & Conditions</h3>
              <ul>
                <li>This voucher is non-transferable and exclusive to your active subscription.</li>
                <li>Vouchers must be applied during checkout before completing payment.</li>
                <li>Each voucher can only be redeemed once within its validity period.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
