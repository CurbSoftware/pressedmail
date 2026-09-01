"use client";

/**
 * Message List Pane
 *
 * Renders the paginated, sorted message list with:
 * - Connection error banner
 * - Paginated message list
 * - Pagination bar footer
 *
 * Toolbar and search are rendered at the Layout level so they span
 * both the message list and reading pane columns.
 *
 * @since 3.0.0
 * @updated 3.1.0 - Toolbar/search lifted to Layout; accepts listOptions as props
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { Menu } from "lucide-react";
import { InboxEmptyState } from "@/components/inbox/InboxEmptyState";
import { cn } from "@/lib/utils";
import { getMessageIdentityKey } from "@/lib/message-identity";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";
import { sortEmailMessages } from "@/lib/email-list-sort";
import { Button, ScrollArea } from "@kit/ui/plugin";
import { MailList } from "@/components/inbox/mail-list";
import { MailListSkeleton } from "@/components/inbox/mail-list-skeleton";
import { LoadMoreSentinel } from "@/components/inbox/LoadMoreSentinel";
import { ConnectionErrorBanner } from "@/layouts/shared/components/ConnectionErrorBanner";
import { ConsolidatedSyncIndicator } from "@/components/inbox/ConsolidatedSyncIndicator";
import { useMailOperations } from "@/layouts/shared/hooks/useMailOperations";
import {
  useFilterOperations,
  useInbox,
  useInboxState,
} from "@/context/InboxContext";
import { useEmailListMode } from "@/hooks/useEmailListMode";
import { useMobile } from "@/hooks/useMobile";
import { PaginationBar } from "./PaginationBar";
import type { ListOptions } from "./menus/ListOptionsModal";

export interface MessageListPaneProps {
  /** Callback to open the folder sheet on mobile */
  onShowFolderSheet?: () => void;
  /** Current list options (controlled by toolbar in Layout) */
  listOptions: ListOptions;
  /** Whether thread mode is active */
  threadsEnabled?: boolean;
  /** Callback to report current page IDs to the toolbar's SelectMenu */
  onCurrentPageIdsChange?: (ids: (string | number)[]) => void;
  /** Default page size */
  pageSize?: number;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function MessageListPane({
  onShowFolderSheet,
  listOptions,
  onCurrentPageIdsChange,
  pageSize: propPageSize,
  className,
}: MessageListPaneProps) {
  const { filteredMessages, isLoading } = useMailOperations();

  const {
    loadMore,
    loadPage,
    selectedAccountId,
    error: inboxError,
  } = useInbox();
  const { totalCount } = useInboxState();
  const { activeFilters } = useFilterOperations();
  const { isDesktop } = useMobile();
  const { isPagination, pageSize: prefPageSize } = useEmailListMode();

  // Pagination state
  const pageSize = propPageSize ?? prefPageSize ?? DEFAULT_PAGE_SIZE;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pendingPage, setPendingPage] = React.useState<number | null>(null);
  const filterSignature = React.useMemo(
    () => getMessageFilterSignature(activeFilters),
    [activeFilters],
  );

  const requestPage = React.useCallback(
    (page: number) => {
      setPendingPage(page);
      void Promise.resolve(loadPage(page, pageSize)).finally(() => {
        setPendingPage((current) => (current === page ? null : current));
      });
    },
    [loadPage, pageSize],
  );

  React.useEffect(() => {
    if (!isPagination || !selectedAccountId) {
      return;
    }

    setCurrentPage(1);
    requestPage(1);
  }, [isPagination, filterSignature, requestPage, selectedAccountId]);

  const sortedMessages = React.useMemo(() => {
    return sortEmailMessages(filteredMessages, {
      column: listOptions.sortColumn,
      order: listOptions.sortOrder,
    });
  }, [filteredMessages, listOptions]);

  // Paginate
  const totalItems = sortedMessages.length;
  const effectiveTotal =
    typeof totalCount === "number" && totalCount > totalItems
      ? totalCount
      : totalItems;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentPageIds = React.useMemo(
    () => sortedMessages.map((msg) => getMessageIdentityKey(msg)),
    [sortedMessages],
  );

  // Report currentPageIds to parent for the toolbar's SelectMenu
  React.useEffect(() => {
    onCurrentPageIdsChange?.(currentPageIds);
  }, [currentPageIds, onCurrentPageIdsChange]);

  const hasMore = isPagination
    ? safeCurrentPage * pageSize < effectiveTotal
    : typeof totalCount === "number" && totalCount > filteredMessages.length;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (isPagination) {
      requestPage(page);
      return;
    }

    if (page >= totalPages && hasMore && loadMore) {
      void loadMore();
    }
  };

  const displayMessages = sortedMessages;
  const isListLoading = isLoading || pendingPage !== null;

  return (
    <div
      className={cn("flex h-full flex-col", className)}
      style={{ minHeight: 0, width: "100%", overflow: "hidden" }}>
      {/* Mobile: Folder button */}
      {!isDesktop && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onShowFolderSheet}>
            <Menu className="h-4 w-4" />
            {__("Folders", "pressedmail")}
          </Button>
        </div>
      )}

      {/* Connection error banner */}
      <ConnectionErrorBanner />

      {/* Combined inbox: "Syncing N of M mailboxes…" (null for single mailbox) */}
      <ConsolidatedSyncIndicator />

      {/* Message list body */}
      <ScrollArea
        className="flex-1"
        style={{ minHeight: 0, width: "100%", maxWidth: "100%" }}>
        <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
          {isListLoading && displayMessages.length === 0 ? (
            <MailListSkeleton count={10} />
          ) : displayMessages.length === 0 ? (
            <InboxEmptyState
              title={
                inboxError
                  ? __("Failed to load messages", "pressedmail")
                  : undefined
              }
            />
          ) : (
            <MailList
              items={displayMessages}
              enableSelection={true}
              showDetails={listOptions.showDetails}
            />
          )}

          {!isPagination && <LoadMoreSentinel />}
        </div>
      </ScrollArea>

      {/* Pagination footer (only in pagination mode) */}
      {isPagination && (
        <PaginationBar
          currentPage={safeCurrentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          serverTotalItems={totalCount}
          hasMore={hasMore}
        />
      )}
    </div>
  );
}

export default MessageListPane;
