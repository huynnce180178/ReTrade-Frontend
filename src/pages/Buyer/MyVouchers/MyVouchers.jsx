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
  
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'used' | 'expired'
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  useEffect(() => {
    if (!user) return;

    const loadVouchers = async () => {
      setLoading(true);
      try {
        const data = await voucherService.getMyVouchers();
        setVouchers(data || []);
      } catch (err) {
        showToast(err?.response?.data || 'Failed to load vouchers.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadVouchers();
  }, [user, showToast]);

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading your vouchers...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleCopyCode = (e, code) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Code "${code}" copied to clipboard!`, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getFilteredVouchers = () => {
    const now = new Date();
    return vouchers.filter((mv) => {
      const isExpired = mv.expirationDate ? new Date(mv.expirationDate) < now : false;
      const isUsed = mv.status === 'Used';

      if (activeTab === 'used') {
        return isUsed;
      }
      if (activeTab === 'expired') {
        return isExpired && !isUsed;
      }
      // Active tab (Default)
      return !isUsed && !isExpired && mv.status === 'Active';
    });
  };

  const filtered = getFilteredVouchers();

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
                  <p className="ma-subtitle">View and copy your saved vouchers to apply during checkout</p>
                </div>
              </div>
            </div>

            <div className="voucher-tabs-card glass-panel">
              <div className="voucher-tabs">
                <button 
                  className={`v-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                  onClick={() => setActiveTab('active')}
                >
                  Available
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'used' ? 'active' : ''}`}
                  onClick={() => setActiveTab('used')}
                >
                  Used
                </button>
                <button 
                  className={`v-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
                  onClick={() => setActiveTab('expired')}
                >
                  Expired
                </button>
              </div>
            </div>

            {loading ? (
              <div className="voucher-loading">
                <span className="btn-spinner"></span>
                <p>Fetching your vouchers...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="voucher-empty glass-panel text-center">
                <h3>No vouchers found</h3>
                <p>You don't have any vouchers in this category at the moment.</p>
              </div>
            ) : (
              <div className="vouchers-list">
                {filtered.map((mv) => {
                  const formattedExpiry = mv.expirationDate 
                    ? new Date(mv.expirationDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : 'No expiry';

                  return (
                    <div 
                      key={mv.userVoucherId} 
                      className={`voucher-card glass-panel ${activeTab} clickable`}
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
                              <span className="val" style={{ fontSize: '18px' }}>{mv.discountValue.toLocaleString('vi-VN')} VND</span>
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
                            {mv.sellerName && (
                              <span className="v-shop-name">Store: {mv.sellerName}</span>
                            )}
                          </div>
                          <div className="v-limits">
                            {mv.minOrderValue > 0 && (
                              <div className="limit-item">
                                Min Spend: <strong>{mv.minOrderValue.toLocaleString('vi-VN')} VND</strong>
                              </div>
                            )}
                            {mv.maxDiscountValue > 0 && (
                              <div className="limit-item">
                                Max Cap: <strong>{mv.maxDiscountValue.toLocaleString('vi-VN')} VND</strong>
                              </div>
                            )}
                          </div>
                          <div className="v-expiry">
                            Expires on: <strong>{formattedExpiry}</strong>
                          </div>
                        </div>
                        <div className="voucher-action">
                          {activeTab === 'active' ? (
                            <button 
                              className="btn btn-primary v-copy-btn"
                              onClick={(e) => handleCopyCode(e, mv.code)}
                            >
                              {copiedCode === mv.code ? 'Copied' : 'Copy Code'}
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
            
            <div className={`v-modal-ticket ${selectedVoucher.status === 'Used' ? 'used' : (selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date() ? 'expired' : 'active')}`}>
              <div className="v-modal-left">
                <div className="v-modal-discount">
                  {selectedVoucher.discountType === 'Percentage' ? (
                    <>
                      <span className="amount">{selectedVoucher.discountValue}%</span>
                      <span className="label">OFF</span>
                    </>
                  ) : (
                    <>
                      <span className="amount" style={{ fontSize: '24px' }}>{selectedVoucher.discountValue.toLocaleString('vi-VN')} VND</span>
                      <span className="label">OFF</span>
                    </>
                  )}
                </div>
                <div className="v-modal-status-badge">
                  {selectedVoucher.status === 'Used' 
                    ? 'Used' 
                    : (selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date() 
                      ? 'Expired' 
                      : 'Available')}
                </div>
              </div>

              <div className="v-modal-right">
                <div className="v-modal-header">
                  <h2>Voucher Details</h2>
                  <p className="v-modal-desc-text">
                    This voucher can be applied to orders matching the minimum value criteria.
                  </p>
                </div>

                <div className="v-modal-info-grid">
                  <div className="v-info-row">
                    <span className="v-info-lbl">Voucher Code:</span>
                    <div className="v-info-val-code">
                      <span className="code-font">{selectedVoucher.code}</span>
                      {selectedVoucher.status === 'Active' && !(selectedVoucher.expirationDate && new Date(selectedVoucher.expirationDate) < new Date()) && (
                        <button 
                          className="v-detail-copy-btn" 
                          onClick={(e) => handleCopyCode(e, selectedVoucher.code)}
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
                <li>This voucher is non-transferable and can only be used by the account it was assigned to.</li>
                <li>Vouchers must be applied during checkout before making payments. Retroactive discounts cannot be applied.</li>
                <li>If the order is cancelled, the voucher status will revert based on the order cancellation policy.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
