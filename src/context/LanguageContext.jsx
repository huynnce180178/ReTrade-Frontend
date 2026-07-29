import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

const translations = { vi, en };

const LanguageContext = createContext(null);

const STORAGE_KEY = 'retrade_language';
const DEFAULT_LANG = 'vi';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'vi' || saved === 'en')) {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_LANG;
  });

  const changeLanguage = useCallback((lang) => {
    if (lang !== 'vi' && lang !== 'en') return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
    document.documentElement.lang = lang;
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key, params = {}) => {
      if (!key) return '';

      const keys = key.split('.');
      let val = translations[language];

      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = val[k];
        } else {
          val = null;
          break;
        }
      }

      // Fallback to Vietnamese if key not found in current language
      if (val === null || val === undefined) {
        let fallbackVal = translations[DEFAULT_LANG];
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
            fallbackVal = fallbackVal[k];
          } else {
            fallbackVal = null;
            break;
          }
        }
        val = fallbackVal;
      }

      if (typeof val !== 'string') {
        return key;
      }

      // Replace interpolation params like {name}, {amount}
      return val.replace(/\{(\w+)\}/g, (_, match) => {
        return params[match] !== undefined ? String(params[match]) : `{${match}}`;
      });
    },
    [language]
  );

  const formatCurrency = useCallback(
    (value, currency = 'VND') => {
      if (value === null || value === undefined || isNaN(value)) return '-';
      const numericValue = Number(value);

      if (currency === 'VND') {
        return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
          style: 'currency',
          currency: 'VND',
          maximumFractionDigits: 0,
        }).format(numericValue);
      }

      return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        style: 'currency',
        currency: currency || (language === 'vi' ? 'VND' : 'USD'),
      }).format(numericValue);
    },
    [language]
  );

  const formatDate = useCallback(
    (value, options = {}) => {
      if (!value) return '-';
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return '-';

      const defaultOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...options,
      };

      return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', defaultOptions).format(date);
    },
    [language]
  );

  const formatDateTime = useCallback(
    (value, options = {}) => {
      if (!value) return '-';
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) return '-';

      const defaultOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        ...options,
      };

      return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', defaultOptions).format(date);
    },
    [language]
  );

  const formatNumber = useCallback(
    (value, options = {}) => {
      if (value === null || value === undefined || isNaN(value)) return '-';
      return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', options).format(Number(value));
    },
    [language]
  );

  const value = {
    language,
    setLanguage: changeLanguage,
    t,
    formatCurrency,
    formatDate,
    formatDateTime,
    formatNumber,
    isVi: language === 'vi',
    isEn: language === 'en',
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
