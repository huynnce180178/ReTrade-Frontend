import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const message = searchParams.get('message') || 'No transaction information is available.';
  const paymentId = searchParams.get('paymentId') || '';
  const amount = searchParams.get('amount') || '';
  const transactionNo = searchParams.get('transactionNo') || '';
  const auctionId = searchParams.get('auctionId') || '';

  return (
    <div className="container animate-fade-in" style={{ padding: '60px 20px', minHeight: '60vh' }}>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          background: '#fff',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(22, 31, 24, 0.08)',
          border: `1px solid ${success ? '#cfe9d6' : '#f2d1d1'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: success ? '#e7f7ec' : '#fdecec',
              color: success ? '#1b7a3d' : '#b22a2a',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            {success ? 'OK' : 'X'}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>
              {success ? 'Payment Successful' : 'Payment Not Successful'}
            </h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>{message}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginTop: '24px' }}>
          <div><strong>Payment ID:</strong> {paymentId || '-'}</div>
          <div><strong>Amount:</strong> {amount || '-'} VND</div>
          <div><strong>VNPay Transaction No:</strong> {transactionNo || '-'}</div>
        </div>

        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {auctionId ? (
            <>
              <Link to={`/auction/${auctionId}`} className="btn btn-primary">Back to Auction</Link>
              <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </>
          ) : (
            <Link to="/" className="btn btn-primary">Back to Home</Link>
          )}
          <Link to="/purchase-history" className="btn btn-secondary">View Purchase History</Link>
        </div>
      </div>
    </div>
  );
}
