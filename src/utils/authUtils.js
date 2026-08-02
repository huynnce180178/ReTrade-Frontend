export const clearAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const forceLogout = () => {
  clearAuthStorage();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

