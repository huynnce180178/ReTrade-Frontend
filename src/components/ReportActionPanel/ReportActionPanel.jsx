export default function ReportActionPanel({ status, targetType, loading, onAction }) {
  if (String(status).toLowerCase() !== 'pending') return null;
  return <div className="report-action-panel"><span>Review action</span><div><button disabled={loading} onClick={() => onAction('Reject')} className="reject">Reject</button><button disabled={loading} onClick={() => onAction(getAcceptedStatus(targetType))}>Accept</button></div></div>;
}

function getAcceptedStatus(targetType) {
  const type = String(targetType || '').toLowerCase();
  if (type.includes('buyer')) return 'Accept Buyer';
  if (type.includes('seller')) return 'Accept Seller';
  return 'Accept Review';
}
