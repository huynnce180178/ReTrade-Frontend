import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import adminDashboardService from '../../../services/adminDashboardService';
import accountService from '../../../services/accountService';
import productService from '../../../services/productService';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, formatCurrency, formatNumber } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [subStats, setSubStats] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [subRes, userRes, prodRes] = await Promise.allSettled([
        adminDashboardService.getSubscriptionStatistics(),
        accountService.getAdminUserList("?$top=100"),
        productService.getForApproval({ Status: 'Pending', PageSize: 9 })
      ]);

      if (subRes.status === 'fulfilled') {
        setSubStats(subRes.value);
      }
      if (userRes.status === 'fulfilled') {
        const uList = userRes.value?.items || userRes.value || [];
        setTotalUsers(Array.isArray(uList) ? uList.length : 0);
      }
      if (prodRes.status === 'fulfilled') {
        setPendingProducts(prodRes.value?.items || []);
        setPendingCount(prodRes.value?.totalItems || prodRes.value?.items?.length || 0);
      }
    } catch (error) {
      showToast(t('common.load_error') || 'Failed to load overview metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <span className="page-btn-spinner"></span>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const overviewMetrics = [
    { icon: 'group', label: t('admin.dashboard.total_accounts'), value: formatNumber(totalUsers), note: t('admin.dashboard.total_accounts_note'), color: '#0284c7', bg: '#e0f2fe' },
    { icon: 'rule', label: t('admin.dashboard.pending_approvals'), value: formatNumber(pendingCount), note: t('admin.dashboard.pending_approvals_note'), color: '#d97706', bg: '#fef3c7', hot: pendingCount > 0 },
    { icon: 'how_to_reg', label: t('admin.dashboard.active_subscribers'), value: formatNumber(subStats?.activeSubscribers || 0), note: t('admin.dashboard.active_subscribers_note'), color: '#16a34a', bg: '#dcfce7' },
    { icon: 'account_balance_wallet', label: t('admin.dashboard.platform_revenue'), value: formatCurrency(subStats?.totalRevenue || 0), note: t('admin.dashboard.platform_revenue_note'), color: '#7c2d12', bg: '#fee2e2' },
  ];

  return (
    <div className="admin-dashboard-page animate-fade-in">
      <header className="admin-dashboard-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.dashboard.hero_title', { name: user?.firstName || user?.username || 'Admin' })}</h1>
          <p>{t('admin.dashboard.hero_sub')}</p>
        </div>
        <div className="admin-hero-actions">
          <button type="button" className="admin-btn-secondary" onClick={() => navigate('/admin/listings')}>
            <span className="material-symbols-outlined">rule</span>
            <span>{t('admin.dashboard.review_listings_btn')}</span>
          </button>
          <button type="button" className="admin-btn-primary" onClick={() => navigate('/admin/statistics')}>
            <span className="material-symbols-outlined">monitoring</span>
            <span>{t('admin.dashboard.view_statistics_btn')}</span>
          </button>
        </div>
      </header>

      <section className="admin-dashboard-stats-grid">
        {overviewMetrics.map((metric) => (
          <article key={metric.label} className="admin-dashboard-stat-card">
            <div className="stat-icon-wrap" style={{ background: metric.bg, color: metric.color }}>
              <span className="material-symbols-outlined">{metric.icon}</span>
            </div>
            <div className="stat-info">
              <span>{metric.label}</span>
              <strong className="revenue-text">{metric.value}</strong>
              <small className="stat-note">{metric.note}</small>
            </div>
          </article>
        ))}
      </section>

      <div className="admin-dashboard-charts-layout">
        <section className="admin-dashboard-chart-section flex-2">
          <div className="section-header-wrap">
            <div>
              <h2>{t('admin.dashboard.products_needing_review')}</h2>
              <p className="breakdown-subtitle">{t('admin.dashboard.products_needing_review_sub')}</p>
            </div>
            <button type="button" className="admin-btn-secondary sm" onClick={() => navigate('/admin/listings')}>
              {t('admin.dashboard.view_all')}
            </button>
          </div>

          {pendingProducts.length === 0 ? (
            <div className="no-data-msg">
              <span className="material-symbols-outlined check-icon">check_circle</span>
              <strong>{t('admin.dashboard.all_clear')}</strong>
              <p>{t('admin.dashboard.all_clear_sub')}</p>
            </div>
          ) : (
            <div className="package-details-list">
              {pendingProducts.slice(0, 9).map((prod) => (
                <div key={prod.productId} className="pending-prod-item">
                  <img 
                    src={prod.mainImageUrl || 'https://placehold.co/60'} 
                    alt={prod.name} 
                    className="pending-prod-img"
                  />
                  <div className="pending-prod-meta">
                    <strong className="pending-prod-name">{prod.name}</strong>
                    <span className="pending-prod-sub">
                      Seller: {prod.sellerName || prod.sellerId || 'Unknown'} · {prod.categoryName || 'General'}
                    </span>
                  </div>
                  <button type="button" className="admin-btn-action-sm" onClick={() => navigate('/admin/listings')}>
                    {t('admin.dashboard.review')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-dashboard-chart-section flex-1">
          <h2>{t('admin.dashboard.quick_actions')}</h2>
          <p className="breakdown-subtitle">{t('admin.dashboard.quick_actions_sub')}</p>
          <div className="quick-actions-list">
            <button type="button" className="quick-action-card" onClick={() => navigate('/admin/users')}>
              <div className="quick-action-icon-wrap user-bg">
                <span className="material-symbols-outlined">group</span>
              </div>
              <div className="quick-action-text">
                <strong>{t('admin.dashboard.manage_user_accounts')}</strong>
                <small>{t('admin.dashboard.manage_user_accounts_sub')}</small>
              </div>
              <span className="material-symbols-outlined arrow-icon">chevron_right</span>
            </button>

            <button type="button" className="quick-action-card" onClick={() => navigate('/admin/category')}>
              <div className="quick-action-icon-wrap cat-bg">
                <span className="material-symbols-outlined">category</span>
              </div>
              <div className="quick-action-text">
                <strong>{t('admin.dashboard.manage_categories')}</strong>
                <small>{t('admin.dashboard.manage_categories_sub')}</small>
              </div>
              <span className="material-symbols-outlined arrow-icon">chevron_right</span>
            </button>

            <button type="button" className="quick-action-card" onClick={() => navigate('/admin/refunds')}>
              <div className="quick-action-icon-wrap refund-bg">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <div className="quick-action-text">
                <strong>{t('admin.dashboard.refund_requests')}</strong>
                <small>{t('admin.dashboard.refund_requests_sub')}</small>
              </div>
              <span className="material-symbols-outlined arrow-icon">chevron_right</span>
            </button>

            <button type="button" className="quick-action-card" onClick={() => navigate('/admin/statistics')}>
              <div className="quick-action-icon-wrap stats-bg">
                <span className="material-symbols-outlined">monitoring</span>
              </div>
              <div className="quick-action-text">
                <strong>{t('admin.dashboard.analytics_stats')}</strong>
                <small>{t('admin.dashboard.analytics_stats_sub')}</small>
              </div>
              <span className="material-symbols-outlined arrow-icon">chevron_right</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

