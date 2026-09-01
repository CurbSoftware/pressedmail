"use client";

import { MoveDiagonal } from "lucide-react";
import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * HeaderLogoButton - Logo icon button that toggles immersive mode
 *
 * When clicked, hides the WordPress admin sidebar and top menu with smooth transitions,
 * making the PressedMail UI fill the entire viewport.
 * Click again to restore the WordPress admin UI.
 *
 * CSS transitions are defined in index.css for smooth animations.
 */
export function HeaderLogoButton({
  tooltipSide = "right",
}: {
  tooltipSide?: TooltipSide;
}) {
  const { isImmersive, toggle } = useImmersiveMode(false);
  const label = isImmersive ? "Show WordPress admin" : "Immersive mode";

  return (
    <PressedTooltip content={label} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={label}
        data-test="logo-button"
        className={cn(
          "h-8 w-8 rounded-md",
          isImmersive
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground",
        )}>
        <MoveDiagonal className="h-5 w-5" />
      </Button>
    </PressedTooltip>
  );
}

export default HeaderLogoButton;
