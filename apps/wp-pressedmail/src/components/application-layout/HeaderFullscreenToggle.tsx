"use client";

import { useState, useEffect, useCallback } from "react";
import { Maximize, Minimize } from "lucide-react";
import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * HeaderFullscreenToggle - Toggle browser fullscreen mode
 *
 * Uses the Fullscreen API to toggle the browser into fullscreen mode.
 * Shows different icons based on current fullscreen state.
 */
export function HeaderFullscreenToggle({
  tooltipSide = "right",
}: {
  tooltipSide?: TooltipSide;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    // Set initial state
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (
          (
            element as unknown as {
              webkitRequestFullscreen?: () => Promise<void>;
            }
          ).webkitRequestFullscreen
        ) {
          await (
            element as unknown as {
              webkitRequestFullscreen: () => Promise<void>;
            }
          ).webkitRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (
            document as unknown as {
              webkitExitFullscreen?: () => Promise<void>;
            }
          ).webkitExitFullscreen
        ) {
          await (
            document as unknown as { webkitExitFullscreen: () => Promise<void> }
          ).webkitExitFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle failed:", error);
    }
  }, []);

  const label = isFullscreen ? "Exit fullscreen" : "Fullscreen";

  return (
    <PressedTooltip content={label} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFullscreen}
        aria-label={label}
        data-test="fullscreen-toggle"
        className={cn(
          "h-8 w-8 rounded-md",
          isFullscreen
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground",
        )}>
        {isFullscreen ? (
          <Minimize className="h-5 w-5" />
        ) : (
          <Maximize className="h-5 w-5" />
        )}
      </Button>
    </PressedTooltip>
  );
}

export default HeaderFullscreenToggle;
