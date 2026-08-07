export const clearAuthStorage = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const forceLogout = () => {
  clearAuthStorage();
  const currentPath = window.location.pathname;
  const isProtectedPath = currentPath.startsWith('/seller-dashboard') ||
                          currentPath.startsWith('/admin') ||
                          currentPath.startsWith('/my-account') ||
                          currentPath.startsWith('/profile') ||
                          currentPath.startsWith('/checkout') ||
                          currentPath.startsWith('/purchase-history') ||
                          currentPath.startsWith('/offer-history') ||
                          currentPath.startsWith('/bid-history') ||
                          currentPath.startsWith('/address-book') ||
                          currentPath.startsWith('/change-password');

  if (isProtectedPath && currentPath !== '/login') {
    window.location.href = '/login';
  }
};

