import { useEffect } from "react";

import { applyHeartbeatNonce } from "@/lib/nonce";

/**
 * Proactively keep the SPA's WordPress REST nonce fresh on a long-open tab.
 *
 * WP REST nonces expire on the nonce tick (~12h). Once expired, EVERY authenticated REST
 * call 403s with `rest_cookie_invalid_nonce` until the value is refreshed. REACTIVE healing
 * of that 403 lives in `lib/api-client.ts`: every plugin REST call goes through `apiFetch`,
 * which mints a fresh nonce via admin-ajax and retries once. There is intentionally NO
 * `window.fetch` monkey-patch anymore. Healing is explicit, testable, and covers every verb
 * (the old patch never covered the legacy BaseApi request stack).
 *
 * This hook is the PROACTIVE half: when the WordPress Heartbeat API is enabled it swaps in a
 * fresh nonce delivered on each `heartbeat-tick`, so the reactive mint in `api-client` rarely
 * has to fire. When Heartbeat/jQuery is unavailable it is a no-op and the reactive path alone
 * keeps the tab authenticated.
 */
type HeartbeatTickHandler = (event: unknown, data: unknown) => void;

interface MinimalJQueryDocument {
  on: (events: string, handler: HeartbeatTickHandler) => void;
  off: (events: string, handler: HeartbeatTickHandler) => void;
}

type JQueryLike = (target: Document) => MinimalJQueryDocument;

export function useNonceRefresh(): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const jq = (window as unknown as { jQuery?: JQueryLike }).jQuery;
    if (typeof jq !== "function") {
      return;
    }

    const onTick: HeartbeatTickHandler = (_event, data) => {
      applyHeartbeatNonce(data);
    };
    const $document = jq(document);
    $document.on("heartbeat-tick.pressedmail-nonce", onTick);

    return () => {
      $document.off("heartbeat-tick.pressedmail-nonce", onTick);
    };
  }, []);
}
