/**
 * Inbox Operations Interface
 *
 * Core inbox operations for message list management.
 * Provides a consistent contract for loading, filtering, and paginating messages
 * across all layout variants (Default, PressedG, PressedOut).
 *
 * @since 2.0.0
 */

import type {
  EmailMessage,
  EmailThreadGroupMap,
  GroupedMessage,
} from "@/types";
import type { EmailListGroupingMode } from "@/lib/message-grouping";
import type { MessageSyncDelta } from "./sync.interface";

/** Allowlisted mailbox ordering modes supported by the mirror API. */
export type MessageListSort = "newest" | "oldest" | "sender" | "subject";

/**
 * Options for loading messages from the server.
 */
export interface LoadMessagesOptions {
  /** Account ID to load messages for */
  accountId: string | number;
  /** IMAP folder path (default: "INBOX") */
  folder?: string;
  /** Pagination offset for server request */
  offset?: number;
  /** Number of messages to load */
  limit?: number;
  /** Force refresh from server, bypassing cache */
  forceRefresh?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Optional request timeout override in milliseconds */
  timeoutMs?: number;
  /** Use consolidated inbox API (all accounts) */
  consolidated?: boolean;
  /** Account IDs to include in consolidated inbox API requests */
  accountIds?: number[];
  /** Account-specific folder paths for consolidated virtual folders */
  folderMap?: Record<string | number, string>;
  /** Keep the existing list visible while loading in the background */
  silent?: boolean;
  /** Effective list grouping mode for the requested page. */
  grouping?: EmailListGroupingMode;
  /** Mailbox-wide ordering applied by the server before pagination. */
  sort?: MessageListSort;
}

/**
 * Result of a message loading operation.
 */
export interface LoadMessagesResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Loaded messages */
  messages: EmailMessage[];
  /** Total number of messages in folder */
  total: number;
  /** Whether more messages are available */
  hasMore: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Whether data came from cache */
  fromCache?: boolean;
  /** Whether cached data is stale and needs background refresh */
  stale?: boolean;
  /**
   * Whether the server served only a partial/cold mirror page (a background
   * refresh is queued). Undefined for cached/legacy reads. Boot uses this to
   * keep the first-sync gate up until a serviceable page is available.
   */
  servedPartial?: boolean;
  /** Whether the error was an authentication error (circuit breaker) */
  authError?: boolean;
  /** Sync token returned by the server for incremental polling */
  syncToken?: string | null;
  /** Timestamp of the list state that was loaded */
  lastSyncedAt?: number | null;
  /** Server-provided thread messages keyed by thread id. */
  threadGroups?: EmailThreadGroupMap;
}

/**
 * Options for refreshing messages.
 */
export interface RefreshOptions {
  /** Force full sync from server */
  forceSync?: boolean;
  /** Specific folder to refresh */
  folder?: string;
}

/**
 * Filter options for message list.
 */
export interface MessageFilters {
  /** General search term across common email fields */
  searchTerm?: string;
  /** Filter by read/unread status */
  readStatus?: "all" | "read" | "unread";
  /** Filter by starred status */
  starred?: boolean;
  /** Filter by provider/system important status */
  important?: boolean;
  /** Filter by attachment presence */
  hasAttachments?: boolean;
  /** Filter by provider labels */
  labels?: string[];
  /** Filter by PressedMail user-defined tags */
  tags?: string[];
  /** Filter by date range */
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  /** Filter by sender */
  from?: string;
  /** Filter by recipient */
  to?: string;
  /** Filter by subject keywords */
  subject?: string;
  /** Filter by folder */
  folder?: string;
  /** Filter by account email(s) in consolidated view */
  accountEmails?: string[];
  /** Filter Drafts to messages tied to pending/failed scheduled sends */
  scheduledOnly?: boolean;
}

/**
 * IInboxOperations Interface
 *
 * Core inbox operations interface for message list management.
 * Implementations handle loading, caching, filtering, and pagination.
 */
export interface IInboxOperations {
  // ============== State Accessors ==============

  /** Current list of messages */
  readonly messages: EmailMessage[];

  /** Messages grouped by thread or category */
  readonly groupedMessages: GroupedMessage[];

  /** Server-provided thread messages keyed by thread id. */
  readonly threadGroups: EmailThreadGroupMap;

  /** Currently selected/viewed message */
  readonly selectedMessage: EmailMessage | null;

  /** Whether a loading operation is in progress */
  readonly isLoading: boolean;

  /** Whether more messages are available for pagination */
  readonly hasMore: boolean;

  /** Total number of messages in current folder */
  readonly totalCount: number;

  /** Current folder path */
  readonly currentFolder: string;

  /** Whether loading more messages (pagination) */
  readonly isLoadingMore: boolean;

  /** Current active filters */
  readonly activeFilters: MessageFilters;

  // ============== Core Operations ==============

  /**
   * Load messages for an account and folder.
   *
   * @param options - Loading options including account, folder, pagination
   * @returns Promise resolving to the load result
   */
  loadMessages(options: LoadMessagesOptions): Promise<LoadMessagesResult>;

  /**
   * Load a page for bulk/snapshot workflows without mutating the visible inbox
   * state, selected message, pagination cursor, or loading indicators.
   */
  loadMessagesSnapshot(
    options: LoadMessagesOptions,
  ): Promise<LoadMessagesResult>;

  /**
   * Load additional messages (pagination).
   * Uses current account and folder context.
   *
   * @returns Promise resolving to the load result
   */
  loadMore(): Promise<LoadMessagesResult>;

  /**
   * Load an exact page for the current account and folder context.
   * Replaces the current page data instead of stepping through prior pages.
   *
   * @param page - 1-based page number
   * @param pageSize - Number of items to load per page
   */
  loadPage(page: number, pageSize?: number): Promise<LoadMessagesResult>;

  /**
   * Refresh messages from server.
   *
   * @param options - Optional refresh configuration
   */
  refresh(options?: RefreshOptions): Promise<void>;

  // ============== Selection ==============

  /**
   * Select a message for viewing.
   * May trigger loading of full message detail if not cached.
   *
   * @param message - Message to select, or null to deselect
   */
  selectMessage(message: EmailMessage | null): Promise<void>;

  /**
   * Clear the current message selection.
   */
  clearSelection(): void;

  // ============== Filtering ==============

  /**
   * Apply filters to the message list.
   * Filters are applied client-side to the loaded messages.
   *
   * @param filters - Filter criteria to apply
   */
  applyFilters(filters: MessageFilters): void;

  /**
   * Clear all active filters.
   */
  clearFilters(): void;

  /**
   * Get all unique labels from loaded messages.
   *
   * @returns Array of label strings
   */
  getAllLabels(): string[];

  // ============== Message Updates ==============

  /**
   * Update a message in the local state.
   * Used for optimistic updates after mutations.
   *
   * @param messageId - ID of message to update
   * @param updates - Partial message data to merge
   */
  updateMessage(
    messageId: string | number,
    updates: Partial<EmailMessage>,
  ): void;

  /**
   * Remove a message from the local state.
   * Used for optimistic updates after deletion.
   *
   * @param messageId - ID of message to remove
   */
  removeMessage(messageId: string | number): void;

  /**
   * Get the current request generation counter.
   * Callers should capture this before issuing a sync request and pass it
   * back to applyDiff so stale deltas arriving after a context switch are
   * rejected.
   */
  getRequestGeneration(): number;

  /**
   * Merge a delta payload into the currently loaded folder snapshot.
   *
   * @param delta - Incremental sync changes for the active folder
   * @param generation - Request generation captured before the sync call.
   *   If provided and older than the current generation, the delta is dropped.
   */
  applyDiff(delta: MessageSyncDelta, generation?: number): void;
}
