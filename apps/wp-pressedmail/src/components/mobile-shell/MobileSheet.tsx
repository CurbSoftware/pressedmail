"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@kit/ui/plugin";

import { cn } from "@/lib/utils";

export interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Bottom (default) or right edge slide-in. */
  side?: "bottom" | "right";
}

/**
 * Standard sheet for the mobile shell, built on the plugin-safe Sheet
 * primitive (theme-scoped portal). Bottom direction by default, Phase A
 * does not enable swipe-to-dismiss; that ships when the plugin barrel grows
 * a drag-aware drawer.
 */
export function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  side = "bottom",
}: MobileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl",
          "pm-safe-pb pm-safe-pl pm-safe-pr",
          className,
        )}>
        <SheetHeader className="border-b border-border">
          <SheetTitle className="truncate text-base font-semibold">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="pm-momentum-scroll min-h-0 flex-1 px-4 py-3">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-border p-3">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default MobileSheet;
