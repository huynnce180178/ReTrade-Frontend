import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import './SalesStatistics.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const salesPeriodOptions = [
  { value: 7, label: 'Last 7 Days' },
  { value: 30, label: 'Last 30 Days' },
  { value: 90, label: 'Last 90 Days' },
  { value: 365, label: 'Last 365 Days' },
];

export default function SalesStatistics() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [periodDays, setPeriodDays] = useState(30);
  const [salesStats, setSalesStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSeller = (user?.roles || []).some((role) => String(role).toLowerCase() === 'seller');
  const isAdmin = (user?.roles || []).some((role) => String(role).toLowerCase() === 'admin');
  const sellerId = user?.userId || user?.id;

  const fetchSalesStats = useCallback(async () => {
    if (!sellerId) return;

    try {
      setLoading(true);
      const data = await orderService.getSellerSalesStatistics({ sellerId, periodDays });
      setSalesStats(data);
    } catch (error) {
      showToast(error?.response?.data || 'Failed to load seller sales statistics.', 'error');
    } finally {
      setLoading(false);
    }
  }, [periodDays, sellerId, showToast]);

  useEffect(() => {
    if (user && (isSeller || isAdmin)) {
      fetchSalesStats();
    }
  }, [fetchSalesStats, isAdmin, isSeller, user]);

  const salesTrend = useMemo(() => salesStats?.revenueTrend || salesStats?.RevenueTrend || [], [salesStats]);
  const maxTrendRevenue = useMemo(
    () => Math.max(...salesTrend.map((item) => Number(item.revenue ?? item.Revenue ?? 0)), 1),
    [salesTrend]
  );
  const deliveredRatio = salesStats?.totalOrders
    ? Math.round(((salesStats?.deliveredOrders || 0) / salesStats.totalOrders) * 100)
    : 0;

  if (authLoading) {
    return <div className="seller-dashboard-loading"><span className="btn-spinner"></span><p>Loading sales statistics...</p></div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSeller && !isAdmin) return <Navigate to="/profile" replace />;

  return (
    <div className="ss-page animate-fade-in">
      <header className="ss-header">
        <div>
          <span className="ss-eyebrow">Business Analytics</span>
          <h1>Shop Manager</h1>
          <p>Review sales performance, delivered revenue, and order movement over a selected period.</p>
        </div>
        <label className="ss-period-select">
          <span>Period</span>
          <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>
            {salesPeriodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </header>

      {loading ? (
        <section className="ss-loading-panel">
          <span className="btn-spinner"></span>
          <p>Loading analytics...</p>
        </section>
      ) : (
        <>
          <section className="ss-metric-grid">
            <article>
              <div>
                <span>Total Revenue</span>
                <span className="material-symbols-outlined">payments</span>
              </div>
              <strong>{formatVnd(salesStats?.netSales || 0)}</strong>
              <p>{formatVnd(salesStats?.grossSales || 0)} gross sales</p>
            </article>
            <article>
              <div>
                <span>Total Orders</span>
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <strong>{salesStats?.totalOrders ?? 0}</strong>
              <p>{salesStats?.deliveredOrders ?? 0} delivered orders</p>
            </article>
            <article>
              <div>
                <span>Fulfillment Rate</span>
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <strong>{deliveredRatio}%</strong>
              <p>{salesStats?.soldItems ?? 0} sold items</p>
            </article>
          </section>

          <section className="ss-chart-panel">
            <div className="ss-chart-head">
              <div>
                <span>Revenue Trend</span>
                <strong>{formatCompactVnd(salesStats?.netSales || 0)}</strong>
              </div>
              <em><i /> Revenue</em>
            </div>
            <div className="ss-chart-bars">
              {salesTrend.map((point, index) => {
                const revenue = Number(point.revenue ?? point.Revenue ?? 0);
                const height = Math.max(12, Math.round((revenue / maxTrendRevenue) * 100));

                return (
                  <div key={`${point.label || point.Label}-${index}`} className="ss-chart-bar">
                    <span title={`${formatVnd(revenue)} - ${point.orderCount ?? point.OrderCount ?? 0} orders`}>
                      <i style={{ height: `${height}%` }} />
                    </span>
                    <small>{point.label || point.Label}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ss-breakdown-grid">
            <article><span>Shipping Collected</span><strong>{formatVnd(salesStats?.shippingCollected || 0)}</strong></article>
            <article><span>Discount Given</span><strong>{formatVnd(salesStats?.discountGiven || 0)}</strong></article>
            <article><span>Awaiting Payment</span><strong>{salesStats?.awaitingPaymentOrders ?? 0}</strong></article>
            <article><span>Pending</span><strong>{salesStats?.pendingOrders ?? 0}</strong></article>
            <article><span>Shipping</span><strong>{salesStats?.shippingOrders ?? 0}</strong></article>
            <article><span>Cancelled</span><strong>{salesStats?.cancelledOrders ?? 0}</strong></article>
            <article><span>Returned</span><strong>{salesStats?.returnedOrders ?? 0}</strong></article>
          </section>
        </>
      )}
    </div>
  );
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function formatCompactVnd(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000000) return `VND ${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `VND ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `VND ${(amount / 1000).toFixed(1)}K`;
  return `VND ${numberFormatter.format(amount)}`;
}
