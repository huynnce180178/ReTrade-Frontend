import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/Register.css';
import VerifyModal from '../../../components/VerifyModal/VerifyModal';
import TermsModal from '../../../components/TermsModal/TermsModal';
import bgRegister from '../../../assets/background-register.png';

const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>-]/;

export default function Register() {
  const { user, register, googleLogin, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [googleLoading, setGoogleLoading] = useState(false);
  
  const [showTerms, setShowTerms] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    roleId: 2,
    agreed: false
  });

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleVerifyClose = () => {
    setShowVerifyModal(false);
  };

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const doGoogleLogin = googleLogin || loginWithGoogle;
        const result = await doGoogleLogin(tokenResponse);
        if (result.success) {
          showToast(t('toast.register_success'), 'success');
          navigate('/');
        } else {
          const rawErr = typeof result.error === 'string' ? result.error : (result.error?.message || result.error?.title || JSON.stringify(result.error));
          showToast(rawErr || t('common.error_occurred'), 'error');
        }
      } catch (err) {
        console.error('Google register error:', err);
        const msg = err.response?.data?.message || err.response?.data || err.message || t('common.error_occurred');
        showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      showToast(t('common.error_occurred'), 'error');
      setGoogleLoading(false);
    },
    flow: 'implicit',
    scope: 'openid email profile',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = formData.username.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedFirstName = formData.firstName.trim();
    const trimmedLastName = formData.lastName.trim();
    const password = formData.password;

    if (!trimmedUsername || !trimmedEmail || !password.trim() || !formData.confirmPassword.trim()) {
      showToast(t('validation.required'), 'error');
      return;
    }
    
    if (!formData.agreed) {
      showToast(language === 'vi' ? 'Vui lòng đồng ý với Điều khoản & Chính sách dịch vụ.' : 'Please agree to the Terms of Service.', 'error');
      return;
    }

    if (password.length < 8 || password.length > 50) {
      showToast(language === 'vi' ? 'Mật khẩu phải dài từ 8 đến 50 ký tự.' : 'Password must be 8 to 50 characters long.', 'error');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast(language === 'vi' ? 'Mật khẩu phải có ít nhất 1 chữ cái viết hoa.' : 'Password must contain at least 1 uppercase letter.', 'error');
      return;
    }
    if (!/[a-z]/.test(password)) {
      showToast(language === 'vi' ? 'Mật khẩu phải có ít nhất 1 chữ cái viết thường.' : 'Password must contain at least 1 lowercase letter.', 'error');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast(language === 'vi' ? 'Mật khẩu phải có ít nhất 1 chữ số.' : 'Password must contain at least 1 number.', 'error');
      return;
    }
    if (!SPECIAL_CHAR_REGEX.test(password)) {
      showToast(language === 'vi' ? 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt.' : 'Password must contain at least 1 special character.', 'error');
      return;
    }
    if (password !== formData.confirmPassword) {
      showToast(t('validation.password_mismatch'), 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        username: trimmedUsername,
        email: trimmedEmail,
        password: formData.password,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        roleId: Number(formData.roleId),
      });

      if (result.success) {
        showToast(t('toast.register_success'), 'success');
        setRegisteredEmail(trimmedEmail);
        setShowVerifyModal(true);
      } else {
        showToast(result.error || t('common.error_occurred'), 'error');
      }
    } catch (err) {
      showToast(t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-premium">
      <div className="register-container">
        <div className="register-grid">
          
          {/* Left Content: Brand Narrative */}
          <div className="register-left-col">
            <span className="brand-subtitle">{language === 'vi' ? 'TẠO TÀI KHOẢN MỚI' : t('auth.register_title')}</span>
            <h1 className="brand-title">{language === 'vi' ? 'Tham Gia Cộng Đồng ReTrade' : 'Join ReTrade Marketplace'}</h1>
            <p className="brand-desc">
              {language === 'vi' ? 'Mua bán, thanh lý và tham gia đấu giá hàng ngàn sản phẩm chất lượng mỗi ngày. Bảo mật an toàn, xác thực uy tín.' : 'Buy, sell, and bid on thousands of quality items every day. Secure, verified, and trusted.'}
            </p>
            
            <div className="brand-image-wrapper">
              <img src={bgRegister} alt="ReTrade Platform" />
              <div className="brand-image-overlay">
                <div className="brand-quote-box">
                  <p className="brand-quote">&quot;{language === 'vi' ? 'Mua bán, thanh lý và tham gia đấu giá hàng ngàn sản phẩm chất lượng mỗi ngày. Bảo mật an toàn, xác thực uy tín.' : 'Buy, sell, and bid on thousands of quality items every day.'}&quot;</p>
                  <p className="brand-est">EST. 2024 — TRUSTED MARKETPLACE</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Registration Form */}
          <div className="register-right-col">
            <div className="register-form-header">
              <h2>{t('auth.register_title')}</h2>
              <p>{t('auth.register_subtitle')}</p>
            </div>

            <button 
              type="button" 
              className="google-btn-register"
              onClick={() => handleGoogleLogin()}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <span className="btn-spinner btn-spinner-dark" style={{ width: '20px', height: '20px' }}></span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.83z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  {t('auth.google_login')}
                </>
              )}
            </button>

            <div className="register-divider">
              <div className="register-divider-line"></div>
              <span>{t('auth.or_continue_with')}</span>
              <div className="register-divider-line"></div>
            </div>

            <form onSubmit={handleSubmit}>
              
              <div className="form-grid">
                <div className="input-wrapper-register">
                  <label htmlFor="firstName">{t('auth.first_name')}</label>
                  <input type="text" id="firstName" className="input-register" value={formData.firstName} onChange={handleChange} disabled={loading} />
                </div>
                <div className="input-wrapper-register">
                  <label htmlFor="lastName">{t('auth.last_name')}</label>
                  <input type="text" id="lastName" className="input-register" value={formData.lastName} onChange={handleChange} disabled={loading} />
                </div>
                <div className="input-wrapper-register form-group-full">
                  <label htmlFor="email">{t('auth.email')} *</label>
                  <input type="email" id="email" className="input-register" value={formData.email} onChange={handleChange} required disabled={loading} />
                </div>

                <div className="input-wrapper-register form-group-full">
                  <label htmlFor="username">{t('auth.username_or_email')} *</label>
                  <input type="text" id="username" className="input-register" value={formData.username} onChange={handleChange} required disabled={loading} />
                </div>

                <div className="input-wrapper-register">
                  <label htmlFor="password">{t('auth.password')} *</label>
                  <div className="password-input-container">
                    <input type={showPassword ? 'text' : 'password'} id="password" className="input-register" value={formData.password} onChange={handleChange} required disabled={loading} />
                    <button type="button" className="password-toggle-register" onClick={() => setShowPassword(!showPassword)} disabled={loading}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="input-wrapper-register">
                  <label htmlFor="confirmPassword">{t('auth.confirm_password')} *</label>
                  <div className="password-input-container">
                    <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" className="input-register" value={formData.confirmPassword} onChange={handleChange} required disabled={loading} />
                    <button type="button" className="password-toggle-register" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={loading}>
                      {showConfirmPassword ? (
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="terms-container">
                <input type="checkbox" id="agreed" checked={formData.agreed} onChange={handleChange} disabled={loading} />
                <label htmlFor="agreed">
                  {t('auth.agree_terms')} <span onClick={() => setShowTerms(true)} style={{cursor: 'pointer', color: '#02241b', textDecoration: 'underline', fontWeight: '700'}}>{t('auth.agree_terms')}</span>.
                </label>
              </div>

              <button type="submit" className="submit-btn-register" disabled={loading || googleLoading}>
                {loading ? (
                  <span className="btn-spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                ) : (
                  <>
                    <span>{t('auth.register_button')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </>
                )}
              </button>

            </form>

            <div className="login-prompt">
              <p>
                {t('auth.have_account')} 
                <Link to="/login" className="login-link-register"> {t('auth.login_button')}</Link>
              </p>
            </div>

          </div>

        </div>
      </div>

      <VerifyModal 
        isOpen={showVerifyModal} 
        onClose={handleVerifyClose} 
        email={registeredEmail}
      />
      <TermsModal 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
      />
    </div>
  );
}
