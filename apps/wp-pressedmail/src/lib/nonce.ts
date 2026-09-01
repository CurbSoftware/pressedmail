/**
 * WordPress REST nonce lifecycle.
 *
 * WP REST nonces expire on the nonce tick (~12h). Once expired, EVERY authenticated
 * REST call 403s with `rest_cookie_invalid_nonce` ("Cookie check failed") until the
 * page reloads. `getRuntimeWpNonce()` reads `window.pressedmailPlugin.wpApiSettings.nonce`
 * FRESH per request, so swapping that value in place transparently re-authenticates all
 * subsequent calls.
 *
 * This module owns nonce renewal/storage. `api-client.ts` calls `refreshRestNonce()` when
 * a request 403s on a stale nonce; `useNonceRefresh` proactively feeds it fresh nonces
 * from the WordPress Heartbeat tick. Reactive renewal uses WordPress core's `rest-nonce`
 * AJAX action, so the plugin registers no nonce-less handler of its own.
 */

import { getRuntimeWpNonce } from "./runtime-config";

/**
 * Swap the runtime REST nonce in place so every later `getRuntimeWpNonce()` read (and
 * therefore every later request) uses the fresh value.
 */
type RuntimeNonceListener = () => void;

const runtimeNonceListeners = new Set<RuntimeNonceListener>();

/** Subscribe UI surfaces whose URLs embed the REST nonce instead of using apiFetch. */
export function subscribeRuntimeNonce(
  listener: RuntimeNonceListener,
): () => void {
  runtimeNonceListeners.add(listener);
  return () => runtimeNonceListeners.delete(listener);
}

export function setRuntimeNonce(fresh: string): void {
  if (typeof window === "undefined" || fresh.length === 0) {
    return;
  }

  const changed = getRuntimeWpNonce() !== fresh;
  const pluginSettings = window.pressedmailPlugin?.wpApiSettings;
  const frontendSettings = window.pressedmail;
  const runtimeWindow = window as unknown as {
    wpApiSettings?: { nonce?: string };
  };
  const coreSettings = runtimeWindow.wpApiSettings;

  if (pluginSettings) {
    pluginSettings.nonce = fresh;
  }
  if (frontendSettings) {
    frontendSettings.nonce = fresh;
  }
  if (coreSettings) {
    coreSettings.nonce = fresh;
  }
  if (!pluginSettings && !frontendSettings && !coreSettings) {
    runtimeWindow.wpApiSettings = { nonce: fresh };
  }

  if (changed) {
    runtimeNonceListeners.forEach((listener) => listener());
  }
}

/**
 * Resolve WordPress core's admin-ajax endpoint used to renew a REST nonce.
 */
export function getAdminAjaxUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return (
    window.pressedmailPlugin?.adminAjaxUrl ||
    (window as unknown as { ajaxurl?: string }).ajaxurl ||
    ""
  );
}

/** WordPress core action that returns a fresh REST nonce as plain text. */
const REFRESH_NONCE_ACTION = "rest-nonce";

// Single-flight: a burst of concurrent 403s only triggers ONE admin-ajax mint. The
// resolved nonce is shared by every waiter.
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Renew the REST nonce through WordPress core and store it in the runtime. Single-flight,
 * concurrent callers share one in-flight mint. Resolves to the fresh nonce, or `null`
 * when minting is impossible (no admin-ajax URL, non-2xx, or an empty payload, i.e. the
 * login cookie itself is gone / session expired).
 *
 * @param rawFetch Injectable fetch (defaults to the global). Kept for tests.
 */
export function refreshRestNonce(
  rawFetch: typeof fetch = fetch,
): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const url = getAdminAjaxUrl();
      if (!url) {
        return null;
      }
      const res = await rawFetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `action=${REFRESH_NONCE_ACTION}`,
      });
      if (!res.ok) {
        return null;
      }
      const fresh = (await res.text()).trim();
      if (fresh.length > 0) {
        setRuntimeNonce(fresh);
        return fresh;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Apply a nonce delivered by a WordPress Heartbeat tick (proactive refresh). Called by
 * `useNonceRefresh` from the `heartbeat-tick` handler when Heartbeat is enabled, so the
 * reactive mint in `api-client` rarely has to fire.
 */
export function applyHeartbeatNonce(data: unknown): void {
  const fresh = (
    data as { pressedmail_rest_nonce?: unknown } | null | undefined
  )?.pressedmail_rest_nonce;
  if (typeof fresh === "string" && fresh.length > 0) {
    setRuntimeNonce(fresh);
  }
}
