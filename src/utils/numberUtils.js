/**
 * Utility functions for formatting numbers with thousands space separators in inputs.
 */

/**
 * Formats a number or string into a space-separated string (e.g. 1000 -> "1 000", 15000000 -> "15 000 000")
 */
export function formatFormattedNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val);
  const isNegative = strVal.startsWith('-');
  const cleanDigits = strVal.replace(/\D/g, '');
  if (!cleanDigits) return '';
  const formatted = cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parses raw numeric string by stripping non-digit characters (e.g. "15 000 000" -> "15000000")
 */
export function parseRawNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val);
  const isNegative = strVal.startsWith('-');
  const cleanDigits = strVal.replace(/\D/g, '');
  if (!cleanDigits) return '';
  return isNegative ? `-${cleanDigits}` : cleanDigits;
}
