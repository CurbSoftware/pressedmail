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
  /**
   * Keep the control on the title's row at every width.
   *
   * The default stacks the control under the description below 640px, which is
   * right for a wide control (an input, a select) but wrong for a switch: it
   * spends three lines on one toggle and puts the switch nowhere near the thing
   * it controls. iOS, Android and WordPress ToggleControl all keep a switch on
   * the label's row, so switch rows pass `inline`.
   */
  inline?: boolean;
}

export function SettingsRow({
  title,
  titleId,
  description,
  control,
  meta,
  className,
  controlClassName,
  inline = false,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center",
        inline && "grid-cols-[1fr_auto] items-center",
        className,
      )}
      data-pm-inline={inline ? "true" : undefined}
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
            inline && "justify-end",
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
