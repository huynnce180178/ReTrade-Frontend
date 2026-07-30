import PropTypes from 'prop-types';
import { useLanguage } from '../../context/LanguageContext';

export default function TargetTypeBadge({ type }) {
  const { t } = useLanguage();
  const normalized = String(type || '').toLowerCase();
  const labelMap = {
    review: 'admin.reports.review',
    buyer: 'admin.reports.buyer',
    seller: 'admin.reports.seller',
    order: 'admin.reports.order',
    product: 'admin.reports.product',
    auction: 'admin.reports.auction',
  };
  const key = Object.keys(labelMap).find((item) => normalized.includes(item));
  return <span className="report-target-badge">{key ? t(labelMap[key]) : t('admin.reports.target_unknown')}</span>;
}

TargetTypeBadge.propTypes = {
  type: PropTypes.string,
};
