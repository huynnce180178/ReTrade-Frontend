const GMT7_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function hasExplicitTimeZone(value) {
  return typeof value === 'string' && /(z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

export function parseBackendUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  return new Date(hasExplicitTimeZone(normalized) ? normalized : `${normalized}Z`);
}

export function formatDateTimeGmt7(value, options = {}) {
  const date = parseBackendUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(options.locale || 'vi-VN', {
    timeZone: GMT7_TIME_ZONE,
    year: options.year || 'numeric',
    month: options.month || '2-digit',
    day: options.day || '2-digit',
    hour: options.hour || '2-digit',
    minute: options.minute || '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date);
}

export function formatDateGmt7(value, options = {}) {
  const date = parseBackendUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(options.locale || 'vi-VN', {
    timeZone: GMT7_TIME_ZONE,
    year: options.year || 'numeric',
    month: options.month || '2-digit',
    day: options.day || '2-digit',
  }).format(date);
}

export function getYearGmt7(value) {
  const date = parseBackendUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en', {
    timeZone: GMT7_TIME_ZONE,
    year: 'numeric',
  }).format(date);
}
