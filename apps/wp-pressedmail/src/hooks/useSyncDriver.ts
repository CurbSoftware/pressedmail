import { useEffect } from "react";

import {
  advanceSync,
  processQueueSync,
  ServerBusyError,
} from "@/services/sync-driver.service";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";
import {
  isRequestTimeoutError,
  PermissionError,
  SessionExpiredError,
} from "@/lib/api-client";
import {
  announceLeader,
  isTabLeader,
  setTabLeader,
} from "@/lib/tab-channel";

/**
 * Leadership is shared with the rest of the app through `lib/tab-channel`: follower tabs
 * read it to skip polls the leader already runs. This lock is the only election.
 */
export { isTabLeader, subscribeLeadership } from "@/lib/tab-channel";

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
 * `RequestTimeoutError` as "still working": no session error, but it backs off, because the
 * aborted request is still holding a PHP worker. After 3 consecutive timeouts it raises an
 * INFO-level "running slowly" hint. A 429/503/5xx is a `ServerBusyError`: wait at least its
 * Retry-After and show a quiet "Server busy" chip. `locked:true` waits 15 s with no drain.
 * Only one visible tab drives the loop (Web Locks leader).
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
/** Another worker (usually wp-cron) holds the per-user lock: give it room, skip the drain. */
const LOCKED_INTERVAL_MS = 15000;

/** Browser lock that picks the one visible tab allowed to drive sync. */
const LEADER_LOCK = "pressedmail-sync-driver";
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
let consecutiveBusy = 0;
/** A load hint ("Server busy" or "running slowly") is up; the next success must clear it. */
let loadHintShown = false;
let overdueStreak = 0;
/**
 * Depth the app's own last FULL drain left behind, or null when that drain could not
 * answer. Read by the cron-health chip so it reports work the app has already tried to
 * clear, not a count that only reflects how late wp-cron's wakes are.
 */
let lastDrainOverdue: number | null = null;
let activeTickCount = 0;
let releaseLeadership: (() => void) | null = null;
/** Aborts a lock request still queued behind another tab, so a hidden tab never inherits it. */
let pendingClaim: AbortController | null = null;

/**
 * Take the leader lock while this tab is visible. Every open tab used to run its own
 * loop, so two tabs doubled the load on a two-worker shared host. A hidden tab gives the
 * lock up so a visible one can lead, and a queued request is cancelled when the tab hides.
 */
function claimLeadership(): void {
  if (
    typeof navigator === "undefined" ||
    !navigator.locks ||
    releaseLeadership ||
    pendingClaim
  ) {
    return;
  }
  const claim = new AbortController();
  pendingClaim = claim;
  navigator.locks.request(LEADER_LOCK, { signal: claim.signal }, () => {
    pendingClaim = null;
    // Granted after this tab hid or unmounted: hand the lock straight back.
    if (mountCount <= 0 || (typeof document !== "undefined" && document.hidden)) {
      return undefined;
    }
    return new Promise<void>((resolve) => {
      setTabLeader(true);
      releaseLeadership = () => {
        setTabLeader(false);
        releaseLeadership = null;
        resolve();
      };
      schedule(400);
    });
  }).catch(() => {
    if (pendingClaim === claim) {
      pendingClaim = null;
    }
    if (claim.signal.aborted) {
      return; // We cancelled it on purpose.
    }
    // Locks unavailable (sandboxed frame): lead alone rather than never syncing.
    setTabLeader(true);
  });
}

function yieldLeadership(): void {
  pendingClaim?.abort();
  pendingClaim = null;
  releaseLeadership?.();
}

/**
 * Whether the sync driver is mid-tick.
 *
 * Read by opportunistic background work (body prefetch) so it never competes
 * with an advance for the same IMAP connection. On a low-end server the two
 * running together is what makes both feel slow.
 */
export function isSyncBusy(): boolean {
  return inFlight;
}

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
    mountCount <= 0 ||
    !isTabLeader()
  ) {
    schedule(IDLE_INTERVAL_MS);
    return;
  }

  // Keep-alive: followers treat a leader they have not heard from for a while as gone.
  announceLeader();

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
  let busy: ServerBusyError | null = null;

  try {
    result = await advanceSync(WINDOWS_PER_TICK);
  } catch (error) {
    if (isRequestTimeoutError(error)) {
      timedOut = true;
    } else if (error instanceof ServerBusyError) {
      busy = error;
    } else {
      failed = true;
      authTerminal = isAuthTerminal(error);
      failureReason =
        error instanceof Error && error.message
          ? error.message
          : "Mailbox sync request failed";
    }
  }

  // A timeout is not a session failure (the server is slow but working), but it is a sign
  // the host is saturated: the aborted request keeps a PHP worker busy. Back off instead of
  // queuing another request 3.5 s later. A sustained run raises the "running slowly" hint.
  if (timedOut) {
    consecutiveFailures = 0;
    consecutiveTimeouts += 1;
    if (consecutiveTimeouts >= SLOW_HINT_THRESHOLD) {
      connectionState.markSyncDelayed(SLOW_SYNC_HINT);
      loadHintShown = true;
    }
    schedule(backoffDelay(consecutiveTimeouts));
    return;
  }

  // Rate limited or overloaded: wait at least what the server asked for, and say so
  // quietly. It is a load condition, not a broken session, so no red banner.
  if (busy) {
    consecutiveBusy += 1;
    const delay = Math.max(backoffDelay(consecutiveBusy), busy.retryAfterMs);
    connectionState.markSyncDelayed(
      `Server busy. Retrying in ${Math.round(delay / 1000)} s.`,
    );
    loadHintShown = true;
    schedule(delay);
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
  // Backfill progress is not announced to other tabs: during an initial sync it advances on
  // every tick for hours, and each announcement would make every follower refetch. The
  // leader's own view poll hands on changes that follower views can actually see.
  const advance = result ?? { advanced: 0, remaining: 0, locked: false, overdueJobs: 0 };
  consecutiveFailures = 0;
  consecutiveTimeouts = 0;
  consecutiveBusy = 0;
  connectionState.clearSessionError();
  // Requests succeed again, so a load hint is stale whatever the backlog says. The
  // cron-health check below re-raises its own chip if it still applies.
  if (loadHintShown) {
    loadHintShown = false;
    connectionState.clearSyncDelayed();
  }

  // Cron-health chip: it means work PressedMail owes you is not getting done. The count the
  // server reports already excludes dispatcher wakes that nothing can drain, so a depth
  // at/over the threshold is real queued work. On top of that the app must have run its OWN
  // full drain and still been left with the same backlog: a backlog the drain is relieving
  // is progress, and wp-cron being late on a site that is keeping up is not a fault either.
  if (advance.overdueJobs >= OVERDUE_HINT_THRESHOLD) {
    overdueStreak += 1;
    if (
      overdueStreak >= OVERDUE_HINT_TICKS &&
      lastDrainOverdue !== null &&
      lastDrainOverdue >= OVERDUE_HINT_THRESHOLD
    ) {
      connectionState.markSyncDelayed(BACKGROUND_DELAYED_HINT);
    }
  } else {
    overdueStreak = 0;
    lastDrainOverdue = null;
    connectionState.clearSyncDelayed();
  }

  // `locked:true`: another worker (usually wp-cron) holds the per-user lock and is doing
  // the work. Firing again every 3.5 s, plus a drain, only queued requests behind it on a
  // two-worker host. Come back in a while and skip the drain.
  if (advance.locked) {
    schedule(LOCKED_INTERVAL_MS);
    return;
  }

  const active = advance.remaining > 0;
  activeTickCount = active ? activeTickCount + 1 : 0;

  // Alternate the FULL background-queue drain: when the head backfill is caught up
  // (remaining===0, so /sync/advance has nothing to do) or every Nth active tick. Sequential
  // (awaited under the inFlight guard) so it never issues a parallel POST; never throws.
  const shouldDrain =
    advance.remaining === 0 ||
    (active && activeTickCount % PROCESS_QUEUE_EVERY === 0);
  if (shouldDrain) {
    const drained = await processQueueSync();
    if (drained !== null) {
      lastDrainOverdue = drained;
    }
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
      claimLeadership();
      schedule(800); // Kick shortly after the app mounts.
    }

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        yieldLeadership();
        return;
      }
      claimLeadership();
      schedule(400);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountCount -= 1;
      document.removeEventListener("visibilitychange", onVisibility);
      if (mountCount <= 0) {
        stop();
        yieldLeadership();
      }
    };
  }, [enabled]);
}
