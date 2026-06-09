import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import accountService from '../services/accountService';
import profileService from '../services/profileService';
import { forceLogout } from '../utils/authUtils';
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

    const handleForceLogout = () => {
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

  const handleLogin = async (username, password) => {
    setError(null);
    try {
      const authData = await accountService.login({ username, password });
      
      if (authData && authData.token) {
        localStorage.setItem('token', authData.token);
        const userObj = {
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
        };

        setToken(authData.token);
        setUser(userObj);
        localStorage.setItem('user', JSON.stringify(userObj));
        // propagate mustChangePassword flag to caller
        return { success: true, mustChangePassword: authData.mustChangePassword };
      }
      return { success: false, error: 'Unauthorized: Invalid credentials' };
    } catch (err) {
      const data = err.response?.data;
      let errMsg;
      if (typeof data === 'string' && data.trim()) {
        errMsg = data;
      } else if (data && typeof data === 'object') {
        errMsg = data.message || data.title || 'Invalid credentials or account pending verification.';
      }
      errMsg = errMsg || err.message || 'Login failed. Please check your username and password.';
      
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    forceLogout();
  };

  const handleGoogleLogin = async (accessToken) => {
    setError(null);
    try {
      const authData = await accountService.loginWithGoogle(accessToken);
      if (authData && authData.token) {
        localStorage.setItem('token', authData.token);
        const userObj = {
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
        };
        setToken(authData.token);
        setUser(userObj);
        localStorage.setItem('user', JSON.stringify(userObj));
        return { success: true };
      }
      return { success: false, error: 'Google login failed. Please try again.' };
    } catch (err) {
      const data = err.response?.data;
      let errMsg;
      if (typeof data === 'string' && data.trim()) {
        errMsg = data;
      } else if (data && typeof data === 'object') {
        errMsg = data.message || data.title || JSON.stringify(data);
      }
      errMsg = errMsg || err.message || 'Google login failed. Try again.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const handleRegister = async (registerData) => {

    setError(null);
    try {
      const responseMsg = await accountService.register(registerData);
      return { success: true, message: responseMsg };
    } catch (err) {
      const data = err.response?.data;
      let errMsg;
      if (typeof data === 'string' && data.trim()) {
        errMsg = data;
      } else if (data && typeof data === 'object') {
        if (data.message) {
          errMsg = data.message;
        } else if (data.errors) {
          const allErrors = Object.values(data.errors).flat();
          errMsg = allErrors.join(' ');
        } else if (data.title) {
          errMsg = data.title;
        }
      }
      errMsg = errMsg || err.message || 'Registration failed. Try again.';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    login: handleLogin,
    
    googleLogin: handleGoogleLogin,
    logout: handleLogout,
    register: handleRegister,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
