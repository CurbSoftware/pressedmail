/**
 * Check if the code is running in a browser environment.
 */
export function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * @name formatCurrency
 * @description Format the currency based on the currency code
 */
export function formatCurrency(params: {
  currencyCode: string;
  locale: string;
  value: string | number;
}) {
  const [lang, region] = params.locale.split('-');

  return new Intl.NumberFormat(region ?? lang, {
    style: 'currency',
    currency: params.currencyCode,
  }).format(Number(params.value));
}

/**
 * @name isSafeRedirectPath
 * @description Checks if a path is safe for redirects (prevents open redirect attacks).
 * Safe paths must:
 * - Start with a single `/`
 * - NOT start with `//` (protocol-relative URLs)
 * - NOT contain `://` (absolute URLs)
 * - NOT contain backslash (URL normalization attacks)
 */
export function isSafeRedirectPath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;

  // Must start with exactly one forward slash (relative path)
  if (!path.startsWith('/') || path.startsWith('//')) return false;

  // Must not contain protocol indicators
  if (path.includes('://')) return false;

  // Must not contain backslashes (can be normalized to forward slashes)
  if (path.includes('\\')) return false;

  return true;
}

/**
 * @name getSafeRedirectPath
 * @description Returns the path if safe, otherwise returns the fallback.
 * Use this to validate user-supplied redirect URLs to prevent open redirect attacks.
 */
export function getSafeRedirectPath(
  path: string | null | undefined,
  fallback: string,
): string {
  if (path && isSafeRedirectPath(path)) {
    return path;
  }

  return fallback;
}

/**
 * @name isLocalhostLikeHostname
 * @description Detect loopback and reserved local-development hostnames.
 */
export function isLocalhostLikeHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  );
}

const DASHBOARD_HOSTNAMES = new Set(['curb.software']);

/**
 * @name isDashboardHostname
 * @description Detect dashboard hostnames that should prefer same-origin auth routes.
 */
export function isDashboardHostname(hostname: string): boolean {
  return DASHBOARD_HOSTNAMES.has(hostname);
}

const PRODUCTION_PRODUCT_HOSTNAMES = new Set([
  'pressedmail.com',
  'curbpress.com',
  'pressednotes.com',
]);

/**
 * @name getDashboardAdminUrlFromSiteUrl
 * @description Resolve the dashboard admin URL using the caller site URL.
 */
export function getDashboardAdminUrlFromSiteUrl(siteUrl?: string): string {
  if (!siteUrl) {
    return 'http://localhost:3004/admin';
  }

  try {
    const url = new URL(siteUrl);
    const { hostname } = url;

    if (isDashboardHostname(hostname)) {
      return `${url.origin}/admin`;
    }

    if (PRODUCTION_PRODUCT_HOSTNAMES.has(hostname)) {
      return 'https://curb.software/admin';
    }

    if (isLocalhostLikeHostname(hostname)) {
      return 'http://localhost:3004/admin';
    }

    return 'http://localhost:3004/admin';
  } catch {
    return 'http://localhost:3004/admin';
  }
}
