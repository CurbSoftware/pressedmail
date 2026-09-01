"use client";

/**
 * Pagination Bar
 *
 * Footer navigation for paginated message list.
 * Shows status text on the left and page controls on the right.
 *
 * @since 3.0.0
 */

import { PaginationFooter } from "@/layouts/shared/components/footer-system";

export interface PaginationBarProps {
  /** Current page (1-based) */
  currentPage: number;
  /** Total number of loaded items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Total messages in folder (from server): shown as "of X" when available */
  serverTotalItems?: number;
  /** Whether there are more messages on the server beyond what's loaded */
  hasMore?: boolean;
  /** Optional unread count to show in the status text */
  unreadCount?: number;
  className?: string;
}

export function PaginationBar({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  serverTotalItems,
  hasMore,
  unreadCount,
  className,
}: PaginationBarProps) {
  return (
    <PaginationFooter
      currentPage={currentPage}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={onPageChange}
      serverTotalItems={serverTotalItems}
      hasMore={hasMore}
      unreadCount={unreadCount}
      className={className}
    />
  );
}
