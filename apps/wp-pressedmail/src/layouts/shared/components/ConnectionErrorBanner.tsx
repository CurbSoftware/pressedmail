import { useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { __ } from "@wordpress/i18n";

import { Alert, AlertDescription, Button } from "@kit/ui/plugin";
import { useInbox, useInboxState } from "@/context/InboxContext";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";
import { cn } from "@/lib/utils";

/**
 * Reload the whole page.
 *
 * Both notices this banner carries are conditions an in-app refetch cannot
 * clear: an expired session needs a new WordPress nonce, and a stalled
 * background queue needs the driver restarted. Isolated here so the tests can
 * stub one thing rather than the global.
 */
function reloadPage(): void {
  window.location.reload();
}

export type ConnectionErrorKind =
  | "generic"
  | "auth"
  | "credentials"
  | "connection"
  | "certificate"
  | "host"
  | "timeout"
  | "raw";

export interface ResolvedConnectionError {
  kind: ConnectionErrorKind;
  /** User-facing copy: friendly for known cases, the raw reason otherwise. */
  message: string;
}

// The 409 CREDENTIALS_REQUIRED conflict: no usable stored secret (never
// entered, or cleared by the lock). Checked before AUTH_PATTERNS, it is the
// more specific state and carries its own recovery copy.
const CREDENTIALS_PATTERNS = [
  "re-enter the mailbox password",
  "reconnect the account",
] as const;

// Most specific first. Auth is checked before connectivity so a message like
// "Cannot connect ...: Invalid credentials" routes to the auth guidance.
const AUTH_PATTERNS = [
  "authenticationfailed",
  "authentication failed",
  "invalid credentials",
  "login failed",
  "auth_failed",
  "auth failed",
  "unauthorized",
  "incorrect authentication",
  "bad username or password",
  "wrong password",
  "application-specific password",
] as const;

const CERT_PATTERNS = [
  "certificate",
  "verify failed",
  "verify_peer",
  "self-signed",
  "self signed",
  "ssl3_get_server_certificate",
] as const;

const HOST_PATTERNS = [
  "could not resolve",
  "name or service not known",
  "no such host",
  "getaddrinfo",
  "host not found",
  "php_network_getaddresses",
  "name resolution",
] as const;

const TIMEOUT_PATTERNS = ["timed out", "timeout"] as const;

const CONNECTION_PATTERNS = [
  "connection refused",
  "refused",
  "econnrefused",
  "econnreset",
  "network is unreachable",
  "unreachable",
  "no connection could be made",
  "unable to connect",
  "failed to connect",
  "connection failed",
  "cannot connect",
] as const;

function matchesAny(haystack: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => haystack.includes(p));
}

/**
 * Strip transport/wrapper noise so the raw reason reads cleanly.
 */
function cleanRawReason(error: string): string {
  return error
    .trim()
    .replace(/^HTTP error:\s*\d{3}\s*-\s*/i, "")
    .replace(/^IMAP connection failed:\s*/i, "")
    .replace(/\s+\(after \d+ attempts\)\.?$/i, "")
    .trim();
}

/**
 * Map a backend connection/auth error reason to friendly, actionable copy.
 *
 * Known categories get tailored guidance; an unrecognized-but-present reason is
 * surfaced verbatim (cleaned) so users can self-diagnose; only a genuinely
 * empty reason falls back to the generic line.
 */
export function resolveConnectionError(
  error?: string | null,
): ResolvedConnectionError {
  if (!error || !error.trim()) {
    return {
      kind: "generic",
      message: __(
        "Unable to connect to mail server. Please try again.",
        "pressedmail",
      ),
    };
  }

  const lower = error.toLowerCase();

  if (matchesAny(lower, CREDENTIALS_PATTERNS)) {
    return {
      kind: "credentials",
      message: __(
        "This account needs its mailbox password again. Re-enter the mailbox password (or reconnect the account) to send, move, or flag mail.",
        "pressedmail",
      ),
    };
  }

  if (matchesAny(lower, AUTH_PATTERNS)) {
    return {
      kind: "auth",
      message: __(
        "Authentication failed. Check your email password or app password.",
        "pressedmail",
      ),
    };
  }

  if (matchesAny(lower, CERT_PATTERNS)) {
    return {
      kind: "certificate",
      message: __(
        "The mail server's SSL/TLS certificate could not be verified.",
        "pressedmail",
      ),
    };
  }

  if (matchesAny(lower, HOST_PATTERNS)) {
    return {
      kind: "host",
      message: __(
        "Mailbox host not found. Double-check the server hostname.",
        "pressedmail",
      ),
    };
  }

  if (matchesAny(lower, TIMEOUT_PATTERNS)) {
    return {
      kind: "timeout",
      message: __(
        "The connection to the mail server timed out. The port may be blocked.",
        "pressedmail",
      ),
    };
  }

  if (matchesAny(lower, CONNECTION_PATTERNS)) {
    return {
      kind: "connection",
      message: __(
        "Connection refused or the mail server is unreachable. Check the server and port.",
        "pressedmail",
      ),
    };
  }

  return { kind: "raw", message: cleanRawReason(error) };
}

export function ConnectionErrorBanner() {
  const {
    error,
    clearError,
    resetAccountHealth,
    selectedAccountId,
    refreshMessages,
    retryInit,
  } = useInbox();
  const { messages } = useInboxState();

  // Session-wide errors from the sync driver / api-client (expired session that no
  // request could heal, repeated advance failures). Not tied to one account, so they
  // arrive via the connection-state service rather than the inbox init error.
  const connectionState = getConnectionStateService();
  useSyncExternalStore(
    (cb) => connectionState.subscribe(cb),
    () => connectionState.getSnapshot(),
    () => connectionState.getSnapshot(),
  );
  const sessionError = connectionState.getSessionError();

  // INFO-level, not an error: the in-app sync driver is slow-but-working, or the background
  // queue is backing up because wp-cron's loopback is starved. The app keeps making progress
  // in the foreground, so this surfaces as a muted chip (never the destructive banner) and
  // clears itself once the condition recovers. Rendered independently of the error banner.
  const syncDelayed = connectionState.getSyncDelayed();
  const syncChip = syncDelayed ? (
    <div
      data-test="sync-delayed-chip"
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-muted px-4 py-2 text-xs text-muted-foreground",
      )}>
      <span className="flex-1">{syncDelayed}</span>
      {/* A delayed background queue means the app is doing the sync itself in
          this tab. Reloading restarts that work from a clean state, which is
          the one thing a reader can usefully do about it. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        data-test="sync-delayed-reload"
        onClick={reloadPage}>
        <RefreshCw className="mr-1 size-3" aria-hidden="true" />
        {__("Reload", "pressedmail")}
      </Button>
    </div>
  ) : null;

  // Server-reported account auth status (auth_failed/config_error), tracked
  // INDEPENDENTLY of the transport circuit breaker. Post-overhaul the DB-mirror
  // read succeeds even for an auth-failed account, so the breaker no longer feeds
  // an error string here, the banner surfaces the auth failure from this status
  // directly so it still shows alongside the (now-populated) message list.
  const authStatus = selectedAccountId
    ? connectionState.getAuthStatus(String(selectedAccountId))
    : "ok";
  const authBlocked =
    authStatus === "auth_failed" || authStatus === "config_error";

  // A recorded 409 CREDENTIALS_REQUIRED (api-client event → connection-state).
  // Tracked apart from authStatus because the accounts poll reports only
  // `degraded` for a secret-less account, which never sets an auth status.
  const credentialsRequired = selectedAccountId
    ? connectionState.getCredentialsRequired(String(selectedAccountId))
    : null;

  // No error to show, but the info chip may still need to render on its own.
  if (!error && !sessionError && !authBlocked && !credentialsRequired)
    return syncChip;

  // Priority: a concrete per-account inbox error is most actionable, then the
  // credentials conflict, then the account auth status, then the session-wide
  // error.
  const isSessionOnly = !error && !authBlocked && !credentialsRequired;
  const resolved = resolveConnectionError(
    error ??
      credentialsRequired ??
      (authBlocked ? "auth_failed" : sessionError),
  );

  // Suppress transient (non-auth) errors once messages are already visible, a
  // brief network blip shouldn't nag when the inbox is still usable. Auth and
  // credentials failures always surface (the mirror keeps the list populated
  // while every write fails), and so do session-wide errors: nothing syncs
  // until the session is restored.
  if (
    !isSessionOnly &&
    resolved.kind !== "auth" &&
    resolved.kind !== "credentials" &&
    messages.length > 0
  ) {
    return syncChip;
  }

  const handleRetry = () => {
    if (isSessionOnly) {
      // An expired session cannot be healed by refetching: the page needs a
      // fresh WordPress nonce, which only a real page load issues. The copy
      // has always said "reload the page", so the button now does that.
      reloadPage();
      return;
    }

    if (selectedAccountId) {
      resetAccountHealth(String(selectedAccountId));
    }
    clearError();

    if (selectedAccountId) {
      void refreshMessages();
      return;
    }

    retryInit();
  };

  return (
    <div className="flex flex-col gap-2">
      <Alert
        variant="destructive"
        data-test="connection-error-banner"
        data-test-kind={resolved.kind}>
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <AlertDescription className="flex-1">
            {resolved.message}
          </AlertDescription>
          {(resolved.kind === "auth" || resolved.kind === "credentials") && (
            // A retry cannot fix bad/expired/missing credentials. Send the user
            // to the email-connections settings to re-enter their password.
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-auto shrink-0 p-0 text-xs">
              <a
                href="#/settings?tab=accounts"
                data-test="connection-error-reauth">
                {__("Update credentials", "pressedmail")}
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            data-test="connection-error-retry"
            onClick={handleRetry}>
            {isSessionOnly ? (
              <RefreshCw className="mr-1 size-3" aria-hidden="true" />
            ) : null}
            {isSessionOnly
              ? __("Reload page", "pressedmail")
              : __("Retry", "pressedmail")}
          </Button>
        </div>
      </Alert>
      {syncChip}
    </div>
  );
}
