import React from 'react';
import './TermsModal.css';

export default function TermsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal-card">
        <button className="terms-close-btn" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div className="terms-modal-content">
          <h1>Terms of Membership</h1>
          <p className="terms-last-updated">Last Updated: June 2026</p>

          <section className="terms-section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to ReTrade. By accessing or using our platform, you agree to be bound by these Terms of Membership. 
              ReTrade is a smart second-hand trading and auction platform designed to provide a secure and trusted marketplace 
              for buyers and sellers.
            </p>
          </section>

          <section className="terms-section">
            <h2>2. Account Eligibility</h2>
            <p>
              To become a member of ReTrade, you must be at least 18 years old and capable of forming a binding contract. 
              You are responsible for maintaining the confidentiality of your account credentials and for all activities 
              that occur under your account.
            </p>
          </section>

          <section className="terms-section">
            <h2>3. Trading & Auctions</h2>
            <p>
              All items listed on ReTrade must be accurately described and authenticated where applicable. 
              Bids placed on auction items are binding. By placing a bid, you commit to purchasing the item 
              if you are the highest bidder at the end of the auction period.
            </p>
          </section>

          <section className="terms-section">
            <h2>4. Prohibited Conduct</h2>
            <ul>
              <li>Providing false, misleading, or inaccurate information.</li>
              <li>Selling counterfeit or stolen goods.</li>
              <li>Engaging in fraudulent activities or manipulating the auction process.</li>
              <li>Harassing or abusing other members of the community.</li>
            </ul>
          </section>

          <section className="terms-section">
            <h2>5. Dispute Resolution</h2>
            <p>
              In the event of a dispute between a buyer and a seller, ReTrade encourages both parties to communicate directly 
              to reach an amicable resolution. ReTrade reserves the right to mediate disputes and make final decisions regarding 
              refunds or account suspensions in cases of clear violations of these terms.
            </p>
          </section>
        </div>
        
        <div className="terms-modal-footer">
          <button className="terms-accept-btn" onClick={onClose}>Understood</button>
        </div>
      </div>
    </div>
  );
}
