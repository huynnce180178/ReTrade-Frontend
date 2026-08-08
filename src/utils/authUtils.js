export const clearAuthStorage = () => {
  try {
    localStorage.clear();
    sessionStorage.clear();

    // Clear all browser cookies
    if (typeof document !== 'undefined' && document.cookie) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    }
  } catch (e) {
    console.error('Error clearing auth storage:', e);
  }
};

export const forceLogout = () => {
  clearAuthStorage();
  window.dispatchEvent(new CustomEvent('retrade:logout'));
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

