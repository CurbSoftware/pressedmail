import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@kit/ui/plugin";
import { SettingsInfoTooltip } from "./settings-info-tooltip";

interface SettingsSectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tooltip?: string;
  docHref?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  ariaBusy?: boolean;
  /**
   * Container id for the section. Most settings sections are addressable only
   * by their translated heading without it, which breaks as soon as the copy
   * changes or the locale does.
   */
  dataTest?: string;
}

export function SettingsSectionCard({
  title,
  description,
  actions,
  tooltip,
  docHref,
  children,
  className,
  contentClassName,
  ariaBusy,
  dataTest,
}: SettingsSectionCardProps) {
  return (
    <Card
      className={cn("gap-4 rounded-lg bg-card py-4 shadow-sm", className)}
      data-test={dataTest}
      data-testid={dataTest}
      aria-busy={ariaBusy}
      size="sm">
      <CardHeader className="grid-cols-[1fr_auto] gap-2 px-4">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-6">
            <span className="min-w-0">{title}</span>
            {tooltip ? (
              <SettingsInfoTooltip tooltip={tooltip} docHref={docHref} />
            ) : null}
          </CardTitle>
          {description ? (
            <CardDescription className="text-xs leading-5">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {actions ? <div className="justify-self-end">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn("px-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
