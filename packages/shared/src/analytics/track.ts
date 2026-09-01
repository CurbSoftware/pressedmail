import type { UmamiEventName } from './events';
import type { UmamiPayload, UmamiValue } from './props';
import { sanitizeUmamiProps } from './props';

/**
 * Imperative Umami tracking.
 *
 * Everything here no-ops safely when `window.umami` is absent, which is the
 * normal state before the tracker script loads and the permanent state for a
 * visitor who rejected cookies. Nothing is queued and nothing is stored: an
 * event fired while the tracker is missing is simply dropped.
 */

type UmamiTracker =
  | {
      track?: (eventName: string, payload?: UmamiPayload) => void;
      identify?: (
        idOrData: string | Record<string, UmamiValue>,
        data?: Record<string, UmamiValue>,
      ) => void;
    }
  | ((eventName: string, payload?: UmamiPayload) => void);

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

/**
 * Properties added to every imperative event.
 *
 * Umami has no notion of global event properties, so we inject our own. The
 * declarative `data-umami-event-*` path cannot be reached this way. Umami
 * reads those attributes directly off the DOM, which is why product and
 * locale are *also* sent as session data via {@link identifyUmamiSession}.
 */
let globalProps: UmamiPayload = {};

export function setUmamiGlobalProps(props: Record<string, unknown>) {
  globalProps = sanitizeUmamiProps(props);
}

export function getUmamiGlobalProps(): UmamiPayload {
  return { ...globalProps };
}

/** Test seam: drop the injected globals between cases. */
export function resetUmamiGlobalProps() {
  globalProps = {};
}

function getTracker() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.umami;
}

/** How long to wait for the deferred tracker script before giving up. */
const TRACKER_READY_TIMEOUT_MS = 10_000;
const TRACKER_POLL_INTERVAL_MS = 100;

/**
 * Run something once the tracker exists.
 *
 * The script is loaded with `afterInteractive`, so `window.umami` appears some
 * time after React has mounted. Anything fired *during* mount (a 404, a
 * completed checkout, the session `identify`) therefore lands in the gap and
 * is silently dropped. Measured: a 404 page produced the automatic pageview
 * and nothing else.
 *
 * Returns a cleanup function so a component that unmounts first stops waiting.
 */
export function onUmamiReady(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (getTracker()) {
    callback();

    return () => undefined;
  }

  const deadline = Date.now() + TRACKER_READY_TIMEOUT_MS;
  const timer = window.setInterval(() => {
    if (getTracker()) {
      window.clearInterval(timer);
      callback();

      return;
    }

    // A visitor who rejected cookies never gets a tracker. Stop waiting rather
    // than leave an interval running for the life of the page.
    if (Date.now() > deadline) {
      window.clearInterval(timer);
    }
  }, TRACKER_POLL_INTERVAL_MS);

  return () => window.clearInterval(timer);
}

/**
 * Track an event by name, with the global properties merged in.
 *
 * Explicit properties win over globals, so a component can override `path`
 * when the event describes somewhere other than the current page.
 */
export function trackUmamiEvent(
  eventName: UmamiEventName,
  payload: Record<string, unknown> = {},
) {
  const tracker = getTracker();

  if (!tracker) {
    return;
  }

  const data = { ...globalProps, ...sanitizeUmamiProps(payload) };

  if (typeof tracker === 'function') {
    tracker(eventName, data);
    return;
  }

  tracker.track?.(eventName, data);
}

/**
 * Attach a distinct ID to the current session, optionally with session data.
 *
 * Umami caps the ID at 50 characters. Longer identifiers are dropped rather
 * than truncated, since a truncated account ID is both useless and still
 * identifying.
 */
export function identifyUmamiUser(
  userId: string,
  traits?: Record<string, unknown>,
) {
  const tracker = getTracker();

  if (!tracker || typeof tracker === 'function' || !userId) {
    return;
  }

  if (userId.length > 50) {
    return;
  }

  tracker.identify?.(userId, traits ? sanitizeUmamiProps(traits) : undefined);
}

/** Save session data without assigning a distinct ID. */
export function identifyUmamiSession(traits: Record<string, unknown>) {
  const tracker = getTracker();

  if (!tracker || typeof tracker === 'function') {
    return;
  }

  tracker.identify?.(sanitizeUmamiProps(traits));
}
