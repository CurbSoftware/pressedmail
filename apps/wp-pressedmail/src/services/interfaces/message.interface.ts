/**
 * Message Operations Interface
 *
 * Individual message and batch operation contracts.
 * Handles CRUD operations, flag management, and bulk actions.
 *
 * @since 2.0.0
 */

import type { EmailMessage } from "@/types";
import type { FolderTarget } from "./folder.interface";

/**
 * Options for fetching a single message.
 */
export interface GetMessageOptions {
  /** Captured source mailbox generation. */
  uidValidity?: string | number;
  /** Include full message body (HTML/text) */
  includeBody?: boolean;
  /** Include attachment data */
  includeAttachments?: boolean;
  /** Force refresh from server */
  forceRefresh?: boolean;
  /** Folder path (defaults to "INBOX") */
  folder?: string;
}

/**
 * Result of a single message operation.
 */
export interface OperationResult {
  /** The captured message reference no longer identifies a current mailbox row. */
  requiresRefresh?: boolean;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** A provider mutation succeeded, but a local draft document was lost or cleanup needs retry. */
  warning?: string;
  /** Updated message data (if applicable) */
  message?: EmailMessage;
}

/**
 * Result of a batch mailbox operation.
 *
 * Canonical batch contract:
 * - PHP endpoints return `processed_count` as the number of successful mutations.
 * - PHP endpoints return `failed_ids` as the exact UID or msg_no identifiers that failed.
 * - Partial success is represented as `success=false` with both `successCount` and `failedIds` populated.
 * - If the backend violates the contract, the client fails closed and reports the whole batch as failed.
 */
export interface BatchOperationResult extends OperationResult {
  /** Number of messages successfully processed */
  successCount: number;
  /** IDs of messages that failed to process */
  failedIds: (string | number)[];
  /** Total number of messages attempted */
  totalCount: number;
  /** True when the server throttled at least one chunk (HTTP 429). */
  rateLimited?: boolean;
  /** Folders the server auto-created to satisfy the destination. */
  createdFolders?: { path: string; folderId?: number | null }[];
  /** Per-account failures for cross-account (consolidated) operations. */
  accountErrors?: { accountId: string | number; error: string }[];
}

/**
 * Message identifier mode sent to the mailbox API.
 */
export type MessageIdentifierMode = "uid" | "msg_no";

/**
 * Shared options for mailbox mutation requests.
 */
export interface MessageMutationOptions {
  /** Captured source mailbox generation. */
  uidValidity?: string | number;
  /** Source folder path used to scope the IMAP operation */
  folder?: string;
  /** Legacy message number compatibility fallback */
  msgNo?: string | number;
  /** Whether the primary identifier is a UID or message number */
  identifierMode?: MessageIdentifierMode;
}

/**
 * Batch mailbox mutation options.
 */
export interface BatchMessageMutationOptions {
  /** Captured source mailbox generation. */
  uidValidity?: string | number;
  /** Source folder path used to scope the IMAP operation */
  folder?: string;
  /** Whether the batch identifiers are UIDs or message numbers */
  identifierMode?: MessageIdentifierMode;
}

/**
 * Message flag types supported by IMAP.
 */
export type MessageFlag =
  | "\\Seen"
  | "\\Flagged"
  | "\\Answered"
  | "\\Deleted"
  | "\\Draft";

/**
 * Move operation options.
 */
export interface MoveOptions {
  /** Target folder path */
  targetFolder: string;
  /** Account ID (required for cross-account context) */
  accountId?: string | number;
}

/**
 * IMessageOperations Interface
 *
 * Individual message and batch operations.
 * All operations return promises and support optimistic updates.
 */
export interface IMessageOperations {
  // ============== Single Message Operations ==============

  /**
   * Fetch a single message with optional body/attachments.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID (UID or composite ID)
   * @param options - Fetch options
   * @returns The message or null if not found
   */
  getMessage(
    accountId: string | number,
    messageId: string | number,
    options?: GetMessageOptions,
  ): Promise<EmailMessage | null>;

  /**
   * Mark a message as read.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @returns Operation result
   */
  markAsRead(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Mark a message as unread.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @returns Operation result
   */
  markAsUnread(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Toggle the starred/flagged status of a message.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @returns Operation result with updated starred state
   */
  toggleStar(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Fetch the full raw RFC822 headers for a message, including the Received
   * server chain, for the reading-pane "View headers" dialog.
   *
   * @param accountId - Account ID
   * @param messageId - Message UID or number
   * @returns The raw header block on success, or an error result.
   */
  getRawHeaders(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult & { headers?: string }>;

  /**
   * Delete a message (move to trash or permanent delete).
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @param permanent - If true, permanently delete instead of moving to trash
   * @returns Operation result
   */
  deleteMessage(
    accountId: string | number,
    messageId: string | number,
    permanent?: boolean,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Move a message to a different folder.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @param targetFolder - Destination folder path
   * @returns Operation result
   */
  moveMessage(
    accountId: string | number,
    messageId: string | number,
    targetFolder: string | FolderTarget,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Archive a message (move to Archive folder).
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @returns Operation result
   */
  archiveMessage(
    accountId: string | number,
    messageId: string | number,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  /**
   * Set or clear flags on a message.
   *
   * @param accountId - Account ID
   * @param messageId - Message ID
   * @param flag - Flag to set/clear
   * @param value - True to set, false to clear
   * @returns Operation result
   */
  setFlag(
    accountId: string | number,
    messageId: string | number,
    flag: MessageFlag,
    value: boolean,
    options?: MessageMutationOptions,
  ): Promise<OperationResult>;

  // ============== Batch Operations ==============

  /**
   * Mark multiple messages as read.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @returns Batch operation result
   */
  batchMarkRead(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Mark multiple messages as unread.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @returns Batch operation result
   */
  batchMarkUnread(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Delete multiple messages.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @param permanent - If true, permanently delete
   * @returns Batch operation result
   */
  batchDelete(
    accountId: string | number,
    messageIds: (string | number)[],
    permanent?: boolean,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Move multiple messages to a folder.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @param targetFolder - Destination folder path
   * @returns Batch operation result
   */
  batchMove(
    accountId: string | number,
    messageIds: (string | number)[],
    targetFolder: import("@/lib/folder-target").MutationTarget,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Permanently delete every message currently in the account Trash folder.
   *
   * @param accountId - Account ID
   * @param folder - Trash folder path
   * @returns Batch operation result using the number of messages emptied
   */
  emptyTrash(
    accountId: string | number,
    folder?: string,
  ): Promise<BatchOperationResult>;

  /**
   * Archive multiple messages.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @returns Batch operation result
   */
  batchArchive(
    accountId: string | number,
    messageIds: (string | number)[],
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Toggle star on multiple messages.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @param starred - New starred state (true = star, false = unstar)
   * @returns Batch operation result
   */
  batchToggleStar(
    accountId: string | number,
    messageIds: (string | number)[],
    starred: boolean,
    options?: BatchMessageMutationOptions,
  ): Promise<BatchOperationResult>;

  /**
   * Apply labels to multiple messages.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @param labels - Labels to apply
   * @returns Batch operation result
   */
  batchApplyLabels(
    accountId: string | number,
    messageIds: (string | number)[],
    labels: string[],
  ): Promise<BatchOperationResult>;

  /**
   * Remove labels from multiple messages.
   *
   * @param accountId - Account ID
   * @param messageIds - Array of message IDs
   * @param labels - Labels to remove
   * @returns Batch operation result
   */
  batchRemoveLabels(
    accountId: string | number,
    messageIds: (string | number)[],
    labels: string[],
  ): Promise<BatchOperationResult>;
}
