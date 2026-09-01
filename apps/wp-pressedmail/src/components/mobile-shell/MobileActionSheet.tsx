"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { MobileSheet } from "./MobileSheet";

export interface MobileActionSheetAction {
  id: string;
  label: string;
  icon: React.ElementType<{
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
  }>;
  onAction: () => void;
  description?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export interface MobileActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions: MobileActionSheetAction[];
}

export function MobileActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
}: MobileActionSheetProps) {
  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}>
      <ul role="list" className="flex flex-col gap-1">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.id}>
              <button
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  action.onAction();
                  onOpenChange(false);
                }}
                className={cn(
                  "pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-muted",
                  action.destructive ? "text-destructive" : "text-foreground",
                  action.disabled && "opacity-50",
                )}>
                <span
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
                    action.destructive
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {action.label}
                  </span>
                  {action.description ? (
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </MobileSheet>
  );
}

export default MobileActionSheet;
