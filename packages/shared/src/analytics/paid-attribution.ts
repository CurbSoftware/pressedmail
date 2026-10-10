/** Bounded campaign data only. Never store a landing URL or customer identity. */
export const PAID_ATTRIBUTION_COOKIE = 'curb_paid_attribution';
export const PAID_ATTRIBUTION_CONSENT_COOKIE = 'curb_paid_consent_v1';
export const PAID_ATTRIBUTION_MAX_AGE = 30 * 86400;
export const PAID_ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_id',
  'utm_content',
  'utm_term',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ad_account_id',
  'click_id',
  'rdt_cid',
  'oppref',
] as const;
export type PaidAttribution = Partial<
  Record<(typeof PAID_ATTRIBUTION_KEYS)[number], string>
>;
/**
 * OpenAI's Pixel writes a first-party browser reference on our own domain, so
 * checkout reads it from the request rather than from the URL. It is a second
 * match signal, never a substitute for `oppref`.
 */
export const OPENAI_BROWSER_REFERENCE_COOKIE = '__obref';
const OPENAI_BROWSER_REFERENCE_PATTERN = /^[A-Za-z0-9_=-]{1,200}$/;

export const PAID_ATTRIBUTION_METADATA_KEYS = [
  ...PAID_ATTRIBUTION_KEYS,
  'obref',
  'attribution_consent',
  'attribution_captured_at',
  'attribution_user_agent',
  'marketing_attribution_id',
] as const;

/** Opaque, unmodified, or nothing at all. Never guess at the contents. */
export function captureBrowserReference(value: string | undefined) {
  return value && OPENAI_BROWSER_REFERENCE_PATTERN.test(value)
    ? value
    : undefined;
}

export function capturePaidAttribution(
  params: URLSearchParams,
): PaidAttribution {
  const result: PaidAttribution = {};
  for (const key of PAID_ATTRIBUTION_KEYS) {
    const values = params.getAll(key);
    // Conflicting repeated parameters are ambiguous, so do not persist them.
    const value = new Set(values).size === 1 ? values[0] : undefined;
    const pattern = key.startsWith('utm_')
      ? /^[a-zA-Z0-9][a-zA-Z0-9 _./:+-]{0,99}$/
      : key === 'oppref' || key === 'click_id'
        ? // URL-unreserved characters plus base64 padding, capped at Stripe's
          // 500-character metadata limit so a valid identifier can never break
          // checkout. Shape and length only: the value is opaque, never
          // decoded, and slightly wider than today's base64url tokens so a
          // format change costs conversions rather than silently dropping them.
          /^[A-Za-z0-9._~=-]{1,500}$/
        : /^[a-zA-Z0-9_.-]{1,250}$/;
    if (value && pattern.test(value))
      result[key] =
        key === 'utm_source' || key === 'utm_medium'
          ? value.trim().toLowerCase()
          : value;
  }
  if (['openai', 'chatgpt'].includes(result.utm_source ?? '')) {
    if (!params.has('oppref') && result.click_id)
      result.oppref = result.click_id;
    // Repeated normalization must not resurrect a rejected canonical reference.
    else if (params.has('oppref') && !result.oppref) delete result.click_id;
  }
  return result;
}

export function encodePaidAttribution(data: PaidAttribution, now = Date.now()) {
  return JSON.stringify({
    ...capturePaidAttribution(new URLSearchParams(data)),
    attribution_consent: 'accepted',
    attribution_captured_at: new Date(now).toISOString(),
  });
}

export function readPaidAttribution(
  value: string | undefined,
  consent: string | undefined,
  privacyOptOut: boolean,
  now = Date.now(),
): Record<string, string> | undefined {
  if (consent !== 'accepted' || privacyOptOut || !value || value.length > 3000)
    return;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const data = parsed as Record<string, unknown>;
    const timestamp =
      typeof data.attribution_captured_at === 'string'
        ? Date.parse(data.attribution_captured_at)
        : NaN;
    if (
      data.attribution_consent !== 'accepted' ||
      !Number.isFinite(timestamp) ||
      timestamp > now + 300000 ||
      now - timestamp > PAID_ATTRIBUTION_MAX_AGE * 1000
    )
      return;
    const params = new URLSearchParams();
    for (const key of PAID_ATTRIBUTION_KEYS) {
      if (typeof data[key] === 'string') params.set(key, data[key]);
    }
    const attribution = capturePaidAttribution(params);
    if (Object.keys(attribution).length === 0) return;
    return {
      ...attribution,
      attribution_consent: 'accepted',
      attribution_captured_at: new Date(timestamp).toISOString(),
    };
  } catch {
    return;
  }
}
