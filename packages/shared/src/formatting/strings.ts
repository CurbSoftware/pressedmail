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

/**
 * Drop what lets text from a stranger spoof or hide what an admin reads:
 * every control and format character (bidi overrides and isolates,
 * zero-width spaces, the BOM, invisible operators, the tag characters used
 * to smuggle hidden text) and the blank letters that render as nothing
 * (Hangul fillers, the braille blank, the combining grapheme joiner).
 * Joiners (ZWJ, ZWNJ) and soft hyphens stay: emoji sequences and Persian or
 * Indic words need them. With `keepLines`, newlines and tabs stay too.
 */
export function stripInvisible(str: string, keepLines = false): string {
  return str.replace(
    /[\p{Cc}\p{Cf}\u034F\u115F\u1160\u2800\u3164\uFFA0]/gu,
    (char) =>
      char === '\u200C' ||
      char === '\u200D' ||
      char === '\u00AD' ||
      (keepLines && (char === '\n' || char === '\r' || char === '\t'))
        ? char
        : '',
  );
}

/**
 * A message without its opening greeting line ("Hi Dana,", "Hello team"),
 * so a preview or a title starts with what the message is about. Only a
 * short line on its own goes: "Hi, my licence key fails" is the message.
 */
export function stripGreeting(message: string): string {
  return message
    .replace(
      /^\s*(hi|hello|hey|dear|greetings|good (morning|afternoon|evening))\b[^\n]{0,30}\r?\n+/i,
      '',
    )
    .trim();
}
