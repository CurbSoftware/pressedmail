export {
  UMAMI_AUTH_METHODS,
  UMAMI_EVENTS,
  UMAMI_FAILURE_REASONS,
  type UmamiAuthMethod,
  type UmamiEventName,
  type UmamiFailureReason,
} from './events';

export {
  UMAMI_MAX_EVENT_NAME_LENGTH,
  UMAMI_MAX_PROPERTIES,
  UMAMI_MAX_STRING_LENGTH,
  UMAMI_PROPS,
  sanitizeUmamiProps,
  sanitizeUmamiValue,
  toSafeLinkTarget,
  type UmamiPayload,
  type UmamiPropKey,
  type UmamiValue,
} from './props';

export { umamiClick } from './attrs';
export {
  PAID_ATTRIBUTION_COOKIE,
  PAID_ATTRIBUTION_CONSENT_COOKIE,
  PAID_ATTRIBUTION_MAX_AGE,
  PAID_ATTRIBUTION_KEYS,
  PAID_ATTRIBUTION_METADATA_KEYS,
  OPENAI_BROWSER_REFERENCE_COOKIE,
  captureBrowserReference,
  capturePaidAttribution,
  encodePaidAttribution,
  readPaidAttribution,
  type PaidAttribution,
} from './paid-attribution';

export {
  getUmamiGlobalProps,
  identifyUmamiSession,
  identifyUmamiUser,
  onUmamiReady,
  resetUmamiGlobalProps,
  setUmamiGlobalProps,
  trackUmamiEvent,
} from './track';

export {
  resolveDelegatedClick,
  type DelegatedClickOptions,
  type DelegatedClickResult,
} from './delegate';

export {
  AFFILIATE_TRACKING_CONSENT_COOKIE,
  type AffiliateTrackingPermission,
  hasAffiliatePrivacyOptOut,
  readAffiliateTrackingConsent,
  resolveAffiliateTrackingPermission,
} from './affiliate-privacy';
