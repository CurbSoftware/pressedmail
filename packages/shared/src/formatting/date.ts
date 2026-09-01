/**
 * Date Formatting Utilities
 *
 * Provides consistent date formatting across the application.
 * Uses Intl.DateTimeFormat for localization support.
 *
 * These functions are designed to be compatible with the web/lib formatting
 * conventions used across the admin dashboard.
 */

/** Default fallback for invalid date values */
const DEFAULT_FALLBACK = '-';

/**
 * Helper to parse and validate date input
 * @returns Date object or null if invalid
 */
function parseDate(
  date: Date | number | string | null | undefined,
): Date | null {
  if (date === null || date === undefined) return null;

  const dateObj = date instanceof Date ? date : new Date(date);

  // Check for invalid date
  if (Number.isNaN(dateObj.getTime())) return null;

  return dateObj;
}

/**
 * Format date as "January 15, 2025" (long month name)
 *
 * @param date Date object, timestamp, or ISO string (accepts null/undefined)
 * @param locale Optional locale (default: en-US)
 * @param fallback Value to return for invalid input (default: "-")
 * @returns Formatted date string or fallback value
 * @example formatDate('2025-01-15') => "January 15, 2025"
 */
export function formatDate(
  date: Date | number | string | null | undefined,
  locale: string = 'en-US',
  fallback: string = DEFAULT_FALLBACK,
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return fallback;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format date as "Jan 15, 2025" (short month name)
 *
 * @param date Date object, timestamp, or ISO string (accepts null/undefined)
 * @param locale Optional locale (default: en-US)
 * @param fallback Value to return for invalid input (default: "-")
 * @returns Formatted short date string or fallback value
 * @example formatDateShort('2025-01-15') => "Jan 15, 2025"
 */
export function formatDateShort(
  date: Date | number | string | null | undefined,
  locale: string = 'en-US',
  fallback: string = DEFAULT_FALLBACK,
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return fallback;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format date as "1/15/25" (numeric short form)
 *
 * @param date Date object, timestamp, or ISO string (accepts null/undefined)
 * @param locale Optional locale (default: en-US)
 * @param fallback Value to return for invalid input (default: "-")
 * @returns Formatted numeric date string or fallback value
 * @example formatDateNumeric('2025-01-15') => "1/15/25"
 */
export function formatDateNumeric(
  date: Date | number | string | null | undefined,
  locale: string = 'en-US',
  fallback: string = DEFAULT_FALLBACK,
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return fallback;

  return new Intl.DateTimeFormat(locale, {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format date as "January 15, 2025 at 2:30 PM"
 *
 * @param date Date object, timestamp, or ISO string (accepts null/undefined)
 * @param locale Optional locale (default: en-US)
 * @param fallback Value to return for invalid input (default: "-")
 * @returns Formatted date-time string or fallback value
 * @example formatDateTime('2025-01-15T10:30:00') => "January 15, 2025 at 10:30 AM"
 */
export function formatDateTime(
  date: Date | number | string | null | undefined,
  locale: string = 'en-US',
  fallback: string = DEFAULT_FALLBACK,
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return fallback;

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Format a date range
 *
 * @param start Start date
 * @param end End date
 * @param locale Optional locale (default: en-US)
 * @returns Formatted date range string
 * @example formatDateRange('2025-01-01', '2025-01-31') => "Jan 1, 2025 - Jan 31, 2025"
 */
export function formatDateRange(
  start: Date | number | string | null | undefined,
  end: Date | number | string | null | undefined,
  locale: string = 'en-US',
): string {
  const startFormatted = formatDateShort(start, locale);
  const endFormatted = formatDateShort(end, locale);

  if (
    startFormatted === DEFAULT_FALLBACK &&
    endFormatted === DEFAULT_FALLBACK
  ) {
    return DEFAULT_FALLBACK;
  }
  if (startFormatted === DEFAULT_FALLBACK) return `... - ${endFormatted}`;
  if (endFormatted === DEFAULT_FALLBACK) return `${startFormatted} - ...`;

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Format relative time as "2 hours ago"
 *
 * @param date Date object, timestamp, or ISO string (accepts null/undefined)
 * @param locale Optional locale (default: en-US)
 * @param fallback Value to return for invalid input (default: "-")
 * @returns Relative time string or fallback value
 */
export function formatRelativeTime(
  date: Date | number | string | null | undefined,
  locale: string = 'en-US',
  fallback: string = DEFAULT_FALLBACK,
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return fallback;

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSecs) < 60) {
    return rtf.format(-diffSecs, 'second');
  } else if (Math.abs(diffMins) < 60) {
    return rtf.format(-diffMins, 'minute');
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(-diffHours, 'hour');
  } else {
    return rtf.format(-diffDays, 'day');
  }
}
