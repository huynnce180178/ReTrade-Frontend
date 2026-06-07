import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../../styles/Home.css';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      alert(`Searching for: "${searchQuery}"`);
    }
  };

  return (
    <div className="home-page animate-fade-in">
      <section className="hero-section">
        <div className="hero-glow hero-glow-1"></div>
        <div className="hero-glow hero-glow-2"></div>
        
        <div className="container hero-container">
          <div className="hero-content">
            <span className="hero-badge">✨ Next-Generation Trading Platform</span>
            <h1 className="hero-title">
              Trade Smarter.<br />
              Live <span className="gradient-primary-text">Sustainably.</span>
            </h1>
            <p className="hero-subtitle">
              Buy, sell, and host auctions for quality pre-loved goods. Fully secured, verified, and community-driven.
            </p>

            <form className="hero-search-form" onSubmit={handleSearchSubmit}>
              <div className="search-input-wrapper">
                <svg className="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <button type="submit" className="btn btn-primary search-btn">
                Search
              </button>
            </form>

            <div className="hero-tags">
              <span className="tag-label">Popular:</span>
              <button className="tag-btn" onClick={() => setSearchQuery('iPhone')}>iPhone</button>
              <button className="tag-btn" onClick={() => setSearchQuery('Motorcycle')}>Motorcycle</button>
              <button className="tag-btn" onClick={() => setSearchQuery('Camera')}>Camera</button>
              <button className="tag-btn" onClick={() => setSearchQuery('Laptop')}>Laptop</button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="visual-card main-visual-card">
              <div className="card-header">
                <span className="card-badge">LIVE AUCTION</span>
                <span className="card-timer">02h 41m left</span>
              </div>
              <div className="card-image-placeholder">
                <span className="placeholder-text">Premium Vespa Sprint</span>
                <div className="image-overlay-glow"></div>
              </div>
              <div className="card-info">
                <h4>Vespa Sprint 150 ABS 2022</h4>
                <div className="price-row">
                  <div>
                    <span className="price-label">Current Bid</span>
                    <p className="price-value">$2,450</p>
                  </div>
                  <button className="btn btn-primary bid-btn">Place Bid</button>
                </div>
              </div>
            </div>
            
            <div className="visual-card floating-card-1">
              <div className="float-badge">🚀 Fast Deal</div>
              <p>MacBook Pro M2 - $1,100</p>
            </div>
            <div className="visual-card floating-card-2">
              <div className="float-badge">⭐ Top Seller</div>
              <p>Alex Johnson (4.9★)</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container stats-grid grid-4-col">
          <div className="stat-card glass-card">
            <h3>$3.5M+</h3>
            <p>Trading Volume</p>
          </div>
          <div className="stat-card glass-card">
            <h3>45,000+</h3>
            <p>Items Traded</p>
          </div>
          <div className="stat-card glass-card">
            <h3>12,000+</h3>
            <p>Verified Traders</p>
          </div>
          <div className="stat-card glass-card">
            <h3>99.4%</h3>
            <p>Success Rate</p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose <span className="gradient-primary-text">ReTrade</span>?</h2>
            <p className="section-subtitle">We provide a premium, modern, and highly secure environment for both buyers and sellers.</p>
          </div>

          <div className="features-grid grid-3-col">
            <div className="feature-item glass-card">
              <div className="feature-icon">🛡️</div>
              <h3>Verified Members</h3>
              <p>All members require active email OTP confirmation and background checks to prevent spamming and fraud.</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Trading</h3>
              <p>Get in touch directly with sellers and buy items instantly or save them to your custom wishlist.</p>
            </div>
            <div className="feature-item glass-card">
              <div className="feature-icon">📈</div>
              <h3>Live Auctions</h3>
              <p>Put premium, high-value items up for bidding. Experience real-time price updates and dynamic competition.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-card glass-panel">
            <h2>Ready to declutter or find amazing deals?</h2>
            <p>Create an account within minutes, confirm your email and start listing your products.</p>
            <div className="cta-buttons">
              <Link to="/register" className="btn btn-primary">Create Account Now</Link>
              <Link to="/product" className="btn btn-secondary">Browse Products</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
