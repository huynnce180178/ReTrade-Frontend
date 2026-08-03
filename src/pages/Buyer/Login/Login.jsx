import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import bgLogin from '../../../assets/background-login.png';
import ChangePasswordAfterRecoveryModal from '../../../components/ChangePasswordAfterRecoveryModal/ChangePasswordAfterRecoveryModal';

import '../../../styles/Login.css';

export default function Login() {
  const { user, login, googleLogin, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showFirstChangeModal, setShowFirstChangeModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast(t('validation.required'), 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        if (result.mustChangePassword) {
          showToast(t('auth.change_pw_title'), 'info');
          setShowFirstChangeModal(true);
        } else {
          showToast(t('toast.login_success'), 'success');
          navigate('/');
        }
      } else {
        const rawErr = typeof result.error === 'string' ? result.error : (result.error?.message || result.error?.title);
        const errorMsg = (result.code && t(`auth.${result.code.toLowerCase()}`) !== `auth.${result.code.toLowerCase()}`)
          ? t(`auth.${result.code.toLowerCase()}`)
          : (rawErr || t('common.error_occurred'));
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('common.error_occurred');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const doGoogleLogin = googleLogin || loginWithGoogle;
        const result = await doGoogleLogin(tokenResponse);
        if (result.success) {
          if (result.mustChangePassword) {
            showToast(t('auth.change_pw_title'), 'info');
            setShowFirstChangeModal(true);
          } else {
            showToast(t('toast.login_success'), 'success');
            navigate('/');
          }
        } else {
          const rawErr = typeof result.error === 'string' ? result.error : (result.error?.message || result.error?.title || JSON.stringify(result.error));
          const errorMsg = (result.code && t(`auth.${result.code.toLowerCase()}`) !== `auth.${result.code.toLowerCase()}`)
            ? t(`auth.${result.code.toLowerCase()}`)
            : (rawErr || 'Google sign-in failed. Please try again.');
          showToast(errorMsg, 'error');
        }
      } catch (err) {
        console.error('Google login component error:', err);
        const msg = err.response?.data?.message || err.response?.data || err.message || t('common.error_occurred');
        showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      if (errorResponse?.error === 'access_denied') {
        showToast(language === 'vi' ? 'Bạn đã từ chối quyền Google Profile.' : 'You denied Google profile permission.', 'warning');
        return;
      }
      showToast(t('common.error_occurred'), 'error');
    },
    onNonOAuthError: () => {
      showToast(language === 'vi' ? 'Đăng nhập Google đã bị đóng hoặc bị chặn.' : 'Google sign-in was closed or blocked.', 'warning');
    },
    flow: 'implicit',
    scope: 'openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    prompt: 'consent select_account',
    include_granted_scopes: false,
  });

  return (
    <div className="login-page-premium">
      <section className="login-section">
        <div className="login-split-card">

          {/* Left Side: Visual Storytelling */}
          <div className="login-left-side">
            <img
              src={bgLogin}
              alt="Sustainable Luxury Close-up"
            />
            <div className="hero-gradient">
              <h2>
                {t('home.hero_title_1')}<br />
                {t('home.hero_title_2')}
              </h2>
              <p>{t('home.hero_subtitle')}</p>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="login-right-side">
            <div className="login-form-container">

              <div className="login-header-text">
                <h1>{t('auth.login_title')}</h1>
                <p>{t('auth.login_subtitle')}</p>
              </div>

              <>
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
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        <span>{t('auth.google_login')}</span>
                      </>
                    )}
                  </button>

                  <div className="login-divider">
                    <div className="login-divider-line"></div>
                    <span>{t('auth.or_continue_with')}</span>
                  </div>

                  {/* Form fields */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        {t('auth.username_or_email')}
                      </label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          {t('auth.password')}
                        </label>
                        <Link to="/forgot-password" className="text-xs text-[#1b6b51] hover:underline font-medium">
                          {t('auth.forgot_password')}
                        </Link>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#1b6b51] focus:ring-2 focus:ring-[#1b6b51]/20 transition-all outline-none text-sm pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <span className="material-symbols-outlined text-xl">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || googleLoading}
                      className="w-full py-3.5 px-4 bg-[#1b6b51] hover:bg-[#15533f] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#1b6b51]/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm mt-6"
                    >
                      {loading ? (
                        <span className="btn-spinner" style={{ width: '20px', height: '20px' }}></span>
                      ) : (
                        t('auth.login_button')
                      )}
                    </button>
                  </form>
              </>

              <div className="text-center mt-6 pt-6 border-t border-gray-100 text-xs text-gray-500">
                {t('auth.no_account')}{' '}
                <Link to="/register" className="text-[#1b6b51] font-bold hover:underline">
                  {t('auth.register_now')}
                </Link>
              </div>

            </div>
          </div>

        </div>
      </section>

      {showFirstChangeModal && (
        <ChangePasswordAfterRecoveryModal
          isOpen={showFirstChangeModal}
          onClose={() => {
            setShowFirstChangeModal(false);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
