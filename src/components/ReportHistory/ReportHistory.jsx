import { useEffect, useState } from 'react';
import reportService from '../../services/reportService';
import ReportStatusBadge from '../ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../TargetTypeBadge/TargetTypeBadge';
import { useLanguage } from '../../context/LanguageContext';
import './ReportHistory.css';

const toList = (data) => Array.isArray(data) ? data : data?.items || data?.value || [];

export default function ReportHistory() {
  const { t, language } = useLanguage();
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
          <h4 className="ma-card-title">{language === 'vi' ? 'Lịch Sử Báo Cáo' : 'Report History'}</h4>
          <p className="ma-subtitle-small">{language === 'vi' ? 'Theo dõi các báo cáo bạn đã gửi và các báo cáo liên quan đến tài khoản của bạn.' : 'Track reports you submitted and reports received on your account.'}</p>
        </div>
      </div>
      
      <div className="report-history-tabs">
        <button className={tab === 'submitted' ? 'active' : ''} onClick={() => setTab('submitted')}>
          {language === 'vi' ? 'Báo cáo đã gửi' : 'Reports Submitted'}
        </button>
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>
          {language === 'vi' ? 'Báo cáo nhận được' : 'Reports Received'}
        </button>
      </div>

      {loading ? (
        <div className="report-history-empty">
          <span className="btn-spinner" /> {language === 'vi' ? 'Đang tải báo cáo...' : 'Loading reports...'}
        </div>
      ) : reports.length ? (
        <div className="report-history-table-wrapper">
          <table className="report-history-table">
            <thead>
              <tr>
                <th>{language === 'vi' ? 'Lý do' : 'Reason'}</th>
                <th>{language === 'vi' ? 'Ngày tạo' : 'Created Date'}</th>
                <th>{language === 'vi' ? 'Loại' : 'Type'}</th>
                <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.reportId || report.id}>
                  <td className="col-reason">
                    <strong>{report.reason || (language === 'vi' ? 'Báo cáo' : 'Report')}</strong>
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
          {language === 'vi' ? `Không có báo cáo ${tab === 'submitted' ? 'đã gửi' : 'nhận được'} nào.` : `No ${tab} reports.`}
        </div>
      )}
    </section>
  );
}
