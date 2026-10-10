import {
  type PaidAttribution,
  capturePaidAttribution,
} from './paid-attribution';

export const MARKETING_ATTRIBUTION_COOKIE = 'curb_marketing_session';
export const MARKETING_ATTRIBUTION_TTL = 30 * 86400;
export type MarketingTouch = {
  parameters: PaidAttribution;
  landingPath: string;
  capturedAt: string;
};

/** Public path only: never persist authentication tokens or workspace URLs. */
export function marketingPath(value: string) {
  if (!/^\/[a-zA-Z0-9/_-]{0,200}$/.test(value) || value.startsWith('//'))
    return '/';
  const path =
    value.replace(/^\/(en|es|fr|de|it|pt-br|nl|ja|zh-hans)(?=\/|$)/, '') || '/';
  return /^\/(auth|home|api)(\/|$)/.test(path) ? '/' : value;
}

export function marketingTouch(
  query: string,
  path: string,
  now = Date.now(),
): MarketingTouch {
  return {
    parameters: capturePaidAttribution(
      new URLSearchParams(query.slice(0, 4096)),
    ),
    landingPath: marketingPath(path),
    capturedAt: new Date(now).toISOString(),
  };
}

export function marketingProperties(touch?: MarketingTouch | null) {
  const p = touch?.parameters ?? {};
  return Object.fromEntries(
    Object.entries({
      source: p.utm_source,
      medium: p.utm_medium,
      campaign: p.utm_campaign,
      campaign_id: p.utm_id,
      ad_group_id: ['openai', 'chatgpt'].includes(p.utm_source ?? '')
        ? p.utm_term
        : undefined,
      ad_id: p.utm_content,
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
}

/** Keep UTM reporting while dropping click references and unrecognized query data. */
export function marketingAnalyticsUrl(
  value: string,
  base = 'https://pressedmail.com',
) {
  try {
    const url = new URL(value, base);
    const parameters = capturePaidAttribution(url.searchParams);
    const search = new URLSearchParams();
    for (const [key, item] of Object.entries(parameters))
      if (key.startsWith('utm_')) search.set(key, item);
    return `${marketingPath(url.pathname)}${search.size ? `?${search}` : ''}`;
  } catch {
    return '/';
  }
}

// ISO 4217 minor units differ from display precision and some Stripe encodings.
const ISO_ZERO_DIGITS = new Set(
  'BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF'.split(
    ' ',
  ),
);
const ISO_THREE_DIGITS = new Set('BHD IQD JOD KWD LYD OMR TND'.split(' '));

export function currencyMinorDigits(currency: string) {
  if (!/^[a-zA-Z]{3}$/.test(currency)) throw new Error('Invalid currency');
  const code = currency.toUpperCase();
  return ISO_ZERO_DIGITS.has(code)
    ? 0
    : ISO_THREE_DIGITS.has(code)
      ? 3
      : code === 'CLF' || code === 'UYW'
        ? 4
        : 2;
}

/** Convert verified Stripe charge units, preserving integer ISO minor units. */
export function stripeMarketingMoney(amount: number, currency: string) {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !/^[a-zA-Z]{3}$/.test(currency)
  )
    throw new Error('Invalid transaction money');
  const code = currency.toUpperCase();
  const factor = 10 ** currencyMinorDigits(code);
  const divisor =
    code === 'ISK' || code === 'UGX' ? 100 : code === 'MGA' ? 1 : factor;
  const revenue = amount / divisor;
  // Convert integers directly so ordinary values such as USD 1.11 stay exact.
  const minor =
    factor >= divisor
      ? amount * (factor / divisor)
      : amount / (divisor / factor);
  if (!Number.isSafeInteger(minor))
    throw new Error('Invalid currency precision');
  return { revenue, currency: code, minor };
}
