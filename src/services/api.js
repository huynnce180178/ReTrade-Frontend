import axios from 'axios';
import BASE_API_URL from './base.api.url.js';
import { forceLogout } from '../utils/authUtils';

const api = axios.create({
  baseURL: BASE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const normalizedUrl = url.toLowerCase();
      const isAuthAttempt = normalizedUrl.includes('/login');

      if (!isAuthAttempt) {
        forceLogout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
