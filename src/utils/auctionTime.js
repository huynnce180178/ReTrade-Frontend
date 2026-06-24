const AUCTION_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const dateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: AUCTION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function hasExplicitTimeZone(value) {
  return typeof value === 'string' && /(z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

export function parseAuctionDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  return new Date(hasExplicitTimeZone(normalized) ? normalized : `${normalized}+07:00`);
}

export function getAuctionNow() {
  return new Date();
}

export function formatAuctionDateTime(value, options = {}) {
  if (!value) return '-';
  const date = parseAuctionDateTime(value);
  if (!date || Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat(options.locale || 'vi-VN', {
    timeZone: AUCTION_TIME_ZONE,
    day: options.day || '2-digit',
    month: options.month || '2-digit',
    year: options.year || 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).format(date);
}

export function toAuctionDateTimeLocal(value = new Date()) {
  const date = parseAuctionDateTime(value) || new Date();
  const parts = dateTimePartsFormatter.formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return [
    parts.year,
    parts.month,
    parts.day,
  ].join('-') + `T${parts.hour}:${parts.minute}`;
}

export function getFutureAuctionDateTimeLocal(offsetMs) {
  return toAuctionDateTimeLocal(new Date(Date.now() + offsetMs));
}

export function auctionDateTimeLocalToApiValue(value) {
  if (!value) return null;
  return value.length === 16 ? `${value}:00` : value;
}
