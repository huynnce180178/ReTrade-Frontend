import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';
import './ReturnApprovalModal.css';

const numberFormatter = new Intl.NumberFormat('vi-VN');
function formatVnd(val) {
  return `${numberFormatter.format(Number(val) || 0)} VND`;
}

export default function ReturnApprovalModal({
  isOpen,
  order,
  submitting,
  onClose,
  onApprove,
  onReject,
}) {
  const { t } = useLanguage();
  const [rejectReason, setRejectReason] = useState('');
  const [confirmingStep, setConfirmingStep] = useState(null); // null | 'approve' | 'reject'

  useEffect(() => {
    if (isOpen) {
      setRejectReason('');
      setConfirmingStep(null);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleFinalApprove = () => {
    onApprove(order);
  };

  const handleFinalReject = () => {
    onReject(order, rejectReason.trim());
  };

  return createPortal(
    <div className="return-modal-overlay" onMouseDown={onClose}>
      <div
        className="return-modal-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="return-modal-header">
          <div>
            <h2>{t('return_modal.title')}</h2>
            <p className="return-modal-subtitle">
              {order.orderCode ? `#${order.orderCode}` : `#${order.orderId}`}
            </p>
          </div>
          <button
            type="button"
            className="return-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {confirmingStep ? (
          <div className="return-modal-body confirm-step animate-fade-in">
            <div className={`return-confirm-banner ${confirmingStep}`}>
              <span className="material-symbols-outlined confirm-icon">
                {confirmingStep === 'approve' ? 'check_circle' : 'cancel'}
              </span>
              <h3>
                {confirmingStep === 'approve'
                  ? t('return_modal.confirm_approve_title')
                  : t('return_modal.confirm_reject_title')}
              </h3>
              <p>
                {confirmingStep === 'approve'
                  ? t('return_modal.confirm_approve_msg')
                  : t('return_modal.confirm_reject_msg')}
              </p>

              {confirmingStep === 'reject' && (
                <div className="return-reject-input-group" style={{ marginTop: '16px', width: '100%', textAlign: 'left' }}>
                  <label htmlFor="reject-reason-input" className="reject-label">
                    {t('return_modal.reject_reason_label')}
                  </label>
                  <textarea
                    id="reject-reason-input"
                    className="reject-textarea"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    disabled={submitting}
                    maxLength={500}
                    rows={3}
                    placeholder={t('return_modal.reject_reason_placeholder')}
                  />
                </div>
              )}
            </div>

            <footer className="return-modal-footer">
              <button
                type="button"
                className="return-btn cancel"
                onClick={() => setConfirmingStep(null)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>

              {confirmingStep === 'approve' ? (
                <button
                  type="button"
                  className="return-btn approve"
                  onClick={handleFinalApprove}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner sm"></span>
                      {t('return_modal.approving')}
                    </>
                  ) : (
                    t('return_modal.approve_button')
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="return-btn reject"
                  onClick={handleFinalReject}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="btn-spinner sm"></span>
                      {t('return_modal.rejecting')}
                    </>
                  ) : (
                    t('return_modal.reject_button')
                  )}
                </button>
              )}
            </footer>
          </div>
        ) : (
          <>
            <div className="return-modal-body">
              <div className="return-order-summary">
                <div className="return-summary-row">
                  <span className="summary-label">{t('return_modal.buyer')}:</span>
                  <span className="summary-val">{order.buyerName || t('common.unknown_buyer')}</span>
                </div>
                <div className="return-summary-row">
                  <span className="summary-label">{t('return_modal.product')}:</span>
                  <span className="summary-val">{order.productName}</span>
                </div>
                <div className="return-summary-row">
                  <span className="summary-label">{t('return_modal.refund_amount')}:</span>
                  <span className="summary-val highlight">{formatVnd(order.finalAmount)}</span>
                </div>
              </div>

              <div className="return-reason-box">
                <span className="reason-title">{t('return_modal.buyer_reason')}</span>
                <p className="reason-text">
                  {order.returnReason || t('return_modal.no_reason_provided')}
                </p>
              </div>
            </div>

            <footer className="return-modal-footer">
              <button
                type="button"
                className="return-btn cancel"
                onClick={onClose}
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="return-btn reject"
                onClick={() => setConfirmingStep('reject')}
                disabled={submitting}
              >
                {t('return_modal.reject_button')}
              </button>
              <button
                type="button"
                className="return-btn approve"
                onClick={() => setConfirmingStep('approve')}
                disabled={submitting}
              >
                {t('return_modal.approve_button')}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

ReturnApprovalModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  order: PropTypes.object,
  submitting: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
};
