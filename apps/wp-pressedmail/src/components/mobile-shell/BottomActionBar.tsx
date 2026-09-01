"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BottomActionBarAction {
  id: string;
  label: string;
  ariaLabel?: string;
  icon: LucideIcon;
  onAction: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
}

export interface BottomActionBarProps {
  actions: BottomActionBarAction[];
  title?: string;
  className?: string;
}

/**
 * Sticky bottom bar surfaced during contextual modes: bulk-select, multi-action
 * confirmations, undo prompts. Renders nothing when actions is empty so callers
 * can keep it permanently mounted.
 */
export function BottomActionBar({
  actions,
  title,
  className,
}: BottomActionBarProps) {
  if (!actions.length) return null;
  return (
    <div
      data-pm-bottom-action-bar
      className={cn(
        "sticky bottom-0 z-40 flex w-full shrink-0 flex-col gap-1 border-t border-border bg-card",
        "pm-safe-pb pm-safe-pl pm-safe-pr",
        className,
      )}>
      {title ? (
        <div className="px-4 pt-2 text-xs font-medium text-muted-foreground">
          {title}
        </div>
      ) : null}
      <div className="flex w-full items-stretch">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              aria-label={action.ariaLabel ?? action.label}
              disabled={action.disabled}
              onClick={action.onAction}
              className={cn(
                "pm-touch-target pm-no-tap-highlight flex flex-1 flex-col items-center justify-center gap-1 py-2 active:bg-muted",
                action.destructive ? "text-destructive" : "text-foreground",
                action.disabled && "opacity-50",
              )}>
              <Icon
                className={cn("h-5 w-5", action.loading && "animate-spin")}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium leading-none">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BottomActionBar;
