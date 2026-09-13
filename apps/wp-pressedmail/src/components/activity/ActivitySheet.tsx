"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { FolderSync, Loader2, X } from "lucide-react";

import {
  Badge,
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import {
  TaskProgressRow,
  taskProgress,
} from "@/components/ui/task-progress-row";
import { useProcessQueue, refreshProcessQueue } from "@/hooks/useProcessQueue";
import { clearProcessHistory } from "@/services/process-queue.service";
import { appMessage } from "@/context/toast";
import type {
  ProcessTask,
  ProcessTaskStatus,
} from "@/services/process-queue.service";

interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ActivityTab = "tasks" | "history";

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Seconds → "M:SS". */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Timing line for a task: live elapsed while running, or "started · how long it took"
 * once finished. Re-computed each render, so the 2.5s queue poll keeps running tasks
 * ticking. Returns null when there is nothing meaningful to show.
 */
function formatTaskTiming(task: ProcessTask): string | null {
  // A queued item hasn't run yet, showing its creation time is misleading.
  if (task.status === "queued") {
    return null;
  }

  const started = task.started_at ? new Date(task.started_at).getTime() : null;

  if (task.status === "running" && started) {
    return sprintf(
      __("Running %s", "pressedmail"),
      formatDuration((Date.now() - started) / 1000),
    );
  }

  const completed = task.completed_at
    ? new Date(task.completed_at).getTime()
    : null;
  if (started && completed) {
    return sprintf(
      /* translators: 1: start time, 2: duration m:ss. */
      __("Started %1$s · %2$s", "pressedmail"),
      formatTimestamp(task.started_at),
      formatDuration((completed - started) / 1000),
    );
  }

  const when = task.completed_at ?? task.created_at;
  return when ? formatTimestamp(when) : null;
}

function processStatusLabel(status: ProcessTaskStatus): string {
  switch (status) {
    case "running":
      return __("Running", "pressedmail");
    case "queued":
      return __("Queued", "pressedmail");
    case "done":
      return __("Done", "pressedmail");
    case "failed":
      return __("Failed", "pressedmail");
    case "cancelled":
      return __("Cancelled", "pressedmail");
    case "skipped":
      return __("Skipped", "pressedmail");
    default:
      return status;
  }
}

function isProcessTaskCancellable(status: ProcessTaskStatus): boolean {
  return status === "queued" || status === "running";
}

/** Group tasks by group_id so a sweep's gate + its page-tasks render together. */
function groupTasks(
  tasks: ProcessTask[],
): { key: string; tasks: ProcessTask[] }[] {
  const order: string[] = [];
  const byKey = new Map<string, ProcessTask[]>();
  for (const task of tasks) {
    const key = task.group_id ?? `task-${task.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(task);
  }
  return order.map((key) => ({
    key,
    tasks: [...(byKey.get(key) ?? [])].sort((a, b) => a.position - b.position),
  }));
}

interface ProcessTaskRowProps {
  task: ProcessTask;
  onCancel: (taskId: number) => void;
}

/** A compact task card: status dot inline with the heading, then progress/timing. */
function ProcessTaskRow({ task, onCancel }: ProcessTaskRowProps) {
  const { current, total } = taskProgress(task);
  // sync_track rows mirror the background folder-sync; they aren't user-cancellable.
  const cancellable =
    isProcessTaskCancellable(task.status) && task.kind !== "sync_track";
  const showProgress = task.status === "running" && total > 0;
  // A queued folder-sync still carries its partial mirror count, show it so the user
  // sees how far a queued folder already is (the sync backfills several in parallel).
  const showQueuedSyncCount =
    task.kind === "sync_track" && task.status === "queued" && total > 0;
  const timing = formatTaskTiming(task);

  return (
    <article
      role="listitem"
      data-test={`process-task-${task.id}`}
      data-testid={`process-task-${task.id}`}
      className="rounded-md border border-border bg-background px-2.5 py-1.5 hover:bg-muted/30">
      <div className="flex items-center gap-2">
        {task.status === "running" ? (
          <Loader2
            aria-hidden="true"
            className="h-2 w-2 shrink-0 animate-spin text-primary"
          />
        ) : task.kind === "sync_track" ? (
          <FolderSync
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground",
              task.status === "done" && "text-success",
              task.status === "failed" && "text-destructive",
            )}
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 shrink-0 rounded-full bg-muted-foreground",
              task.status === "failed" && "bg-destructive",
              task.status === "done" && "bg-success",
            )}
          />
        )}
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {task.label || __("Background task", "pressedmail")}
        </p>
        <Badge
          variant={task.status === "failed" ? "destructive" : "secondary"}
          className="shrink-0">
          {processStatusLabel(task.status)}
        </Badge>
        {showQueuedSyncCount && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {sprintf(
              /* translators: 1: mirrored messages, 2: total messages. */
              __("%1$d/%2$d", "pressedmail"),
              current,
              total,
            )}
          </span>
        )}
        {cancellable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-test={`process-task-cancel-${task.id}`}
            data-testid={`process-task-cancel-${task.id}`}
            aria-label={__("Cancel task", "pressedmail")}
            disabled={task.cancel_requested}
            onClick={() => onCancel(task.id)}
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" aria-hidden="true" />
          </Button>
        )}
      </div>

      {showProgress && (
        <TaskProgressRow current={current} total={total} className="mt-1" />
      )}

      {timing && (
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {timing}
        </p>
      )}

      {task.error_message && (
        <p className="mt-0.5 text-[11px] text-destructive">
          {task.error_message}
        </p>
      )}
    </article>
  );
}

interface TabButtonProps {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, count, onClick, children }: TabButtonProps) {
  return (
    <Button
      type="button"
      role="tab"
      aria-selected={active}
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className="h-7 gap-1.5 rounded-md px-2.5 text-xs">
      {children}
      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}

export function ActivitySheet({ open, onOpenChange }: ActivitySheetProps) {
  const { activeTasks, historyTasks, cancel, error } = useProcessQueue();
  const [tab, setTab] = useState<ActivityTab>("tasks");

  // Portal the sheet into the PressedMail app frame so it stays inside the plugin
  // UI and never overlaps the WordPress admin bar or other host chrome.
  const [appFrame, setAppFrame] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined"
      ? document.querySelector<HTMLElement>("[data-pm-app-frame]")
      : null,
  );

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    setAppFrame(document.querySelector<HTMLElement>("[data-pm-app-frame]"));
  }, [open]);

  // Keep the panel live while open: re-fetch immediately on open and then on a
  // steady interval, regardless of whether the queue is "active", so running tasks
  // and newly-finished ones surface without a reload. The shared store's own interval
  // stops when the queue goes idle, so the panel drives its own poll while visible.
  // (refreshProcessQueue already no-ops on a hidden tab.)
  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    refreshProcessQueue();
    const id = window.setInterval(() => refreshProcessQueue(), 1500);
    return () => window.clearInterval(id);
  }, [open]);

  const handleCancel = useCallback(
    (taskId: number) => {
      // cancel() rethrows. Throwing the promise away made a failed cancel an
      // unhandled rejection, and the row simply carried on running. Wrapped in
      // Promise.resolve so reporting the failure can never itself throw.
      void Promise.resolve(cancel(taskId)).catch((caught: unknown) => {
        appMessage(
          caught instanceof Error
            ? caught.message
            : __("We could not cancel that task.", "pressedmail"),
          "error",
        );
      });
    },
    [cancel],
  );

  const [clearingHistory, setClearingHistory] = useState(false);
  const handleClearHistory = useCallback(async () => {
    setClearingHistory(true);
    try {
      await clearProcessHistory();
      refreshProcessQueue();
    } catch (caught) {
      appMessage(
        caught instanceof Error
          ? caught.message
          : __("We could not clear the history.", "pressedmail"),
        "error",
      );
    } finally {
      setClearingHistory(false);
    }
  }, []);

  const activeGroups = useMemo(() => groupTasks(activeTasks), [activeTasks]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        data-test="activity-sheet"
        container={appFrame ?? undefined}
        contained={appFrame ? true : undefined}
        className={cn(
          "flex h-full flex-col gap-0 p-0",
          // Edge-docked panel: flush, no rounded corners on any size.
          "rounded-none",
          // Width scales up with the viewport. The data-[side=right] variants
          // replace the Sheet primitive's defaults (w-3/4 / sm:max-w-sm): near
          // full-width on phones, then progressively wider on tablet → laptop →
          // desktop so there is room for the task list on large screens.
          "data-[side=right]:w-[min(100vw,42rem)]",
          "data-[side=right]:sm:max-w-[26rem]",
          "data-[side=right]:lg:max-w-[34rem]",
          "data-[side=right]:xl:max-w-[42rem]",
        )}>
        <SheetHeader className="border-b border-border px-3 py-2.5 text-left">
          <SheetTitle className="sr-only">
            {__("Activity", "pressedmail")}
          </SheetTitle>
          <div
            role="tablist"
            aria-label={__("Activity", "pressedmail")}
            className="flex gap-1 pr-9">
            <TabButton
              active={tab === "tasks"}
              count={activeTasks.length}
              onClick={() => setTab("tasks")}>
              {__("Tasks", "pressedmail")}
            </TabButton>
            <TabButton
              active={tab === "history"}
              onClick={() => setTab("history")}>
              {__("History", "pressedmail")}
            </TabButton>
          </div>
        </SheetHeader>

        {tab === "tasks" ? (
          <ScrollArea className="min-h-0 flex-1">
            <div
              className="space-y-1.5 px-3 py-2"
              role="list"
              aria-label={__("Background tasks", "pressedmail")}
              data-test="process-queue-section"
              data-testid="process-queue-section">
              {error && activeTasks.length === 0 ? (
                // An unreachable queue is not an idle queue. Saying "nothing
                // running" when the load failed told people all was well while
                // their sweep was in an unknown state.
                <div
                  role="alert"
                  data-test="process-queue-error"
                  data-testid="process-queue-error"
                  className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-foreground">
                  <p>{error}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    data-test="process-queue-retry"
                    data-testid="process-queue-retry"
                    onClick={() => refreshProcessQueue()}>
                    {__("Try again", "pressedmail")}
                  </Button>
                </div>
              ) : activeTasks.length === 0 ? (
                <p
                  data-test="process-queue-empty"
                  data-testid="process-queue-empty"
                  className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  {__("No background tasks running.", "pressedmail")}
                </p>
              ) : (
                activeGroups.map((group) => (
                  <div key={group.key} className="space-y-1">
                    {group.tasks.map((task) => (
                      <ProcessTaskRow
                        key={task.id}
                        task={task}
                        onCancel={handleCancel}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex justify-end px-3 pt-2">
              <Button
                variant="ghost"
                size="sm"
                data-test="activity-clear-history"
                data-testid="activity-clear-history"
                disabled={historyTasks.length === 0 || clearingHistory}
                onClick={() => void handleClearHistory()}>
                {__("Clear History", "pressedmail")}
              </Button>
            </div>
            <div
              className="space-y-1.5 px-3 py-2"
              role="list"
              aria-label={__("Task history", "pressedmail")}
              data-test="process-history-section"
              data-testid="process-history-section">
              {historyTasks.length === 0 ? (
                <p
                  data-test="process-history-empty"
                  data-testid="process-history-empty"
                  className="rounded-md border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
                  {__("No finished tasks yet.", "pressedmail")}
                </p>
              ) : (
                historyTasks.map((task) => (
                  <ProcessTaskRow
                    key={task.id}
                    task={task}
                    onCancel={handleCancel}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
