/**
 * Byte Formatting Utilities
 *
 * Provides human-readable byte formatting.
 *
 * Compatible with the web/lib formatting conventions used across the admin dashboard.
 */

/** Default fallback for invalid byte values */
const DEFAULT_FALLBACK = '-';

/**
 * Format bytes as human-readable string
 *
 * @param bytes Number of bytes (accepts null/undefined)
 * @param decimals Number of decimal places (default: 1)
 * @param fallback Value to return for null/undefined/NaN/0 input (default: "-")
 * @returns Formatted byte string (e.g., "1.5 KB") or fallback value
 * @example formatBytes(1536) => "1.5 KB"
 * @example formatBytes(1048576) => "1 MB"
 * @example formatBytes(null) => "-"
 * @example formatBytes(0) => "-"
 */
export function formatBytes(
  bytes: number | null | undefined,
  decimals: number = 1,
  fallback: string = DEFAULT_FALLBACK,
): string {
  // Return fallback for null, undefined, NaN, or zero
  if (
    bytes === null ||
    bytes === undefined ||
    Number.isNaN(bytes) ||
    bytes === 0
  ) {
    return fallback;
  }

  // Return fallback for negative values
  if (bytes < 0) return fallback;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Safety check for extremely large values
  if (i >= sizes.length) {
    return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)} ${sizes[sizes.length - 1]}`;
  }

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
