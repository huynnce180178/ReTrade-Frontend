import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './LanguageSwitcher.css';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'vi' ? 'en' : 'vi');
  };

  return (
    <button
      type="button"
      className={`lang-toggle-btn ${language} ${className}`}
      onClick={toggleLanguage}
      title={language === 'vi' ? 'Chuyển sang English' : 'Switch to Tiếng Việt'}
      aria-label="Toggle language"
    >
      <span className="lang-option lang-vi">VI</span>
      <span className="lang-slider"></span>
      <span className="lang-option lang-en">EN</span>
    </button>
  );
}
