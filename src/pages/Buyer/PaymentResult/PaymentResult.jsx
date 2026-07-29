import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import profileService from '../../../services/profileService';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const { language, formatCurrency } = useLanguage();
  const success = searchParams.get('success') === 'true';
  const rawMessage = searchParams.get('message');
  const paymentId = searchParams.get('paymentId') || '';
  const amount = searchParams.get('amount') || '';
  const transactionNo = searchParams.get('transactionNo') || '';
  const auctionId = searchParams.get('auctionId') || '';
  const { user, setUser } = useAuth();

  useEffect(() => {
    const refreshProfile = async () => {
      if (success && user) {
        try {
          const freshProfile = await profileService.getMyProfile();
          if (freshProfile) {
            const mergedProfile = {
              ...user,
              ...freshProfile,
              roles: freshProfile.roles || user?.roles || [],
              isPasswordSet: freshProfile.isPasswordSet ?? user?.isPasswordSet,
            };
            setUser(mergedProfile);
            localStorage.setItem('user', JSON.stringify(mergedProfile));
          }
        } catch (err) {
          console.error('Failed to refresh profile on payment success:', err);
        }
      }
    };
    refreshProfile();
  }, [success, user, setUser]);

  const displayMessage = (() => {
    if (!rawMessage) {
      return language === 'vi' ? 'Không có thông tin chi tiết về giao dịch.' : 'No transaction information is available.';
    }
    if (rawMessage === 'Payment completed successfully.') {
      return language === 'vi' ? 'Thanh toán hoàn tất thành công.' : rawMessage;
    }
    return rawMessage;
  })();

  const titleText = success
    ? (language === 'vi' ? 'Thanh toán Thành công' : 'Payment Successful')
    : (language === 'vi' ? 'Thanh toán Thất bại' : 'Payment Not Successful');

  const serviceId = searchParams.get('serviceId') || '';
  const orderType = searchParams.get('orderType') || '';
  const isSubscription = searchParams.get('type') === 'subscription' || paymentId.includes('sub_') || paymentId.includes('srv_') || !!serviceId || orderType === 'subscription';

  return (
    <div className="container animate-fade-in" style={{ padding: '60px 20px', minHeight: '60vh' }}>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          background: '#fff',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(22, 31, 24, 0.08)',
          border: `1px solid ${success ? '#cfe9d6' : '#f2d1d1'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: success ? '#e7f7ec' : '#fdecec',
              color: success ? '#1b7a3d' : '#b22a2a',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            {success ? 'OK' : 'X'}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#02241b' }}>
              {titleText}
            </h1>
            <p style={{ margin: '8px 0 0', color: '#5c706b' }}>{displayMessage}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginTop: '24px' }}>
          <div>
            <strong>{language === 'vi' ? 'Mã thanh toán:' : 'Payment ID:'}</strong> {paymentId || '-'}
          </div>
          <div>
            <strong>{language === 'vi' ? 'Số tiền:' : 'Amount:'}</strong>{' '}
            {amount ? (isNaN(amount) ? `${amount} VND` : formatCurrency(Number(amount))) : '-'}
          </div>
          <div>
            <strong>{language === 'vi' ? 'Mã giao dịch VNPay:' : 'VNPay Transaction No:'}</strong> {transactionNo || '-'}
          </div>
        </div>

        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {auctionId ? (
            <>
              <Link to={`/auction/${auctionId}`} className="btn btn-primary">
                {language === 'vi' ? 'Quay lại Đấu giá' : 'Back to Auction'}
              </Link>
              <Link to="/" className="btn btn-secondary">
                {language === 'vi' ? 'Về Trang chủ' : 'Back to Home'}
              </Link>
            </>
          ) : isSubscription ? (
            <>
              <Link to="/subscriptions" className="btn btn-primary">
                {language === 'vi' ? 'Quản lý Gói dịch vụ' : 'Manage Subscriptions'}
              </Link>
              <Link to="/" className="btn btn-secondary">
                {language === 'vi' ? 'Về Trang chủ' : 'Back to Home'}
              </Link>
            </>
          ) : (
            <>
              <Link to="/" className="btn btn-primary">
                {language === 'vi' ? 'Về Trang chủ' : 'Back to Home'}
              </Link>
              <Link to="/purchase-history" className="btn btn-secondary">
                {language === 'vi' ? 'Xem Lịch sử Mua hàng' : 'View Purchase History'}
              </Link>
            </>
          )}
          <Link to="/subscriptions" className="btn btn-secondary">
            {language === 'vi' ? 'Quản lý Gói dịch vụ' : 'Manage Subscriptions'}
          </Link>
        </div>
      </div>
    </div>
  );
}
