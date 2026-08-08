import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/Login.css';
import '../../../styles/Register.css';
import accountService from '../../../services/accountService';
import VerifyModal from '../../../components/VerifyModal/VerifyModal';
import TermsModal from '../../../components/TermsModal/TermsModal';
import bgRegister from '../../../assets/background-register.png';

const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>-]/;

export default function Register() {
  const { user, register, googleLogin, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
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

  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null });
  const [emailStatus, setEmailStatus] = useState({ checking: false, available: null });

  React.useEffect(() => {
    const trimmed = formData.username.trim();
    if (!trimmed) {
      setUsernameStatus({ checking: false, available: null });
      return;
    }

    setUsernameStatus({ checking: true, available: null });
    const timer = setTimeout(async () => {
      try {
        const res = await accountService.checkUsername(trimmed);
        if (res.isAvailable) {
          setUsernameStatus({ checking: false, available: true });
        } else {
          setUsernameStatus({ checking: false, available: false });
        }
      } catch (err) {
        setUsernameStatus({ checking: false, available: null });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.username]);

  React.useEffect(() => {
    const trimmed = formData.email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setEmailStatus({ checking: false, available: null });
      return;
    }

    setEmailStatus({ checking: true, available: null });
    const timer = setTimeout(async () => {
      try {
        const res = await accountService.checkEmail(trimmed);
        if (res.isAvailable) {
          setEmailStatus({ checking: false, available: true });
        } else {
          setEmailStatus({ checking: false, available: false });
        }
      } catch (err) {
        setEmailStatus({ checking: false, available: null });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.email]);

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
      showToast(t('validation.terms_required'), 'error');
      return;
    }

    if (password.length < 8 || password.length > 50) {
      showToast(t('validation.password_length_range'), 'error');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast(t('validation.password_uppercase'), 'error');
      return;
    }
    if (!/[a-z]/.test(password)) {
      showToast(t('validation.password_lowercase'), 'error');
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast(t('validation.password_number'), 'error');
      return;
    }
    if (!SPECIAL_CHAR_REGEX.test(password)) {
      showToast(t('validation.password_special'), 'error');
      return;
    }
    if (password !== formData.confirmPassword) {
      showToast(t('validation.password_mismatch'), 'error');
      return;
    }

    if (usernameStatus.available === false) {
      showToast(t('validation.username_taken'), 'error');
      return;
    }
    if (emailStatus.available === false) {
      showToast(t('validation.email_taken'), 'error');
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
    <div className="login-page-premium">
      <section className="login-section">
        <div className="login-split-card">

          {/* Left Side: Visual Storytelling */}
          <div className="login-left-side">
            <img src={bgRegister} alt="ReTrade Platform" />
            <div className="hero-gradient">
              <h2>
                {t('home.hero_title_1')}<br />
                {t('home.hero_title_2')}
              </h2>
              <p>{t('auth.brand_desc')}</p>
            </div>
          </div>

          {/* Right Side: Registration Form */}
          <div className="login-right-side">
            <div className="login-form-container">

              {registeredEmail && !showVerifyModal && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                  <span>{t('auth.unverified_notice', { email: registeredEmail })}</span>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="font-bold text-[#1b6b51] underline hover:text-[#15533f] ml-2 whitespace-nowrap"
                  >
                    {t('auth.reopen_otp')}
                  </button>
                </div>
              )}

              <div className="login-header-text">
                <h1>{t('auth.register_title')}</h1>
                <p>{t('auth.register_subtitle')}</p>
              </div>

              {/* Google Sign In */}
              <button 
                type="button" 
                className="google-btn-premium"
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
                    <span>{t('auth.google_login')}</span>
                  </>
                )}
              </button>

              <div className="login-divider">
                <div className="login-divider-line"></div>
                <span>{t('auth.or_continue_with')}</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      {t('auth.first_name')}
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      {t('auth.last_name')}
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {t('auth.email')} *
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm"
                  />
                  {emailStatus.checking && <span className="field-status-hint checking">{t('validation.checking_email')}</span>}
                  {!emailStatus.checking && emailStatus.available === true && (
                    <span className="field-status-hint available">{t('validation.email_available')}</span>
                  )}
                  {!emailStatus.checking && emailStatus.available === false && (
                    <span className="field-status-hint taken">{t('validation.email_taken')}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {t('auth.username_or_email')} *
                  </label>
                  <input
                    type="text"
                    id="username"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm"
                  />
                  {usernameStatus.checking && <span className="field-status-hint checking">{t('validation.checking_username')}</span>}
                  {!usernameStatus.checking && usernameStatus.available === true && (
                    <span className="field-status-hint available">{t('validation.username_available')}</span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <span className="field-status-hint taken">{t('validation.username_taken')}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {t('auth.password')} *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {formData.password.length > 0 && (
                    <div className="password-req-box">
                      <div className={`req-chip ${formData.password.length >= 8 && formData.password.length <= 50 ? 'valid' : ''}`}>
                        {formData.password.length >= 8 && formData.password.length <= 50 ? '✓' : '•'} {t('validation.password_req_length')}
                      </div>
                      <div className={`req-chip ${/[A-Z]/.test(formData.password) ? 'valid' : ''}`}>
                        {/[A-Z]/.test(formData.password) ? '✓' : '•'} {t('validation.password_req_uppercase')}
                      </div>
                      <div className={`req-chip ${/[a-z]/.test(formData.password) ? 'valid' : ''}`}>
                        {/[a-z]/.test(formData.password) ? '✓' : '•'} {t('validation.password_req_lowercase')}
                      </div>
                      <div className={`req-chip ${/[0-9]/.test(formData.password) ? 'valid' : ''}`}>
                        {/[0-9]/.test(formData.password) ? '✓' : '•'} {t('validation.password_req_number')}
                      </div>
                      <div className={`req-chip ${SPECIAL_CHAR_REGEX.test(formData.password) ? 'valid' : ''}`}>
                        {SPECIAL_CHAR_REGEX.test(formData.password) ? '✓' : '•'} {t('validation.password_req_special')}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    {t('auth.confirm_password')} *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {formData.confirmPassword.length > 0 && (
                    formData.confirmPassword === formData.password ? (
                      <span className="field-status-hint available">{t('validation.password_match')}</span>
                    ) : (
                      <span className="field-status-hint taken">{t('validation.password_mismatch_hint')}</span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="agreed"
                    checked={formData.agreed}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-4 h-4 rounded text-[#1b6b51] focus:ring-[#1b6b51] accent-[#1b6b51] cursor-pointer"
                  />
                  <label htmlFor="agreed" className="text-xs text-gray-600 cursor-pointer leading-normal">
                    {t('auth.agree_terms_prefix')}{' '}
                    <span onClick={() => setShowTerms(true)} className="text-[#02241b] font-bold underline cursor-pointer">
                      {t('auth.agree_terms_link')}
                    </span>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-3.5 px-4 bg-[#1b6b51] hover:bg-[#15533f] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#1b6b51]/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm mt-4"
                >
                  {loading ? (
                    <span className="btn-spinner" style={{ width: '20px', height: '20px' }}></span>
                  ) : (
                    t('auth.register_button')
                  )}
                </button>

              </form>

              <div className="text-center mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500">
                {t('auth.have_account')}{' '}
                <Link to="/login" className="text-[#1b6b51] font-bold hover:underline">
                  {t('auth.login_button')}
                </Link>
              </div>

            </div>
          </div>

        </div>
      </section>

      {showVerifyModal && (
        <VerifyModal
          isOpen={showVerifyModal}
          onClose={handleVerifyClose}
          email={registeredEmail}
        />
      )}
      {showTerms && (
        <TermsModal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
        />
      )}
    </div>
  );
}
