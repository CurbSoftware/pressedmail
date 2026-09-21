"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelProcessTask,
  listProcessTasks,
  type ProcessTask,
  type ProcessTaskStatus,
} from "@/services/process-queue.service";
import { abortClientOp } from "@/lib/bulk-activity";

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
 */

const ACTIVE_POLL_INTERVAL_MS = 2500;

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

async function poll(): Promise<void> {
  if (inFlight || typeof window === "undefined") {
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

  try {
    const tasks = await listProcessTasks();
    setState({ tasks, loading: false, error: null });
  } catch (err) {
    setState({
      loading: false,
      error: err instanceof Error ? err.message : "Activity queue load failed.",
    });
  } finally {
    inFlight = false;
    // Stop the recurring interval once nothing is active; a future enqueue or
    // visibility change restarts it.
    if (!hasActiveTasks()) {
      stopInterval();
    }
  }
}

function startInterval() {
  if (intervalId !== null || typeof window === "undefined") {
    return;
  }
  intervalId = window.setInterval(() => {
    void poll();
  }, ACTIVE_POLL_INTERVAL_MS);
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
    // Immediate catch-up, then resume the interval if work is still pending.
    void poll().then(() => {
      if (hasActiveTasks()) {
        startInterval();
      }
    });
  }
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") {
    return;
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);
  visibilityBound = true;
}

function unbindVisibility() {
  if (!visibilityBound || typeof document === "undefined") {
    return;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  visibilityBound = false;
}

/**
 * Trigger an immediate refresh and (re)start polling if work is pending. Safe to
 * call without subscribing to the hook, e.g. right after enqueuing a sweep so
 * the new task surfaces without waiting for the next interval tick.
 */
export function refreshProcessQueue(): void {
  if (typeof window === "undefined") {
    return;
  }
  bindVisibility();
  void poll().then(() => {
    if (hasActiveTasks()) {
      startInterval();
    }
  });
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
    void poll().then(() => {
      if (hasActiveTasks()) {
        startInterval();
      }
    });

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
