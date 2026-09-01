/**
 * Per-account readiness for the combined inbox.
 *
 * A combined read merges whatever each selected mailbox has mirrored. When an
 * account is still cold/syncing, its rows are simply absent, so the server
 * reports per-account readiness and the UI surfaces "Syncing N of M mailboxes…"
 * instead of presenting a silently-partial page as complete.
 */

export interface ConsolidatedAccountReadiness {
  id: number;
  email: string;
  ready: boolean;
  /**
   * Server-provided, treated opaquely except that the ERROR reasons below flip a
   * mailbox from a "syncing…" spinner to an error chip:
   * 'ready' | 'cold' | 'backfill' (transient, spinner) vs
   * 'auth_failed' | 'config_error' (permanent, error chip).
   */
  reason: string;
  /** Optional human error message for a permanently-failed mailbox (WS-A health). */
  error?: string;
}

/**
 * Reasons that are PERMANENT failures, a mailbox in one of these states can never
 * "finish syncing" without the user re-authenticating / fixing config, so it must
 * show an error chip, never a spinner.
 */
const ERROR_REASONS = new Set(["auth_failed", "config_error"]);

export function isConsolidatedErrorReason(reason: string): boolean {
  return ERROR_REASONS.has(reason);
}

export interface ConsolidatedReadinessSummary {
  total: number;
  ready: number;
  /** Not-ready AND not a permanent error (cold / backfilling → spinner). */
  syncing: number;
  /** Permanently-failed mailboxes (auth/config → error chip). */
  error: number;
  /** "Syncing …" label for the transient (spinner) accounts, or null. */
  label: string | null;
  /** Error label for permanently-failed accounts (never "syncing…"), or null. */
  errorLabel: string | null;
}

/**
 * Parse a raw server `data.accounts` array into typed readiness records,
 * tolerating partial/legacy shapes (missing array → empty).
 */
export function parseConsolidatedAccountReadiness(
  raw: unknown,
): ConsolidatedAccountReadiness[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => ({
      id: Number(entry.id ?? 0),
      email: String(entry.email ?? ""),
      ready: Boolean(entry.ready),
      reason: String(entry.reason ?? ""),
      ...(entry.error !== undefined && entry.error !== null && String(entry.error) !== ""
        ? { error: String(entry.error) }
        : {}),
    }));
}

/**
 * Summarize readiness into counts + a status label. The label appears only when
 * MORE THAN ONE mailbox is combined and at least one is not yet ready, a single
 * mailbox (or an all-ready set) shows nothing, so single-mailbox UX is unchanged.
 */
export function summarizeConsolidatedReadiness(
  readiness: readonly ConsolidatedAccountReadiness[] | null | undefined,
): ConsolidatedReadinessSummary {
  const list = Array.isArray(readiness) ? readiness : [];
  const total = list.length;
  const ready = list.filter((account) => account.ready).length;
  const error = list.filter(
    (account) => !account.ready && isConsolidatedErrorReason(account.reason),
  ).length;
  // Transient (spinner) accounts: not ready and not a permanent error.
  const syncing = total - ready - error;

  let label: string | null = null;
  if (total > 1 && syncing > 0) {
    label =
      syncing === total
        ? `Syncing ${total} mailboxes…`
        : `Syncing ${syncing} of ${total} mailboxes…`;
  }

  // A permanently-failed mailbox never says "syncing…"; it gets a distinct error
  // label so the user knows to re-authenticate rather than wait.
  let errorLabel: string | null = null;
  if (total > 1 && error > 0) {
    errorLabel =
      error === total
        ? `Can't sync ${total} mailboxes`
        : `Can't sync ${error} of ${total} mailboxes`;
  }

  return { total, ready, syncing, error, label, errorLabel };
}
