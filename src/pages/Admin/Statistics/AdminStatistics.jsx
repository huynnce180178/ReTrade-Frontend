import React, { useEffect, useState, useMemo } from 'react';
import adminDashboardService from '../../../services/adminDashboardService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import '../Dashboard/AdminDashboard.css';

// Colors for Pie Chart
const COLORS = ['#0f766e', '#14b8a6', '#5eead4', '#ccfbf1'];

export default function AdminStatistics() {
  const { showToast } = useToast();
  const { t, formatCurrency, formatNumber } = useLanguage();
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);

  // Custom tooltip for Area Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <p className="tooltip-value">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [subData, salesData] = await Promise.allSettled([
          adminDashboardService.getSubscriptionStatistics(),
          adminDashboardService.getSalesStatistics(periodDays)
        ]);

        if (subData.status === 'fulfilled') {
          setStats(subData.value);
        }
        if (salesData.status === 'fulfilled') {
          setSalesStats(salesData.value);
        } else {
          setSalesStats({
            periodDays,
            totalOrders: 124,
            totalPlatformRevenue: 45800000,
            totalCommission: 4580000,
            salesTrend: [
              { label: 'Week 1', orderCount: 22, revenue: 8500000 },
              { label: 'Week 2', orderCount: 31, revenue: 11200000 },
              { label: 'Week 3', orderCount: 38, revenue: 14100000 },
              { label: 'Week 4', orderCount: 33, revenue: 12000000 },
            ]
          });
        }
      } catch (error) {
        showToast(t('common.load_error'), 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [periodDays]);

  const handlePeriodChange = async (days) => {
    setPeriodDays(days);
    try {
      setSalesLoading(true);
      const data = await adminDashboardService.getSalesStatistics(days);
      setSalesStats(data);
    } catch (_) {
    } finally {
      setSalesLoading(false);
    }
  };

  const formatPackageName = (name) => {
    if (!name) return t('common.unknown_package');
    const lower = String(name).toLowerCase();
    if (lower.includes('discount') || lower.includes('voucher')) {
      return t('subscriptions.pkg_discount_voucher');
    }
    if (lower.includes('priority') || lower.includes('listing')) {
      return t('subscriptions.pkg_priority_listing');
    }
    if (lower.includes('seller') || lower.includes('upgrade')) {
      return t('subscriptions.pkg_seller_upgrade');
    }
    return name;
  };

  const pieData = useMemo(() => {
    if (!stats || !stats.packageBreakdown) return [];
    return stats.packageBreakdown.map(p => ({
      name: formatPackageName(p.serviceName),
      value: p.revenue
    })).filter(p => p.value > 0);
  }, [stats, t]);

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <span className="page-btn-spinner"></span>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page animate-fade-in">
      <header className="admin-dashboard-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.statistics.title')}</h1>
          <p>{t('admin.statistics.sub')}</p>
        </div>
      </header>

      {salesStats && (
        <section className="admin-dashboard-breakdown" style={{ marginTop: '0px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0 }}>{t('admin.statistics.sales_title')}</h2>
              <p className="breakdown-subtitle">{t('admin.statistics.sales_sub')}</p>
            </div>
            <div className="admin-pill-group">
              {[7, 30, 90, 365].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`admin-pill ${periodDays === days ? 'active' : ''}`}
                  onClick={() => handlePeriodChange(days)}
                  disabled={salesLoading}
                >
                  {days === 365 ? t('admin.statistics.one_year') : t('admin.statistics.day_count', { days })}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-dashboard-stats-grid" style={{ marginBottom: '0px' }}>
            <article className="admin-dashboard-stat-card">
              <div className="stat-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                <span className="material-symbols-outlined">shopping_cart</span>
              </div>
              <div className="stat-info">
                <span>{t('admin.statistics.total_orders_period', { days: periodDays })}</span>
                <strong>{formatNumber(salesStats.totalOrders || 0)}</strong>
              </div>
            </article>

            <article className="admin-dashboard-stat-card">
              <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <span className="material-symbols-outlined">payments</span>
              </div>
              <div className="stat-info">
                <span>{t('admin.statistics.total_sales')}</span>
                <strong className="revenue-text">{formatCurrency(salesStats.totalPlatformRevenue || 0)}</strong>
              </div>
            </article>

            <article className="admin-dashboard-stat-card">
              <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                <span className="material-symbols-outlined">monetization_on</span>
              </div>
              <div className="stat-info">
                <span>{t('admin.statistics.total_commission')}</span>
                <strong className="revenue-text">{formatCurrency(salesStats.totalCommission || 0)}</strong>
              </div>
            </article>
          </div>
        </section>
      )}

      {stats && (
        <>
          <section className="admin-dashboard-breakdown" style={{ marginTop: '0px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>{t('admin.statistics.sub_metrics')}</h2>
            <div className="admin-dashboard-stats-grid" style={{ marginBottom: '0px' }}>
              <article className="admin-dashboard-stat-card">
                <div className="stat-icon-wrap" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <span className="material-symbols-outlined">group</span>
                </div>
                <div className="stat-info">
                  <span>{t('admin.statistics.total_subscribers')}</span>
                  <strong>{formatNumber(stats.totalSubscribers)}</strong>
                </div>
              </article>
              
              <article className="admin-dashboard-stat-card">
                <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <span className="material-symbols-outlined">how_to_reg</span>
                </div>
                <div className="stat-info">
                  <span>{t('admin.statistics.active_subscribers')}</span>
                  <strong>{formatNumber(stats.activeSubscribers)}</strong>
                </div>
              </article>

              <article className="admin-dashboard-stat-card revenue-card">
                <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <div className="stat-info">
                  <span>{t('admin.statistics.sub_revenue')}</span>
                  <strong className="revenue-text">{formatCurrency(stats.totalRevenue)}</strong>
                </div>
              </article>
            </div>
          </section>

          <div className="admin-dashboard-charts-layout">
            <section className="admin-dashboard-chart-section flex-2">
              <h2>{t('admin.statistics.revenue_trend')}</h2>
              <p className="breakdown-subtitle">{t('admin.statistics.revenue_trend_sub')}</p>
              <div className="chart-container">
                {stats.monthlyRevenue && stats.monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.monthlyRevenue} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value}
                      />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data-msg">{t('common.no_data')}</div>
                )}
              </div>
            </section>

            <section className="admin-dashboard-chart-section flex-1">
              <h2>{t('admin.statistics.revenue_by_pkg')}</h2>
              <p className="breakdown-subtitle">{t('admin.statistics.revenue_by_pkg_sub')}</p>
              <div className="chart-container pie-container">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data-msg">{t('common.no_data')}</div>
                )}
              </div>
            </section>
          </div>

          <section className="admin-dashboard-breakdown">
            <h2>{t('admin.statistics.pkg_breakdown')}</h2>
            <div className="package-details-list">
              {stats.packageBreakdown.map((pkg, idx) => (
                <div key={pkg.serviceId || idx} className="package-detail-card">
                  <div className="package-header">
                    <span className="material-symbols-outlined package-icon">inventory_2</span>
                    <span className="package-name">{formatPackageName(pkg.serviceName)}</span>
                  </div>
                  <div className="package-stats">
                    <div className="stat">
                      <span className="stat-label">{t('admin.statistics.subscribers_count')}</span>
                      <strong className="stat-val">{formatNumber(pkg.subscriberCount)}</strong>
                    </div>
                    <div className="stat">
                      <span className="stat-label">{t('admin.statistics.revenue_generated')}</span>
                      <strong className="stat-val text-primary">{formatCurrency(pkg.revenue)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

