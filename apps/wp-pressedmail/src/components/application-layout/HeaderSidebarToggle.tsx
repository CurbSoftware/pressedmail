"use client";

import { useCallback, useEffect, useState } from "react";
import { __ } from "@wordpress/i18n";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * WordPress renders `body.folded` from the user's saved `mfold` setting, and
 * keeps it in step with its own Collapse main menu button and its responsive
 * auto-fold. It is the single source of truth; this component only reads it.
 */
function isAdminMenuFolded(): boolean {
  return (
    typeof document !== "undefined" &&
    document.body.classList.contains("folded")
  );
}

/**
 * HeaderSidebarToggle - Compact toggle button for the WordPress admin menu.
 *
 * It drives core's own collapse control rather than the body class, so the
 * choice persists (core calls setUserSetting('mfold')), other plugins hear
 * 'wp-collapse-menu', and core's Collapse main menu button keeps announcing the
 * right state. Folding the menu on mount, as this used to, overrode the user's
 * saved preference on every single visit to the plugin.
 */
export function HeaderSidebarToggle({
  tooltipSide = "right",
}: {
  tooltipSide?: TooltipSide;
}) {
  const [isCollapsed, setIsCollapsed] = useState(isAdminMenuFolded);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const sync = () => setIsCollapsed(isAdminMenuFolded());
    sync();

    // Follow the class instead of owning it: core's button, its responsive
    // auto-fold and other plugins all change it.
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleSidebar = useCallback(() => {
    const collapseButton = document.getElementById("collapse-button");
    if (collapseButton) {
      collapseButton.click();
      return;
    }

    // No admin menu on this screen: nothing to delegate to, so fall back to the
    // class and keep our own state honest.
    document.body.classList.toggle("folded");
    setIsCollapsed(isAdminMenuFolded());
  }, []);

  const label = isCollapsed
    ? __("Expand main menu", "pressedmail")
    : __("Collapse main menu", "pressedmail");

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
          <PanelLeft className="h-5 w-5" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>
    </PressedTooltip>
  );
}

export default HeaderSidebarToggle;
