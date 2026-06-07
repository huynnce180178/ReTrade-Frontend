import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../styles/Support.css';

export default function Support() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabParam || 'faq');
  const [activeFaqIndex, setActiveFaqIndex] = useState(null);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  const toggleFaq = (index) => {
    if (activeFaqIndex === index) {
      setActiveFaqIndex(null);
    } else {
      setActiveFaqIndex(index);
    }
  };

  const faqItems = [
    {
      question: "How does the auction deposit work?",
      answer: "To participate in a live auction, buyers are required to place a deposit via VNPay. This ensures bidding responsibility and reduces fake bids. Your maximum bid amount will be restricted according to your deposit value. If you do not win the auction, your deposit will be refunded automatically."
    },
    {
      question: "Does RETRADE handle product shipping?",
      answer: "No, RETRADE is a marketplace platform connecting buyers and sellers. We do not handle the physical shipping of items. Buyers and sellers are responsible for communicating and arranging the shipping details themselves after a successful transaction."
    },
    {
      question: "How do I negotiate a price with a seller?",
      answer: "You can use our built-in Price Negotiation Workflow. Simply navigate to the product page and submit a price offer. The seller will be notified and can either accept, decline, or respond with a counter-offer until an agreement is reached."
    },
    {
      question: "What payment methods are supported?",
      answer: "Currently, RETRADE exclusively supports VNPay for escrow payments, auction deposits, and seller subscription packages. We do not support other payment gateways or international transactions at this time."
    },
    {
      question: "How does the AI-Powered Product Search work?",
      answer: "Our integrated AI assistant allows you to search for products using natural language. Just type what you're looking for as if you were talking to a human, and the AI will analyze your inquiry to recommend the most suitable products from our marketplace."
    }
  ];

  return (
    <div className="support-container container">
      <div className="support-header">
        <h1>RETRADE Support Center</h1>
        <p>We're here to help you trade securely and efficiently.</p>
      </div>

      <div className="support-nav">
        <button 
          className={`support-nav-btn ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => handleTabChange('faq')}
        >
          FAQ
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => handleTabChange('safety')}
        >
          Safety Tips
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => handleTabChange('terms')}
        >
          Terms of Service
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => handleTabChange('privacy')}
        >
          Privacy Policy
        </button>
      </div>

      <div className="support-content-box glass-panel">
        {activeTab === 'faq' && (
          <div>
            <h2>Frequently Asked Questions</h2>
            <div className="support-accordion">
              {faqItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`support-accordion-item ${activeFaqIndex === idx ? 'active' : ''}`}
                >
                  <button 
                    className="support-accordion-header"
                    onClick={() => toggleFaq(idx)}
                  >
                    {item.question}
                    <svg className="support-accordion-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  <div className="support-accordion-content">
                    <p>{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="support-contact-cta">
              <h3>Still have questions?</h3>
              <p>Our AI Customer Support is available, but please note it cannot directly resolve disputes between buyers and sellers.</p>
              <a href="mailto:support@retrade.com" className="btn btn-primary">Contact Support</a>
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div>
            <h2>Safety Tips for Trading</h2>
            <p>At RETRADE, your security is our priority. Please follow these guidelines to ensure a safe and smooth transaction experience.</p>
            
            <h3>1. Check Seller Profiles</h3>
            <ul>
              <li>Always review the seller's public profile before making a purchase or placing a bid.</li>
              <li>Look for high star ratings and read reviews left by other buyers.</li>
              <li>Be cautious of new accounts selling high-value items without any prior transaction history.</li>
            </ul>

            <h3>2. Secure Your Payments</h3>
            <ul>
              <li>Only use our integrated VNPay system for auction deposits and escrow payments.</li>
              <li><strong>Never</strong> transfer money directly to a seller's personal bank account or use third-party payment links outside the RETRADE platform.</li>
              <li>If a seller insists on off-platform payments, please report them immediately.</li>
            </ul>

            <h3>3. Communicating Safely</h3>
            <ul>
              <li>Keep all negotiations and communications within the RETRADE platform.</li>
              <li>Do not share sensitive personal information, such as your ID card, passwords, or financial details in the chat.</li>
            </ul>

            <h3>4. Arranging Shipping & Meetups</h3>
            <ul>
              <li>Because RETRADE does not handle shipping, ensure you agree on clear delivery terms with the seller/buyer before finalizing the transaction.</li>
              <li>If arranging an in-person meetup to exchange goods, always choose a well-lit, public location during daylight hours.</li>
              <li>Consider bringing a friend along for high-value exchanges.</li>
            </ul>

            <h3>5. Participating in Auctions</h3>
            <ul>
              <li>Review the item details thoroughly before making a deposit.</li>
              <li>Remember that your maximum bid is constrained by your deposit. Plan your bidding strategy accordingly.</li>
              <li>Do not engage in fake bidding or attempt to manipulate auction prices, as this will result in account suspension and loss of deposit.</li>
            </ul>

            <div className="support-contact-cta">
              <h3>Notice Suspicious Activity?</h3>
              <p>Use the "Report User" feature on their profile. Reports are strictly confidential.</p>
              <a href="#" className="btn btn-primary">Report an Issue</a>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div>
            <h2>Terms of Service</h2>
            <p>Last Updated: August 2026</p>
            
            <h3>1. Introduction</h3>
            <p>Welcome to RETRADE, the premier Second-Hand Trading System. By accessing or using our platform, you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our services.</p>

            <h3>2. User Accounts & Registration</h3>
            <p>To buy, sell, or participate in auctions, you must register an account and verify your email. You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate and complete information during registration.</p>

            <h3>3. Buyer Responsibilities & Auction Rules</h3>
            <ul>
              <li><strong>Auction Deposits:</strong> Buyers must place a specific deposit via VNPay before joining an auction. Your maximum bid cannot exceed the deposit value.</li>
              <li><strong>Fake Bidding:</strong> Engaging in fake bidding or auction manipulation is strictly prohibited and will result in the forfeiture of your deposit and account suspension.</li>
              <li><strong>Purchasing:</strong> Buyers must honor their commitments upon winning an auction or successfully negotiating a price.</li>
            </ul>

            <h3>4. Seller Responsibilities & Subscriptions</h3>
            <ul>
              <li><strong>Listing Accuracy:</strong> Sellers must accurately describe items, including their condition and defects.</li>
              <li><strong>Subscriptions:</strong> To list products, sellers must purchase and maintain an active subscription package.</li>
              <li><strong>Fulfillment:</strong> Sellers are responsible for coordinating shipping and delivery with buyers, as RETRADE does not handle logistics.</li>
            </ul>

            <h3>5. Payment and Escrow</h3>
            <p>RETRADE utilizes VNPay for secure escrow payments and auction deposits. The platform does not support other payment gateways. By using VNPay, you also agree to their respective terms of service.</p>

            <h3>6. Limitations of Liability</h3>
            <p>RETRADE is an online marketplace connecting independent buyers and sellers. We do not own the items listed and are not responsible for their quality or safety. Furthermore, our AI Customer Support and administration cannot directly resolve disputes between buyers and sellers, though we provide a platform for communication and negotiation.</p>

            <h3>7. Termination</h3>
            <p>We reserve the right to suspend or terminate your account at any time if you violate these terms, engage in fraudulent activity, or fail to adhere to our Luxury Standards Policy.</p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h2>Privacy Policy</h2>
            <p>Your privacy is important to us. This Privacy Policy outlines how RETRADE collects, uses, and protects your data when you use our platform.</p>

            <h3>1. Information We Collect</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, and profile details required for registration and verification.</li>
              <li><strong>Transaction Data:</strong> Bidding history, auction deposits, subscription purchases, and payment logs (processed securely via VNPay).</li>
              <li><strong>User Activity:</strong> Search history, favorite categories, and wishlisted items to provide personalized recommendations.</li>
            </ul>

            <h3>2. How We Use Your Information</h3>
            <p>We use the collected information to:</p>
            <ul>
              <li>Facilitate transactions, negotiations, and live auctions.</li>
              <li>Enhance your search experience using our AI-Powered Product Search.</li>
              <li>Provide personalized product recommendations based on your preferences.</li>
              <li>Send important system announcements and notifications.</li>
            </ul>

            <h3>3. Data Sharing and Confidentiality</h3>
            <ul>
              <li><strong>Public Profiles:</strong> Seller ratings and active listings are visible to the public to establish credibility.</li>
              <li><strong>Reporting Feature:</strong> If you use the "Report" feature, your report is strictly confidential. The reported user will not be notified that you reported them.</li>
              <li><strong>Third Parties:</strong> We do not sell your personal data. Data is only shared with trusted partners (like VNPay) when strictly necessary to process your transactions.</li>
            </ul>

            <h3>4. Data Security</h3>
            <p>We implement robust security measures to protect your account information. However, please be aware that no electronic transmission over the internet can be guaranteed as 100% secure. You are responsible for keeping your login credentials confidential.</p>

            <h3>5. Your Rights</h3>
            <p>You have the right to access, update, or delete your personal information within the Account Management settings. If you need assistance with data removal, please contact our support team.</p>
          </div>
        )}
      </div>
    </div>
  );
}
