/**
 * Impersonation / user-switching boot-status reader.
 *
 * When an admin views the mailbox through a user-switching ("impersonation")
 * plugin, PressedMail's CredentialAccessGuard intentionally blocks credential
 * access, so every IMAP-backed request (folders, messages, calendar, settings)
 * fails. PHP injects the block status synchronously into
 * `window.pressedmailPlugin.impersonation`, letting the SPA render a single
 * graceful notice, and load no folders, instead of a 403/404/500 cascade.
 *
 * Fail OPEN: only a definitive `access_allowed === false` blocks. Missing or
 * partial data must never lock a legitimate user out of their own mailbox.
 */

export interface ImpersonationRuntimeStatus {
  access_allowed?: boolean;
  is_user_switching?: boolean;
  blocked_reason?: string | null;
  blocked_message?: string;
}

export interface ImpersonationState {
  /** True only when the boot payload explicitly denies access. */
  blocked: boolean;
  /** Human-facing reason to show; empty when not blocked. */
  message: string;
  /** Machine reason (e.g. "user_switching_detected"); null when unknown. */
  reason: string | null;
  /** Whether the block is specifically an active user-switch session. */
  isUserSwitching: boolean;
}

export const DEFAULT_IMPERSONATION_MESSAGE =
  "Email access is blocked while another account is being viewed through user switching. Log out and sign back in as yourself to open this mailbox.";

/**
 * Read the raw injected status, if any.
 */
export function readImpersonationStatus(): ImpersonationRuntimeStatus | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.pressedmailPlugin?.impersonation;
}

/**
 * Derive the normalized gate state from the injected status.
 */
export function getImpersonationState(
  status: ImpersonationRuntimeStatus | undefined = readImpersonationStatus(),
): ImpersonationState {
  const blocked = status?.access_allowed === false;

  return {
    blocked,
    message: blocked
      ? status?.blocked_message?.trim() || DEFAULT_IMPERSONATION_MESSAGE
      : "",
    reason: status?.blocked_reason ?? null,
    isUserSwitching: status?.is_user_switching === true,
  };
}
