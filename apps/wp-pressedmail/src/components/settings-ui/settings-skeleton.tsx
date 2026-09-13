import { cn } from "@kit/ui/plugin";

interface SettingsSkeletonProps {
  /**
   * What is loading, as a sentence. It is the accessible name of the status
   * region, so it is read out instead of leaving a screen reader with a silent
   * pulsing box.
   */
  label: string;
  /** How many placeholder rows to draw. Match the card this stands in for. */
  rows?: number;
  className?: string;
  dataTest?: string;
}

/**
 * The one waiting state for every settings surface.
 *
 * Settings used to wait in four different ways: a bare spinner, a spinner with
 * "Loading settings...", a dashed box with its own sentence, and an inline row
 * of muted text. Five AI cards each ran their own, so the tab was five grey
 * boxes saying the same thing. This draws the shape of the card that is coming,
 * so the page does not jump when it arrives, and says once what is loading.
 *
 * The pulse is dropped under prefers-reduced-motion; the text stays.
 */
export function SettingsSkeleton({
  label,
  rows = 3,
  className,
  dataTest = "settings-skeleton",
}: SettingsSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      aria-live="polite"
      className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
      data-test={dataTest}
      data-testid={dataTest}>
      <span className="mb-3 block text-sm text-muted-foreground">{label}</span>
      <div
        aria-hidden="true"
        className="animate-pulse space-y-3 motion-reduce:animate-none">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-64 max-w-full rounded bg-muted/70" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-1/3 min-w-24 rounded bg-muted" />
                <div className="h-2.5 w-2/3 rounded bg-muted/60" />
              </div>
              <div className="h-5 w-9 shrink-0 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
