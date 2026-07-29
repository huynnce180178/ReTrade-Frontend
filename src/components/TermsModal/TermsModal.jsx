import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './TermsModal.css';

export default function TermsModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal-card">
        <button className="terms-close-btn" onClick={onClose} aria-label={t('common.close')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div className="terms-modal-content">
          <h1>{t('auth.agree_terms')}</h1>
          <p className="terms-last-updated">{t('common.updated_at')}: 2026</p>

          <section className="terms-section">
            <h2>1. ReTrade Platform</h2>
            <p>
              {t('home.hero_subtitle')}
            </p>
          </section>

          <section className="terms-section">
            <h2>2. {t('home.verified_sellers')}</h2>
            <p>
              {t('home.verified_sellers_desc')}
            </p>
          </section>

          <section className="terms-section">
            <h2>3. {t('home.secure_payment')}</h2>
            <p>
              {t('home.secure_payment_desc')}
            </p>
          </section>
        </div>
        
        <div className="terms-modal-footer">
          <button className="terms-accept-btn" onClick={onClose}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
