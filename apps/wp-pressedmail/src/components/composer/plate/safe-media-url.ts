/**
 * Returns the URL only when it is an absolute http: or https: URL.
 *
 * Plate copies data-slate-* attributes from pasted HTML onto media nodes, and
 * the Free build runs on WordPress's React 18, which renders javascript: URLs
 * without complaint. So every media node checks the scheme itself before a URL
 * becomes an iframe src, a media src or a link href.
 */
export function safeMediaUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;

  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
