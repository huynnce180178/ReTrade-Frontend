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
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);

  if (safeTotalPages <= 1) return null;

  const start = safeTotalItems === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const end = Math.min(safePage * safePageSize, safeTotalItems);

  const goToPage = (nextPage) => {
    if (disabled) return;
    const clampedPage = Math.min(safeTotalPages, Math.max(1, nextPage));
    if (clampedPage !== safePage) {
      onPageChange(clampedPage);
    }
  };

  return (
    <footer className="seller-dash-pagination">
      <span className="seller-dash-pagination-info">
        {t('common.showing_range', { start, end, total: safeTotalItems })}
      </span>
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
  pageSize: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};