import { useEffect } from "react";

import {
  advanceSync,
  drainBodiesSync,
  processQueueSync,
  ServerBusyError,
  type BodyLaneResult,
} from "@/services/sync-driver.service";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";
import type { SyncDelayedKind } from "@/services/interfaces/connection-state.interface";
import {
  isRequestTimeoutError,
  PermissionError,
  SessionExpiredError,
} from "@/lib/api-client";
import {
  announceLeader,
  isTabLeader,
  leaderSilenceMs,
  publishTabMessage,
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
 * INFO-level "running slowly" notice. A 429/503/5xx is a `ServerBusyError`: wait at least its
 * Retry-After and raise a quiet "server busy" notice. `locked:true` waits 15 s with no drain.
 * Only one visible tab drives the loop (Web Locks leader).
 *
 * Alternation: after each advance resolves the driver runs the FULL background-queue drain
 * (`/sync/process-queue`) SEQUENTIALLY, never in parallel (pm.max_children=2), when the head
 * backfill is caught up (remaining===0) or every 4th active tick, so folders past the head get
 * their live-IMAP inventory filled on a starved-cron site.
 *
 * Content lane: message bodies download on a lane of their own. A mail drain gives them what is
 * left of eight seconds, claimed last, so after the first header sync a mailbox filled for hours.
 * While the server reports body passes queued (`bodiesPending`) the driver gives content its own
 * turn each tick, after the mail work, and keeps the brisk cadence until it is done. That is
 * still one request at a time (pm.max_children=2). A host that can take two sets
 * `pressedmailPlugin.parallelSync`, and the turn then runs beside the advance. The lane rests
 * for a while when turns store nothing, or take long enough to say the server is busy.
 *
 * Telling the reader (the "sync is running late" notice): a hint used to be raised after a few
 * ticks, about seven seconds, and on a site still filling a new mailbox wp-cron really is late for
 * hours, so it never went away. Each hint now has to hold for a long stretch of wall-clock time
 * (see the *_NOTICE_* constants), one answer that worked starts the count over, and the background
 * hint never shows while the app is filling a new account itself, which the footer already says.
 *
 * Syncing on demand: the loop above is a cadence, and a person does not wait for it. A tab that is
 * switched to (visibility, a page restored from the back-forward cache, a window focused after a long
 * blur) runs a tick the moment it holds the leader lock, rather than whenever its timer comes round.
 * While sync is late (see {@link isSyncLate}), a genuine user action (a press, a key, a route change, focus
 * coming back) does the same through {@link kickSync}. Both go through the same inFlight guard and
 * leader lock as every other tick, are throttled, and never skip a wait the server asked for.
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

/** Consecutive ticks at/over the overdue threshold before the cron-health condition counts. */
const OVERDUE_HINT_TICKS = 2;

// How long a condition has to hold before the reader is told. Ticks are 3.5 s apart while there is
// work and 45 s when there is none, so a count of ticks measured seconds, and a first sync of a big
// mailbox (hours of backfill, with wp-cron genuinely late) kept the notice up from the start. These
// are wall-clock times, and a single good answer (or a single tick under the threshold) resets them.

/** The queue stayed behind, with the app's own drain unable to catch it up, this long outside a first sync. */
const OVERDUE_NOTICE_AFTER_MS = 10 * 60_000;
/**
 * Ticks come at least every 45 s while the tab is in view, and a tick takes a while. A silence longer than
 * this between two ticks, or inside one (a request handled this long after it began), means the tab was hidden
 * or the machine asleep, so nobody saw the condition hold: the clock starts again, and so do the runs of
 * timeouts and busy answers, instead of raising a notice on the strength of old observations. A notice those
 * observations had raised comes down with them.
 */
const RUN_MAX_GAP_MS = 4 * IDLE_INTERVAL_MS;
/** "Running slowly": the timeouts above, and this long since the first of them with no answer in between. */
const SLOW_NOTICE_AFTER_MS = 2 * 60_000;
/** "Server busy": a server that asks for a wait this long or longer is overloaded, and that is worth saying at once... */
const BUSY_NOTICE_WAIT_MS = 30_000;
/** ...and a server that keeps asking for shorter waits is worth saying so after this long. */
const BUSY_NOTICE_AFTER_MS = 2 * 60_000;

/** Sync is late when the tab in view that leads has had no answer that worked for this long: two idle beats. */
const LATE_AFTER_MS = 2 * IDLE_INTERVAL_MS;

/**
 * A tick started on demand (a user action, a return to the tab) waits until the last one ended this long ago.
 * A burst of clicks is one kick, a tab flickering in and out of view is one tick, and a person typing while sync
 * is late cannot make the app poll back to back: a long tick is followed by a rest, not by another tick.
 */
const SYNC_NOW_MIN_GAP_MS = 10_000;

/**
 * A kick caused by a user action fires this long after the LAST action, not at once. A tick holds a PHP worker
 * for up to twelve seconds of IMAP work and a shared host has two, so a tick started by the click itself starves
 * the request that click also made: mark-as-read queued behind the advance, then losing the IMAP race (the
 * repeated 424s of 1.7.0-beta.2). Waiting out the person's own requests first means the tick still starts "a
 * moment later", while the click always gets the mail server first. A return to the tab does not defer: nothing
 * of the person's is in flight at that moment.
 */
const ACTION_KICK_DEFER_MS = 2_500;

/** The longest wait a server can ask for (the sync service caps Retry-After at ten minutes). A longer one is a clock that moved. */
const MAX_HOLD_MS = 600_000;

/** A window that lost focus for this long syncs when it gets focus back. */
const LONG_BLUR_MS = 60_000;

/** A tab that follows another tab's lock asks that tab to speak up when it has heard nothing for this long. */
const FOLLOWER_STALE_MS = 60_000;

/** How long a tab that was just switched to waits for the leader lock before it counts itself a follower. */
const WAKE_LOCK_WAIT_MS = 1_000;

/** Run the FULL background-queue drain every Nth active tick (in addition to remaining===0). */
const PROCESS_QUEUE_EVERY = 4;

/**
 * Advances in a row that report work remaining but move none of it (a refused job, a folder the server is retrying on its
 * own schedule) before the driver stops treating the mailbox as busy. Past this it ticks on the idle cadence, with a full
 * drain each time, until an advance moves something again.
 */
const NO_PROGRESS_LIMIT = 2;

/** Consecutive content turns that stored nothing before the lane rests (a slow server, a full cache). */
const BODY_STALL_LIMIT = 3;

/** How long the lane rests after that. */
const BODY_REST_MS = 300_000;

/**
 * A content turn slower than this means a busy server: the lane waits as long again before the next. The server's own
 * lane budget is twelve seconds and a turn that stores bodies ends a little after it, so a healthy turn is 9 to 13
 * seconds; this sits above that and below the request timeout.
 */
const BODY_SLOW_MS = 20_000;

let inFlight = false;
let timer: number | null = null;
let mountCount = 0;
let consecutiveFailures = 0;
let consecutiveTimeouts = 0;
let consecutiveBusy = 0;
/** The notice the driver has raised and not yet lowered. A slow or busy one clears on the next success. */
let raised: SyncDelayedKind | null = null;
/** When the current run of timeouts, and of busy answers, began (wall clock). */
let slowSince = 0;
let busySince = 0;
let overdueStreak = 0;
/**
 * When the cron-health condition began to hold outside a first sync, and when it was last checked
 * (wall clock). Null while it does not hold.
 */
let overdueSince: number | null = null;
let overdueCheckedAt = 0;
/** The footer says a new account is syncing: the app is doing the backfill itself and wp-cron is expected to be late. */
let footerSaysNewAccount = false;
/** When the server last answered an advance without an error (wall clock). */
let lastAnswerAt = 0;
/** Nothing is sent before this (wall clock): the server's Retry-After, a lock on the mailbox, or a failure backoff. */
let notBefore = 0;
/** When the last tick ended (wall clock). */
let lastTickEndedAt = 0;
/** This tab was just switched to and runs a tick as soon as it leads. */
let wakePending = false;
/** This tab was just switched to without the lock, and checks on the leader if it still follows one. */
let followerCheckPending = false;
/** When this window lost focus (wall clock), or null while it has it. */
let blurredAt: number | null = null;
/**
 * Depth the app's own last FULL drain left behind, or null when that drain could not
 * answer. Read by the cron-health check so it reports work the app has already tried to
 * clear, not a count that only reflects how late wp-cron's wakes are.
 */
let lastDrainOverdue: number | null = null;
let activeTickCount = 0;
/** Advances in a row that reported work remaining and advanced none of it. */
let noProgressStreak = 0;
/** When the last full queue drain ran. */
let lastDrainAt = 0;
/** The last tick kept the short interval only because content was queued, not because mail was. */
let contentDriven = false;
/** Content turns in a row that stored nothing. */
let bodyStalls = 0;
/** The lane takes no turn before this time. */
let bodyRestUntil = 0;
/** Body passes the server last said were queued. */
let bodiesPendingLast = 0;
/** A content turn started beside the advance, awaited when the tick ends. */
let parallelBodyTurn: Promise<BodyLaneResult | null> | null = null;
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
      // A tab that was switched to syncs the moment it leads; one that just mounted takes a breath first.
      if (wakePending) runWake();
      else schedule(400);
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
    // A tab that was switched to while this request was out looked, found that it did not lead yet, and armed only
    // a check on the leader. This refusal is what makes it lead, so it syncs now, as it would on a grant, and not
    // when the next timer comes round. Later switches see a tab that leads and sync from wake() itself.
    if (wakePending) runWake();
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

/** Callers waiting for the current tick to end. */
const idleWaiters: Array<() => void> = [];

/**
 * Resolves when the sync driver is not mid-tick, or after `timeoutMs`. A tick can now hold a twelve second content
 * turn, so background work that must not share the server with it waits for the gap instead of giving up.
 */
export function whenSyncIdle(timeoutMs = 20_000): Promise<void> {
  if (!inFlight || typeof window === "undefined") {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      const at = idleWaiters.indexOf(wake);
      if (at >= 0) idleWaiters.splice(at, 1);
      resolve();
    }, timeoutMs);
    const wake = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    idleWaiters.push(wake);
  });
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

function raise(kind: SyncDelayedKind): void {
  // A request that was out when the driver was switched off ends after the cleanup has run: nothing is left
  // to lower what it would raise.
  if (mountCount <= 0) return;
  raised = kind;
  getConnectionStateService().markSyncDelayed(kind);
}

function lower(): void {
  if (raised === null) return;
  raised = null;
  getConnectionStateService().clearSyncDelayed();
}

/** The server, a lock or a backoff says wait this long: no on-demand tick may go before it. */
function holdOff(ms: number): void {
  notBefore = Date.now() + ms;
}

/**
 * What is left of that wait. A wait longer than any a server asks for means the clock moved back since it was
 * set, so it is dropped rather than held for the whole shift.
 */
function remainingHold(): number {
  const left = notBefore - Date.now();
  if (left > MAX_HOLD_MS) notBefore = 0;
  return left > 0 && left <= MAX_HOLD_MS ? left : 0;
}

/** Milliseconds since `at`: Infinity when the clock has moved back past it, so nothing then looks recent. */
function since(at: number): number {
  const elapsed = Date.now() - at;
  return elapsed < 0 ? Infinity : elapsed;
}

/**
 * The cron-health condition: the server reports work overdue for consecutive ticks, and the app's own
 * FULL drain has run and still left it. A backlog the drain is relieving is progress, and wp-cron being
 * late on a site that is keeping up is not a fault either. The count the server reports already excludes
 * dispatcher wakes that nothing can drain, so a depth at or over the threshold is real queued work.
 */
function cronHealthLate(): boolean {
  return (
    overdueStreak >= OVERDUE_HINT_TICKS &&
    lastDrainOverdue !== null &&
    lastDrainOverdue >= OVERDUE_HINT_THRESHOLD
  );
}

/**
 * Whether sync is running late, which is wider than whether the reader is told. A load hint is up, the
 * timeouts or the busy answers that lead to one have begun, the cron-health condition holds (whatever
 * the dwell), or the tab in view has had no answer that worked for two idle beats. Background work that
 * would add load to a server in that state (the body pre-fetch) stands down on it.
 */
export function isSyncLate(): boolean {
  if (mountCount <= 0) return false;
  if (
    raised !== null ||
    consecutiveTimeouts >= SLOW_HINT_THRESHOLD ||
    consecutiveBusy > 0 ||
    cronHealthLate()
  ) {
    return true;
  }
  const leading =
    typeof document !== "undefined" && !document.hidden && isTabLeader();
  return leading && since(lastAnswerAt) > LATE_AFTER_MS;
}

/**
 * Begin a new run of observations after a silence long enough that nobody saw the last one end. The runs of
 * timeouts and busy answers, when each began, the background condition's dwell and the notice they raised all
 * describe the time before the silence, so they go together. Resetting only the counters left an old notice up
 * when the first request back also timed out or was told to wait: neither of those branches lowers a notice, so
 * the reader kept seeing a verdict from before they left instead of one this run had earned.
 *
 * Called at the start of a tick that follows such a silence, and when a request that was out across one is handled.
 */
function startNewRun(): void {
  consecutiveTimeouts = 0;
  consecutiveBusy = 0;
  slowSince = 0;
  busySince = 0;
  overdueSince = null;
  lower();
}

function isAuthTerminal(error: unknown): boolean {
  return (
    error instanceof SessionExpiredError || error instanceof PermissionError
  );
}

async function tick(): Promise<void> {
  const visible = typeof document !== "undefined" && !document.hidden;
  if (inFlight || !visible || mountCount <= 0 || !isTabLeader()) {
    // A tick still running (a content turn beside the advance) is not a tab at rest: look again soon.
    schedule(inFlight ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
    return;
  }

  // Keep-alive: followers treat a leader they have not heard from for a while as gone.
  announceLeader();

  // Timeouts and busy answers count only while they are one unbroken run. After a long silence (the tab was
  // hidden, the machine asleep) this tick begins a new one, so two timeouts before an hour away and one after
  // it are not three in a row, and a notice the old run raised does not wait for this one to answer.
  if (since(lastTickEndedAt) > RUN_MAX_GAP_MS) startNewRun();

  inFlight = true;
  try {
    await runTick();
  } finally {
    // A turn started beside the advance must be over before the next tick can start.
    await parallelBodyTurn;
    parallelBodyTurn = null;
    inFlight = false;
    lastTickEndedAt = Date.now();
    for (const wake of idleWaiters.splice(0)) {
      wake();
    }
  }
}

/**
 * Run a tick now, for a tab that was just switched to: the moment it leads, not when its timer comes round.
 * A tick already out is the sync. One that ended a moment ago has just done it, and the timer that is armed
 * will come round. A wait the server asked for (Retry-After, a lock on the mailbox, a backoff) is kept: the
 * tick is then armed for when it ends.
 */
function runWake(): void {
  wakePending = false;
  followerCheckPending = false;
  if (inFlight || since(lastTickEndedAt) < SYNC_NOW_MIN_GAP_MS) return;
  const wait = remainingHold();
  stop();
  if (wait > 0) schedule(wait);
  else void tick();
}

/**
 * A tab came into view: it was switched to, or restored from the back-forward cache, or its window got focus back
 * after a long blur. Take the leader lock if it is free and sync the moment it is ours. When another tab holds the
 * lock this one follows it, and a moment from now it checks that the leader is alive. Hidden tabs do nothing.
 */
function wake(): void {
  if (typeof document === "undefined" || document.hidden || mountCount <= 0) {
    return;
  }
  wakePending = true;
  claimLeadership();
  if (isTabLeader()) {
    runWake();
    return;
  }
  // The lock is not ours yet. A moment from now it is known whether this tab leads; if it does not, it follows
  // someone, and checks on them. That is a timer of its own and not the tick's: a tick armed here would run
  // when it fires whatever runWake() decided, and would defeat its throttle.
  followerCheckPending = true;
  window.setTimeout(checkLeaderAfterWake, WAKE_LOCK_WAIT_MS);
}

/**
 * A tab that was just switched to still follows another tab. What this tab last concluded about sync (a notice it
 * raised while it led) is not about this tab any more, so it comes down. And if the leader has said nothing for a
 * while, ask it to speak up, once: it announces itself and re-sends the feed and the queue it last loaded, so this
 * view catches up without an advance of its own. Only the leader advances.
 */
function checkLeaderAfterWake(): void {
  if (!followerCheckPending) return;
  followerCheckPending = false;
  if (
    mountCount <= 0 ||
    typeof document === "undefined" ||
    document.hidden ||
    isTabLeader()
  ) {
    return;
  }
  overdueSince = null;
  lower();
  if (leaderSilenceMs() > FOLLOWER_STALE_MS) {
    publishTabMessage({ type: "hello" });
  }
}

/** Everything kickSync checks before starting a tick, in one place for the immediate and deferred paths. */
function canKickNow(): boolean {
  if (mountCount <= 0 || typeof document === "undefined" || document.hidden) {
    return false;
  }
  if (!isTabLeader()) {
    claimLeadership();
    return false;
  }
  return !(
    inFlight ||
    remainingHold() > 0 ||
    since(lastTickEndedAt) < SYNC_NOW_MIN_GAP_MS ||
    !isSyncLate()
  );
}

/**
 * A genuine user action while sync is late: tick now instead of waiting out the cadence. Called for a press, a
 * key, a route change and focus coming back. Whatever the person does is the signal, so it does not matter which
 * screen they are on.
 *
 * Only the visible tab that leads can sync (a follower asks for the lock and waits for it). Never while a tick is
 * out, never before a wait the server asked for is over, and never within SYNC_NOW_MIN_GAP_MS of the end of the
 * last tick, so a burst of actions is one kick and a long tick is followed by a rest. Returns whether a tick was
 * started. `reason` names the action for the next reader.
 */
export function kickSync(reason: string): boolean {
  if (!canKickNow()) {
    return false;
  }
  stop();
  void tick();
  return true;
}

/** The deferred kick's timer, shared by every action and cancelled by hiding, unmounting and firing. */
let actionKickTimer: ReturnType<typeof setTimeout> | null = null;

function cancelActionKick(): void {
  if (actionKickTimer !== null) {
    clearTimeout(actionKickTimer);
    actionKickTimer = null;
  }
}

/**
 * A user action's deferred kick: instead of ticking at once (kickSync), wait out the person's own requests first
 * (see ACTION_KICK_DEFER_MS), then tick if the same guards still allow it. Every action re-arms the wait, so a
 * person reading their mail keeps deferring the tick until they pause; a hidden tab, an unmount or the tick itself
 * cancels it. `reason` names the action for the next reader.
 */
export function scheduleActionKick(reason: string): boolean {
  if (mountCount <= 0 || typeof document === "undefined" || document.hidden) {
    return false;
  }
  if (actionKickTimer !== null) clearTimeout(actionKickTimer);
  const timer = setTimeout(() => {
    if (actionKickTimer !== timer) return; // A newer action re-armed the wait; this one was cancelled.
    actionKickTimer = null;
    if (!canKickNow()) return;
    stop();
    void tick();
  }, ACTION_KICK_DEFER_MS);
  actionKickTimer = timer;
  return true;
}

/** One content turn, and what it says about whether to keep going. Never throws. */
async function bodyTurn(): Promise<BodyLaneResult | null> {
  const started = Date.now();
  const turn = await drainBodiesSync();
  const took = Date.now() - started;
  if (turn === null || turn.stored === 0) {
    bodyStalls += 1;
    if (bodyStalls >= BODY_STALL_LIMIT) {
      bodyStalls = 0;
      bodyRestUntil = Date.now() + BODY_REST_MS;
    }
  } else {
    bodyStalls = 0;
  }
  if (took > BODY_SLOW_MS) {
    bodyRestUntil = Math.max(bodyRestUntil, Date.now() + took);
  }
  if (turn) {
    bodiesPendingLast = turn.pending;
  }
  return turn;
}

function bodyLaneResting(): boolean {
  return Date.now() < bodyRestUntil;
}

/**
 * One advance (+ possible sequential process-queue drain). Held under the `inFlight` guard by
 * {@link tick} so the alternating drain can never overlap the next advance (no parallel POSTs).
 */
async function runTick(): Promise<void> {
  const connectionState = getConnectionStateService();
  const startedAt = Date.now();

  // A host that can run two requests at once lets content download beside the advance.
  if (
    typeof window !== "undefined" &&
    window.pressedmailPlugin?.parallelSync === true &&
    bodiesPendingLast > 0 &&
    !bodyLaneResting()
  ) {
    parallelBodyTurn = bodyTurn();
  }

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

  // A request that was out across a silence (the machine slept, the tab was frozen) is handled long after it began,
  // and the check at the start of the tick could not see that silence. What it reports is the first observation of
  // a new run, not the next of one that began before the silence, and its start says nothing about when a run
  // began: the new run is dated from now, before any threshold below is read.
  const outAcrossSilence = since(startedAt) > RUN_MAX_GAP_MS;
  if (outAcrossSilence) startNewRun();
  const observedAt = outAcrossSilence ? Date.now() : startedAt;

  // A timeout is not a session failure (the server is slow but working), but it is a sign
  // the host is saturated: the aborted request keeps a PHP worker busy. Back off instead of
  // queuing another request 3.5 s later. Three timeouts in a row, and two minutes since the first
  // with no answer that worked between them, raise the "running slowly" notice.
  if (timedOut) {
    consecutiveFailures = 0;
    consecutiveTimeouts += 1;
    if (consecutiveTimeouts === 1) slowSince = observedAt;
    if (
      consecutiveTimeouts >= SLOW_HINT_THRESHOLD &&
      Date.now() - slowSince >= SLOW_NOTICE_AFTER_MS
    ) {
      raise("slow");
    }
    const wait = backoffDelay(consecutiveTimeouts);
    holdOff(wait);
    schedule(wait);
    return;
  }

  // Rate limited or overloaded: wait at least what the server asked for. It is a load
  // condition, not a broken session, so no red banner, and the reader is told only when the
  // wait itself is long or the server keeps asking.
  if (busy) {
    consecutiveBusy += 1;
    if (consecutiveBusy === 1) busySince = observedAt;
    const delay = Math.max(backoffDelay(consecutiveBusy), busy.retryAfterMs);
    if (
      delay >= BUSY_NOTICE_WAIT_MS ||
      Date.now() - busySince >= BUSY_NOTICE_AFTER_MS
    ) {
      raise("busy");
    }
    holdOff(delay);
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
      holdOff(IDLE_INTERVAL_MS);
      schedule(IDLE_INTERVAL_MS);
      return;
    }

    if (consecutiveFailures >= FAILURE_SURFACE_THRESHOLD) {
      connectionState.markSessionError(failureReason);
    }
    const wait = backoffDelay(consecutiveFailures);
    holdOff(wait);
    schedule(wait);
    return;
  }

  // Success.
  // Backfill progress is not announced to other tabs: during an initial sync it advances on
  // every tick for hours, and each announcement would make every follower refetch. The
  // leader's own view poll hands on changes that follower views can actually see.
  const advance = result ?? {
    advanced: 0,
    remaining: 0,
    bodiesPending: 0,
    locked: false,
    overdueJobs: 0,
  };
  const now = Date.now();
  lastAnswerAt = now;
  notBefore = 0;
  consecutiveFailures = 0;
  consecutiveTimeouts = 0;
  consecutiveBusy = 0;
  connectionState.clearSessionError();

  // What is raised after this tick is the cron-health notice or nothing, decided once. Requests succeed
  // again, so a slow or busy notice is stale whatever the backlog says; but a blip must not end and restart
  // an episode that is still going (a background notice the reader dismissed would come back).
  //
  // Cron-health notice: it means work PressedMail owes you is not getting done. See
  // cronHealthLate() for what counts. It has to hold for ten minutes of wall-clock time, and
  // never while the app is filling a new account (a late wp-cron is expected then, and the
  // footer already says the account is syncing), so a tick that does not fit starts the
  // count over and takes the notice down at once.
  if (advance.overdueJobs >= OVERDUE_HINT_THRESHOLD) {
    overdueStreak += 1;
  } else {
    overdueStreak = 0;
    lastDrainOverdue = null;
  }
  const fillingNewAccount = advance.remaining > 0 || footerSaysNewAccount;
  let backgroundDue = false;
  if (cronHealthLate() && !fillingNewAccount) {
    const gap = now - overdueCheckedAt;
    if (overdueSince === null || gap < 0 || gap > RUN_MAX_GAP_MS) {
      overdueSince = now;
    }
    overdueCheckedAt = now;
    backgroundDue = now - overdueSince >= OVERDUE_NOTICE_AFTER_MS;
  } else {
    overdueSince = null;
  }
  if (backgroundDue) raise("background");
  else lower();

  // `locked:true`: another worker (usually wp-cron) holds the per-user lock and is doing
  // the work. Firing again every 3.5 s, plus a drain, only queued requests behind it on a
  // two-worker host. Come back in a while and skip the drain.
  if (advance.locked) {
    holdOff(LOCKED_INTERVAL_MS);
    schedule(LOCKED_INTERVAL_MS);
    return;
  }

  // Work the advance keeps reporting but never moves is not a reason to ask again every few seconds: each ask holds one
  // of a shared host's two PHP workers. After a couple of such answers the driver goes idle until something moves.
  noProgressStreak =
    advance.remaining > 0 && advance.advanced === 0 ? noProgressStreak + 1 : 0;
  const active = advance.remaining > 0 && noProgressStreak < NO_PROGRESS_LIMIT;
  activeTickCount = active ? activeTickCount + 1 : 0;

  // Alternate the FULL background-queue drain: when the advance has nothing to do (caught up,
  // or not moving) or every Nth active tick. Sequential
  // (awaited under the inFlight guard) so it never issues a parallel POST; never throws.
  // A tick that is here only because content is queued (the previous one kept its short interval for that, with the
  // mail caught up) drains on the idle cadence, not every few seconds: the content turn below already does the body
  // work, and a second full drain would run the same work again and wake the rests the drain sets.
  // Mail that is caught up and mail that is not moving count the same here: neither earns a drain every few seconds.
  const contentOnly =
    contentDriven && !active && Date.now() - lastDrainAt < IDLE_INTERVAL_MS;
  const shouldDrain =
    !contentOnly && (!active || activeTickCount % PROCESS_QUEUE_EVERY === 0);
  if (shouldDrain) {
    lastDrainAt = Date.now();
    const drained = await processQueueSync();
    if (drained !== null) {
      lastDrainOverdue = drained;
    }
  }

  // Message content gets its own turn after the mail work, while the server has passes queued
  // (or already had it beside the advance). The server's number outlives a turn only until the
  // next advance reports again.
  let laneTurn: BodyLaneResult | null = null;
  if (parallelBodyTurn) {
    laneTurn = await parallelBodyTurn;
    parallelBodyTurn = null;
  } else if (advance.bodiesPending > 0 && !bodyLaneResting()) {
    laneTurn = await bodyTurn();
  }
  const bodiesPending = laneTurn ? laneTurn.pending : advance.bodiesPending;
  bodiesPendingLast = bodiesPending;
  const bodiesActive = bodiesPending > 0 && !bodyLaneResting();
  contentDriven = !active && bodiesActive;

  schedule(active || bodiesActive ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
}

/**
 * Drive the mailbox sync forward while the app is open. Mount once at the app shell.
 *
 * @param enabled Pass false to disable (e.g. no accounts yet).
 * @param newAccountSyncing Pass true while the footer says a new account is syncing. The app is
 *   then filling the mailbox itself, wp-cron is expected to be late, and the background notice
 *   waits until it is done.
 */
export function useSyncDriver(enabled = true, newAccountSyncing = false): void {
  useEffect(() => {
    footerSaysNewAccount = enabled && newAccountSyncing;
    return () => {
      footerSaysNewAccount = false;
    };
  }, [enabled, newAccountSyncing]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    mountCount += 1;
    if (mountCount === 1) {
      lastAnswerAt = Date.now(); // Silence is counted from the moment the app opened.
      claimLeadership();
      schedule(800); // Kick shortly after the app mounts.
    }

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        wakePending = false;
        followerCheckPending = false;
        cancelActionKick();
        yieldLeadership();
        return;
      }
      wake();
    };
    // A page going into the back-forward cache must not keep the lock, and one restored from it is a tab
    // switched to. The visibility event is not guaranteed to come in either direction there.
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) yieldLeadership();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) wake();
    };
    // Focus returning after a long blur is a switch back to this window; after a short one it is a user action.
    const onBlur = () => {
      blurredAt = Date.now();
    };
    const onFocus = () => {
      const away = blurredAt === null ? 0 : Date.now() - blurredAt;
      blurredAt = null;
      if (away >= LONG_BLUR_MS) wake();
      else scheduleActionKick("focus");
    };
    const onAction = (event: Event) => {
      scheduleActionKick(event.type);
    };
    const passive = { capture: true, passive: true } as const;
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("pointerdown", onAction, passive);
    document.addEventListener("keydown", onAction, passive);
    window.addEventListener("hashchange", onAction);
    window.addEventListener("popstate", onAction);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      mountCount -= 1;
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", onAction, passive);
      document.removeEventListener("keydown", onAction, passive);
      window.removeEventListener("hashchange", onAction);
      window.removeEventListener("popstate", onAction);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (mountCount <= 0) {
        stop();
        cancelActionKick();
        yieldLeadership();
        wakePending = false;
        followerCheckPending = false;
        // Nothing left to clear it: a notice raised by a driver that has gone away would stay up.
        overdueSince = null;
        lower();
      }
    };
  }, [enabled]);
}
