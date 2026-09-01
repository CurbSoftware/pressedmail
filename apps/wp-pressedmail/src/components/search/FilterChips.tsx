"use client";

/**
 * Filter Chips Component
 *
 * Displays active search filters as removable chips/badges.
 * Supports both parsed operators and advanced search filters.
 */

import * as React from "react";
import {
  X,
  Mail,
  User,
  Tag,
  Calendar,
  Paperclip,
  Star,
  Folder,
} from "lucide-react";
import { Badge } from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import type { AdvancedSearchFilters } from "@/types/search";

interface FilterChip {
  id: string;
  label: string;
  value: string;
  icon?: React.ReactNode;
  category:
    | "from"
    | "to"
    | "subject"
    | "has"
    | "is"
    | "date"
    | "folder"
    | "other";
}

interface FilterChipsProps {
  filters: AdvancedSearchFilters;
  operators?: { operator: string; value: string }[];
  onRemoveFilter: (filterKey: keyof AdvancedSearchFilters) => void;
  onRemoveOperator?: (index: number) => void;
  onClearAll?: () => void;
  className?: string;
  maxVisible?: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  from: <Mail className="h-3 w-3" />,
  to: <User className="h-3 w-3" />,
  subject: <Tag className="h-3 w-3" />,
  has: <Paperclip className="h-3 w-3" />,
  is: <Star className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  folder: <Folder className="h-3 w-3" />,
};

/**
 * Convert advanced filters to displayable chips
 */
function filtersToChips(filters: AdvancedSearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.from) {
    chips.push({
      id: "from",
      label: "From",
      value: filters.from,
      icon: CATEGORY_ICONS.from,
      category: "from",
    });
  }

  if (filters.to) {
    chips.push({
      id: "to",
      label: "To",
      value: filters.to,
      icon: CATEGORY_ICONS.to,
      category: "to",
    });
  }

  if (filters.subject) {
    chips.push({
      id: "subject",
      label: "Subject",
      value: filters.subject,
      icon: CATEGORY_ICONS.subject,
      category: "subject",
    });
  }

  if (filters.hasAttachments) {
    chips.push({
      id: "hasAttachments",
      label: "Has",
      value: "attachment",
      icon: CATEGORY_ICONS.has,
      category: "has",
    });
  }

  if (filters.starred) {
    chips.push({
      id: "starred",
      label: "Is",
      value: "starred",
      icon: CATEGORY_ICONS.is,
      category: "is",
    });
  }

  if (filters.readStatus && filters.readStatus !== "all") {
    chips.push({
      id: "readStatus",
      label: "Is",
      value: filters.readStatus,
      icon: CATEGORY_ICONS.is,
      category: "is",
    });
  }

  if (filters.folder) {
    chips.push({
      id: "folder",
      label: "In",
      value: filters.folder,
      icon: CATEGORY_ICONS.folder,
      category: "folder",
    });
  }

  if (filters.dateRange?.start) {
    chips.push({
      id: "dateStart",
      label: "After",
      value: filters.dateRange.start.toLocaleDateString(),
      icon: CATEGORY_ICONS.date,
      category: "date",
    });
  }

  if (filters.dateRange?.end) {
    chips.push({
      id: "dateEnd",
      label: "Before",
      value: filters.dateRange.end.toLocaleDateString(),
      icon: CATEGORY_ICONS.date,
      category: "date",
    });
  }

  return chips;
}

/**
 * Convert parsed operators to displayable chips
 */
function operatorsToChips(
  operators: { operator: string; value: string }[],
): FilterChip[] {
  return operators.map((op, index) => ({
    id: `op-${index}`,
    label: op.operator.charAt(0).toUpperCase() + op.operator.slice(1),
    value: op.value,
    icon: CATEGORY_ICONS[op.operator] || null,
    category: (op.operator as FilterChip["category"]) || "other",
  }));
}

export function FilterChips({
  filters,
  operators = [],
  onRemoveFilter,
  onRemoveOperator,
  onClearAll,
  className,
  maxVisible = 5,
}: FilterChipsProps) {
  // Convert filters to chips (dedup between filters and operators)
  const filterChips = filtersToChips(filters);
  const operatorChips = operators.length > 0 ? operatorsToChips(operators) : [];

  // Merge and deduplicate
  const allChips = [...filterChips];

  // Only add operator chips that don't duplicate filter chips
  operatorChips.forEach((opChip) => {
    const isDuplicate = filterChips.some(
      (fc) =>
        fc.category === opChip.category &&
        fc.value.toLowerCase() === opChip.value.toLowerCase(),
    );
    if (!isDuplicate) {
      allChips.push(opChip);
    }
  });

  if (allChips.length === 0) return null;

  const visibleChips = allChips.slice(0, maxVisible);
  const hiddenCount = allChips.length - maxVisible;

  const handleRemove = (chip: FilterChip) => {
    if (chip.id.startsWith("op-") && onRemoveOperator) {
      const index = parseInt(chip.id.replace("op-", ""), 10);
      onRemoveOperator(index);
    } else {
      // Map chip IDs to filter keys
      const keyMap: Record<string, keyof AdvancedSearchFilters> = {
        from: "from",
        to: "to",
        subject: "subject",
        hasAttachments: "hasAttachments",
        starred: "starred",
        readStatus: "readStatus",
        folder: "folder",
        dateStart: "dateRange",
        dateEnd: "dateRange",
      };
      const filterKey = keyMap[chip.id];
      if (filterKey) {
        onRemoveFilter(filterKey);
      }
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {visibleChips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className={cn(
            "gap-1 pl-1.5 pr-1 py-0.5 text-xs font-normal",
            "bg-primary/10 text-primary hover:bg-primary/20",
            "transition-colors cursor-default group",
          )}>
          {chip.icon && <span className="text-primary/70">{chip.icon}</span>}
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="font-medium max-w-[120px] truncate">
            {chip.value}
          </span>
          <button
            type="button"
            onClick={() => handleRemove(chip)}
            className={cn(
              "ml-0.5 rounded-full p-0.5",
              "hover:bg-primary/30 transition-colors",
              "opacity-60 group-hover:opacity-100",
            )}>
            <X className="h-3 w-3" />
            <span className="sr-only">Remove filter</span>
          </button>
        </Badge>
      ))}

      {hiddenCount > 0 && (
        <Badge
          variant="outline"
          className="px-2 py-0.5 text-xs cursor-pointer hover:bg-muted">
          +{hiddenCount} more
        </Badge>
      )}

      {allChips.length > 0 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            "text-xs text-muted-foreground hover:text-foreground",
            "transition-colors underline-offset-2 hover:underline",
          )}>
          Clear all
        </button>
      )}
    </div>
  );
}

export default FilterChips;
