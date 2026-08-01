import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import ReviewModal from '../../../components/ReviewModal/ReviewModal';
import ReportModal from '../../../components/ReportModal/ReportModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import purchaseService from '../../../services/purchaseService';
import reviewService from '../../../services/reviewService';
import productService from '../../../services/productService';

import paymentService from '../../../services/paymentService';
import reportService from '../../../services/reportService';
import { createOrderHubConnection } from '../../../services/orderRealtimeService';
import '../../../styles/MyAccount.css';
import './PurchaseHistory.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const returnRequestWindowMs = 7 * 24 * 60 * 60 * 1000;
const REPORT_ALLOWED_STATUSES = [
  'Delivered',
  'DeliveryFailed',
  'Completed',
  'ReturnRequested',
  'ReturnRejected',
  'Returned',
];


const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const statusTabs = [
  { key: 'all', label: 'All Orders' },
  { key: 'AwaitingPayment', label: 'Pending Payment' },
  { key: 'Pending', label: 'Processing' },
  { key: 'Shipping', label: 'Shipping' },
  { key: 'Delivered', label: 'Delivered' },
  { key: 'Completed', label: 'Completed' },
  { key: 'ReturnRequested', label: 'Return Requested' },
  { key: 'Returned', label: 'Returned' },
  { key: 'ReturnRejected', label: 'Return Rejected' },
  { key: 'DeliveryFailed', label: 'Delivery Failed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

const statusMeta = {
  AwaitingPayment: { label: 'Waiting for Payment', className: 'awaiting' },
  Pending: { label: 'Processing', className: 'pending' },
  Confirmed: { label: 'Confirmed', className: 'confirmed' },
  Shipping: { label: 'Shipping', className: 'shipping' },
  Delivered: { label: 'Delivered', className: 'delivered' },
  Completed: { label: 'Completed', className: 'completed' },
  DeliveryFailed: { label: 'Delivery Failed', className: 'delivery-failed' },
  Cancelled: { label: 'Cancelled', className: 'cancelled' },
  ReturnRequested: { label: 'Return Requested', className: 'return-requested' },
  ReturnRejected: { label: 'Return Rejected', className: 'return-rejected' },
  Returned: { label: 'Returned', className: 'returned' },
};

export default function PurchaseHistory() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();


  const [purchases, setPurchases] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allPurchasesGlobal, setAllPurchasesGlobal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeStatus, setActiveStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const buyerId = user?.userId;

  

  const loadPurchases = useCallback(async () => {
    if (!buyerId) return;

    try {
      setLoading(true);
      // Prefer new page-based API: returns { totalCount, page, pageSize, items }
      let data;

      // Use backend page-based API and pass `status` when a filter is active
      const params = {
        page,
        pageSize,
      };

      if (activeStatus && activeStatus !== 'all') {
        params.status = activeStatus;
      }

      data = await purchaseService.getByBuyer(buyerId, params);

      // Also fetch an overview (up to 100) to compute summaries and client-side search
      let overview = [];
      try {
        // Always fetch a global overview for counts (tabs/insights)
        const globalOv = await purchaseService.getByBuyer(buyerId, { $orderby: 'CreatedAt desc', $top: 100 });
        const globalList = normalizeODataList(globalOv);
        setAllPurchasesGlobal(globalList);

        // Fetch filtered overview if a status is active, otherwise reuse global list
        if (activeStatus && activeStatus !== 'all') {
          const ovParams = { $orderby: 'CreatedAt desc', $top: 100, $filter: `Status eq '${activeStatus}'` };
          const ov = await purchaseService.getByBuyer(buyerId, ovParams);
          overview = normalizeODataList(ov);
        } else {
          overview = globalList;
        }
      } catch (e) {
        overview = [];
        setAllPurchasesGlobal([]);
      }

      setAllPurchases(overview);

      // If user is searching, perform client-side filter on overview data
      const keyword = searchTerm.trim().toLowerCase();
      if (keyword) {
        const filtered = overview.filter((purchase) => {
          const searchable = [
            purchase.orderCode,
            purchase.orderId,
            purchase.productName,
            purchase.sellerName,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return searchable.includes(keyword) && (activeStatus === 'all' || purchase.status === activeStatus);
        });

        setTotal(filtered.length);
        setPurchases(filtered.slice((page - 1) * pageSize, page * pageSize));
      } else {
        // No search: use server-provided page
        if (data && Array.isArray(data.items)) {
          setPurchases(data.items);
          setTotal(Number(data.totalCount) || data.items.length);
        } else {
          const list = normalizeODataList(data);
          setPurchases(list);
          const count = data?.['@odata.count'] ?? data?.['odata.count'] ?? list.length;
          setTotal(typeof count === 'number' ? count : Number(count) || list.length);
        }
      }
    } catch (error) {
      showToast(error?.response?.data || t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, buyerId, page, pageSize, searchTerm, showToast]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    if (!buyerId) return undefined;

    const connection = createOrderHubConnection();
    let disposed = false;

    const handleBuyerOrderStatusChanged = (payload) => {
      const payloadBuyerId = payload?.buyerId || payload?.BuyerId;
      if (payloadBuyerId && payloadBuyerId !== buyerId) return;
      loadPurchases();
    };

    connection.on('BuyerOrderStatusChanged', handleBuyerOrderStatusChanged);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinBuyerOrderGroup', buyerId);
        }
      } catch (error) {
        console.error('Failed to connect buyer order hub:', error);
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('BuyerOrderStatusChanged', handleBuyerOrderStatusChanged);
      if (connection.state === 'Connected') {
        connection.invoke('LeaveBuyerOrderGroup', buyerId).catch(() => {});
      }
      connection.stop().catch(() => {});
    };
  }, [buyerId, loadPurchases]);

  // Scroll to top when page or filter changes so user sees the refreshed list
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // ignore in non-browser environments
    }
  }, [page, activeStatus]);

  const filteredPurchases = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesStatus = activeStatus === 'all' || purchase.status === activeStatus;
      const searchable = [
        purchase.orderCode,
        purchase.orderId,
        purchase.productName,
        purchase.sellerName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!keyword || searchable.includes(keyword));
    });
  }, [activeStatus, purchases, searchTerm]);

  const summary = useMemo(() => {
    const source = allPurchases.length ? allPurchases : purchases;
    const totalSpent = source
      .filter((purchase) => !['Cancelled', 'DeliveryFailed'].includes(purchase.status))
      .reduce((sum, purchase) => sum + Number(purchase.finalAmount || 0), 0);
    const pending = source.filter((purchase) => ['AwaitingPayment', 'Pending', 'Confirmed'].includes(purchase.status)).length;
    const transit = source.filter((purchase) => purchase.status === 'Shipping').length;
    const delivered = source.filter((purchase) => purchase.status === 'Delivered').length;
    const completed = source.filter((purchase) => purchase.status === 'Completed').length;
    const returns = source.filter((purchase) => ['ReturnRequested', 'Returned', 'ReturnRejected'].includes(purchase.status)).length;
    const averageOrder = source.length ? totalSpent / source.length : 0;

    return { totalSpent, pending, transit, delivered, completed, returns, averageOrder };
  }, [purchases, allPurchases, allPurchasesGlobal]);

  const statusCounts = useMemo(() => {
    const countSource = allPurchasesGlobal.length
      ? allPurchasesGlobal
      : allPurchases.length
      ? allPurchases
      : purchases;

    return countSource.reduce(
      (acc, purchase) => ({
        ...acc,
        [purchase.status]: (acc[purchase.status] || 0) + 1,
      }),
      { all: countSource.length }
    );
  }, [purchases, allPurchases]);

  const updatePurchase = async (purchase, action) => {
    if (!buyerId) return;

    try {
      setUpdatingId(purchase.orderId);
      let updated = null;
      if (action === 'complete') {
        updated = await purchaseService.complete(buyerId, purchase.orderId);
        showToast(t('common.purchase_completed'), 'success');
        setReviewTarget(updated ? { ...purchase, ...updated } : purchase);
        setReviewModalOpen(true);
      } else {
        updated = await purchaseService.cancel(buyerId, purchase.orderId);
        showToast(t('common.purchase_cancelled'), 'success');
      }
      loadPurchases();
      return updated;
    } catch (error) {
      showToast(error?.response?.data || t('common.save_error'), 'error');
      return null;
    } finally {
      setUpdatingId('');
    }
  };

  const handleOpenReview = (purchase) => {
    setReviewTarget(purchase);
    setReviewModalOpen(true);
  };

  const handleOpenReturn = (purchase) => {
    setReturnTarget(purchase);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleCloseReturn = () => {
    if (returnSubmitting) return;
    setReturnModalOpen(false);
    setReturnTarget(null);
    setReturnReason('');
  };

  const handleSubmitReturn = async (event) => {
    event.preventDefault();
    if (!buyerId || !returnTarget?.orderId) return;

    const reason = returnReason.trim();
    if (!reason) {
      showToast(t('common.return_reason_required'), 'warning');
      return;
    }

    try {
      setReturnSubmitting(true);
      setUpdatingId(returnTarget.orderId);
      await purchaseService.requestReturn(buyerId, returnTarget.orderId, reason);
      showToast(t('common.return_submitted'), 'success');
      setReturnModalOpen(false);
      setReturnTarget(null);
      setReturnReason('');
      loadPurchases();
    } catch (error) {
      showToast(error?.response?.data || t('common.return_error'), 'error');
    } finally {
      setReturnSubmitting(false);
      setUpdatingId('');
    }
  };

  const handleSubmitReview = async ({ rating, comment, proofs }) => {
    if (!buyerId || !reviewTarget?.orderId) return;

    try {
      setReviewSubmitting(true);
      const proofUrls = [];
      if (Array.isArray(proofs) && proofs.length > 0) {
        for (const p of proofs) {
          if (p?.file) {
            try {
              const res = await productService.uploadImage(p.file);
              const url = res?.url || res?.imageUrl || res?.path || res;
              if (typeof url === 'string') proofUrls.push(url);
            } catch {
              // Ignore single upload failure
            }
          }
        }
      }

      await reviewService.create(buyerId, {
        orderId: reviewTarget.orderId,
        rating,
        comment,
        proofUrls,
      });
      setPurchases((prev) =>
        prev.map((p) => (p.orderId === reviewTarget.orderId ? { ...p, hasReview: true, isReviewed: true } : p))
      );
      setAllPurchases((prev) =>
        prev.map((p) => (p.orderId === reviewTarget.orderId ? { ...p, hasReview: true, isReviewed: true } : p))
      );
      showToast(t('common.review_submitted'), 'success');
      setReviewModalOpen(false);
      setReviewTarget(null);
      loadPurchases();

    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.response?.data || error?.message;
      showToast(errorMsg || t('common.review_error'), 'error');
      if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('already reviewed')) {
        setReviewModalOpen(false);
        setReviewTarget(null);
        loadPurchases();
      }
    } finally {
      setReviewSubmitting(false);
    }
  };



  const handlePayAgain = async (purchase) => {
    if (!buyerId || !purchase?.orderId) return;

    try {
      setUpdatingId(purchase.orderId);
      const payload = {
        orderId: purchase.orderId,
        amount: Number(purchase.finalAmount || purchase.totalAmount || 0),
        orderDescription: `Payment for order ${purchase.orderCode || purchase.orderId}`,
      };

      const resp = await paymentService.createVnpayPaymentUrl(payload);
      const url =
        typeof resp === 'string'
          ? resp
          : resp?.paymentUrl || resp?.url || resp?.paymentLink || null;

      if (!url) {
        showToast(t('common.payment_no_url'), 'error');
        return;
      }

      window.location.href = url;
    } catch (error) {
      showToast(error?.response?.data || t('common.payment_error'), 'error');
    } finally {
      setUpdatingId('');
    }
  };

  const handleSubmitSellerReport = async (payload) => {
    if (!reportTarget?.orderId) return;
    try { setReportSubmitting(true); await reportService.reportSeller(reportTarget.orderId, payload); showToast(t('common.report_submitted'), 'success'); setReportTarget(null); }
    catch (error) { showToast(error?.response?.data || t('common.report_error'), 'error'); }
    finally { setReportSubmitting(false); }
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="purchase-layout">
            <section className="purchase-main-col">
              <div className="ma-card purchase-hero-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">shopping_bag</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">{language === 'vi' ? 'Lịch Sử Mua Hàng' : 'Purchase History'}</h1>
                    <p className="ma-subtitle">{language === 'vi' ? 'Theo dõi và quản lý các đơn hàng, thanh toán và tiến trình giao hàng của bạn.' : 'Track and manage your orders, payments, and shipping progress.'}</p>
                  </div>
                </div>
              </div>

              <section className="purchase-filter-card">
                <div className="purchase-tabs">
                  {statusTabs.map((tab) => {
                    const tabMapVi = {
                      all: 'Tất cả đơn',
                      AwaitingPayment: 'Chờ thanh toán',
                      Pending: 'Đang xử lý',
                      Confirmed: 'Đã xác nhận',
                      Shipping: 'Đang giao',
                      Delivered: 'Đã giao',
                      Completed: 'Hoàn thành',
                      ReturnRequested: 'Yêu cầu trả',
                      Returned: 'Đã trả hàng',
                      ReturnRejected: 'Bị từ chối trả',
                      DeliveryFailed: 'Giao thất bại',
                      Cancelled: 'Đã hủy',
                    };
                    const labelText = language === 'vi' ? (tabMapVi[tab.key] || tab.label) : tab.label;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeStatus === tab.key ? 'active' : ''}
                        onClick={() => {
                          setActiveStatus(tab.key);
                          setPage(1);
                        }}
                      >
                        {labelText}
                        <span>{statusCounts[tab.key] || 0}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="purchase-search">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={language === 'vi' ? 'Tìm theo mã đơn hàng, sản phẩm hoặc người bán...' : 'Search by order ID, product, or seller...'}
                  />
                </label>
              </section>

              <section className="purchase-list">
                {loading ? (
                  <div className="purchase-empty-state">
                    <span className="btn-spinner"></span>
                    <p>Loading your purchases...</p>
                  </div>
                ) : filteredPurchases.length === 0 ? (
                  <div className="purchase-empty-state">
                    <span className="material-symbols-outlined">shopping_bag</span>
                    <h3>No purchases found</h3>
                    <p>Try a different filter or search term.</p>
                  </div>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <PurchaseCard
                      key={purchase.orderId}
                      purchase={purchase}
                      language={language}
                      updating={updatingId === purchase.orderId}
                      onCancel={() => updatePurchase(purchase, 'cancel')}
                      onComplete={() => updatePurchase(purchase, 'complete')}
                      onWriteReview={() => handleOpenReview(purchase)}
                      onRequestReturn={() => handleOpenReturn(purchase)}
                      onPayAgain={() => handlePayAgain(purchase)}
                      onReportSeller={() => setReportTarget(purchase)}
                    />
                  ))
                )}
              </section>

              <footer className="purchase-list-footer">
                <div>
                  <span>
                    Showing {purchases.length ? (page - 1) * pageSize + 1 : 0}
                    -{(page - 1) * pageSize + purchases.length} of {total} orders
                  </span>
                </div>
                <div className="purchase-pagination">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </button>
                  <span className="page-indicator">Page {page}</span>
                  <button type="button" disabled={(page * pageSize) >= total} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              </footer>
            </section>

            <aside className="purchase-side-col">
              <div className="purchase-side-sticky glass-panel">
                <section className="purchase-summary-card">
                <h2>{language === 'vi' ? 'Tổng Quan Chi Tiêu' : 'Spending Summary'}</h2>
                <div className="purchase-total-spent">
                  <span>{language === 'vi' ? 'Tổng Chi Tiêu (Toàn thời gian)' : 'Total Spent (Lifetime)'}</span>
                  <strong>{formatVnd(summary.totalSpent)}</strong>
                </div>
                <div className="purchase-summary-grid">
                  <div>
                    <span>{language === 'vi' ? 'Chờ xử lý' : 'Pending'}</span>
                    <strong>{summary.pending} {language === 'vi' ? 'Đơn' : 'Orders'}</strong>
                  </div>
                  <div>
                    <span>{language === 'vi' ? 'Đang giao' : 'Shipping'}</span>
                    <strong>{summary.transit} {language === 'vi' ? 'Đơn' : 'Orders'}</strong>
                  </div>
                  <div>
                    <span>{language === 'vi' ? 'Đã giao' : 'Delivered'}</span>
                    <strong>{summary.delivered} {language === 'vi' ? 'Đơn' : 'Orders'}</strong>
                  </div>
                  <div>
                    <span>{language === 'vi' ? 'Hoàn thành' : 'Completed'}</span>
                    <strong>{summary.completed} {language === 'vi' ? 'Đơn' : 'Orders'}</strong>
                  </div>
                  <div>
                    <span>{language === 'vi' ? 'Trả hàng' : 'Returns'}</span>
                    <strong>{summary.returns} {language === 'vi' ? 'Đơn' : 'Orders'}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 14, color: '#5c706b', fontSize: 13 }}>
                  <span>{language === 'vi' ? 'Giá trị đơn TB: ' : 'Avg. Order Value: '}</span>
                  <strong>{formatCompactVnd(summary.averageOrder)}</strong>
                </div>
                </section>

                <section className="purchase-insights-card">
                <h2>{language === 'vi' ? 'Thống Kê Mua Hàng' : 'Purchase Insights'}</h2>
                {/* Use the same population as `summary` for percentages when available (overview),
                    otherwise fall back to server `total`. This prevents >100% values. */}
                {(() => {
                  const insightsTotal = allPurchases.length ? allPurchases.length : total;
                  return (
                    <>
                      <InsightBar label={`Processing (${summary.pending})`} value={getPercent(summary.pending, insightsTotal)} />
                      <InsightBar label={`Shipping (${summary.transit})`} value={getPercent(summary.transit, insightsTotal)} />
                      <InsightBar label={`Delivered (${summary.delivered})`} value={getPercent(summary.delivered, insightsTotal)} />
                      <InsightBar label={`Completed (${summary.completed})`} value={getPercent(summary.completed, insightsTotal)} muted />
                      <InsightBar label={`Returns (${summary.returns})`} value={getPercent(summary.returns, insightsTotal)} muted />
                    </>
                  );
                })()}
                <div className="purchase-insight-note">
                  <span className="material-symbols-outlined">verified</span>
                  <p>Your purchases are protected by RETRADE order tracking and seller verification.</p>
                </div>
                </section>
              </div>
            </aside>
          </div>

          <ReviewModal
            isOpen={reviewModalOpen}
            title="Write a Review"
            purchase={reviewTarget}
            submitting={reviewSubmitting}
            onClose={() => {
              setReviewModalOpen(false);
              setReviewTarget(null);
            }}
            onSubmit={handleSubmitReview}
          />
          <ReportModal isOpen={Boolean(reportTarget)} title="Report Seller" targetLabel={`Report the seller for order #${reportTarget?.orderCode || reportTarget?.orderId || ''}.`} submitting={reportSubmitting} onClose={() => !reportSubmitting && setReportTarget(null)} onSubmit={handleSubmitSellerReport} />

          {returnModalOpen && (
            <ReturnRequestModal
              purchase={returnTarget}
              reason={returnReason}
              submitting={returnSubmitting}
              onReasonChange={setReturnReason}
              onClose={handleCloseReturn}
              onSubmit={handleSubmitReturn}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function PurchaseCard({ purchase, updating, onCancel, onComplete, onWriteReview, onRequestReturn, onPayAgain, onReportSeller, language }) {
  const { t } = useLanguage();
  const meta = statusMeta[purchase.status] || { label: purchase.status || (t ? t('common.unknown') : 'Unknown'), className: 'default' };

  const canCancel = ['AwaitingPayment', 'Pending', 'Confirmed'].includes(purchase.status);
  const canComplete = purchase.status === 'Delivered';
  const isReviewed = Boolean(purchase.hasReview || purchase.isReviewed || purchase.hasReviewed || purchase.isHasReviewed);
  const canReview = purchase.status === 'Completed' && !isReviewed;

  const canRequestReturn = purchase.status === 'Completed' && isWithinReturnRequestWindow(purchase);
  const canPay = purchase.status === 'AwaitingPayment';

  return (
    <article className="purchase-card">
      <Link to={`/purchase-history/${purchase.orderId}`} className="purchase-card-click-area">
        <header className="purchase-card-header">
          <div className="purchase-card-header-left">
            <strong className="purchase-card-order-code">{language === 'vi' ? 'Đơn hàng #' : 'Order #'}{purchase.orderCode || purchase.orderId}</strong>
            <span className="purchase-card-date">{formatDate(purchase.createdAt)}</span>
            <span className="purchase-card-seller">
              <span className="material-symbols-outlined">storefront</span>
              {purchase.sellerName || purchase.sellerEmail || '-'}
            </span>
          </div>
          <em className={`purchase-status ${meta.className}`}>{meta.label}</em>
        </header>

        <div className="purchase-card-body">
          <div className="purchase-product-item">
            <img 
              className="purchase-product-img" 
              src={purchase.productImageUrl || '/vite.svg'} 
              alt={purchase.productName || t('common.unnamed_product')} 
            />
            <div className="purchase-product-details">
              <h3 className="purchase-product-title">{purchase.productName || t('common.unnamed_product')}</h3>
              <span className="purchase-product-qty">{language === 'vi' ? 'SL: x' : 'Qty: x'}{purchase.quantity || 0}</span>
            </div>
            <div className="purchase-product-price-info">
              <span className="purchase-product-unit-price">
                {formatVnd(purchase.unitPrice || (purchase.totalAmount / (purchase.quantity || 1)) || 0)}
              </span>
            </div>
          </div>

          <div className="purchase-order-total">
            <div className="purchase-shipping-info">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px', color: 'var(--text-muted)' }}>
                local_shipping
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {purchase.shippingProvider || (language === 'vi' ? 'Chờ vận chuyển' : 'Shipping pending')}
              </span>
            </div>
            <div className="purchase-total-price-wrap">
              <span className="purchase-total-label">{language === 'vi' ? 'Tổng tiền: ' : 'Order Total: '}</span>
              <strong className="purchase-total-price">
                {formatVnd(purchase.finalAmount || purchase.totalAmount || 0)}
              </strong>
            </div>
          </div>
          {purchase.returnReason && (
            <div className="purchase-return-note">
              <span className="material-symbols-outlined">assignment_return</span>
              <p>{purchase.returnReason}</p>
            </div>
          )}
        </div>
      </Link>

      <footer className="purchase-card-actions">
        {canCancel && (
          <button type="button" className="purchase-text-danger" disabled={updating} onClick={onCancel}>
            {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Updating...') : (language === 'vi' ? 'Hủy đơn hàng' : 'Cancel')}
          </button>
        )}
        {canPay && (
          <button type="button" className="purchase-primary-btn" disabled={updating} onClick={onPayAgain}>
            {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...') : (language === 'vi' ? 'Thanh toán lại' : 'Pay Again')}
          </button>
        )}
        {canReview && (
          <button type="button" className="purchase-primary-btn" onClick={onWriteReview}>
            {language === 'vi' ? 'Đánh giá' : 'Write Review'}
          </button>
        )}
        {canRequestReturn && (
          <button type="button" className="purchase-detail-btn request-return" disabled={updating} onClick={onRequestReturn}>
            {language === 'vi' ? 'Yêu cầu trả hàng' : 'Request Return'}
          </button>
        )}
        {REPORT_ALLOWED_STATUSES.includes(purchase.status) && (
          <button type="button" className="purchase-detail-btn" disabled={updating} onClick={onReportSeller}>
            {language === 'vi' ? 'Báo cáo người bán' : 'Report Seller'}
          </button>
        )}

        <Link to={`/purchase-history/${purchase.orderId}`} className="purchase-detail-btn">
          {language === 'vi' ? 'Chi tiết' : 'Details'}
        </Link>
        {canComplete && (
          <button type="button" className="purchase-primary-btn" disabled={updating} onClick={onComplete}>
            {updating ? (language === 'vi' ? 'Đang xử lý...' : 'Updating...') : (language === 'vi' ? 'Đã nhận hàng' : 'Mark Completed')}
          </button>
        )}
      </footer>
    </article>
  );
}

function ReturnRequestModal({ purchase, reason, submitting, onReasonChange, onClose, onSubmit }) {
  return (
    <div className="purchase-return-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="purchase-return-modal" role="dialog" aria-modal="true" aria-labelledby="return-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="purchase-return-modal-close" onClick={onClose} disabled={submitting} aria-label="Close return request form">
          <span className="material-symbols-outlined">close</span>
        </button>
        <header>
          <h2 id="return-modal-title">Request Return</h2>
          <p>Order #{purchase?.orderCode || purchase?.orderId}</p>
        </header>
        <form onSubmit={onSubmit}>
          <label className="purchase-return-reason">
            <span>Return reason</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Describe why you want to return this purchase..."
              rows={5}
              maxLength={1000}
              disabled={submitting}
            />
          </label>
          <div className="purchase-return-modal-actions">
            <button type="button" className="purchase-detail-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="purchase-primary-btn" disabled={submitting || !reason.trim()}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InsightBar({ label, value, muted = false }) {
  return (
    <div className="purchase-insight-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="purchase-insight-track">
        <span className={muted ? 'muted' : ''} style={{ width: `${value}%` }}></span>
      </div>
    </div>
  );
}

function isWithinReturnRequestWindow(purchase) {
  const updatedAt = Date.parse(purchase?.updatedAt || '');
  if (Number.isNaN(updatedAt)) return false;

  const elapsed = Date.now() - updatedAt;
  return elapsed >= 0 && elapsed <= returnRequestWindowMs;
}

function normalizeODataList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatDate(value) {
  if (!value) return '-';
  return dateFormatter.format(new Date(value));
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}

function formatCompactVnd(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000000) return `${numberFormatter.format(amount / 1000000000)}B`;
  if (amount >= 1000000) return `${numberFormatter.format(amount / 1000000)}M`;
  return formatVnd(amount);
}

function getPercent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
