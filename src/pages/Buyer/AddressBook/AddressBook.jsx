import React from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import '../../../styles/MyAccount.css';

export default function AddressBook() {
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
                    <span className="material-symbols-outlined">location_on</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">Address Book</h1>
                    <p className="ma-subtitle">Manage your shipping and billing addresses</p>
                  </div>
                </div>
                <button className="ma-btn-primary" style={{ padding: '12px 24px' }}>Add New Address</button>
              </div>

              <div className="ma-card ma-info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <div style={{ textAlign: 'center', color: '#717975' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>home_work</span>
                  <p>You haven't added any addresses yet.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
