import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import profileService from '../../../services/profileService';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const { t, language, formatCurrency } = useLanguage();
  const { showToast } = useToast();
  const success = searchParams.get('success') === 'true';
  const rawMessage = searchParams.get('message');
  const responseCode = searchParams.get('responseCode') || '';
  const paymentId = searchParams.get('paymentId') || '';
  const amount = searchParams.get('amount') || '';
  const transactionNo = searchParams.get('transactionNo') || '';
  const auctionId = searchParams.get('auctionId') || '';
  const orderId = searchParams.get('orderId') || '';
  const serviceId = searchParams.get('serviceId') || '';
  const orderType = searchParams.get('orderType') || '';
  const { user, setUser } = useAuth();

  const profileRefreshedRef = React.useRef(false);

  const displayMessage = (() => {
    if (responseCode) {
      const translatedCode = t(`vnpay_codes.${responseCode}`);
      if (translatedCode && translatedCode !== `vnpay_codes.${responseCode}`) {
        return translatedCode;
      }
    }
    if (rawMessage === 'Payment completed successfully.') {
      return t('vnpay_codes.00');
    }
    if (!success) {
      return t('vnpay_codes.default_failed');
    }
    return rawMessage || t('payment_result.no_info');
  })();

  const titleText = success
    ? t('payment_result.title_success')
    : t('payment_result.title_failed');

  useEffect(() => {
    if (profileRefreshedRef.current) return;
    profileRefreshedRef.current = true;

    // Toast notification for user
    if (success) {
      showToast(displayMessage, 'success');
    } else {
      showToast(displayMessage, 'error');
    }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {success ? '✓' : '✕'}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#02241b' }}>
              {titleText}
            </h1>
            <p style={{ margin: '8px 0 0', color: success ? '#1b7a3d' : '#b22a2a', fontWeight: 600 }}>
              {displayMessage}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginTop: '24px', background: '#f9fafb', padding: '16px', borderRadius: '12px' }}>
          <div>
            <strong>{t('payment_result.payment_id')}:</strong> {paymentId || '-'}
          </div>
          <div>
            <strong>{t('payment_result.amount')}:</strong>{' '}
            {amount ? (isNaN(amount) ? `${amount} VND` : formatCurrency(Number(amount))) : '-'}
          </div>
          {transactionNo && (
            <div>
              <strong>{t('payment_result.vnpay_trans_no')}:</strong> {transactionNo}
            </div>
          )}
          {responseCode && (
            <div>
              <strong>{t('payment_result.response_code')}:</strong>{' '}
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {responseCode}
              </span>
            </div>
          )}
        </div>

        <div style={{ marginTop: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!success && orderId && (
            <Link to={`/purchase-history/${orderId}`} className="btn btn-primary">
              {t('payment_result.try_again')}
            </Link>
          )}

          {auctionId ? (
            <>
              <Link to={`/auction/${auctionId}`} className="btn btn-primary">
                {t('payment_result.back_to_auction')}
              </Link>
              <Link to="/" className="btn btn-secondary">
                {t('payment_result.back_to_home')}
              </Link>
            </>
          ) : isSubscription ? (
            <>
              <Link to="/my-subscriptions" className="btn btn-primary">
                {t('payment_result.manage_subscriptions')}
              </Link>
              <Link to="/" className="btn btn-secondary">
                {t('payment_result.back_to_home')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/purchase-history" className="btn btn-primary">
                {t('payment_result.view_purchase_history')}
              </Link>
              <Link to="/" className="btn btn-secondary">
                {t('payment_result.back_to_home')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
