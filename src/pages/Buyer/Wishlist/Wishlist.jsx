import React from 'react';

export default function Wishlist() {
  return (
    <div className="container animate-fade-in" style={{ padding: '60px 20px', minHeight: '60vh', textAlign: 'center' }}>
      <span style={{ fontSize: '48px' }}>❤️</span>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', marginTop: '16px' }}>Your Saved Wishlist</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '500px', margin: '8px auto 0 auto' }}>
        Keep track of items you are interested in. Get notified immediately when price drops or auctions go live!
      </p>
    </div>
  );
}
