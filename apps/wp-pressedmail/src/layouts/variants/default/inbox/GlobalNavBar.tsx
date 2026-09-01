"use client";

/**
 * Global Navigation Bar (Column 1)
 *
 * Narrow fixed-width vertical navigation bar on the far left.
 * Provides compose button and navigation via shared NavigationItems.
 *
 * SpeedDialMenu, AccountSelector, DisplayModeControls, and theme toggle
 * have all moved to SharedHeader.
 *
 * @since 3.0.0
 * @updated 3.2.0 - Removed SpeedDialMenu from the header
 */

import { __ } from "@wordpress/i18n";
import { EmailComposeNewIcon } from "@/components/icons/MailActionIcons";
import { cn } from "@/lib/utils";
import { Button } from "@kit/ui/plugin";
import { NavigationItems } from "@/layouts/shared/components/NavigationItems";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { usePaneCompose } from "@/context/composer";

export interface GlobalNavBarProps {
  className?: string;
}

export function GlobalNavBar({ className }: GlobalNavBarProps) {
  const paneCompose = usePaneCompose();

  return (
    <div
      className={cn(
        "flex flex-col items-center w-16 border-r bg-card shrink-0 h-full",
        className,
      )}>
      {/* Compose Button */}
      <div className="py-3 flex flex-col items-center gap-2">
        <PressedTooltip content={__("Compose", "pressedmail")} side="right">
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full font-extrabold shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => paneCompose?.requestPaneCompose()}
            aria-label={__("Compose new message", "pressedmail")}>
            <EmailComposeNewIcon className="h-4 w-4" />
          </Button>
        </PressedTooltip>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-3">
        <NavigationItems
          orientation="vertical"
          variant="icons-with-labels"
          tooltipSide="right"
        />
      </div>
    </div>
  );
}

export default GlobalNavBar;
