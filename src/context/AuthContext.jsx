import { createContext, useContext, useState, useEffect, useRef } from 'react';
import accountService from '../services/accountService';
import profileService from '../services/profileService';
import { clearAuthStorage } from '../utils/authUtils';
import { createAccountHubConnection } from '../services/accountRealtimeService';

import { useLanguage } from './LanguageContext';

const AuthContext = createContext(null);

const unwrapApiPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return payload.data || payload.result || payload.value || payload.content || payload;
};

const getAuthToken = (authData) => (
  authData?.token
  || authData?.accessToken
  || authData?.jwtToken
  || authData?.jwt
  || authData?.bearerToken
);

const extractErrorDetails = (err, fallback) => {
  const data = err.response?.data;
  let code = data?.code;
  let message;

  if (typeof data === 'string' && data.trim()) {
    message = data;
  } else if (data && typeof data === 'object') {
    const validationMessages = data.errors
      ? Object.values(data.errors).flat().filter(Boolean).join(', ')
      : '';
    const nestedPayload = unwrapApiPayload(data);

    message = data.message
      || data.title
      || data.error
      || validationMessages
      || nestedPayload?.message
      || nestedPayload?.title
      || nestedPayload?.error;
    code = code || nestedPayload?.code;
  }

  return {
    message: message || err.message || fallback,
    code,
  };
};

export const AuthProvider = ({ children }) => {
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const accountHubRef = useRef(null);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUserJson = localStorage.getItem('user');

      if (storedToken) {
        try {
          setToken(storedToken);
          const storedUser = storedUserJson ? JSON.parse(storedUserJson) : null;
          if (storedUser) {
            setUser(storedUser);
          }
          const freshProfile = await profileService.getMyProfile();
          const mergedProfile = {
            ...storedUser,
            ...freshProfile,
            roles: freshProfile.roles || storedUser?.roles || [],
            isPasswordSet: freshProfile.isPasswordSet ?? storedUser?.isPasswordSet,
            mustChangePassword: freshProfile.mustChangePassword ?? storedUser?.mustChangePassword,
          };
          setUser(mergedProfile);
          localStorage.setItem('user', JSON.stringify(mergedProfile));
        } catch (err) {
          console.error('Failed to load profile on startup:', err);
          if (err.response?.status === 401) {
            clearAuthStorage();
            setUser(null);
            setToken(null);
          }
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    if (!token || !user?.accountId) {
      return undefined;
    }

    const connection = createAccountHubConnection();
    accountHubRef.current = connection;
    let disposed = false;

    const handleForceLogout = (reasonMessage) => {
      const msg = typeof reasonMessage === 'string' && reasonMessage.trim()
        ? reasonMessage
        : t('auth.force_logout_default');
      window.dispatchEvent(new CustomEvent('retrade:toast', {
        detail: { message: msg, type: 'warning', duration: 5000 }
      }));
      handleLogout();
    };

    connection.on('ForceLogout', handleForceLogout);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!disposed) {
          await connection.invoke('JoinAccountGroup', user.accountId);
        }
      } catch (error) {
        console.error('Failed to connect account hub:', error);
      }
    };

    startConnection();

    return () => {
      disposed = true;
      connection.off('ForceLogout', handleForceLogout);
      connection.stop().catch(() => {});
    };
  }, [token, user?.accountId]);

  const buildUserFromAuthData = (authData) => {
    const accountData = authData?.user || authData?.account || authData?.profile || authData;

    return {
      accountId: accountData.accountId,
      userId: accountData.userId,
      username: accountData.username,
      email: accountData.email,
      firstName: accountData.firstName,
      lastName: accountData.lastName,
      roles: accountData.roles,
      avatarUrl: accountData.avatarUrl,
      phone: accountData.phone,
      isPasswordSet: accountData.isPasswordSet,
      mustChangePassword: accountData.mustChangePassword ?? authData?.mustChangePassword ?? false,
    };
  };

  const hydrateUserWithProfile = async (baseUser) => {
    try {
      const freshProfile = await profileService.getMyProfile();
      return {
        ...baseUser,
        ...freshProfile,
        roles: freshProfile.roles || baseUser.roles || [],
        avatarUrl: freshProfile.avatarUrl || baseUser.avatarUrl,
        isPasswordSet: freshProfile.isPasswordSet ?? baseUser.isPasswordSet,
        mustChangePassword: baseUser.mustChangePassword ?? false,
      };
    } catch {
      return baseUser;
    }
  };

  const handleLogin = async (username, password) => {
    setError(null);
    try {
      const authData = unwrapApiPayload(await accountService.login({ username, password }));
      const tokenVal = getAuthToken(authData);
      
      if (authData && tokenVal) {
        localStorage.setItem('token', tokenVal);
        const userObj = buildUserFromAuthData(authData);
        const hydratedUser = await hydrateUserWithProfile(userObj);

        setToken(tokenVal);
        setUser(hydratedUser);
        localStorage.setItem('user', JSON.stringify(hydratedUser));
        return { success: true, mustChangePassword: authData.mustChangePassword };
      }
      return { success: false, error: 'Login failed: No token returned from backend server.' };
    } catch (err) {
      const { message: errMsg, code } = extractErrorDetails(
        err,
        'Login failed. Please check your username and password.'
      );
      
      setError(errMsg);
      return { success: false, error: errMsg, code };
    }
  };

  const handleGoogleLogin = async (googleResponse) => {
    setError(null);
    try {
      const authData = unwrapApiPayload(await accountService.loginWithGoogle(googleResponse));
      const tokenVal = getAuthToken(authData);
      if (authData && tokenVal) {
        localStorage.setItem('token', tokenVal);
        const userObj = buildUserFromAuthData(authData);
        const hydratedUser = await hydrateUserWithProfile(userObj);

        setToken(tokenVal);
        setUser(hydratedUser);
        localStorage.setItem('user', JSON.stringify(hydratedUser));
        return { success: true, mustChangePassword: authData.mustChangePassword };
      }
      return { success: false, error: 'Google Login failed: No token returned from backend server.' };
    } catch (err) {
      console.error('Google Login Exception:', err);
      const { message: errMsg, code } = extractErrorDetails(err, 'Google authentication failed.');
      
      setError(errMsg);
      return { success: false, error: errMsg, code };
    }
  };

  const handleLogout = () => {
    if (accountHubRef.current) {
      accountHubRef.current.stop().catch(() => {});
      accountHubRef.current = null;
    }
    clearAuthStorage();
    setUser(null);
    setToken(null);
  };

  const updateUserState = (updatedFields) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const clearMustChangePassword = () => {
    updateUserState({
      mustChangePassword: false,
      isPasswordSet: true,
    });
  };

  const handleRegister = async (registerData) => {
    setError(null);
    try {
      const response = await accountService.register(registerData);
      return { success: true, data: response };
    } catch (err) {
      console.error('Register error:', err);
      const { message: errMsg } = extractErrorDetails(err, 'Registration failed.');
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        loading,
        error,
        login: handleLogin,
        register: handleRegister,
        loginWithGoogle: handleGoogleLogin,
        googleLogin: handleGoogleLogin,
        logout: handleLogout,
        updateUserState,
        clearMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
