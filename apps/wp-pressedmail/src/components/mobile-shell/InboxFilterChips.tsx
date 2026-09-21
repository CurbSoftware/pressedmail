"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Check } from "lucide-react";

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

export type InboxQuickFilter = "all" | "unread" | "important" | "starred";

export interface InboxFilterChipsProps {
  quickFilter?: InboxQuickFilter;
  onQuickFilterChange?: (value: InboxQuickFilter) => void;
  /** Legacy callers still using the old All/Unread contract. */
  readFilter?: "all" | "unread";
  onReadFilterChange?: (value: "all" | "unread") => void;
  className?: string;
}

/**
 * One chip geometry for the whole shell.
 *
 * 32px tall so a row of chips costs 32px rather than 44px, with the touch
 * target restored by an absolutely positioned ::after carrying negative
 * insets: 32 + 2*6 = 44px of hittable area behind a 32px control. That is the
 * same trick MobileSearchInput's clear button uses, and the craft gate
 * measures it (it grows a control's rect by an absolute ::after with negative
 * insets before comparing against the 44px floor).
 *
 * `pm-touch-target` is deliberately NOT used here: it sets min-height 44px, so
 * every chip rendered 44px tall, the tag row ate a quarter of the first screen,
 * and the two-row clamp (written for 28px rows) sliced the second row of chips
 * in half, which is why the Ultimate inbox showed three unlabeled coloured
 * slabs.
 *
 * The element that scrolls must carry at least that 6px of vertical padding.
 * An overflow container clips at its padding box, so a bare scroller cuts the
 * ::after off top and bottom and hands back a 32px target: the top strip is
 * unreachable and the bottom strip is scroll overflow. The padding therefore
 * lives on the scrolling element itself, here and in FilterChipsRow, never on
 * a parent.
 */
const CHIP_BASE =
  "pm-no-tap-highlight relative inline-flex h-8 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-medium transition-colors after:absolute after:-inset-1.5 after:content-['']";

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
        CHIP_BASE,
        "rounded-full border",
        // A fill, not a ring. The selected chip used ring-2 + ring-offset,
        // which is exactly what a keyboard focus ring looks like, so every
        // screenshot showed a double outline around "All" that read as a
        // stuck focus state.
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground active:bg-muted",
      )}>
      {active ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  );
}

/**
 * Inbox quick-filter row: All / Unread / Important / Starred plus a chip per
 * active tag, in a single horizontally scrolling row. Tag chips reuse the soft
 * badge visuals and the filter wiring from TagFilterSection
 * (applyFilters({tags}) / clearFilters), so tapping a tag filters the inbox and
 * tapping the active tag clears it.
 *
 * One row that scrolls, rather than a wrapping block clamped to two rows
 * behind a "More tags" toggle: the clamp cut chips in half, the toggle added a
 * third row of its own, and the whole cluster pushed the first message below
 * the fold.
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

  const quickFilters = React.useMemo<
    Array<{ id: InboxQuickFilter; label: string }>
  >(
    () => [
      { id: "all", label: __("All", "pressedmail") },
      { id: "unread", label: __("Unread", "pressedmail") },
      { id: "important", label: __("Important", "pressedmail") },
      { id: "starred", label: __("Starred", "pressedmail") },
    ],
    [],
  );

  const activeTags = React.useMemo(
    () => tags.filter((t) => t.is_active !== false),
    [tags],
  );
  const resolvedQuickFilter = quickFilter ?? readFilter ?? "all";
  const current = activeFilters.tags ?? [];

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

  // One element, so the padding can never drift off the box that scrolls.
  return (
    <div
      role="toolbar"
      aria-label={__("Filters and tags", "pressedmail")}
      data-pm-chip-wrap
      className={cn(
        "flex w-full snap-x items-center gap-2 overflow-x-auto px-3 py-2",
        "pm-momentum-scroll",
        className,
      )}>
      {quickFilters.map((filter) => (
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
              CHIP_BASE,
              "rounded-md",
              isActive && "border-primary font-semibold",
            )}
            style={getEmailTagBadgeStyle(t)}
            data-tag-color={resolveEmailTagColor(t)}>
            {isActive ? (
              <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <EmailTagVisualIcon />
            )}
            <span className="truncate">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default InboxFilterChips;
