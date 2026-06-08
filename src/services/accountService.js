import api from './api';

const post = (url, data) => api.post(url, data).then(r => r.data);
const get = (url) => api.get(url).then(r => r.data);

const accountService = {
  register: (data) => post('/Account/register', data),
  loginWithGoogle: (accessToken) => post('/Account/login-with-google', { accessToken }),
  verify: (data) => post('/Account/verify', data),
  resendOtp: (email) => post('/Account/resend-otp', { email }),
  login: (data) => post('/Account/login', data),
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
