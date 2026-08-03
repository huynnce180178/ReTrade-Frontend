import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import accountService from '../services/accountService';
import profileService from '../services/profileService';
import { clearAuthStorage } from '../utils/authUtils';
import { createAccountHubConnection } from '../services/accountRealtimeService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
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
          };
          setUser(mergedProfile);
          localStorage.setItem('user', JSON.stringify(mergedProfile));
        } catch (err) {
          console.error('Failed to validate token on startup:', err);
          handleLogout();
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
        : 'Quyền hạn tài khoản của bạn đã bị Quản trị viên thay đổi. Hệ thống tự động đăng xuất.';
      alert(msg);
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

  const buildUserFromAuthData = (authData) => ({
    accountId: authData.accountId,
    userId: authData.userId,
    username: authData.username,
    email: authData.email,
    firstName: authData.firstName,
    lastName: authData.lastName,
    roles: authData.roles,
    avatarUrl: authData.avatarUrl,
    phone: authData.phone,
    isPasswordSet: authData.isPasswordSet,
    mustChangePassword: authData.mustChangePassword ?? false,
  });

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
      const authData = await accountService.login({ username, password });
      
      if (authData && authData.token) {
        localStorage.setItem('token', authData.token);
        const userObj = buildUserFromAuthData(authData);
        const hydratedUser = await hydrateUserWithProfile(userObj);

        setToken(authData.token);
        setUser(hydratedUser);
        localStorage.setItem('user', JSON.stringify(hydratedUser));
        return { success: true, mustChangePassword: authData.mustChangePassword };
      }
      return { success: false, error: 'Unauthorized: Invalid credentials' };
    } catch (err) {
      const data = err.response?.data;
      let errMsg;
      if (typeof data === 'string' && data.trim()) {
        errMsg = data;
      } else if (data && typeof data === 'object') {
        errMsg = data.message || data.title;
      }
      errMsg = errMsg || err.message || 'Login failed. Please check your username and password.';
      
      setError(errMsg);
      return { success: false, error: errMsg, code: data?.code };
    }
  };

  const handleGoogleLogin = async (googleResponse) => {
    setError(null);
    try {
      const authData = await accountService.loginWithGoogle(googleResponse);
      if (authData && authData.token) {
        localStorage.setItem('token', authData.token);
        const userObj = buildUserFromAuthData(authData);
        const hydratedUser = await hydrateUserWithProfile(userObj);

        setToken(authData.token);
        setUser(hydratedUser);
        localStorage.setItem('user', JSON.stringify(hydratedUser));
        return { success: true, mustChangePassword: authData.mustChangePassword };
      }
      return { success: false, error: 'Google Login failed' };
    } catch (err) {
      const data = err.response?.data;
      let errMsg;
      if (typeof data === 'string' && data.trim()) {
        errMsg = data;
      } else if (data && typeof data === 'object') {
        errMsg = data.message || data.title || (typeof data === 'object' && Object.keys(data).length > 0 ? JSON.stringify(data) : '') || 'Google authentication failed.';
      }
      errMsg = errMsg || err.message || 'Google Login failed.';
      
      setError(errMsg);
      return { success: false, error: errMsg, code: data?.code };
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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login: handleLogin,
        loginWithGoogle: handleGoogleLogin,
        logout: handleLogout,
        updateUserState,
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
