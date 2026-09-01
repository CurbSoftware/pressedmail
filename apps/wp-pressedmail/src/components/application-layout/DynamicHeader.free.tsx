"use client";

/**
 * Dynamic Header: FREE variant.
 *
 * The free build ships only the default ("pressedm") layout, so the header is
 * always the DefaultHeader. The Pro layout headers (PressedG / PressedOut) live
 * in DynamicHeader.pro.tsx and are selected via the Vite `DynamicHeader.active`
 * alias in the Pro build only, so this variant never imports the Pro layout
 * variant directories.
 */

import { DefaultHeader } from "@/layouts/variants/default/inbox/Header";
import { TooltipProvider } from "@kit/ui/plugin";

export interface DynamicHeaderProps {
  className?: string;
}

export function DynamicHeader({ className }: DynamicHeaderProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <DefaultHeader className={className} />
    </TooltipProvider>
  );
}

export default DynamicHeader;
