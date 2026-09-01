"use client";

import { useEffect, useState, useCallback } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * HeaderSidebarToggle - Compact toggle button for WordPress admin sidebar
 *
 * Positioned in the header beside the logo icon.
 * Toggles the WordPress admin menu between collapsed and expanded states.
 */
export function HeaderSidebarToggle({
  tooltipSide = "right",
}: {
  tooltipSide?: TooltipSide;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const body = document.body;
    const initiallyCollapsed = body.classList.contains("folded");

    setIsCollapsed(initiallyCollapsed);

    // Auto-collapse the menu when component mounts (PressedMail preference)
    if (!initiallyCollapsed) {
      body.classList.add("folded");
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    const body = document.body;

    if (body.classList.contains("folded")) {
      body.classList.remove("folded");
      setIsCollapsed(false);
    } else {
      body.classList.add("folded");
      setIsCollapsed(true);
    }
  }, []);

  const label = isCollapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <PressedTooltip content={label} side={tooltipSide}>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label={label}
        aria-expanded={!isCollapsed}
        data-test="sidebar-toggle"
        className={cn(
          "h-8 w-8 rounded-md",
          isCollapsed
            ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            : "text-muted-foreground",
        )}>
        {isCollapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
      </Button>
    </PressedTooltip>
  );
}

export default HeaderSidebarToggle;
