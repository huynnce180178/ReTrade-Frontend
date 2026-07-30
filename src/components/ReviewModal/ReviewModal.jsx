import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import './ReviewModal.css';

const starValues = [1, 2, 3, 4, 5];

export default function ReviewModal({
  isOpen,
  title,
  subtitle,
  purchase,
  initialRating = 5,
  initialComment = '',
  submitting = false,
  onClose,
  onSubmit,
}) {
  const { t, formatCurrency } = useLanguage();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [proofs, setProofs] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setRating(initialRating);
    setComment(initialComment);
    setProofs([]);
  }, [initialComment, initialRating, isOpen]);

  useEffect(() => () => {
    proofs.forEach((proof) => URL.revokeObjectURL(proof.url));
  }, [proofs]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    onSubmit?.({ rating, comment: comment.trim() });
  };

  const handleProofChange = (event) => {
    const files = Array.from(event.target.files || []).slice(0, 3);
    const previews = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setProofs((current) => {
      current.forEach((proof) => URL.revokeObjectURL(proof.url));
      return previews;
    });
    event.target.value = '';
  };

  const handleStarPointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const nextRating = Math.min(5, Math.max(1, Math.ceil((offset / rect.width) * 5)));
    setRating(nextRating);
  };

  const productName = purchase?.productName || t('nav.product');
  const orderCode = purchase?.orderCode || purchase?.orderId || t('history.order_id');
  const orderAmount = purchase?.finalAmount || purchase?.totalAmount || purchase?.unitPrice || 0;
  const productImage = purchase?.productImageUrl || '/vite.svg';
  const helperText = subtitle || t('product.reviews');

  return (
    <div className="review-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="review-modal-card" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="review-modal-close" onClick={onClose} disabled={submitting} aria-label={t('common.close')}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <header className="review-modal-header">
          <h2 id="review-modal-title">{title || t('product.reviews')}</h2>
        </header>

        <form className="review-modal-form" onSubmit={handleSubmit}>
          <section className="review-product-summary">
            <img src={productImage} alt={productName} />
            <div>
              <strong>{productName}</strong>
              <span>
                {t('history.order_id')} #{orderCode} - <em>{formatCurrency(orderAmount)}</em>
              </span>
            </div>
          </section>

          <div className="review-rating-group">
            <label>{t('seller.reviews_received')}</label>
            <div className="review-stars" aria-label="Rating selector" onPointerMove={handleStarPointerMove}>
              {starValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? 'active' : ''}
                  onPointerEnter={() => setRating(value)}
                  onClick={() => setRating(value)}
                  aria-label={`${value} star`}
                >
                  <span className="material-symbols-outlined">star</span>
                </button>
              ))}
            </div>
          </div>

          <label className="review-comment-group">
            <span>{t('product.reviews')}</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={helperText}
              rows={6}
              maxLength={1000}
              required
              disabled={submitting}
            />
          </label>

          <div className="review-proof-group">
            <span>{t('common.detail')}</span>
            <div className="review-proof-list">
              <label className="review-proof-add">
                <input type="file" accept="image/*" multiple onChange={handleProofChange} disabled={submitting} />
                <span className="material-symbols-outlined">add_a_photo</span>
                <strong>{t('common.create')}</strong>
              </label>
              {proofs.map((proof) => (
                <img key={proof.url} src={proof.url} alt={proof.name} />
              ))}
            </div>
          </div>

          <div className="review-modal-actions">
            <button type="button" className="review-secondary-btn" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="review-primary-btn" disabled={submitting || !comment.trim()}>
              {submitting ? t('common.submitting') : t('common.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
