"use client";

import * as React from "react";

import { useTags } from "@/context/tags";
import { useFilterOperations } from "@/context/InboxContext";
import { toggleTagFilterId } from "@/components/tags/tag-filter-utils";
import {
  EmailTagVisualIcon,
  emailTagSoftBadgeClassName,
  getEmailTagBadgeStyle,
  resolveEmailTagColor,
} from "@/components/tags/tag-visuals";
import { cn } from "@/lib/utils";

/**
 * Tag count above which the chip row spills past two rows and needs the
 * expand/collapse control. jsdom can't measure rows, so the gate is purely
 * count-based (deterministic + testable); the visual two-row clamp itself is
 * the CSS `.pm-chip-clamp-2` max-height.
 */
const TAG_CHIPS_TWO_ROW_THRESHOLD = 6;

export type InboxQuickFilter = "all" | "unread" | "important" | "starred";

export interface InboxFilterChipsProps {
  quickFilter?: InboxQuickFilter;
  onQuickFilterChange?: (value: InboxQuickFilter) => void;
  /** Legacy callers still using the old All/Unread contract. */
  readFilter?: "all" | "unread";
  onReadFilterChange?: (value: "all" | "unread") => void;
  className?: string;
}

const QUICK_FILTERS: Array<{ id: InboxQuickFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "important", label: "Important" },
  { id: "starred", label: "Starred" },
];

function QuickChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        emailTagSoftBadgeClassName,
        "pm-touch-target pm-no-tap-highlight h-7 shrink-0 px-2.5 transition-colors hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
          : "border-border bg-card text-muted-foreground active:bg-muted",
      )}>
      {label}
    </button>
  );
}

/**
 * Inbox quick-filter row: All / Unread plus a chip per active tag. Chips are
 * compact and wrap inline; the tag set clamps to two rows behind a More tags /
 * Collapse toggle when it overflows. Tag chips reuse the soft-badge visuals and
 * filter wiring from TagFilterSection (applyFilters({tags}) / clearFilters), so
 * tapping a tag filters the inbox and tapping the active tag clears it.
 */
export function InboxFilterChips({
  quickFilter,
  onQuickFilterChange,
  readFilter,
  onReadFilterChange,
  className,
}: InboxFilterChipsProps) {
  const { tags } = useTags();
  const { activeFilters, applyFilters } = useFilterOperations();
  const [expanded, setExpanded] = React.useState(false);

  const activeTags = React.useMemo(
    () => tags.filter((t) => t.is_active !== false),
    [tags],
  );
  const resolvedQuickFilter = quickFilter ?? readFilter ?? "all";
  const current = activeFilters.tags ?? [];
  const hasOverflow =
    activeTags.length + QUICK_FILTERS.length > TAG_CHIPS_TWO_ROW_THRESHOLD;

  const handleQuickFilter = (value: InboxQuickFilter) => {
    if (onQuickFilterChange) {
      onQuickFilterChange(value);
      return;
    }
    if ((value === "all" || value === "unread") && onReadFilterChange) {
      onReadFilterChange(value);
    }
  };

  const toggleTag = (id: number) => {
    const tagId = String(id);
    const next = toggleTagFilterId(current, tagId);
    applyFilters({ ...activeFilters, tags: next });
  };

  return (
    <div
      role="toolbar"
      aria-label="Filters and tags"
      className={cn("flex flex-col gap-1 px-3 py-2", className)}>
      <div
        data-pm-chip-wrap
        className={cn(
          "flex flex-wrap items-center gap-2",
          hasOverflow && !expanded && "pm-chip-clamp-2",
        )}>
        {QUICK_FILTERS.map((filter) => (
          <QuickChip
            key={filter.id}
            label={filter.label}
            active={resolvedQuickFilter === filter.id}
            onClick={() => handleQuickFilter(filter.id)}
          />
        ))}
        {activeTags.map((t) => {
          const isActive = current.includes(String(t.id));
          return (
            <button
              key={t.id}
              type="button"
              aria-label={t.name}
              aria-pressed={isActive}
              onClick={() => toggleTag(t.id)}
              className={cn(
                emailTagSoftBadgeClassName,
                "pm-touch-target pm-no-tap-highlight h-7 shrink-0 transition-colors hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive &&
                  "ring-2 ring-primary/50 ring-offset-1 ring-offset-background",
              )}
              style={getEmailTagBadgeStyle(t)}
              data-tag-color={resolveEmailTagColor(t)}>
              <EmailTagVisualIcon />
              <span className="truncate">{t.name}</span>
            </button>
          );
        })}
      </div>
      {hasOverflow ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            emailTagSoftBadgeClassName,
            "pm-touch-target pm-no-tap-highlight h-7 w-fit bg-card px-2.5 text-muted-foreground hover:text-foreground",
          )}>
          {expanded ? "Collapse" : "More tags"}
        </button>
      ) : null}
    </div>
  );
}

export default InboxFilterChips;
