"use client";

import { __, sprintf } from "@wordpress/i18n";
import { ArrowDown, ArrowUp, Eye } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getNextEmailListSortState,
  type EmailListSortColumn,
  type EmailListSortState,
} from "@/lib/email-list-sort";

import { Button } from "@kit/ui/plugin";
import { useEmailSelection } from "@/context/selection";

import { EmailListSelectMenu } from "./EmailListSelectMenu";

export type { EmailListSortColumn, EmailListSortState };

export interface EmailListHeaderProps {
  /**
   * @deprecated No longer used, the select menu's "Select all" now selects the
   * loaded/visible rows directly. Kept optional so existing layout callers that
   * still compute and pass it continue to compile.
   */
  currentPageIds?: (string | number)[];
  sort: EmailListSortState;
  onSortChange: (sort: EmailListSortState) => void;
  showDetails: boolean;
  onShowDetailsChange: (showDetails: boolean) => void;
  className?: string;
}

function SortButton({
  column,
  sort,
  onSortChange,
  className,
}: {
  column: EmailListSortColumn;
  sort: EmailListSortState;
  onSortChange: (sort: EmailListSortState) => void;
  className?: string;
}) {
  const sortLabels: Record<EmailListSortColumn, string> = {
    from: __("From", "pressedmail"),
    subject: __("Subject", "pressedmail"),
    date: __("Date", "pressedmail"),
  };
  const active = sort.column === column;
  const label = sortLabels[column];
  const ascending = active && sort.order === "asc";
  const DirectionIcon = ascending ? ArrowUp : ArrowDown;

  // The name is built from the visible label so speech users can say what they
  // see (WCAG 2.5.3), and it carries the direction, which nothing used to say:
  // the icon was a two-way arrow whichever way the list was sorted.
  const name = active
    ? sprintf(
        /* translators: 1: column label, 2: sort direction. */
        __("Sort by %1$s, %2$s", "pressedmail"),
        label,
        ascending
          ? __("ascending", "pressedmail")
          : __("descending", "pressedmail"),
      )
    : sprintf(
        /* translators: %s: column label. */
        __("Sort by %s", "pressedmail"),
        label,
      );

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 min-w-0 justify-start gap-1 px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
        active && "text-foreground",
        className,
      )}
      onClick={() => onSortChange(getNextEmailListSortState(sort, column))}
      aria-label={name}
      data-test={`email-list-sort-${column}`}
      data-testid={`email-list-sort-${column}`}
      data-sort-direction={active ? sort.order : undefined}>
      <span className="truncate">{label}</span>
      {active && (
        <DirectionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
    </Button>
  );
}

export function EmailListHeader({
  sort,
  onSortChange,
  showDetails,
  onShowDetailsChange,
  className,
}: EmailListHeaderProps) {
  const { hasSelection, clearSelection } = useEmailSelection();
  const showClearSelection = hasSelection();

  return (
    <div
      data-test="email-list-header"
      data-testid="email-list-header"
      className={cn(
        "grid h-10 shrink-0 grid-cols-[auto_auto_minmax(3.5rem,0.8fr)_minmax(5rem,1.2fr)_auto_auto] items-center gap-1 border-b bg-card px-2 py-1 text-xs text-muted-foreground",
        className,
      )}>
      <EmailListSelectMenu />
      {showClearSelection && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
          onClick={clearSelection}
          aria-label={__("Clear selected messages", "pressedmail")}>
          {__("Clear", "pressedmail")}
        </Button>
      )}
      <SortButton column="from" sort={sort} onSortChange={onSortChange} />
      <SortButton column="subject" sort={sort} onSortChange={onSortChange} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1 px-1.5 text-xs font-normal text-muted-foreground hover:text-foreground",
          showDetails && "text-foreground",
        )}
        onClick={() => onShowDetailsChange(!showDetails)}
        aria-label={
          showDetails
            ? __("Hide details", "pressedmail")
            : __("Show details", "pressedmail")
        }>
        <Eye className="h-4 w-4" />
        <span>{__("Details", "pressedmail")}</span>
      </Button>
      <SortButton
        column="date"
        sort={sort}
        onSortChange={onSortChange}
        className="justify-end"
      />
    </div>
  );
}

export default EmailListHeader;
