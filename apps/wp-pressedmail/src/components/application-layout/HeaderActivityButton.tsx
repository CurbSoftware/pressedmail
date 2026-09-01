"use client";

import { __ } from "@wordpress/i18n";

import { Button } from "@kit/ui/plugin";
import {
  toggleActivityPanel,
  useActivityPanelOpen,
} from "@/components/activity/use-activity-panel";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { isProcessManagerBuildEnabled } from "@/lib/build-variant";
import { ActivityHeaderIcon } from "./HeaderIconSvgs";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * Visual size of the trigger.
 * - "control": compact (h-8), matches the display-mode control group.
 * - "nav": nav-sized (h-11, size-7 icon), matches the Inbox/Contacts/Calendar/
 *   Settings navigation cluster so Activity sits as its trailing item.
 */
type HeaderActivityButtonAppearance = "control" | "nav";

export function HeaderActivityButton({
  tooltipSide = "bottom",
  appearance = "control",
}: {
  tooltipSide?: TooltipSide;
  appearance?: HeaderActivityButtonAppearance;
}) {
  // Shared open-state so the header button + the footer status-bar toggle drive the
  // same mounted ActivitySheet.
  const open = useActivityPanelOpen();
  const label = __("Toggle activity log", "pressedmail");

  // The button opens the unified activity panel, which always shows the process
  // / activity Tasks section (free + pro). The always-on process manager keeps
  // the button visible in every build. See isProcessManagerBuildEnabled.
  if (!isProcessManagerBuildEnabled()) {
    return null;
  }

  const isNav = appearance === "nav";

  // Pure trigger: the ActivitySheet is mounted once at the app root and shares the
  // open-state store, so the header icon and the footer status-bar toggle both drive
  // the same sheet.
  return (
    <PressedTooltip content={__("Activity Log", "pressedmail")} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={() => toggleActivityPanel()}
        aria-label={label}
        aria-pressed={open}
        data-test="activity-button"
        className={
          isNav
            ? "relative h-11 w-11 rounded-md text-muted-foreground hover:text-foreground"
            : "h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
        }>
        <ActivityHeaderIcon
          className={isNav ? "size-7" : "h-5 w-5"}
          aria-hidden="true"
        />
      </Button>
    </PressedTooltip>
  );
}

export default HeaderActivityButton;
