export const BANNER_DISMISSED_KEY = 'promo-banner-dismissed';

export const BANNER_STYLE_KEYS = [
  'primary',
  'surface',
  'background',
  'muted',
] as const;

export type BannerStyleKey = (typeof BANNER_STYLE_KEYS)[number];

export type BannerStyleConfig = {
  baseBg: string;
  text: string;
  link: string;
  dismiss: string;
};

const BANNER_STYLE_SET = new Set<string>(BANNER_STYLE_KEYS);

// Every style uses a fully opaque background. The banner is sticky and floats
// over page content when the header retracts on scroll, so a translucent
// background would let page content bleed through and make the text unreadable.
export const BANNER_STYLES: Record<BannerStyleKey, BannerStyleConfig> = {
  primary: {
    baseBg: 'bg-primary',
    text: 'text-primary-foreground',
    link: 'text-primary-foreground hover:text-primary-foreground',
    dismiss:
      'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10',
  },
  surface: {
    baseBg: 'bg-card border-b border-border',
    text: 'text-card-foreground',
    link: 'text-primary hover:text-primary/80',
    dismiss:
      'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
  },
  background: {
    baseBg: 'bg-background border-b border-border',
    text: 'text-foreground',
    link: 'text-primary hover:text-primary/80',
    dismiss:
      'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
  },
  muted: {
    baseBg: 'bg-muted border-b border-border',
    text: 'text-foreground',
    link: 'text-primary hover:text-primary/80',
    dismiss:
      'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
  },
};

export function isBannerStyleKey(style: string): style is BannerStyleKey {
  return BANNER_STYLE_SET.has(style);
}

export function normalizeBannerStyle(style: string | null | undefined) {
  return style && isBannerStyleKey(style) ? style : 'primary';
}

export function getBannerDismissalId(banner: {
  text: string;
  link_url: string | null;
  link_text: string | null;
  style: string;
}) {
  const content = JSON.stringify([
    banner.text.trim(),
    banner.link_url?.trim() ?? '',
    banner.link_text?.trim() ?? '',
    normalizeBannerStyle(banner.style),
  ]);

  let hash = 0x811c9dc5;

  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `v2:${(hash >>> 0).toString(36)}`;
}
