export default function ReportStatusBadge({ status }) {
  const value = status || 'Pending';
  const className = String(value).toLowerCase() === 'accepted' ? 'acceptedreview' : String(value).toLowerCase();
  return <span className={`report-status-badge ${className}`}>{String(value).replace(/([A-Z])/g, ' $1').trim()}</span>;
}
