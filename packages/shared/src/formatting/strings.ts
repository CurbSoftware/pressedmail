/**
 * String Formatting Utilities
 *
 * Provides common string manipulation utilities.
 */

/**
 * Truncate string to specified length with ellipsis
 *
 * @param str String to truncate (accepts null/undefined)
 * @param maxLength Maximum length (default: 100)
 * @returns Truncated string or empty string for null/undefined
 */
export function truncate(
  str: string | null | undefined,
  maxLength: number = 100,
): string {
  if (str === null || str === undefined) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of string
 *
 * @param str String to capitalize (accepts null/undefined)
 * @returns Capitalized string or empty string for null/undefined
 */
export function capitalize(str: string | null | undefined): string {
  if (str === null || str === undefined || str.length === 0) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to URL-friendly slug
 *
 * Handles Unicode characters by normalizing to ASCII equivalents where possible
 * (e.g., "naïve" becomes "naive", "café" becomes "cafe").
 *
 * @param str String to slugify (accepts null/undefined)
 * @returns Slugified string or empty string for null/undefined
 */
export function slugify(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';

  return (
    str
      .toLowerCase()
      // Normalize unicode characters (NFD decomposes accents from letters)
      .normalize('NFD')
      // Remove combining diacritical marks (accents)
      .replace(/[\u0300-\u036f]/g, '')
      // Replace any non-alphanumeric characters (except spaces) with nothing
      .replace(/[^a-z0-9 ]/g, '')
      // Replace spaces with hyphens
      .replace(/ +/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Pluralize word based on count
 *
 * Note: This is a simple English-only implementation. For complex pluralization
 * rules or other languages, consider using a dedicated i18n library.
 *
 * @param word Word to pluralize (accepts null/undefined)
 * @param count Number to determine plurality
 * @returns Pluralized word or empty string for null/undefined
 */
export function pluralize(
  word: string | null | undefined,
  count: number,
): string {
  if (word === null || word === undefined) return '';
  return count === 1 ? word : word + 's';
}
