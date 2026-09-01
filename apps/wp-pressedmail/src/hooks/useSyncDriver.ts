import { useEffect } from "react";

import {
  advanceSync,
  processQueueSync,
} from "@/services/sync-driver.service";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";
import {
  isRequestTimeoutError,
  PermissionError,
  SessionExpiredError,
} from "@/lib/api-client";

/**
 * In-app mailbox-sync driver.
 *
 * The mailbox sync runs sequentially server-side, but WP-Cron is unreliable, so the app
 * advances it while open: a self-pacing loop POSTs `/sync/advance` (one or two backfill
 * windows per tick). While work remains it ticks briskly; once everything is steady it
 * drops to a slow heartbeat (catching newly-queued work: a refresh, a new account, the
 * background sweep). Visibility-aware and overlap-guarded; the server also bounds each
 * call (per-user lock + time budget). Module-level so multiple mounts share one loop.
 *
 * Slow-server semantics (the D2 fix): /sync/advance can legitimately take tens of seconds
 * against a rate-limited IMAP server. The client gives it a 45s budget and treats a
 * `RequestTimeoutError` as "still working, come back soon". NOT a failure: no backoff, no
 * session error, stay on the ACTIVE cadence. Only after 3 consecutive timeouts does it raise
 * an INFO-level "running slowly" hint (never a session error). A `locked:true` response
 * (another request holds the per-user lock) is also NOT idle. Retry on the ACTIVE cadence.
 *
 * Alternation: after each advance resolves the driver runs the FULL background-queue drain
 * (`/sync/process-queue`) SEQUENTIALLY, never in parallel (pm.max_children=2), when the head
 * backfill is caught up (remaining===0) or every 4th active tick, so folders past the head get
 * their live-IMAP inventory filled on a starved-cron site.
 *
 * Failure policy (never silent, never hammering):
 * - Genuine advance failures (network/5xx) back off exponentially: min(ACTIVE·2^n, IDLE).
 * - `SessionExpiredError` / `PermissionError` (auth is gone; retrying can't fix it) drop
 *   straight to the idle cadence and surface a session error via the connection-state
 *   service immediately.
 * - Other failures surface via connection-state once they hit 3 consecutive misses, so a
 *   broken driver shows up in the UI instead of dying quietly in a console.
 * - Any success clears the session error and resets the backoff.
 */

const ACTIVE_INTERVAL_MS = 3500;
const IDLE_INTERVAL_MS = 45000;
const WINDOWS_PER_TICK = 2;

/** Consecutive failures before the driver surfaces a visible connection-state error. */
const FAILURE_SURFACE_THRESHOLD = 3;

/** Consecutive advance timeouts before the driver raises the info-level "running slowly" hint. */
const SLOW_HINT_THRESHOLD = 3;

/** Overdue-queue depth (per advance response) that counts toward the cron-health hint. */
const OVERDUE_HINT_THRESHOLD = 3;

/** Consecutive ticks at/over the overdue threshold before the cron-health chip shows. */
const OVERDUE_HINT_TICKS = 2;

/** Run the FULL background-queue drain every Nth active tick (in addition to remaining===0). */
const PROCESS_QUEUE_EVERY = 4;

/** Info-level hint reasons (surfaced as a chip, never as a session error). */
const SLOW_SYNC_HINT = "Mailbox sync is running slowly.";
const BACKGROUND_DELAYED_HINT = "Background sync delayed. Running in app";

let inFlight = false;
let timer: number | null = null;
let mountCount = 0;
let consecutiveFailures = 0;
let consecutiveTimeouts = 0;
let overdueStreak = 0;
let activeTickCount = 0;

function schedule(ms: number): void {
  if (typeof window === "undefined" || mountCount <= 0) {
    return;
  }
  if (timer !== null) {
    window.clearTimeout(timer);
  }
  timer = window.setTimeout(() => void tick(), ms);
}

function stop(): void {
  if (timer !== null && typeof window !== "undefined") {
    window.clearTimeout(timer);
  }
  timer = null;
}

/** Exponential backoff for consecutive failures: ACTIVE·2^(n-1), capped at IDLE. */
function backoffDelay(failures: number): number {
  const exp = ACTIVE_INTERVAL_MS * Math.pow(2, Math.max(0, failures - 1));
  return Math.min(exp, IDLE_INTERVAL_MS);
}

function isAuthTerminal(error: unknown): boolean {
  return (
    error instanceof SessionExpiredError || error instanceof PermissionError
  );
}

async function tick(): Promise<void> {
  if (
    inFlight ||
    typeof document === "undefined" ||
    document.hidden ||
    mountCount <= 0
  ) {
    schedule(IDLE_INTERVAL_MS);
    return;
  }

  inFlight = true;
  try {
    await runTick();
  } finally {
    inFlight = false;
  }
}

/**
 * One advance (+ possible sequential process-queue drain). Held under the `inFlight` guard by
 * {@link tick} so the alternating drain can never overlap the next advance (no parallel POSTs).
 */
async function runTick(): Promise<void> {
  const connectionState = getConnectionStateService();

  let result: Awaited<ReturnType<typeof advanceSync>> | null = null;
  let timedOut = false;
  let failed = false;
  let authTerminal = false;
  let failureReason = "";

  try {
    result = await advanceSync(WINDOWS_PER_TICK);
  } catch (error) {
    if (isRequestTimeoutError(error)) {
      timedOut = true;
    } else {
      failed = true;
      authTerminal = isAuthTerminal(error);
      failureReason =
        error instanceof Error && error.message
          ? error.message
          : "Mailbox sync request failed";
    }
  }

  // A timeout is NOT a failure: the server is slow-but-working (rate-limited IMAP). Do not
  // back off, do not mark a session error. Stay ACTIVE and come back soon. Only a sustained
  // run of timeouts raises the info-level "running slowly" hint.
  if (timedOut) {
    consecutiveFailures = 0;
    consecutiveTimeouts += 1;
    if (consecutiveTimeouts >= SLOW_HINT_THRESHOLD) {
      connectionState.markSyncDelayed(SLOW_SYNC_HINT);
    }
    schedule(ACTIVE_INTERVAL_MS);
    return;
  }

  if (failed) {
    consecutiveTimeouts = 0;
    consecutiveFailures += 1;

    if (authTerminal) {
      // Auth is gone (session expired or genuinely forbidden), retrying briskly cannot
      // help. Surface immediately and drop to the slow heartbeat; a later success (e.g.
      // after re-login in another tab) clears the error.
      connectionState.markSessionError(failureReason);
      schedule(IDLE_INTERVAL_MS);
      return;
    }

    if (consecutiveFailures >= FAILURE_SURFACE_THRESHOLD) {
      connectionState.markSessionError(failureReason);
    }
    schedule(backoffDelay(consecutiveFailures));
    return;
  }

  // Success.
  const advance = result ?? { advanced: 0, remaining: 0, locked: false, overdueJobs: 0 };
  consecutiveFailures = 0;
  consecutiveTimeouts = 0;
  connectionState.clearSessionError();

  // Cron-health hint: a sustained overdue backlog (>= threshold on 2 consecutive ticks) means
  // wp-cron's loopback is starved. Surface the info chip. Any drop clears it.
  if (advance.overdueJobs >= OVERDUE_HINT_THRESHOLD) {
    overdueStreak += 1;
    if (overdueStreak >= OVERDUE_HINT_TICKS) {
      connectionState.markSyncDelayed(BACKGROUND_DELAYED_HINT);
    }
  } else {
    overdueStreak = 0;
    connectionState.clearSyncDelayed();
  }

  // `locked:true` (another request holds the per-user lock) is NOT idle. Work may well be
  // in progress elsewhere; retry on the ACTIVE cadence instead of dropping to the 45s idle.
  const active = advance.remaining > 0 || advance.locked;
  activeTickCount = active ? activeTickCount + 1 : 0;

  // Alternate the FULL background-queue drain: when the head backfill is caught up
  // (remaining===0, so /sync/advance has nothing to do) or every Nth active tick. Sequential
  // (awaited under the inFlight guard) so it never issues a parallel POST; never throws.
  const shouldDrain =
    advance.remaining === 0 ||
    (active && activeTickCount % PROCESS_QUEUE_EVERY === 0);
  if (shouldDrain) {
    await processQueueSync();
  }

  schedule(active ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
}

/**
 * Drive the mailbox sync forward while the app is open. Mount once at the app shell.
 *
 * @param enabled Pass false to disable (e.g. no accounts yet).
 */
export function useSyncDriver(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    mountCount += 1;
    if (mountCount === 1) {
      schedule(800); // Kick shortly after the app mounts.
    }

    const onVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        schedule(400);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountCount -= 1;
      document.removeEventListener("visibilitychange", onVisibility);
      if (mountCount <= 0) {
        stop();
      }
    };
  }, [enabled]);
}
