import api from './api';

const post = (url, data) => api.post(url, data).then(r => r.data);
const get = (url) => api.get(url).then(r => r.data);

const accountService = {
  register: (data) => post('/Account/register', data),
  loginWithGoogle: (accessTokenData) => {
    const token = typeof accessTokenData === 'string' ? accessTokenData : (accessTokenData?.accessToken || accessTokenData?.idToken || accessTokenData?.token);
    return post('/Account/login-with-google', { accessToken: token });
  },
  verify: (data) => post('/Account/verify', data),
  resendOtp: (email) => post('/Account/resend-otp', { email }),
  login: (data) => post('/Account/login', data),
  getAdminUserList: (query = '') => get(`/Admin/user-list${query}`),
  banUser: (accountId, reason = null) => api.patch(`/Admin/users/${accountId}/ban`, { reason }).then((r) => r.data),
  grantSellerUnlimited: (accountId) => api.post(`/Admin/users/${accountId}/grant-seller-unlimited`).then((r) => r.data),
  revokeSeller: (accountId) => api.post(`/Admin/users/${accountId}/revoke-seller`).then((r) => r.data),
  deactivateMe: () => api.patch('/Account/deactivate-me').then((r) => r.data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.post('/User/upload-avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },

  changePassword: (oldPassword, newPassword) => post('/Account/change-password', { oldPassword, newPassword }),
  setPassword: (newPassword) => post('/Account/set-password', { newPassword }),
  getAllAccounts: () => get('/Account'),
  forgotPassword: (email) => post('/Account/forgot-password', { email }),
  resetPassword: (data) => post('/Account/reset-password', data),
  passwordRecovery: (email) => post('/Account/password-recovery', { email }),
  
};

export default accountService;
