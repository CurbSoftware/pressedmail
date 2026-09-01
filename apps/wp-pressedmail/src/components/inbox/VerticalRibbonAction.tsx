"use client";

import * as React from "react";

import { Button } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { PRESSED_OUT_RIBBON_LABEL_CLASS } from "@/components/inbox/ribbon/RibbonButton";

export interface VerticalRibbonActionProps extends React.ComponentPropsWithoutRef<"button"> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  ariaLabel?: string;
  tooltip?: React.ReactNode;
  dataTest?: string;
}

/**
 * Outlook-style vertical ribbon command: a large icon stacked over a text
 * label. Used by the `orientation="vertical"` reading-pane action bar
 * (PressedOut) and as the trigger for the Move/Tag/More menus there.
 *
 * Forwards its ref and spreads extra props onto the underlying button so it can
 * be used as a Radix `asChild` trigger (DropdownMenu / Popover).
 */
export const VerticalRibbonAction = React.forwardRef<
  HTMLButtonElement,
  VerticalRibbonActionProps
>(function VerticalRibbonAction(
  { icon, label, active, ariaLabel, tooltip, dataTest, className, ...rest },
  ref,
) {
  const button = (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="sm"
      aria-label={ariaLabel ?? label}
      data-test={dataTest}
      data-testid={dataTest}
      className={cn(
        "inline-flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-2 text-center leading-none",
        // Hover recolors only the icon (svg) to the theme primary, the label
        // keeps its muted token. Delete opts out via an override className.
        "hover:[&_svg]:text-primary",
        active && "bg-muted text-foreground",
        className,
        "h-16 w-16 flex-col items-center justify-center text-center",
      )}
      {...rest}>
      <span className="flex h-5 w-5 items-center justify-center [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
      </span>
      <span
        className={cn(
          "max-w-[6.5rem] truncate font-medium text-muted-foreground",
          PRESSED_OUT_RIBBON_LABEL_CLASS,
        )}>
        {label}
      </span>
    </Button>
  );

  if (!tooltip) {
    return button;
  }

  return (
    <PressedTooltip content={tooltip} side="bottom">
      {button}
    </PressedTooltip>
  );
});

export default VerticalRibbonAction;
