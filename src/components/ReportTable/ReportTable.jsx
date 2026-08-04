import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';
import ReportStatusBadge from '../ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../TargetTypeBadge/TargetTypeBadge';

export default function ReportTable({ reports, loading, onView, page = 1, pageSize = 10 }) {
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
            <th className="stt-cell">{t('common.stt')}</th>
            <th>{t('admin.reports.reporter')}</th>
            <th>{t('admin.reports.target_type')}</th>
            <th>{t('admin.reports.status')}</th>
            <th>{t('admin.reports.created_at')}</th>
            <th>{t('admin.listings.col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report, idx) => {
            const stt = (page - 1) * pageSize + idx + 1;
            const reportId = report.reportId || report.id;
            return (
              <tr
                key={reportId}
                className="clickable-row"
                onClick={() => onView(reportId)}
              >
                <td className="stt-cell">
                  <strong>{stt}</strong>
                </td>
                <td>
                  <strong>{report.reporterName || report.reporter?.userName || report.reporter?.username || '-'}</strong>
                </td>
                <td>
                  <TargetTypeBadge type={report.targetType} />
                </td>
                <td>
                  <ReportStatusBadge status={report.status} />
                </td>
                <td>{formatDateTime(report.createdAt)}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="report-view-btn"
                    onClick={() => onView(reportId)}
                  >
                    {t('common.view_detail')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

ReportTable.propTypes = {
  reports: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  onView: PropTypes.func.isRequired,
  page: PropTypes.number,
  pageSize: PropTypes.number,
};
