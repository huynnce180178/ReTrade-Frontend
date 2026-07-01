import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import userRefundService from '../../../services/userRefundService';
import '../../../styles/MyAccount.css';
import './RefundHistory.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

const removeVietnameseTones = (str) => {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return str;
};

const sanitizeAccountHolderName = (value) => {
  const noTones = removeVietnameseTones(value);
  return noTones.toUpperCase().replace(/[^A-Z ]/g, '');
};

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'NotReady', label: 'Not Ready' },
  { key: 'Pending', label: 'Pending Transfer' },
  { key: 'Processed', label: 'Processing' },
  { key: 'Completed', label: 'Received' },
];

export default function RefundHistory() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  // Modals editing
  const [editingRefund, setEditingRefund] = useState(null);
  const [bankForm, setBankForm] = useState({ bankName: '', bankAccountNumber: '', bankAccountHolder: '' });
  const [modalLoading, setModalLoading] = useState(false);

  // Confirm overlay
  const [confirmingRefund, setConfirmingRefund] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Bank List from VietQR
  const [banksList, setBanksList] = useState([]);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('https://api.vietqr.io/v2/banks');
        const resJson = await response.json();
        if (resJson && resJson.code === '00' && Array.isArray(resJson.data)) {
          setBanksList(resJson.data);
        } else {
          throw new Error('Invalid response');
        }
      } catch (err) {
        console.error('Failed to fetch banks list, falling back to static list.', err);
        setBanksList([
          { code: 'VCB', shortName: 'Vietcombank' },
          { code: 'TCB', shortName: 'Techcombank' },
          { code: 'CTG', shortName: 'VietinBank' },
          { code: 'BID', shortName: 'BIDV' },
          { code: 'VBA', shortName: 'Agribank' },
          { code: 'MB', shortName: 'MB Bank' },
          { code: 'ACB', shortName: 'ACB' },
          { code: 'VPB', shortName: 'VPBank' },
          { code: 'STB', shortName: 'Sacombank' },
          { code: 'TPB', shortName: 'TPBank' },
          { code: 'VIB', shortName: 'VIB' },
        ]);
      }
    };
    fetchBanks();
  }, []);

  const loadRefunds = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await userRefundService.getMyRefunds();
      setRefunds(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load refund history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadRefunds();
    }
  }, [user]);

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm]);

  // Client-side search and filter
  const filteredRefunds = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return refunds.filter((r) => {
      const matchesKeyword = !keyword || (r.note && r.note.toLowerCase().includes(keyword));
      const matchesTab = activeTab === 'all' || r.status === activeTab;
      return matchesKeyword && matchesTab;
    });
  }, [refunds, activeTab, searchTerm]);

  // Pagination bounds
  const totalItems = filteredRefunds.length;
  const paginatedRefunds = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRefunds.slice(start, start + pageSize);
  }, [filteredRefunds, page]);

  // Calculations for stats
  const summaries = useMemo(() => {
    const totalCount = refunds.length;
    const totalAmount = refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const notReadyCount = refunds.filter(r => r.status === 'NotReady').length;
    const pendingCount = refunds.filter(r => r.status === 'Pending').length;
    const completedCount = refunds.filter(r => r.status === 'Completed').length;
    return { totalCount, totalAmount, notReadyCount, pendingCount, completedCount };
  }, [refunds]);

  // Tab counters (without keyword filter)
  const tabCounts = useMemo(() => {
    return refunds.reduce(
      (acc, r) => {
        acc.all += 1;
        if (r.status === 'NotReady') acc.NotReady += 1;
        if (r.status === 'Pending') acc.Pending += 1;
        if (r.status === 'Processed') acc.Processed += 1;
        if (r.status === 'Completed') acc.Completed += 1;
        return acc;
      },
      { all: 0, NotReady: 0, Pending: 0, Processed: 0, Completed: 0 }
    );
  }, [refunds]);

  // Open edit modal
  const handleOpenEdit = (refund) => {
    setEditingRefund(refund);
    setBankForm({
      bankName: refund.bankName || '',
      bankAccountNumber: refund.bankAccountNumber || '',
      bankAccountHolder: refund.bankAccountHolder || '',
    });
  };

  // Close edit modal
  const handleCloseEdit = () => {
    if (modalLoading) return;
    setEditingRefund(null);
  };

  const handleBankFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'bankAccountHolder') {
      const sanitized = sanitizeAccountHolderName(value);
      setBankForm(prev => ({ ...prev, [name]: sanitized }));
    } else {
      setBankForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Submit bank details
  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    if (!editingRefund) return;
    if (!bankForm.bankName.trim() || !bankForm.bankAccountNumber.trim() || !bankForm.bankAccountHolder.trim()) {
      showToast('Please fill in all bank account details.', 'warning');
      return;
    }

    const holderRegex = /^[A-Z ]+$/;
    if (!holderRegex.test(bankForm.bankAccountHolder)) {
      showToast('Account holder name must contain only uppercase non-accented letters.', 'warning');
      return;
    }

    try {
      setModalLoading(true);
      await userRefundService.updateBankDetails(editingRefund.refundRequestId, bankForm);
      showToast('Bank account details updated successfully.', 'success');
      setEditingRefund(null);
      await loadRefunds();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to update bank details.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // Confirm receipt of money
  const handleConfirmReceived = async () => {
    if (!confirmingRefund) return;
    try {
      setConfirmLoading(true);
      await userRefundService.confirmReceived(confirmingRefund.refundRequestId);
      showToast('Confirmed receipt successfully!', 'success');
      setConfirmingRefund(null);
      await loadRefunds();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to confirm receipt.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading refund history...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <div className="profile-page-wrapper container animate-fade-in">
        <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="refund-layout">
            <section className="refund-main-col">
              <div className="ma-card refund-hero-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">Refund History</h1>
                    <p className="ma-subtitle">Track your deposit refund requests and update payout accounts.</p>
                  </div>
                </div>
              </div>

              <section className="refund-filter-card">
                <div className="refund-tabs">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={activeTab === tab.key ? 'active' : ''}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                      <span>{tabCounts[tab.key] || 0}</span>
                    </button>
                  ))}
                </div>

                <label className="refund-search">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by description..."
                  />
                </label>
              </section>

              <section className="refund-list">
                {loading ? (
                  <div className="refund-empty-state">
                    <span className="btn-spinner"></span>
                    <p>Loading data...</p>
                  </div>
                ) : paginatedRefunds.length === 0 ? (
                  <div className="refund-empty-state">
                    <span className="material-symbols-outlined">payments</span>
                    <h3>No refund requests found</h3>
                    <p>Adjust your filters or try a different search keyword.</p>
                  </div>
                ) : (
                  paginatedRefunds.map((refund) => (
                    <article key={refund.refundRequestId} className="refund-card">
                      <header className="refund-card-header">
                        <div className="refund-card-header-left">
                          <strong className="refund-card-order-code">REF #{refund.refundRequestId.split('_').pop().toUpperCase()}</strong>
                          <span className="refund-card-date">{formatDate(refund.requestedAt)}</span>
                        </div>
                        <em className={`refund-status ${refund.status ? refund.status.toLowerCase() : ''}`}>
                          {refund.status === 'NotReady' ? 'Not Ready' : refund.status === 'Pending' ? 'Pending' : refund.status === 'Processed' ? 'Processing' : 'Completed'}
                        </em>
                      </header>

                      <div className="refund-card-body">
                        <div className="refund-bank-display-box">
                          <span className="material-symbols-outlined">account_balance</span>
                          <div className="refund-bank-display-details">
                            {refund.bankName ? (
                              <>
                                <strong>{refund.bankName}</strong>
                                <span>Account Number: {refund.bankAccountNumber} ({refund.bankAccountHolder})</span>
                              </>
                            ) : (
                              <em style={{ color: '#ea580c', fontWeight: 700 }}>
                                Bank account for refund not updated yet
                              </em>
                            )}
                          </div>
                        </div>

                        <div className="refund-detail-row">
                          <div className="refund-info-group">
                            <span className="refund-info-label">Description</span>
                            <span className="refund-info-value" style={{ fontWeight: 500 }}>{refund.note || '-'}</span>
                          </div>
                          <div className="refund-info-group" style={{ alignItems: 'flex-end' }}>
                            <span className="refund-info-label">Refund Amount</span>
                            <strong className="refund-info-value amount">{formatVnd(refund.amount)}</strong>
                          </div>
                        </div>
                      </div>

                      <footer className="refund-card-actions">
                        {refund.status === 'NotReady' && (
                          <button
                            type="button"
                            className="refund-primary-btn animate-pulse"
                            onClick={() => handleOpenEdit(refund)}
                            style={{ background: 'var(--secondary)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>account_balance</span>
                            Add Payout Bank Account
                          </button>
                        )}
                        {refund.status === 'Pending' && (
                          <button
                            type="button"
                            className="refund-detail-btn"
                            onClick={() => handleOpenEdit(refund)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>edit</span>
                            Edit Payout Account
                          </button>
                        )}
                        {refund.status === 'Processed' && (
                          <button
                            type="button"
                            className="refund-primary-btn"
                            onClick={() => setConfirmingRefund(refund)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>check_circle</span>
                            Confirm Received Money
                          </button>
                        )}
                        {refund.status === 'Completed' && (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700, paddingRight: '12px' }}>
                            Request Completed
                          </span>
                        )}
                      </footer>
                    </article>
                  ))
                )}
              </section>

              {totalItems > 0 && (
                <footer className="refund-list-footer">
                  <div>
                    <span>
                      Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} of {totalItems}
                    </span>
                  </div>
                  <div className="refund-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </button>
                    <span className="page-indicator">Page {page}</span>
                    <button type="button" disabled={page * pageSize >= totalItems} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </button>
                  </div>
                </footer>
              )}
            </section>

            <aside className="refund-side-col">
              <div className="refund-side-sticky glass-panel">
                <section className="refund-summary-card">
                  <h2>Refund Summary</h2>
                  <div className="refund-total-spent">
                    <span>Total Deposit Refunded</span>
                    <strong>{formatVnd(summaries.totalAmount)}</strong>
                  </div>
                  <div className="refund-summary-grid">
                    <div>
                      <span>Total Requests</span>
                      <strong>{summaries.totalCount}</strong>
                    </div>
                    <div>
                      <span>Not Ready</span>
                      <strong>{summaries.notReadyCount}</strong>
                    </div>
                    <div>
                      <span>Pending</span>
                      <strong>{summaries.pendingCount}</strong>
                    </div>
                    <div>
                      <span>Completed</span>
                      <strong>{summaries.completedCount}</strong>
                    </div>
                  </div>
                </section>

                <section className="refund-insights-card">
                  <h2>Status Ratio</h2>
                  <InsightBar label={`Completed (${tabCounts.Completed})`} value={getPercent(tabCounts.Completed, summaries.totalCount)} />
                  <InsightBar label={`Processing (${tabCounts.Processed})`} value={getPercent(tabCounts.Processed, summaries.totalCount)} />
                  <InsightBar label={`Pending (${tabCounts.Pending})`} value={getPercent(tabCounts.Pending, summaries.totalCount)} />
                  <InsightBar label={`Not Ready (${tabCounts.NotReady})`} value={getPercent(tabCounts.NotReady, summaries.totalCount)} muted />

                  <div className="refund-insight-note">
                    <span className="material-symbols-outlined">info</span>
                    <p>Please make sure your bank account information is accurate so that the admin can transfer your deposit refund.</p>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>

      {/* Edit bank details modal */}
      {editingRefund && (
        <div className="refund-edit-modal-overlay" onClick={handleCloseEdit}>
          <form className="refund-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveBankDetails}>
            <header className="refund-edit-modal-header">
              <h3>Payout Account Details</h3>
              <button type="button" className="refund-edit-modal-close" onClick={handleCloseEdit} disabled={modalLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <div className="refund-form-group">
                <label htmlFor="bankName">Bank Name</label>
                <select
                  id="bankName"
                  name="bankName"
                  value={bankForm.bankName}
                  onChange={handleBankFormChange}
                  required
                  disabled={modalLoading}
                >
                  <option value="" disabled>Select your bank...</option>
                  {banksList.map((bank) => (
                    <option key={bank.code} value={bank.shortName || bank.short_name || bank.code}>
                      {bank.shortName || bank.short_name || bank.code} ({bank.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountNumber">Account Number</label>
                <input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  value={bankForm.bankAccountNumber}
                  onChange={handleBankFormChange}
                  placeholder="Enter bank account number..."
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountHolder">Account Holder Name</label>
                <input
                  id="bankAccountHolder"
                  name="bankAccountHolder"
                  value={bankForm.bankAccountHolder}
                  onChange={handleBankFormChange}
                  placeholder="ENTER ACCOUNT HOLDER NAME..."
                  required
                  disabled={modalLoading}
                />
              </div>
            </div>

            <footer className="refund-edit-modal-footer">
              <button
                type="button"
                className="refund-detail-btn"
                style={{ padding: '8px 18px', marginRight: '8px' }}
                onClick={handleCloseEdit}
                disabled={modalLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                disabled={modalLoading}
              >
                {modalLoading ? <span className="btn-spinner"></span> : 'Save'}
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Confirm receipt Modal */}
      {confirmingRefund && (
        <div className="refund-edit-modal-overlay" onClick={() => setConfirmingRefund(null)}>
          <div className="refund-edit-modal" onClick={(e) => e.stopPropagation()}>
            <header className="refund-edit-modal-header">
              <h3>Confirm Payment Received</h3>
              <button type="button" className="refund-edit-modal-close" onClick={() => setConfirmingRefund(null)} disabled={confirmLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <p>
                Do you confirm that you have received this deposit refund amount via bank transfer from the Admin?
                This action will mark the request as **Completed** and cannot be undone.
              </p>
              <div className="admin-refund-modal-target" style={{ margin: 0, padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Refund Amount Received</span>
                <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{formatVnd(confirmingRefund.amount)}</strong>
              </div>
            </div>

            <footer className="refund-edit-modal-footer">
              <button
                type="button"
                className="refund-detail-btn"
                style={{ padding: '8px 18px', marginRight: '8px' }}
                onClick={() => setConfirmingRefund(null)}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                onClick={handleConfirmReceived}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="btn-spinner"></span> : 'Confirm (Received)'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function InsightBar({ label, value, muted = false }) {
  return (
    <div className="refund-insight-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="refund-insight-track">
        <span className={muted ? 'muted' : ''} style={{ width: `${value}%` }}></span>
      </div>
    </div>
  );
}
