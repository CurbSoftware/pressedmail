import {
  reportClientTask,
  type ProcessTaskStatus,
} from "@/services/process-queue.service";
import { refreshProcessQueue } from "@/hooks/useProcessQueue";

/**
 * Surface a client-driven bulk op (summarize / phishing / auto-tag) in the Activity panel.
 *
 * These run in the browser in batches, so they're reported as a `client_op` task: created
 * on start, advanced per batch, finished done/failed/cancelled. The body gets a handle to
 * advance progress and to check whether the user cancelled the task from the panel.
 * Reporting is best-effort. A failure to report never breaks the underlying op.
 *
 * A cancel has to stop the request that is already in flight, not just the next one: a
 * single AI request can run for a minute. So the caller's AbortController is registered
 * against the task id. A cancel in this tab aborts it directly (`abortClientOp`), and a
 * cancel from anywhere else aborts it on the next report that comes back flagged.
 */

export interface BulkActivityHandle {
  /** Update progress (and optionally relabel). */
  advance: (current: number, label?: string) => Promise<void>;
  /** Whether the user cancelled the task from the Activity panel. */
  cancelled: () => boolean;
}

export interface BulkActivityOptions {
  label: string;
  total: number;
  /** summarize | phishing | autotag: used as the task action. */
  action: string;
  /**
   * Queue behind in-flight backend work: the client_op is created as `queued`
   * and the server promotes it to `running` only when the user has no earlier
   * active backend group (e.g. a sweep). Callers await `waitUntilRunning()`
   * before starting their loop.
   */
  waitForQueue?: boolean;
  /** Aborted when the task is cancelled from the Activity panel or banner. */
  controller?: AbortController;
}

const QUEUE_WAIT_POLL_MS = 2000;

const activeControllers = new Map<number, AbortController>();

/**
 * Abort the in-flight request of a client op this tab is running. Returns false
 * when the task is not running here (another tab, or already finished).
 */
export function abortClientOp(taskId: number): boolean {
  const controller = activeControllers.get(taskId);
  if (!controller) {
    return false;
  }
  controller.abort();
  return true;
}

export interface BulkActivityReporter extends BulkActivityHandle {
  /** Finish the task (done / failed / cancelled). Always call once (e.g. in finally). */
  finish: (status: ProcessTaskStatus, error?: string) => Promise<void>;
  /**
   * Resolve "running" once the server promotes the queued op (immediately if
   * reporting failed or the op was created running), or "cancelled" when the
   * user cancels from the panel / the signal aborts.
   */
  waitUntilRunning: (signal?: AbortSignal) => Promise<"running" | "cancelled">;
  /**
   * Whether the server actually queued the op behind earlier backend work,
   * i.e. the selection may be stale after the wait and should be re-validated.
   */
  wasQueued: () => boolean;
  /** Revise the total (e.g. after re-validating the selection post-wait). */
  setTotal: (total: number) => Promise<void>;
}

/**
 * Imperative variant for handlers that already have their own loop + try/finally (the bulk
 * AI handlers). Create it before the loop, `advance()` per item, and `finish()` in finally.
 */
export async function beginBulkActivity(
  opts: BulkActivityOptions,
): Promise<BulkActivityReporter> {
  let taskId = 0;
  let cancelled = false;
  let finished = false;
  let lastProgress = 0;
  let taskStatus: ProcessTaskStatus | undefined;
  try {
    const created = await reportClientTask({
      action: opts.action,
      label: opts.label,
      status: opts.waitForQueue ? "queued" : "running",
      progress_current: 0,
      progress_total: opts.total,
    });
    taskId = created.task_id;
    cancelled = created.cancel_requested;
    taskStatus = created.status;
  } catch {
    // best-effort
  }
  refreshProcessQueue();

  const createdQueued = taskId > 0 && taskStatus === "queued";
  if (taskId > 0 && opts.controller) {
    activeControllers.set(taskId, opts.controller);
  }

  // The server answers every report on a cancelled (or otherwise finished) row
  // with cancel_requested, so one check covers panel cancels from any tab.
  const noteReport = (result: { cancel_requested: boolean }) => {
    if (!result.cancel_requested || finished) {
      return;
    }
    cancelled = true;
    opts.controller?.abort();
  };

  return {
    cancelled: () => cancelled,
    wasQueued: () => createdQueued,
    advance: async (current, label) => {
      if (taskId <= 0) {
        return;
      }
      lastProgress = current;
      try {
        noteReport(
          await reportClientTask({
            task_id: taskId,
            progress_current: current,
            ...(label ? { label } : {}),
          }),
        );
      } catch {
        // ignore
      }
    },
    setTotal: async (total) => {
      if (taskId <= 0) {
        return;
      }
      await reportClientTask({
        task_id: taskId,
        progress_total: total,
      })
        .then(noteReport)
        .catch(() => {});
    },
    waitUntilRunning: async (signal) => {
      // Reporting failed (best-effort) or the op was never queued, don't block.
      if (taskId <= 0 || taskStatus === "running" || !opts.waitForQueue) {
        return "running";
      }
      if (cancelled) {
        return "cancelled";
      }

      for (;;) {
        if (signal?.aborted) {
          cancelled = true;
          return "cancelled";
        }
        try {
          // Reporting with just the task_id re-runs the server's promotion check.
          const result = await reportClientTask({ task_id: taskId });
          noteReport(result);
          taskStatus = result.status ?? taskStatus;
        } catch {
          // Transient report failure, keep waiting.
        }
        if (cancelled || taskStatus === "cancelled" || taskStatus === "skipped") {
          cancelled = true;
          return "cancelled";
        }
        if (taskStatus === "running") {
          return "running";
        }
        await new Promise((resolve) =>
          setTimeout(resolve, QUEUE_WAIT_POLL_MS),
        );
      }
    },
    finish: async (status, error) => {
      finished = true;
      activeControllers.delete(taskId);
      if (taskId > 0) {
        await reportClientTask({
          task_id: taskId,
          status,
          // Only a completed run is complete. A cancelled or failed one keeps
          // the count it reached, or the panel reads it as finished.
          progress_current: status === "done" ? opts.total : lastProgress,
          ...(error ? { error } : {}),
        }).catch(() => {});
      }
      refreshProcessQueue();
    },
  };
}


