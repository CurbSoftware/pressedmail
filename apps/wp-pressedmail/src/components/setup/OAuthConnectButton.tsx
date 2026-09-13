import * as React from "react";
import { __ } from "@wordpress/i18n";
import { CheckCircle } from "lucide-react";

import { Button } from "@kit/ui/plugin";

import { apiFetch } from "@/lib/api-client";
import { oauthStartUrlRouteApi, oauthStatusRouteApi } from "@/context/Strings";
import { getOAuthConnectProviderLabels } from "@/components/setup/oauth-connect-provider-config.active";
import type { OAuthConnectProvider } from "./oauth-connect-provider-types";

export type { OAuthConnectProvider } from "./oauth-connect-provider-types";

export interface OAuthConnectButtonProps {
  provider: OAuthConnectProvider;
  connected: boolean;
  /** Mailbox shown in the connected state. */
  email?: string;
  /** Existing account id for reconnect flows (0/undefined = setup). */
  accountId?: number;
  /** Called on completion with the provider-verified mailbox address ('' when unknown). */
  onConnected: (email: string) => void;
  onError?: (message: string) => void;
}

const COMPLETE_MESSAGE_TYPE = "pressedmail_oauth_complete";
const STATUS_POLL_INTERVAL_MS = 2000;
// Sign-in can take minutes (consent screens, 2FA); poll generously.
// NOTE: never read popup.closed, provider COOP headers make Chrome log a
// console warning on every read; the server-side status is the only signal.
const STATUS_POLL_MAX_ATTEMPTS = 150;

/**
 * OAuth connect popup flow (Microsoft / Google). Opens the popup
 * synchronously (so popup blockers allow it), fetches the relay start URL,
 * and resolves completion via the landing page's same-origin postMessage,
 * with a status-endpoint poll as fallback when the popup closes without
 * messaging.
 */
export function OAuthConnectButton({
  provider,
  connected,
  email,
  accountId,
  onConnected,
  onError,
}: OAuthConnectButtonProps) {
  const providerLabels = getOAuthConnectProviderLabels(provider);
  const [busy, setBusy] = React.useState(false);
  const doneRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const sessionGenerationRef = React.useRef(0);
  const sessionAbortRef = React.useRef<AbortController | null>(null);
  const popupRef = React.useRef<Window | null>(null);
  // True once the popup has been sent to the provider. Until then it is still
  // our own about:blank and closing it is both safe and necessary.
  const popupNavigatedRef = React.useRef(false);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const onConnectedRef = React.useRef(onConnected);
  const onErrorRef = React.useRef(onError);
  onConnectedRef.current = onConnected;
  onErrorRef.current = onError;

  const clearPollTimer = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // The popup closes itself: pressedmail-oauth-landing.js calls window.close()
  // once it has posted its completion message. We deliberately never call
  // close() on the handle from here. The provider's sign-in page sends
  // Cross-Origin-Opener-Policy: same-origin, which moves the popup into another
  // browsing context group the moment it navigates there, so our handle is
  // severed for the rest of the flow. close() then does nothing except make
  // Chrome log "Cross-Origin-Opener-Policy policy would block the window.close
  // call" on every attempt. Dropping the handle is the whole cleanup.
  const releaseActivePopup = React.useCallback(() => {
    const popup = popupRef.current;
    popupRef.current = null;

    // Before the popup navigates it is a same-origin about:blank we opened, so
    // COOP has not severed the handle and close() still works. A start-URL
    // failure used to strand that blank window for the user to hunt down.
    if (popup && !popupNavigatedRef.current) {
      try {
        popup.close();
      } catch {
        // The window is already gone; nothing left to release.
      }
    }
  }, []);

  const isCurrentSession = React.useCallback((generation: number) => {
    return (
      mountedRef.current &&
      !doneRef.current &&
      sessionGenerationRef.current === generation
    );
  }, []);

  const cancelOAuthSession = React.useCallback(() => {
    sessionGenerationRef.current += 1;
    doneRef.current = true;
    sessionAbortRef.current?.abort();
    sessionAbortRef.current = null;
    clearPollTimer();
    releaseActivePopup();
  }, [clearPollTimer, releaseActivePopup]);

  const finish = React.useCallback(
    (identityEmail: string, generation: number) => {
      if (!isCurrentSession(generation)) {
        return;
      }
      doneRef.current = true;
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = null;
      clearPollTimer();
      releaseActivePopup();
      setBusy(false);
      onConnectedRef.current(identityEmail);
    },
    [clearPollTimer, releaseActivePopup, isCurrentSession],
  );

  const fail = React.useCallback(
    (message: string, generation: number) => {
      if (!isCurrentSession(generation)) {
        return;
      }
      doneRef.current = true;
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = null;
      clearPollTimer();
      releaseActivePopup();
      setBusy(false);
      onErrorRef.current?.(message);
    },
    [clearPollTimer, releaseActivePopup, isCurrentSession],
  );

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cancelOAuthSession();
    };
  }, [cancelOAuthSession]);

  const previousProviderRef = React.useRef(provider);
  React.useEffect(() => {
    if (previousProviderRef.current !== provider) {
      cancelOAuthSession();
      setBusy(false);
      previousProviderRef.current = provider;
    }
  }, [cancelOAuthSession, provider]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as {
        type?: string;
        provider?: string;
        status?: string;
        email?: string;
      } | null;
      if (
        !data ||
        data.type !== COMPLETE_MESSAGE_TYPE ||
        data.provider !== provider
      ) {
        return;
      }
      if (data.status === "success") {
        finish(
          typeof data.email === "string" ? data.email : "",
          sessionGenerationRef.current,
        );
      } else {
        fail(
          __("Sign-in was not completed. Please try again.", "pressedmail"),
          sessionGenerationRef.current,
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [finish, fail, provider]);

  const pollStatusAfterClose = React.useCallback(
    (generation: number, signal: AbortSignal) => {
      if (!isCurrentSession(generation)) {
        return;
      }
      let attempts = 0;
      const statusUrl =
        oauthStatusRouteApi(provider) +
        (typeof accountId === "number" && accountId > 0
          ? `?accountId=${accountId}`
          : "");
      pollTimerRef.current = setInterval(() => {
        if (!isCurrentSession(generation)) {
          clearPollTimer();
          return;
        }
        // Poll the status endpoint on EVERY tick. COOP on the provider's
        // sign-in page can sever the opener relationship, making the
        // postMessage completion unreliable, the server-side pending-token
        // flag is the only dependable signal. Never read popup.closed: COOP
        // makes Chrome log a console warning on every read.
        attempts += 1;
        void apiFetch(statusUrl, { signal })
          .then((res) => {
            if (!isCurrentSession(generation)) {
              return null;
            }
            return res.json();
          })
          .then(
            (
              payload: {
                data?: { connected?: boolean; email?: string };
              } | null,
            ) => {
              if (isCurrentSession(generation) && payload?.data?.connected) {
                finish(
                  typeof payload.data.email === "string"
                    ? payload.data.email
                    : "",
                  generation,
                );
              }
            },
          )
          .catch(() => {
            // Keep polling until the attempt budget runs out.
          });
        if (attempts >= STATUS_POLL_MAX_ATTEMPTS) {
          fail(
            __(
              "Sign-in timed out. Close the sign-in window and try again.",
              "pressedmail",
            ),
            generation,
          );
        }
      }, STATUS_POLL_INTERVAL_MS);
    },
    [accountId, clearPollTimer, fail, finish, isCurrentSession, provider],
  );

  const handleConnect = () => {
    cancelOAuthSession();
    const generation = sessionGenerationRef.current;
    doneRef.current = false;
    popupNavigatedRef.current = false;
    // Open synchronously in the click handler so popup blockers allow it.
    const popup = window.open(
      "about:blank",
      "pressedmail-oauth-" + provider,
      "width=600,height=720",
    );
    if (!popup) {
      fail(
        __(
          "Your browser blocked the sign-in window. Allow popups for this site and try again.",
          "pressedmail",
        ),
        generation,
      );
      return;
    }
    popupRef.current = popup;
    const controller = new AbortController();
    sessionAbortRef.current = controller;
    setBusy(true);

    const url = oauthStartUrlRouteApi(provider);

    void (async () => {
      try {
        const response = await apiFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: accountId ?? 0 }),
          signal: controller.signal,
        });
        if (!isCurrentSession(generation)) {
          return;
        }
        const payload = (await response.json()) as {
          status?: string;
          data?: { url?: string; message?: string };
        };
        if (!isCurrentSession(generation)) {
          return;
        }
        if (payload?.status === "success" && payload.data?.url) {
          popupNavigatedRef.current = true;
          popup.location.href = payload.data.url;
          pollStatusAfterClose(generation, controller.signal);
          return;
        }
        fail(
          payload?.data?.message ??
            __("Could not start the sign-in.", "pressedmail"),
          generation,
        );
      } catch {
        if (!isCurrentSession(generation)) {
          return;
        }
        fail(__("Could not start the sign-in.", "pressedmail"), generation);
      }
    })();
  };

  if (!providerLabels) {
    return null;
  }

  if (connected) {
    return (
      <div
        data-test="oauth-connected"
        data-testid="oauth-connected"
        className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
        <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
        <span>
          {email
            ? `${email}, ${providerLabels.connected}`
            : providerLabels.connected}
        </span>
      </div>
    );
  }

  return (
    <Button
      type="button"
      data-test="oauth-connect-button"
      onClick={handleConnect}
      disabled={busy}
      className="w-full sm:w-auto">
      {busy ? providerLabels.waiting : providerLabels.connect}
    </Button>
  );
}
