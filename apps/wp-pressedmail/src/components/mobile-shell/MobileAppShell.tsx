"use client";

import * as React from "react";

import { BackStackProvider } from "@/hooks/useBackStack";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { cn } from "@/lib/utils";

import { MobileLayoutProvider } from "./MobileLayoutContext";

export interface MobileAppShellProps {
  children: React.ReactNode;
  /** Bottom navigation, typically a <MobileTabBar />. */
  tabBar?: React.ReactNode;
  /** Sheets, prompts, and other portaled overlays. Rendered after the main column. */
  overlays?: React.ReactNode;
  className?: string;
}

/**
 * Root container for the mobile shell. Mounts the back-stack and mobile-layout
 * providers, sets `data-pm-shell="phone"` so the phone-specific CSS overrides
 * engage, and lays out the routed content above a sticky tab bar slot.
 *
 * The shell is intentionally agnostic of which screens, tabs, or sheets live
 * inside it. Those are supplied by the LayoutNavigationShell branch that
 * mounts this component, so this primitive stays decoupled from product
 * config and feature flags.
 */
export function MobileAppShell({
  children,
  tabBar,
  overlays,
  className,
}: MobileAppShellProps) {
  // Hide the WordPress admin chrome once, when the shell mounts. The header
  // toggle only reads and flips this afterwards, so the user's choice survives
  // navigation between screens.
  useImmersiveMode(true);

  return (
    <BackStackProvider>
      <MobileLayoutProvider>
        <div
          data-pm-shell-root
          data-pm-shell="phone"
          className={cn(
            "flex h-full min-h-0 w-full flex-col bg-background text-foreground",
            "pm-no-tap-highlight",
            className,
          )}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          {tabBar}
        </div>
        {overlays}
      </MobileLayoutProvider>
    </BackStackProvider>
  );
}

export default MobileAppShell;
