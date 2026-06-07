import React from 'react';

export default function Product() {
  return (
    <div className="container animate-fade-in" style={{ padding: '60px 20px', minHeight: '60vh', textAlign: 'center' }}>
      <span style={{ fontSize: '48px' }}>🛒</span>
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', marginTop: '16px' }}>Product Marketplace</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '8px', maxWidth: '500px', margin: '8px auto 0 auto' }}>
        Discover and browse quality pre-owned goods listed by our verified sellers. Instant purchasing options coming soon!
      </p>
    </div>
  );
}
