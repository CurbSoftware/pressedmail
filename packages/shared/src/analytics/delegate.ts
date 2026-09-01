import type { UmamiEventName } from './events';
import { UMAMI_EVENTS } from './events';
import { toSafeLinkTarget } from './props';

/**
 * Decide what (if anything) a click should record.
 *
 * This exists so the marketing runtime can cover hundreds of links without an
 * attribute on each one, while staying deliberately narrow. It only reports
 * what is genuinely inferable from the DOM: where a link goes, and whether an
 * element opted in with `data-analytics-cta`.
 *
 * It deliberately does **not** track every button. Doing so produces unbounded
 * label cardinality, records pure-UI toggles as if they were intent, and leaks
 * whatever user-supplied text happens to be rendered inside a button.
 *
 * Kept free of `window` so it can be unit-tested against a detached DOM.
 */

export interface DelegatedClickResult {
  event: UmamiEventName;
  payload: Record<string, string | number>;
}

export interface DelegatedClickOptions {
  /** `window.location.host` of the page the click happened on. */
  currentHost: string;
  /** Pathname recorded alongside the event. */
  path: string;
}

const DOWNLOAD_EXTENSION =
  /\.(zip|pdf|dmg|exe|pkg|csv|docx?|xlsx?|pptx?|txt|json|tar|gz|mp3|mp4)$/i;

/** Longest button/link text kept as a label. */
const MAX_LABEL_LENGTH = 60;

function readLabel(element: Element) {
  const explicit = element.getAttribute('aria-label')?.trim();

  if (explicit) {
    return explicit.slice(0, MAX_LABEL_LENGTH);
  }

  return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(
    0,
    MAX_LABEL_LENGTH,
  );
}

function readSection(element: Element) {
  const section = element.closest<HTMLElement>('[data-analytics-section]');

  return section?.dataset.analyticsSection?.trim() ?? '';
}

export function resolveDelegatedClick(
  target: Element | null,
  { currentHost, path }: DelegatedClickOptions,
): DelegatedClickResult | null {
  if (!target) {
    return null;
  }

  // Umami's own handler already fires for anything carrying an explicit event
  // attribute. Bailing here is what keeps declarative and delegated tracking
  // from double-counting the same click.
  if (target.closest('[data-umami-event]')) {
    return null;
  }

  const anchor = target.closest<HTMLAnchorElement>('a[href]');

  if (anchor) {
    const linkResult = resolveAnchor(anchor, { currentHost, path });

    if (linkResult) {
      return linkResult;
    }
  }

  const cta = target.closest<HTMLElement>('[data-analytics-cta]');

  if (cta) {
    const id = cta.dataset.analyticsCta?.trim();

    return {
      event: UMAMI_EVENTS.ctaClicked,
      payload: clean({
        'cta-id': id ?? '',
        'cta-label': readLabel(cta),
        'cta-location': readSection(cta),
        'cta-target': cta.getAttribute('href') ?? '',
        path,
      }),
    };
  }

  return null;
}

function resolveAnchor(
  anchor: HTMLAnchorElement,
  { currentHost, path }: DelegatedClickOptions,
): DelegatedClickResult | null {
  const href = anchor.getAttribute('href') ?? '';

  if (!href || href.startsWith('#')) {
    return null;
  }

  const scheme = href.split(':')[0]?.toLowerCase();

  if (scheme === 'mailto' || scheme === 'tel') {
    return {
      event: UMAMI_EVENTS.contactLinkClicked,
      payload: clean({
        'link-scheme': scheme,
        'link-location': readSection(anchor),
        path,
      }),
    };
  }

  // `anchor.href` is the browser-resolved absolute URL, so relative hrefs
  // resolve against the current document rather than throwing.
  const resolved = safeUrl(anchor.href);
  const isOutbound = Boolean(resolved) && resolved?.host !== currentHost;
  const isDownload =
    anchor.hasAttribute('download') ||
    DOWNLOAD_EXTENSION.test(resolved?.pathname ?? href);

  if (isDownload) {
    const pathname = resolved?.pathname ?? href;
    const fileName = pathname.split('/').pop() ?? '';

    return {
      event: UMAMI_EVENTS.fileDownloaded,
      payload: clean({
        'file-name': fileName,
        'file-ext': fileName.includes('.')
          ? (fileName.split('.').pop() ?? '').toLowerCase()
          : '',
        'link-location': readSection(anchor),
        path,
      }),
    };
  }

  if (isOutbound && resolved) {
    return {
      event: UMAMI_EVENTS.outboundLinkClicked,
      payload: clean({
        'link-host': resolved.host,
        'link-target': toSafeLinkTarget(resolved.href),
        'link-location': readSection(anchor),
        path,
      }),
    };
  }

  // Internal navigation is already a pageview. Recording it again would double
  // every internal link in the dashboard.
  return null;
}

function safeUrl(href: string) {
  try {
    return new URL(href);
  } catch {
    return undefined;
  }
}

function clean(payload: Record<string, string | number>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value != null),
  );
}
