"use client";

/**
 * Search Trigger Component
 *
 * Compact, clickable bar that opens the SearchCommandMenu overlay.
 * Displays current search state (scope tabs, active filters, search term)
 * but is NOT editable, all typing happens in the command menu.
 *
 * @since 3.2.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Search, Filter, X } from "lucide-react";
import { Badge, Button } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useSearchCommandMenu } from "./SearchCommandMenuContext";
import { getActiveFilterLabels } from "@/types/search";

export interface SearchTriggerProps {
  className?: string;
  placeholder?: string;
}

export function SearchTrigger({ className, placeholder }: SearchTriggerProps) {
  const { open, search, sharedOps } = useSearchCommandMenu();

  const displayPlaceholder =
    placeholder || __("Search emails...", "pressedmail");

  // Active filter info
  const activeFilterLabels = getActiveFilterLabels(sharedOps.advancedFilters);
  const hasActiveFilters =
    activeFilterLabels.length > 0 || search.hasActiveFilters;
  const displayText = search.searchTerm || "";

  // Handle clear without opening menu
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    search.clearSearch();
    search.resetFilters();
    sharedOps.clearSearch();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "flex items-center gap-2 px-3 h-9 border border-input rounded-md bg-muted/40 cursor-pointer transition-all",
        "hover:bg-muted/60 hover:border-input/80",
        className,
      )}
      aria-label={__("Open search", "pressedmail")}>
      {/* Search icon */}
      <Search className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Display text or placeholder */}
      <span
        className={cn(
          "flex-1 text-sm truncate select-none",
          displayText ? "text-foreground" : "text-muted-foreground",
        )}>
        {displayText || displayPlaceholder}
      </span>

      {/* Active filter badges (max 2) */}
      {activeFilterLabels.length > 0 && (
        <div className="hidden md:flex items-center gap-1">
          {activeFilterLabels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="gap-1 px-2 py-0.5 text-xs whitespace-nowrap">
              {label}
            </Badge>
          ))}
          {activeFilterLabels.length > 2 && (
            <Badge variant="secondary" className="px-2 py-0.5 text-xs">
              +{activeFilterLabels.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Clear button (when search active) */}
      {(displayText || hasActiveFilters) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-6 w-6 p-0 shrink-0"
          aria-label={__("Clear search", "pressedmail")}>
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Filter icon with count */}
      {search.filterCount > 0 && (
        <div className="flex items-center gap-0.5 text-primary shrink-0">
          <Filter className="h-4 w-4" />
          <span className="text-xs">{search.filterCount}</span>
        </div>
      )}

      {/* Keyboard hint */}
      {!displayText && !hasActiveFilters && (
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          /
        </kbd>
      )}
    </div>
  );
}

export default SearchTrigger;
