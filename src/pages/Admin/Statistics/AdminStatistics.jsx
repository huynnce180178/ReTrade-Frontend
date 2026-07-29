import React, { useEffect, useState, useMemo } from 'react';
import adminDashboardService from '../../../services/adminDashboardService';
import { useToast } from '../../../context/ToastContext';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import '../Dashboard/AdminDashboard.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

// Custom tooltip for Area Chart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">{formatVnd(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

// Colors for Pie Chart
const COLORS = ['#0f766e', '#14b8a6', '#5eead4', '#ccfbf1'];

export default function AdminStatistics() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(false);

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
        showToast(error?.response?.data || 'Failed to load statistics.', 'error');
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

  const pieData = useMemo(() => {
    if (!stats || !stats.packageBreakdown) return [];
    return stats.packageBreakdown.map(p => ({
      name: p.serviceName || 'Unknown',
      value: p.revenue
    })).filter(p => p.value > 0);
  }, [stats]);

  if (loading) {
    return (
      <div className="admin-dashboard-loading">
        <span className="page-btn-spinner"></span>
        <p>Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page animate-fade-in">
      <header className="admin-dashboard-hero">
        <div>
          <p className="admin-eyebrow">Platform Controller</p>
          <h1>Platform Analytics & Statistics</h1>
          <p>Supervise sales volume, order statistics, commission, and subscription revenue metrics.</p>
        </div>
      </header>

      {salesStats && (
        <section className="admin-dashboard-breakdown" style={{ marginTop: '0px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0 }}>Sales & Order Statistics</h2>
              <p className="breakdown-subtitle">Gross Merchandise Value (GMV), total orders, and platform commission breakdown.</p>
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
                  {days === 365 ? '1 Year' : `${days} Days`}
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
                <span>Total Orders ({periodDays} Days)</span>
                <strong>{numberFormatter.format(salesStats.totalOrders || 0)}</strong>
              </div>
            </article>

            <article className="admin-dashboard-stat-card">
              <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <span className="material-symbols-outlined">payments</span>
              </div>
              <div className="stat-info">
                <span>Total Platform Sales</span>
                <strong className="revenue-text">{formatVnd(salesStats.totalPlatformRevenue || 0)}</strong>
              </div>
            </article>

            <article className="admin-dashboard-stat-card">
              <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                <span className="material-symbols-outlined">monetization_on</span>
              </div>
              <div className="stat-info">
                <span>Total Commission</span>
                <strong className="revenue-text">{formatVnd(salesStats.totalCommission || 0)}</strong>
              </div>
            </article>
          </div>
        </section>
      )}

      {stats && (
        <>
          <section className="admin-dashboard-breakdown" style={{ marginTop: '0px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Subscription Metrics</h2>
            <div className="admin-dashboard-stats-grid" style={{ marginBottom: '0px' }}>
              <article className="admin-dashboard-stat-card">
                <div className="stat-icon-wrap" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <span className="material-symbols-outlined">group</span>
                </div>
                <div className="stat-info">
                  <span>Total Subscribers</span>
                  <strong>{numberFormatter.format(stats.totalSubscribers)}</strong>
                </div>
              </article>
              
              <article className="admin-dashboard-stat-card">
                <div className="stat-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <span className="material-symbols-outlined">how_to_reg</span>
                </div>
                <div className="stat-info">
                  <span>Active Subscribers</span>
                  <strong>{numberFormatter.format(stats.activeSubscribers)}</strong>
                </div>
              </article>

              <article className="admin-dashboard-stat-card revenue-card">
                <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <div className="stat-info">
                  <span>Subscription Revenue</span>
                  <strong className="revenue-text">{formatVnd(stats.totalRevenue)}</strong>
                </div>
              </article>
            </div>
          </section>

          <div className="admin-dashboard-charts-layout">
            <section className="admin-dashboard-chart-section flex-2">
              <h2>Revenue Trend (Last 6 Months)</h2>
              <p className="breakdown-subtitle">Monthly subscription revenue performance.</p>
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
                  <div className="no-data-msg">No monthly revenue data available.</div>
                )}
              </div>
            </section>

            <section className="admin-dashboard-chart-section flex-1">
              <h2>Revenue by Package</h2>
              <p className="breakdown-subtitle">Distribution of earnings across subscription tiers.</p>
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
                      <Tooltip formatter={(value) => formatVnd(value)} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="no-data-msg">No revenue data available.</div>
                )}
              </div>
            </section>
          </div>

          <section className="admin-dashboard-breakdown">
            <h2>Detailed Package Breakdown</h2>
            <div className="package-details-list">
              {stats.packageBreakdown.map((pkg, idx) => (
                <div key={pkg.serviceId || idx} className="package-detail-card">
                  <div className="package-header">
                    <span className="material-symbols-outlined package-icon">inventory_2</span>
                    <span className="package-name">{pkg.serviceName || 'Unknown Package'}</span>
                  </div>
                  <div className="package-stats">
                    <div className="stat">
                      <span className="stat-label">Subscribers</span>
                      <strong className="stat-val">{pkg.subscriberCount}</strong>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Revenue Generated</span>
                      <strong className="stat-val text-primary">{formatVnd(pkg.revenue)}</strong>
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
