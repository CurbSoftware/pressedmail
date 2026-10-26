import * as React from "react";
import { useEffect, useState, type CSSProperties } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  Lock,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  MailCheck,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@kit/ui/plugin";

import { useApplyShellMode } from "@/components/mobile-shell";
import Logo from "../Icons/Logo";
import { apiFetch } from "@/lib/api-client";
import { appMessage } from "@/context/toast";
import {
  getMailboxLockState,
  setMailboxLockStatus,
  subscribeMailboxLock,
  type MailboxLockRuntimeStatus,
  type MailboxLockState,
} from "@/lib/mailbox-lock";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";
import { sensitiveInputProps } from "@/lib/sensitive-input-props";

import { LockFieldsForm } from "./LockFieldsForm";
import { LockMigrationPrompt } from "./LockMigrationPrompt";

interface LockGateProps {
  children: React.ReactNode;
}

interface LockActionResponse {
  status?: string;
  message?: string;
  code?: string;
  retry_after?: number;
  address?: string;
  lock?: MailboxLockRuntimeStatus;
}

/** The query parameter the emailed reset link carries. */
export const LOCK_RESET_PARAM = "pm_lock_reset";

/** Take the reset token out of the address bar, so it is never bookmarked or shared. */
function takeResetToken(): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  const token = url.searchParams.get(LOCK_RESET_PARAM) ?? "";
  if (token !== "") {
    url.searchParams.delete(LOCK_RESET_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  }
  return token;
}

const getApiUrl = (): string =>
  (window as unknown as { pressedmailPlugin?: { apiUrl?: string } })
    .pressedmailPlugin?.apiUrl || "";

/**
 * Boot gate that sits ABOVE the mailbox data providers, mirroring
 * ImpersonationGate. When the user's optional PressedMail Lock is enabled and
 * this browser session holds no unlock grant, it renders a BLOCKING passphrase
 * screen, the inbox providers do not mount, until the session is unlocked.
 *
 * Initial state comes synchronously from the boot payload (no flash); a
 * mid-session 423 from any request flips the store (via the api-client event)
 * and re-locks without a reload. Server-side the credential guard, mirror-read
 * lock, and REST 423 gate deny data even if this UI were bypassed, so the
 * screen is a real lock, not a decorative prompt.
 */
export function LockGate({ children }: LockGateProps) {
  const [lockState, setLockState] =
    useState<MailboxLockState>(getMailboxLockState);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A lockout that is already running when the page loads counts down at
  // once, instead of the first try failing with "too many attempts".
  const [retryAfter, setRetryAfter] = useState(
    () => getMailboxLockState().retryAfter,
  );
  const [forgotMode, setForgotMode] = useState(false);
  const [wpPassword, setWpPassword] = useState("");
  const [resetAddress, setResetAddress] = useState(
    () => getMailboxLockState().resetAddresses[0] ?? "",
  );
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  // ApplicationLayout never mounts behind this gate, so apply the shell mode it
  // would normally set, otherwise the safe-area and touch utilities are absent
  // on the one screen a mobile user has to interact with.
  useApplyShellMode("pressedmail-plugin");

  // The screen fills the frame below the WordPress admin bar, whose height
  // changes between the desktop and mobile bars.
  const [adminBarHeight, setAdminBarHeight] = useState(() => {
    if (typeof window === "undefined") return 32;
    return window.document.getElementById("wpadminbar")?.offsetHeight || 32;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const adminBar = window.document.getElementById("wpadminbar");
    if (!adminBar) return;

    const handleUpdateHeight = () =>
      setAdminBarHeight(adminBar.offsetHeight || 32);
    handleUpdateHeight();

    const resizeObserver =
      "ResizeObserver" in window
        ? new ResizeObserver(() => handleUpdateHeight())
        : null;

    resizeObserver?.observe(adminBar);
    window.addEventListener("resize", handleUpdateHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleUpdateHeight);
    };
  }, []);

  useEffect(() => subscribeMailboxLock(setLockState), []);

  // The emailed reset link lands here. It works only for the signed-in user it
  // was sent to, once, within 30 minutes; the server checks all of that.
  useEffect(() => {
    const token = takeResetToken();
    if (token === "") return;
    void (async () => {
      try {
        const res = await apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/security/lock/reset-confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        const data = (await res
          .json()
          .catch(() => null)) as LockActionResponse | null;
        if (res.ok && data?.status === "success") {
          setMailboxLockStatus(data.lock);
          appMessage(
            data.message || __("PressedMail Lock is off.", "pressedmail"),
            "success",
          );
          return;
        }
        const text =
          data?.message ||
          __("That didn’t work. Please try again.", "pressedmail");
        setError(text);
        appMessage(text, "error");
      } catch {
        setError(
          __(
            "Something went wrong. Reload the page and try again.",
            "pressedmail",
          ),
        );
      }
    })();
  }, []);

  // Lockout countdown after a 429.
  useEffect(() => {
    if (retryAfter <= 0) {
      return;
    }
    const timer = globalThis.setInterval(() => {
      setRetryAfter((seconds) => (seconds > 1 ? seconds - 1 : 0));
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [retryAfter > 0]);

  const locked = lockState.enabled && lockState.locked;

  if (!locked) {
    return (
      <>
        {lockState.migrationPrompt && <LockMigrationPrompt />}
        {children}
      </>
    );
  }

  const postLockAction = async (
    endpoint: "unlock" | "reset-request" | "setup",
    body: Record<string, string>,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/security/lock/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res
        .json()
        .catch(() => null)) as LockActionResponse | null;
      if (res.ok && data?.status === "success") {
        setPassphrase("");
        setWpPassword("");
        if (endpoint === "reset-request") {
          // The lock stays on until the emailed link is opened.
          setResetSentTo(data.address || body.address || "");
          return;
        }
        setForgotMode(false);
        setMailboxLockStatus(data.lock);
        return;
      }
      // Only a real lockout counts down. A rate limit (429) or a storage
      // fault (503) also send retry_after, and reading those as "too many
      // failed attempts" is what told users with one typo they were locked out.
      if (
        data?.code === "locked_out" &&
        typeof data.retry_after === "number" &&
        data.retry_after > 0
      ) {
        setRetryAfter(data.retry_after);
        setError(null);
        return;
      }
      setError(
        data?.message ||
          __("That didn’t work. Please try again.", "pressedmail"),
      );
    } catch {
      setError(
        __(
          "Something went wrong. Reload the page and try again.",
          "pressedmail",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // A passphrase lockout never blocks the forgot flow, which has its own count.
  const lockedOut = retryAfter > 0 && !forgotMode;
  const busy = submitting || lockedOut;
  const canEmailReset =
    lockState.mailReady && lockState.resetAddresses.length > 0;
  const chosenAddress = lockState.resetAddresses.includes(resetAddress)
    ? resetAddress
    : (lockState.resetAddresses[0] ?? "");

  return (
    <div
      className="relative w-full overflow-hidden bg-background font-sans"
      style={
        {
          "--wp-admin-bar-height": `${adminBarHeight}px`,
          height: "calc(100dvh - var(--wp-admin-bar-height, 32px))",
          minHeight: "calc(100dvh - var(--wp-admin-bar-height, 32px))",
        } as CSSProperties
      }>
      {/* Dialog semantics are kept deliberately: the licence screen has none,
          but this one blocks the whole app and must announce itself. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-gate-title"
        data-test="lock-gate"
        data-testid="lock-gate"
        className="pm-safe-py pm-safe-px flex h-full flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center">
            <Logo className="h-10 w-auto opacity-80" />
          </div>

          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-10 w-10 text-primary" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2">
              <h1
                id="lock-gate-title"
                className="text-3xl font-bold tracking-tight">
                {__("PressedMail is locked", "pressedmail")}
              </h1>
              <p className="text-base text-muted-foreground">
                {forgotMode
                  ? __(
                      "Pick one of your email addresses and confirm your WordPress password. We will email you a link that turns PressedMail Lock off. No mail or settings are lost.",
                      "pressedmail",
                    )
                  : lockState.migrationPrompt
                    ? __(
                        "Your previous logout protection needs a replacement. Choose a new passphrase to protect and open your mailbox, or turn off protection using your WordPress password.",
                        "pressedmail",
                      )
                    : __(
                        "Enter your PressedMail Lock passphrase to open your mailbox in this browser.",
                        "pressedmail",
                      )}
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {lockedOut && (
            <Alert
              variant="destructive"
              data-test="lock-gate-lockout"
              data-testid="lock-gate-lockout">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {sprintf(
                  /* translators: %d: seconds remaining before another attempt. */
                  _n(
                    "Too many failed attempts. Try again in %d second.",
                    "Too many failed attempts. Try again in %d seconds.",
                    retryAfter,
                    "pressedmail",
                  ),
                  retryAfter,
                )}
              </AlertDescription>
            </Alert>
          )}

          {forgotMode && resetSentTo !== null ? (
            <div className="space-y-4" data-test="lock-gate-reset-sent">
              <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertDescription>
                  {sprintf(
                    /* translators: %s: email address the reset link went to. */
                    __(
                      "Check %s. The link in that email works once, for 30 minutes, in a browser where you are signed in to WordPress as yourself.",
                      "pressedmail",
                    ),
                    resetSentTo,
                  )}
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setForgotMode(false);
                  setResetSentTo(null);
                  setError(null);
                }}>
                {__("Back to passphrase", "pressedmail")}
              </Button>
            </div>
          ) : forgotMode ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy && canEmailReset && wpPassword !== "") {
                  void postLockAction("reset-request", {
                    address: chosenAddress,
                    wp_password: wpPassword,
                  });
                }
              }}>
              {canEmailReset ? (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="lock-gate-reset-address"
                      className="text-sm font-medium">
                      {__("Send the link to", "pressedmail")}
                    </Label>
                    <NativeSelect
                      id="lock-gate-reset-address"
                      data-test="lock-gate-reset-address"
                      className="w-full"
                      value={chosenAddress}
                      onChange={(e) => setResetAddress(e.target.value)}
                      disabled={busy}>
                      {lockState.resetAddresses.map((address) => (
                        <NativeSelectOption key={address} value={address}>
                          {address}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="lock-gate-wp-password"
                      className="text-sm font-medium">
                      {__("WordPress password", "pressedmail")}
                    </Label>
                    <Input
                      id="lock-gate-wp-password"
                      type="password"
                      {...sensitiveInputProps("wordpress-password")}
                      placeholder={__(
                        "Enter your WordPress password",
                        "pressedmail",
                      )}
                      value={wpPassword}
                      onChange={(e) => setWpPassword(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="h-12 w-full text-lg font-semibold"
                    disabled={busy || wpPassword === ""}>
                    {submitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {__("Email me a reset link", "pressedmail")}
                  </Button>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {__(
                      "A reset link can't be sent from this site right now. It needs working outgoing mail and one of your own mailboxes connected. Ask an administrator for help.",
                      "pressedmail",
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                }}
                disabled={submitting}>
                {__("Back to passphrase", "pressedmail")}
              </Button>
            </form>
          ) : (
            <LockFieldsForm
              className="space-y-4"
              onSubmit={() => {
                if (!busy && passphrase !== "") {
                  void postLockAction(
                    lockState.migrationPrompt ? "setup" : "unlock",
                    { passphrase },
                  );
                }
              }}>
              <div className="space-y-2">
                <Label
                  htmlFor="lock-gate-passphrase"
                  className="text-sm font-medium">
                  {__("Passphrase", "pressedmail")}
                </Label>
                <div className="relative">
                  <Input
                    id="lock-gate-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    className="pr-12"
                    {...sensitiveInputProps("mailbox-lock-passphrase")}
                    placeholder={__("Enter your passphrase", "pressedmail")}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    aria-label={
                      showPassphrase
                        ? __("Hide passphrase", "pressedmail")
                        : __("Show passphrase", "pressedmail")
                    }
                    aria-pressed={showPassphrase}
                    onClick={() => setShowPassphrase((show) => !show)}
                    disabled={busy}>
                    {showPassphrase ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                className="h-12 w-full text-lg font-semibold"
                disabled={busy || passphrase === ""}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {lockState.migrationPrompt
                  ? __("Set passphrase and unlock", "pressedmail")
                  : __("Unlock", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setForgotMode(true);
                  setError(null);
                }}
                disabled={submitting}>
                {__("Forgot your passphrase?", "pressedmail")}
              </Button>
            </LockFieldsForm>
          )}

          <p className="border-t pt-4 text-center text-xs text-muted-foreground/80">
            {__(
              "Background mail sync keeps running while PressedMail is locked. Each browser unlocks separately.",
              "pressedmail",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default LockGate;
