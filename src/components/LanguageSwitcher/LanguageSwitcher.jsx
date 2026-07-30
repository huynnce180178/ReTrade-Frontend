import PropTypes from 'prop-types';
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
      title={language === 'vi' ? 'Chuyen sang English' : 'Switch to Tieng Viet'}
      aria-label={language === 'vi' ? 'Chuyen sang English' : 'Switch to Tieng Viet'}
    >
      <span className="lang-option lang-vi">VI</span>
      <span className="lang-slider"></span>
      <span className="lang-option lang-en">EN</span>
    </button>
  );
}

LanguageSwitcher.propTypes = {
  className: PropTypes.string,
};
