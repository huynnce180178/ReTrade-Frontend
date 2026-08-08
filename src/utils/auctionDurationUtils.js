export const AUCTION_DURATION_PRESETS = [
  { value: 5, key: 'm5' },
  { value: 10, key: 'm10' },
  { value: 15, key: 'm15' },
  { value: 30, key: 'm30' },
  { value: 60, key: 'h1' },
  { value: 120, key: 'h2' },
  { value: 180, key: 'h3' },
  { value: 360, key: 'h6' },
  { value: 720, key: 'h12' },
  { value: 1440, key: 'h24' },
];

export function calculateEndTimeFromDuration(startTimeLocal, durationMinutes) {
  if (!startTimeLocal) return '';
  const startDate = new Date(startTimeLocal);
  if (isNaN(startDate.getTime())) return '';
  const duration = Number(durationMinutes);
  if (!duration || isNaN(duration) || duration <= 0) return '';

  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
  
  const year = endDate.getFullYear();
  const month = String(endDate.getMonth() + 1).padStart(2, '0');
  const day = String(endDate.getDate()).padStart(2, '0');
  const hours = String(endDate.getHours()).padStart(2, '0');
  const minutes = String(endDate.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateTimePreview(dateTimeLocalStr, isVi = true) {
  if (!dateTimeLocalStr) return '---';
  const d = new Date(dateTimeLocalStr);
  if (isNaN(d.getTime())) return '---';

  const dateFormatted = d.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = d.toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${timeFormatted} - ${dateFormatted}`;
}
