/**
 * Inbox Context
 *
 * Lean React context that composes service layer for inbox operations.
 * Provides consistent inbox functionality across all layout variants.
 *
 * @since 2.0.0
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  EmailMessage,
  EmailAccount,
  EmailThreadGroupMap,
  GroupedMessage,
  ComposeReplySource,
} from "@/types";
import type {
  IInboxOperations,
  IMessageOperations,
  IFolderOperations,
  ISearchService,
  ISyncService,
  ICacheService,
  IThreadingService,
  IConnectionStateService,
  ConnectionHealth,
  LoadMessagesOptions,
  LoadMessagesResult,
  OperationResult,
  BatchOperationResult,
  MessageFilters,
  ImapFolder,
  FolderListResult,
  FolderResult,
  CreateFolderOptions,
  VirtualFolderCounts,
  SearchResult,
  SearchOptions,
  FolderTarget,
} from "@/services/interfaces";
import type { IPrefetchService } from "@/services/interfaces";
import {
  getCacheService,
  getThreadingService,
  getMessageService,
  getFolderService,
  getInboxService,
  getSearchService,
  getSyncService,
  getPrefetchService,
  getConnectionStateService,
} from "@/services/implementations";
import { refreshAccountSync } from "@/services/sync-driver.service";
import { useAppContext } from "./AppProvider";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { getSelectedFolder } from "@/lib/folder-persistence";
import { getUserPreferencesSnapshot } from "@/hooks/useUserPreferences";
import { markAsReadDelayMs } from "@/lib/preference-behavior";
import {
  buildConsolidatedAccountScopeKey,
  getAccountNumericId,
  getEffectiveConsolidatedAccountIdsForLayout,
} from "@/lib/consolidated-account-scope";
import { useLayout } from "@/components/layouts";
import { getConsolidatedFolderMapForPath } from "@/lib/consolidated-folder-map";
import { type ConsolidatedAccountReadiness } from "@/lib/consolidated-account-readiness";
import {
  markMessageImportant,
  performToggleImportant,
} from "@/services/smart-inbox/important";
import {
  clearPaneSelection,
  savePaneSelection,
} from "@/lib/open-pane-persistence";
import { matchesMessageById } from "@/lib/consolidated-message-match";
import {
  getMessageIdentityKey,
  parseAccountQualifiedToken,
} from "@/lib/message-identity";
import {
  buildPerAccountPathDestination,
  isDestinationMutationTarget,
  type DestinationMutationTarget,
} from "@/lib/folder-destination";
import type { MutationTarget } from "@/lib/folder-target";

type MessageIdentifierMode = "uid" | "msg_no";

const matchesMessageId = matchesMessageById;

/**
 * Group message IDs by their accountId for per-account batch operations.
 * Returns a Map of accountId → array of original message UIDs (not consolidatedUids).
 */
interface GroupedMessageRef {
  /** Original UID for the server API call */
  apiId: string | number;
  /** consolidatedUid (or fallback) for local state updates via updateMessage/removeMessage */
  localId: string | number;
  /** Folder context for the IMAP mutation */
  folder: string;
  /** Legacy message number compatibility fallback */
  msgNo?: string | number;
  /** Primary identifier mode for the server payload */
  identifierMode: MessageIdentifierMode;
}

interface ResolvedMessageRef extends GroupedMessageRef {
  /** Account owning the message */
  accountId: string | number | null;
}

interface GroupedMailboxMessageRefs {
  accountId: string | number;
  folder: string;
  identifierMode: MessageIdentifierMode;
  refs: GroupedMessageRef[];
}

function resolveMessageRef(
  messageId: string | number,
  messages: EmailMessage[],
  fallbackAccountId: string | number | null,
  fallbackFolder: string,
  folderForAccount?: (accountId: number) => string,
): ResolvedMessageRef {
  const message = messages.find((candidate) =>
    matchesMessageId(candidate, messageId),
  );

  // Cross-page selection in consolidated mode: the row is no longer loaded but
  // its identity key carries the account + uid, synthesize the ref instead of
  // failing with "No account selected". (Rows identified only by mirror-row id
  // stay unresolvable here; batch endpoints address uids.)
  if (!message && typeof messageId === "string") {
    const parsed = parseAccountQualifiedToken(messageId);
    if (parsed?.uid) {
      return {
        accountId: parsed.accountId,
        apiId: parsed.uid,
        localId: messageId,
        folder: folderForAccount?.(parsed.accountId) ?? fallbackFolder,
        msgNo: undefined,
        identifierMode: "uid",
      };
    }
  }

  const apiId = message?.uid ?? message?.msg_no ?? message?.id ?? messageId;

  return {
    accountId: message?.accountId ?? fallbackAccountId,
    apiId,
    localId: messageId,
    folder: message?.folder ?? fallbackFolder,
    msgNo: message?.msg_no,
    identifierMode: message?.uid !== undefined ? "uid" : "msg_no",
  };
}

function resolveReplySourceRef(
  source: ComposeReplySource,
): ResolvedMessageRef | null {
  const parsed = parseAccountQualifiedToken(source.identity);
  const sourceAccountId = source.accountId ?? parsed?.accountId;
  const uid = source.uid ?? parsed?.uid;
  const msgNo = source.msgNo;

  if (
    parsed &&
    source.accountId !== undefined &&
    Number(source.accountId) !== parsed.accountId
  ) {
    return null;
  }

  const accountId = sourceAccountId;
  const apiId = uid ?? msgNo;
  const folder = source.folder?.trim();
  if (
    !accountId ||
    !folder ||
    apiId === undefined ||
    apiId === null ||
    apiId === ""
  ) {
    return null;
  }

  return {
    accountId,
    apiId,
    localId: source.identity,
    folder,
    msgNo,
    identifierMode: uid !== undefined ? "uid" : "msg_no",
  };
}

function groupByMailboxContext(
  messageIds: (string | number)[],
  messages: EmailMessage[],
  fallbackAccountId: string | number | null,
  fallbackFolder: string,
  folderForAccount?: (accountId: number) => string,
): {
  groups: GroupedMailboxMessageRefs[];
  unmatchedIds: (string | number)[];
} {
  const grouped = new Map<string, GroupedMailboxMessageRefs>();
  const unmatchedIds: (string | number)[] = [];

  for (const id of messageIds) {
    const ref = resolveMessageRef(
      id,
      messages,
      fallbackAccountId,
      fallbackFolder,
      folderForAccount,
    );
    if (!ref.accountId) {
      unmatchedIds.push(id);
      continue;
    }

    const key = `${String(ref.accountId)}::${ref.folder}::${ref.identifierMode}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.refs.push(ref);
      continue;
    }

    grouped.set(key, {
      accountId: ref.accountId,
      folder: ref.folder,
      identifierMode: ref.identifierMode,
      refs: [ref],
    });
  }

  return {
    groups: Array.from(grouped.values()),
    unmatchedIds,
  };
}

/**
 * Per-account source-folder resolver for a merged consolidated folder: the
 * requested view path may be another account's physical path (e.g. Gmail
 * "[Gmail]/Trash" while this account uses "Deleted Items").
 */
function makeAccountFolderResolver(
  getFolderByPath: (path: string) => ImapFolder | undefined,
  fallbackFolder: string,
): (accountId: number) => string {
  const record = getFolderByPath(fallbackFolder);
  return (accountId: number): string =>
    record?.sourceFolders?.find(
      (source) => Number(source.accountId) === accountId,
    )?.path ?? fallbackFolder;
}

/** Bare role tokens the server role-aliases per account. */
const SYSTEM_ROLE_FALLBACK_TOKENS: Record<string, string> = {
  trash: "Trash",
  spam: "Junk",
  junk: "Junk",
  archive: "Archive",
  inbox: "INBOX",
};

/**
 * Resolve the requested move target for ONE account.
 *
 * - Destination targets are account-agnostic (the server resolves/creates per
 *   account) and pass through.
 * - An account-bound FolderTarget stays valid only for its own account,
 *   folder ids never cross accounts.
 * - A string path pointing at a merged consolidated folder remaps to this
 *   account's own source path; with no counterpart, system folders fall back
 *   to their role token and custom folders to a per-account destination the
 *   server creates. The old `?? targetPath` fallback silently sent the FIRST
 *   account's literal path, with auto-creation that would have created the
 *   wrong account's folder name on the wrong server.
 */
function resolveMutationTargetForAccount(
  targetFolder: MutationTarget,
  accountId: string | number,
  getFolderByPath: (path: string) => ImapFolder | undefined,
):
  | { ok: true; target: MutationTarget; path: string }
  | { ok: false; error: string } {
  if (isDestinationMutationTarget(targetFolder)) {
    return { ok: true, target: targetFolder, path: targetFolder.path };
  }

  if (typeof targetFolder !== "string") {
    if (Number(targetFolder.accountId) !== Number(accountId)) {
      return { ok: false, error: "Target folder belongs to another account" };
    }
    return { ok: true, target: targetFolder, path: targetFolder.path };
  }

  const record = getFolderByPath(targetFolder);
  const source = record?.sourceFolders?.find(
    (candidate) => Number(candidate.accountId) === Number(accountId),
  );
  if (source) {
    return { ok: true, target: source.path, path: source.path };
  }

  if (record?.sourceFolders?.length) {
    const roleToken = record.systemType
      ? SYSTEM_ROLE_FALLBACK_TOKENS[record.systemType]
      : undefined;
    if (roleToken) {
      return { ok: true, target: roleToken, path: roleToken };
    }

    const name = record.name || targetFolder;
    const destination: DestinationMutationTarget = {
      kind: "destination",
      destination: buildPerAccountPathDestination([name]),
      path: name,
    };
    return { ok: true, target: destination, path: destination.path };
  }

  return { ok: true, target: targetFolder, path: targetFolder };
}

function getFailedLocalIds(
  refs: GroupedMessageRef[],
  failedIds: (string | number)[],
): (string | number)[] {
  if (failedIds.length === 0) {
    return [];
  }

  const failedIdSet = new Set(failedIds.map((id) => String(id)));
  return refs
    .filter((ref) => failedIdSet.has(String(ref.apiId)))
    .map((ref) => ref.localId);
}

const SESSION_STARTED_AT_KEY = "pressedmail-session-started-at";
// Metadata polling consolidated into useInboxSurfaceBoot's 60-second sync interval.

function ensureSessionStartedAt(): number {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return Date.now();
  }

  const existing = window.sessionStorage.getItem(SESSION_STARTED_AT_KEY);
  if (existing) {
    const parsed = Number(existing);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const startedAt = Date.now();
  window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(startedAt));
  return startedAt;
}

function resolveFolderCount(
  folders: ImapFolder[],
  preferredPath: string,
): number {
  const normalizedPreferred = preferredPath.toLowerCase();
  const preferred = folders.find(
    (folder) =>
      folder.path.toLowerCase() === normalizedPreferred ||
      folder.name.toLowerCase() === normalizedPreferred,
  );

  if (preferred && Number.isFinite(preferred.count)) {
    return Math.max(0, preferred.count);
  }

  const inboxFolder = folders.find(
    (folder) =>
      folder.path.toUpperCase() === "INBOX" || folder.name === "Inbox",
  );

  if (inboxFolder && Number.isFinite(inboxFolder.count)) {
    return Math.max(0, inboxFolder.count);
  }

  return 0;
}

function getMessageIdsFromMessages(messages: EmailMessage[]): string[] {
  return messages.map(getMessageIdentityKey).filter((id) => id !== "");
}

/**
 * Inbox context value interface.
 */
export interface InboxContextValue {
  // ============== Services ==============
  /** Cache service instance */
  cache: ICacheService;
  /** Threading service instance */
  threading: IThreadingService;
  /** Prefetch service instance */
  prefetch: IPrefetchService;

  // ============== Account State ==============
  /** Currently selected account ID */
  selectedAccountId: string | number | null;
  /** Set the selected account */
  setSelectedAccountId: (id: string | number | null) => void;

  // ============== Inbox Operations ==============
  /** Current messages (filtered if filters active) */
  messages: EmailMessage[];
  /** Messages grouped by thread/category */
  groupedMessages: GroupedMessage[];
  /** Server-provided thread messages keyed by thread id. */
  threadGroups: EmailThreadGroupMap;
  /** Whether messages are loading */
  isLoading: boolean;
  /** Whether loading more messages (pagination) */
  isLoadingMore: boolean;
  /** Whether more messages are available */
  hasMore: boolean;
  /** Total message count */
  totalCount: number;
  /** Per-account readiness for the combined inbox (empty for single-mailbox). */
  consolidatedAccountReadiness: ConsolidatedAccountReadiness[];
  /** Whether a message detail is loading */
  isMessageDetailLoading: boolean;
  /**
   * The selected message's body is still being assembled server-side (bodyState:'pending') or
   * the live fetch hit its budget, the reading pane shows a "taking longer" retry affordance
   * instead of a false "No content".
   */
  detailBodyPending: boolean;
  /**
   * The selected message's detail fetch hard-failed (e.g. a config_error/auth_failed account whose
   * body fetch always errors), the reading pane shows a distinct "couldn't load this message"
   * error branch with Retry instead of a false "No content".
   */
  detailBodyError: boolean;
  /** Manually re-fetch a pending or failed message body (the "Retry" affordance). */
  retryMessageDetail: () => void;
  /** Currently selected message */
  selectedMessage: EmailMessage | null;
  /** Load messages for an account */
  loadMessages: (options: LoadMessagesOptions) => Promise<LoadMessagesResult>;
  /** Load a page for bulk work without replacing the visible message list */
  loadMessagesSnapshot: (
    options?: Partial<LoadMessagesOptions>,
  ) => Promise<LoadMessagesResult>;
  /** Load more messages (pagination) */
  loadMore: () => Promise<LoadMessagesResult>;
  /** Load an exact page for the current account/folder context */
  loadPage: (page: number, pageSize?: number) => Promise<LoadMessagesResult>;
  /** Refresh messages from server */
  refreshMessages: () => Promise<void>;
  /** Drop cached pages for a folder so its next open refetches fresh */
  invalidateFolderMessages: (folder: string) => void;
  /** Select a message for viewing */
  selectMessage: (message: EmailMessage | null) => Promise<void>;
  /** Clear message selection */
  clearSelection: () => void;

  // ============== Message Operations ==============
  /** Mark a message as read */
  markAsRead: (messageId: string | number) => Promise<OperationResult>;
  /** Mark a message as unread */
  markAsUnread: (messageId: string | number) => Promise<OperationResult>;
  /** Toggle star on a message */
  toggleStar: (messageId: string | number) => Promise<OperationResult>;
  /** Fetch the full raw RFC822 headers for a message (View headers dialog) */
  getRawHeaders: (
    messageId: string | number,
  ) => Promise<{ success: boolean; headers?: string; error?: string }>;
  /** Toggle user-controlled importance on a message */
  toggleImportant: (messageId: string | number) => Promise<OperationResult>;
  /** Delete a message */
  deleteMessage: (
    messageId: string | number,
    permanent?: boolean,
  ) => Promise<OperationResult>;
  /** Move a message to another folder */
  moveMessage: (
    messageId: string | number,
    targetFolder: MutationTarget,
  ) => Promise<OperationResult>;
  /** Archive a message */
  archiveMessage: (
    messageId: string | number,
    replySource?: ComposeReplySource,
  ) => Promise<OperationResult>;
  /** Batch mark as read */
  batchMarkRead: (
    messageIds: (string | number)[],
  ) => Promise<BatchOperationResult>;
  /** Batch mark as read for provided message objects */
  batchMarkReadMessages: (
    messages: EmailMessage[],
  ) => Promise<BatchOperationResult>;
  /** Batch mark as unread */
  batchMarkUnread: (
    messageIds: (string | number)[],
  ) => Promise<BatchOperationResult>;
  /** Batch mark as unread for provided message objects */
  batchMarkUnreadMessages: (
    messages: EmailMessage[],
  ) => Promise<BatchOperationResult>;
  /** Batch delete */
  batchDelete: (
    messageIds: (string | number)[],
    permanent?: boolean,
  ) => Promise<BatchOperationResult>;
  /** Batch delete provided message objects */
  batchDeleteMessages: (
    messages: EmailMessage[],
    permanent?: boolean,
  ) => Promise<BatchOperationResult>;
  /** Batch move */
  batchMove: (
    messageIds: (string | number)[],
    targetFolder: MutationTarget,
  ) => Promise<BatchOperationResult>;
  /** Batch move provided message objects */
  batchMoveMessages: (
    messages: EmailMessage[],
    targetFolder: MutationTarget,
  ) => Promise<BatchOperationResult>;
  /** Empty the current Trash folder */
  emptyTrash: (folder?: string) => Promise<BatchOperationResult>;

  // ============== Folder Operations ==============
  /** Current folders */
  folders: ImapFolder[];
  /** Authoritative Important/Starred totals for the active mailbox scope. */
  virtualFolderCounts: VirtualFolderCounts;
  /** Currently selected folder */
  selectedFolder: string;
  /** Whether folders are loading */
  isFoldersLoading: boolean;
  /** Load folders for an account */
  loadFolders: (
    accountId: string | number,
    forceRefresh?: boolean,
  ) => Promise<FolderListResult>;
  /** Load and merge folders for selected accounts in consolidated mode */
  loadConsolidatedFolders: (
    accountIds: number[],
    forceRefresh?: boolean,
  ) => Promise<FolderListResult>;
  /** Reload the folder list for the CURRENT scope (single or combined) */
  refreshCurrentFolders: () => Promise<void>;
  /** Select a folder */
  selectFolder: (folderPath: string) => Promise<void>;
  /** Get inbox folder */
  getInboxFolder: () => ImapFolder;
  /** Get trash folder */
  getTrashFolder: () => ImapFolder | undefined;
  /** Get folders suitable for move operations */
  getMoveTargetFolders: () => ImapFolder[];
  /** Create a new folder */
  createFolder: (
    accountId: string | number,
    options: CreateFolderOptions,
  ) => Promise<FolderResult>;
  /** Rename a folder */
  renameFolder: (
    accountId: string | number,
    path: string,
    newName: string,
    parentId?: number | null,
  ) => Promise<FolderResult>;
  /** Delete a folder */
  deleteFolder: (
    accountId: string | number,
    path: string,
  ) => Promise<FolderResult>;

  // ============== Filtering ==============
  /** Active filters */
  activeFilters: MessageFilters;
  /** Apply filters to message list */
  applyFilters: (filters: MessageFilters) => void;
  /** Clear all filters */
  clearFilters: () => void;
  /** Get all unique labels */
  getAllLabels: () => string[];

  // ============== Search ==============
  /** Current search term */
  searchTerm: string;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Set search term */
  setSearchTerm: (term: string) => void;
  /** Perform server search */
  search: (query: string, options?: SearchOptions) => Promise<SearchResult>;
  /** Search messages locally */
  searchLocal: (term: string) => EmailMessage[];
  /** Clear search */
  clearSearch: () => void;
  /** Get recent searches */
  getRecentSearches: () => string[];

  // ============== Error State ==============
  /** Error message from initialization or operations */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
  /** Retry initialization (clears error and re-triggers init effect) */
  retryInit: () => void;

  // ============== Connection Health ==============
  /** Per-account connection health states */
  connectionHealth: ReadonlyMap<string, ConnectionHealth>;
  /** Reset health for an account (user-initiated retry) */
  resetAccountHealth: (accountId: string) => void;
}

/**
 * Default context value (throws if used outside provider).
 */
const defaultContextValue: InboxContextValue = {
  cache: null as unknown as ICacheService,
  threading: null as unknown as IThreadingService,
  prefetch: null as unknown as IPrefetchService,
  selectedAccountId: null,
  setSelectedAccountId: () => {
    throw new Error("InboxContext not initialized");
  },
  messages: [],
  groupedMessages: [],
  threadGroups: {},
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  totalCount: 0,
  consolidatedAccountReadiness: [],
  isMessageDetailLoading: false,
  detailBodyPending: false,
  detailBodyError: false,
  retryMessageDetail: () => {},
  selectedMessage: null,
  loadMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  loadMessagesSnapshot: async () => {
    throw new Error("InboxContext not initialized");
  },
  loadMore: async () => {
    throw new Error("InboxContext not initialized");
  },
  loadPage: async () => {
    throw new Error("InboxContext not initialized");
  },
  refreshMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  invalidateFolderMessages: () => {},
  selectMessage: async () => {
    throw new Error("InboxContext not initialized");
  },
  clearSelection: () => {
    throw new Error("InboxContext not initialized");
  },
  markAsRead: async () => {
    throw new Error("InboxContext not initialized");
  },
  markAsUnread: async () => {
    throw new Error("InboxContext not initialized");
  },
  toggleStar: async () => {
    throw new Error("InboxContext not initialized");
  },
  getRawHeaders: async () => {
    throw new Error("InboxContext not initialized");
  },
  toggleImportant: async () => {
    throw new Error("InboxContext not initialized");
  },
  deleteMessage: async () => {
    throw new Error("InboxContext not initialized");
  },
  moveMessage: async () => {
    throw new Error("InboxContext not initialized");
  },
  archiveMessage: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMarkRead: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMarkReadMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMarkUnread: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMarkUnreadMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchDelete: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchDeleteMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMove: async () => {
    throw new Error("InboxContext not initialized");
  },
  batchMoveMessages: async () => {
    throw new Error("InboxContext not initialized");
  },
  emptyTrash: async () => {
    throw new Error("InboxContext not initialized");
  },
  folders: [],
  virtualFolderCounts: {
    important: { count: 0, partial: false },
    starred: { count: 0, partial: false },
  },
  selectedFolder: "INBOX",
  isFoldersLoading: false,
  loadFolders: async () => {
    throw new Error("InboxContext not initialized");
  },
  loadConsolidatedFolders: async () => {
    throw new Error("InboxContext not initialized");
  },
  refreshCurrentFolders: async () => {
    throw new Error("InboxContext not initialized");
  },
  selectFolder: async () => {
    throw new Error("InboxContext not initialized");
  },
  getInboxFolder: () => {
    throw new Error("InboxContext not initialized");
  },
  getTrashFolder: () => {
    throw new Error("InboxContext not initialized");
  },
  getMoveTargetFolders: () => {
    throw new Error("InboxContext not initialized");
  },
  createFolder: async () => {
    throw new Error("InboxContext not initialized");
  },
  renameFolder: async () => {
    throw new Error("InboxContext not initialized");
  },
  deleteFolder: async () => {
    throw new Error("InboxContext not initialized");
  },
  activeFilters: {},
  applyFilters: () => {
    throw new Error("InboxContext not initialized");
  },
  clearFilters: () => {
    throw new Error("InboxContext not initialized");
  },
  getAllLabels: () => {
    throw new Error("InboxContext not initialized");
  },
  searchTerm: "",
  isSearching: false,
  setSearchTerm: () => {
    throw new Error("InboxContext not initialized");
  },
  search: async () => {
    throw new Error("InboxContext not initialized");
  },
  searchLocal: () => {
    throw new Error("InboxContext not initialized");
  },
  clearSearch: () => {
    throw new Error("InboxContext not initialized");
  },
  getRecentSearches: () => {
    throw new Error("InboxContext not initialized");
  },
  error: null,
  clearError: () => {
    throw new Error("InboxContext not initialized");
  },
  retryInit: () => {
    throw new Error("InboxContext not initialized");
  },
  connectionHealth: new Map(),
  resetAccountHealth: () => {
    throw new Error("InboxContext not initialized");
  },
};

/**
 * Inbox context.
 */
export const InboxContext =
  createContext<InboxContextValue>(defaultContextValue);

/**
 * Props for InboxProvider.
 */
export interface InboxProviderProps {
  children: ReactNode;
  /** Initial account ID (optional) */
  initialAccountId?: string | number;
}

/**
 * Inbox Provider Component
 *
 * Initializes and provides all inbox services to the component tree.
 */
export function InboxProvider({
  children,
  initialAccountId,
}: InboxProviderProps): React.JSX.Element {
  // ============== Service Initialization ==============
  const connectionState = useMemo(() => getConnectionStateService(), []);
  const cache = useMemo(() => getCacheService(), []);
  const threading = useMemo(() => getThreadingService(), []);
  const messageService = useMemo(
    () => getMessageService(cache, connectionState),
    [cache, connectionState],
  );
  const folderService = useMemo(
    () => getFolderService(cache, connectionState),
    [cache, connectionState],
  );
  const inboxService = useMemo(
    () => getInboxService(cache, threading, connectionState),
    [cache, threading, connectionState],
  );
  const prefetchService = useMemo(
    () => getPrefetchService(cache, connectionState),
    [cache, connectionState],
  );
  const searchService = useMemo(() => getSearchService(), []);
  const syncService = useMemo(() => getSyncService(), []);

  // ============== useSyncExternalStore Subscriptions ==============
  // These replace the old forceUpdate/triggerUpdate pattern.
  // Each subscription triggers a re-render only when that service's state changes.
  const inboxSubscribe = useCallback(
    (cb: () => void) => inboxService.subscribe(cb),
    [inboxService],
  );
  const inboxSnapshot = useCallback(
    () => inboxService.getSnapshot(),
    [inboxService],
  );
  const inboxVersion = useSyncExternalStore(inboxSubscribe, inboxSnapshot);

  const folderSubscribe = useCallback(
    (cb: () => void) => folderService.subscribe(cb),
    [folderService],
  );
  const folderSnapshot = useCallback(
    () => folderService.getSnapshot(),
    [folderService],
  );
  const folderVersion = useSyncExternalStore(folderSubscribe, folderSnapshot);

  const connectionSubscribe = useCallback(
    (cb: () => void) => connectionState.subscribe(cb),
    [connectionState],
  );
  const connectionSnapshot = useCallback(
    () => connectionState.getSnapshot(),
    [connectionState],
  );
  const connectionVersion = useSyncExternalStore(
    connectionSubscribe,
    connectionSnapshot,
  );

  // ============== Local State ==============
  const [selectedAccountId, setSelectedAccountId] = useState<
    string | number | null
  >(initialAccountId ?? null);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isDetailFetching, setIsDetailFetching] = useState(false);
  // The selected message's body is still being assembled server-side (bodyState:'pending')
  // or the live fetch hit its budget, the reading pane shows a "taking longer" retry
  // affordance instead of a false "No content". Cleared once the body loads (or fails hard).
  const [detailBodyPending, setDetailBodyPending] = useState(false);
  // The selected message's detail fetch hard-failed (non-timeout error or error-envelope response
  // e.g. a config_error/auth_failed account). The reading pane shows a distinct error branch with
  // Retry instead of a false "No content". Cleared on a new selection or a successful (re)fetch.
  const [detailBodyError, setDetailBodyError] = useState(false);
  // The in-flight pending/failed detail request, so retryMessageDetail() (and the single automatic
  // re-poll) can re-run exactly the same fetch.
  const pendingDetailRef = useRef<{
    accountId: string;
    folder: string;
    msgId: string | number;
    updateId: string | number;
  } | null>(null);
  const detailRepollTimerRef = useRef<number | null>(null);
  const markAsReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMarkAsReadTimer = useCallback(() => {
    if (markAsReadTimerRef.current !== null) {
      clearTimeout(markAsReadTimerRef.current);
      markAsReadTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearMarkAsReadTimer, [clearMarkAsReadTimer]);

  // Feed the circuit breaker from the backend's folder-payload health so the
  // client's connection state agrees with the server WITHOUT waiting for a
  // request to fail: a permanently auth-failed account is projected onto every
  // folder as healthState 'auth_error'. Scoped to the selected single account
  // (the consolidated view is fed by the per-request failure path).
  useEffect(() => {
    const accountIdStr =
      selectedAccountId != null ? String(selectedAccountId) : null;
    if (!accountIdStr || accountIdStr === "consolidated") return;

    const folders = folderService.folders;
    if (!Array.isArray(folders) || folders.length === 0) return;

    const authFailed = folders.some(
      (f) => (f as { healthState?: string }).healthState === "auth_error",
    );
    connectionState.applyServerHealth(
      accountIdStr,
      authFailed ? "auth_failed" : "ok",
    );
    // folderVersion is the reactive trigger for folderService.folders changes.
  }, [folderVersion, selectedAccountId, connectionState, folderService]);

  // ============== Initialization from AppProvider ==============
  const {
    selectedAccount,
    accounts,
    setUser,
    setNumberOfMessages,
    setSelectedMessage,
    selectedConsolidatedAccountIds,
    defaultAccountId,
  } = useAppContext();
  const { currentLayout } = useLayout();

  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const initializedAccountRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const isConsolidatedMode = selectedAccount === CONSOLIDATED_INBOX_VALUE;
  const effectiveConsolidatedAccountIds = useMemo(
    () =>
      isConsolidatedMode
        ? getEffectiveConsolidatedAccountIdsForLayout(
            accounts,
            selectedConsolidatedAccountIds,
            defaultAccountId,
            currentLayout,
          )
        : [],
    [
      accounts,
      currentLayout,
      isConsolidatedMode,
      selectedConsolidatedAccountIds,
      defaultAccountId,
    ],
  );
  const consolidatedScopeKey = useMemo(
    () => buildConsolidatedAccountScopeKey(effectiveConsolidatedAccountIds),
    [effectiveConsolidatedAccountIds],
  );

  // Debounced sidebar unread-count refresh. Marking messages read/unread now
  // updates the mirror + the stored folder unread count server-side; re-pull the
  // folder list (single or consolidated) shortly after so the sidebar badge
  // reflects the change without waiting for the 60s poll. Debounced so a burst
  // of reads (e.g. opening several messages) coalesces into one refresh.
  const folderCountRefreshTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const scheduleFolderCountRefresh = useCallback(() => {
    if (folderCountRefreshTimerRef.current) {
      clearTimeout(folderCountRefreshTimerRef.current);
    }
    folderCountRefreshTimerRef.current = setTimeout(() => {
      folderCountRefreshTimerRef.current = null;
      if (isConsolidatedMode) {
        if (effectiveConsolidatedAccountIds.length > 0) {
          void folderService.loadConsolidatedFolders(
            effectiveConsolidatedAccountIds,
            true,
          );
        }
      } else if (selectedAccountId) {
        void folderService.loadFolders(selectedAccountId, true);
      }
    }, 600);
  }, [
    folderService,
    isConsolidatedMode,
    effectiveConsolidatedAccountIds,
    selectedAccountId,
  ]);

  const mailboxScopeKey = isConsolidatedMode
    ? consolidatedScopeKey
    : selectedAccount;
  const mailboxServiceScopeKey = useMemo(() => {
    if (isConsolidatedMode) {
      return consolidatedScopeKey;
    }

    const account = accounts.find(
      (item) => item.email?.toString() === selectedAccount,
    );
    const accountId = Number(account?.id);

    return Number.isFinite(accountId) ? accountId : selectedAccount;
  }, [accounts, consolidatedScopeKey, isConsolidatedMode, selectedAccount]);
  const primaryConsolidatedAccount = useMemo(() => {
    if (!isConsolidatedMode) {
      return null;
    }

    const primaryId = effectiveConsolidatedAccountIds[0];
    return (
      accounts.find((account) => getAccountNumericId(account) === primaryId) ??
      null
    );
  }, [accounts, effectiveConsolidatedAccountIds, isConsolidatedMode]);

  // Reset services and clear init flag when account changes
  const prevAccountRef = useRef<string | null>(mailboxScopeKey);
  useLayoutEffect(() => {
    if (prevAccountRef.current === mailboxScopeKey) return;
    const wasNull = prevAccountRef.current === null;
    prevAccountRef.current = mailboxScopeKey;
    // Skip reset on initial setup (null → first account)
    if (wasNull || mailboxScopeKey === null) return;
    initializedAccountRef.current = null;
    setInitError(null);
    inboxService.switchContext(
      mailboxServiceScopeKey ?? mailboxScopeKey,
      "INBOX",
    );
    folderService.reset();
    syncService.softReset();
    prefetchService.cancelBackground();
    if (folderCountRefreshTimerRef.current) {
      clearTimeout(folderCountRefreshTimerRef.current);
      folderCountRefreshTimerRef.current = null;
    }
  }, [
    mailboxScopeKey,
    mailboxServiceScopeKey,
    inboxService,
    folderService,
    prefetchService,
    syncService,
  ]);

  // Sync InboxContext selectedMessage → AppProvider for global access
  useEffect(() => {
    const paneFolder =
      inboxService.selectedMessage?.folder ??
      folderService.selectedFolder ??
      inboxService.currentFolder ??
      "INBOX";

    if (mailboxScopeKey) {
      if (inboxService.selectedMessage) {
        savePaneSelection(
          mailboxScopeKey,
          paneFolder,
          inboxService.selectedMessage,
        );
      } else {
        clearPaneSelection(mailboxScopeKey, paneFolder);
      }
    }

    setSelectedMessage(inboxService.selectedMessage);
  }, [
    folderService.selectedFolder,
    inboxService.currentFolder,
    inboxService.selectedMessage,
    mailboxScopeKey,
    setSelectedMessage,
  ]);

  // Provider warmup effect: resolve account, warm folder metadata, and record the
  // session landing time once per browser session. Message list boot now happens
  // inside inbox surfaces so the provider can stay mounted outside the router.
  useEffect(() => {
    if (!selectedAccount || !mailboxScopeKey || accounts.length === 0) return;
    if (initializedAccountRef.current === mailboxScopeKey) return;

    const abortController = new AbortController();
    const isConsolidated = selectedAccount === CONSOLIDATED_INBOX_VALUE;

    const account = isConsolidated
      ? primaryConsolidatedAccount
      : accountsRef.current.find(
          (a) => a.email?.toString() === selectedAccount,
        );

    if (!account?.id) return;

    const numericId = Number(account.id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return;
    }

    initializedAccountRef.current = mailboxScopeKey;

    const accountIdStr = String(numericId);

    setSelectedAccountId(numericId);
    setUser({
      id: numericId,
      name: account.first_name ?? account.name ?? account.email,
      email: account.email,
      hasCompletedSetup: true,
    });

    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = ensureSessionStartedAt();
    }

    if (
      !connectionState.isHealthy(accountIdStr) &&
      connectionState.getHealth(accountIdStr).status === "unhealthy"
    ) {
      initializedAccountRef.current = null;
      setInitError(
        "This email account connection is unhealthy. Click retry to reconnect.",
      );
      return;
    }

    const initialize = async () => {
      if (isConsolidated) {
        const folderResult = await folderService.loadConsolidatedFolders(
          effectiveConsolidatedAccountIds,
          false,
        );
        if (abortController.signal.aborted) return;

        if (!folderResult.success) {
          if (folderResult.authError) {
            initializedAccountRef.current = null;
            setInitError(folderResult.error || "Failed to load folders");
          } else {
            if (folderResult.error?.includes("Account not found")) {
              initializedAccountRef.current = null;
            }
            setInitError(null);
          }
          return;
        }

        const persistedFolder = getSelectedFolder(mailboxScopeKey) ?? "INBOX";
        setNumberOfMessages(
          resolveFolderCount(folderResult.folders, persistedFolder),
        );
        setInitError(null);
        return;
      }

      const folderResult = await folderService.loadFolders(numericId, false);
      if (abortController.signal.aborted) return;

      if (!folderResult.success) {
        if (folderResult.authError) {
          initializedAccountRef.current = null;
          setInitError(folderResult.error || "Failed to load folders");
        } else {
          if (folderResult.error?.includes("Account not found")) {
            initializedAccountRef.current = null;
          }
          setInitError(null);
        }
        return;
      }

      const persistedFolder = getSelectedFolder(selectedAccount) ?? "INBOX";
      setNumberOfMessages(
        resolveFolderCount(folderResult.folders, persistedFolder),
      );
      setInitError(null);
    };

    initialize();

    return () => {
      abortController.abort();
      initializedAccountRef.current = null;
    };
  }, [
    selectedAccount,
    mailboxScopeKey,
    accounts.length,
    retryCount,
    connectionState,
    folderService,
    effectiveConsolidatedAccountIds,
    primaryConsolidatedAccount,
    setNumberOfMessages,
    setUser,
  ]);

  // Metadata polling (folder counts) is handled by useInboxSurfaceBoot's
  // 60-second sync interval. Removed the separate interval here to avoid
  // duplicate polling that caused racing API calls.

  // ============== Inbox Operations ==============
  const loadMessages = useCallback(
    async (options: LoadMessagesOptions): Promise<LoadMessagesResult> => {
      if (!options.silent) {
        setInitError(null);
      }

      const enrichedOptions =
        options.consolidated && !options.folderMap
          ? {
              ...options,
              sort:
                options.sort ??
                getUserPreferencesSnapshot().email_list_default_sort,
              folderMap: getConsolidatedFolderMapForPath(
                folderService.folders,
                options.folder ?? folderService.selectedFolder ?? "INBOX",
              ),
            }
          : {
              ...options,
              sort:
                options.sort ??
                getUserPreferencesSnapshot().email_list_default_sort,
            };

      const result = await inboxService.loadMessages(enrichedOptions);

      if (result.success) {
        setInitError(null);
        setNumberOfMessages(result.total);
        if (result.syncToken) {
          syncService.setSyncToken(
            enrichedOptions.accountId,
            enrichedOptions.folder ?? "INBOX",
            result.syncToken,
          );
        }
      } else if (
        result.error &&
        result.error !== "Request aborted" &&
        !options.silent
      ) {
        setInitError(result.error);
      }

      return result;
    },
    [folderService, inboxService, setNumberOfMessages, syncService],
  );

  const loadMessagesSnapshot = useCallback(
    async (
      options: Partial<LoadMessagesOptions> = {},
    ): Promise<LoadMessagesResult> => {
      const accountId =
        options.accountId ??
        (isConsolidatedMode
          ? consolidatedScopeKey
          : (selectedAccountId ?? inboxService.getCurrentAccountId()));
      if (!accountId) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Cannot load snapshot without an active account",
        };
      }

      const folder =
        options.folder ??
        folderService.selectedFolder ??
        inboxService.currentFolder ??
        "INBOX";
      const consolidated = options.consolidated ?? isConsolidatedMode;

      return inboxService.loadMessagesSnapshot({
        ...options,
        accountId,
        folder,
        consolidated,
        accountIds:
          options.accountIds ??
          (consolidated ? effectiveConsolidatedAccountIds : undefined),
        folderMap:
          options.folderMap ??
          (consolidated
            ? getConsolidatedFolderMapForPath(folderService.folders, folder)
            : undefined),
        grouping: options.grouping ?? inboxService.currentGrouping,
        sort:
          options.sort ?? getUserPreferencesSnapshot().email_list_default_sort,
      });
    },
    [
      consolidatedScopeKey,
      effectiveConsolidatedAccountIds,
      folderService,
      inboxService,
      isConsolidatedMode,
      selectedAccountId,
    ],
  );

  const loadMore = useCallback(async (): Promise<LoadMessagesResult> => {
    return inboxService.loadMore();
  }, [inboxService]);

  const loadPage = useCallback(
    async (page: number, pageSize?: number): Promise<LoadMessagesResult> => {
      const accountId = isConsolidatedMode
        ? consolidatedScopeKey
        : (selectedAccountId ?? inboxService.getCurrentAccountId());
      if (!accountId) {
        return {
          success: false,
          messages: inboxService.messages,
          total: inboxService.totalCount,
          hasMore: inboxService.hasMore,
          error: "Cannot load page without an active account",
        };
      }

      const safePageSize = Math.max(1, pageSize ?? 50);
      const maxPage =
        inboxService.totalCount > 0
          ? Math.max(1, Math.ceil(inboxService.totalCount / safePageSize))
          : null;
      const safePage =
        maxPage === null
          ? Math.max(1, page)
          : Math.max(1, Math.min(page, maxPage));

      return loadMessages({
        accountId,
        folder: folderService.selectedFolder,
        offset: (safePage - 1) * safePageSize,
        limit: safePageSize,
        consolidated: isConsolidatedMode,
        accountIds: isConsolidatedMode
          ? effectiveConsolidatedAccountIds
          : undefined,
        grouping: inboxService.currentGrouping,
      });
    },
    [
      consolidatedScopeKey,
      effectiveConsolidatedAccountIds,
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      loadMessages,
      selectedAccountId,
    ],
  );

  const refreshMessages = useCallback(async (): Promise<void> => {
    const currentAccountId = isConsolidatedMode
      ? consolidatedScopeKey
      : (selectedAccountId ?? inboxService.getCurrentAccountId());
    if (!currentAccountId) {
      return;
    }

    // Force a real server-side sync first: prioritize the visible account(s) at
    // the front of the sync queue and advance the driver. Without this the
    // refresh only re-read the DB mirror (force=1 merely queued a background
    // job that starves when wp-cron loopback is blocked), so nothing actually
    // synced from IMAP and no sync task was recorded. Best-effort; the reload
    // below still runs if this fails.
    const refreshAccountIds = isConsolidatedMode
      ? effectiveConsolidatedAccountIds
      : [Number(selectedAccountId ?? inboxService.getCurrentAccountId())];
    await refreshAccountSync(refreshAccountIds);

    const currentPageState = inboxService as unknown as {
      _currentOffsetStart?: number;
      _currentLimit?: number;
    };

    // Clamp the refresh offset to the (possibly shrunken) total: after a mass
    // sweep/move the previous page offset can point past the end, leaving the
    // user stranded on an empty page with a stale page number.
    const limit = currentPageState._currentLimit ?? 50;
    let offset = currentPageState._currentOffsetStart ?? 0;
    const total = inboxService.totalCount ?? 0;
    if (total > 0 && offset >= total) {
      offset = Math.max(0, (Math.ceil(total / limit) - 1) * limit);
    } else if (total === 0) {
      offset = 0;
    }

    await loadMessages({
      accountId: currentAccountId,
      folder: folderService.selectedFolder || inboxService.currentFolder,
      offset,
      limit,
      forceRefresh: true,
      consolidated: isConsolidatedMode,
      accountIds: isConsolidatedMode
        ? effectiveConsolidatedAccountIds
        : undefined,
      grouping: inboxService.currentGrouping,
    });
  }, [
    consolidatedScopeKey,
    effectiveConsolidatedAccountIds,
    folderService.selectedFolder,
    inboxService,
    isConsolidatedMode,
    loadMessages,
    selectedAccountId,
  ]);

  const invalidateFolderMessages = useCallback(
    (folder: string): void => {
      inboxService.invalidateFolderMessages(folder);
    },
    [inboxService],
  );

  const clearDetailRepollTimer = useCallback((): void => {
    if (
      detailRepollTimerRef.current !== null &&
      typeof window !== "undefined"
    ) {
      window.clearTimeout(detailRepollTimerRef.current);
    }
    detailRepollTimerRef.current = null;
  }, []);

  /**
   * Run one on-demand detail fetch for the selected message and apply the tri-state outcome:
   * detail ⇒ update + clear pending; pending ⇒ set pending (and, when `autoRepoll`, schedule a
   * SINGLE ~4s re-poll); null ⇒ hard error, clear pending. `autoRepoll` is true for the initial
   * selection and for a manual Retry, false for the automatic re-poll itself (so it never loops).
   */
  const runDetailFetch = useCallback(
    async (
      req: {
        accountId: string;
        folder: string;
        msgId: string | number;
        updateId: string | number;
      },
      autoRepoll: boolean,
    ): Promise<void> => {
      setIsDetailFetching(true);
      try {
        const outcome = await prefetchService.fetchDetail(
          req.accountId,
          req.folder,
          req.msgId,
          "user-selected",
        );
        if (outcome && "detail" in outcome) {
          const detailUpdates: Partial<EmailMessage> = {
            ...outcome.detail,
          };
          const summaryOwnedKeys: Array<keyof EmailMessage> = [
            "id",
            "uid",
            "msg_no",
            "consolidatedUid",
            "accountId",
            "accountEmail",
            "accountProvider",
            "accountLabel",
            "folder",
            "folderLabel",
            "subject",
            "name",
            "from",
            "email",
            "date",
            "receivedDate",
            "read",
            "is_read",
            "starred",
            "important",
            "is_important",
            "labels",
            "tags",
            "threadId",
            "threadCount",
            "threadUnreadCount",
            "threadMessageIds",
          ];
          for (const key of summaryOwnedKeys) {
            Reflect.deleteProperty(detailUpdates, key);
          }
          inboxService.updateMessage(req.updateId, detailUpdates);
          setDetailBodyPending(false);
          setDetailBodyError(false);
          pendingDetailRef.current = null;
          clearDetailRepollTimer();
        } else if (outcome && "pending" in outcome) {
          setDetailBodyPending(true);
          setDetailBodyError(false);
          pendingDetailRef.current = req;
          if (autoRepoll && typeof window !== "undefined") {
            clearDetailRepollTimer();
            detailRepollTimerRef.current = window.setTimeout(() => {
              detailRepollTimerRef.current = null;
              void runDetailFetch(req, false);
            }, 4000);
          }
        } else if (outcome && "failed" in outcome) {
          // Hard failure (e.g. a config_error/auth_failed account): show a distinct error branch
          // with Retry instead of a false "No content". Keep the request so retryMessageDetail()
          // can re-run it, but do NOT auto re-poll, a hard error stays until the user retries.
          setDetailBodyPending(false);
          setDetailBodyError(true);
          pendingDetailRef.current = req;
          clearDetailRepollTimer();
        } else {
          // null, a non-terminal miss (background priority never reaches here). Clear both states.
          setDetailBodyPending(false);
          setDetailBodyError(false);
          pendingDetailRef.current = null;
          clearDetailRepollTimer();
        }
      } finally {
        setIsDetailFetching(false);
      }
    },
    [prefetchService, inboxService, clearDetailRepollTimer],
  );

  /** Manual "Retry" for a pending or hard-failed message body (re-arms one automatic re-poll). */
  const retryMessageDetail = useCallback((): void => {
    const req = pendingDetailRef.current;
    if (req) {
      void runDetailFetch(req, true);
    }
  }, [runDetailFetch]);

  const selectMessage = useCallback(
    async (message: EmailMessage | null): Promise<void> => {
      // A new selection cancels any pending re-poll from the previous message.
      clearDetailRepollTimer();
      clearMarkAsReadTimer();
      pendingDetailRef.current = null;
      setDetailBodyPending(false);
      setDetailBodyError(false);

      await inboxService.selectMessage(message);

      const fallbackFolder =
        message?.folder ??
        folderService.selectedFolder ??
        inboxService.currentFolder ??
        "INBOX";

      // Resolve the correct accountId (use message's accountId in consolidated mode)
      const effectiveAccountId = message
        ? isConsolidatedMode && message.accountId
          ? message.accountId
          : selectedAccountId
        : selectedAccountId;

      // If cache miss (no body), fetch detail on-demand with user-selected priority
      if (message && effectiveAccountId) {
        const selected = inboxService.selectedMessage;
        const hasBody =
          selected?.htmlBody || selected?.plainBody || selected?.body;
        const msgId = message.uid ?? message.id;

        if (!hasBody && msgId) {
          await runDetailFetch(
            {
              accountId: String(effectiveAccountId),
              folder: fallbackFolder,
              msgId,
              updateId: message.consolidatedUid ?? msgId,
            },
            true,
          );
        }
      }

      // If selecting a message, mark it as read according to user preference.
      if (message && effectiveAccountId && !message.read) {
        const prefs = getUserPreferencesSnapshot();
        const delayMs = markAsReadDelayMs(
          prefs.mark_as_read_behavior,
          prefs.mark_as_read_delay_seconds,
        );
        if (delayMs !== null) {
          const localMessageId =
            message.consolidatedUid ??
            message.id ??
            message.uid ??
            message.msg_no;
          const messageRef = resolveMessageRef(
            localMessageId,
            inboxService.messages,
            effectiveAccountId,
            fallbackFolder,
          );
          const updateId = message.consolidatedUid ?? localMessageId;
          const markRead = async () => {
            await messageService.markAsRead(
              messageRef.accountId ?? effectiveAccountId,
              messageRef.apiId,
              {
                folder: messageRef.folder,
                msgNo: messageRef.msgNo,
                identifierMode: messageRef.identifierMode,
              },
            );
            inboxService.updateMessage(updateId, { read: true });
            if (messageRef.folder) {
              folderService.applyUnreadDelta(messageRef.folder, -1);
            }
            scheduleFolderCountRefresh();
          };
          if (delayMs === 0) {
            await markRead();
          } else {
            markAsReadTimerRef.current = setTimeout(() => {
              markAsReadTimerRef.current = null;
              void markRead();
            }, delayMs);
          }
        }
      }
    },
    [
      folderService,
      folderService.selectedFolder,
      scheduleFolderCountRefresh,
      inboxService,
      isConsolidatedMode,
      messageService,
      runDetailFetch,
      clearDetailRepollTimer,
      clearMarkAsReadTimer,
      selectedAccountId,
    ],
  );

  const clearSelection = useCallback((): void => {
    clearMarkAsReadTimer();
    inboxService.clearSelection();
  }, [clearMarkAsReadTimer, inboxService]);

  // ============== Message Operations ==============
  const markAsRead = useCallback(
    async (messageId: string | number): Promise<OperationResult> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      const result = await messageService.markAsRead(
        messageRef.accountId,
        messageRef.apiId,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );
      if (result.success) {
        inboxService.updateMessage(messageRef.localId, { read: true });
        scheduleFolderCountRefresh();
      }
      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const markAsUnread = useCallback(
    async (messageId: string | number): Promise<OperationResult> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      const result = await messageService.markAsUnread(
        messageRef.accountId,
        messageRef.apiId,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );
      if (result.success) {
        inboxService.updateMessage(messageRef.localId, { read: false });
        scheduleFolderCountRefresh();
      }
      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const toggleStar = useCallback(
    async (messageId: string | number): Promise<OperationResult> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      // Optimistically toggle star in the inbox message list
      const currentMsg = inboxService.messages.find((m) =>
        matchesMessageId(m, messageId),
      );
      const newStarred = !(currentMsg?.starred ?? false);
      inboxService.updateMessage(messageRef.localId, { starred: newStarred });

      const result = await messageService.toggleStar(
        messageRef.accountId,
        messageRef.apiId,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );

      // If server returned a definitive state, use that instead
      if (result.success && result.message?.starred !== undefined) {
        inboxService.updateMessage(messageRef.localId, {
          starred: result.message.starred,
        });
      } else if (!result.success) {
        // Revert optimistic update on failure
        inboxService.updateMessage(messageRef.localId, {
          starred: !newStarred,
        });
      }

      if (result.success) {
        scheduleFolderCountRefresh();
      }

      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const getRawHeaders = useCallback(
    async (
      messageId: string | number,
    ): Promise<{ success: boolean; headers?: string; error?: string }> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }

      return messageService.getRawHeaders(
        messageRef.accountId,
        messageRef.apiId,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const toggleImportant = useCallback(
    async (messageId: string | number): Promise<OperationResult> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );

      // Optimistic toggle + revert on failure, persisted via the smart-inbox
      // priority API (importance has no IMAP flag).
      const result = await performToggleImportant({
        getImportant: () =>
          Boolean(
            inboxService.messages.find((m) => matchesMessageId(m, messageId))
              ?.important,
          ),
        setImportant: (important) =>
          inboxService.updateMessage(messageRef.localId, { important }),
        persist: (important) =>
          markMessageImportant(messageRef.apiId, important, {
            accountId: messageRef.accountId,
            folder: messageRef.folder,
            identifierMode: messageRef.identifierMode,
          }),
      });
      if (result.success) {
        scheduleFolderCountRefresh();
      }
      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const deleteMessage = useCallback(
    async (
      messageId: string | number,
      permanent = false,
    ): Promise<OperationResult> => {
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      const result = await messageService.deleteMessage(
        messageRef.accountId,
        messageRef.apiId,
        permanent,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );
      if (result.success) {
        inboxService.removeMessage(messageRef.localId);
      }
      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const moveMessage = useCallback(
    async (
      messageId: string | number,
      targetFolder: MutationTarget,
    ): Promise<OperationResult> => {
      const fallbackFolder =
        folderService.selectedFolder || inboxService.currentFolder || "INBOX";
      const getFolderByPath = (path: string) =>
        folderService.getFolderByPath(path);
      const messageRef = resolveMessageRef(
        messageId,
        inboxService.messages,
        isConsolidatedMode ? null : selectedAccountId,
        fallbackFolder,
        makeAccountFolderResolver(getFolderByPath, fallbackFolder),
      );
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      // Same per-account resolution as the batch path: a merged folder's
      // literal path is another account's physical path more often than not.
      const resolved = resolveMutationTargetForAccount(
        targetFolder,
        messageRef.accountId,
        getFolderByPath,
      );
      if (!resolved.ok) {
        return { success: false, error: resolved.error };
      }
      // The single-move endpoint takes literal paths only; destination unions
      // go through the batch endpoint (same semantics, one message).
      const result = isDestinationMutationTarget(resolved.target)
        ? await messageService.batchMove(
            messageRef.accountId,
            [messageRef.apiId],
            resolved.target,
            {
              folder: messageRef.folder,
              identifierMode: messageRef.identifierMode,
            },
          )
        : await messageService.moveMessage(
            messageRef.accountId,
            messageRef.apiId,
            resolved.target,
            {
              folder: messageRef.folder,
              msgNo: messageRef.msgNo,
              identifierMode: messageRef.identifierMode,
            },
          );
      if (result.success) {
        inboxService.removeMessage(messageRef.localId);
      }
      return result;
    },
    [
      folderService,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const archiveMessage = useCallback(
    async (
      messageId: string | number,
      replySource?: ComposeReplySource,
    ): Promise<OperationResult> => {
      const fallbackAccountId = isConsolidatedMode ? null : selectedAccountId;
      const fallbackFolder =
        folderService.selectedFolder || inboxService.currentFolder || "INBOX";
      const messageRef = replySource
        ? resolveReplySourceRef(replySource)
        : resolveMessageRef(
            messageId,
            inboxService.messages,
            fallbackAccountId,
            fallbackFolder,
          );
      if (!messageRef) {
        return { success: false, error: "Invalid originating message" };
      }
      if (!messageRef.accountId) {
        return { success: false, error: "No account selected" };
      }
      const result = await messageService.archiveMessage(
        messageRef.accountId,
        messageRef.apiId,
        {
          folder: messageRef.folder,
          msgNo: messageRef.msgNo,
          identifierMode: messageRef.identifierMode,
        },
      );
      if (result.success) {
        inboxService.removeMessage(messageRef.localId);
      }
      return result;
    },
    [
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const batchMarkReadInMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      messageIds: (string | number)[],
    ): Promise<BatchOperationResult> => {
      const { groups, unmatchedIds } = groupByMailboxContext(
        messageIds,
        sourceMessages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        makeAccountFolderResolver(
          (path) => folderService.getFolderByPath(path),
          folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        ),
      );
      if (!groups.length && unmatchedIds.length === messageIds.length) {
        return {
          success: false,
          error: "No account selected",
          successCount: 0,
          failedIds: messageIds,
          totalCount: messageIds.length,
        };
      }
      let totalSuccess = 0;
      let firstError: string | undefined =
        unmatchedIds.length > 0 ? "No account selected" : undefined;
      const allFailed: (string | number)[] = [...unmatchedIds];
      for (const group of groups) {
        const apiIds = group.refs.map((ref) => ref.apiId);
        const result = await messageService.batchMarkRead(
          group.accountId,
          apiIds,
          {
            folder: group.folder,
            identifierMode: group.identifierMode,
          },
        );
        totalSuccess += result.successCount;
        if (!result.success && !firstError) {
          firstError = result.error;
        }
        const failedLocalIds = getFailedLocalIds(group.refs, result.failedIds);
        allFailed.push(...failedLocalIds);
        if (result.success) {
          // Refresh the list cache and folder counts so the sidebar unread
          // badge updates immediately instead of waiting for the next poll.
          cache.invalidateMessages({
            accountId: String(group.accountId),
            folder: group.folder,
          });
          cache.invalidateFolders(String(group.accountId));
        }
        for (const ref of group.refs) {
          if (!failedLocalIds.includes(ref.localId)) {
            inboxService.updateMessage(ref.localId, { read: true });
          }
        }
      }

      if (totalSuccess > 0) {
        scheduleFolderCountRefresh();
      }

      return {
        success: allFailed.length === 0,
        successCount: totalSuccess,
        failedIds: allFailed,
        totalCount: messageIds.length,
        error: allFailed.length === 0 ? undefined : firstError,
      };
    },
    [
      cache,
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const batchMarkRead = useCallback(
    async (messageIds: (string | number)[]): Promise<BatchOperationResult> =>
      batchMarkReadInMessages(inboxService.messages, messageIds),
    [batchMarkReadInMessages, inboxService],
  );

  const batchMarkReadMessages = useCallback(
    async (sourceMessages: EmailMessage[]): Promise<BatchOperationResult> =>
      batchMarkReadInMessages(
        sourceMessages,
        getMessageIdsFromMessages(sourceMessages),
      ),
    [batchMarkReadInMessages],
  );

  const batchMarkUnreadInMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      messageIds: (string | number)[],
    ): Promise<BatchOperationResult> => {
      const { groups, unmatchedIds } = groupByMailboxContext(
        messageIds,
        sourceMessages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        makeAccountFolderResolver(
          (path) => folderService.getFolderByPath(path),
          folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        ),
      );
      if (!groups.length && unmatchedIds.length === messageIds.length) {
        return {
          success: false,
          error: "No account selected",
          successCount: 0,
          failedIds: messageIds,
          totalCount: messageIds.length,
        };
      }
      let totalSuccess = 0;
      let firstError: string | undefined =
        unmatchedIds.length > 0 ? "No account selected" : undefined;
      const allFailed: (string | number)[] = [...unmatchedIds];
      for (const group of groups) {
        const apiIds = group.refs.map((ref) => ref.apiId);
        const result = await messageService.batchMarkUnread(
          group.accountId,
          apiIds,
          {
            folder: group.folder,
            identifierMode: group.identifierMode,
          },
        );
        totalSuccess += result.successCount;
        if (!result.success && !firstError) {
          firstError = result.error;
        }
        const failedLocalIds = getFailedLocalIds(group.refs, result.failedIds);
        allFailed.push(...failedLocalIds);
        if (result.success) {
          cache.invalidateMessages({
            accountId: String(group.accountId),
            folder: group.folder,
          });
          cache.invalidateFolders(String(group.accountId));
        }
        for (const ref of group.refs) {
          if (!failedLocalIds.includes(ref.localId)) {
            inboxService.updateMessage(ref.localId, { read: false });
          }
        }
      }
      if (totalSuccess > 0) {
        scheduleFolderCountRefresh();
      }
      return {
        success: allFailed.length === 0,
        successCount: totalSuccess,
        failedIds: allFailed,
        totalCount: messageIds.length,
        error: allFailed.length === 0 ? undefined : firstError,
      };
    },
    [
      cache,
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      scheduleFolderCountRefresh,
      selectedAccountId,
    ],
  );

  const batchMarkUnread = useCallback(
    async (messageIds: (string | number)[]): Promise<BatchOperationResult> =>
      batchMarkUnreadInMessages(inboxService.messages, messageIds),
    [batchMarkUnreadInMessages, inboxService],
  );

  const batchMarkUnreadMessages = useCallback(
    async (sourceMessages: EmailMessage[]): Promise<BatchOperationResult> =>
      batchMarkUnreadInMessages(
        sourceMessages,
        getMessageIdsFromMessages(sourceMessages),
      ),
    [batchMarkUnreadInMessages],
  );

  const batchDeleteInMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      messageIds: (string | number)[],
      permanent = false,
    ): Promise<BatchOperationResult> => {
      const { groups, unmatchedIds } = groupByMailboxContext(
        messageIds,
        sourceMessages,
        isConsolidatedMode ? null : selectedAccountId,
        folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        makeAccountFolderResolver(
          (path) => folderService.getFolderByPath(path),
          folderService.selectedFolder || inboxService.currentFolder || "INBOX",
        ),
      );
      if (!groups.length && unmatchedIds.length === messageIds.length) {
        return {
          success: false,
          error: "No account selected",
          successCount: 0,
          failedIds: messageIds,
          totalCount: messageIds.length,
        };
      }
      let totalSuccess = 0;
      let firstError: string | undefined =
        unmatchedIds.length > 0 ? "No account selected" : undefined;
      const allFailed: (string | number)[] = [...unmatchedIds];
      const removedLocalIds = new Set<string>();
      for (const group of groups) {
        const apiIds = group.refs.map((ref) => ref.apiId);
        const result = await messageService.batchDelete(
          group.accountId,
          apiIds,
          permanent,
          {
            folder: group.folder,
            identifierMode: group.identifierMode,
          },
        );
        totalSuccess += result.successCount;
        if (!result.success && !firstError) {
          firstError = result.error;
        }
        const failedLocalIds = getFailedLocalIds(group.refs, result.failedIds);
        allFailed.push(...failedLocalIds);
        if (result.success) {
          cache.invalidateMessages({
            accountId: String(group.accountId),
            folder: group.folder,
          });
        }
        for (const ref of group.refs) {
          if (!failedLocalIds.includes(ref.localId)) {
            inboxService.removeMessage(ref.localId);
            removedLocalIds.add(String(ref.localId));
          }
        }
      }
      const selectedMessageKey = inboxService.selectedMessage
        ? getMessageIdentityKey(inboxService.selectedMessage)
        : null;
      if (selectedMessageKey && removedLocalIds.has(selectedMessageKey)) {
        inboxService.clearSelection();
      }
      return {
        success: allFailed.length === 0,
        successCount: totalSuccess,
        failedIds: allFailed,
        totalCount: messageIds.length,
        error: allFailed.length === 0 ? undefined : firstError,
      };
    },
    [
      cache,
      folderService.selectedFolder,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const batchDelete = useCallback(
    async (
      messageIds: (string | number)[],
      permanent = false,
    ): Promise<BatchOperationResult> =>
      batchDeleteInMessages(inboxService.messages, messageIds, permanent),
    [batchDeleteInMessages, inboxService],
  );

  const batchDeleteMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      permanent = false,
    ): Promise<BatchOperationResult> =>
      batchDeleteInMessages(
        sourceMessages,
        getMessageIdsFromMessages(sourceMessages),
        permanent,
      ),
    [batchDeleteInMessages],
  );

  const batchMoveInMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      messageIds: (string | number)[],
      targetFolder: MutationTarget,
    ): Promise<BatchOperationResult> => {
      const fallbackFolder =
        folderService.selectedFolder || inboxService.currentFolder || "INBOX";
      const getFolderByPath = (path: string) =>
        folderService.getFolderByPath(path);
      const { groups, unmatchedIds } = groupByMailboxContext(
        messageIds,
        sourceMessages,
        isConsolidatedMode ? null : selectedAccountId,
        fallbackFolder,
        makeAccountFolderResolver(getFolderByPath, fallbackFolder),
      );
      if (!groups.length && unmatchedIds.length === messageIds.length) {
        return {
          success: false,
          error: "No account selected",
          successCount: 0,
          failedIds: messageIds,
          totalCount: messageIds.length,
        };
      }

      let totalSuccess = 0;
      let firstError: string | undefined =
        unmatchedIds.length > 0 ? "No account selected" : undefined;
      const allFailed: (string | number)[] = [...unmatchedIds];
      const accountErrors: { accountId: string | number; error: string }[] = [];
      const createdFolders: { path: string; folderId?: number | null }[] = [];
      for (const group of groups) {
        // Resolve the requested target for THIS account: merged folders remap
        // to the account's own path; missing counterparts fall back to a role
        // token or a per-account destination the server creates.
        const resolved = resolveMutationTargetForAccount(
          targetFolder,
          group.accountId,
          getFolderByPath,
        );
        if (!resolved.ok) {
          allFailed.push(...group.refs.map((ref) => ref.localId));
          firstError ??= resolved.error;
          accountErrors.push({
            accountId: group.accountId,
            error: resolved.error,
          });
          continue;
        }
        const apiIds = group.refs.map((ref) => ref.apiId);
        const result = await messageService.batchMove(
          group.accountId,
          apiIds,
          resolved.target,
          {
            folder: group.folder,
            identifierMode: group.identifierMode,
          },
        );
        totalSuccess += result.successCount;
        if (!result.success) {
          firstError ??= result.error;
          if (result.error) {
            accountErrors.push({
              accountId: group.accountId,
              error: result.error,
            });
          }
        }
        if (result.createdFolders?.length) {
          createdFolders.push(...result.createdFolders);
        }
        const failedLocalIds = getFailedLocalIds(group.refs, result.failedIds);
        allFailed.push(...failedLocalIds);
        if (result.success) {
          cache.invalidateMessages({
            accountId: String(group.accountId),
            folder: group.folder,
          });
          cache.invalidateMessages({
            accountId: String(group.accountId),
            folder: resolved.path,
          });
        }
        for (const ref of group.refs) {
          if (!failedLocalIds.includes(ref.localId)) {
            inboxService.removeMessage(ref.localId);
          }
        }
      }
      return {
        success: allFailed.length === 0,
        successCount: totalSuccess,
        failedIds: allFailed,
        totalCount: messageIds.length,
        error: allFailed.length === 0 ? undefined : firstError,
        ...(accountErrors.length > 0 ? { accountErrors } : {}),
        ...(createdFolders.length > 0 ? { createdFolders } : {}),
      };
    },
    [
      cache,
      folderService,
      inboxService,
      isConsolidatedMode,
      messageService,
      selectedAccountId,
    ],
  );

  const batchMove = useCallback(
    async (
      messageIds: (string | number)[],
      targetFolder: MutationTarget,
    ): Promise<BatchOperationResult> =>
      batchMoveInMessages(inboxService.messages, messageIds, targetFolder),
    [batchMoveInMessages, inboxService],
  );

  const batchMoveMessages = useCallback(
    async (
      sourceMessages: EmailMessage[],
      targetFolder: MutationTarget,
    ): Promise<BatchOperationResult> =>
      batchMoveInMessages(
        sourceMessages,
        getMessageIdsFromMessages(sourceMessages),
        targetFolder,
      ),
    [batchMoveInMessages],
  );

  // ============== Folder Operations ==============
  const loadFolders = useCallback(
    async (
      accountId: string | number,
      forceRefresh = false,
    ): Promise<FolderListResult> => {
      return folderService.loadFolders(accountId, forceRefresh);
    },
    [folderService],
  );

  const loadConsolidatedFolders = useCallback(
    async (
      accountIds: number[],
      forceRefresh = false,
    ): Promise<FolderListResult> => {
      const result = await folderService.loadConsolidatedFolders(
        accountIds,
        forceRefresh,
      );

      if (!result.success) {
        setInitError(result.error || "Failed to load folders");
        return result;
      }

      setInitError(result.error || null);
      return result;
    },
    [folderService],
  );

  const emptyTrash = useCallback(
    async (folder?: string): Promise<BatchOperationResult> => {
      const trashFolder = folderService.getTrashFolder();
      const requestedFolder = folder || trashFolder?.path || "Trash";
      const requests = isConsolidatedMode
        ? effectiveConsolidatedAccountIds.map((accountId) => {
            const sourcePath =
              trashFolder?.sourceFolders?.find(
                (source) => Number(source.accountId) === Number(accountId),
              )?.path ?? requestedFolder;
            return { accountId, folder: sourcePath };
          })
        : [
            {
              accountId:
                selectedAccountId ?? inboxService.getCurrentAccountId(),
              folder: requestedFolder,
            },
          ];

      const validRequests = requests.filter(
        (request): request is { accountId: string | number; folder: string } =>
          request.accountId !== null &&
          request.accountId !== undefined &&
          request.folder.trim().length > 0,
      );

      if (validRequests.length === 0) {
        return {
          success: false,
          error: "No account selected",
          successCount: 0,
          failedIds: [],
          totalCount: 0,
        };
      }

      let successCount = 0;
      let totalCount = 0;
      let firstError: string | undefined;
      const failedIds: (string | number)[] = [];

      for (const request of validRequests) {
        const result = await messageService.emptyTrash(
          request.accountId,
          request.folder,
        );
        successCount += result.successCount;
        totalCount += result.totalCount;
        if (!result.success) {
          firstError = firstError ?? result.error;
          failedIds.push(request.accountId);
        }
        cache.invalidateMessages({
          accountId: String(request.accountId),
          folder: request.folder,
        });
        cache.invalidateFolders(String(request.accountId));
      }

      if (isConsolidatedMode) {
        cache.invalidateFolders(consolidatedScopeKey);
        await loadConsolidatedFolders(effectiveConsolidatedAccountIds, true);
      } else if (validRequests[0]) {
        await loadFolders(validRequests[0].accountId, true);
      }

      return {
        success: failedIds.length === 0,
        successCount,
        failedIds,
        totalCount,
        error: failedIds.length === 0 ? undefined : firstError,
      };
    },
    [
      cache,
      consolidatedScopeKey,
      effectiveConsolidatedAccountIds,
      folderService,
      inboxService,
      isConsolidatedMode,
      loadConsolidatedFolders,
      loadFolders,
      messageService,
      selectedAccountId,
    ],
  );

  // Scope-aware folder reload (single account OR combined) so callers like the
  // sweep live-refresh can true up sidebar badges without knowing the scope.
  const refreshCurrentFolders = useCallback(async (): Promise<void> => {
    if (isConsolidatedMode) {
      if (effectiveConsolidatedAccountIds.length > 0) {
        await loadConsolidatedFolders(effectiveConsolidatedAccountIds, true);
      }
      return;
    }
    const accountId = selectedAccountId ?? inboxService.getCurrentAccountId();
    if (accountId) {
      await loadFolders(accountId, true);
    }
  }, [
    effectiveConsolidatedAccountIds,
    inboxService,
    isConsolidatedMode,
    loadConsolidatedFolders,
    loadFolders,
    selectedAccountId,
  ]);

  const selectFolder = useCallback(
    async (folderPath: string): Promise<void> => {
      await folderService.selectFolder(folderPath);
    },
    [folderService],
  );

  const getInboxFolder = useCallback((): ImapFolder => {
    return folderService.getInboxFolder();
  }, [folderService]);

  const getTrashFolder = useCallback((): ImapFolder | undefined => {
    return folderService.getTrashFolder();
  }, [folderService]);

  const getMoveTargetFolders = useCallback((): ImapFolder[] => {
    return folderService.getMoveTargetFolders();
  }, [folderService]);

  const createFolder = useCallback(
    async (
      accountId: string | number,
      options: CreateFolderOptions,
    ): Promise<FolderResult> => {
      return folderService.createFolder(accountId, options);
    },
    [folderService],
  );

  const renameFolder = useCallback(
    async (
      accountId: string | number,
      path: string,
      newName: string,
      parentId?: number | null,
    ): Promise<FolderResult> => {
      return folderService.renameFolder(accountId, path, newName, parentId);
    },
    [folderService],
  );

  const deleteFolder = useCallback(
    async (accountId: string | number, path: string): Promise<FolderResult> => {
      return folderService.deleteFolder(accountId, path);
    },
    [folderService],
  );

  // ============== Filtering ==============
  const applyFilters = useCallback(
    (filters: MessageFilters): void => {
      inboxService.applyFilters(filters);
    },
    [inboxService],
  );

  const clearFilters = useCallback((): void => {
    inboxService.clearFilters();
  }, [inboxService]);

  const getAllLabels = useCallback((): string[] => {
    return inboxService.getAllLabels();
  }, [inboxService]);

  // ============== Search ==============
  const setSearchTerm = useCallback(
    (term: string): void => {
      searchService.setSearchTerm(term);
    },
    [searchService],
  );

  const search = useCallback(
    async (query: string, options?: SearchOptions): Promise<SearchResult> => {
      return searchService.search(query, {
        ...options,
        accountId: options?.accountId ?? selectedAccountId ?? undefined,
      });
    },
    [searchService, selectedAccountId],
  );

  const searchLocal = useCallback(
    (term: string): EmailMessage[] => {
      return searchService.searchLocal(inboxService.getRawMessages(), term);
    },
    [searchService, inboxService],
  );

  const clearSearch = useCallback((): void => {
    searchService.clearSearch();
  }, [searchService]);

  const getRecentSearches = useCallback((): string[] => {
    return searchService.getRecentSearches();
  }, [searchService]);

  // ============== Connection Health ==============
  const resetAccountHealth = useCallback(
    (accountId: string): void => {
      connectionState.resetHealth(accountId);
    },
    [connectionState],
  );

  // ============== Context Value ==============
  // useSyncExternalStore subscriptions above trigger re-renders when service
  // state changes, which causes this useMemo to re-evaluate with fresh
  // service getter values (messages, folders, isLoading, etc.).
  const contextValue = useMemo<InboxContextValue>(
    () => ({
      // Services
      cache,
      threading,
      prefetch: prefetchService,

      // Account state
      selectedAccountId,
      setSelectedAccountId,

      // Inbox operations
      messages: inboxService.messages,
      groupedMessages: inboxService.groupedMessages,
      threadGroups: inboxService.threadGroups,
      isLoading: inboxService.isLoading,
      isLoadingMore: inboxService.isLoadingMore,
      hasMore: inboxService.hasMore,
      totalCount: inboxService.totalCount,
      consolidatedAccountReadiness: inboxService.consolidatedAccountReadiness,
      isMessageDetailLoading: isDetailFetching,
      detailBodyPending,
      detailBodyError,
      retryMessageDetail,
      selectedMessage: inboxService.selectedMessage,
      loadMessages,
      loadMessagesSnapshot,
      loadMore,
      loadPage,
      refreshMessages,
      invalidateFolderMessages,
      selectMessage,
      clearSelection,

      // Message operations
      markAsRead,
      markAsUnread,
      toggleStar,
      getRawHeaders,
      toggleImportant,
      deleteMessage,
      moveMessage,
      archiveMessage,
      batchMarkRead,
      batchMarkReadMessages,
      batchMarkUnread,
      batchMarkUnreadMessages,
      batchDelete,
      batchDeleteMessages,
      batchMove,
      batchMoveMessages,
      emptyTrash,

      // Folder operations
      folders: folderService.folders,
      virtualFolderCounts: folderService.virtualFolderCounts,
      selectedFolder: folderService.selectedFolder,
      isFoldersLoading: folderService.isLoading,
      loadFolders,
      loadConsolidatedFolders,
      refreshCurrentFolders,
      selectFolder,
      getInboxFolder,
      getTrashFolder,
      getMoveTargetFolders,
      createFolder,
      renameFolder,
      deleteFolder,

      // Filtering
      activeFilters: inboxService.activeFilters,
      applyFilters,
      clearFilters,
      getAllLabels,

      // Search
      searchTerm: searchService.searchTerm,
      isSearching: searchService.isSearching,
      setSearchTerm,
      search,
      searchLocal,
      clearSearch,
      getRecentSearches,

      // Error state
      error: initError,
      clearError: () => setInitError(null),
      retryInit: () => {
        initializedAccountRef.current = null;
        setInitError(null);
        setRetryCount((c) => c + 1);
      },

      // Connection health
      connectionHealth: connectionState.healthStates,
      resetAccountHealth,
    }),
    [
      cache,
      threading,
      prefetchService,
      selectedAccountId,
      initError,
      isDetailFetching,
      detailBodyPending,
      detailBodyError,
      retryMessageDetail,
      // useSyncExternalStore versions trigger memo recompute when
      // service state changes.
      inboxVersion,
      folderVersion,
      connectionVersion,
      loadMessages,
      loadMessagesSnapshot,
      loadMore,
      loadPage,
      refreshMessages,
      invalidateFolderMessages,
      selectMessage,
      clearSelection,
      markAsRead,
      markAsUnread,
      toggleStar,
      getRawHeaders,
      toggleImportant,
      deleteMessage,
      moveMessage,
      archiveMessage,
      batchMarkRead,
      batchMarkReadMessages,
      batchMarkUnread,
      batchMarkUnreadMessages,
      batchDelete,
      batchDeleteMessages,
      batchMove,
      batchMoveMessages,
      emptyTrash,
      loadFolders,
      loadConsolidatedFolders,
      selectFolder,
      createFolder,
      renameFolder,
      deleteFolder,
      getInboxFolder,
      getTrashFolder,
      getMoveTargetFolders,
      applyFilters,
      clearFilters,
      getAllLabels,
      setSearchTerm,
      search,
      searchLocal,
      clearSearch,
      getRecentSearches,
      resetAccountHealth,
    ],
  );

  return (
    <InboxContext.Provider value={contextValue}>
      {children}
    </InboxContext.Provider>
  );
}

// ============== Hooks ==============

/**
 * Use the full inbox context.
 */
export function useInbox(): InboxContextValue {
  const context = useContext(InboxContext);
  if (!context || context.cache === null) {
    throw new Error("useInbox must be used within InboxProvider");
  }
  return context;
}

/**
 * Use only inbox state (messages, loading, etc.).
 */
export function useInboxState() {
  const {
    selectedAccountId,
    messages,
    threadGroups,
    groupedMessages,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMessagesSnapshot,
    isMessageDetailLoading,
    detailBodyPending,
    detailBodyError,
    retryMessageDetail,
    selectedMessage,
    error,
    clearError,
    retryInit,
  } = useInbox();

  return {
    selectedAccountId,
    messages,
    threadGroups,
    groupedMessages,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMessagesSnapshot,
    isMessageDetailLoading,
    detailBodyPending,
    detailBodyError,
    retryMessageDetail,
    selectedMessage,
    error,
    clearError,
    retryInit,
  };
}

/**
 * Use message operations.
 */
export function useMessageOperations() {
  const {
    markAsRead,
    markAsUnread,
    toggleStar,
    getRawHeaders,
    toggleImportant,
    deleteMessage,
    moveMessage,
    archiveMessage,
    batchMarkRead,
    batchMarkReadMessages,
    batchMarkUnread,
    batchMarkUnreadMessages,
    batchDelete,
    batchDeleteMessages,
    batchMove,
    batchMoveMessages,
    emptyTrash,
    selectMessage,
    clearSelection,
  } = useInbox();

  return {
    markAsRead,
    markAsUnread,
    toggleStar,
    getRawHeaders,
    toggleImportant,
    deleteMessage,
    moveMessage,
    archiveMessage,
    batchMarkRead,
    batchMarkReadMessages,
    batchMarkUnread,
    batchMarkUnreadMessages,
    batchDelete,
    batchDeleteMessages,
    batchMove,
    batchMoveMessages,
    emptyTrash,
    selectMessage,
    clearSelection,
  };
}

/**
 * Use folder operations.
 */
export function useFolderOperations() {
  const {
    folders,
    virtualFolderCounts,
    selectedFolder,
    isFoldersLoading,
    loadFolders,
    loadConsolidatedFolders,
    selectFolder,
    getInboxFolder,
    getTrashFolder,
    getMoveTargetFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useInbox();

  return {
    folders,
    virtualFolderCounts,
    selectedFolder,
    isFoldersLoading,
    loadFolders,
    loadConsolidatedFolders,
    selectFolder,
    getInboxFolder,
    getTrashFolder,
    getMoveTargetFolders,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}

/**
 * Use search operations.
 */
export function useSearchOperations() {
  const {
    searchTerm,
    isSearching,
    setSearchTerm,
    search,
    searchLocal,
    clearSearch,
    getRecentSearches,
  } = useInbox();

  return {
    searchTerm,
    isSearching,
    setSearchTerm,
    search,
    searchLocal,
    clearSearch,
    getRecentSearches,
  };
}

/**
 * Use filtering operations.
 */
export function useFilterOperations() {
  const { activeFilters, applyFilters, clearFilters, getAllLabels } =
    useInbox();

  return useMemo(
    () => ({
      activeFilters,
      applyFilters,
      clearFilters,
      getAllLabels,
    }),
    [activeFilters, applyFilters, clearFilters, getAllLabels],
  );
}

// ============== Fine-Grained Selectors ==============
// These hooks subscribe directly to the InboxService singleton via
// useSyncExternalStore, so they only re-render when their specific
// slice of state changes (by reference). Use these in performance-critical
// components instead of useInboxState() which subscribes to everything.

/**
 * Subscribe to only the messages array.
 * Re-renders only when the messages reference changes.
 */
export function useMessagesSelector(): EmailMessage[] {
  const service = useMemo(() => getInboxService(), []);
  const subscribe = useCallback(
    (cb: () => void) => service.subscribe(cb),
    [service],
  );
  return useSyncExternalStore(subscribe, () => service.messages);
}

/**
 * Subscribe to only the selected message.
 * Re-renders only when selectedMessage reference changes.
 */
export function useSelectedMessageSelector(): EmailMessage | null {
  const service = useMemo(() => getInboxService(), []);
  const subscribe = useCallback(
    (cb: () => void) => service.subscribe(cb),
    [service],
  );
  return useSyncExternalStore(subscribe, () => service.selectedMessage);
}

/**
 * Subscribe to only the loading state.
 * Re-renders only when isLoading changes.
 */
export function useInboxLoadingSelector(): boolean {
  const service = useMemo(() => getInboxService(), []);
  const subscribe = useCallback(
    (cb: () => void) => service.subscribe(cb),
    [service],
  );
  return useSyncExternalStore(subscribe, () => service.isLoading);
}

/**
 * Subscribe to only the total count.
 * Re-renders only when totalCount changes.
 */
export function useTotalCountSelector(): number {
  const service = useMemo(() => getInboxService(), []);
  const subscribe = useCallback(
    (cb: () => void) => service.subscribe(cb),
    [service],
  );
  return useSyncExternalStore(subscribe, () => service.totalCount);
}

export default InboxContext;
