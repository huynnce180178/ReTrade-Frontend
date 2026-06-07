import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import './Footer.css';

export default function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribeSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      alert(`Thank you for subscribing with ${email}!`);
      setEmail('');
    }
  };

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-col">
          <Link to="/" className="footer-logo" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '1px' }}>RETRADE</span>
          </Link>
          <p className="brand-description">
            Experience the future of smart second-hand commerce. Buy, sell, and auction quality pre-owned goods securely with verified users.
          </p>
          <div className="social-links">
            <a href="#facebook" className="social-icon-link" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-svg">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
              </svg>
            </a>
            <a href="#twitter" className="social-icon-link" aria-label="Twitter">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-svg">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
              </svg>
            </a>
            <a href="#instagram" className="social-icon-link" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-svg">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
            <a href="#linkedin" className="social-icon-link" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="social-svg">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
          </div>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-heading">Navigation</h4>
          <ul className="footer-list">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/product">Products</Link></li>
            <li><Link to="/auction">Auctions</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
          </ul>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-heading">Support</h4>
          <ul className="footer-list">
            <li><Link to="/support?tab=faq">FAQ</Link></li>
            <li><Link to="/support?tab=safety">Safety Tips</Link></li>
            <li><Link to="/support?tab=terms">Terms of Service</Link></li>
            <li><Link to="/support?tab=privacy">Privacy Policy</Link></li>
          </ul>
        </div>

        <div className="footer-newsletter-col">
          <h4 className="footer-heading">Newsletter</h4>
          <p className="newsletter-text">Subscribe to receive notifications about drops, prices, and special deals.</p>
          <form className="newsletter-form" onSubmit={handleSubscribeSubmit}>
            <input
              type="email"
              className="form-input newsletter-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-primary newsletter-btn">
              Join
            </button>
          </form>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="container footer-bottom-container">
          <p className="copyright-text">&copy; {new Date().getFullYear()} ReTrade. All rights reserved.</p>
          <p className="made-text">Made with ❤️ for smart trading</p>
        </div>
      </div>
    </footer>
  );
}
