import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import adminDashboardService from '../../../services/adminDashboardService';
import accountService from '../../../services/accountService';
import productService from '../../../services/productService';
import './AdminDashboard.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

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
      showToast('Failed to load overview metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <span className="page-btn-spinner"></span>
        <p>Loading Admin Overview...</p>
      </div>
    );
  }

  const overviewMetrics = [
    { icon: 'group', label: 'Total Accounts', value: totalUsers, note: 'Registered platform users', color: '#0284c7', bg: '#e0f2fe' },
    { icon: 'rule', label: 'Pending Approvals', value: pendingCount, note: 'Listings waiting review', color: '#d97706', bg: '#fef3c7', hot: pendingCount > 0 },
    { icon: 'how_to_reg', label: 'Active Subscribers', value: subStats?.activeSubscribers || 0, note: 'Paid plan members', color: '#16a34a', bg: '#dcfce7' },
    { icon: 'account_balance_wallet', label: 'Platform Revenue', value: formatVnd(subStats?.totalRevenue || 0), note: 'Subscription earnings', color: '#7c2d12', bg: '#fee2e2' },
  ];

  return (
    <div className="admin-dashboard-page animate-fade-in">
      <header className="admin-dashboard-hero">
        <div>
          <p className="admin-eyebrow">Admin Overview</p>
          <h1>Good to see you, {user?.firstName || user?.username || 'Admin'}.</h1>
          <p>Supervise platform accounts, review product listings, and monitor platform health.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="admin-action-btn outline" style={{ height: '40px', padding: '0 16px', fontSize: '13px', borderRadius: '12px' }} onClick={() => navigate('/admin/listings')}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#991B1B' }}>rule</span>
            <span>Review Listings</span>
          </button>
          <button type="button" className="admin-action-btn danger" style={{ height: '40px', padding: '0 16px', fontSize: '13px', borderRadius: '12px', background: '#991B1B', color: '#ffffff', border: '1px solid #991B1B' }} onClick={() => navigate('/admin/statistics')}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffffff' }}>monitoring</span>
            <span style={{ color: '#ffffff' }}>View Statistics</span>
          </button>
        </div>
      </header>

      <section className="admin-dashboard-stats-grid" style={{ marginBottom: '24px' }}>
        {overviewMetrics.map((metric) => (
          <article key={metric.label} className="admin-dashboard-stat-card">
            <div className="stat-icon-wrap" style={{ background: metric.bg, color: metric.color }}>
              <span className="material-symbols-outlined">{metric.icon}</span>
            </div>
            <div className="stat-info">
              <span>{metric.label}</span>
              <strong className="revenue-text">{typeof metric.value === 'number' ? numberFormatter.format(metric.value) : metric.value}</strong>
              <small style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px', display: 'block' }}>{metric.note}</small>
            </div>
          </article>
        ))}
      </section>

      <div className="admin-dashboard-charts-layout">
        <section className="admin-dashboard-chart-section flex-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2>Products Needing Review</h2>
              <p className="breakdown-subtitle">Newest seller listings awaiting administrative approval.</p>
            </div>
            <button type="button" className="admin-action-btn outline" onClick={() => navigate('/admin/listings')}>
              View All
            </button>
          </div>

          {pendingProducts.length === 0 ? (
            <div className="no-data-msg" style={{ padding: '40px 0', textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#16a34a', marginBottom: '8px', display: 'block' }}>check_circle</span>
              <strong>All clear! No pending products.</strong>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>All product submissions have been processed.</p>
            </div>
          ) : (
            <div className="package-details-list">
              {pendingProducts.slice(0, 9).map((prod) => (
                <div key={prod.productId} className="package-detail-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 14px' }}>
                  <img 
                    src={prod.mainImageUrl || 'https://placehold.co/60'} 
                    alt={prod.name} 
                    style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.name}</strong>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>Seller: {prod.sellerName || prod.sellerId || 'Unknown'} · {prod.categoryName || 'General'}</span>
                  </div>
                  <button type="button" className="admin-action-btn outline" style={{ height: '32px', fontSize: '12px', padding: '0 10px' }} onClick={() => navigate('/admin/listings')}>
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-dashboard-chart-section flex-1">
          <h2>Quick Actions</h2>
          <p className="breakdown-subtitle">Administrative control shortcuts.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
            <button type="button" className="admin-action-btn outline" style={{ justifyContent: 'flex-start', padding: '12px 14px', height: 'auto' }} onClick={() => navigate('/admin/users')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#0284c7' }}>group</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>User Accounts</strong>
                <small style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Manage accounts, ban & roles</small>
              </div>
            </button>

            <button type="button" className="admin-action-btn outline" style={{ justifyContent: 'flex-start', padding: '12px 14px', height: 'auto' }} onClick={() => navigate('/admin/category')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#16a34a' }}>category</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>Categories</strong>
                <small style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Add & modify system categories</small>
              </div>
            </button>

            <button type="button" className="admin-action-btn outline" style={{ justifyContent: 'flex-start', padding: '12px 14px', height: 'auto' }} onClick={() => navigate('/admin/refunds')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#d97706' }}>payments</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>Refund Requests</strong>
                <small style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Review buyer refund disputes</small>
              </div>
            </button>

            <button type="button" className="admin-action-btn outline" style={{ justifyContent: 'flex-start', padding: '12px 14px', height: 'auto' }} onClick={() => navigate('/admin/statistics')}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7f1d1d' }}>monitoring</span>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '13px' }}>Analytics & Statistics</strong>
                <small style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>Detailed charts & revenue statistics</small>
              </div>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
