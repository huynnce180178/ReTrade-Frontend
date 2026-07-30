import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportStatusBadge({ status }) {
  const { t } = useLanguage();
  const value = status || 'Pending';
  const normalized = String(value).toLowerCase();
  const className = normalized === 'accepted' ? 'acceptedreview' : normalized.replace(/\s+/g, '');
  const labelMap = {
    pending: 'admin.reports.pending_review',
    rejected: 'admin.reports.rejected',
    accepted: 'admin.reports.accepted',
    acceptedreview: 'admin.reports.accepted_review',
    acceptedbuyer: 'admin.reports.accepted_buyer',
    acceptedseller: 'admin.reports.accepted_seller',
  };
  return <span className={`report-status-badge ${className}`}>{t(labelMap[className] || 'admin.reports.status_unknown')}</span>;
}

ReportStatusBadge.propTypes = {
  status: PropTypes.string,
};
