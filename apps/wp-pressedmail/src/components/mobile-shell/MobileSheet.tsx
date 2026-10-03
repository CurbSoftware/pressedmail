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
  /**
   * No body padding: the content draws its own, so its section dividers run
   * edge to edge like the header's.
   */
  flush?: boolean;
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
  flush = false,
}: MobileSheetProps) {
  const popupRef = React.useRef<HTMLDivElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={popupRef}
        // Opened by touch, focus the sheet itself: landing on a text field
        // (the tag filter) raises the keyboard over the sheet's content.
        // Keyboard and mouse keep the default first-field focus.
        initialFocus={(openType) =>
          openType === "touch" ? popupRef.current : true
        }
        side={side}
        className={cn(
          "flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl",
          "pm-safe-pb pm-safe-pl pm-safe-pr",
          // Scroll shadows inside the sheet blend into its surface.
          "[--pm-scroll-surface:var(--background)]",
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
        <div
          className={cn(
            "pm-momentum-scroll min-h-0 flex-1",
            flush ? "p-0" : "px-4 py-3",
          )}>
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
