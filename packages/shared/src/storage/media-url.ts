export type MediaObject = {
  key: string;
};

/** What Next 16 passes a custom loader: never its config. */
export type StorageImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

/**
 * The one quality every image is served at: Next 16's default
 * `images.qualities` is [75], so its own loader snaps every request to it.
 * The zone's WAF rule (scripts/media/transformations-waf-rule.mjs) refuses
 * any other /cdn-cgi/image/ quality.
 */
export const IMAGE_QUALITY = 75;

/**
 * Cloudflare Stream delivery for the account's videos. Every video, the
 * website's and the CMS uploads alike, plays from this host.
 */
export const STREAM_CUSTOMER_HOST =
  'customer-lr2yek5xzedbiom8.cloudflarestream.com';

/**
 * The hosts a Stream direct upload URL can point at: the dashboard's browser
 * posts a CMS video there, so its CSP allows them and the server checks them.
 */
export const STREAM_UPLOAD_ORIGINS = [
  'https://upload.cloudflarestream.com',
  'https://upload.videodelivery.net',
];

const STREAM_MANIFEST = new RegExp(
  `^https://${STREAM_CUSTOMER_HOST.replaceAll('.', '\\.')}/([a-f0-9]{32})/manifest/video\\.m3u8$`,
);

function storageBaseUrl(value?: string) {
  return (
    value ??
    process.env.NEXT_PUBLIC_STORAGE_BASE_URL ??
    'https://s3.curb.software'
  ).replace(/\/+$/, '');
}

function encodeObjectKey(value: string) {
  const parts = value.replaceAll('\\', '/').split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '..')) {
    throw new Error('Invalid managed-storage object key');
  }
  return parts.map((part) => encodeURIComponent(part)).join('/');
}

export function getStoragePublicUrl(
  media: MediaObject,
  options: { baseUrl?: string } = {},
) {
  return `${storageBaseUrl(options.baseUrl)}/${encodeObjectKey(media.key)}`;
}

export function streamManifestUrl(uid: string) {
  return `https://${STREAM_CUSTOMER_HOST}/${uid}/manifest/video.m3u8`;
}

/** A Stream video's thumbnail, or null when `src` is not a Stream manifest. */
export function streamThumbnailUrl(src: string) {
  const uid = STREAM_MANIFEST.exec(src)?.[1];

  return uid
    ? `https://${STREAM_CUSTOMER_HOST}/${uid}/thumbnails/thumbnail.jpg`
    : null;
}

/**
 * The next/image loader every app installs as `images.loaderFile`. An image
 * in R2 is resized and re-encoded at the edge by Cloudflare Image
 * Transformations on the storage host (AVIF or WebP, whichever the browser
 * takes); `onerror=redirect` serves the original if a transformation fails.
 * A file in the app's own public/ keeps Next's optimizer: the app leaves
 * `images.loader` at 'default', so /_next/image still runs. Anything else,
 * an SVG or another host (a Stream thumbnail), is served as it is: the
 * optimizer would refuse a host outside `remotePatterns` with a 400.
 */
export function storageImageLoader({ src, width }: StorageImageLoaderProps) {
  const base = storageBaseUrl();

  // An SVG scales on its own; Next's default loader serves it as is too.
  if (src.split('?', 1)[0]!.endsWith('.svg')) {
    return src;
  }

  if (src.startsWith(`${base}/`)) {
    return `${base}/cdn-cgi/image/width=${width},quality=${IMAGE_QUALITY},format=auto,onerror=redirect/${src.slice(base.length + 1)}`;
  }

  if (!src.startsWith('/') || src.startsWith('//')) {
    return src;
  }

  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${IMAGE_QUALITY}`;
}

/** The app-wide loader does the work; nothing extra per image. */
export function getStorageImageLoaderProps(
  _src: string,
): Record<string, never> {
  return {};
}
