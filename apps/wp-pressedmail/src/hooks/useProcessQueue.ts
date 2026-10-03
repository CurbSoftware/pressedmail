"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelProcessTask,
  listProcessTasks,
  type ProcessTask,
  type ProcessTaskStatus,
} from "@/services/process-queue.service";
import { abortClientOp } from "@/lib/bulk-activity";
import {
  isFollowingLeader,
  isTabLeader,
  publishTabMessage,
  subscribeLeadership,
  subscribeTabMessages,
  type TabMessage,
} from "@/lib/tab-channel";

/**
 * Shared, visibility-aware poller for the PressedMail process / activity queue.
 *
 * Both the footer and the activity panel read the queue, so polling lives in a
 * single module-level store rather than per-component. Every consumer that calls
 * `useProcessQueue()` subscribes to ONE poller; the first subscriber starts it
 * and the last unsubscribes / stops it.
 *
 * Polling cadence (modeled on `useInboxSurfaceBoot`'s sync poll, ~lines
 * 720-774): poll only while the tab is visible, pause on hide, and run one
 * immediate catch-up on `visibilitychange`. While any task is active
 * (queued/running) we poll on a short interval; when nothing is active we stop
 * the interval and resume on the next enqueue/refresh or when the tab regains
 * focus. The `GET /process-queue` request only reports; WP-Cron and the worker
 * chain advance the queue.
 *
 * Across tabs: the queue is per user, so the leader tab (see `tab-channel`) relays every
 * snapshot its poller fetches, and a follower that heard one recently applies it instead
 * of polling. User-driven refreshes (opening the Activity sheet, after starting or
 * cancelling a task) still fetch directly. When the relays stop (the leader resigned,
 * went idle or was hidden) the follower's own interval polls again.
 */

const ACTIVE_POLL_INTERVAL_MS = 2500;
/**
 * Background folder sync (`sync_track`) keeps the queue "active" for the whole backfill.
 * Polling that every 2.5 s was the busiest request on a shared host, and it only moves a
 * progress count, so it gets a slow cadence. User-started work keeps the brisk one.
 */
const BACKGROUND_POLL_INTERVAL_MS = 10000;

const ACTIVE_STATUSES: ReadonlySet<ProcessTaskStatus> = new Set([
  "queued",
  "running",
]);

export function isProcessTaskActive(task: ProcessTask): boolean {
  return ACTIVE_STATUSES.has(task.status);
}

interface ProcessQueueState {
  tasks: ProcessTask[];
  loading: boolean;
  error: string | null;
}

type Listener = (state: ProcessQueueState) => void;

let state: ProcessQueueState = {
  tasks: [],
  loading: false,
  error: null,
};

const listeners = new Set<Listener>();
let intervalId: number | null = null;
let inFlight = false;
let visibilityBound = false;

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(next: Partial<ProcessQueueState>) {
  state = { ...state, ...next };
  emit();
}

function hasActiveTasks(): boolean {
  return state.tasks.some(isProcessTaskActive);
}

function pollPeriod(): number {
  return state.tasks.some(
    (task) => isProcessTaskActive(task) && task.kind !== "sync_track",
  )
    ? ACTIVE_POLL_INTERVAL_MS
    : BACKGROUND_POLL_INTERVAL_MS;
}

let intervalPeriod = 0;

/**
 * A follower polls itself again once relays stop for this long: over two of the
 * leader's slowest (10 s) polls, so one late relay does not start a duplicate poller.
 */
const RELAY_FRESH_MS = 25_000;
let lastRelayAt = 0;
/**
 * Active task ids in the last relay. The leader stops polling once its queue goes
 * idle, so an all-terminal relay is its last one: nothing to stand down for.
 */
let relayActiveIds: ReadonlySet<number> = new Set();
/** A relay whose request started before this tab's own fetch or change is stale. */
let ignoreRelaysBefore = 0;
/**
 * When the request behind the snapshot in the store started, relayed or fetched. A
 * slow fetch of this tab's own must not overwrite a newer relay that landed first.
 */
let appliedRequestedAt = 0;
/** This tab's latest relay while leading, replayed to a tab that says hello. */
let lastLeaderRelay: Extract<TabMessage, { type: "queue" }> | null = null;
let unsubscribeRelay: (() => void) | null = null;
let unsubscribeLeadership: (() => void) | null = null;

function coveredByLeader(): boolean {
  return (
    !isTabLeader() &&
    isFollowingLeader() &&
    Date.now() - lastRelayAt < RELAY_FRESH_MS &&
    relayActiveIds.size > 0 &&
    // Work this tab fetched that the leader has not relayed yet (a sweep just
    // started here) needs this tab's own brisk cadence until a relay includes it.
    state.tasks.every(
      (task) => !isProcessTaskActive(task) || relayActiveIds.has(task.id),
    )
  );
}

/** Keep the interval running only while work is active and the tab is visible. */
function reschedule() {
  if (!hasActiveTasks()) {
    stopInterval();
  } else if (intervalId !== null && intervalPeriod !== pollPeriod()) {
    stopInterval();
    startInterval();
  } else if (typeof document === "undefined" || !document.hidden) {
    startInterval();
  }
}

function onTabMessage(message: TabMessage) {
  // A tab that just opened gets the current queue without waiting for a poll.
  // Only a snapshot young enough that a follower would still trust it: an idle
  // leader stops polling, so its last relay can be far older than the queue.
  if (message.type === "hello") {
    if (
      isTabLeader() &&
      lastLeaderRelay &&
      Date.now() - lastLeaderRelay.requestedAt < RELAY_FRESH_MS
    ) {
      publishTabMessage(lastLeaderRelay);
    }
    return;
  }
  if (message.type !== "queue" || isTabLeader()) return;
  if (message.requestedAt < Math.max(ignoreRelaysBefore, appliedRequestedAt)) return;
  appliedRequestedAt = message.requestedAt;
  lastRelayAt = Date.now();
  const tasks = message.state.tasks as ProcessTask[];
  relayActiveIds = new Set(
    tasks.filter(isProcessTaskActive).map((task) => task.id),
  );
  setState({
    tasks,
    loading: false,
    error: message.state.error,
  });
  // The interval keeps ticking while covered (each tick is a no-op) so it resumes
  // polling by itself when the relays stop.
  reschedule();
}

/**
 * `automatic` polls (interval, mount, visibility) stand down while a leader tab
 * relays the queue; user-driven refreshes always fetch.
 */
async function poll(automatic: boolean): Promise<void> {
  if (inFlight || typeof window === "undefined") {
    return;
  }
  if (automatic && coveredByLeader()) {
    return;
  }
  // Never hit the network from a hidden tab. A backgrounded queue must not wake
  // to drain on the server.
  if (typeof document !== "undefined" && document.hidden) {
    return;
  }

  inFlight = true;
  if (state.loading !== true) {
    setState({ loading: true });
  }

  const requestedAt = Date.now();
  // Only a user refresh fences off older relays (it follows a cancel or an enqueue
  // the relay cannot know about). An automatic poll is ordered by
  // `appliedRequestedAt`: fencing here dropped the leader's hello replay when a
  // follower's mount poll went out first, so the next consumer's mount fetched again.
  if (!automatic) ignoreRelaysBefore = Math.max(ignoreRelaysBefore, requestedAt);
  try {
    const tasks = await listProcessTasks();
    if (requestedAt < appliedRequestedAt) {
      // A relay from a later request already landed; this response is older news.
      setState({ loading: false });
      return;
    }
    appliedRequestedAt = requestedAt;
    setState({ tasks, loading: false, error: null });
    if (isTabLeader()) {
      const relay = { type: "queue" as const, state, requestedAt };
      lastLeaderRelay = relay;
      publishTabMessage(relay);
    }
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : "Activity queue load failed.",
    });
  } finally {
    inFlight = false;
    // Stop the recurring interval once nothing is active; a future enqueue or
    // visibility change restarts it.
    reschedule();
  }
}

function startInterval() {
  if (intervalId !== null || typeof window === "undefined") {
    return;
  }
  intervalPeriod = pollPeriod();
  intervalId = window.setInterval(() => {
    void poll(true);
  }, intervalPeriod);
}

function stopInterval() {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function handleVisibilityChange() {
  if (typeof document === "undefined") {
    return;
  }
  if (document.hidden) {
    stopInterval();
  } else {
    // Immediate catch-up (a follower already has the relayed queue), then resume
    // the interval if work is still pending.
    void poll(true).then(reschedule);
  }
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") {
    return;
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);
  visibilityBound = true;
  unsubscribeRelay ??= subscribeTabMessages(onTabMessage);
  // A snapshot from a previous leadership term must never answer a hello in the next.
  unsubscribeLeadership ??= subscribeLeadership(() => {
    if (!isTabLeader()) lastLeaderRelay = null;
  });
}

function unbindVisibility() {
  if (!visibilityBound || typeof document === "undefined") {
    return;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  visibilityBound = false;
  unsubscribeRelay?.();
  unsubscribeRelay = null;
  unsubscribeLeadership?.();
  unsubscribeLeadership = null;
}

/**
 * Trigger an immediate refresh and (re)start polling if work is pending. Safe to
 * call without subscribing to the hook, e.g. right after enqueuing a sweep so
 * the new task surfaces without waiting for the next interval tick.
 *
 * Pass `{ automatic: true }` from a timer: that refresh is skipped while a leader tab
 * relays the queue to this one.
 */
export function refreshProcessQueue(options?: { automatic?: boolean }): void {
  if (typeof window === "undefined") {
    return;
  }
  bindVisibility();
  void poll(options?.automatic === true).then(reschedule);
}

export interface UseProcessQueueResult {
  tasks: ProcessTask[];
  activeTasks: ProcessTask[];
  queuedTasks: ProcessTask[];
  runningTasks: ProcessTask[];
  /** Terminal tasks (done/failed/cancelled/skipped), newest first: the History tab. */
  historyTasks: ProcessTask[];
  /** The running task, or the first queued one when nothing is running. */
  currentTask: ProcessTask | null;
  hasActive: boolean;
  loading: boolean;
  error: string | null;
  cancel: (taskId: number) => Promise<void>;
  refresh: () => void;
}

export function useProcessQueue(): UseProcessQueueResult {
  const [snapshot, setSnapshot] = useState<ProcessQueueState>(state);

  useEffect(() => {
    listeners.add(setSnapshot);
    bindVisibility();
    // First subscriber kicks off the initial load; the poll self-schedules the
    // interval only while work is active.
    void poll(true).then(reschedule);

    return () => {
      listeners.delete(setSnapshot);
      if (listeners.size === 0) {
        stopInterval();
        unbindVisibility();
      }
    };
  }, []);

  const cancel = useCallback(async (taskId: number) => {
    // A bulk AI op running in this tab stops its in-flight request now rather
    // than after that request finishes.
    abortClientOp(taskId);
    // A relay fetched before this click would undo the optimistic flag below.
    ignoreRelaysBefore = Date.now();
    // Optimistic: flag the row as cancel-requested immediately, then refresh.
    setState({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, cancel_requested: true } : task,
      ),
    });
    try {
      await cancelProcessTask(taskId);
    } catch {
      // The task may have finished between the click and the request; the
      // refresh below shows what actually happened.
    } finally {
      refreshProcessQueue();
    }
  }, []);

  const tasks = snapshot.tasks;
  const activeTasks = tasks.filter(isProcessTaskActive);
  const queuedTasks = tasks.filter((task) => task.status === "queued");
  const runningTasks = tasks.filter((task) => task.status === "running");
  const historyTasks = tasks.filter((task) => !isProcessTaskActive(task));
  const currentTask = runningTasks[0] ?? queuedTasks[0] ?? null;

  return {
    tasks,
    activeTasks,
    queuedTasks,
    runningTasks,
    historyTasks,
    currentTask,
    hasActive: activeTasks.length > 0,
    loading: snapshot.loading,
    error: snapshot.error,
    cancel,
    refresh: refreshProcessQueue,
  };
}

export default useProcessQueue;
