import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import accountService from '../../../services/accountService';
import '../../../styles/ForgotPassword.css';

const INITIAL_OTP = ['', '', '', '', '', ''];
const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>_\-]/;

function getErrorMsg(err, fallback) {
  const msg = err.response?.data?.message || err.response?.data;
  return typeof msg === 'string' ? msg : fallback;
}

export default function ForgotPassword() {

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const inputRefs = useRef([]);

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);


  const [step, setStep] = useState('email'); // 'email' | 'resetForm'
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(INITIAL_OTP);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (step === 'resetForm') setTimeout(() => inputRefs.current[0]?.focus(), 150);
  }, [step]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return showToast(language === 'vi' ? 'Vui lòng nhập địa chỉ email.' : 'Please enter your email address.', 'error');

    setLoading(true);
    try {
      await accountService.forgotPassword(trimmed);
      showToast(language === 'vi' ? 'Mã OTP đã được gửi đến email của bạn.' : 'OTP code sent to your email.', 'success');
      setStep('resetForm');
      setCountdown(60);
      setOtp([...INITIAL_OTP]);
    } catch (err) {
      showToast(getErrorMsg(err, language === 'vi' ? 'Email không tồn tại trong hệ thống.' : 'Email address not found.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    const next = [...INITIAL_OTP];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      await accountService.forgotPassword(email);
      showToast(language === 'vi' ? 'Mã OTP mới đã được gửi lại!' : 'New OTP code resent!', 'success');
      setCountdown(60);
      setOtp([...INITIAL_OTP]);
      inputRefs.current[0]?.focus();
    } catch {
      showToast(language === 'vi' ? 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.' : 'Failed to resend OTP.', 'error');
    } finally {
      setResending(false);
    }
  };

  const checks = {
    length: newPassword.length >= 8 && newPassword.length <= 50,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: SPECIAL_CHAR_REGEX.test(newPassword),
    match: newPassword !== '' && confirmPassword !== '' && newPassword === confirmPassword,
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      return showToast(language === 'vi' ? 'Vui lòng nhập đủ 6 chữ số mã OTP.' : 'Please enter all 6 digits of the OTP code.', 'error');
    }
    if (!newPassword.trim() || !confirmPassword.trim()) {
      return showToast(language === 'vi' ? 'Vui lòng nhập mật khẩu mới và xác nhận mật khẩu.' : 'Please enter both password fields.', 'error');
    }
    if (!isPasswordValid) {
      return showToast(language === 'vi' ? 'Mật khẩu chưa đáp ứng đủ tất cả các yêu cầu an toàn.' : 'Password does not meet all security requirements.', 'error');
    }

    setLoading(true);
    try {
      await accountService.resetPassword({ email, otp: otpCode, newPassword });
      showToast(language === 'vi' ? 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' : 'Password reset successful! Please log in.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(getErrorMsg(err, language === 'vi' ? 'Mã OTP không hợp lệ hoặc đã hết hạn.' : 'Invalid or expired OTP code.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const requirements = [
    { key: 'length', label: language === 'vi' ? 'Độ dài từ 8 đến 50 ký tự' : '8 to 50 characters' },
    { key: 'upper', label: language === 'vi' ? 'Chứa ít nhất 1 chữ cái viết hoa (A-Z)' : 'At least 1 uppercase letter (A-Z)' },
    { key: 'lower', label: language === 'vi' ? 'Chứa ít nhất 1 chữ cái viết thường (a-z)' : 'At least 1 lowercase letter (a-z)' },
    { key: 'number', label: language === 'vi' ? 'Chứa ít nhất 1 chữ số (0-9)' : 'At least 1 number (0-9)' },
    { key: 'special', label: language === 'vi' ? 'Chứa ít nhất 1 ký tự đặc biệt (!@#$%...)' : 'At least 1 special character (!@#$%...)' },
    { key: 'match', label: language === 'vi' ? 'Xác nhận mật khẩu phải trùng khớp' : 'Passwords must match' },
  ];

  const renderPasswordField = (label, id, value, setValue, show, toggleShow) => (
    <div className="fp-field-group">
      <label className="fp-field-label">{label}</label>
      <div className="fp-field-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          id={id}
          className="fp-field-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          disabled={loading}
        />
        <button type="button" className="fp-toggle-vis" onClick={toggleShow}>
          <span className="material-symbols-outlined">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="fp-page">
      <main className="fp-main">
        <div className="fp-card-wrapper">

          {/* STEP 1: EMAIL ENTRY */}
          {step === 'email' && (
            <div className="fp-glass-card fp-animate-in" key="email">
              <div className="fp-icon-wrap">
                <span className="material-symbols-outlined fp-icon">lock_reset</span>
              </div>
              <h1 className="fp-title">{t('forgot_password_page.title')}</h1>
              <p className="fp-subtitle">{t('forgot_password_page.subtitle')}</p>

              <form className="fp-form" onSubmit={handleEmailSubmit}>
                <div className="fp-floating-group">
                  <input
                    type="email"
                    id="fp-email"
                    className="fp-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                  <label htmlFor="fp-email" className="fp-float-label">{t('forgot_password_page.email_label')}</label>
                  <div className="fp-input-line" />
                </div>

                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? <span className="fp-spinner" /> : (language === 'vi' ? 'Gửi mã xác thực OTP' : 'Send OTP Code')}
                </button>
              </form>

              <div className="fp-footer-link">
                <Link to="/login" className="fp-back-link">
                  <span className="material-symbols-outlined fp-back-icon">arrow_back</span>
                  {t('forgot_password_page.back_to_login')}
                </Link>
              </div>
            </div>
          )}

          {/* STEP 2: UNIFIED OTP & NEW PASSWORD FORM */}
          {step === 'resetForm' && (
            <div className="fp-glass-card fp-glass-card--wide fp-animate-in" key="resetForm">
              <div className="fp-header-center">
                <div className="fp-icon-wrap fp-icon-wrap--otp">
                  <span className="material-symbols-outlined fp-icon">mark_email_read</span>
                </div>
                <h1 className="fp-title">{language === 'vi' ? 'Đặt lại mật khẩu' : 'Reset Your Password'}</h1>
                <p className="fp-subtitle">
                  {language === 'vi' ? 'Mã 6 chữ số đã được gửi tới ' : 'A 6-digit OTP code was sent to '}
                  <strong>{email}</strong>
                  <button
                    type="button"
                    className="fp-change-email-inline-btn"
                    onClick={() => {
                      setStep('email');
                      setOtp([...INITIAL_OTP]);
                    }}
                  >
                    ({language === 'vi' ? 'Đổi email khác' : 'Change Email'})
                  </button>
                </p>
              </div>

              <form className="fp-form" onSubmit={handleResetPasswordSubmit}>
                {/* 1. OTP INPUT BOXES */}
                <div className="fp-field-group">
                  <label className="fp-field-label">{language === 'vi' ? 'Mã xác thực OTP (6 chữ số)' : 'OTP Verification Code (6 digits)'}</label>
                  <div className="fp-otp-row">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => (inputRefs.current[i] = el)}
                        type="text"
                        className="fp-otp-input"
                        maxLength="1"
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        onPaste={handleOtpPaste}
                        required
                        disabled={loading}
                      />
                    ))}
                  </div>
                  <div className="fp-resend-area">
                    <span>{language === 'vi' ? 'Chưa nhận được mã?' : "Didn't receive code?"}</span>
                    <button
                      type="button"
                      className="fp-resend-btn"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || resending || loading}
                    >
                      {resending
                        ? (language === 'vi' ? 'Đang gửi...' : 'Resending...')
                        : countdown > 0
                        ? (language === 'vi' ? `Gửi lại sau (${countdown}s)` : `Resend in (${countdown}s)`)
                        : (language === 'vi' ? 'Bấm để gửi lại' : 'Resend Code')}
                    </button>
                  </div>
                </div>

                {/* 2. NEW PASSWORD & CONFIRM PASSWORD */}
                {renderPasswordField(
                  language === 'vi' ? 'Mật khẩu mới' : 'New Password',
                  'fp-new-password',
                  newPassword,
                  setNewPassword,
                  showPassword,
                  () => setShowPassword(v => !v)
                )}

                {renderPasswordField(
                  language === 'vi' ? 'Xác nhận mật khẩu mới' : 'Confirm New Password',
                  'fp-confirm-password',
                  confirmPassword,
                  setConfirmPassword,
                  showConfirmPassword,
                  () => setShowConfirmPassword(v => !v)
                )}

                {/* 3. PASSWORD STRENGTH CHECKLIST */}
                <div className="fp-req-box">
                  <p className="fp-req-title">{language === 'vi' ? 'Yêu cầu mật khẩu an toàn:' : 'Security Password Requirements:'}</p>
                  <ul className="fp-req-list">
                    {requirements.map(({ key, label }) => (
                      <li key={key} className={`fp-req-item ${checks[key] ? 'fp-req-valid' : ''}`}>
                        <span className="material-symbols-outlined fp-req-icon">
                          {checks[key] ? 'check_circle' : 'cancel'}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading
                    ? <span className="fp-spinner" />
                    : (language === 'vi' ? 'Xác nhận & Đổi mật khẩu' : 'Confirm & Reset Password')}
                </button>
              </form>

              <div className="fp-footer-link">
                <Link to="/login" className="fp-back-link">
                  <span className="material-symbols-outlined fp-back-icon">arrow_back</span>
                  {t('forgot_password_page.return_to_login')}
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
