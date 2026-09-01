"use client";

/**
 * Layout Navigation Shell
 *
 * Wraps page content with layout-specific persistent navigation.
 * Page links now live in the shared header and compose lives in the fixed
 * speed dial, so this shell only preserves the routed content surface.
 *
 * @since 3.1.0
 */

import * as React from "react";
import { TooltipProvider } from "@kit/ui/plugin";

export interface LayoutNavigationShellProps {
  children: React.ReactNode;
}

export function LayoutNavigationShell({
  children,
}: LayoutNavigationShellProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full min-h-0 w-full overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default LayoutNavigationShell;
