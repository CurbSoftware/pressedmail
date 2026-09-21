import { Info } from "lucide-react";
import { __ } from "@wordpress/i18n";

import {
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@kit/ui/plugin";

import { docsHref } from "./docs-base";

interface SettingsInfoTooltipProps {
  tooltip: string;
  docHref?: string;
  className?: string;
}

export function SettingsInfoTooltip({
  tooltip,
  docHref,
  className,
}: SettingsInfoTooltipProps) {
  const resolvedHref = docHref ? docsHref(docHref) : null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={tooltip}
            className={cn(
              // A 14px glyph is a 14px target. The negative margin keeps it
              // sitting where it did next to its label while the box a pointer
              // has to hit grows to the floor. That floor is 44px on touch, not
              // the 24px this was originally written for, and the margin is
              // sized to cancel the difference exactly: 44 - 2*14 = 16, the same
              // footprint the old 24px box left behind (24 - 2*4). Nothing
              // moves, and there is no visible box to grow because hover only
              // changes the glyph colour.
              "-m-3.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
              className,
            )}>
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="max-w-xs text-xs font-normal leading-snug">
          <div className="space-y-1.5">
            <p>{tooltip}</p>
            {resolvedHref ? (
              <a
                href={resolvedHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline">
                {__("Learn more", "pressedmail")}
              </a>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
