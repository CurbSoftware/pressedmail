"use client";

/**
 * List Controls Toolbar
 *
 * Toolbar that sits above the message list column. Contains list management
 * controls: Select, List options, Folder options.
 *
 * @since 3.0.0
 * @updated 3.3.0 - Split from combined toolbar; now list-only controls
 */

import { cn } from "@/lib/utils";
import {
  EmailListHeader,
  type EmailListSortState,
} from "@/components/inbox/EmailListHeader";
import type { ListOptions } from "./menus/ListOptionsModal";

export interface MessageListToolbarProps {
  listOptions: ListOptions;
  onListOptionsChange: (options: ListOptions) => void;
  currentPageIds?: (string | number)[];
  className?: string;
}

export function MessageListToolbar({
  listOptions,
  onListOptionsChange,
  currentPageIds,
  className,
}: MessageListToolbarProps) {
  const sort: EmailListSortState = {
    column: listOptions.sortColumn,
    order: listOptions.sortOrder,
  };

  const handleSortChange = (nextSort: EmailListSortState) => {
    onListOptionsChange({
      ...listOptions,
      sortColumn: nextSort.column,
      sortOrder: nextSort.order,
    });
  };

  const handleShowDetailsChange = (showDetails: boolean) => {
    onListOptionsChange({
      ...listOptions,
      showDetails,
    });
  };

  return (
    <EmailListHeader
      className={cn(className)}
      currentPageIds={currentPageIds}
      sort={sort}
      onSortChange={handleSortChange}
      showDetails={listOptions.showDetails}
      onShowDetailsChange={handleShowDetailsChange}
    />
  );
}
