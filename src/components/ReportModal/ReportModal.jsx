import { useEffect, useState } from 'react';
import './ReportModal.css';

const reasons = ['Fraud or scam', 'Harassment or abuse', 'Misleading information', 'Policy violation', 'Other'];

export default function ReportModal({ isOpen, title = 'Submit Report', targetLabel, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) { setReason(''); setDescription(''); }
  }, [isOpen]);
  if (!isOpen) return null;

  const submit = (event) => {
    event.preventDefault();
    if (reason) onSubmit?.({ reason, description: description.trim() || null });
  };

  return <div className="report-modal-overlay" onMouseDown={onClose}>
    <form className="report-modal-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>{title}</h2><p>{targetLabel || 'Tell us what happened. Your report is confidential.'}</p></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Close"><span className="material-symbols-outlined">close</span></button></header>
      <label>Reason <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} required><option value="">Select a reason</option>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label>Description <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="1000" rows="5" disabled={submitting} placeholder="Add helpful details (optional)" /></label>
      <footer><button type="button" className="report-btn secondary" onClick={onClose} disabled={submitting}>Cancel</button><button className="report-btn primary" disabled={!reason || submitting}>{submitting ? 'Submitting...' : 'Submit Report'}</button></footer>
    </form>
  </div>;
}
