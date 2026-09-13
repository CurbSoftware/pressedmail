import { useCallback, useEffect, useRef, useState } from "react";
import { __ } from "@wordpress/i18n";
import { buildApiUrl, routeApiPrefix } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import type { EmailContentType } from "@/types";
import type { ComposeConfirmation } from "./useComposeForm";

export interface ReadReceiptValue {
  requested: boolean;
  revision: string;
}

export interface UseReadReceiptOptions {
  available: boolean;
  contentType: EmailContentType;
  value: ReadReceiptValue;
  onChange: (value: ReadReceiptValue, capturedSession: number | null) => void;
  getComposeSessionVersion: () => number | null;
  requestConfirmation: (
    details: ComposeConfirmation,
    session: number | null,
  ) => Promise<boolean>;
}

interface TrackingSettings {
  tracking_enabled: boolean;
  tracking_consent_revision: string;
}

function parseSettings(value: unknown): TrackingSettings {
  if (!value || typeof value !== "object" || !("settings" in value))
    throw new Error(
      __("Read receipt settings could not be verified. Retry.", "pressedmail"),
    );
  const settings = value.settings;
  if (
    !("status" in value) ||
    value.status !== "success" ||
    !settings ||
    typeof settings !== "object" ||
    !("tracking_enabled" in settings) ||
    typeof settings.tracking_enabled !== "boolean" ||
    !("tracking_consent_revision" in settings) ||
    typeof settings.tracking_consent_revision !== "string" ||
    (settings.tracking_enabled
      ? !/^[a-f0-9]{32}$/.test(settings.tracking_consent_revision)
      : settings.tracking_consent_revision !== "")
  )
    throw new Error(
      __("Read receipt settings could not be verified. Retry.", "pressedmail"),
    );
  return {
    tracking_enabled: settings.tracking_enabled,
    tracking_consent_revision: settings.tracking_consent_revision,
  };
}

/** Consent is requested only by a user action, never by opening a composer. */
export function useReadReceipt(options: UseReadReceiptOptions) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{
    scope: object;
    message: string;
  } | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const scopeKey = JSON.stringify([
    options.available,
    options.contentType,
    options.value.requested,
    options.value.revision,
    options.getComposeSessionVersion(),
  ]);
  const scope = useRef({ key: scopeKey });
  if (scope.current.key !== scopeKey) scope.current = { key: scopeKey };
  const mounted = useRef(true);
  const active = useRef<object | null>(null);
  const cancelled = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (action: "enable" | "revoke") => {
    if (!__IS_PRO__ || !latest.current.available || active.current)
      return false;
    const principal = captureRequestPrincipal();
    if (!mounted.current || !isRequestPrincipalCurrent(principal)) return false;
    if (action === "enable" && latest.current.contentType !== "html") {
      setFailure({
        scope: scope.current,
        message: __(
          "Read receipts are available for HTML emails.",
          "pressedmail",
        ),
      });
      return false;
    }
    const capturedScope = scope.current;
    const session = latest.current.getComposeSessionVersion();
    const cancellation = cancelled.current;
    const operation = {};
    active.current = operation;
    const current = () =>
      mounted.current &&
      active.current === operation &&
      cancelled.current === cancellation &&
      scope.current === capturedScope &&
      latest.current.getComposeSessionVersion() === session &&
      __IS_PRO__ &&
      latest.current.available &&
      isRequestPrincipalCurrent(principal);
    const url = buildApiUrl(`${routeApiPrefix}/tracking/settings`);
    const readSettings = async (enabled?: boolean) => {
      if (!current()) return null;
      const response = await apiFetch(url, {
        method: enabled === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(enabled === undefined
          ? {}
          : { body: JSON.stringify({ tracking_enabled: enabled }) }),
      });
      if (!current()) return null;
      // An HTML error page must not surface as "Unexpected token '<'".
      const body: unknown = await response.json().catch(() => null);
      if (!current()) return null;
      if (!response.ok) {
        const message =
          body &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : __(
                "Read receipt settings could not be saved. Retry.",
                "pressedmail",
              );
        throw new Error(message);
      }
      return parseSettings(body);
    };

    setPending(true);
    setFailure(null);
    try {
      if (action === "enable") {
        let settings = await readSettings();
        if (!current() || !settings) return false;
        const confirmed = await latest.current.requestConfirmation(
          {
            title: __("Request a read receipt?", "pressedmail"),
            description:
              __(
                "This adds a tracking pixel to this email. A pixel load can be recorded when the recipient or their email service fetches it. Image preloading can trigger it without a person opening the email, and blocked images may hide reads. A pixel load is not proof that the email was read.",
                "pressedmail",
              ) +
              (settings.tracking_enabled
                ? ""
                : " " +
                  __(
                    "This also enables read receipts for your account. Each message still starts with receipts off.",
                    "pressedmail",
                  )),
            confirmText: __("Enable for this message", "pressedmail"),
            cancelText: __("Cancel", "pressedmail"),
          },
          session,
        );
        if (!current() || confirmed !== true) return false;
        if (!settings.tracking_enabled) settings = await readSettings(true);
        if (!current() || !settings) return false;
        if (!settings.tracking_enabled)
          throw new Error(
            __("Read receipts could not be enabled. Retry.", "pressedmail"),
          );
        latest.current.onChange(
          { requested: true, revision: settings.tracking_consent_revision },
          session,
        );
      } else {
        const confirmed = await latest.current.requestConfirmation(
          {
            title: __("Revoke all read receipts?", "pressedmail"),
            description: __(
              "This disables read receipts for your account and revokes tracking links in previously sent and queued emails. Future messages will keep receipts off until you choose to enable them again.",
              "pressedmail",
            ),
            confirmText: __("Revoke all receipts", "pressedmail"),
            cancelText: __("Cancel", "pressedmail"),
          },
          session,
        );
        if (!current() || confirmed !== true) return false;
        const settings = await readSettings(false);
        if (!current() || !settings) return false;
        if (settings.tracking_enabled)
          throw new Error(
            __("Read receipts could not be revoked. Retry.", "pressedmail"),
          );
        latest.current.onChange({ requested: false, revision: "" }, session);
      }
      return true;
    } catch (failure) {
      if (current())
        setFailure({
          scope: capturedScope,
          message:
            failure instanceof Error
              ? failure.message
              : __(
                  "Read receipt settings could not be saved. Retry.",
                  "pressedmail",
                ),
        });
      return false;
    } finally {
      // Keep the write lock until the request settles. Disabling this message
      // must not let a later global revoke race an earlier enable POST.
      if (active.current === operation) {
        active.current = null;
        if (mounted.current && isRequestPrincipalCurrent(principal))
          setPending(false);
      }
    }
  }, []);

  const disableForMessage = useCallback(() => {
    cancelled.current += 1;
    const principal = captureRequestPrincipal();
    if (!mounted.current || !isRequestPrincipalCurrent(principal)) return;
    const session = latest.current.getComposeSessionVersion();
    setFailure(null);
    latest.current.onChange({ requested: false, revision: "" }, session);
  }, []);

  return {
    pending,
    error: failure?.scope === scope.current ? failure.message : null,
    enable: useCallback(() => run("enable"), [run]),
    disableForMessage,
    revokeAll: useCallback(() => run("revoke"), [run]),
  };
}
