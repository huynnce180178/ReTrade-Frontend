import React, { useEffect, useState, useMemo } from 'react';
import adminRefundService from '../../../services/adminRefundService';
import { useToast } from '../../../context/ToastContext';
import './ManageRefunds.css';

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

export default function ManageRefunds() {
  const { showToast } = useToast();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingRefund, setProcessingRefund] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const data = await adminRefundService.getAll();
      setRefunds(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load refund requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleMarkDone = async () => {
    if (!processingRefund) return;
    try {
      setActionLoading(true);
      await adminRefundService.markDone(processingRefund.refundRequestId);
      showToast('Refund request marked as done successfully.', 'success');
      setProcessingRefund(null);
      await fetchRefunds();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to mark refund request as done.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations for stats
  const stats = useMemo(() => {
    const total = refunds.length;
    const notReady = refunds.filter(r => r.status === 'NotReady').length;
    const pending = refunds.filter(r => r.status === 'Pending').length;
    const processed = refunds.filter(r => r.status === 'Processed').length;
    const completed = refunds.filter(r => r.status === 'Completed').length;
    return { total, notReady, pending, processed, completed };
  }, [refunds]);

  // Client-side filtering & search
  const filteredRefunds = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return refunds.filter((refund) => {
      // Filter by status
      if (activeFilter !== 'All' && refund.status !== activeFilter) {
        return false;
      }
      
      // Filter by keyword
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
          <p className="admin-eyebrow" style={{ textTransform: 'uppercase', fontSize: '11px', color: '#0f766e', fontWeight: 800, letterSpacing: '0.08em' }}>Platform Controller</p>
          <h1>Manage Refund Requests</h1>
          <p>Supervise and confirm offline deposit refunds back to users.</p>
        </div>
      </header>

      <section className="admin-refund-stats-grid">
        <article className="admin-refund-stat-card">
          <span>Total Requests</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #6b7280' }}>
          <span>Not Ready</span>
          <strong>{stats.notReady}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #d97706' }}>
          <span>Pending Done</span>
          <strong>{stats.pending}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <span>Processed (Sent)</span>
          <strong>{stats.processed}</strong>
        </article>
        <article className="admin-refund-stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <span>Completed (Received)</span>
          <strong>{stats.completed}</strong>
        </article>
      </section>

      <section className="admin-refund-panel">
        <div className="admin-refund-toolbar">
          <div className="admin-refund-tabs">
            {['All', 'NotReady', 'Pending', 'Processed', 'Completed'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeFilter === tab ? 'active' : ''}
                onClick={() => setActiveFilter(tab)}
              >
                {tab === 'All' ? `All (${refunds.length})` :
                 tab === 'NotReady' ? `Not Ready (${stats.notReady})` :
                 tab === 'Pending' ? `Pending (${stats.pending})` :
                 tab === 'Processed' ? `Processed (${stats.processed})` :
                 `Completed (${stats.completed})`}
              </button>
            ))}
          </div>

          <div className="admin-refund-search-row">
            <label className="admin-refund-search">
              <span className="material-symbols-outlined">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, note..."
              />
            </label>
          </div>
        </div>

        <div className="admin-refund-table-wrap">
          {loading ? (
            <div className="admin-refund-table-empty">
              <span className="page-btn-spinner"></span>
              <p>Loading refund requests...</p>
            </div>
          ) : filteredRefunds.length === 0 ? (
            <div className="admin-refund-table-empty">
              <span className="material-symbols-outlined">payments</span>
              <h3>No refund requests found</h3>
              <p>Adjust your search query or status filter.</p>
            </div>
          ) : (
            <table className="admin-refund-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>User Profile</th>
                  <th>Amount</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th>Action</th>
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
                            <strong>{refund.userName || 'No Name'}</strong>
                            <span>{refund.userEmail || 'No Email'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="refund-amount-cell">
                        {formatVnd(refund.amount)}
                      </td>
                      <td style={{ color: '#6b7280' }}>
                        {formatDate(refund.requestedAt)}
                      </td>
                      <td>
                        <span className={`refund-status-badge ${refund.status ? refund.status.toLowerCase() : ''}`}>
                          {refund.status === 'NotReady' ? 'Not Ready' :
                           refund.status === 'Pending' ? 'Pending' :
                           refund.status === 'Processed' ? 'Processed' : 'Completed'}
                        </span>
                      </td>
                      <td>
                        {refund.status === 'NotReady' && (
                          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>
                            Awaiting Info
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
                            Confirm
                          </button>
                        )}
                        {refund.status === 'Processed' && (
                          <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600 }}>
                            Awaiting Receipt
                          </span>
                        )}
                        {refund.status === 'Completed' && (
                          <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                            Completed
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
        <div className="admin-refund-modal-overlay" onClick={() => setProcessingRefund(null)}>
          <div className="admin-refund-modal" onClick={(e) => e.stopPropagation()}>
            <header className="admin-refund-modal-header">
              <h3>Refund Request Details</h3>
              <button type="button" className="admin-refund-modal-close" onClick={() => setProcessingRefund(null)} disabled={actionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="admin-refund-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Status</span>
                <span className={`refund-status-badge ${processingRefund.status.toLowerCase()}`}>
                  {processingRefund.status === 'NotReady' ? 'Not Ready' :
                   processingRefund.status === 'Pending' ? 'Pending' :
                   processingRefund.status === 'Processed' ? 'Processed' : 'Completed'}
                </span>
              </div>

              <div className="admin-refund-modal-target" style={{ margin: 0, padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>User Profile</span>
                  <strong style={{ fontSize: '14px', color: '#111827' }}>{processingRefund.userName}</strong>
                  <span style={{ fontSize: '12px', color: '#4b5563', display: 'block' }}>{processingRefund.userEmail}</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Refund Amount</span>
                  <strong style={{ fontSize: '18px', color: 'var(--primary)' }}>{formatVnd(processingRefund.amount)}</strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Note / Reason</span>
                  <span style={{ fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{processingRefund.note || 'No notes provided.'}</span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Transfer Account</span>
                  {processingRefund.bankName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px', color: '#111827', marginTop: '4px' }}>
                      <span>Bank: <strong>{processingRefund.bankName}</strong></span>
                      <span>Account No: <strong>{processingRefund.bankAccountNumber}</strong></span>
                      <span>Holder: <strong>{processingRefund.bankAccountHolder}</strong></span>
                    </div>
                  ) : (
                    <em style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>
                      Account information not updated yet.
                    </em>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Requested At</span>
                  <span style={{ fontSize: '13px', color: '#4b5563' }}>{formatDate(processingRefund.requestedAt)}</span>
                </div>
              </div>
            </div>

            <footer className="admin-refund-modal-footer">
              <button
                type="button"
                className="admin-refund-action-btn outline"
                onClick={() => setProcessingRefund(null)}
                disabled={actionLoading}
              >
                Close
              </button>
              {processingRefund.status === 'Pending' && (
                <button
                  type="button"
                  className="admin-refund-action-btn"
                  onClick={handleMarkDone}
                  disabled={actionLoading}
                >
                  {actionLoading ? <span className="page-btn-spinner"></span> : 'Confirm Sent'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
