import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';
import './SellerPagination.css';

export default function SellerPagination({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  disabled = false,
}) {
  const { t } = useLanguage();

  const safePage = Math.max(1, Number(page) || 1);
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);

  if (safeTotalPages <= 1) return null;

  const goToPage = (nextPage) => {
    if (disabled) return;
    const clampedPage = Math.min(safeTotalPages, Math.max(1, nextPage));
    if (clampedPage !== safePage) {
      onPageChange(clampedPage);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i += 1) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(safeTotalPages - 1, safePage + 1);
      for (let i = start; i <= end; i += 1) pages.push(i);
      if (safePage < safeTotalPages - 2) pages.push('...');
      pages.push(safeTotalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <footer className="seller-dash-pagination">
      <div className="seller-dash-pagination-numbers">
        {pageNumbers.map((p, idx) => (p === '...' ? (
          <span key={`dots-${idx}`} className="seller-dash-page-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`seller-dash-page-num ${p === safePage ? 'active' : ''}`}
            disabled={disabled || p === safePage}
            onClick={() => goToPage(p)}
          >
            {p}
          </button>
        )))}
      </div>

      <div className="seller-dash-pagination-actions">
        <button
          type="button"
          className="seller-dash-page-step prev"
          disabled={disabled || safePage === 1}
          onClick={() => goToPage(safePage - 1)}
        >
          {t('common.previous')}
        </button>
        <button
          type="button"
          className="seller-dash-page-step next"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => goToPage(safePage + 1)}
        >
          {t('common.next')}
        </button>
      </div>
    </footer>
  );
}

SellerPagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageSize: PropTypes.number,
  totalItems: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};