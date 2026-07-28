export default function TargetTypeBadge({ type }) {
  return <span className="report-target-badge">{type || 'Unknown'}</span>;
}
