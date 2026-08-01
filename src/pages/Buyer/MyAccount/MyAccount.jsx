import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import '../../../styles/MyAccount.css';
import accountService from '../../../services/accountService';
import profileService from '../../../services/profileService';
import vietnamAddressService from '../../../services/vietnamAddressService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { forceLogout } from '../../../utils/authUtils';

export default function MyAccount() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const fileInputRef = useRef();

  const [username, setUsername] = useState(user?.username || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [street, setStreet] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [fullAddressNames, setFullAddressNames] = useState({
    province: '',
    district: '',
    ward: '',
  });

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  // Convert IDs into Human-readable Province, District, Ward names
  useEffect(() => {
    const fetchAddressNames = async () => {
      if (!provinceId && !districtId && !wardCode) {
        setFullAddressNames({ province: '', district: '', ward: '' });
        return;
      }
      try {
        let pName = '';
        let dName = '';
        let wName = '';

        const provinces = await vietnamAddressService.getProvinces();
        const p = provinces.find((x) => String(x.code) === String(provinceId));
        if (p) pName = p.name;

        if (provinceId) {
          const districts = await vietnamAddressService.getDistricts(provinceId);
          const d = districts.find((x) => String(x.code) === String(districtId));
          if (d) dName = d.name;
        }

        if (districtId) {
          const wards = await vietnamAddressService.getWards(districtId);
          const w = wards.find((x) => String(x.code) === String(wardCode));
          if (w) wName = w.name;
        }

        setFullAddressNames({
          province: pName,
          district: dName,
          ward: wName,
        });
      } catch (err) {
        console.error('Failed to fetch address names', err);
      }
    };

    fetchAddressNames();
  }, [provinceId, districtId, wardCode]);

  const isValidAvatarUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (
      !trimmed ||
      trimmed === 'Avatar' ||
      trimmed === 'Profile' ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed === '[object Object]'
    ) {
      return false;
    }
    return (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('/')
    );
  };

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadProfileDetail = async () => {
      setProfileLoading(true);
      try {
        const profile = await profileService.getMyProfile();
        const address = profile?.defaultAddress || null;

        setDefaultAddress(address);
        setUsername(profile?.username || '');
        setFirstName(profile?.firstName || '');
        setLastName(profile?.lastName || '');
        setEmail(profile?.email || '');
        setPhone(profile?.phone || '');
        setStreet(address?.street || '');
        setProvinceId(address?.provinceId ?? '');
        setDistrictId(address?.districtId ?? '');
        setWardCode(address?.wardCode || '');
        setReceiverName(address?.receiverName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim());
        setReceiverPhone(address?.receiverPhone || profile?.phone || '');
      } catch (err) {
        showToast(err?.response?.data || (language === 'vi' ? 'Không thể tải chi tiết hồ sơ.' : 'Failed to load profile details.'), 'error');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfileDetail();
  }, [user, showToast, language]);

  if (loading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{language === 'vi' ? 'Đang tải thông tin tài khoản...' : 'Loading account details...'}</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="profile-unauth-page animate-fade-in">
        <div className="unauth-card glass-panel text-center">
          <span className="unauth-icon">🔒</span>
          <h2>{language === 'vi' ? 'Truy cập bị từ chối' : 'Access Denied'}</h2>
          <p>{language === 'vi' ? 'Vui lòng đăng nhập để xem và quản lý tài khoản của bạn.' : 'Please log in to view and manage your account details.'}</p>
          <div className="unauth-actions">
            <Link to="/login" className="btn btn-primary">{language === 'vi' ? 'Đăng Nhập' : 'Sign In'}</Link>
            <Link to="/" className="btn btn-secondary">{language === 'vi' ? 'Trang Chủ' : 'Go to Home'}</Link>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return user.username ? user.username.slice(0, 2).toUpperCase() : 'U';
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast(language === 'vi' ? 'Đang tải ảnh lên...' : 'Uploading image...', 'info');
      const res = await accountService.uploadAvatar(file);
      if (res?.avatarUrl) {
        setUser((u) => {
          const updated = { ...u, avatarUrl: res.avatarUrl };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
        showToast(language === 'vi' ? 'Đã cập nhật ảnh đại diện.' : 'Profile image updated.', 'success');
      } else {
        showToast(language === 'vi' ? 'Tải ảnh thành công nhưng không nhận được link.' : 'Upload succeeded but no url returned.', 'warning');
      }
    } catch (err) {
      showToast(err?.response?.data || (language === 'vi' ? 'Không thể tải ảnh lên.' : 'Failed to upload image.'), 'error');
    }
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName) {
      showToast(language === 'vi' ? 'Tên không được để trống hoặc chỉ nhập khoảng trắng.' : 'First name cannot be empty or whitespace.', 'error');
      return;
    }

    if (!trimmedLastName) {
      showToast(language === 'vi' ? 'Họ không được để trống hoặc chỉ nhập khoảng trắng.' : 'Last name cannot be empty or whitespace.', 'error');
      return;
    }

    try {
      const updatedProfile = await profileService.updateMyProfile({
        username: username.trim(),
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: email.trim(),
        phone: trimmedPhone,
      });
      if (updatedProfile) {
        setUser((u) => {
          const updated = { ...u, ...updatedProfile };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
        setFirstName(updatedProfile.firstName ?? trimmedFirstName);
        setLastName(updatedProfile.lastName ?? trimmedLastName);
        setPhone(updatedProfile.phone ?? trimmedPhone);
        showToast(language === 'vi' ? 'Đã cập nhật thông tin cá nhân thành công!' : 'Profile updated successfully.', 'success');
      } else {
        throw new Error('Profile update returned no data.');
      }
    } catch (err) {
      showToast(err?.response?.data || (language === 'vi' ? 'Không thể cập nhật hồ sơ.' : 'Failed to update profile.'), 'error');
    }
  };

  const handleCancel = () => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  };

  const handleDeactivateAccount = async () => {
    const isAdmin = user?.roles?.some((r) => String(r).toLowerCase() === 'admin') || user?.primaryRole?.toLowerCase() === 'admin';
    if (isAdmin) {
      showToast(language === 'vi' ? 'Quản trị viên không thể tự vô hiệu hóa tài khoản.' : 'Administrators cannot deactivate their own accounts.', 'error');
      setShowDeactivateModal(false);
      return;
    }
    try {
      setDeactivateLoading(true);
      await accountService.deactivateMe();
      showToast(language === 'vi' ? 'Tài khoản của bạn đã bị vô hiệu hóa.' : 'Your account has been deactivated.', 'success');
      setShowDeactivateModal(false);
      forceLogout();
    } catch (err) {
      showToast(err?.response?.data || (language === 'vi' ? 'Không thể vô hiệu hóa tài khoản.' : 'Failed to deactivate account.'), 'error');
    } finally {
      setDeactivateLoading(false);
    }
  };

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-grid">
            
            {/* Left Column */}
            <div className="ma-col-left">
              
              {/* Page Header Card */}
              <div className="ma-card ma-header-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">person_search</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">{language === 'vi' ? 'Thông Tin Cá Nhân' : 'Personal Information'}</h1>
                    <p className="ma-subtitle">{language === 'vi' ? 'Xem thông tin tài khoản và địa chỉ mặc định của bạn' : 'Manage your account details and profile settings'}</p>
                  </div>
                </div>
              </div>

              {/* Personal Information Form Card */}
              <div className="ma-card ma-info-card">
                <h4 className="ma-card-title">{language === 'vi' ? 'Thông Tin Cơ Bản' : 'Basic Details'}</h4>
                {profileLoading && <p className="ma-inline-note">{language === 'vi' ? 'Đang tải dữ liệu hồ sơ...' : 'Loading latest profile data...'}</p>}
                <form className="ma-form" onSubmit={handleSaveChanges}>
                  <div className="ma-form-grid">
                    <div className="ma-form-group">
                      <label className="ma-label">{language === 'vi' ? 'Tên đăng nhập' : 'Username'}</label>
                      <input type="text" className="ma-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">{language === 'vi' ? 'Địa chỉ Email' : 'Email Address'}</label>
                      <input type="email" className="ma-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">{language === 'vi' ? 'Họ' : 'First Name'}</label>
                      <input type="text" className="ma-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">{language === 'vi' ? 'Tên' : 'Last Name'}</label>
                      <input type="text" className="ma-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">{language === 'vi' ? 'Số điện thoại' : 'Phone Number'}</label>
                      <input type="tel" className="ma-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>

                  <div className="ma-form-actions" style={{ marginTop: '20px', marginBottom: '28px' }}>
                    <button type="submit" className="ma-btn-primary">{language === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes'}</button>
                    <button type="button" className="ma-btn-secondary" onClick={handleCancel}>{language === 'vi' ? 'Hủy' : 'Cancel'}</button>
                  </div>

                  {/* Read-only Default Address Card */}
                  <div className="ma-section-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px' }}>
                    <div>
                      <h4 className="ma-card-title" style={{ margin: 0 }}>{language === 'vi' ? 'Địa Chỉ Mặc Định' : 'Default Address'}</h4>
                      <p className="ma-subtitle-small" style={{ margin: '4px 0 0' }}>{language === 'vi' ? 'Địa chỉ này dùng làm địa chỉ mặc định cho các đơn hàng của bạn.' : 'This address is used as default delivery location for your orders.'}</p>
                    </div>
                    <Link
                      to="/address-book"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: 'var(--color-secondary, #006a4e)',
                        textDecoration: 'none',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 106, 78, 0.08)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu_book</span>
                      {language === 'vi' ? 'Sổ địa chỉ ➔' : 'Address Book ➔'}
                    </Link>
                  </div>

                  {defaultAddress ? (
                    <div style={{ background: '#f8faf9', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(2, 36, 27, 0.08)', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', fontWeight: '700', color: '#02241b', flexWrap: 'wrap' }}>
                        <span className="material-symbols-outlined" style={{ color: '#006a4e' }}>person</span>
                        <span>{receiverName || `${firstName} ${lastName}`.trim() || user.username}</span>
                        <span className="material-symbols-outlined" style={{ color: '#006a4e', marginLeft: '12px' }}>call</span>
                        <span style={{ fontWeight: 600, color: '#2d3748' }}>{receiverPhone || phone || 'N/A'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: '#4a5568', lineHeight: 1.5 }}>
                        <span className="material-symbols-outlined" style={{ color: '#006a4e', marginTop: '2px', flexShrink: 0 }}>home_pin</span>
                        <span style={{ fontWeight: 500 }}>
                          {street || ''}{street ? ', ' : ''}
                          {fullAddressNames.ward ? `${fullAddressNames.ward}, ` : (wardCode ? `Ward ${wardCode}, ` : '')}
                          {fullAddressNames.district ? `${fullAddressNames.district}, ` : (districtId ? `District ${districtId}, ` : '')}
                          {fullAddressNames.province ? fullAddressNames.province : (provinceId ? `Province ${provinceId}` : '')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#f8faf9', padding: '16px 20px', borderRadius: '12px', border: '1px dashed rgba(2, 36, 27, 0.15)', textAlign: 'center', color: '#718096', marginBottom: '20px' }}>
                      <p>{language === 'vi' ? 'Chưa thiết lập địa chỉ mặc định. Bạn có thể thêm trong Sổ địa chỉ.' : 'No default address set. You can add one in your Address Book.'}</p>
                    </div>
                  )}
                </form>
              </div>

            </div>

            {/* Right Column */}
            <div className="ma-col-right">
              
              {/* Profile Photo Card */}
              <div className="ma-card">
                <h4 className="ma-card-title" style={{ marginBottom: '24px' }}>{language === 'vi' ? 'Ảnh Đại Diện' : 'Profile Photo'}</h4>
                <div className="ma-profile-photo-section" style={{ flexDirection: 'column', gap: '24px', alignItems: 'flex-start', marginBottom: 0 }}>
                  <div className="ma-photo-wrapper">
                    {isValidAvatarUrl(user?.avatarUrl) && !avatarError ? (
                      <img
                        src={user.avatarUrl}
                        alt="Profile"
                        className="ma-photo-img"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="ma-photo-placeholder">{getInitials()}</div>
                    )}
                  </div>
                    <div className="ma-photo-text">
                    <p className="ma-subtitle-small">{language === 'vi' ? 'Định dạng hỗ trợ: JPG, PNG (Tối đa 5MB)' : 'Accepted formats: JPG, PNG (Max 5MB)'}</p>
                    <button type="button" className="ma-link-btn" onClick={handleChooseImage}>{language === 'vi' ? 'Cập Nhật Ảnh' : 'Update Image'}</button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="ma-privacy-card" style={{ flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="material-symbols-outlined ma-privacy-icon fill-1">verified_user</span>
                  <h4 className="ma-privacy-title" style={{ margin: 0 }}>{language === 'vi' ? 'Bảo Mật & Riêng Tư' : 'Privacy & Security'}</h4>
                </div>
                <p className="ma-privacy-text" style={{ fontSize: '14px' }}>
                  {language === 'vi' ? 'RETRADE sử dụng mã hóa bảo vệ thông tin cá nhân của bạn. Chúng tôi không bao giờ chia sẻ dữ liệu nhạy cảm cho bên thứ ba khi chưa có sự đồng ý của bạn.' : 'RETRADE uses end-to-end encryption to protect your personal information. We never share your sensitive data with third parties without your explicit consent.'}
                </p>
              </div>

              {!(user?.roles?.some((r) => String(r).toLowerCase() === 'admin') || user?.primaryRole?.toLowerCase() === 'admin') && (
                <div className="ma-danger-card" style={{ flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-symbols-outlined ma-danger-icon">cancel</span>
                    <h4 className="ma-danger-title" style={{ margin: 0 }}>{language === 'vi' ? 'Vô Hiệu Hóa Tài Khoản' : 'Deactivate Account'}</h4>
                  </div>
                  <p className="ma-danger-text" style={{ fontSize: '14px' }}>
                    {language === 'vi' ? 'Nếu không còn nhu cầu sử dụng ReTrade, bạn có thể vô hiệu hóa tài khoản. Bạn sẽ bị đăng xuất ngay lập tức.' : 'If you no longer want to use ReTrade, you can deactivate your account. You will be logged out immediately and receive a confirmation email.'}
                  </p>
                  <button type="button" className="ma-danger-btn" onClick={() => setShowDeactivateModal(true)}>
                    {language === 'vi' ? 'Vô Hiệu Hóa Tài Khoản' : 'Deactivate Account'}
                  </button>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      {showDeactivateModal && (
        <div className="ma-deactivate-overlay" onClick={() => !deactivateLoading && setShowDeactivateModal(false)}>
          <div className="ma-deactivate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-deactivate-header">
              <div>
                <p className="ma-deactivate-kicker">{language === 'vi' ? 'Tài Khoản Không Hoạt Động' : 'Inactive User'}</p>
                <h3>{language === 'vi' ? 'Vô hiệu hóa tài khoản của bạn?' : 'Deactivate your account?'}</h3>
              </div>
              <button type="button" className="ma-deactivate-close" onClick={() => setShowDeactivateModal(false)} disabled={deactivateLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="ma-deactivate-body">
              <p>
                {language === 'vi' ? 'Tài khoản của bạn sẽ bị chuyển sang trạng thái Không hoạt động và đăng xuất ngay lập tức.' : 'Your account will be set to Inactive, you will be logged out immediately, and you will receive a confirmation email.'}
              </p>
              <div className="ma-deactivate-note">
                {language === 'vi' ? 'Liên hệ hỗ trợ nếu bạn cần sự trợ giúp.' : 'You can ask support by replying to the email if you have any questions.'}
              </div>
            </div>

            <div className="ma-deactivate-footer">
              <button type="button" className="ma-btn-secondary" onClick={() => setShowDeactivateModal(false)} disabled={deactivateLoading}>
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button type="button" className="ma-danger-btn" onClick={handleDeactivateAccount} disabled={deactivateLoading}>
                {deactivateLoading ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...') : (language === 'vi' ? 'Xác Nhận Vô Hiệu Hóa' : 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
