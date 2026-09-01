/**
 * Folder Operations Interface
 *
 * IMAP folder management contracts.
 * Handles folder listing, navigation, and folder-level operations.
 *
 * @since 2.0.0
 */

/**
 * IMAP folder representation.
 */
export interface ConsolidatedSourceFolder {
  /** Email account ID that owns this physical folder */
  accountId: number;
  /** Physical IMAP folder path for this account */
  path: string;
  /** Physical folder display name for this account */
  name: string;
}

/** Stable provider folder identity used by navigation and message mutations. */
export interface FolderTarget {
  accountId: number;
  folderId: number | null;
  path: string;
}

export interface ImapFolder {
  /** Stable folder record ID when available */
  id?: number | null;
  /** Folder display name */
  name: string;
  /** Full IMAP folder path */
  path: string;
  /** Email account that owns this provider folder */
  accountId?: number;
  /** Canonical IMAP folder path from backend overlay */
  imapPath?: string;
  /** Canonical IMAP folder path from backend overlay (legacy key) */
  imap_path?: string;
  /** Total message count */
  count: number;
  /** Unseen/unread message count */
  unseen?: number;
  /** Child folders (for nested structures) */
  children?: ImapFolder[];
  /** Folder attributes from IMAP */
  attributes?: string[];
  /** Provider hierarchy delimiter when authoritative */
  delimiter?: string | null;
  /** Whether delimiter evidence is authoritative, explicitly NIL, or unknown */
  delimiterState?: "value" | "nil" | "unknown";
  /** Authoritative namespace prefix */
  namespacePrefix?: string | null;
  /** Provider namespace evidence state */
  namespaceState?: "authoritative" | "unsupported" | "unknown";
  /** Exact raw provider parent path */
  parentPath?: string | null;
  /** Whether provider discovery observed children */
  hasChildren?: boolean;
  /** Whether Core permits creating a child below this node */
  canHaveChildren?: boolean;
  /** Whether this row came from LIST or a derived structural ancestor */
  source?: "provider" | "synthetic";
  /** Whether folder is selectable */
  selectable?: boolean;
  /** Whether the folder is a provider/system folder */
  isSystem?: boolean;
  /** Folder type from the overlay model */
  type?: string;
  /** Parent folder record ID */
  parentId?: number | null;
  /** Parent folder record ID (legacy key) */
  parent_id?: number | null;
  /** Custom icon from the overlay model */
  icon?: string | null;
  /** Custom color from the overlay model */
  color?: string | null;
  /** System folder type if applicable */
  systemType?: SystemFolderType;
  /** Account IDs included in this consolidated virtual folder */
  sourceAccountIds?: number[];
  /** Account-specific physical folders included in this consolidated folder */
  sourceFolders?: ConsolidatedSourceFolder[];
  /** Mirror sync phase for this folder (drives the per-folder syncing loader) */
  syncPhase?: SyncPhase;
  /**
   * Account-level connection health projected onto the folder. `auth_error`
   * means the owning account is permanently failed and cannot sync until it is
   * re-authed, surfaced as a sync error, not a spinner.
   */
  healthState?: string;
  /** Messages already mirrored locally for this folder */
  mirroredCount?: number;
  /** Authoritative server message total for this folder */
  messageCount?: number;
  /** Backfill progress 0-100 while the folder is still mirroring */
  backfillProgress?: number;
  /** Provider-side creation status for newly-created folders */
  createStatus?: "queued" | "running" | "done" | "failed";
  /** Provider-side creation error when createStatus is failed */
  createError?: string | null;
  /** Whether provider-side folder creation is still queued/running */
  queued?: boolean;
  /**
   * Cross-account destination for consolidated move targets. Present on
   * synthetic union entries built for the combined inbox (see
   * `lib/folder-destination.ts`); when set, mutations send the destination
   * union instead of an account-bound FolderTarget or a literal path.
   */
  consolidatedDestination?: import("@/lib/folder-destination").FolderDestination;
}

/**
 * Mirror sync phase for a folder. Foreground UI loaders only use `bootstrap`
 * (no usable rows yet); `backfill` and `stale` are background/cache phases.
 */
export type SyncPhase =
  | "bootstrap"
  | "backfill"
  | "steady"
  | "stale"
  | "degraded";

/**
 * Standard system folder types.
 */
export type SystemFolderType =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash"
  | "archive"
  | "spam"
  | "junk"
  | "flagged"
  | "starred"
  | "important"
  | "outbox"
  | "scheduled"
  | "snoozed"
  | "templates";

/**
 * Result of a folder operation.
 */
export interface FolderResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** The folder data (if applicable) */
  folder?: ImapFolder;
  /** Whether provider-side folder creation is queued/running */
  queued?: boolean;
  /** Error message if operation failed */
  error?: string;
}

/** Bounded authoritative count for one virtual flag view. */
export interface VirtualFlagCount {
  count: number;
  partial: boolean;
}

/** Important and Starred counts supplied by the folder-list snapshot. */
export interface VirtualFolderCounts {
  important: VirtualFlagCount;
  starred: VirtualFlagCount;
}

/**
 * Result of loading folder list.
 */
export interface FolderListResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** List of folders */
  folders: ImapFolder[];
  /** Nested representation containing the same stable provider nodes */
  folderTree?: ImapFolder[];
  /** Error message if operation failed */
  error?: string;
  /** Whether data came from cache */
  fromCache?: boolean;
  /** Whether the error was an authentication error (circuit breaker) */
  authError?: boolean;
}

/**
 * Options for creating a folder.
 */
export interface CreateFolderOptions {
  /** Folder name */
  name: string;
  /** Stable parent folder record ID. Preferred over legacy parentPath. */
  parentId?: number | null;
  /** Parent folder path (optional, creates at root if omitted) */
  parentPath?: string;
}

/**
 * IFolderOperations Interface
 *
 * IMAP folder management operations.
 * Provides consistent folder navigation across all layouts.
 */
export interface IFolderOperations {
  // ============== State Accessors ==============

  /** Current list of IMAP folders */
  readonly folders: ImapFolder[];

  /** Currently selected folder path */
  readonly selectedFolder: string;

  /** Whether folders are loading */
  readonly isLoading: boolean;

  /** Flattened list of all folders (for search/autocomplete) */
  readonly flatFolderList: ImapFolder[];

  /** Authoritative, de-duplicated virtual flag counts for the active scope. */
  readonly virtualFolderCounts: VirtualFolderCounts;

  // ============== Core Operations ==============

  /**
   * Load folders for an account.
   *
   * @param accountId - Account ID
   * @param forceRefresh - Force refresh from server
   * @returns Folder list result
   */
  loadFolders(
    accountId: string | number,
    forceRefresh?: boolean,
  ): Promise<FolderListResult>;

  /**
   * Load and merge folders for a consolidated account selection.
   *
   * @param accountIds - Selected account IDs
   * @param forceRefresh - Force refresh from server
   * @returns Merged folder list result
   */
  loadConsolidatedFolders(
    accountIds: number[],
    forceRefresh?: boolean,
  ): Promise<FolderListResult>;

  /**
   * Select a folder for viewing.
   * This updates the selected folder state and may trigger message loading.
   *
   * @param folderPath - IMAP folder path
   */
  selectFolder(folderPath: string): Promise<void>;

  /**
   * Get a system folder by type.
   * Handles provider-specific folder names (e.g., Gmail's "[Gmail]/Sent Mail").
   *
   * @param type - System folder type
   * @returns The folder or undefined if not found
   */
  getSystemFolder(type: SystemFolderType): ImapFolder | undefined;

  /**
   * Get a folder by its path.
   *
   * @param path - IMAP folder path
   * @returns The folder or undefined if not found
   */
  getFolderByPath(path: string): ImapFolder | undefined;

  // ============== Folder Management ==============

  /**
   * Create a new folder.
   *
   * @param accountId - Account ID
   * @param options - Create options including name and parent
   * @returns Folder result with created folder
   */
  createFolder(
    accountId: string | number,
    options: CreateFolderOptions,
  ): Promise<FolderResult>;

  /**
   * Rename a folder.
   *
   * @param accountId - Account ID
   * @param path - Current folder path
   * @param newName - New folder name
   * @returns Folder result with renamed folder
   */
  renameFolder(
    accountId: string | number,
    path: string,
    newName: string,
    parentId?: number | null,
  ): Promise<FolderResult>;

  /**
   * Delete a folder.
   *
   * @param accountId - Account ID
   * @param path - Folder path to delete
   * @returns Operation result
   */
  deleteFolder(accountId: string | number, path: string): Promise<FolderResult>;

  // ============== Folder Utilities ==============

  /**
   * Get the unread count for a folder.
   *
   * @param path - Folder path
   * @returns Unread count or undefined if not available
   */
  getUnreadCount(path: string): number | undefined;

  /**
   * Refresh folder counts (unread, total) from server.
   *
   * @param accountId - Account ID
   * @param paths - Optional specific paths to refresh (all if omitted)
   */
  refreshCounts(accountId: string | number, paths?: string[]): Promise<void>;

  /**
   * Check if a folder path is a system folder.
   *
   * @param path - Folder path
   * @returns True if this is a system folder
   */
  isSystemFolder(path: string): boolean;

  /**
   * Normalize a folder path for comparison.
   * Handles case-insensitivity and trailing separators.
   *
   * @param path - Folder path
   * @returns Normalized path
   */
  normalizePath(path: string): string;
}
