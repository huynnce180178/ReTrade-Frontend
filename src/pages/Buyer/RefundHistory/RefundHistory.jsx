import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
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
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

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
      } catch (e) {
        setBanksList([
          { code: 'VCB', shortName: 'Vietcombank' },
          { code: 'TCB', shortName: 'Techcombank' },
          { code: 'MB', shortName: 'MBBank' },
          { code: 'ACB', shortName: 'ACB' },
          { code: 'VPB', shortName: 'VPBank' },
          { code: 'BIDV', shortName: 'BIDV' },
          { code: 'CTG', shortName: 'VietinBank' },
          { code: 'TPB', shortName: 'TPBank' },
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
      showToast(error?.response?.data || (isVi ? 'Không thể tải lịch sử hoàn tiền.' : 'Failed to load refund history.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadRefunds();
    }
  }, [user]);

  // Scroll to top when page changes
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
  }, [page]);

  // Reset page when filter or search term changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm]);

  // Filter refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((refund) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (refund.note || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (refund.bankName || '').toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (refund.bankAccountNumber || '').includes(searchTerm.trim());

      if (!matchesSearch) return false;

      if (activeTab === 'all') return true;
      return refund.status === activeTab;
    });
  }, [refunds, activeTab, searchTerm]);

  const totalItems = filteredRefunds.length;

  const paginatedRefunds = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRefunds.slice(start, start + pageSize);
  }, [filteredRefunds, page, pageSize]);

  // Summaries
  const summaries = useMemo(() => {
    let totalAmount = 0;
    let notReadyCount = 0;
    let pendingCount = 0;
    let completedCount = 0;

    refunds.forEach((r) => {
      if (r.status === 'Completed') {
        totalAmount += Number(r.amount || 0);
        completedCount += 1;
      } else if (r.status === 'NotReady') {
        notReadyCount += 1;
      } else if (r.status === 'Pending') {
        pendingCount += 1;
      }
    });

    return {
      totalCount: refunds.length,
      notReadyCount,
      pendingCount,
      completedCount,
      totalAmount,
    };
  }, [refunds]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return refunds.reduce(
      (acc, r) => {
        acc.all += 1;
        if (r.status && acc[r.status] !== undefined) {
          acc[r.status] += 1;
        }
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
      setBankForm((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setBankForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Submit bank details
  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    if (!editingRefund) return;
    if (!bankForm.bankName.trim() || !bankForm.bankAccountNumber.trim() || !bankForm.bankAccountHolder.trim()) {
      showToast(isVi ? 'Vui lòng điền đầy đủ thông tin tài khoản ngân hàng.' : 'Please fill in all bank account details.', 'warning');
      return;
    }

    const holderRegex = /^[A-Z ]+$/;
    if (!holderRegex.test(bankForm.bankAccountHolder)) {
      showToast(isVi ? 'Tên chủ tài khoản phải chỉ chứa chữ cái tiếng Việt không dấu in hoa.' : 'Account holder name must contain only uppercase non-accented letters.', 'warning');
      return;
    }

    try {
      setModalLoading(true);
      await userRefundService.updateBankDetails(editingRefund.refundRequestId, bankForm);
      showToast(isVi ? 'Cập nhật tài khoản ngân hàng nhận tiền thành công!' : 'Bank account details updated successfully.', 'success');
      setEditingRefund(null);
      await loadRefunds();
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể cập nhật tài khoản ngân hàng.' : 'Failed to update bank details.'), 'error');
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
      showToast(isVi ? 'Đã xác nhận nhận tiền cọc thành công!' : 'Refund marked as received & completed.', 'success');
      setConfirmingRefund(null);
      await loadRefunds();
    } catch (error) {
      showToast(error?.response?.data || (isVi ? 'Không thể xác nhận nhận tiền.' : 'Failed to confirm receipt.'), 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{isVi ? 'Đang tải lịch sử hoàn tiền...' : 'Loading refund history...'}</p>
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
                      <h1 className="ma-headline">{isVi ? 'Lịch Sử Hoàn Tiền' : 'Refund History'}</h1>
                      <p className="ma-subtitle">{isVi ? 'Theo dõi các yêu cầu hoàn tiền đặt cọc và cập nhật tài khoản nhận tiền.' : 'Track your deposit refund requests and update payout accounts.'}</p>
                    </div>
                  </div>
                </div>

                <section className="refund-filter-card">
                  <div className="refund-tabs">
                    {filterTabs.map((tab) => {
                      const tabMapVi = {
                        all: 'Tất cả',
                        NotReady: 'Chưa đủ điều kiện',
                        Pending: 'Chờ chuyển khoản',
                        Processed: 'Đang hoàn tiền',
                        Completed: 'Đã nhận tiền',
                      };
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          className={activeTab === tab.key ? 'active' : ''}
                          onClick={() => setActiveTab(tab.key)}
                        >
                          {isVi ? (tabMapVi[tab.key] || tab.label) : tab.label}
                          <span>{tabCounts[tab.key] || 0}</span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="refund-search">
                    <span className="material-symbols-outlined">search</span>
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={isVi ? 'Tìm theo mô tả...' : 'Search by description...'}
                    />
                  </label>
                </section>

                <section className="refund-list">
                  {loading ? (
                    <div className="refund-empty-state">
                      <span className="btn-spinner"></span>
                      <p>{isVi ? 'Đang tải dữ liệu hoàn tiền...' : 'Loading data...'}</p>
                    </div>
                  ) : paginatedRefunds.length === 0 ? (
                    <div className="refund-empty-state">
                      <span className="material-symbols-outlined">payments</span>
                      <h3>{isVi ? 'Không tìm thấy yêu cầu hoàn tiền nào' : 'No refund requests found'}</h3>
                      <p>{isVi ? 'Điều chỉnh bộ lọc hoặc thử từ khóa tìm kiếm khác.' : 'Adjust your filters or try a different search keyword.'}</p>
                    </div>
                  ) : (
                    paginatedRefunds.map((refund) => (
                      <article key={refund.refundRequestId} className="refund-card">
                        <header className="refund-card-header">
                          <div className="refund-card-header-left">
                            <strong className="refund-card-order-code">{isVi ? 'Mã hoàn tiền #' : 'REF #'}{refund.refundRequestId.split('_').pop().toUpperCase()}</strong>
                            <span className="refund-card-date">{formatDate(refund.requestedAt)}</span>
                          </div>
                          <em className={`refund-status ${refund.status ? refund.status.toLowerCase() : ''}`}>
                            {refund.status === 'NotReady'
                              ? (isVi ? 'Chưa đủ điều kiện' : 'Not Ready')
                              : refund.status === 'Pending'
                              ? (isVi ? 'Chờ xử lý' : 'Pending')
                              : refund.status === 'Processed'
                              ? (isVi ? 'Đang hoàn tiền' : 'Processing')
                              : (isVi ? 'Đã hoàn thành' : 'Completed')}
                          </em>
                        </header>

                        <div className="refund-card-body">
                          <div className="refund-bank-display-box">
                            <span className="material-symbols-outlined">account_balance</span>
                            <div className="refund-bank-display-details">
                              {refund.bankName ? (
                                <>
                                  <strong>{refund.bankName}</strong>
                                  <span>{isVi ? 'Số tài khoản:' : 'Account Number:'} {refund.bankAccountNumber} ({refund.bankAccountHolder})</span>
                                </>
                              ) : (
                                <em style={{ color: '#ea580c', fontWeight: 700 }}>
                                  {isVi ? 'Chưa cập nhật tài khoản ngân hàng nhận tiền hoàn' : 'Bank account for refund not updated yet'}
                                </em>
                              )}
                            </div>
                          </div>

                          <div className="refund-detail-row">
                            <div className="refund-info-group">
                              <span className="refund-info-label">{isVi ? 'Mô tả' : 'Description'}</span>
                              <span className="refund-info-value" style={{ fontWeight: 500 }}>{refund.note || '-'}</span>
                            </div>
                            <div className="refund-info-group" style={{ alignItems: 'flex-end' }}>
                              <span className="refund-info-label">{isVi ? 'Số tiền hoàn' : 'Refund Amount'}</span>
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
                              {isVi ? 'Thêm tài khoản nhận tiền' : 'Add Payout Bank Account'}
                            </button>
                          )}
                          {refund.status === 'Pending' && (
                            <button
                              type="button"
                              className="refund-detail-btn"
                              onClick={() => handleOpenEdit(refund)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>edit</span>
                              {isVi ? 'Sửa tài khoản nhận tiền' : 'Edit Payout Account'}
                            </button>
                          )}
                          {refund.status === 'Processed' && (
                            <button
                              type="button"
                              className="refund-primary-btn"
                              onClick={() => setConfirmingRefund(refund)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>check_circle</span>
                              {isVi ? 'Xác nhận đã nhận tiền' : 'Confirm Received Money'}
                            </button>
                          )}
                          {refund.status === 'Completed' && (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700, paddingRight: '12px' }}>
                              {isVi ? 'Yêu cầu đã hoàn thành' : 'Request Completed'}
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
                        {isVi 
                          ? `Hiển thị ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalItems)} trong ${totalItems}`
                          : `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, totalItems)} of ${totalItems}`}
                      </span>
                    </div>
                    <div className="refund-pagination">
                      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        {isVi ? 'Trước' : 'Previous'}
                      </button>
                      <span className="page-indicator">{isVi ? 'Trang' : 'Page'} {page}</span>
                      <button type="button" disabled={page * pageSize >= totalItems} onClick={() => setPage((p) => p + 1)}>
                        {isVi ? 'Tiếp' : 'Next'}
                      </button>
                    </div>
                  </footer>
                )}
              </section>

              <aside className="refund-side-col">
                <div className="refund-side-sticky glass-panel">
                  <section className="refund-summary-card">
                    <h2>{isVi ? 'Tổng Quan Hoàn Tiền' : 'Refund Summary'}</h2>
                    <div className="refund-total-spent">
                      <span>{isVi ? 'Tổng Tiền Cọc Đã Hoàn' : 'Total Deposit Refunded'}</span>
                      <strong>{formatVnd(summaries.totalAmount)}</strong>
                    </div>
                    <div className="refund-summary-grid">
                      <div>
                        <span>{isVi ? 'Tổng số yêu cầu' : 'Total Requests'}</span>
                        <strong>{summaries.totalCount}</strong>
                      </div>
                      <div>
                        <span>{isVi ? 'Chưa đủ điều kiện' : 'Not Ready'}</span>
                        <strong>{summaries.notReadyCount}</strong>
                      </div>
                      <div>
                        <span>{isVi ? 'Chờ xử lý' : 'Pending'}</span>
                        <strong>{summaries.pendingCount}</strong>
                      </div>
                      <div>
                        <span>{isVi ? 'Đã hoàn thành' : 'Completed'}</span>
                        <strong>{summaries.completedCount}</strong>
                      </div>
                    </div>
                  </section>

                  <section className="refund-insights-card">
                    <h2>{isVi ? 'Tỷ Lệ Trạng Thái' : 'Status Ratio'}</h2>
                    <InsightBar label={isVi ? `Đã hoàn thành (${tabCounts.Completed})` : `Completed (${tabCounts.Completed})`} value={getPercent(tabCounts.Completed, summaries.totalCount)} />
                    <InsightBar label={isVi ? `Đang hoàn tiền (${tabCounts.Processed})` : `Processing (${tabCounts.Processed})`} value={getPercent(tabCounts.Processed, summaries.totalCount)} />
                    <InsightBar label={isVi ? `Chờ xử lý (${tabCounts.Pending})` : `Pending (${tabCounts.Pending})`} value={getPercent(tabCounts.Pending, summaries.totalCount)} />
                    <InsightBar label={isVi ? `Chưa đủ điều kiện (${tabCounts.NotReady})` : `Not Ready (${tabCounts.NotReady})`} value={getPercent(tabCounts.NotReady, summaries.totalCount)} muted />

                    <div className="refund-insight-note">
                      <span className="material-symbols-outlined">info</span>
                      <p>{isVi ? 'Vui lòng đảm bảo thông tin tài khoản ngân hàng chính xác để Quản trị viên chuyển khoản tiền cọc hoàn lại.' : 'Please make sure your bank account information is accurate so that the admin can transfer your deposit refund.'}</p>
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
              <h3>{isVi ? 'Thông Tin Tài Khoản Nhận Tiền' : 'Payout Account Details'}</h3>
              <button type="button" className="refund-edit-modal-close" onClick={handleCloseEdit} disabled={modalLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <div className="refund-form-group">
                <label htmlFor="bankName">{isVi ? 'Tên Ngân Hàng' : 'Bank Name'}</label>
                <select
                  id="bankName"
                  name="bankName"
                  value={bankForm.bankName}
                  onChange={handleBankFormChange}
                  required
                  disabled={modalLoading}
                >
                  <option value="" disabled>{isVi ? 'Chọn ngân hàng của bạn...' : 'Select your bank...'}</option>
                  {banksList.map((bank) => (
                    <option key={bank.code} value={bank.shortName || bank.short_name || bank.code}>
                      {bank.shortName || bank.short_name || bank.code} ({bank.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountNumber">{isVi ? 'Số Tài Khoản' : 'Account Number'}</label>
                <input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  value={bankForm.bankAccountNumber}
                  onChange={handleBankFormChange}
                  placeholder={isVi ? 'Nhập số tài khoản ngân hàng...' : 'Enter bank account number...'}
                  required
                  disabled={modalLoading}
                />
              </div>

              <div className="refund-form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="bankAccountHolder">{isVi ? 'Tên Chủ Tài Khoản' : 'Account Holder Name'}</label>
                <input
                  id="bankAccountHolder"
                  name="bankAccountHolder"
                  value={bankForm.bankAccountHolder}
                  onChange={handleBankFormChange}
                  placeholder={isVi ? 'NHẬP TÊN CHỦ TÀI KHOẢN (VIẾT HOA KHÔNG DẤU)...' : 'ENTER ACCOUNT HOLDER NAME...'}
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
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                disabled={modalLoading}
              >
                {modalLoading ? <span className="btn-spinner"></span> : (isVi ? 'Lưu' : 'Save')}
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
              <h3>{isVi ? 'Xác Nhận Đã Nhận Tiền' : 'Confirm Payment Received'}</h3>
              <button type="button" className="refund-edit-modal-close" onClick={() => setConfirmingRefund(null)} disabled={confirmLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="refund-edit-modal-body">
              <p>
                {isVi 
                  ? 'Bạn có xác nhận đã nhận được số tiền cọc hoàn lại này qua chuyển khoản từ Quản trị viên không? Hành động này sẽ đánh dấu yêu cầu là **Đã hoàn thành** và không thể hoàn tác.'
                  : 'Do you confirm that you have received this deposit refund amount via bank transfer from the Admin? This action will mark the request as Completed and cannot be undone.'}
              </p>
              <div className="admin-refund-modal-target" style={{ margin: 0, padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>{isVi ? 'Số Tiền Hoàn Đã Nhận' : 'Refund Amount Received'}</span>
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
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                className="refund-primary-btn"
                style={{ padding: '8px 18px' }}
                onClick={handleConfirmReceived}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="btn-spinner"></span> : (isVi ? 'Xác nhận (Đã nhận tiền)' : 'Confirm (Received)')}
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
