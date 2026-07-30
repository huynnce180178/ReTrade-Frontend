import { useCallback, useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import reportService from '../../../services/reportService';
import './ReportManagement.css';
import './FlaggedUsers.css';

export default function FlaggedUsers() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reportService.getFlaggedUsers();
      setUsers(Array.isArray(data) ? data : data?.items || data?.value || []);
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="report-admin-page animate-fade-in">
      <header className="report-admin-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.reports.flagged_users_title')}</h1>
          <p>{t('admin.reports.flagged_users_sub')}</p>
        </div>
        <div className="report-nav-tabs">
          <NavLink to="/admin/reports" end className={({ isActive }) => `report-nav-btn ${isActive ? 'active' : ''}`}>
            <span className="material-symbols-outlined">flag</span>
            <span>{t('admin.report_management')}</span>
          </NavLink>
          <NavLink to="/admin/reports/flagged-users" className={({ isActive }) => `report-nav-btn ${isActive ? 'active' : ''}`}>
            <span className="material-symbols-outlined">warning</span>
            <span>{t('admin.reports.flagged_users_title')}</span>
            {users.length > 0 && <span className="nav-badge">{users.length}</span>}
          </NavLink>
        </div>
      </header>

      <section className="flagged-users report-flagged-page">
        {loading ? (
          <div className="report-empty">
            <span className="page-btn-spinner" />
            <p>{t('common.loading')}</p>
          </div>
        ) : users.length ? (
          <div className="flagged-grid">
            {users.map((user) => {
              const reports = user.reports || [];
              const visibleReports = reports.slice(0, 3);
              const remainingReports = reports.length - visibleReports.length;

              return (
                <article key={user.userId || user.id}>
                  <div className="flagged-avatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" />
                    ) : (
                      (user.userName || user.username || 'U').slice(0, 1)
                    )}
                  </div>
                  <div>
                    <strong>{user.userName || user.username || t('admin.users.unknown_user')}</strong>
                    <span>
                      {user.flagCount ?? 0} {t('admin.reports.total_reports').toLowerCase()} · {user.status || 'Active'}
                    </span>
                  </div>
                  <div className="flagged-links">
                    {visibleReports.map((report, index) => (
                      <button
                        key={report.reportId || report.id}
                        className="flagged-report-count"
                        type="button"
                        onClick={() => navigate('/admin/reports', { state: { reportId: report.reportId || report.id } })}
                      >
                        {t('admin.reports.report_num', { num: index + 1 })}
                      </button>
                    ))}
                    {remainingReports > 0 && <span className="flagged-more">+{remainingReports}</span>}
                    {reports.length === 0 && <span className="flagged-more">{t('admin.reports.no_reports')}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="report-empty">
            <span className="material-symbols-outlined">flag</span>
            <h3>{t('admin.reports.no_flagged_users')}</h3>
            <p>{t('admin.reports.no_flagged_sub')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

