"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface PressedTooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  preload?: boolean;
}

interface PressedTooltipContentProps extends Omit<
  React.ComponentProps<typeof TooltipContent>,
  "side"
> {
  side?: TooltipSide;
}

interface PressedTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  align?: "start" | "center" | "end";
  alignOffset?: number;
  collisionPadding?: number;
  className?: string;
  /** Classes for the trigger wrapper span (e.g. `w-full`/`flex-1` so the
   *  wrapped button keeps its layout sizing). */
  triggerClassName?: string;
  disabled?: boolean;
  /** Keep the trigger wrapper but never show the tooltip, e.g. while the
   *  trigger's own popover is open. Unlike `disabled`, the trigger does not
   *  remount, so it keeps focus. */
  suppressed?: boolean;
}

// The pointer position follows the content's resolved `data-side` (Radix sets
// it, and may flip it on collision) rather than the requested `side`, so the
// arrow stays attached to the trigger after a collision flip.
const POINTER_GROUP_CLASS = cn(
  "group-data-[side=top]:left-1/2 group-data-[side=top]:-translate-x-1/2 group-data-[side=top]:-bottom-1",
  "group-data-[side=bottom]:left-1/2 group-data-[side=bottom]:-translate-x-1/2 group-data-[side=bottom]:-top-1",
  "group-data-[side=right]:top-1/2 group-data-[side=right]:-translate-y-1/2 group-data-[side=right]:-left-1",
  "group-data-[side=left]:top-1/2 group-data-[side=left]:-translate-y-1/2 group-data-[side=left]:-right-1",
);

export function PressedTooltipProvider({
  children,
  delayDuration = 0,
  skipDelayDuration = 0,
  preload = true,
}: PressedTooltipProviderProps) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      disableHoverableContent
      skipDelayDuration={skipDelayDuration}>
      {children}
      {preload && <TooltipPortalPreload />}
    </TooltipProvider>
  );
}

function TooltipPortalPreload() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-hidden="true" className="sr-only">
          tooltip preload
        </span>
      </TooltipTrigger>
      <PressedTooltipContent
        side="top"
        sideOffset={0}
        className="pointer-events-none opacity-0"
        aria-hidden="true">
        &nbsp;
      </PressedTooltipContent>
    </Tooltip>
  );
}

export function PressedTooltipContent({
  side = "top",
  sideOffset = 12,
  collisionPadding = 10,
  className,
  children,
  ...props
}: PressedTooltipContentProps) {
  return (
    <TooltipContent
      forceMount
      side={side}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        "group relative overflow-visible rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium leading-tight text-popover-foreground shadow-lg transition-none animate-none data-[state=closed]:animate-none data-[state=delayed-open]:animate-none",
        className,
      )}
      {...props}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute h-2 w-2 bg-popover shadow-md",
          POINTER_GROUP_CLASS,
        )}
        style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
      />
    </TooltipContent>
  );
}

let quiet: HTMLElement | null = null;

/**
 * Focus an element without opening its tooltip. For focus a dialog hands
 * back as it closes: after Escape the browser still counts that focus as
 * keyboard focus, so the tooltip popped over the row unasked, and on a
 * phone over the next row too.
 */
export function focusQuietly(el: HTMLElement): void {
  quiet = el;
  try {
    el.focus();
  } finally {
    quiet = null;
  }
}

/**
 * Radix opens a tooltip on any focus. When a dialog hands focus back to its
 * opener after a mouse Cancel, that focus is programmatic, not keyboard, and
 * the tooltip then sat over the row and caught the next click. Only let
 * focus the browser would ring (:focus-visible) open it; hover still does.
 * Radix skips its own handler when this one prevents the default.
 */
function openOnKeyboardFocusOnly(event: React.FocusEvent<HTMLElement>) {
  if (quiet && event.target instanceof Node && quiet.contains(event.target)) {
    event.preventDefault();
    return;
  }
  try {
    if (!(event.target as Element).matches(":focus-visible")) {
      event.preventDefault();
    }
  } catch {
    // An engine without :focus-visible keeps the old behaviour.
  }
}

export function PressedTooltip({
  content,
  children,
  side = "top",
  sideOffset = 12,
  align,
  alignOffset,
  collisionPadding = 10,
  className,
  triggerClassName,
  disabled = false,
  suppressed = false,
}: PressedTooltipProps) {
  const [open, setOpen] = React.useState(false);
  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      open={open && !suppressed}
      onOpenChange={(next) => setOpen(next && !suppressed)}>
      <TooltipTrigger asChild onFocus={openOnKeyboardFocusOnly}>
        <span className={cn("inline-flex", triggerClassName)}>{children}</span>
      </TooltipTrigger>

      <PressedTooltipContent
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className={className}>
        {content}
      </PressedTooltipContent>
    </Tooltip>
  );
}
