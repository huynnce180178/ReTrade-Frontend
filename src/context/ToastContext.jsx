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
  const lastToastRef = React.useRef({ message: '', time: 0 });

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'error', duration = 4000) => {
    const formattedMsg = sanitizeErrorMessage(message);
    if (!formattedMsg) return null;

    const now = Date.now();
    if (
      lastToastRef.current.message === formattedMsg &&
      now - lastToastRef.current.time < 2000
    ) {
      return null;
    }
    lastToastRef.current = { message: formattedMsg, time: now };

    const id = now + Math.random();

    setToasts((prev) => {
      if (prev.some((t) => t.message === formattedMsg && t.type === type)) {
        return prev;
      }
      const next = [...prev, { id, message: formattedMsg, type }];
      return next.slice(-3);
    });

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
