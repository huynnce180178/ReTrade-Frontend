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

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = Date.now() + Math.random();
    const formattedMsg = typeof message === 'string'
      ? message
      : (message?.message || message?.title || (typeof message === 'object' ? JSON.stringify(message) : String(message || '')));

    setToasts((prev) => [...prev, { id, message: formattedMsg, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);


  return (
    <ToastContext.Provider value={{ showToast }}>
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
