import React, { useState } from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import accountService from '../../../services/accountService';
import { useToast } from '../../../context/ToastContext';
import { forceLogout } from '../../../utils/authUtils';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/MyAccount.css';

export default function ChangePassword() {
  const { showToast } = useToast();
  const { user, setUser, logout } = useAuth();
  const { t, language } = useLanguage();
  const isPasswordSet = user?.isPasswordSet !== false;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>_\-]/;

  const checks = {
    length: newPassword.length >= 8 && newPassword.length <= 50,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: SPECIAL_CHAR_REGEX.test(newPassword),
    match: newPassword !== '' && confirmPassword !== '' && newPassword === confirmPassword,
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanOldPassword = oldPassword.trim();
    const cleanNewPassword = newPassword.trim();

    if ((isPasswordSet && !cleanOldPassword) || !cleanNewPassword || !confirmPassword) {
      showToast(language === 'vi' ? 'Vui lòng nhập đầy đủ các trường.' : 'All fields are required.', 'error');
      return;
    }
    if (!isPasswordValid) {
      showToast(language === 'vi' ? 'Vui lòng đáp ứng đầy đủ yêu cầu mật khẩu.' : 'Please satisfy all password requirements.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isPasswordSet) {
        await accountService.changePassword(cleanOldPassword, cleanNewPassword);
      } else {
        await accountService.setPassword(cleanNewPassword);
      }
      showToast(
        isPasswordSet
          ? (language === 'vi' ? 'Đổi mật khẩu thành công. Đang đăng xuất...' : 'Password changed successfully. Logging out...')
          : (language === 'vi' ? 'Đặt mật khẩu thành công. Đang đăng xuất...' : 'Password set successfully. Logging out...'),
        'success'
      );
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        if (logout) logout();
        forceLogout();
      }, 1000);
    } catch (err) {
      const serverMsg = err?.response?.data?.message || err?.response?.data;
      showToast(
        typeof serverMsg === 'string'
          ? serverMsg
          : (language === 'vi' ? `Không thể ${isPasswordSet ? 'đổi' : 'đặt'} mật khẩu.` : `Failed to ${isPasswordSet ? 'change' : 'set'} password.`),
        'error'
      );
      setLoading(false);
    }
  };


  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-grid">
            
            {/* Form Column */}
            <div className="ma-col-left">
              <div className="ma-card ma-header-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">shield_lock</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">{isPasswordSet ? (language === 'vi' ? 'Đổi Mật Khẩu' : 'Change Password') : (language === 'vi' ? 'Tạo Mật Khẩu' : 'Set Password')}</h1>
                    <p className="ma-subtitle">
                      {isPasswordSet
                        ? (language === 'vi' ? 'Cập nhật mật khẩu để bảo vệ tài khoản của bạn an toàn.' : 'Update your password to keep your account secure.')
                        : (language === 'vi' ? 'Tạo mật khẩu cho tài khoản để đăng nhập bằng tên người dùng/mật khẩu vào lần sau.' : 'Create a password for your account to sign in using username/password next time.')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="ma-card ma-info-card">
                <form className="ma-form" onSubmit={handleSubmit}>
                  {/* Current Password */}
                  {isPasswordSet && (
                    <div className="ma-form-group" style={{ marginBottom: '24px' }}>
                      <label className="ma-label">{language === 'vi' ? 'Mật Khẩu Hiện Tại' : 'Current Password'}</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="ma-input"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          required
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'rgba(65, 72, 69, 0.6)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                            {showCurrentPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* New Password */}
                  <div className="ma-form-group" style={{ marginBottom: '24px' }}>
                    <label className="ma-label">{language === 'vi' ? 'Mật Khẩu Mới' : 'New Password'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        className="ma-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(65, 72, 69, 0.6)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {showNewPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="ma-form-group" style={{ marginBottom: '24px' }}>
                    <label className="ma-label">{language === 'vi' ? 'Xác Nhận Mật Khẩu Mới' : 'Confirm New Password'}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="ma-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(65, 72, 69, 0.6)',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                          {showConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="ma-form-actions">
                    <button type="submit" className="ma-btn-primary" disabled={loading}>
                      {loading
                        ? (isPasswordSet ? (language === 'vi' ? 'Đang lưu...' : 'Saving Changes...') : (language === 'vi' ? 'Đang thiết lập...' : 'Setting Password...'))
                        : (isPasswordSet ? (language === 'vi' ? 'Lưu Thay Đổi' : 'Save Changes') : (language === 'vi' ? 'Tạo Mật Khẩu' : 'Set Password'))}
                    </button>
                    <button type="button" className="ma-btn-secondary" onClick={() => { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                      {language === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Notice */}
              <div className="ma-privacy-card" style={{ borderLeft: '4px solid #1b6b51', borderRadius: '4px 12px 12px 4px' }}>
                <span className="material-symbols-outlined ma-privacy-icon">info</span>
                <div>
                  <h4 className="ma-privacy-title">{language === 'vi' ? 'Lưu Ý Bảo Mật' : 'Security Notice'}</h4>
                  <p className="ma-privacy-text" style={{ fontSize: '14px', margin: 0 }}>
                    {language === 'vi' ? 'Thay đổi mật khẩu sẽ đăng xuất tất cả các phiên hoạt động khác của bạn để bảo mật. Bạn sẽ cần đăng nhập lại trên các thiết bị khác.' : 'Changing your password will sign you out from other active sessions for security purposes. You will need to log back in on all other devices.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Requirements Column */}
            <div className="ma-col-right">
              <div className="ma-card">
                <h4 className="ma-card-title" style={{ marginBottom: '24px' }}>{language === 'vi' ? 'Yêu Cầu Mật Khẩu' : 'Password Requirements'}</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: checks.length ? '#1b6b51' : '#717975', transition: 'color 0.2s' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: checks.length ? '#1b6b51' : '#717975', fontVariationSettings: checks.length ? "'FILL' 1" : "'FILL' 0", transition: 'color 0.2s' }}>
                      {checks.length ? 'check_circle' : 'circle'}
                    </span>
                    {language === 'vi' ? 'Ít nhất 8 ký tự' : '8+ characters'}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: checks.upper ? '#1b6b51' : '#717975', transition: 'color 0.2s' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: checks.upper ? '#1b6b51' : '#717975', fontVariationSettings: checks.upper ? "'FILL' 1" : "'FILL' 0", transition: 'color 0.2s' }}>
                      {checks.upper ? 'check_circle' : 'circle'}
                    </span>
                    {language === 'vi' ? 'Ít nhất một chữ in hoa' : 'One uppercase letter'}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: checks.lower ? '#1b6b51' : '#717975', transition: 'color 0.2s' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: checks.lower ? '#1b6b51' : '#717975', fontVariationSettings: checks.lower ? "'FILL' 1" : "'FILL' 0", transition: 'color 0.2s' }}>
                      {checks.lower ? 'check_circle' : 'circle'}
                    </span>
                    {language === 'vi' ? 'Ít nhất một chữ in thường' : 'One lowercase letter'}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: checks.number ? '#1b6b51' : '#717975', transition: 'color 0.2s' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: checks.number ? '#1b6b51' : '#717975', fontVariationSettings: checks.number ? "'FILL' 1" : "'FILL' 0", transition: 'color 0.2s' }}>
                      {checks.number ? 'check_circle' : 'circle'}
                    </span>
                    {language === 'vi' ? 'Ít nhất một chữ số' : 'One number'}
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: checks.special ? '#1b6b51' : '#717975', transition: 'color 0.2s' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: checks.special ? '#1b6b51' : '#717975', fontVariationSettings: checks.special ? "'FILL' 1" : "'FILL' 0", transition: 'color 0.2s' }}>
                      {checks.special ? 'check_circle' : 'circle'}
                    </span>
                    {language === 'vi' ? 'Ít nhất một ký tự đặc biệt' : 'One special character'}
                  </li>
                </ul>
              </div>

              <div className="ma-pro-tip-card">
                <div className="ma-pro-tip-content">
                  <div className="ma-pro-tip-header">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '6px' }}>tips_and_updates</span>
                    {language === 'vi' ? 'MẸO BẢO MẬT' : 'PRO TIP'}
                  </div>
                  <p className="ma-pro-tip-text" style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)' }}>
                    {language === 'vi' ? 'Sử dụng sự kết hợp giữa các từ và ký tự dễ nhớ với bạn nhưng người khác khó có thể đoán được.' : 'Use a combination of words and characters that are easy for you to remember but hard for others to guess.'}
                  </p>
                </div>
                <div className="ma-pro-tip-glow"></div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
