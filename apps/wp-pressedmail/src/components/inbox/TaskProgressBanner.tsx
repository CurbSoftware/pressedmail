"use client";

import { useMemo } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Loader2, X } from "lucide-react";

import { Button } from "@kit/ui/plugin";
import { useProcessQueue } from "@/hooks/useProcessQueue";
import { openActivityPanel } from "@/components/activity/use-activity-panel";
import { useSweepLiveRefresh } from "@/hooks/useSweepLiveRefresh";
import { TaskProgressRow } from "@/components/ui/task-progress-row";
import type { ProcessTask } from "@/services/process-queue.service";

const isActiveStatus = (task: ProcessTask) =>
  task.status === "queued" || task.status === "running";

/** Backend sweep work. The gate syncs folders; the pages carry the counters. */
const isSweepKind = (task: ProcessTask) =>
  task.kind === "sync_gate" || task.kind === "bulk_page";

/** Browser-driven bulk runs: summarize, phishing check, auto-tag. */
const isClientOpKind = (task: ProcessTask) => task.kind === "client_op";

interface TaskGroup {
  key: string;
  gate: ProcessTask | null;
  /** Counter-bearing tasks: sweep pages, or the client op itself. */
  counted: ProcessTask[];
  tasks: ProcessTask[];
  isSweep: boolean;
}

/**
 * Inline progress for user-initiated bulk work, docked under the email-list
 * header: the active run's phase, a bar, its n/total, View → activity panel,
 * and Cancel. Live-refreshes the visible list as sweep pages complete
 * (useSweepLiveRefresh), so swept mail disappears while you watch. Renders
 * nothing when nothing is running.
 *
 * Covers sweeps AND bulk AI. This used to accept only sweep kinds, so a bulk
 * summarize or phishing check, which report progress through the same queue,
 * ran with no feedback anywhere except the activity panel. `sync_track` stays
 * out: that is background folder mirroring, not something the user started.
 */
export function TaskProgressBanner() {
  const { tasks, cancel } = useProcessQueue();

  const groups = useMemo<TaskGroup[]>(() => {
    const byGroup = new Map<string, ProcessTask[]>();
    for (const task of tasks) {
      if (!isSweepKind(task) && !isClientOpKind(task)) {
        continue;
      }
      // client_op tasks all share the literal group_id "client-op", so key
      // them by task id instead, two concurrent bulk runs are two rows.
      const key = isClientOpKind(task)
        ? `client-op-${task.id}`
        : (task.group_id ?? `task-${task.id}`);
      const bucket = byGroup.get(key);
      if (bucket) {
        bucket.push(task);
      } else {
        byGroup.set(key, [task]);
      }
    }

    const result: TaskGroup[] = [];
    for (const [key, groupTasks] of byGroup) {
      if (!groupTasks.some(isActiveStatus)) {
        continue;
      }
      const isSweep = groupTasks.some(isSweepKind);
      result.push({
        key,
        gate: groupTasks.find((task) => task.kind === "sync_gate") ?? null,
        counted: isSweep
          ? groupTasks.filter((task) => task.kind === "bulk_page")
          : groupTasks,
        tasks: groupTasks,
        isSweep,
      });
    }
    return result;
  }, [tasks]);

  // Only sweeps drive the list refresh; a summarize does not move mail.
  // The hook receives ALL sweep-kind tasks, including terminal ones from the
  // recent-history payload, because a small sweep can start AND finish
  // between two polls: it never appears active, and filtering to active
  // groups meant no final refresh ever fired for it.
  useSweepLiveRefresh(useMemo(() => tasks.filter(isSweepKind), [tasks]));

  const group = groups[0];
  if (!group) {
    return null;
  }

  const gateActive = group.gate !== null && isActiveStatus(group.gate);
  const label =
    group.gate?.label ||
    group.counted[0]?.label ||
    (group.isSweep ? __("Sweep", "pressedmail") : __("Working", "pressedmail"));
  const current = group.counted.reduce(
    (sum, task) => sum + (task.progress_current || 0),
    0,
  );
  const total = group.counted.reduce(
    (sum, task) => sum + (task.progress_total || 0),
    0,
  );
  // Always cancel through the gate when the group has one: the gate owns the
  // whole sweep, so one click skips every remaining page. Targeting the first
  // active task instead meant a 40-page sweep needed 40 clicks, racing the
  // executor, and most of the sweep still landed. The page mid-flight finishes
  // its bounded chunk. Groups without a gate fall back to the active task.
  const cancelTargetId =
    group.gate?.id ?? group.tasks.find(isActiveStatus)?.id ?? null;

  // The banner's own data-test is task-progress-banner and an element holds
  // one, so the legacy testid's twin goes on this plain block wrapper.
  return (
    <div data-test="sweep-progress-banner">
      <div
        data-testid="sweep-progress-banner"
        data-test="task-progress-banner"
        className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
        <span className="min-w-0 truncate font-medium text-foreground">
          {label}
        </span>
        <span className="min-w-0 truncate">
          {gateActive
            ? __("Preparing (syncing folders)…", "pressedmail")
            : group.isSweep
              ? sprintf(
                  /* translators: %1$d: emails swept so far, %2$d: total planned. */
                  __("Sweeping… %1$d / %2$d", "pressedmail"),
                  current,
                  total,
                )
              : sprintf(
                  /* translators: %1$d: items processed so far, %2$d: total. */
                  __("%1$d / %2$d", "pressedmail"),
                  current,
                  total,
                )}
        </span>
        {/* The bar is the demo's affordance: the count alone made a long run
            look stalled between increments. The text above stays the readout. */}
        {!gateActive && total > 0 && (
          <TaskProgressRow
            current={current}
            total={total}
            hideCount
            className="w-24 shrink-0"
          />
        )}
        {groups.length > 1 && (
          <span className="shrink-0">
            {sprintf(
              /* translators: %d: number of additional active runs. */
              __("+%d more", "pressedmail"),
              groups.length - 1,
            )}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            data-test="sweep-banner-view"
            data-testid="sweep-banner-view"
            onClick={() => openActivityPanel()}>
            {__("View", "pressedmail")}
          </Button>
          {cancelTargetId !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs"
              data-test="sweep-banner-cancel"
              data-testid="sweep-banner-cancel"
              aria-label={__("Cancel", "pressedmail")}
              onClick={() => void cancel(cancelTargetId)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

export default TaskProgressBanner;
