import { __, sprintf } from "@wordpress/i18n";

import { cn } from "@kit/ui/plugin";

import type { ProcessTask } from "@/services/process-queue.service";

/**
 * The single progress bar shape for background work.
 *
 * Extracted from the activity panel, which was the only place in the app that
 * drew one. Sweeps and bulk actions run through the same process queue, so the
 * banner over the message list and the activity panel can now render the same
 * control instead of the banner reporting progress as bare text.
 */
export interface TaskProgressRowProps {
  current: number;
  total: number;
  /** Hide the "n / total" readout when the caller prints its own. */
  hideCount?: boolean;
  className?: string;
  barClassName?: string;
}

export function TaskProgressRow({
  current,
  total,
  hideCount = false,
  className,
  barClassName,
}: TaskProgressRowProps) {
  const safeTotal = Math.max(0, Math.floor(total));
  const safeCurrent = Math.max(
    0,
    Math.min(Math.floor(current), safeTotal || Number.MAX_SAFE_INTEGER),
  );
  const percent =
    safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
        className={cn(
          "h-1 flex-1 overflow-hidden rounded-full bg-muted",
          barClassName,
        )}>
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {hideCount ? null : (
        <span
          data-test="task-progress-count"
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {sprintf(
            /* translators: 1: completed steps, 2: total steps. */
            __("%1$d/%2$d", "pressedmail"),
            safeCurrent,
            safeTotal,
          )}
        </span>
      )}
    </div>
  );
}

/** Normalised counters for a queue task: total clamps current, never the reverse. */
export function taskProgress(task: Pick<
  ProcessTask,
  "progress_current" | "progress_total"
>): { current: number; total: number } {
  const total = Math.max(0, Math.floor(task.progress_total ?? 0));
  const current = Math.max(
    0,
    Math.min(
      Math.floor(task.progress_current ?? 0),
      total || Number.MAX_SAFE_INTEGER,
    ),
  );
  return { current, total };
}
