import { useEffect } from "react";

import { applyHeartbeatNonce } from "@/lib/nonce";
import {
  isFollowingLeader,
  isTabLeader,
  publishTabMessage,
  subscribeLeadership,
  subscribeTabMessages,
} from "@/lib/tab-channel";

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

interface HeartbeatApi {
  interval: (speed?: number) => number;
}

/** WordPress Heartbeat's default admin interval, in seconds. */
const HEARTBEAT_DEFAULT_S = 60;
/** A follower tab gets its nonce from the leader, so its own heartbeat can slow down. */
const HEARTBEAT_FOLLOWER_S = 120;

function getHeartbeat(): HeartbeatApi | null {
  const heartbeat = (window as unknown as { wp?: { heartbeat?: HeartbeatApi } })
    .wp?.heartbeat;
  return heartbeat && typeof heartbeat.interval === "function"
    ? heartbeat
    : null;
}

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
      // Pass the nonce to follower tabs. Each one re-checks the principal evidence
      // against its own before installing it.
      const payload = data as
        | { pressedmail_rest_nonce?: unknown; pressedmail_principal?: unknown }
        | null
        | undefined;
      const principal = payload?.pressedmail_principal as
        | { site?: unknown; userId?: unknown }
        | undefined;
      if (
        isTabLeader() &&
        typeof payload?.pressedmail_rest_nonce === "string" &&
        typeof principal?.site === "string" &&
        typeof principal.userId === "number"
      ) {
        publishTabMessage({
          type: "nonce",
          nonce: payload.pressedmail_rest_nonce.trim(),
          principal: { site: principal.site, userId: principal.userId },
        });
      }
    };
    const $document = jq(document);
    $document.on("heartbeat-tick.pressedmail-nonce", onTick);

    // Slow this tab's heartbeat while it follows a leader; restore it when it leads.
    // The interval in force before slowing (a site may filter it), restored afterwards.
    let restoreTo: number | null = null;
    const syncHeartbeatSpeed = () => {
      const heartbeat = getHeartbeat();
      if (!heartbeat) return;
      const follow = !isTabLeader() && isFollowingLeader();
      if (follow && restoreTo === null) {
        const current = Number(heartbeat.interval());
        restoreTo = current > 0 ? current : HEARTBEAT_DEFAULT_S;
        heartbeat.interval(HEARTBEAT_FOLLOWER_S);
      } else if (!follow && restoreTo !== null) {
        heartbeat.interval(restoreTo);
        restoreTo = null;
      }
    };
    const unsubscribeLeadership = subscribeLeadership(syncHeartbeatSpeed);
    const unsubscribeMessages = subscribeTabMessages((message) => {
      if (message.type === "nonce" && !isTabLeader()) {
        applyHeartbeatNonce({
          pressedmail_rest_nonce: message.nonce,
          pressedmail_principal: message.principal,
        });
      }
      syncHeartbeatSpeed();
    });
    syncHeartbeatSpeed();

    return () => {
      $document.off("heartbeat-tick.pressedmail-nonce", onTick);
      unsubscribeLeadership();
      unsubscribeMessages();
      if (restoreTo !== null) getHeartbeat()?.interval(restoreTo);
    };
  }, []);
}
