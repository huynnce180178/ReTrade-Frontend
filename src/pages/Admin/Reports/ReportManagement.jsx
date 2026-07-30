import { useCallback, useEffect, useState } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
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
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [targetType, setTargetType] = useState('');
  const [sort, setSort] = useState('CreatedAt desc');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const filter = [];
      if (status) filter.push(`Status eq '${status}'`);
      if (targetType) filter.push(`TargetType eq '${targetType}'`);
      if (search.trim()) filter.push(`contains(ReporterName,'${search.trim().replace(/'/g, "''")}')`);
      
      const data = await reportService.getReports({
        '$filter': filter.join(' and ') || undefined,
        '$orderby': sort,
        '$skip': (page - 1) * pageSize,
        '$top': pageSize,
        '$count': true,
      });
      const result = toPage(data);
      setReports(result.items);
      setTotal(result.total || result.items.length);
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, showToast, sort, status, targetType, t]);

  const loadFlagged = useCallback(async () => {
    try {
      const data = await reportService.getFlaggedUsers({ '$top': 10 });
      setFlagged(Array.isArray(data) ? data : data?.items || data?.value || []);
    } catch (_) {
      setFlagged([]);
    }
  }, []);

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
    } catch (_) {}
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);
  useEffect(() => { loadFlagged(); }, [loadFlagged]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const view = async (id) => {
    try {
      setDetailLoading(true);
      const report = await reportService.getReportDetail(id);
      const orderId = report?.order?.orderId || report?.order?.OrderId || report?.orderId || report?.OrderId || report?.targetOrderId || report?.TargetOrderId || report?.targetId || report?.TargetId || report?.referenceId || report?.ReferenceId || report?.reportedOrderId || report?.ReportedOrderId;
      if (isOrderReport(report?.targetType || report?.TargetType) && orderId) {
        try {
          const order = await orderService.getById(orderId);
          setSelected({ ...report, orderDetail: order });
          return;
        } catch (_) {}
      }
      setSelected(report);
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.reportId) view(location.state.reportId);
  }, [location.state]);

  const update = async (id, statusValue, note = '') => {
    if (!selected) return;
    try {
      setActionLoading(true);
      await reportService.updateReportStatus(id, statusValue, note);
      showToast(t('common.report_submitted'), 'success');
      await Promise.all([loadReports(), loadFlagged(), loadStats()]);
      await view(selected.reportId || selected.id);
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startCount = reports.length ? (page - 1) * pageSize + 1 : 0;
  const endCount = (page - 1) * pageSize + reports.length;

  return (
    <div className="report-admin-page report-list-page animate-fade-in">
      <header className="report-admin-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.reports.hero_title')}</h1>
          <p>{t('admin.reports.hero_sub')}</p>
        </div>
        <div className="report-nav-tabs">
          <NavLink to="/admin/reports" end className={({ isActive }) => `report-nav-btn ${isActive ? 'active' : ''}`}>
            <span className="material-symbols-outlined">flag</span>
            <span>{t('admin.report_management')}</span>
          </NavLink>
          <NavLink to="/admin/reports/flagged-users" className={({ isActive }) => `report-nav-btn ${isActive ? 'active' : ''}`}>
            <span className="material-symbols-outlined">warning</span>
            <span>{t('admin.reports.flagged_users_title')}</span>
            {flagged.length > 0 && <span className="nav-badge">{flagged.length}</span>}
          </NavLink>
        </div>
      </header>

      <section className="report-stats-grid">
        <Stat label={t('admin.reports.total_reports')} value={stats.total} />
        <Stat label={t('admin.reports.pending_review')} value={stats.pending} tone="pending" />
        <Stat label={t('admin.reports.accepted')} value={stats.accepted} tone="accepted" />
        <Stat label={t('admin.reports.rejected')} value={stats.rejected} tone="rejected" />
      </section>

      <section className="report-admin-panel">
        <div className="report-toolbar">
          <div className="report-filter-tabs">
            {['', 'Pending', 'Accepted', 'Rejected'].map((item) => (
              <button
                key={item || 'all'}
                type="button"
                className={status === item ? 'active' : ''}
                onClick={() => { setStatus(item); setPage(1); }}
              >
                {item === '' ? t('admin.reports.all_reports') :
                 item === 'Pending' ? t('admin.reports.pending_review') :
                 item === 'Accepted' ? t('admin.reports.accepted') :
                 t('admin.reports.rejected')}
              </button>
            ))}
          </div>

          <div className="report-filter-controls">
            <label className="report-search">
              <span className="material-symbols-outlined">search</span>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t('admin.reports.search_reporter')}
              />
            </label>

            <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}>
              <option value="">{t('admin.reports.all_targets')}</option>
              <option value="Review">{t('admin.reports.review')}</option>
              <option value="Buyer">{t('admin.reports.buyer')}</option>
              <option value="Seller">{t('admin.reports.seller')}</option>
            </select>

            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="CreatedAt desc">{t('admin.reports.newest_first')}</option>
              <option value="CreatedAt asc">{t('admin.reports.oldest_first')}</option>
            </select>
          </div>
        </div>

        <ReportTable reports={reports} loading={loading} onView={view} />

        <footer className="report-pagination">
          <span>{t('admin.reports.showing_reports', { start: startCount, end: endCount, total })}</span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('admin.users.prev')}</button>
            <span>{t('admin.users.displaying_count', { current: page, total: totalPages })}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('admin.users.next')}</button>
          </div>
        </footer>
      </section>

      <section className="flagged-users">
        <h2>{t('admin.reports.flagged_users_title')}</h2>
        <p>{t('admin.reports.flagged_users_sub')}</p>
        {flagged.length ? (
          <div className="flagged-grid">
            {flagged.map((user) => (
              <article key={user.userId || user.id}>
                <div className="flagged-avatar">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.userName || user.username || 'U').slice(0, 1)}
                </div>
                <div>
                  <strong>{user.userName || user.username || t('admin.users.unknown_user')}</strong>
                  <span>{user.flagCount ?? user.reportCount ?? 0} {t('admin.reports.total_reports').toLowerCase()} · {user.status || 'Active'}</span>
                </div>
                <div className="flagged-links">
                  {(user.reports || []).map((report) => (
                    <button key={report.reportId || report.id} onClick={() => view(report.reportId || report.id)}>
                      #{report.reportId || report.id}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="report-empty">{t('admin.reports.no_flagged_users')}</div>
        )}
      </section>

      {(selected || detailLoading) && (
        <ReportDetailModal
          report={selected}
          loading={detailLoading}
          actionLoading={actionLoading}
          onClose={() => setSelected(null)}
          onAction={update}
          t={t}
          formatCurrency={formatCurrency}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <article className={`report-stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReportDetailModal({ report, loading, actionLoading, onClose, onAction, t, formatCurrency, formatDateTime }) {
  return createPortal(
    <div className="report-detail-overlay" onClick={() => !actionLoading && onClose()}>
      <section className="report-detail" role="dialog" aria-modal="true" aria-label={t('admin.reports.detail_title')} onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{t('admin.reports.detail_title')}</h2>
          <button onClick={onClose} disabled={actionLoading} aria-label={t('common.close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {loading ? (
          <div className="report-empty">{t('common.loading')}</div>
        ) : (
          <>
            <dl>
              <Row label={t('admin.reports.report_id')} value={report.reportId || report.id} />
              <Row label={t('admin.reports.reporter')} value={report.reporterName || report.reporter?.userName} />
              <Row label={t('admin.reports.target_type')} value={<TargetTypeBadge type={report.targetType} />} />
              <Row label={t('admin.reports.reason')} value={report.reason} />
              <Row label={t('admin.reports.description')} value={report.description || '-'} />
              <Row label={t('admin.reports.status')} value={<ReportStatusBadge status={report.status} />} />
              <Row label={t('admin.reports.reviewed_at')} value={formatDateTime(report.reviewedAt)} />
              <Row label={t('admin.reports.created_at')} value={formatDateTime(report.createdAt)} />
              {isReviewReport(report.targetType) && (
                <Row label={t('admin.reports.review')} value={report.review?.comment || report.reviewContent || '-'} />
              )}
            </dl>

            {isOrderReport(report.targetType) && <OrderInformation report={report} t={t} formatCurrency={formatCurrency} />}

            <ReportActionPanel status={report.status} targetType={report.targetType} loading={actionLoading} onAction={onAction} />
          </>
        )}
      </section>
    </div>,
    document.body
  );
}

function Row({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

function isOrderReport(targetType) {
  const type = String(targetType || '').toLowerCase();
  return type.includes('buyer') || type.includes('seller');
}

function isReviewReport(targetType) {
  return String(targetType || '').toLowerCase().includes('review');
}

function OrderInformation({ report, t, formatCurrency }) {
  const rawOrder = report.order || report.Order || report.orderDetail || report.OrderDetail || report.targetOrder || report.TargetOrder || report;
  const order = rawOrder?.data || rawOrder?.Data || rawOrder?.result || rawOrder?.Result || rawOrder;
  const isBuyer = String(report.targetType || '').toLowerCase().includes('buyer');
  const subject = isBuyer ? report.buyer || report.Buyer : report.seller || report.Seller;
  const name = subject?.userName || subject?.username || subject?.fullName || (isBuyer ? report.buyerName : report.sellerName) || '-';

  return (
    <section className="report-order-info">
      <h3>
        <span className="material-symbols-outlined">receipt_long</span>
        {t('admin.reports.order_info')}
      </h3>
      <div className="report-order-grid">
        <Info label={t('admin.reports.order_code')} value={order.orderCode || order.OrderCode || order.orderId || report.orderId} />
        <Info label={isBuyer ? t('admin.reports.buyer') : t('admin.reports.seller')} value={name} />
        <Info label={t('admin.reports.total_amount')} value={formatCurrency(order.finalAmount || order.FinalAmount || order.totalAmount || order.TotalAmount)} />
        <Info label={t('admin.reports.order_status')} value={order.status || order.Status || '-'} />
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

