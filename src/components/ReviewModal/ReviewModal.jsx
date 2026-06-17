import { useEffect, useState } from 'react';
import './ReviewModal.css';

const starValues = [1, 2, 3, 4, 5];
const currencyFormatter = new Intl.NumberFormat('vi-VN');

export default function ReviewModal({
  isOpen,
  title = 'Write a Review',
  subtitle,
  purchase,
  initialRating = 5,
  initialComment = '',
  submitting = false,
  onClose,
  onSubmit,
}) {
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

  const productName = purchase?.productName || 'Purchased product';
  const orderCode = purchase?.orderCode || purchase?.orderId || 'Order';
  const orderAmount = purchase?.finalAmount || purchase?.totalAmount || purchase?.unitPrice || 0;
  const productImage = purchase?.productImageUrl || '/vite.svg';
  const helperText = subtitle || 'Share your experience with this purchase.';

  return (
    <div className="review-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="review-modal-card" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="review-modal-close" onClick={onClose} disabled={submitting} aria-label="Close review form">
          <span className="material-symbols-outlined">close</span>
        </button>

        <header className="review-modal-header">
          <h2 id="review-modal-title">{title}</h2>
        </header>

        <form className="review-modal-form" onSubmit={handleSubmit}>
          <section className="review-product-summary">
            <img src={productImage} alt={productName} />
            <div>
              <strong>{productName}</strong>
              <span>
                Order #{orderCode} - <em>{formatVnd(orderAmount)}</em>
              </span>
            </div>
          </section>

          <div className="review-rating-group">
            <label>Shop Credibility</label>
            <div className="review-stars" aria-label="Rating selector" onPointerMove={handleStarPointerMove}>
              {starValues.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? 'active' : ''}
                  onPointerEnter={() => setRating(value)}
                  onClick={() => setRating(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                >
                  <span className="material-symbols-outlined">star</span>
                </button>
              ))}
            </div>
          </div>

          <label className="review-comment-group">
            <span>Your Experience</span>
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
            <span>Attachments</span>
            <div className="review-proof-list">
              <label className="review-proof-add">
                <input type="file" accept="image/*" multiple onChange={handleProofChange} disabled={submitting} />
                <span className="material-symbols-outlined">add_a_photo</span>
                <strong>Add Proof</strong>
              </label>
              {proofs.map((proof) => (
                <img key={proof.url} src={proof.url} alt={proof.name} />
              ))}
            </div>
          </div>

          <div className="review-modal-actions">
            <button type="button" className="review-secondary-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="review-primary-btn" disabled={submitting || !comment.trim()}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatVnd(value) {
  return `${currencyFormatter.format(Number(value || 0))} VND`;
}
