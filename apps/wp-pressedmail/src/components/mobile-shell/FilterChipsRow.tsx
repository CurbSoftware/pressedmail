"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  badge?: number;
}

export interface FilterChipsRowProps {
  chips: FilterChip[];
  value: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Horizontally scrollable row of filter chips, snap-to-start. Used at the top
 * of list screens (Inbox: All/Unread/Starred/…, Calendar: Day/Week/Month/…).
 */
export function FilterChipsRow({
  chips,
  value,
  onSelect,
  className,
}: FilterChipsRowProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filters"
      className={cn(
        "flex w-full snap-x snap-mandatory items-center gap-2 overflow-x-auto px-3 py-2",
        "pm-momentum-scroll pm-no-tap-highlight",
        className,
      )}>
      {chips.map((chip) => {
        const active = chip.id === value;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(chip.id)}
            className={cn(
              "pm-no-tap-highlight inline-flex h-7 shrink-0 snap-start items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground active:bg-muted",
            )}>
            <span>{chip.label}</span>
            {chip.badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-4",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground",
                )}>
                {chip.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default FilterChipsRow;
