export type MediaObject = {
  key: string;
};

export type StorageImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

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

/** Cloudflare R2 serves the original object; Next.js handles image sizing. */
export function storageImageLoader(props: StorageImageLoaderProps) {
  return props.src;
}

/** No custom loader is needed for the R2 public-media gateway. */
export function getStorageImageLoaderProps(
  _src: string,
): Record<string, never> {
  return {};
}
