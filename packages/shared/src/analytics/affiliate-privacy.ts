/**
 * Centralized privacy decision for affiliate attribution.
 *
 * Affiliate attribution serves the operator's and the affiliate's marketing
 * and compensation purposes, so it is not a strictly necessary cookie. The
 * decision whether tracking may persist therefore lives here, in one place,
 * instead of being re-invented inside each product site or service.
 *
 * Outcomes:
 * - 'persist': the server may write the attribution cookie and record a visit.
 * - 'defer':   no cookie yet; the validated code is held in the URL hash so a
 *              later consent acceptance can claim it server-side.
 * - 'deny':    nothing persists and no hash is emitted.
 *
 * GPC and DNT policy is intentionally centralized here. Sites and services
 * must not layer their own conflicting interpretations on top.
 */

/** Existing first-party consent cookie written by the cookie banner flow. */
export const AFFILIATE_TRACKING_CONSENT_COOKIE = 'curb_tracking_consent';

/**
 * Whether a Global Privacy Control signal opts the visitor out of affiliate
 * tracking. GPC is a recognized opt-out signal in several jurisdictions, so
 * the conservative reading is applied centrally for affiliate attribution.
 */
export const AFFILIATE_GPC_OPT_OUT = true;

/**
 * Whether a Do Not Track header opts the visitor out. DNT is not a consent
 * substitute; it is treated as an explicit privacy opt-out signal only.
 */
export const AFFILIATE_DNT_OPT_OUT = true;

export type AffiliateTrackingPermission = 'persist' | 'defer' | 'deny';

export function readAffiliateTrackingConsent(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${AFFILIATE_TRACKING_CONSENT_COOKIE}=`;
  const value = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function hasAffiliatePrivacyOptOut(headers: Pick<Headers, 'get'>) {
  const gpc = headers.get('sec-gpc') === '1' && AFFILIATE_GPC_OPT_OUT;
  const dnt = headers.get('dnt') === '1' && AFFILIATE_DNT_OPT_OUT;

  return gpc || dnt;
}

/**
 * Resolve the tracking permission for a request.
 *
 * @param headers request headers (DNT / GPC signals)
 * @param trackingConsent value of the consent cookie, when available
 */
export function resolveAffiliateTrackingPermission(input: {
  headers: Pick<Headers, 'get'>;
  trackingConsent?: string | null;
}): AffiliateTrackingPermission {
  if (hasAffiliatePrivacyOptOut(input.headers)) {
    return 'deny';
  }

  return input.trackingConsent === 'accepted' ? 'persist' : 'defer';
}
