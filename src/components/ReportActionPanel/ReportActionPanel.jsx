import { useState } from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportActionPanel({ status, targetType, loading, onAction }) {
  const { t } = useLanguage();
  const [pendingAction, setPendingAction] = useState(null);
  const [note, setNote] = useState('');

  if (String(status).toLowerCase() !== 'pending') return null;

  const isReject = pendingAction === 'Reject';

  const handleConfirm = async () => {
    if (!pendingAction) return;
    await onAction(pendingAction, note.trim());
    setPendingAction(null);
    setNote('');
  };

  const handleCancel = () => {
    setPendingAction(null);
    setNote('');
  };

  return (
    <div className="report-action-panel">
      <span className="panel-title">{t('admin.reports.review_action')}</span>

      {!pendingAction ? (
        <div className="action-buttons-row">
          <button
            disabled={loading}
            onClick={() => setPendingAction('Reject')}
            className="action-btn btn-reject"
            type="button"
          >
            <span className="material-symbols-outlined">cancel</span>
            {t('admin.reports.reject_report', 'Reject Report')}
          </button>
          <button
            disabled={loading}
            onClick={() => setPendingAction(getAcceptedStatus(targetType))}
            className="action-btn btn-accept"
            type="button"
          >
            <span className="material-symbols-outlined">check_circle</span>
            {t('admin.reports.accept_report', 'Approve Report')}
          </button>
        </div>
      ) : (
        <div className={`report-action-confirm-card ${isReject ? 'confirm-reject' : 'confirm-accept'}`}>
          <div className="confirm-header">
            <span className="material-symbols-outlined confirm-icon">
              {isReject ? 'warning' : 'task_alt'}
            </span>
            <div className="confirm-title-group">
              <strong>
                {isReject
                  ? t('admin.reports.confirm_reject_title', 'Confirm Rejection')
                  : t('admin.reports.confirm_accept_title', 'Confirm Approval')}
              </strong>
              <p>
                {isReject
                  ? t('admin.reports.confirm_reject_report', 'Are you sure you want to reject this report?')
                  : t('admin.reports.confirm_accept_report', 'Are you sure you want to approve this report and take action?')}
              </p>
            </div>
          </div>

          <div className="confirm-note-field">
            <input
              type="text"
              className="confirm-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('admin.reports.note_placeholder', 'Admin processing note (optional)...')}
              disabled={loading}
            />
          </div>

          <div className="confirm-actions-row">
            <button
              disabled={loading}
              onClick={handleCancel}
              className="confirm-btn btn-secondary"
              type="button"
            >
              {t('common.cancel')}
            </button>
            <button
              disabled={loading}
              onClick={handleConfirm}
              className={`confirm-btn ${isReject ? 'btn-danger' : 'btn-success'}`}
              type="button"
            >
              {loading ? (
                <span className="page-btn-spinner" />
              ) : (
                <>
                  <span className="material-symbols-outlined">
                    {isReject ? 'gavel' : 'verified'}
                  </span>
                  {isReject
                    ? t('admin.reports.confirm_reject_btn', 'Yes, Reject Report')
                    : t('admin.reports.confirm_accept_btn', 'Yes, Approve Report')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getAcceptedStatus(targetType) {
  const type = String(targetType || '').toLowerCase();
  if (type.includes('buyer')) return 'Accept Buyer';
  if (type.includes('seller')) return 'Accept Seller';
  return 'Accept Review';
}

ReportActionPanel.propTypes = {
  status: PropTypes.string,
  targetType: PropTypes.string,
  loading: PropTypes.bool.isRequired,
  onAction: PropTypes.func.isRequired,
};
