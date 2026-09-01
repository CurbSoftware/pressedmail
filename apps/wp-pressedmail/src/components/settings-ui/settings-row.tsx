import type { ReactNode } from "react";

import { cn } from "@kit/ui/plugin";

interface SettingsRowProps {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  control?: ReactNode;
  meta?: ReactNode;
  className?: string;
  controlClassName?: string;
}

export function SettingsRow({
  title,
  titleId,
  description,
  control,
  meta,
  className,
  controlClassName,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center",
        className,
      )}
      data-test="settings-row"
      data-testid="settings-row">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <div
            id={titleId}
            className="text-sm font-medium leading-5 text-foreground">
            {title}
          </div>
          {meta}
        </div>
        {description ? (
          <div className="max-w-3xl text-xs leading-5 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {control ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 sm:justify-end",
            controlClassName,
          )}
          data-test="settings-row-control"
          data-testid="settings-row-control">
          {control}
        </div>
      ) : null}
    </div>
  );
}
