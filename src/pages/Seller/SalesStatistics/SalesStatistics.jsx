import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';
import './SalesStatistics.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
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
  const successfulOrders = Number(salesStats?.deliveredOrders || 0) + Number(salesStats?.completedOrders || 0);
  const fulfillmentRate = salesStats?.totalOrders
    ? Math.round((successfulOrders / salesStats.totalOrders) * 100)
    : 0;
  const averageOrderValue = successfulOrders
    ? Number(salesStats?.netSales || 0) / successfulOrders
    : 0;
  const periodRange = formatDateRange(salesStats?.periodStart || salesStats?.PeriodStart, salesStats?.periodEnd || salesStats?.PeriodEnd);
  const hasTrendData = salesTrend.some((item) => Number(item.revenue ?? item.Revenue ?? 0) > 0 || Number(item.orderCount ?? item.OrderCount ?? 0) > 0);
  const animatedNetSales = useAnimatedNumber(Number(salesStats?.netSales || 0));
  const animatedGrossSales = useAnimatedNumber(Number(salesStats?.grossSales || 0));
  const animatedTotalOrders = useAnimatedNumber(Number(salesStats?.totalOrders || 0));
  const animatedSuccessfulOrders = useAnimatedNumber(successfulOrders);
  const animatedFulfillmentRate = useAnimatedNumber(fulfillmentRate);
  const animatedSoldItems = useAnimatedNumber(Number(salesStats?.soldItems || 0));
  const animatedAverageOrderValue = useAnimatedNumber(averageOrderValue);

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
          {periodRange && <strong className="ss-period-window">{periodRange}</strong>}
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
            <article className="ss-metric-card ss-metric-card--revenue" style={{ '--delay': '0ms' }}>
              <div>
                <span>Successful Revenue</span>
                <span className="material-symbols-outlined">payments</span>
              </div>
              <strong>{formatVnd(animatedNetSales)}</strong>
              <p>{formatVnd(animatedGrossSales)} gross before discounts</p>
            </article>
            <article className="ss-metric-card" style={{ '--delay': '70ms' }}>
              <div>
                <span>Orders In Period</span>
                <span className="material-symbols-outlined">receipt_long</span>
              </div>
              <strong>{Math.round(animatedTotalOrders)}</strong>
              <p>{Math.round(animatedSuccessfulOrders)} successful orders</p>
            </article>
            <article className="ss-metric-card ss-metric-card--rate" style={{ '--delay': '140ms' }}>
              <div>
                <span>Success Rate</span>
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <div className="ss-progress-ring" style={{ '--progress': `${Math.min(100, Math.max(0, animatedFulfillmentRate)) * 3.6}deg` }}>
                <strong>{Math.round(animatedFulfillmentRate)}%</strong>
              </div>
              <p>{Math.round(animatedSoldItems)} sold items</p>
            </article>
            <article className="ss-metric-card" style={{ '--delay': '210ms' }}>
              <div>
                <span>Average Order</span>
                <span className="material-symbols-outlined">monitoring</span>
              </div>
              <strong>{formatVnd(animatedAverageOrderValue)}</strong>
              <p>Based on delivered and completed orders</p>
            </article>
          </section>

          <section className="ss-chart-panel">
            <div className="ss-chart-head">
              <div>
                <span>Revenue Trend</span>
                <strong>{formatCompactVnd(animatedNetSales)}</strong>
              </div>
              <em><i /> Revenue <b /> Orders</em>
            </div>
            {hasTrendData ? (
              <div className="ss-chart-bars" style={{ '--bar-count': salesTrend.length || 1 }}>
                {salesTrend.map((point, index) => {
                  const revenue = Number(point.revenue ?? point.Revenue ?? 0);
                  const orderCount = Number(point.orderCount ?? point.OrderCount ?? 0);
                  const height = Math.max(revenue > 0 ? 12 : 4, Math.round((revenue / maxTrendRevenue) * 100));

                  return (
                    <div key={`${point.label || point.Label}-${index}`} className="ss-chart-bar">
                      <span title={`${formatVnd(revenue)} - ${orderCount} orders`}>
                        <i style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * 70}ms` }} />
                      </span>
                      <b>{orderCount}</b>
                      <small>{point.label || point.Label}</small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ss-empty-chart">
                <span className="material-symbols-outlined">bar_chart</span>
                <strong>No successful sales in this period</strong>
                <p>Revenue appears after an order reaches Delivered or Completed.</p>
              </div>
            )}
          </section>

          <section className="ss-breakdown-grid">
            {[
              ['Shipping Collected', formatVnd(salesStats?.shippingCollected || 0)],
              ['Discount Given', formatVnd(salesStats?.discountGiven || 0)],
              ['Awaiting Payment', salesStats?.awaitingPaymentOrders ?? 0],
              ['Pending', salesStats?.pendingOrders ?? 0],
              ['Confirmed', salesStats?.confirmedOrders ?? 0],
              ['Shipping', salesStats?.shippingOrders ?? 0],
              ['Delivered', salesStats?.deliveredOrders ?? 0],
              ['Completed', salesStats?.completedOrders ?? 0],
              ['Delivery Failed', salesStats?.deliveryFailedOrders ?? 0],
              ['Cancelled', salesStats?.cancelledOrders ?? 0],
              ['Returned', salesStats?.returnedOrders ?? 0],
            ].map(([label, value], index) => (
              <article key={label} style={{ '--delay': `${index * 35}ms` }}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
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

function formatDateRange(start, end) {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
  return `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`;
}

function useAnimatedNumber(value, duration = 720) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const startValue = previousValue.current;
    const change = value - startValue;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + change * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [duration, value]);

  return displayValue;
}
