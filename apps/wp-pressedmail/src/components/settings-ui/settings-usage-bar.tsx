import type { ReactNode } from "react";

import { cn } from "@kit/ui/plugin";

interface SettingsUsageBarProps {
  label: ReactNode;
  value: number;
  max: number;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SettingsUsageBar({
  label,
  value,
  max,
  description,
  badge,
  actions,
  className,
}: SettingsUsageBarProps) {
  const percentage =
    max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={cn("space-y-2 rounded-md border bg-muted/20 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            <span>{label}</span>
            {badge}
          </div>
          {description ? (
            <div className="text-xs leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
