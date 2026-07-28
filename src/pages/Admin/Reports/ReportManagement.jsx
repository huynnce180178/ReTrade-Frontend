import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useToast } from '../../../context/ToastContext';
import reportService from '../../../services/reportService';
import orderService from '../../../services/orderService';
import ReportTable from '../../../components/ReportTable/ReportTable';
import ReportStatusBadge from '../../../components/ReportStatusBadge/ReportStatusBadge';
import TargetTypeBadge from '../../../components/TargetTypeBadge/TargetTypeBadge';
import ReportActionPanel from '../../../components/ReportActionPanel/ReportActionPanel';
import './ReportManagement.css';
import './ReportDetail.css';
import './CenteredReportDetail.css';

const pageSize = 10;
const toPage = (data) => {
  if (Array.isArray(data)) return { items: data, total: data.length };
  const payload = data?.data || data?.Data || data?.result || data?.Result || data;
  const items = payload?.items || payload?.Items || payload?.value || payload?.Value || payload?.reports || payload?.Reports || [];
  return { items: Array.isArray(items) ? items : [], total: Number(payload?.totalCount ?? payload?.TotalCount ?? payload?.['@odata.count'] ?? payload?.count ?? payload?.Count ?? 0) };
};

export default function ReportManagement() {
  const { showToast } = useToast();
  const location = useLocation();
  const [reports, setReports] = useState([]); const [flagged, setFlagged] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [targetType, setTargetType] = useState(''); const [sort, setSort] = useState('CreatedAt desc');
  const [selected, setSelected] = useState(null); const [detailLoading, setDetailLoading] = useState(false); const [actionLoading, setActionLoading] = useState(false);
  const loadReports = useCallback(async () => {
    try { setLoading(true); const filter = []; if (status) filter.push(`Status eq '${status}'`); if (targetType) filter.push(`TargetType eq '${targetType}'`); if (search.trim()) filter.push(`contains(ReporterName,'${search.trim().replace(/'/g, "''")}')`); const data = await reportService.getReports({ '$filter': filter.join(' and ') || undefined, '$orderby': sort, '$skip': (page - 1) * pageSize, '$top': pageSize, '$count': true }); const result = toPage(data); setReports(result.items); setTotal(result.total || result.items.length); }
    catch (error) { showToast(error?.response?.data || 'Failed to load reports.', 'error'); } finally { setLoading(false); }
  }, [page, search, showToast, sort, status, targetType]);
  const loadFlagged = useCallback(async () => { try { const data = await reportService.getFlaggedUsers({ '$top': 10 }); setFlagged(Array.isArray(data) ? data : data?.items || data?.value || []); } catch (_) { setFlagged([]); } }, []);
  const loadStats = useCallback(async () => {
    try {
      const data = await reportService.getReports();
      const allReports = toPage(data).items;
      setStats(allReports.reduce((result, report) => {
        const statusValue = String(report.status || report.Status || report.reportStatus || report.ReportStatus || '').toLowerCase();
        result.total += 1;
        if (statusValue === 'pending') result.pending += 1;
        if (statusValue.startsWith('accepted')) result.accepted += 1;
        if (statusValue === 'rejected') result.rejected += 1;
        return result;
      }, { total: 0, pending: 0, accepted: 0, rejected: 0 }));
    } catch (_) { /* Stats are supplementary; preserve the last successful values. */ }
  }, []);
  useEffect(() => { loadReports(); }, [loadReports]); useEffect(() => { loadFlagged(); }, [loadFlagged]); useEffect(() => { loadStats(); }, [loadStats]);
  const view = async (id) => {
    try {
      setDetailLoading(true);
      const report = await reportService.getReportDetail(id);
      const orderId = report?.order?.orderId || report?.order?.OrderId || report?.orderId || report?.OrderId || report?.targetOrderId || report?.TargetOrderId || report?.targetId || report?.TargetId || report?.referenceId || report?.ReferenceId || report?.reportedOrderId || report?.ReportedOrderId;
      if (isOrderReport(report?.targetType || report?.TargetType) && orderId) {
        try {
          const order = await orderService.getById(orderId);
          setSelected({ ...report, order });
          return;
        } catch (_) { /* Keep the report detail when the linked order is unavailable. */ }
      }
      setSelected(report);
    } catch (error) { showToast(error?.response?.data || 'Failed to load report detail.', 'error'); }
    finally { setDetailLoading(false); }
  };
  useEffect(() => { if (location.state?.reportId) view(location.state.reportId); }, [location.state]);
  const update = async (nextStatus) => { if (!selected) return; try { setActionLoading(true); await reportService.updateReportStatus(selected.reportId || selected.id, nextStatus); showToast('Report status updated.', 'success'); await Promise.all([loadReports(), loadFlagged(), loadStats()]); await view(selected.reportId || selected.id); } catch (error) { showToast(error?.response?.data || 'Failed to update report status.', 'error'); } finally { setActionLoading(false); } };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="report-admin-page report-list-page animate-fade-in">
    <header className="report-admin-hero"><div><p className="admin-eyebrow">PLATFORM CONTROLLER</p><h1>Manage Reports</h1><p>Review user reports and take action on marketplace issues.</p></div></header>
    <section className="report-stats-grid"><Stat label="Total Reports" value={stats.total} /><Stat label="Pending Review" value={stats.pending} tone="pending" /><Stat label="Accepted" value={stats.accepted} tone="accepted" /><Stat label="Rejected" value={stats.rejected} tone="rejected" /></section>
    <section className="report-admin-panel"><div className="report-toolbar"><div className="report-filter-tabs">{['', 'Pending', 'Accepted', 'Rejected'].map((item) => <button key={item || 'all'} type="button" className={status === item ? 'active' : ''} onClick={() => { setStatus(item); setPage(1); }}>{item || 'All Reports'}</button>)}</div><div className="report-filter-controls"><label className="report-search"><span className="material-symbols-outlined">search</span><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by reporter..." /></label><select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}><option value="">All target types</option><option value="Review">Review</option><option value="Buyer">Buyer</option><option value="Seller">Seller</option></select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="CreatedAt desc">Newest first</option><option value="CreatedAt asc">Oldest first</option></select></div></div><ReportTable reports={reports} loading={loading} onView={view} /><footer className="report-pagination"><span>Showing {reports.length ? (page - 1) * pageSize + 1 : 0}-{(page - 1) * pageSize + reports.length} of {total} reports</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><span>Page {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></footer></section>
    <section className="flagged-users"><h2>Flagged Users</h2><p>Accounts with reports that need closer attention.</p>{flagged.length ? <div className="flagged-grid">{flagged.map((user) => <article key={user.userId || user.id}><div className="flagged-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.userName || user.username || 'U').slice(0, 1)}</div><div><strong>{user.userName || user.username || 'Unknown user'}</strong><span>{user.flagCount ?? user.reportCount ?? 0} reports · {user.status || 'Active'}</span></div><div className="flagged-links">{(user.reports || []).map((report) => <button key={report.reportId || report.id} onClick={() => view(report.reportId || report.id)}>#{report.reportId || report.id}</button>)}</div></article>)}</div> : <div className="report-empty">No flagged users found.</div>}</section>
    {(selected || detailLoading) && <ReportDetailModal report={selected} loading={detailLoading} actionLoading={actionLoading} onClose={() => setSelected(null)} onAction={update} />}
  </div>;
}
function Stat({ label, value, tone = '' }) { return <article className={`report-stat-card ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }
function ReportDetailModal({ report, loading, actionLoading, onClose, onAction }) {
  return createPortal(<div className="report-detail-overlay" onClick={() => !actionLoading && onClose()}><section className="report-detail" role="dialog" aria-modal="true" aria-label="Report detail" onClick={(event) => event.stopPropagation()}><header><h2>Report Detail</h2><button onClick={onClose} disabled={actionLoading} aria-label="Close"><span className="material-symbols-outlined">close</span></button></header>{loading ? <div className="report-empty">Loading report detail...</div> : <><dl><Row label="Report ID" value={report.reportId || report.id} /><Row label="Reporter" value={report.reporterName || report.reporter?.userName} /><Row label="Target Type" value={<TargetTypeBadge type={report.targetType} />} /><Row label="Reason" value={report.reason} /><Row label="Description" value={report.description || '-'} /><Row label="Status" value={<ReportStatusBadge status={report.status} />} /><Row label="Reviewed At" value={formatDate(report.reviewedAt)} /><Row label="Created At" value={formatDate(report.createdAt)} />{isReviewReport(report.targetType) && <Row label="Review" value={report.review?.comment || report.reviewContent || '-'} />}</dl>{isOrderReport(report.targetType) && <OrderInformation report={report} />}<ReportActionPanel status={report.status} targetType={report.targetType} loading={actionLoading} onAction={onAction} /></>}</section></div>, document.body);
}
function Row({ label, value }) { return <div><dt>{label}</dt><dd>{value || '-'}</dd></div>; }
function isOrderReport(targetType) { const type = String(targetType || '').toLowerCase(); return type.includes('buyer') || type.includes('seller'); }
function isReviewReport(targetType) { return String(targetType || '').toLowerCase().includes('review'); }
function OrderInformation({ report }) {
  const rawOrder = report.order || report.Order || report.orderDetail || report.OrderDetail || report.targetOrder || report.TargetOrder || report;
  const order = rawOrder?.data || rawOrder?.Data || rawOrder?.result || rawOrder?.Result || rawOrder;
  const isBuyer = String(report.targetType || '').toLowerCase().includes('buyer');
  const subject = isBuyer ? report.buyer || report.Buyer : report.seller || report.Seller;
  const name = subject?.userName || subject?.username || subject?.fullName || (isBuyer ? report.buyerName : report.sellerName) || '-';
  return <section className="report-order-info"><h3><span className="material-symbols-outlined">receipt_long</span>Order Information</h3><div className="report-order-grid"><Info label="Order code" value={order.orderCode || order.OrderCode || order.orderId || report.orderId} /><Info label={isBuyer ? 'Buyer' : 'Seller'} value={name} /><Info label="Total amount" value={formatMoney(order.finalAmount || order.FinalAmount || order.totalAmount || order.TotalAmount)} /><Info label="Order status" value={order.status || order.Status || '-'} /></div></section>;
}
function Info({ label, value }) { return <div><span>{label}</span><strong>{value || '-'}</strong></div>; }
function formatMoney(value) { return value === undefined || value === null ? '-' : `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} VND`; }
function formatDate(value) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'; }
