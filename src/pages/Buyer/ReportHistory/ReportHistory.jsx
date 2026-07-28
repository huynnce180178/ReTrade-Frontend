import React from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import ReportHistoryComponent from '../../../components/ReportHistory/ReportHistory';
import '../../../styles/MyAccount.css';

export default function ReportHistory() {
  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />
        <main className="ma-main">
          <ReportHistoryComponent />
        </main>
      </div>
    </div>
  );
}
