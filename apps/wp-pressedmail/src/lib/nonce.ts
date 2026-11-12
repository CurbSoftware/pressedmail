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

import {
  captureRequestPrincipal,
  invalidatePrincipalStorage,
  isRequestPrincipalCurrent,
  type StoragePrincipal,
} from "./principal-storage";
import { getPluginRestBase, getRuntimeWpNonce } from "./runtime-config";

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

function matchesVerifiedPrincipal(
  captured: StoragePrincipal | null,
  evidence: unknown,
): boolean {
  if (!captured || !isRequestPrincipalCurrent(captured)) return false;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return false;
  }
  const { site, userId } = evidence as { site?: unknown; userId?: unknown };
  if (
    typeof site !== "string" ||
    !/^https?:\/\//i.test(site) ||
    // eslint-disable-next-line no-control-regex -- Reject control bytes in trusted principal URLs.
    /[\u0000-\u0020\u007f]/.test(site) ||
    typeof userId !== "number" ||
    !Number.isSafeInteger(userId) ||
    userId < 0
  ) {
    return false;
  }
  try {
    const url = new URL(site);
    if (url.username || url.password) return false;
    const normalizedSite =
      url.origin + (url.pathname.replace(/\/+$/, "") || "/");
    // Signed out. Nothing is purged: see the note on applyHeartbeatNonce.
    if (userId === 0) return false;
    if (normalizedSite !== captured.site || userId !== captured.userId) {
      invalidatePrincipalStorage("nonce-principal-changed");
      return false;
    }
    return isRequestPrincipalCurrent(captured);
  } catch {
    return false;
  }
}

/** Install only a credential accompanied by authenticated principal evidence. */
function setRuntimeNonce(
  fresh: string,
  captured: StoragePrincipal | null,
  evidence: unknown,
): boolean {
  if (fresh.length === 0 || !matchesVerifiedPrincipal(captured, evidence)) {
    return false;
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
  return isRequestPrincipalCurrent(captured);
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
 * Mint a candidate through WordPress core, then verify its authenticated site/user
 * before installing it. Concurrent callers share the mint and verification. Resolve
 * to null on failure or a principal change so callers cannot replay with another user.
 *
 * @param rawFetch Injectable fetch (defaults to the global). Kept for tests.
 */
export function refreshRestNonce(
  rawFetch: typeof fetch = fetch,
): Promise<string | null> {
  const captured = captureRequestPrincipal();
  if (!captured) return Promise.resolve(null);
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = Promise.resolve()
    .then(async () => {
      if (!isRequestPrincipalCurrent(captured)) return null;
      const url = getAdminAjaxUrl();
      if (!url) {
        return null;
      }
      // Core registers wp_ajax_rest-nonce from $_GET['action'] only, so the
      // action has to travel in the query string; a POST body answers 0/400.
      // Same bare GET core's own api-fetch heal uses.
      const res = await rawFetch(
        `${url}${url.includes("?") ? "&" : "?"}action=${REFRESH_NONCE_ACTION}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      // A refusal here, a lost session included, mints nothing and purges
      // nothing: the caller reports the expired session and local state stays.
      if (!res.ok) return null;
      const fresh = (await res.text()).trim();
      if (!fresh || !isRequestPrincipalCurrent(captured)) return null;

      // Use raw fetch to avoid recursively invoking api-client nonce recovery.
      // Keep the runtime REST root so plain-permalink ?rest_route=/ URLs work.
      const verification = await rawFetch(
        `${getPluginRestBase()}security/impersonation-status`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          headers: { "X-WP-Nonce": fresh },
        },
      );
      if (!verification.ok) return null;
      const data: unknown = await verification.json();
      const evidence = (data as { principal?: unknown } | null)?.principal;
      return setRuntimeNonce(fresh, captured, evidence) ? fresh : null;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/**
 * Apply a nonce delivered by a WordPress Heartbeat tick (proactive refresh). Called by
 * `useNonceRefresh` from the `heartbeat-tick` handler when Heartbeat is enabled, so the
 * reactive mint in `api-client` rarely has to fire.
 *
 * A tick that says the session is gone (`wp-auth-check: false`, or a principal
 * with user 0) installs nothing and purges nothing. The unsent draft is still
 * this user's, and WordPress shows its own sign-in prompt over the page; once
 * they sign back in the next tick or the reactive mint renews the nonce. Someone
 * else signing in is a principal change, which still purges and reloads.
 */
export function applyHeartbeatNonce(data: unknown): void {
  const captured = captureRequestPrincipal();
  if (!captured) return;
  const payload = data as
    | {
        pressedmail_rest_nonce?: unknown;
        pressedmail_principal?: unknown;
        "wp-auth-check"?: unknown;
      }
    | null
    | undefined;
  if (payload?.["wp-auth-check"] === false) return;
  if (!matchesVerifiedPrincipal(captured, payload?.pressedmail_principal)) {
    return;
  }
  const fresh = payload?.pressedmail_rest_nonce;
  if (typeof fresh === "string" && fresh.trim().length > 0) {
    setRuntimeNonce(fresh.trim(), captured, payload?.pressedmail_principal);
  }
}
