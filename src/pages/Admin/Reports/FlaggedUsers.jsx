import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import reportService from '../../../services/reportService';
import './ReportManagement.css';
import './FlaggedUsers.css';

export default function FlaggedUsers() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]); const [loading, setLoading] = useState(true);
  const loadUsers = useCallback(async () => { try { setLoading(true); const data = await reportService.getFlaggedUsers(); setUsers(Array.isArray(data) ? data : data?.items || data?.value || []); } catch (error) { showToast(error?.response?.data || 'Failed to load flagged users.', 'error'); } finally { setLoading(false); } }, [showToast]);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  return <div className="report-admin-page animate-fade-in"><header className="report-admin-hero"><div><p className="admin-eyebrow">REPORT MANAGEMENT</p><h1>Flagged Users</h1><p>Accounts with accepted reports that need closer attention.</p></div></header><section className="flagged-users report-flagged-page">{loading ? <div className="report-empty"><span className="page-btn-spinner" /><p>Loading flagged users...</p></div> : users.length ? <div className="flagged-grid">{users.map((user) => { const reports = user.reports || []; const visibleReports = reports.slice(0, 3); const remainingReports = reports.length - visibleReports.length; return <article key={user.userId || user.id}><div className="flagged-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user.userName || user.username || 'U').slice(0, 1)}</div><div><strong>{user.userName || user.username || 'Unknown user'}</strong><span>Flag count: {user.flagCount ?? 0} · {user.status || 'Active'}</span></div><div className="flagged-links">{visibleReports.map((report, index) => <button key={report.reportId || report.id} className="flagged-report-count" type="button" onClick={() => navigate('/admin/reports', { state: { reportId: report.reportId || report.id } })}>Report {index + 1}</button>)}{remainingReports > 0 && <span className="flagged-more">+{remainingReports}</span>}{reports.length === 0 && <span className="flagged-more">No reports</span>}</div></article>; })}</div> : <div className="report-empty"><span className="material-symbols-outlined">flag</span><h3>No flagged users found</h3><p>There are no users with accepted reports.</p></div>}</section></div>;
}
