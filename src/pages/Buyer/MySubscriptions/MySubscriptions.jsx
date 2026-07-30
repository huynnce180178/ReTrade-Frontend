import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import subscriptionService from '../../../services/subscriptionService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/MySubscriptions.css';

export default function MySubscriptions() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allPackages, setAllPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [mySubs, packages] = await Promise.all([
          subscriptionService.getMyActiveSubscriptions(),
          subscriptionService.getAll()
        ]);

        const subsList = Array.isArray(mySubs) ? mySubs : (mySubs?.value || mySubs?.items || []);
        const pkgsList = Array.isArray(packages) ? packages : (packages?.value || packages?.items || []);

        setActiveSubscriptions(subsList);
        setAllPackages(pkgsList);
      } catch (err) {
        showToast(typeof err?.response?.data === 'string' ? err.response.data : (isVi ? 'Không thể tải lịch sử gói dịch vụ.' : 'Failed to load subscription history.'), 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, showToast, isVi]);

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{isVi ? 'Đang tải các gói hội viên đang hoạt động...' : 'Loading active subscriptions...'}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const getPackageDetails = (serviceId) => {
    return allPackages.find(p => p.serviceId === serviceId) || null;
  };

  const translatePackageName = (name) => {
    if (!isVi || !name) return name;
    if (name === 'Discount Voucher Package' || name === 'Gói Voucher Giảm Giá') return 'Gói Voucher Giảm Giá';
    if (name === 'VIP Seller Package' || name === 'Gói Người Bán VIP') return 'Gói Người Bán VIP';
    return name;
  };

  const translateTargetRole = (role) => {
    if (!role) return isVi ? 'Người mua' : 'Buyer';
    if (role.toLowerCase() === 'buyer') return isVi ? 'Người mua' : 'Buyer';
    if (role.toLowerCase() === 'seller') return isVi ? 'Người bán' : 'Seller';
    return role;
  };

  const translateBenefits = (desc) => {
    if (!isVi || !desc) return desc;
    if (desc.includes('Receive 30 exclusive discount & freeship vouchers')) {
      return 'Nhận 30 voucher giảm giá & miễn phí vận chuyển độc quyền. Có hiệu lực trong 30 ngày sắm sửa. Tiết kiệm nhiều hơn mỗi tuần.';
    }
    return desc;
  };

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-card ma-header-card">
            <div className="ma-header-info">
              <div className="ma-header-icon">
                <span className="material-symbols-outlined">workspace_premium</span>
              </div>
              <div>
                <h1 className="ma-headline">{isVi ? 'Gói Dịch Vụ Của Tôi' : 'My Subscriptions'}</h1>
                <p className="ma-subtitle">{isVi ? 'Xem các gói hội viên đang hoạt động, thời hạn và quyền lợi tài khoản của bạn' : 'View active membership plans, duration, and benefits attached to your account'}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="sub-loading-card glass-panel">
              <span className="btn-spinner"></span>
              <p>{isVi ? 'Đang tải thông tin gói dịch vụ...' : 'Fetching active subscriptions...'}</p>
            </div>
          ) : activeSubscriptions.length === 0 ? (
            <div className="sub-empty-card glass-panel text-center">
              <span className="material-symbols-outlined empty-sub-icon">card_membership</span>
              <h3>{isVi ? 'Chưa Có Gói Dịch Vụ Nào' : 'No Active Subscriptions'}</h3>
              <p>{isVi ? 'Bạn chưa đăng ký gói hội viên hoặc gói dịch vụ nào.' : "You haven't subscribed to any membership packages yet."}</p>
            </div>
          ) : (
            <div className="my-sub-list">
              {activeSubscriptions.map((sub) => {
                const pkg = getPackageDetails(sub.serviceId);
                const startDateStr = sub.startDate 
                  ? new Date(sub.startDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }) 
                  : 'N/A';
                const endDateStr = sub.endDate 
                  ? new Date(sub.endDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }) 
                  : 'N/A';

                let daysRemaining = 0;
                if (sub.endDate) {
                  const diff = new Date(sub.endDate) - new Date();
                  daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                }

                return (
                  <div key={sub.userSubId || sub.serviceId} className="my-sub-card glass-panel animate-fade-in">
                    <div className="my-sub-header">
                      <div className="my-sub-title-group">
                        <div className="my-sub-icon">
                          <span className="material-symbols-outlined">workspace_premium</span>
                        </div>
                        <div>
                          <h2 className="my-sub-name">{translatePackageName(pkg?.name || sub.serviceId)}</h2>
                          <span className="my-sub-badge active">
                            <span className="dot"></span> {isVi ? 'ĐANG HOẠT ĐỘNG' : 'ACTIVE'}
                          </span>
                        </div>
                      </div>
                      <div className="my-sub-remaining">
                        <span className="rem-num">{daysRemaining}</span>
                        <span className="rem-lbl">{isVi ? 'NGÀY CÒN LẠI' : 'days left'}</span>
                      </div>
                    </div>

                    <div className="my-sub-details-grid">
                      <div className="sub-detail-item">
                        <span className="lbl">{isVi ? 'Đối tượng:' : 'Target Role:'}</span>
                        <span className="val">{translateTargetRole(pkg?.targetRole)}</span>
                      </div>
                      <div className="sub-detail-item">
                        <span className="lbl">{isVi ? 'Ngày bắt đầu:' : 'Start Date:'}</span>
                        <span className="val">{startDateStr}</span>
                      </div>
                      <div className="sub-detail-item">
                        <span className="lbl">{isVi ? 'Ngày hết hạn:' : 'Expiration Date:'}</span>
                        <span className="val">{endDateStr}</span>
                      </div>
                    </div>

                    {pkg?.benefitsDescription && (
                      <div className="my-sub-benefits">
                        <h4>{isVi ? 'Quyền Lợi Gói Dịch Vụ' : 'Package Benefits'}</h4>
                        <p>{translateBenefits(pkg.benefitsDescription)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
