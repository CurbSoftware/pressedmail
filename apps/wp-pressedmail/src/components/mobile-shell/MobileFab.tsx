"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MobileFabProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "extended";
  className?: string;
}

/**
 * Floating action button positioned bottom-right above the safe-area inset.
 * Use variant="extended" when the action benefits from a visible label
 * (e.g. "New event"). The default variant is icon-only and labelled by
 * aria-label.
 */
export function MobileFab({
  label,
  icon: Icon,
  onClick,
  variant = "default",
  className,
}: MobileFabProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "pm-no-tap-highlight fixed z-40 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:bg-primary/90",
        "right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)]",
        variant === "extended" ? "h-14 gap-2 px-5" : "h-14 w-14",
        className,
      )}>
      <Icon className="h-6 w-6" aria-hidden="true" />
      {variant === "extended" ? (
        <span className="text-sm font-semibold">{label}</span>
      ) : null}
    </button>
  );
}

export default MobileFab;
