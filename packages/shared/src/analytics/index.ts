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
