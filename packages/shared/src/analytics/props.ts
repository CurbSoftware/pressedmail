/**
 * Property keys and payload sanitisation for Umami events.
 *
 * Umami enforces hard limits on event data: 50 properties per event, 500
 * characters per string, four decimal places on numbers. Exceeding them
 * silently truncates or drops data, so {@link sanitizeUmamiProps} applies the
 * limits before anything is sent.
 *
 * Note that the declarative path (`data-umami-event-*`) bypasses this guard
 * entirely: Umami reads those attributes off the DOM without consulting our
 * code. Keep declarative payloads to a handful of short values by convention.
 */

/** Umami accepts at most 50 properties per event. */
export const UMAMI_MAX_PROPERTIES = 50;

/** Umami truncates string values beyond 500 characters. */
export const UMAMI_MAX_STRING_LENGTH = 500;

/** Umami rejects event names longer than 50 characters. */
export const UMAMI_MAX_EVENT_NAME_LENGTH = 50;

export type UmamiValue = boolean | number | string | null;
export type UmamiPayload = Record<string, UmamiValue>;

/**
 * The canonical property keys.
 *
 * These are **kebab-case** because that is what the declarative path produces:
 * Umami turns `data-umami-event-nav-label` into the property `nav-label`.
 * Imperative calls must use the same spelling, or the dashboard grows two
 * columns describing one thing.
 */
export const UMAMI_PROPS = [
  // context
  'product',
  'path',
  'section',
  'location',
  'state',
  'depth',
  // cta
  'cta-id',
  'cta-label',
  'cta-location',
  'cta-target',
  'cta-variant',
  // navigation
  'nav-label',
  'nav-location',
  'nav-target',
  'footer-column',
  'footer-label',
  'footer-target',
  // pricing and checkout
  'plan-id',
  'plan-name',
  'plan-tier',
  'plan-price',
  'product-slug',
  'checkout-mode',
  'account-created',
  'interval',
  'currency',
  'from-plan',
  'to-plan',
  // forms
  'form-id',
  'form-location',
  'topic',
  'reason',
  'status',
  // auth
  'auth-method',
  'auth-provider',
  // links and media
  'link-host',
  'link-target',
  'link-scheme',
  'link-location',
  'file-ext',
  'file-name',
  'video',
  'progress',
  // misc widgets
  'message-length',
  'consent-status',
  'banner-id',
  'faq-id',
  'tab-group',
  'tab-id',
] as const;

export type UmamiPropKey = (typeof UMAMI_PROPS)[number];

function truncate(value: string) {
  return value.length > UMAMI_MAX_STRING_LENGTH
    ? value.slice(0, UMAMI_MAX_STRING_LENGTH)
    : value;
}

/**
 * Coerce one value into something Umami stores predictably.
 *
 * Returns `undefined` for values that should be dropped rather than sent as
 * the string `"undefined"`, which is what naive `String(value)` produces and
 * what then shows up as a real property value in the dashboard.
 */
export function sanitizeUmamiValue(value: unknown): UmamiValue | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    // Umami keeps four decimal places; NaN and Infinity have no useful
    // representation, so drop them instead of sending "NaN".
    return Number.isFinite(value) ? Number(value.toFixed(4)) : undefined;
  }

  if (typeof value === 'string') {
    return truncate(value);
  }

  if (Array.isArray(value)) {
    return truncate(value.join(','));
  }

  return truncate(String(value));
}

/**
 * Apply Umami's limits to a whole payload: drop empty values, coerce the rest,
 * and cap the property count.
 */
export function sanitizeUmamiProps(
  props: Record<string, unknown> | undefined,
): UmamiPayload {
  if (!props) {
    return {};
  }

  const sanitized: UmamiPayload = {};

  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(sanitized).length >= UMAMI_MAX_PROPERTIES) {
      break;
    }

    const next = sanitizeUmamiValue(value);

    if (next !== undefined) {
      sanitized[key] = next;
    }
  }

  return sanitized;
}

/**
 * Strip a URL down to host and pathname.
 *
 * Query strings on outbound links routinely carry email addresses, tokens and
 * campaign identifiers; none of that belongs in analytics.
 */
export function toSafeLinkTarget(href: string): string {
  try {
    const url = new URL(href);

    return truncate(`${url.origin}${url.pathname}`);
  } catch {
    return truncate(href.split('?')[0] ?? href);
  }
}
