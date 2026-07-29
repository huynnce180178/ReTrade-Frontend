import { useEffect, useState } from 'react';
import reportService from '../../services/reportService';
import ReportStatusBadge from '../ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../TargetTypeBadge/TargetTypeBadge';
import './ReportHistory.css';

const toList = (data) => Array.isArray(data) ? data : data?.items || data?.value || [];

export default function ReportHistory() {
  const [tab, setTab] = useState('submitted');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await reportService.getHistory();
        const source = tab === 'submitted' 
          ? (data?.reportsSubmitted || data?.ReportsSubmitted) 
          : (data?.reportsReceived || data?.ReportsReceived);
        if (active) setReports(toList(source));
      } catch (_) {
        if (active) setReports([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <section className="report-history-card ma-card">
      <div className="report-history-head">
        <div>
          <h4 className="ma-card-title">Report History</h4>
          <p className="ma-subtitle-small">Track reports you submitted and reports received on your account.</p>
        </div>
      </div>
      
      <div className="report-history-tabs">
        <button className={tab === 'submitted' ? 'active' : ''} onClick={() => setTab('submitted')}>
          Reports Submitted
        </button>
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>
          Reports Received
        </button>
      </div>

      {loading ? (
        <div className="report-history-empty">
          <span className="btn-spinner" /> Loading reports...
        </div>
      ) : reports.length ? (
        <div className="report-history-table-wrapper">
          <table className="report-history-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Created Date</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.reportId || report.id}>
                  <td className="col-reason">
                    <strong>{report.reason || 'Report'}</strong>
                    {report.description && (
                      <span className="col-desc-sub" title={report.description}>
                        {report.description}
                      </span>
                    )}
                  </td>
                  <td className="col-date">
                    {report.createdAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(report.createdAt)) : '-'}
                  </td>
                  <td className="col-type">
                    <TargetTypeBadge type={report.targetType} />
                  </td>
                  <td className="col-status">
                    <ReportStatusBadge status={report.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="report-history-empty">
          <span className="material-symbols-outlined">flag</span>
          No {tab} reports.
        </div>
      )}
    </section>
  );
}
