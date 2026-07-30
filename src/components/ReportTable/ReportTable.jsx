import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';
import ReportStatusBadge from '../ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../TargetTypeBadge/TargetTypeBadge';

export default function ReportTable({ reports, loading, onView }) {
  const { t, formatDateTime } = useLanguage();

  if (loading) {
    return (
      <div className="report-empty">
        <span className="page-btn-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!reports.length) {
    return (
      <div className="report-empty">
        <span className="material-symbols-outlined">flag</span>
        <h3>{t('admin.reports.no_reports_found')}</h3>
        <p>{t('admin.reports.no_reports_sub')}</p>
      </div>
    );
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>{t('admin.reports.report_id')}</th>
            <th>{t('admin.reports.reporter')}</th>
            <th>{t('admin.reports.target_type')}</th>
            <th>{t('admin.reports.reason')}</th>
            <th>{t('admin.reports.status')}</th>
            <th>{t('admin.reports.created_at')}</th>
            <th>{t('admin.listings.col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.reportId || report.id}>
              <td>{report.reportId || report.id}</td>
              <td><strong>{report.reporterName || report.reporter?.userName || report.reporter?.username || '-'}</strong></td>
              <td><TargetTypeBadge type={report.targetType} /></td>
              <td>{report.reason || '-'}</td>
              <td><ReportStatusBadge status={report.status} /></td>
              <td>{formatDateTime(report.createdAt)}</td>
              <td>
                <button type="button" className="report-view-btn" onClick={() => onView(report.reportId || report.id)}>
                  {t('common.view_detail')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

ReportTable.propTypes = {
  reports: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onView: PropTypes.func.isRequired,
};
