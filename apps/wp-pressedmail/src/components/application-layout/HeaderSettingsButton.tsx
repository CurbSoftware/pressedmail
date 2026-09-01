"use client";

import { __ } from "@wordpress/i18n";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";
import { SettingsLinkIcon } from "./HeaderIconSvgs";

type TooltipSide = "top" | "right" | "bottom" | "left";

function isSettingsRoute(pathname: string) {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

/**
 * HeaderSettingsButton - Settings button for user settings
 *
 * Displays a settings icon button in the header that navigates to the settings page.
 */
export function HeaderSettingsButton({
  tooltipSide = "bottom",
}: {
  tooltipSide?: TooltipSide;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const label = __("Settings", "pressedmail");
  const isActive = isSettingsRoute(location.pathname);

  const handleSettingsClick = () => {
    navigate("/settings");
  };

  return (
    <PressedTooltip content={label} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSettingsClick}
        aria-label={label}
        data-test="settings-button"
        className={cn(
          "h-8 w-8 rounded-md",
          isActive
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}>
        <SettingsLinkIcon className="h-5 w-5" aria-hidden="true" />
      </Button>
    </PressedTooltip>
  );
}

export default HeaderSettingsButton;
