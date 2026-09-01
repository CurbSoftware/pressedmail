import type { ReactNode } from "react";

import { cn } from "@kit/ui/plugin";

/**
 * A titled, tinted panel: the shape that had been rewritten at every call
 * site as `rounded-lg border p-4`, `bg-card/40` or `bg-muted/30`.
 *
 * Two problems it fixes. `bg-card/40` inside an already-`bg-card` pane renders
 * a card you cannot see, and `bg-muted/30` was used for both the AI summary and
 * the unrelated message-header details, so the two read as the same thing.
 * `tone` carries the intent; `muted` is the neutral default.
 */
export type SectionCardTone =
  | "muted"
  | "primary"
  | "success"
  | "warning"
  | "danger";

const TONE_CLASS: Record<SectionCardTone, string> = {
  muted: "border-border bg-muted/40",
  primary: "border-primary/30 bg-primary/5",
  success: "border-success/30 bg-success/10",
  warning: "border-warning/30 bg-warning/10",
  danger: "border-destructive/30 bg-destructive/10",
};

export interface SectionCardProps {
  children: ReactNode;
  tone?: SectionCardTone;
  /** Rendered as the heading row; pair with `actions` for a right-hand control. */
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  /** `sm` suits inline panels in the reading pane; `md` suits dialog sections. */
  size?: "sm" | "md";
  className?: string;
  contentClassName?: string;
  "data-test"?: string;
  "data-testid"?: string;
}

export function SectionCard({
  children,
  tone = "muted",
  title,
  icon,
  actions,
  size = "md",
  className,
  contentClassName,
  ...rest
}: SectionCardProps) {
  const pad = size === "sm" ? "p-2.5" : "p-4";

  return (
    <section
      className={cn("rounded-lg border", TONE_CLASS[tone], pad, className)}
      {...rest}>
      {title || actions ? (
        <div className="mb-2 flex items-center gap-2">
          {icon ? (
            <span className="flex shrink-0 items-center">{icon}</span>
          ) : null}
          {title ? (
            <h3
              className={cn(
                "min-w-0 flex-1 truncate font-semibold text-foreground",
                size === "sm" ? "text-xs" : "text-sm",
              )}>
              {title}
            </h3>
          ) : (
            <span className="flex-1" />
          )}
          {actions ? (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </section>
  );
}
