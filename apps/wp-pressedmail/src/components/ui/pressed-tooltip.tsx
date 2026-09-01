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
}: PressedTooltipProps) {
  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
