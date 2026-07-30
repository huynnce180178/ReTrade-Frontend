import { useCallback, useEffect, useState, useMemo } from 'react';
import adminRefundService from '../../../services/adminRefundService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import './ManageRefunds.css';

export default function ManageRefunds() {
  const { showToast } = useToast();
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingRefund, setProcessingRefund] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminRefundService.getAll();
      setRefunds(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleMarkDone = async () => {
    if (!processingRefund) return;
    try {
      setActionLoading(true);
      await adminRefundService.markDone(processingRefund.refundRequestId);
      showToast(t('common.saved_success'), 'success');
      setProcessingRefund(null);
      setConfirmAction(null);
      await fetchRefunds();
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!processingRefund) return;
    if (!rejectReason.trim()) {
      showToast(t('validation.required'), 'error');
      return;
    }
    try {
      setActionLoading(true);
      await adminRefundService.rejectRefund(processingRefund.refundRequestId, { reason: rejectReason.trim() });
      showToast(t('common.saved_success'), 'success');
      setProcessingRefund(null);
      setIsRejecting(false);
      setRejectReason('');
      setConfirmAction(null);
      await fetchRefunds();
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseModal = () => {
    setProcessingRefund(null);
    setIsRejecting(false);
    setRejectReason('');
    setConfirmAction(null);
  };

  const getRefundStatusLabel = (status) => {
    if (status === 'NotReady') return t('admin.refunds.stat_not_ready');
    if (status === 'Pending') return t('admin.refunds.stat_pending');
    if (status === 'Processed') return t('admin.refunds.stat_processed');
    if (status === 'Completed') return t('admin.refunds.stat_completed');
    if (status === 'Rejected') return t('admin.refunds.stat_rejected');
    return t('common.unknown');
  };

  const stats = useMemo(() => {
    const total = refunds.length;
    const notReady = refunds.filter(r => r.status === 'NotReady').length;
    const pending = refunds.filter(r => r.status === 'Pending').length;
    const processed = refunds.filter(r => r.status === 'Processed').length;
    const completed = refunds.filter(r => r.status === 'Completed').length;
    const rejected = refunds.filter(r => r.status === 'Rejected').length;
    return { total, notReady, pending, processed, completed, rejected };
  }, [refunds]);

  const filteredRefunds = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return refunds.filter((refund) => {
      if (activeFilter !== 'All' && refund.status !== activeFilter) {
        return false;
      }
      
      if (search) {
        const matchesName = refund.userName?.toLowerCase().includes(search);
        const matchesEmail = refund.userEmail?.toLowerCase().includes(search);
        const matchesNote = refund.note?.toLowerCase().includes(search);
        return matchesName || matchesEmail || matchesNote;
      }

      return true;
    });
  }, [refunds, activeFilter, searchTerm]);

  return (
    <>
      <div className="admin-refund-page animate-fade-in">
      <header className="admin-refund-hero">
        <div>
          <p className="admin-eyebrow" style={{ textTransform: 'uppercase', fontSize: '11px', color: '#0f766e', fontWeight: 800, letterSpacing: 0 }}>{t('admin.eyebrow')}</p>
          <h1>{t('admin.refunds.hero_title')}</h1>
          <p>{t('admin.refunds.hero_sub')}</p>
        </div>
      </header>

      <section className="admin-refund-stats-grid">
        <article className="admin-refund-stat-card">
          <span>{t('admin.refunds.stat_total')}</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #6b7280' }}>
          <span>{t('admin.refunds.stat_not_ready')}</span>
          <strong>{stats.notReady}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #d97706' }}>
          <span>{t('admin.refunds.stat_pending')}</span>
          <strong>{stats.pending}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <span>{t('admin.refunds.stat_processed')}</span>
          <strong>{stats.processed}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <span>{t('admin.refunds.stat_completed')}</span>
          <strong>{stats.completed}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <span>{t('admin.refunds.stat_rejected')}</span>
          <strong>{stats.rejected}</strong>
        </article>
      </section>

      <section className="admin-refund-panel">
        <div className="admin-refund-toolbar">
          <div className="admin-refund-tabs">
            {['All', 'NotReady', 'Pending', 'Processed', 'Completed', 'Rejected'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeFilter === tab ? 'active' : ''}
                onClick={() => setActiveFilter(tab)}
              >
                {tab === 'All' ? `${t('admin.listings.tab_all')} (${refunds.length})` :
                 tab === 'NotReady' ? `${t('admin.refunds.stat_not_ready')} (${stats.notReady})` :
                 tab === 'Pending' ? `${t('admin.refunds.stat_pending')} (${stats.pending})` :
                 tab === 'Processed' ? `${t('admin.refunds.stat_processed')} (${stats.processed})` :
                 tab === 'Completed' ? `${t('admin.refunds.stat_completed')} (${stats.completed})` :
                 `${t('admin.refunds.stat_rejected')} (${stats.rejected})`}
              </button>
            ))}
          </div>

          <div className="admin-refund-search-row">
            <label className="admin-refund-search">
              <span className="material-symbols-outlined">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('admin.refunds.search_placeholder')}
              />
            </label>
          </div>
        </div>

        <div className="admin-refund-table-wrap">
          {loading ? (
            <div className="admin-refund-table-empty">
              <span className="page-btn-spinner"></span>
              <p>{t('common.loading')}</p>
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="admin-refund-table-empty">
              <span className="material-symbols-outlined">payments</span>
              <h3>{t('admin.listings.no_products')}</h3>
              <p>{t('admin.listings.no_products_sub')}</p>
            </div>
          ) : (
            <table className="admin-refund-table">
              <thead>
                <tr>
                  <th>{t('admin.listings.col_stt')}</th>
                  <th>{t('admin.users.col_info')}</th>
                  <th>{t('admin.refunds.col_amount')}</th>
                  <th>{t('admin.refunds.col_request_date')}</th>
                  <th>{t('admin.users.col_status')}</th>
                  <th>{t('admin.listings.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map((refund, index) => {
                  const initials = refund.userName
                    ? refund.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'U';
                  
                  return (
                    <tr key={refund.refundRequestId} onClick={() => setProcessingRefund(refund)} style={{ cursor: 'pointer' }}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="admin-user-identity">
                          <div className="admin-user-avatar">
                            <span>{initials}</span>
                          </div>
                          <div className="admin-user-info">
                            <strong>{refund.userName || t('admin.refunds.no_name')}</strong>
                            <span>{refund.userEmail || t('admin.refunds.no_email')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="refund-amount-cell">
                        {formatCurrency(refund.amount)}
                      </td>
                      <td style={{ color: '#6b7280' }}>
                        {formatDateTime(refund.requestedAt)}
                      </td>
                      <td>
                        <span className={`refund-status-badge ${refund.status ? refund.status.toLowerCase() : ''}`}>
                          {getRefundStatusLabel(refund.status)}
                        </span>
                      </td>
                      <td>
                        {refund.status === 'NotReady' && (
                          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>
                            {t('admin.refunds.awaiting_info')}
                          </span>
                        )}
                        {refund.status === 'Pending' && (
                          <button
                            type="button"
                            className="admin-refund-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProcessingRefund(refund);
                            }}
                          >
                            {t('admin.refunds.confirm')}
                          </button>
                        )}
                        {refund.status === 'Processed' && (
                          <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                            {t('admin.refunds.awaiting_receipt')}
                          </span>
                        )}
                        {refund.status === 'Completed' && (
                          <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                            {t('admin.refunds.stat_completed')}
                          </span>
                        )}
                        {refund.status === 'Rejected' && (
                          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                            {t('admin.refunds.stat_rejected')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>

    {processingRefund && (
        <div className="admin-refund-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-refund-modal" onClick={(e) => e.stopPropagation()}>
            <header className="admin-refund-modal-header">
              <h3>{t('admin.refunds.modal_title')}</h3>
              <button type="button" className="admin-refund-modal-close" onClick={handleCloseModal} disabled={actionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="admin-refund-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>{t('admin.refunds.status_label')}</span>
                <span className={`refund-status-badge ${processingRefund.status ? processingRefund.status.toLowerCase() : ''}`}>
                  {getRefundStatusLabel(processingRefund.status)}
                </span>
              </div>

              <div className="admin-refund-modal-target" style={{ margin: 0, padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.refunds.user_profile')}</span>
                  <strong style={{ fontSize: '14px', color: '#111827' }}>{processingRefund.userName || t('admin.refunds.no_name')}</strong>
                  <span style={{ fontSize: '12px', color: '#4b5563', display: 'block' }}>{processingRefund.userEmail || t('admin.refunds.no_email')}</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.refunds.col_amount')}</span>
                  <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{formatCurrency(processingRefund.amount)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.refunds.note_reason')}</span>
                  <span style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{processingRefund.note || t('admin.refunds.no_notes')}</span>
                </div>

                {processingRefund.status === 'Rejected' && processingRefund.rejectReason && (
                  <div>
                    <span style={{ fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.listings.reject_reason')}</span>
                    <span style={{ fontSize: '13px', color: '#b91c1c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{processingRefund.rejectReason}</span>
                  </div>
                )}

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.refunds.bank_account')}</span>
                  {processingRefund.bankName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', color: '#111827', marginTop: '4px' }}>
                      <span>{t('admin.refunds.bank_name')}: <strong>{processingRefund.bankName}</strong></span>
                      <span>{t('admin.refunds.account_no')}: <strong>{processingRefund.bankAccountNumber}</strong></span>
                      <span>{t('admin.refunds.account_holder')}: <strong>{processingRefund.bankAccountHolder}</strong></span>
                    </div>
                  ) : (
                    <em style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                      {t('admin.refunds.bank_missing')}
                    </em>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>{t('admin.refunds.col_request_date')}</span>
                  <span style={{ fontSize: '13px', color: '#4b5563' }}>{formatDateTime(processingRefund.requestedAt)}</span>
                </div>
              </div>
            </div>

            <footer className="admin-refund-modal-footer">
              {!isRejecting ? (
                <>
                  <button
                    type="button"
                    className="admin-refund-action-btn outline"
                    onClick={handleCloseModal}
                    disabled={actionLoading}
                  >
                    {t('common.close')}
                  </button>
                  {processingRefund.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        className="admin-refund-action-btn"
                        style={{ backgroundColor: '#ef4444', color: 'white' }}
                        onClick={() => setIsRejecting(true)}
                        disabled={actionLoading}
                      >
                        {t('admin.reject')}
                      </button>
                      <button
                        type="button"
                        className="admin-refund-action-btn"
                        onClick={() => setConfirmAction({ type: 'markDone' })}
                        disabled={actionLoading}
                      >
                        {actionLoading ? <span className="page-btn-spinner"></span> : t('admin.refunds.confirm_sent')}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>{t('admin.listings.reject_reason')} *</label>
                    <textarea 
                      autoFocus
                      placeholder={t('admin.listings.reject_reason_placeholder')}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      disabled={actionLoading}
                      style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', minHeight: '80px', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      className="admin-refund-action-btn outline"
                      onClick={() => { setIsRejecting(false); setRejectReason(''); }}
                      disabled={actionLoading}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="admin-refund-action-btn"
                      style={{ backgroundColor: '#ef4444', color: 'white' }}
                      onClick={() => setConfirmAction({ type: 'reject' })}
                      disabled={actionLoading || !rejectReason.trim()}
                    >
                      {actionLoading ? <span className="page-btn-spinner"></span> : t('admin.reject')}
                    </button>
                  </div>
                </div>
              )}
            </footer>

            {confirmAction && (
              <div className="admin-refund-confirm-panel">
                <div>
                  <strong>
                    {confirmAction.type === 'markDone'
                      ? t('admin.refunds.confirm_mark_title')
                      : t('admin.refunds.confirm_reject_title')}
                  </strong>
                  <p>
                    {confirmAction.type === 'markDone'
                      ? t('admin.refunds.confirm_mark_text', { name: processingRefund.userName || t('admin.refunds.no_name'), amount: formatCurrency(processingRefund.amount) })
                      : t('admin.refunds.confirm_reject_text', { name: processingRefund.userName || t('admin.refunds.no_name'), reason: rejectReason.trim() })}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    className="admin-refund-action-btn outline"
                    onClick={() => setConfirmAction(null)}
                    disabled={actionLoading}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className={`admin-refund-action-btn ${confirmAction.type === 'reject' ? 'danger' : ''}`}
                    onClick={confirmAction.type === 'markDone' ? handleMarkDone : handleReject}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <span className="page-btn-spinner"></span> : t('common.confirm')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

