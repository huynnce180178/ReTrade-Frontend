import React from 'react';

export default function Auction() {
  return (
    <div className="container animate-fade-in" style={{ padding: '60px 20px', minHeight: '60vh', textAlign: 'center' }}>
      <span style={{ fontSize: '48px' }}>📈</span>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', marginTop: '16px' }}>Live Bidding Auctions</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '500px', margin: '8px auto 0 auto' }}>
        Participate in real-time auctions for premium and high-value items. Compete and win live deals!
      </p>
    </div>
  );
}
