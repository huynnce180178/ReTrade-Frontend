import { useState } from 'react';
import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportActionPanel({ status, targetType, loading, onAction }) {
  const { t } = useLanguage();
  const [pendingAction, setPendingAction] = useState(null);

  if (String(status).toLowerCase() !== 'pending') return null;

  const handleConfirm = async () => {
    if (!pendingAction) return;
    await onAction(pendingAction);
    setPendingAction(null);
  };

  return (
    <div className="report-action-panel">
      <span>{t('admin.reports.review_action')}</span>
      {!pendingAction ? (
        <div>
          <button disabled={loading} onClick={() => setPendingAction('Reject')} className="reject" type="button">
            {t('admin.reports.reject_report')}
          </button>
          <button disabled={loading} onClick={() => setPendingAction(getAcceptedStatus(targetType))} type="button">
            {t('admin.reports.accept_report')}
          </button>
        </div>
      ) : (
        <div className="report-action-confirm">
          <p>{t(pendingAction === 'Reject' ? 'admin.reports.confirm_reject_report' : 'admin.reports.confirm_accept_report')}</p>
          <button disabled={loading} onClick={() => setPendingAction(null)} className="secondary" type="button">
            {t('common.cancel')}
          </button>
          <button disabled={loading} onClick={handleConfirm} className={pendingAction === 'Reject' ? 'reject' : ''} type="button">
            {loading ? <span className="page-btn-spinner" /> : t('common.confirm')}
          </button>
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
