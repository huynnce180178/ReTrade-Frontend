import ReportStatusBadge from '../ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../TargetTypeBadge/TargetTypeBadge';

export default function ReportTable({ reports, loading, onView }) {
  if (loading) return <div className="report-empty"><span className="page-btn-spinner" /><p>Loading reports...</p></div>;
  if (!reports.length) return <div className="report-empty"><span className="material-symbols-outlined">flag</span><h3>No reports found</h3><p>Try changing the search or filters.</p></div>;
  return <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Report ID</th><th>Reporter</th><th>Target Type</th><th>Reason</th><th>Status</th><th>Created At</th><th>Action</th></tr></thead><tbody>{reports.map((report) => <tr key={report.reportId || report.id}><td>{report.reportId || report.id}</td><td><strong>{report.reporterName || report.reporter?.userName || report.reporter?.username || '-'}</strong></td><td><TargetTypeBadge type={report.targetType} /></td><td>{report.reason || '-'}</td><td><ReportStatusBadge status={report.status} /></td><td>{formatDate(report.createdAt)}</td><td><button type="button" className="report-view-btn" onClick={() => onView(report.reportId || report.id)}>View Detail</button></td></tr>)}</tbody></table></div>;
}
function formatDate(value) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'; }
