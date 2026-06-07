import React from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import '../../../styles/MyAccount.css';

export default function PurchaseHistory() {
  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="ma-col-left">
              <div className="ma-card ma-header-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">Purchase History</h1>
                    <p className="ma-subtitle">View and manage your past orders and receipts</p>
                  </div>
                </div>
              </div>

              <div className="ma-card ma-info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <div style={{ textAlign: 'center', color: '#717975' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>shopping_bag</span>
                  <p>You haven't made any purchases yet.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
