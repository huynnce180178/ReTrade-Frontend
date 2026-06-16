import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import orderService from '../../../services/orderService';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const statusOrder = ['Pending', 'Confirmed', 'Shipping', 'Delivered'];

const statusMeta = {
  Pending: { label: 'Pending', className: 'pending' },
  Confirmed: { label: 'Confirmed', className: 'confirmed' },
  Shipping: { label: 'Shipping', className: 'shipping' },
  Delivered: { label: 'Delivered', className: 'delivered' },
  Returned: { label: 'Returned', className: 'returned' },
  Cancelled: { label: 'Cancelled', className: 'cancelled' },
};

export default function OrderDetail() {
  const { orderId } = useParams();
  const { showToast } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await orderService.getById(orderId);
        setOrder(data);
      } catch (error) {
        showToast(error?.response?.data || 'Failed to load order detail.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const payment = order?.payments?.[0];
  const subtotal = Number(order?.totalAmount || 0);
  const shippingFee = Number(order?.shippingFee || 0);
  const discount = Number(order?.discountAmount || 0);
  const finalAmount = Number(order?.finalAmount || 0);
  const status = order?.status || 'Pending';
  const meta = statusMeta[status] || { label: status, className: 'default' };

  const timeline = useMemo(() => buildTimeline(order), [order]);

  if (loading) {
    return (
      <div className="seller-order-detail-page">
        <div className="seller-orders-empty">Loading order detail...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="seller-order-detail-page">
        <div className="seller-orders-empty">Order not found.</div>
      </div>
    );
  }

  return (
    <div className="seller-order-detail-page animate-fade-in">
      <div className="seller-order-breadcrumb">
        <Link to="/seller-dashboard">Home</Link>
        <span>Order Management</span>
        <strong>Order #{order.orderCode || order.orderId}</strong>
      </div>

      <header className="seller-order-detail-header">
        <div>
          <div className="seller-order-title-line">
            <h1>Order #{order.orderCode || order.orderId}</h1>
            <em className={`seller-order-status ${meta.className}`}>{meta.label}</em>
          </div>
          <p>
            Ordered on {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="seller-order-detail-actions">
          <button type="button">
            <span className="material-symbols-outlined">download</span>
            Download Invoice
          </button>
          <a href={order.buyerEmail ? `mailto:${order.buyerEmail}` : undefined}>
            <span className="material-symbols-outlined">mail</span>
            Contact Buyer
          </a>
          <button type="button" className="primary">Update Status</button>
        </div>
      </header>

      <div className="seller-order-detail-layout">
        <main className="seller-order-detail-main">
          <section className="seller-order-detail-card">
            <h2><span className="material-symbols-outlined">inventory_2</span> Items Summary</h2>
            <div className="seller-order-item-head">
              <span>Product</span>
              <span>SKU</span>
              <span>Price Qty</span>
              <span>Total</span>
            </div>
            <div className="seller-order-item-row">
              <div className="seller-order-detail-product">
                <img src={order.productImageUrl || '/vite.svg'} alt={order.productName || 'Product'} />
                <div>
                  <strong>{order.productName || 'Untitled product'}</strong>
                  <small>{order.productId}</small>
                </div>
              </div>
              <span>{order.productId || 'N/A'}</span>
              <strong>{formatVnd(order.unitPrice || 0)} <small>x {order.quantity || 0}</small></strong>
              <strong className="amount">{formatVnd(order.totalAmount || 0)}</strong>
            </div>
          </section>

          <section className="seller-order-detail-card">
            <h2><span className="material-symbols-outlined">timeline</span> Order Timeline</h2>
            <div className="seller-order-timeline">
              {timeline.map((item) => (
                <div key={item.label} className={`timeline-row ${item.done ? 'done' : ''} ${item.current ? 'current' : ''}`}>
                  <span className="timeline-dot">
                    <span className="material-symbols-outlined">{item.done ? 'check' : item.current ? 'local_shipping' : 'circle'}</span>
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="seller-order-detail-side">
          <section className="seller-order-side-card buyer">
            <h3>Buyer Details <span className="material-symbols-outlined">person</span></h3>
            <div className="buyer-mini">
              <div>{getInitials(order.buyerName || order.buyerId)}</div>
              <strong>{order.buyerName || order.buyerId}</strong>
            </div>
            <p><span className="material-symbols-outlined">call</span>{order.buyerPhone || 'No phone'}</p>
            <p><span className="material-symbols-outlined">mail</span>{order.buyerEmail || 'No email'}</p>
          </section>

          <section className="seller-order-side-card">
            <h3>Shipping Address <span className="material-symbols-outlined">location_on</span></h3>
            <strong>{order.addressSnapshot || 'No address snapshot'}</strong>
            <p className="map-line"><span className="material-symbols-outlined">map</span>View on Map</p>
          </section>

          <section className="seller-order-side-card">
            <h3>Payment Info <span className="material-symbols-outlined">payments</span></h3>
            <dl>
              <div><dt>Method</dt><dd>{payment?.paymentMethod || 'N/A'}</dd></div>
              <div><dt>Status</dt><dd><em className="paid-pill">{payment?.status || 'N/A'}</em></dd></div>
              <div><dt>Trans ID</dt><dd>{payment?.providerTransactionId || payment?.paymentId || 'N/A'}</dd></div>
            </dl>
          </section>

          <section className="seller-order-summary-card">
            <h3>Financial Summary</h3>
            <div><span>Subtotal</span><strong>{formatVnd(subtotal)}</strong></div>
            <div><span>Shipping</span><strong>{formatVnd(shippingFee)}</strong></div>
            <div><span>Voucher Discount</span><strong>-{formatVnd(discount)}</strong></div>
            <hr />
            <div className="total"><span>Total Amount</span><strong>{formatVnd(finalAmount)}</strong></div>
            <button type="button">Print Full Statement</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function buildTimeline(order) {
  if (!order) return [];
  const status = order.status || 'Pending';
  const statusIndex = statusOrder.indexOf(status);
  const terminal = status === 'Returned' || status === 'Cancelled';
  const base = [
    { key: 'Pending', label: 'Order Placed', text: `Placed ${formatDateTime(order.createdAt)}` },
    { key: 'Confirmed', label: 'Payment Confirmed', text: order.payments?.[0]?.updatedAt ? formatDateTime(order.payments[0].updatedAt) : 'Waiting for confirmation' },
    { key: 'Shipping', label: 'In Transit', text: order.trackingCode ? `Tracking ${order.trackingCode}` : 'Waiting for shipment' },
    { key: 'Delivered', label: 'Delivered', text: order.expectedDeliveryTime ? `Estimated delivery: ${formatDateTime(order.expectedDeliveryTime)}` : 'Pending delivery' },
  ];

  if (terminal) {
    return [
      ...base.slice(0, 2).map((item) => ({ ...item, done: true })),
      { key: status, label: status, text: `Order ${status.toLowerCase()}`, done: true, current: true },
    ];
  }

  return base.map((item, index) => ({
    ...item,
    done: statusIndex >= index,
    current: statusIndex === index,
  }));
}

function formatDateTime(value) {
  if (!value) return '-';
  return dateTimeFormatter.format(new Date(value));
}

function getInitials(value = '') {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'RT';
}

function formatVnd(value) {
  return `${numberFormatter.format(Number(value || 0))} VND`;
}
