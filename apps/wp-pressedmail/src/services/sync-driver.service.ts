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
 */
export async function processQueueSync(): Promise<void> {
  try {
    await apiFetch(
      buildApiUrl(`${routeApiPrefix}/sync/process-queue`),
      {
        method: "POST",
        credentials: "include",
        headers: getHeaders(),
        body: JSON.stringify({}),
      },
      { timeoutMs: PROCESS_QUEUE_TIMEOUT_MS },
    );
  } catch {
    // Swallow: the alternating drain is best-effort and must never break the driver loop.
  }
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
  const body =
    ids.length === 1 ? { account_id: ids[0] } : { account_ids: ids };
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
