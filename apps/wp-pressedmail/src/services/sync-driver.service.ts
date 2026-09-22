import { buildApiUrl, routeApiPrefix } from "@/context/Strings";
import { apiFetch, PermissionError } from "@/lib/api-client";

/**
 * Client for the in-app mailbox sync driver (`pressedmail/v1/sync/*`).
 *
 * The mailbox sync runs sequentially (SyncQueuePlanner order) on the server. Because
 * WP-Cron is unreliable, the app DRIVES the sync while open: it polls `/sync/advance`
 * to push the next backfill window, and `/sync/refresh-account` bumps an account to the
 * FRONT of the queue (the Refresh button). Same base URL + REST nonce as the other
 * services.
 */

const getHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * /sync/advance can run several backfill windows against a slow-but-completing (rate-limited)
 * IMAP server. The server already bounds each call under its gateway budget, so the client
 * must NOT abort at the default 20s, a mid-flight abort was being miscounted as a failure and
 * collapsed the driver cadence. Give it plenty of headroom instead.
 */
const ADVANCE_TIMEOUT_MS = 45_000;

/** The FULL background-queue drain endpoint; bounded but can run a live-IMAP job, so give it room. */
const PROCESS_QUEUE_TIMEOUT_MS = 30_000;

/**
 * Diagnostics' "Run now" runs a whole dispatcher pass (its own 25-job / 45-second
 * budget), and the administrator is watching a spinner for it, so the client
 * waits past the server's own ceiling instead of aborting a pass that is still
 * working.
 */
const RUN_NOW_TIMEOUT_MS = 60_000;

export interface AdvanceSyncResult {
  advanced: number;
  remaining: number;
  locked: boolean;
  /** Overdue background-queue depth reported by the server (cron-health signal). */
  overdueJobs: number;
}

/** Advance the current user's mailbox sync a bounded number of sequential steps. */
export async function advanceSync(windows = 2): Promise<AdvanceSyncResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/sync/advance`),
    {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ windows }),
    },
    { timeoutMs: ADVANCE_TIMEOUT_MS },
  );

  // apiFetch already self-heals a stale-nonce 403 (and throws SessionExpiredError when the
  // heal is impossible). A 403 surviving to here is a genuine permission failure. Surface
  // it as a typed error so the driver stops hammering and reports it instead of looping.
  if (response.status === 403) {
    throw new PermissionError();
  }

  const data = (await response.json().catch(() => ({}))) as {
    data?: Partial<AdvanceSyncResult> & { overdue_jobs?: number };
  };
  const payload = data.data ?? {};
  return {
    advanced: Number(payload.advanced ?? 0),
    remaining: Number(payload.remaining ?? 0),
    locked: Boolean(payload.locked ?? false),
    overdueJobs: Number(payload.overdue_jobs ?? 0),
  };
}

/**
 * Drain a bounded number of overdue BACKGROUND-queue jobs inline via /sync/process-queue.
 *
 * This is the cron-independent path for the live-IMAP inventory hooks (mirror refresh/sweep)
 * that the interactive reads deliberately never run inline. The driver alternates it with
 * /sync/advance so folders past the head backfill still get their inventory/counts filled on
 * a starved-cron site. Best-effort: it is server-bounded (per-request lock + time budget) and
 * NEVER throws into the driver loop. A hiccup here must not disturb the advance cadence.
 *
 * @returns The depth the server still reports overdue after the pass, or `null` when the
 *   pass could not answer. Callers need that distinction: "the drain ran and left work
 *   behind" is a fault signal, while a drain that failed to run says nothing at all.
 */
export async function processQueueSync(): Promise<number | null> {
  try {
    const response = await apiFetch(
      buildApiUrl(`${routeApiPrefix}/sync/process-queue`),
      {
        method: "POST",
        credentials: "include",
        headers: getHeaders(),
        body: JSON.stringify({}),
      },
      { timeoutMs: PROCESS_QUEUE_TIMEOUT_MS },
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json().catch(() => ({}))) as {
      data?: { overdue_remaining?: unknown };
    };
    const remaining = Number(body.data?.overdue_remaining);

    return Number.isFinite(remaining) ? remaining : null;
  } catch {
    // Swallow: the alternating drain is best-effort and must never break the driver loop.
    return null;
  }
}

/**
 * Diagnostics' "Run now": ask for one full dispatcher pass on /sync/process-queue.
 *
 * The same route as {@link processQueueSync}, but `manual` selects the
 * dispatcher's own pass (every worker, the dispatcher's job count and time
 * budget) rather than the two-job inline nudge, and the server answers with the
 * heartbeat that pass just wrote so the panel can update without a reload.
 *
 * Unlike the driver's drain this one is attended, so it reports failure instead
 * of swallowing it: a button that silently does nothing is worse than a button
 * that says it could not.
 *
 * @returns The dispatcher's status after a completed pass.
 */
export async function runBackgroundPassNow(): Promise<{
  lastRun: number;
  nextRun: number;
  loopback: boolean | null;
  hasMailbox?: boolean;
}> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/sync/process-queue`),
    {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ manual: true }),
    },
    { timeoutMs: RUN_NOW_TIMEOUT_MS },
  );

  // A 403 that survives apiFetch's nonce self-heal is a real permission or
  // security failure: the administrator cannot run this pass.
  if (response.status === 403) {
    throw new PermissionError();
  }
  if (!response.ok) {
    throw new Error(`The background pass failed (${response.status}).`);
  }

  const body = (await response.json().catch(() => ({}))) as {
    data?: {
      dispatch?: {
        lastRun?: number;
        nextRun?: number;
        loopback?: unknown;
        hasMailbox?: boolean;
      };
    };
  };
  const dispatch = body.data?.dispatch;
  if (!dispatch || !Number(dispatch.lastRun)) {
    throw new Error(
      "The background pass did not return a completed heartbeat.",
    );
  }

  return {
    lastRun: Number(dispatch.lastRun ?? 0),
    nextRun: Number(dispatch.nextRun ?? 0),
    loopback:
      dispatch.loopback === true || dispatch.loopback === false
        ? dispatch.loopback
        : null,
    ...(typeof dispatch.hasMailbox === "boolean"
      ? { hasMailbox: dispatch.hasMailbox }
      : {}),
  };
}

/**
 * Manual "Refresh": push the given account(s) to the FRONT of the sync queue and start
 * advancing immediately. Pass a single id (single-account view) or the active set
 * (combined inbox). Best-effort, never throws into the UI.
 */
export async function refreshAccountSync(accountIds: number[]): Promise<void> {
  const ids = accountIds.filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    return;
  }
  const body = ids.length === 1 ? { account_id: ids[0] } : { account_ids: ids };
  try {
    await apiFetch(buildApiUrl(`${routeApiPrefix}/sync/refresh-account`), {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    // Refresh is best-effort; the folder/message reload still runs.
  }
}
