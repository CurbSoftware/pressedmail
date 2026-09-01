import type { ReactNode } from "react";

import { cn } from "@kit/ui/plugin";
import { SettingsInfoTooltip } from "./settings-info-tooltip";

interface SettingsPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tooltip?: string;
  docHref?: string;
  className?: string;
}

export function SettingsPageHeader({
  title,
  description,
  actions,
  tooltip,
  docHref,
  className,
}: SettingsPageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      data-test="settings-page-header"
      data-testid="settings-page-header">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-lg font-semibold leading-7 text-foreground">
            {title}
          </h2>
          {tooltip ? (
            <SettingsInfoTooltip tooltip={tooltip} docHref={docHref} />
          ) : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
