import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './ReportModal.css';

export default function ReportModal({ isOpen, title, targetLabel, submitting, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const reasons = [
    t('history.refund_reason'),
    t('common.warning'),
    t('common.error'),
    t('common.system'),
    t('common.none')
  ];

  useEffect(() => {
    if (isOpen) { setReason(''); setDescription(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = (event) => {
    event.preventDefault();
    if (reason) onSubmit?.({ reason, description: description.trim() || null });
  };

  return (
    <div className="report-modal-overlay" onMouseDown={onClose}>
      <form className="report-modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>{title || t('history.report_history_title')}</h2>
            <p>{targetLabel || t('common.description')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label={t('common.close')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <label>
          {t('history.refund_reason')}
          <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} required>
            <option value="">{t('common.select')} {t('history.refund_reason')}</option>
            {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          {t('common.description')}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="1000" rows="5" disabled={submitting} placeholder={t('common.description')} />
        </label>
        <footer>
          <button type="button" className="report-btn secondary" onClick={onClose} disabled={submitting}>{t('common.cancel')}</button>
          <button className="report-btn primary" disabled={!reason || submitting}>{submitting ? t('common.submitting') : t('common.submit')}</button>
        </footer>
      </form>
    </div>
  );
}
