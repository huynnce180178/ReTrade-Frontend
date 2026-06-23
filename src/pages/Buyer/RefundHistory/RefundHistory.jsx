import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import userRefundService from '../../../services/userRefundService';
import '../../../styles/MyAccount.css';
import './RefundHistory.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
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

const filterTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'Pending', label: 'Chờ Admin chuyển' },
  { key: 'Processed', label: 'Đang chuyển' },
  { key: 'Completed', label: 'Đã nhận tiền' },
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
    const pendingCount = refunds.filter(r => r.status === 'Pending').length;
    const completedCount = refunds.filter(r => r.status === 'Completed').length;
    return { totalCount, totalAmount, pendingCount, completedCount };
  }, [refunds]);

  // Tab counters (without keyword filter)
  const tabCounts = useMemo(() => {
    return refunds.reduce(
      (acc, r) => {
        acc.all += 1;
        if (r.status === 'Pending') acc.Pending += 1;
        if (r.status === 'Processed') acc.Processed += 1;
        if (r.status === 'Completed') acc.Completed += 1;
        return acc;
      },
      { all: 0, Pending: 0, Processed: 0, Completed: 0 }
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
    setBankForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit bank details
  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    if (!editingRefund) return;
    if (!bankForm.bankName.trim() || !bankForm.bankAccountNumber.trim() || !bankForm.bankAccountHolder.trim()) {
      showToast('Vui lòng điền đầy đủ thông tin tài khoản ngân hàng.', 'warning');
      return;
    }

    try {
      setModalLoading(true);
      await userRefundService.updateBankDetails(editingRefund.refundRequestId, bankForm);
      showToast('Thông tin tài khoản ngân hàng đã được cập nhật thành công.', 'success');
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
      showToast('Xác nhận nhận tiền thành công!', 'success');
      setConfirmingRefund(null);
      await loadRefunds();
    } catch (error) {
      showToast(error?.response?.data || 'Xác nhận nhận tiền thất bại.', 'error');
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
                    <h1 className="ma-headline">Lịch sử hoàn tiền</h1>
                    <p className="ma-subtitle">Theo dõi các yêu cầu hoàn cọc và cập nhật tài khoản nhận tiền.</p>
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
                    placeholder="Tìm kiếm theo mô tả..."
                  />
                </label>
              </section>

              <section className="refund-list">
                {loading ? (
                  <div className="refund-empty-state">
                    <span className="btn-spinner"></span>
                    <p>Đang tải dữ liệu...</p>
                  </div>
                ) : paginatedRefunds.length === 0 ? (
                  <div className="refund-empty-state">
                    <span className="material-symbols-outlined">payments</span>
                    <h3>Không tìm thấy yêu cầu hoàn tiền nào</h3>
                    <p>Điều chỉnh bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
                  </div>
                ) : (
                  paginatedRefunds.map((refund) => (
                    <article key={refund.refundRequestId} className="refund-card">
                      <header className="refund-card-header">
                        <div className="refund-card-header-left">
                          <strong className="refund-card-order-code">REF #{refund.refundRequestId.split('_').pop().toUpperCase()}</strong>
                          <span className="refund-card-date">{formatDate(refund.requestedAt)}</span>
                        </div>
                        <em className={`refund-status ${refund.status.toLowerCase()}`}>
                          {refund.status === 'Pending' ? 'Chờ Admin chuyển' : refund.status === 'Processed' ? 'Đang chuyển' : 'Đã nhận tiền'}
                        </em>
                      </header>

                      <div className="refund-card-body">
                        <div className="refund-bank-display-box">
                          <span className="material-symbols-outlined">account_balance</span>
                          <div className="refund-bank-display-details">
                            {refund.bankName ? (
                              <>
                                <strong>{refund.bankName}</strong>
                                <span>Số tài khoản: {refund.bankAccountNumber} ({refund.bankAccountHolder})</span>
                              </>
                            ) : (
                              <em style={{ color: '#ea580c', fontWeight: 700 }}>
                                Chưa cập nhật tài khoản ngân hàng nhận tiền cọc
                              </em>
                            )}
                          </div>
                        </div>

                        <div className="refund-detail-row">
                          <div className="refund-info-group">
                            <span className="refund-info-label">Mô tả</span>
                            <span className="refund-info-value" style={{ fontWeight: 500 }}>{refund.note || '-'}</span>
                          </div>
                          <div className="refund-info-group" style={{ alignItems: 'flex-end' }}>
                            <span className="refund-info-label">Số tiền hoàn</span>
                            <strong className="refund-info-value amount">{formatVnd(refund.amount)}</strong>
                          </div>
                        </div>
                      </div>

                      <footer className="refund-card-actions">
                        {refund.status === 'Pending' && (
                          <button
                            type="button"
                            className="refund-detail-btn"
                            onClick={() => handleOpenEdit(refund)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>edit</span>
                            {refund.bankName ? 'Sửa tài khoản nhận' : 'Cập nhật tài khoản'}
                          </button>
                        )}
                        {refund.status === 'Processed' && (
                          <button
                            type="button"
                            className="refund-primary-btn"
                            onClick={() => setConfirmingRefund(refund)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>check_circle</span>
                            Đã nhận tiền (Received)
                          </button>
                        )}
                        {refund.status === 'Completed' && (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700, paddingRight: '12px' }}>
                            Yêu cầu đã hoàn tất
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
                      Đang hiển thị {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} trên tổng số {totalItems}
                    </span>
                  </div>
                  <div className="refund-pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Trước
                    </button>
                    <span className="page-indicator">Trang {page}</span>
                    <button type="button" disabled={page * pageSize >= totalItems} onClick={() => setPage((p) => p + 1)}>
                      Sau
                    </button>
                  </div>
                </footer>
              )}
            </section>

            <aside className="refund-side-col">
              <div className="refund-side-sticky glass-panel">
                <section className="refund-summary-card">
                  <h2>Tổng kết hoàn tiền</h2>
                  <div className="refund-total-spent">
                    <span>Tổng tiền cọc được hoàn</span>
                    <strong>{formatVnd(summaries.totalAmount)}</strong>
                  </div>
                  <div className="refund-summary-grid">
                    <div>
                      <span>Tổng số lần</span>
                      <strong>{summaries.totalCount}</strong>
                    </div>
                    <div>
                      <span>Chờ chuyển</span>
                      <strong>{summaries.pendingCount}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span>Đã hoàn tất</span>
                      <strong>{summaries.completedCount} lần</strong>
                    </div>
                  </div>
                </section>

                <section className="refund-insights-card">
                  <h2>Tỷ lệ trạng thái</h2>
                  <InsightBar label={`Đã nhận (${tabCounts.Completed})`} value={getPercent(tabCounts.Completed, summaries.totalCount)} />
                  <InsightBar label={`Đang chuyển (${tabCounts.Processed})`} value={getPercent(tabCounts.Processed, summaries.totalCount)} />
                  <InsightBar label={`Chờ chuyển (${tabCounts.Pending})`} value={getPercent(tabCounts.Pending, summaries.totalCount)} muted />

                  <div className="refund-insight-note">
                    <span className="material-symbols-outlined">info</span>
                    <p>Hãy đảm bảo thông tin tài khoản ngân hàng của bạn là chính xác để Admin có thể chuyển khoản cọc.</p>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {/* Edit bank details modal */}
      {editingRefund && (
        <div className="refund-edit-modal-overlay" onClick={handleCloseEdit}>
          <form className="refund-edit-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveBankDetails}>
            <header className="refund-edit-modal-header">
              <h3>Thông tin tài khoản nhận tiền</h3>
              <button type="button" className="refund-edit-modal-close" onClick={handleCloseEdit} disabled={modalLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <div className="refund-form-group">
                <label htmlFor="bankName">Tên ngân hàng</label>
                <input
                  id="bankName"
                  name="bankName"
                  value={bankForm.bankName}
                  onChange={handleBankFormChange}
                  placeholder="Ví dụ: Vietcombank, Techcombank, MB Bank..."
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountNumber">Số tài khoản</label>
                <input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  value={bankForm.bankAccountNumber}
                  onChange={handleBankFormChange}
                  placeholder="Nhập số tài khoản ngân hàng nhận tiền cọc..."
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountHolder">Tên chủ tài khoản</label>
                <input
                  id="bankAccountHolder"
                  name="bankAccountHolder"
                  value={bankForm.bankAccountHolder}
                  onChange={handleBankFormChange}
                  placeholder="NHAP TEN CHU TAI KHOAN CO DAU..."
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
                Hủy
              </button>
              <button
                type="submit"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                disabled={modalLoading}
              >
                {modalLoading ? <span className="btn-spinner"></span> : 'Lưu lại'}
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
              <h3>Xác nhận đã nhận được tiền</h3>
              <button type="button" className="refund-edit-modal-close" onClick={() => setConfirmingRefund(null)} disabled={confirmLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <p>
                Bạn xác nhận là đã nhận được số tiền hoàn cọc này từ Admin chuyển khoản thủ công vào tài khoản ngân hàng của bạn?
                Hành động này sẽ đánh dấu yêu cầu là **Hoàn tất** và không thể hoàn tác.
              </p>
              <div className="admin-refund-modal-target" style={{ margin: 0, padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Số tiền hoàn nhận được</span>
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
                Hủy
              </button>
              <button
                type="button"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                onClick={handleConfirmReceived}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="btn-spinner"></span> : 'Xác nhận (Received)'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
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
