/**
 * Sync Service Interface
 *
 * Coordinates IMAP synchronization between client and server.
 * Handles sync tokens, delta updates, and sync state management.
 *
 * @since 2.0.0
 */

import type { ConsolidatedAccountReadiness } from "@/lib/consolidated-account-readiness";

/**
 * Sync strategy types.
 */
export type SyncStrategy =
  | "full" // Complete sync from server
  | "incremental" // Delta sync since last token
  | "cache-only"; // Return from cache, no server request

/**
 * Sync options for controlling sync behavior.
 */
export interface SyncOptions {
  /** Specific folder to sync (default: all folders) */
  folder?: string;
  /** Force full sync even if incremental is possible */
  force?: boolean;
  /** Include all folders in sync */
  includeAllFolders?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Account IDs to include in consolidated sync requests */
  accountIds?: number[];
  /** Account-specific folder paths for consolidated virtual folders */
  folderMap?: Record<string | number, string>;
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Whether the sync succeeded */
  success: boolean;
  /** Number of new messages found */
  newMessages: number;
  /** Number of messages with updated flags */
  updatedMessages: number;
  /** Number of deleted messages detected */
  deletedMessages: number;
  /** New sync token for next sync */
  syncToken?: string;
  /** Error message if sync failed */
  error?: string;
  /** Strategy that was used */
  strategy: SyncStrategy;
  /** Whether a full sync is required (e.g., UIDVALIDITY changed) */
  requiresFullSync?: boolean;
  /** Delta payload when incremental sync succeeds */
  delta?: MessageSyncDelta;
}

/**
 * Per-account result returned by the entry mailbox bootstrap.
 */
export interface MailboxBootstrapAccountResult {
  /** Account ID that was bootstrapped */
  accountId: number;
  /** Whether this account was synced successfully */
  success: boolean;
  /** Number of folders discovered/synced into the mirror */
  foldersSynced: number;
  /** Required folders whose first page was warmed before the response */
  foldersWarmed: string[];
  /** Remaining folders queued for background first-page warmup */
  foldersQueued: string[];
  /** Account-specific failure message */
  error?: string;
}

/**
 * Result of the all-account entry mailbox bootstrap.
 */
export interface MailboxBootstrapResult {
  /** True when every account bootstrapped successfully */
  success: boolean;
  /** Per-account bootstrap outcomes */
  accounts: MailboxBootstrapAccountResult[];
  /** Overall failure or partial-failure message */
  error?: string;
}

/**
 * Sync status for a specific folder.
 */
export interface FolderSyncState {
  /** Last successful sync timestamp */
  lastSync: Date | null;
  /** IMAP UIDVALIDITY value */
  uidValidity: number;
  /** IMAP UIDNEXT value */
  uidNext: number;
  /** Last synced message UID */
  lastUid: number;
  /** Total message count at last sync */
  messageCount: number;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Last sync error (if any) */
  lastError?: string;
}

/**
 * Overall sync status for an account.
 */
export interface SyncStatus {
  /** Last sync timestamp for any folder */
  lastSync: Date | null;
  /** Whether any sync is in progress */
  isSyncing: boolean;
  /** Per-folder sync states */
  folderStates: Record<string, FolderSyncState>;
  /** Current sync error (if any) */
  error?: string;
}

/**
 * Decoded sync token payload.
 */
export interface SyncTokenPayload {
  /** Account ID */
  accountId: string | number;
  /** Folder path */
  folder: string;
  /** Last synced UID */
  lastUid: number;
  /** UIDVALIDITY at token creation */
  uidValidity: number;
  /** Token creation timestamp */
  timestamp: number;
}

/**
 * Delta changes returned by incremental sync.
 */
export interface MessageSyncUpdate {
  /** Current local list identifier for the message */
  localId: string;
  /** Changed fields for the message */
  changes: Record<string, unknown>;
}

export interface MessageSyncDelta {
  /** Newly arrived messages */
  added: Array<Record<string, unknown>>;
  /** Changed fields on existing messages */
  updated: MessageSyncUpdate[];
  /** Removed message identifiers */
  deleted: string[];
  /** Current total message count for the folder */
  total: number;
  /** Current unread count for the folder */
  unread: number;
  /** Current folder path */
  folder: string;
  /** New sync token */
  syncToken: string;
  /**
   * Account IDs that were in scope when this delta was requested.
   * Only set for consolidated inbox deltas. Used by applyDiff to reject
   * stale deltas when the consolidated account selection changes mid-flight.
   */
  consolidatedAccountIds?: number[];
  /**
   * Per-account readiness carried by a consolidated diff (undefined for
   * single-account deltas). Lets applyDiff refresh the combined-inbox readiness
   * chips (e.g. flip a mailbox to an auth-failed error state) between full page
   * loads, so a mid-session failure surfaces within one head-delta cycle.
   */
  consolidatedAccountReadiness?: ConsolidatedAccountReadiness[];
}

/**
 * ISyncService Interface
 *
 * Coordinates IMAP synchronization.
 * Manages sync tokens and determines optimal sync strategy.
 */
export interface ISyncService {
  // ============== State Accessors ==============

  /** Whether any sync is currently in progress */
  readonly isSyncing: boolean;

  /** Last sync timestamp */
  readonly lastSyncTime: Date | null;

  /** Current sync error (if any) */
  readonly syncError: string | null;

  // ============== Sync Operations ==============

  /**
   * Sync messages for an account.
   * Automatically determines optimal strategy (full vs incremental).
   *
   * @param accountId - Account ID
   * @param options - Sync options
   * @returns Sync result
   */
  sync(accountId: string | number, options?: SyncOptions): Promise<SyncResult>;

  /**
   * Perform incremental sync using sync token.
   * Falls back to full sync if token is invalid.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @param syncToken - Sync token from previous sync
   * @returns Sync result with delta changes
   */
  incrementalSync(
    accountId: string | number,
    folder: string,
    syncToken: string,
    options?: SyncOptions & { consolidated?: boolean },
  ): Promise<SyncResult>;

  /**
   * Perform full sync for an account.
   * Ignores any existing sync state.
   *
   * @param accountId - Account ID
   * @param options - Sync options
   * @returns Sync result
   */
  fullSync(
    accountId: string | number,
    options?: SyncOptions,
  ): Promise<SyncResult>;

  /**
   * Bootstrap all current-user account mirrors for PressedMail UI entry.
   *
   * @param options - Optional abort signal
   * @returns Per-account bootstrap results
   */
  bootstrapMailboxes(options?: { signal?: AbortSignal }): Promise<MailboxBootstrapResult>;

  // ============== Sync Status ==============

  /**
   * Get sync status for an account.
   *
   * @param accountId - Account ID
   * @returns Current sync status
   */
  getSyncStatus(accountId: string | number): SyncStatus;

  /**
   * Get sync state for a specific folder.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @returns Folder sync state or undefined
   */
  getFolderSyncState(
    accountId: string | number,
    folder: string,
  ): FolderSyncState | undefined;

  /**
   * Check if a folder needs sync.
   * Based on time since last sync and known server changes.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @returns True if sync is recommended
   */
  needsSync(accountId: string | number, folder: string): boolean;

  // ============== Sync Token Management ==============

  /**
   * Generate a sync token for a folder state.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @param lastUid - Last synced UID
   * @param uidValidity - Current UIDVALIDITY
   * @returns Encoded sync token
   */
  generateSyncToken(
    accountId: string | number,
    folder: string,
    lastUid: number,
    uidValidity: number,
  ): string;

  /**
   * Decode a sync token.
   *
   * @param token - Encoded sync token
   * @returns Decoded payload or null if invalid
   */
  decodeSyncToken(token: string): SyncTokenPayload | null;

  /**
   * Validate a sync token against current server state.
   *
   * @param token - Sync token to validate
   * @param currentUidValidity - Current server UIDVALIDITY
   * @returns True if token is still valid
   */
  validateSyncToken(token: string, currentUidValidity: number): boolean;

  /**
   * Get stored sync token for a folder.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @returns Stored token or null
   */
  getSyncToken(accountId: string | number, folder: string): string | null;

  /**
   * Store sync token for a folder.
   *
   * @param accountId - Account ID
   * @param folder - Folder path
   * @param token - Token to store
   */
  setSyncToken(accountId: string | number, folder: string, token: string): void;

  // ============== Sync Control ==============

  /**
   * Cancel any in-progress sync.
   *
   * @param accountId - Account ID (optional, cancels all if omitted)
   */
  cancelSync(accountId?: string | number): void;

  /**
   * Reset sync state for an account.
   * Clears all sync tokens and folder states.
   *
   * @param accountId - Account ID
   */
  resetSyncState(accountId: string | number): void;
}
