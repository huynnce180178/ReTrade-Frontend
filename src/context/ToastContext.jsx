import React, { createContext, useContext, useState, useCallback } from 'react';
import '../styles/Toast.css';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

function sanitizeErrorMessage(msg) {
  if (!msg) return '';
  const str = typeof msg === 'string'
    ? msg
    : (msg?.message || msg?.title || (typeof msg === 'object' ? JSON.stringify(msg) : String(msg || '')));

  if (
    str.includes('EMAXCONNSESSION') ||
    str.includes('XX000') ||
    str.includes('pool_size') ||
    str.includes('NpgsqlException') ||
    str.includes('PostgresException') ||
    str.includes('ConnectionPool')
  ) {
    return 'Hệ thống đang quá tải lượt truy cập. Vui lòng thử lại sau ít phút!';
  }
  return str;
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = Date.now() + Math.random();
    const formattedMsg = sanitizeErrorMessage(message);

    setToasts((prev) => [...prev, { id, message: formattedMsg, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, [removeToast]);

  React.useEffect(() => {
    const handleCustomToast = (event) => {
      if (event.detail && event.detail.message) {
        showToast(event.detail.message, event.detail.type || 'info', event.detail.duration || 4000);
      }
    };
    window.addEventListener('retrade:toast', handleCustomToast);
    return () => window.removeEventListener('retrade:toast', handleCustomToast);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠️' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="toast-content">{toast.message}</div>
            <button type="button" className="toast-close-btn" onClick={() => removeToast(toast.id)} aria-label="Close message">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
