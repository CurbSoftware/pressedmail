"use client";

import * as React from "react";
import { cn } from "@kit/ui/plugin";

import { SettingsInfoTooltip } from "@/components/settings-ui";

interface PageTopBarProps {
  /** Optional title to render when no custom leading content is provided */
  title?: string;
  /** Optional description that appears inline with the title */
  description?: string;
  /** Optional icon displayed before the title */
  icon?: React.ReactNode;
  /** Optional info marker beside the title */
  tooltip?: string;
  /** Docs slug for the info marker Learn more link */
  docHref?: string;
  /** Custom leading content; overrides title/description rendering */
  leading?: React.ReactNode;
  /** Right-aligned actions */
  actions?: React.ReactNode;
  /** Additional container class names */
  className?: string;
  /** Additional class names for the inner content row */
  contentClassName?: string;
  /**
   * Title over description, always, with the icon on the title's line.
   * Inline, the pair folded onto one line whenever the actions beside it
   * were fewer (a viewer's read-only tab), so the page jumped by a line.
   */
  stacked?: boolean;
}

export function PageTopBar({
  title,
  description,
  icon,
  tooltip,
  docHref,
  leading,
  actions,
  className,
  contentClassName,
  stacked = false,
}: PageTopBarProps) {
  const defaultLeading = title && stacked ? (
    <div className="flex min-w-0 items-start gap-2">
      {icon ? (
        <div className="flex h-6 shrink-0 items-center text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 leading-tight">
        <div className="flex min-h-6 items-center gap-2">
          <span className="text-base font-semibold text-foreground">{title}</span>
          {tooltip ? (
            <SettingsInfoTooltip tooltip={tooltip} docHref={docHref} />
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  ) : title ? (
    <div className="flex items-center gap-2">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="flex flex-wrap items-baseline gap-2 leading-tight">
        <span className="text-base font-semibold text-foreground">{title}</span>
        {tooltip ? (
          <SettingsInfoTooltip tooltip={tooltip} docHref={docHref} />
        ) : null}
        {description ? (
          <span className="text-sm text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("flex-shrink-0 border-b bg-card px-4 py-3", className)}>
      <div
        className={cn(
          "flex min-h-[56px] items-center justify-between gap-3",
          contentClassName,
        )}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leading ?? defaultLeading}
        </div>
        {actions ? (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export default PageTopBar;
