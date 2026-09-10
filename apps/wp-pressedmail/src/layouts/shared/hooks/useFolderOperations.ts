/**
 * useFolderOperations Hook
 *
 * Shared business logic for folder operations across all layouts.
 * Uses the service-based architecture from InboxContext.
 *
 * @since 2.0.0
 * @updated 2.4.0 - Migrated to service-based architecture
 * @updated 3.0.0 - Fully migrated to InboxContext (no MessagesProvider)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/context/AppProvider";
import { useOptionalScheduledEmails } from "@/context/scheduled/ScheduledEmailsContext";
import {
  saveSelectedFolder,
  getSelectedFolder,
} from "@/lib/folder-persistence";
import {
  useInbox,
  useFolderOperations as useServiceFolderOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { useEmailListMode } from "@/hooks/useEmailListMode";
import { getInboxService, getSyncService } from "@/services/implementations";
import { refreshAccountSync } from "@/services/sync-driver.service";
import type {
  ImapFolder,
  FolderTarget,
  SystemFolderType,
  SyncPhase,
  VirtualFlagCount,
} from "@/services/interfaces";
import type { EmailAccount } from "@/types";
import type { CreateFolderOptions, FolderResult } from "@/services/interfaces";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { buildConsolidatedAccountScopeKey } from "@/lib/consolidated-account-scope";
import { useMailboxScope } from "@/hooks/useMailboxScope";
import { getConsolidatedFolderMapForPath } from "@/lib/consolidated-folder-map";

/**
 * Re-export ImapFolder for backwards compatibility.
 */
export type { ImapFolder };

/**
 * Normalized folder type for layout components.
 */
export type EmailProvider = "gmail" | "outlook" | "generic";

const VIRTUAL_FOLDERS = new Set(["starred", "important", "scheduled"]);
const LIVE_SYNC_SYSTEM_FOLDERS = new Set<SystemFolderType>([
  "spam",
  "junk",
  "trash",
]);
const DEFAULT_FOLDER_FETCH_LIMIT = 12;
const NON_INBOX_FETCH_LIMIT = 8;
const INBOX_FETCH_TIMEOUT_MS = 30_000;
const NON_INBOX_FETCH_TIMEOUT_MS = 30_000;

function shouldForceRefreshFolder(
  folderId: string,
  systemType?: SystemFolderType,
): boolean {
  if (systemType && LIVE_SYNC_SYSTEM_FOLDERS.has(systemType)) {
    return true;
  }

  const normalizedId = normalizeFolderIdentity(folderId);
  return (
    normalizedId === "trash" ||
    normalizedId === "deleted" ||
    normalizedId === "deleted items" ||
    normalizedId === "junk" ||
    normalizedId === "junk email" ||
    normalizedId === "spam" ||
    normalizedId === "[gmail]/spam" ||
    normalizedId === "[gmail]/trash"
  );
}

export interface NormalizedFolder {
  id: string;
  name: string;
  path: string;
  count: number;
  unseen?: number;
  displayCount: number;
  icon?: string;
  isSystem?: boolean;
  systemType?: SystemFolderType;
  /** Mirror sync phase: drives the per-folder syncing loader. */
  syncPhase?: SyncPhase;
  /** Account-level connection health (`auth_error` = permanently failed). */
  healthState?: string;
  /** Messages already mirrored locally for this folder. */
  mirroredCount?: number;
  /** Authoritative server message total for this folder. */
  messageCount?: number;
  /** Backfill progress 0-100 while the folder is still mirroring. */
  backfillProgress?: number;
}

/**
 * Folder operation results.
 */
export interface FolderOperationResult {
  success: boolean;
  queued?: boolean;
  error?: string;
}

/**
 * Return type for useFolderOperations hook.
 */
export interface UseFolderOperationsReturn {
  // State
  folders: ImapFolder[];
  normalizedFolders: NormalizedFolder[];
  /** Stable per-flag totals for the virtual Important/Starred/Scheduled badges. */
  virtualFolderCounts: {
    important: VirtualFlagCount;
    starred: VirtualFlagCount;
    scheduled?: number;
  };
  selectedFolder: string | null;
  selectedFolderTarget: FolderTarget | null;
  selectedNav: string;
  isLoading: boolean;
  provider: EmailProvider;

  // Selection
  selectFolder: (folder: string | FolderTarget) => void;
  selectNav: (nav: string) => void;

  // Folder Operations
  getNormalizedFolders: () => NormalizedFolder[];
  getFolderByPath: (path: string) => NormalizedFolder | undefined;
  getSystemFolder: (type: SystemFolderType) => NormalizedFolder | undefined;
  refreshFolders: () => Promise<void>;
  /** Cheap folder-only reload from the DB mirror (no live IMAP, no message refetch). */
  reloadFolders: () => Promise<void>;
  loadFolderMessages: (folderId: string) => Promise<void>;

  // Count updates
  decrementUnseenCount: (folderPath: string) => void;
  adjustFolderCounts: (sourcePath: string, targetPath: string) => void;

  // CRUD Operations
  createFolder: (
    name: string,
    parentId?: number | null,
  ) => Promise<FolderOperationResult>;
  renameFolder: (
    path: string,
    newName: string,
    parentId?: number | null,
  ) => Promise<FolderOperationResult>;
  deleteFolder: (path: string) => Promise<FolderOperationResult>;
  isFolderSystem: (path: string) => boolean;

  // System Folders
  getInboxFolder: () => NormalizedFolder | undefined;
  getSentFolder: () => NormalizedFolder | undefined;
  getDraftsFolder: () => NormalizedFolder | undefined;
  getTrashFolder: () => NormalizedFolder | undefined;
  getArchiveFolder: () => NormalizedFolder | undefined;
}

interface ResolvedAccountContext {
  accountId: string | number;
  accountIds?: number[];
  consolidated: boolean;
}

/**
 * System folder detection patterns, keyed by SystemFolderType.
 */
const SYSTEM_FOLDERS: Record<SystemFolderType, string[]> = {
  inbox: ["INBOX", "Inbox"],
  sent: ["Sent", "SENT", "Sent Items", "Sent Mail", "[Gmail]/Sent Mail"],
  drafts: ["Drafts", "DRAFTS", "[Gmail]/Drafts"],
  trash: ["Trash", "TRASH", "Deleted", "Deleted Items", "[Gmail]/Trash"],
  archive: ["Archive", "ARCHIVE"],
  spam: ["Spam", "SPAM", "Junk", "Junk Email", "Bulk Mail", "[Gmail]/Spam"],
  junk: ["Junk", "Junk Email", "Bulk Mail", "[Gmail]/Spam"],
  flagged: ["Flagged"],
  starred: ["Starred", "[Gmail]/Starred"],
  important: ["Important", "[Gmail]/Important"],
  outbox: ["Outbox"],
  scheduled: ["Scheduled"],
  snoozed: ["Snoozed"],
  templates: ["Templates"],
};

function normalizeFolderIdentity(value: string | undefined | null): string {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .replace(/^\/+/, "")
    .replace(/\s+/g, " ");
}

function normalizeSystemFolderType(
  value: string | undefined | null,
): SystemFolderType | undefined {
  const normalized = normalizeFolderIdentity(value);

  if (normalized === "junk") {
    return "spam";
  }

  if (normalized === "flagged") {
    return "starred";
  }

  if (
    [
      "inbox",
      "sent",
      "drafts",
      "trash",
      "archive",
      "spam",
      "starred",
      "important",
      "outbox",
      "scheduled",
      "snoozed",
      "templates",
    ].includes(normalized)
  ) {
    return normalized as SystemFolderType;
  }

  return undefined;
}

/**
 * Detect systemType from folder path using SYSTEM_FOLDERS patterns.
 */
function detectSystemType(path: string): SystemFolderType | undefined {
  const pathLower = normalizeFolderIdentity(path);
  for (const [type, patterns] of Object.entries(SYSTEM_FOLDERS) as [
    SystemFolderType,
    string[],
  ][]) {
    if (patterns.some((p) => pathLower === normalizeFolderIdentity(p))) {
      return normalizeSystemFolderType(type) ?? type;
    }
  }
  return undefined;
}

/**
 * Detect email provider from folder paths.
 */
function detectProviderFromFolders(
  folders: Array<{ path: string }>,
): EmailProvider {
  const paths = folders.map((f) => f.path.toLowerCase());
  if (paths.some((p) => p.includes("[gmail]"))) return "gmail";
  if (
    paths.some(
      (p) => p === "sent items" || p === "deleted items" || p === "junk email",
    )
  )
    return "outlook";
  return "generic";
}

/**
 * Get icon name for folder based on path.
 */
function getFolderIcon(path: string): string {
  const systemType = detectSystemType(path);
  if (systemType === "inbox") return "inbox";
  if (systemType === "sent") return "send";
  if (systemType === "drafts") return "file";
  if (systemType === "trash") return "trash";
  if (systemType === "archive") return "archive";
  if (systemType === "spam" || systemType === "junk") return "junk";
  if (systemType === "starred" || systemType === "important") return "star";
  if (systemType === "snoozed" || systemType === "scheduled") return "clock";
  if (systemType === "outbox") return "send";
  return "folder";
}

/**
 * Hook providing shared folder operations for all layout components.
 */
export function useFolderOperations(): UseFolderOperationsReturn {
  const inbox = useInbox();
  const serviceFolderOps = useServiceFolderOperations();
  const filterOps = useFilterOperations();
  const { isPagination, pageSize } = useEmailListMode();

  const { accounts, selectedAccount, setSelectedAccount, numberOfMessages } =
    useAppContext();
  const { scope } = useMailboxScope();
  const isConsolidatedMode = scope.type === "combined_inbox";
  const effectiveConsolidatedAccountIds = isConsolidatedMode
    ? scope.accountIds
    : [];
  const consolidatedScopeKey = useMemo(
    () => buildConsolidatedAccountScopeKey(effectiveConsolidatedAccountIds),
    [effectiveConsolidatedAccountIds],
  );
  const selectedFolderPersistenceKey = isConsolidatedMode
    ? consolidatedScopeKey
    : selectedAccount;

  // Local UI state for selected navigation item: restored from localStorage
  const [selectedNav, setSelectedNavState] = useState(() => {
    if (selectedFolderPersistenceKey) {
      return getSelectedFolder(selectedFolderPersistenceKey) ?? "INBOX";
    }
    return "INBOX";
  });
  const [selectedFolderTarget, setSelectedFolderTarget] =
    useState<FolderTarget | null>(null);
  const selectedNavRef = useRef(selectedNav);

  const setSelectedNav = useCallback((value: string) => {
    selectedNavRef.current = value;
    setSelectedNavState(value);
  }, []);

  // Optimistic unseen count overrides (cleared on server refresh)
  const [countOverrides, setCountOverrides] = useState<Record<string, number>>(
    {},
  );

  // Persistent folder count cache: remembers counts across folder switches
  const [folderCountCache, setFolderCountCache] = useState<
    Record<string, number>
  >({});

  // Resolve account email to numeric ID
  const resolveAccountContext =
    useCallback((): ResolvedAccountContext | null => {
      if (!selectedAccount) return null;
      if (selectedAccount === CONSOLIDATED_INBOX_VALUE) {
        if (effectiveConsolidatedAccountIds.length === 0) {
          return null;
        }
        return {
          accountId: consolidatedScopeKey,
          accountIds: effectiveConsolidatedAccountIds,
          consolidated: true,
        };
      }

      const account = accounts.find(
        (acc: EmailAccount) => acc.email?.toString() === selectedAccount,
      );
      if (!account) return null;
      const numericId = Number(account.id ?? 1);
      return {
        accountId: Number.isFinite(numericId) ? numericId : 1,
        consolidated: false,
      };
    }, [
      selectedAccount,
      accounts,
      effectiveConsolidatedAccountIds,
      consolidatedScopeKey,
    ]);

  const resolveAccountId = useCallback((): number | null => {
    const account = resolveAccountContext();
    if (
      !account ||
      account.consolidated ||
      typeof account.accountId !== "number"
    ) {
      return null;
    }
    return account.accountId;
  }, [resolveAccountContext]);

  const foldersSource = serviceFolderOps.folders;

  const provider = useMemo<EmailProvider>(
    () => detectProviderFromFolders(foldersSource),
    [foldersSource],
  );

  useEffect(() => {
    selectedNavRef.current = selectedNav;
  }, [selectedNav]);

  useEffect(() => {
    if (!selectedFolderPersistenceKey) {
      setSelectedNav("INBOX");
      return;
    }

    setSelectedNav(
      getSelectedFolder(selectedFolderPersistenceKey) ??
        serviceFolderOps.selectedFolder ??
        "INBOX",
    );
  }, [selectedFolderPersistenceKey, serviceFolderOps.selectedFolder]);

  useEffect(() => {
    // Another mounted consumer may have selected a virtual view and persisted
    // it before this render. Let the restoration above finish; otherwise its
    // Drafts backing folder overwrites Scheduled and clears the shared filter.
    const persistedNav = selectedFolderPersistenceKey
      ? getSelectedFolder(selectedFolderPersistenceKey)
      : null;
    if (persistedNav && persistedNav !== selectedNav) return;
    if (
      !serviceFolderOps.selectedFolder ||
      VIRTUAL_FOLDERS.has(selectedNav.toLowerCase()) ||
      serviceFolderOps.selectedFolder === selectedNav
    ) {
      return;
    }

    setSelectedNav(serviceFolderOps.selectedFolder);
  }, [
    selectedNav,
    selectedFolderPersistenceKey,
    serviceFolderOps.selectedFolder,
  ]);

  // Clear count overrides when folder data refreshes from server
  const folderDataVersion = useMemo(
    () => foldersSource.map((f) => `${f.path}:${f.unseen}`).join(","),
    [foldersSource],
  );
  useEffect(() => {
    setCountOverrides({});
  }, [folderDataVersion]);

  // Account / combined-inbox scope switch: drop cached real-folder counts so a
  // switched-to account never shows the previous account's stale badge numbers.
  // `selectedFolderPersistenceKey` is the per-account/scope key (NOT the folder),
  // so this only fires on account/scope change, not on folder navigation.
  useEffect(() => {
    setFolderCountCache({});
    setCountOverrides({});
  }, [selectedFolderPersistenceKey]);

  // Cache the live total for the active REAL folder. Important/Starred are
  // intentionally excluded: their authoritative totals come only from the
  // folder-list service snapshot, never from the current page/footer.
  useEffect(() => {
    const navLc = selectedNav.toLowerCase();
    if (VIRTUAL_FOLDERS.has(navLc)) {
      return;
    }
    const activeFolderPath = serviceFolderOps.selectedFolder || selectedNav;
    const liveTotal = numberOfMessages || inbox.totalCount;
    if (
      !activeFolderPath ||
      inbox.isLoading ||
      typeof liveTotal !== "number" ||
      liveTotal < 0
    ) {
      return;
    }

    setFolderCountCache((prev) => {
      if (prev[activeFolderPath] === liveTotal) return prev;
      return { ...prev, [activeFolderPath]: liveTotal };
    });
  }, [
    serviceFolderOps.selectedFolder,
    selectedNav,
    numberOfMessages,
    inbox.totalCount,
    inbox.isLoading,
  ]);

  // Important/Starred are service snapshots. A count of zero is authoritative;
  // it must never trigger a fallback to page-derived values.
  const scheduledCtx = useOptionalScheduledEmails();
  const scheduledPendingCount = scheduledCtx?.counts.pending;
  const virtualFolderCounts = useMemo(
    () => ({
      important: serviceFolderOps.virtualFolderCounts.important,
      starred: serviceFolderOps.virtualFolderCounts.starred,
      scheduled:
        typeof scheduledPendingCount === "number" && scheduledPendingCount > 0
          ? scheduledPendingCount
          : undefined,
    }),
    [serviceFolderOps.virtualFolderCounts, scheduledPendingCount],
  );

  // Cache counts from foldersSource when API returns real data.
  // Never overwrite a known non-zero count with 0 (protects against
  // IMAP STATUS failures that silently return 0).
  useEffect(() => {
    if (foldersSource.length === 0) return;

    setFolderCountCache((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const folder of foldersSource) {
        if (
          typeof folder.count !== "number" ||
          !Number.isFinite(folder.count)
        ) {
          continue;
        }

        const sanitizedCount = Math.max(0, folder.count);
        const existingCount = next[folder.path];

        // Only update when: no previous value, new count is positive,
        // or previous was already 0 (nothing to protect).
        if (
          existingCount === undefined ||
          sanitizedCount > 0 ||
          existingCount === 0
        ) {
          if (next[folder.path] !== sanitizedCount) {
            next[folder.path] = sanitizedCount;
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [foldersSource]);

  // Normalize IMAP folders to a consistent format
  const normalizedFolders = useMemo<NormalizedFolder[]>(() => {
    return foldersSource.map((folder) => {
      const systemType: SystemFolderType | undefined =
        normalizeSystemFolderType(folder.systemType) ??
        normalizeSystemFolderType(
          (folder as ImapFolder & { role?: string }).role,
        ) ??
        normalizeSystemFolderType(folder.type) ??
        detectSystemType(folder.path);

      const overriddenUnseen = countOverrides[folder.path];
      const apiCount =
        typeof folder.count === "number" && Number.isFinite(folder.count)
          ? Math.max(0, folder.count)
          : undefined;
      const cachedCount = folderCountCache[folder.path];

      // Prefer non-zero API count, then non-zero cached count, then API 0, then 0.
      // This prevents STATUS query failures from showing 0 when we have a known count.
      const displayCount =
        apiCount !== undefined && apiCount > 0
          ? apiCount
          : cachedCount !== undefined && cachedCount > 0
            ? cachedCount
            : (apiCount ?? cachedCount ?? 0);

      return {
        id: folder.path,
        name: folder.name,
        path: folder.path,
        count: apiCount ?? 0,
        unseen:
          overriddenUnseen !== undefined
            ? Math.max(0, overriddenUnseen)
            : folder.unseen,
        displayCount,
        icon: getFolderIcon(folder.path),
        isSystem: systemType !== undefined,
        systemType,
        syncPhase: folder.syncPhase,
        healthState: folder.healthState,
        mirroredCount: folder.mirroredCount,
        messageCount: folder.messageCount,
        backfillProgress: folder.backfillProgress,
      };
    });
  }, [foldersSource, countOverrides, folderCountCache]);

  // Get folder by path
  const getFolderByPath = useCallback(
    (path: string): NormalizedFolder | undefined => {
      return normalizedFolders.find(
        (f) => f.path.toLowerCase() === path.toLowerCase(),
      );
    },
    [normalizedFolders],
  );

  // Find system folder by systemType
  const getSystemFolder = useCallback(
    (type: SystemFolderType): NormalizedFolder | undefined => {
      return normalizedFolders.find((f) => f.systemType === type);
    },
    [normalizedFolders],
  );

  // Legacy pattern-based finder (for system folder getters)
  const findSystemFolder = useCallback(
    (patterns: string[]): NormalizedFolder | undefined => {
      return normalizedFolders.find((f) =>
        patterns.some((p) => f.path.toLowerCase().includes(p.toLowerCase())),
      );
    },
    [normalizedFolders],
  );

  // System folder getters
  const getInboxFolder = useCallback(() => {
    const serviceInbox = serviceFolderOps.getInboxFolder();
    if (serviceInbox) {
      return {
        id: serviceInbox.path,
        name: serviceInbox.name,
        path: serviceInbox.path,
        count: serviceInbox.count || 0,
        unseen: serviceInbox.unseen,
        icon: "inbox",
        isSystem: true,
      } as NormalizedFolder;
    }
    return findSystemFolder(SYSTEM_FOLDERS.inbox);
  }, [serviceFolderOps, findSystemFolder]);

  const getSentFolder = useCallback(
    () => findSystemFolder(SYSTEM_FOLDERS.sent),
    [findSystemFolder],
  );

  const getDraftsFolder = useCallback(
    () => findSystemFolder(SYSTEM_FOLDERS.drafts),
    [findSystemFolder],
  );

  const getTrashFolder = useCallback(() => {
    const serviceTrash = serviceFolderOps.getTrashFolder();
    if (serviceTrash) {
      return {
        id: serviceTrash.path,
        name: serviceTrash.name,
        path: serviceTrash.path,
        count: serviceTrash.count || 0,
        unseen: serviceTrash.unseen,
        icon: "trash",
        isSystem: true,
      } as NormalizedFolder;
    }
    return findSystemFolder(SYSTEM_FOLDERS.trash);
  }, [serviceFolderOps, findSystemFolder]);

  const getArchiveFolder = useCallback(
    () => findSystemFolder(SYSTEM_FOLDERS.archive),
    [findSystemFolder],
  );

  // Optimistic count update: decrement unseen for a folder
  const decrementUnseenCount = useCallback(
    (folderPath: string) => {
      setCountOverrides((prev) => {
        const folder = normalizedFolders.find((f) => f.path === folderPath);
        if (!folder) return prev;
        const current = prev[folderPath] ?? folder.unseen ?? 0;
        return { ...prev, [folderPath]: Math.max(0, current - 1) };
      });
    },
    [normalizedFolders],
  );

  // Optimistic count update: adjust counts when moving a message between folders
  const adjustFolderCounts = useCallback(
    (sourcePath: string, targetPath: string) => {
      setCountOverrides((prev) => {
        const sourceFolder = normalizedFolders.find(
          (f) => f.path === sourcePath,
        );
        const targetFolder = normalizedFolders.find(
          (f) => f.path === targetPath,
        );
        const next = { ...prev };
        if (sourceFolder) {
          const srcCurrent = prev[sourcePath] ?? sourceFolder.unseen ?? 0;
          next[sourcePath] = Math.max(0, srcCurrent - 1);
        }
        if (targetFolder) {
          const tgtCurrent = prev[targetPath] ?? targetFolder.unseen ?? 0;
          next[targetPath] = tgtCurrent + 1;
        }
        return next;
      });
    },
    [normalizedFolders],
  );

  // Keep a stable ref to filterOps to avoid infinite re-render loops in useEffect
  const filterOpsRef = useRef(filterOps);
  useEffect(() => {
    filterOpsRef.current = filterOps;
  }, [filterOps]);

  // Apply/clear filters reactively based on selectedNav (virtual folders)
  useEffect(() => {
    const ops = filterOpsRef.current;
    if (selectedNav.toLowerCase() === "scheduled") {
      ops.applyFilters({ scheduledOnly: true });
    } else if (selectedNav.toLowerCase() === "starred") {
      ops.applyFilters({ starred: true });
    } else if (selectedNav.toLowerCase() === "important") {
      ops.applyFilters({ important: true });
    } else if (!VIRTUAL_FOLDERS.has(selectedNav.toLowerCase())) {
      // Real folder, clear any virtual folder filter
      ops.clearFilters();
    }
  }, [selectedNav]);

  // Debounce ref for folder selection API calls
  const selectFolderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Guards against infinite INBOX fallback loops
  const fallbackAttemptRef = useRef(false);

  const resolveFolderForFetch = useCallback(
    (
      folderId: string,
    ): {
      fetchFolder: string;
      forceRefresh: boolean;
      isVirtual: boolean;
      navFolder: string;
      serviceFolder: string;
    } => {
      const normalizedId = normalizeFolderIdentity(folderId);
      const selectedSystemFolder = normalizedFolders.find(
        (folder) =>
          normalizeFolderIdentity(folder.path) === normalizedId ||
          normalizeFolderIdentity(folder.name) === normalizedId,
      );

      if (selectedSystemFolder?.systemType === "scheduled") {
        const draftsFolder = getDraftsFolder();
        const fetchFolder = draftsFolder?.path ?? "Drafts";
        return {
          fetchFolder,
          forceRefresh: false,
          isVirtual: false,
          navFolder: "scheduled",
          serviceFolder: fetchFolder,
        };
      }

      if (selectedSystemFolder?.systemType === "snoozed") {
        return {
          fetchFolder: selectedSystemFolder.path,
          forceRefresh: false,
          isVirtual: false,
          navFolder: "snoozed",
          serviceFolder: selectedSystemFolder.path,
        };
      }

      const hasRealFolder = normalizedFolders.some(
        (folder) => normalizeFolderIdentity(folder.path) === normalizedId,
      );
      if (!hasRealFolder && normalizedId === "scheduled") {
        const draftsFolder = getDraftsFolder();
        const fetchFolder = draftsFolder?.path ?? "Drafts";
        return {
          fetchFolder,
          forceRefresh: false,
          isVirtual: false,
          navFolder: "scheduled",
          serviceFolder: fetchFolder,
        };
      }
      if (!hasRealFolder && normalizedId === "snoozed") {
        return {
          fetchFolder: "Snoozed",
          forceRefresh: false,
          isVirtual: false,
          navFolder: "snoozed",
          serviceFolder: "Snoozed",
        };
      }
      if (!hasRealFolder && VIRTUAL_FOLDERS.has(normalizedId)) {
        // Service folder = the real underlying folder (INBOX), NOT the virtual id.
        // The nav highlight + flag filter are driven off navFolder/selectedNav, so
        // the list-pane's filter-signature load fetches INBOX (with important=1/
        // starred=1) instead of a nonexistent "important"/"starred" IMAP folder
        // that would return empty and clobber the filtered result.
        return {
          fetchFolder: "INBOX",
          forceRefresh: false,
          isVirtual: true,
          navFolder: normalizedId,
          serviceFolder: "INBOX",
        };
      }
      return {
        fetchFolder: folderId,
        forceRefresh: shouldForceRefreshFolder(
          folderId,
          selectedSystemFolder?.systemType,
        ),
        isVirtual: false,
        navFolder: folderId,
        serviceFolder: folderId,
      };
    },
    [getDraftsFolder, normalizedFolders],
  );

  /**
   * Background diff sync for stale-while-revalidate.
   * Uses the same pattern as useInboxSurfaceBoot.syncNow().
   */
  const backgroundDiffSync = useCallback(
    async (
      account: ResolvedAccountContext,
      folder: string,
      syncToken: string | null,
    ): Promise<void> => {
      try {
        const syncService = getSyncService();
        const inboxService = getInboxService();

        const generation = inboxService.getRequestGeneration();
        const token =
          syncToken ?? syncService.getSyncToken(account.accountId, folder);
        const folderMap = account.consolidated
          ? getConsolidatedFolderMapForPath(foldersSource, folder)
          : undefined;

        if (!token) {
          // No sync token, do a silent full reload instead
          await inbox.loadMessages({
            accountId: account.accountId,
            folder,
            consolidated: account.consolidated,
            accountIds: account.consolidated ? account.accountIds : undefined,
            folderMap,
            limit:
              folder.toUpperCase() === "INBOX"
                ? DEFAULT_FOLDER_FETCH_LIMIT
                : NON_INBOX_FETCH_LIMIT,
            forceRefresh: false,
            silent: true,
          });
          return;
        }

        const syncResult = await syncService.incrementalSync(
          account.accountId,
          folder,
          token,
          {
            folder,
            consolidated: account.consolidated,
            accountIds: account.consolidated ? account.accountIds : undefined,
            folderMap,
          },
        );

        if (syncResult.success && syncResult.delta) {
          if (inboxService.applyDiff(syncResult.delta, generation)) return;
          syncResult.requiresFullSync = true;
        }

        if (syncResult.requiresFullSync) {
          await inbox.loadMessages({
            accountId: account.accountId,
            folder,
            consolidated: account.consolidated,
            accountIds: account.consolidated ? account.accountIds : undefined,
            folderMap,
            limit:
              folder.toUpperCase() === "INBOX"
                ? DEFAULT_FOLDER_FETCH_LIMIT
                : NON_INBOX_FETCH_LIMIT,
            forceRefresh: false,
            silent: true,
          });
        }
      } catch (err) {
        console.warn("[useFolderOperations] Background diff sync failed:", err);
      }
    },
    [foldersSource, inbox],
  );

  const loadFolderWithFallback = useCallback(
    async (
      account: ResolvedAccountContext,
      requestedFolder: string,
      options?: { forceRefresh?: boolean; limit?: number },
    ): Promise<void> => {
      const limit =
        options?.limit ??
        (requestedFolder.toUpperCase() === "INBOX"
          ? DEFAULT_FOLDER_FETCH_LIMIT
          : NON_INBOX_FETCH_LIMIT);
      const folderMap = account.consolidated
        ? getConsolidatedFolderMapForPath(foldersSource, requestedFolder)
        : undefined;

      const result = await inbox.loadMessages({
        accountId: account.accountId,
        folder: requestedFolder,
        forceRefresh: options?.forceRefresh ?? false,
        consolidated: account.consolidated,
        accountIds: account.consolidated ? account.accountIds : undefined,
        folderMap,
        limit,
        timeoutMs:
          requestedFolder.toUpperCase() === "INBOX"
            ? INBOX_FETCH_TIMEOUT_MS
            : NON_INBOX_FETCH_TIMEOUT_MS,
      });

      // Stale-while-revalidate: cached data was shown immediately,
      // now run a background diff to bring it up to date
      if (result.success && result.fromCache && result.stale) {
        void backgroundDiffSync(
          account,
          requestedFolder,
          result.syncToken ?? null,
        );
      }

      if (result.success) {
        fallbackAttemptRef.current = false;
        return;
      }

      // "Context changed during request" is expected when user switches
      // folders/accounts mid-fetch, the result was cached, not an error.
      if (result.error === "Context changed during request. Result cached") {
        return;
      }

      if (requestedFolder.toUpperCase() === "INBOX") {
        fallbackAttemptRef.current = false;
        return;
      }

      // Guard against infinite fallback loops: if we're already in a
      // fallback attempt and it also failed, stop retrying.
      if (fallbackAttemptRef.current) {
        console.warn(
          "[useFolderOperations] Fallback to INBOX already in progress; aborting",
        );
        fallbackAttemptRef.current = false;
        return;
      }

      fallbackAttemptRef.current = true;
      console.warn(
        "[useFolderOperations] Folder load failed; falling back to INBOX:",
        requestedFolder,
        result.error,
      );
      const inboxFolderMap = account.consolidated
        ? getConsolidatedFolderMapForPath(foldersSource, "INBOX")
        : undefined;
      setSelectedNav("INBOX");
      await serviceFolderOps.selectFolder("INBOX");
      await inbox.loadMessages({
        accountId: account.accountId,
        folder: "INBOX",
        forceRefresh: false,
        consolidated: account.consolidated,
        accountIds: account.consolidated ? account.accountIds : undefined,
        folderMap: inboxFolderMap,
        limit: DEFAULT_FOLDER_FETCH_LIMIT,
        timeoutMs: INBOX_FETCH_TIMEOUT_MS,
      });
      fallbackAttemptRef.current = false;
    },
    [
      backgroundDiffSync,
      foldersSource,
      inbox,
      serviceFolderOps,
      setSelectedNav,
    ],
  );

  // Select folder and load messages (debounced).
  //
  // IMPORTANT: This callback does NOT abort in-flight requests. If a fetch
  // for a previous folder is in progress, we let it complete so its result
  // lands in the cache (InboxService handles the stale-context case by
  // caching the result without overwriting current state). This matches
  // the "keep already retrieved" requirement. Never throw away data.
  const selectFolder = useCallback(
    (folder: string | FolderTarget) => {
      const target = typeof folder === "string" ? null : folder;
      const folderId = typeof folder === "string" ? folder : folder.path;
      // Don't re-select the folder that's already active
      if (
        target
          ? selectedFolderTarget?.accountId === target.accountId &&
            selectedFolderTarget.folderId === target.folderId &&
            selectedFolderTarget.path === target.path
          : folderId === selectedNavRef.current && selectedFolderTarget === null
      )
        return;

      if (selectFolderTimeoutRef.current) {
        clearTimeout(selectFolderTimeoutRef.current);
      }

      // Note: we do NOT cancel prefetches or abort the in-flight request here.
      // Completed fetches always populate the cache, making future revisits
      // instant. Only prefetch queue items not yet started can be skipped.

      const { fetchFolder, forceRefresh, isVirtual, navFolder, serviceFolder } =
        resolveFolderForFetch(folderId);

      // Update UI state immediately and persist for page refresh
      inbox.clearSelection();
      setSelectedFolderTarget(target);
      if (target) {
        const intendedAccount = accounts.find(
          (candidate) => Number(candidate.id) === target.accountId,
        );
        if (intendedAccount?.email)
          setSelectedAccount(String(intendedAccount.email));
      }
      setSelectedNav(navFolder);
      if (selectedFolderPersistenceKey) {
        saveSelectedFolder(selectedFolderPersistenceKey, navFolder);
      }
      serviceFolderOps.selectFolder(serviceFolder);

      // Apply/clear virtual-view filters SYNCHRONOUSLY before any fetch below.
      // inboxService.applyFilters updates the active filters immediately, but the
      // reactive effect keyed on selectedNav commits only AFTER this fetch, so
      // without this the Scheduled view fetches Drafts unfiltered (showing every
      // draft) and a real folder can fetch while scheduled_only is still stale.
      {
        const ops = filterOpsRef.current;
        const nav = navFolder.toLowerCase();
        if (nav === "scheduled") {
          ops.applyFilters({ scheduledOnly: true });
        } else if (nav === "starred") {
          ops.applyFilters({ starred: true });
        } else if (nav === "important") {
          ops.applyFilters({ important: true });
        } else if (!VIRTUAL_FOLDERS.has(nav)) {
          ops.clearFilters();
        }
      }

      // Important/Starred are flag-views over the inbox. Apply the flag filter
      // and fetch the underlying folder (INBOX) WITH the filter set, so the
      // server returns the full matching set (e.g. all sender-flagged-important
      // inbox messages) instead of client-filtering whatever page is loaded.
      if (isVirtual) {
        const ops = filterOpsRef.current;
        if (navFolder === "starred") {
          ops.applyFilters({ starred: true });
        } else if (navFolder === "important") {
          ops.applyFilters({ important: true });
        } else if (navFolder === "scheduled") {
          ops.applyFilters({ scheduledOnly: true });
        }

        const account = target
          ? { accountId: target.accountId, consolidated: false }
          : resolveAccountContext();
        if (account !== null) {
          void loadFolderWithFallback(account, fetchFolder, {
            forceRefresh: false,
          });
        }
        return;
      }

      if (isPagination) {
        if (fetchFolder === serviceFolderOps.selectedFolder) {
          const account = target
            ? { accountId: target.accountId, consolidated: false }
            : resolveAccountContext();
          if (account !== null) {
            void loadFolderWithFallback(account, fetchFolder, {
              forceRefresh,
              limit: pageSize,
            });
          }
        }
        return;
      }

      // Debounce the API call. No abort signal, in-flight requests complete
      // and cache their results for later use.
      selectFolderTimeoutRef.current = setTimeout(() => {
        const account = target
          ? { accountId: target.accountId, consolidated: false }
          : resolveAccountContext();
        if (account !== null) {
          void loadFolderWithFallback(account, fetchFolder, { forceRefresh });
        }
      }, 150);
    },
    [
      inbox,
      accounts,
      serviceFolderOps,
      selectedFolderPersistenceKey,
      isPagination,
      pageSize,
      resolveAccountContext,
      resolveFolderForFetch,
      loadFolderWithFallback,
      setSelectedNav,
      selectedFolderTarget,
      setSelectedAccount,
    ],
  );

  // Load messages for folder
  const loadFolderMessages = useCallback(
    async (folderId: string) => {
      const { fetchFolder, forceRefresh, isVirtual, navFolder, serviceFolder } =
        resolveFolderForFetch(folderId);
      inbox.clearSelection();
      setSelectedNav(navFolder);
      await serviceFolderOps.selectFolder(serviceFolder);

      if (isVirtual) {
        return;
      }

      const account = resolveAccountContext();
      if (account !== null) {
        await loadFolderWithFallback(account, fetchFolder, { forceRefresh });
      }
    },
    [
      inbox,
      serviceFolderOps,
      resolveAccountContext,
      resolveFolderForFetch,
      loadFolderWithFallback,
    ],
  );

  // Refresh folders
  const refreshFolders = useCallback(async () => {
    const account = resolveAccountContext();
    if (account !== null) {
      // Bump the current account to the FRONT of the sync queue and kick the driver, so
      // Refresh triggers a real re-sync (not just a mirror re-read of the same rows).
      const accountIds = account.consolidated
        ? (account.accountIds ?? [])
        : typeof account.accountId === "number"
          ? [account.accountId]
          : [];
      void refreshAccountSync(accountIds);

      if (account.consolidated) {
        await serviceFolderOps.loadConsolidatedFolders(
          account.accountIds ?? [],
          true,
        );
      } else {
        await serviceFolderOps.loadFolders(account.accountId, true);
      }
      await inbox.refreshMessages();
    }
  }, [resolveAccountContext, serviceFolderOps, inbox]);

  // Cheap folder-only reload from the DB mirror (force=false → no live IMAP, no
  // message refetch). Used to poll sync progress so per-folder loaders cascade
  // and footer counters climb without burning the expensive IMAP budget.
  const reloadFolders = useCallback(async () => {
    const account = resolveAccountContext();
    if (account === null) {
      return;
    }
    if (account.consolidated) {
      await serviceFolderOps.loadConsolidatedFolders(
        account.accountIds ?? [],
        false,
      );
    } else {
      await serviceFolderOps.loadFolders(account.accountId, false);
    }
  }, [resolveAccountContext, serviceFolderOps]);

  // CRUD operations, delegate to FolderService via InboxContext
  const createFolderOp = useCallback(
    async (
      name: string,
      parentId?: number | null,
    ): Promise<FolderOperationResult> => {
      const account = resolveAccountContext();
      if (account === null)
        return { success: false, error: "No account selected" };

      if (account.consolidated) {
        const accountIds = account.accountIds ?? [];
        if (accountIds.length === 0) {
          return { success: false, error: "No account selected" };
        }

        const results: Array<{ accountId: number; result: FolderResult }> = [];
        for (const accountId of accountIds) {
          results.push({
            accountId,
            result: await serviceFolderOps.createFolder(accountId, {
              name,
              parentId,
            }),
          });
        }
        const failures = results.filter(({ result }) => !result.success);

        await serviceFolderOps.loadConsolidatedFolders(accountIds, true);

        if (failures.length > 0) {
          return {
            success: false,
            error: failures
              .map(
                ({ accountId, result }) =>
                  `${accountId}: ${result.error ?? "Failed to create folder"}`,
              )
              .join("; "),
          };
        }

        const queued = results.some(({ result }) => Boolean(result.queued));
        return queued
          ? { success: true, queued }
          : { success: true, error: undefined };
      }

      if (typeof account.accountId !== "number") {
        return { success: false, error: "No account selected" };
      }

      const result = await serviceFolderOps.createFolder(account.accountId, {
        name,
        parentId,
      });
      return result.queued
        ? { success: result.success, queued: true, error: result.error }
        : { success: result.success, error: result.error };
    },
    [resolveAccountContext, serviceFolderOps],
  );

  const renameFolderOp = useCallback(
    async (
      path: string,
      newName: string,
      parentId?: number | null,
    ): Promise<FolderOperationResult> => {
      const accountId = resolveAccountId();
      if (accountId === null)
        return { success: false, error: "No account selected" };
      const result = await serviceFolderOps.renameFolder(
        accountId,
        path,
        newName,
        parentId,
      );
      return { success: result.success, error: result.error };
    },
    [resolveAccountId, serviceFolderOps],
  );

  const deleteFolderOp = useCallback(
    async (path: string): Promise<FolderOperationResult> => {
      const accountId = resolveAccountId();
      if (accountId === null)
        return { success: false, error: "No account selected" };
      const result = await serviceFolderOps.deleteFolder(accountId, path);
      return { success: result.success, error: result.error };
    },
    [resolveAccountId, serviceFolderOps],
  );

  const isFolderSystem = useCallback(
    (path: string): boolean => {
      const folder = normalizedFolders.find(
        (f) => f.path.toLowerCase() === path.toLowerCase(),
      );
      return folder?.isSystem === true;
    },
    [normalizedFolders],
  );

  // Determine selected folder - prefer service value
  const currentSelectedFolder =
    serviceFolderOps.selectedFolder || selectedNav || null;

  return useMemo(
    () => ({
      // State
      folders: serviceFolderOps.folders,
      normalizedFolders,
      virtualFolderCounts,
      selectedFolder: currentSelectedFolder,
      selectedFolderTarget,
      selectedNav,
      isLoading: serviceFolderOps.isFoldersLoading,
      provider,

      // Selection
      selectFolder,
      selectNav: setSelectedNav,

      // Folder Operations
      getNormalizedFolders: () => normalizedFolders,
      getFolderByPath,
      getSystemFolder,
      refreshFolders,
      reloadFolders,
      loadFolderMessages,

      // Count updates
      decrementUnseenCount,
      adjustFolderCounts,

      // CRUD Operations
      createFolder: createFolderOp,
      renameFolder: renameFolderOp,
      deleteFolder: deleteFolderOp,
      isFolderSystem,

      // System Folders
      getInboxFolder,
      getSentFolder,
      getDraftsFolder,
      getTrashFolder,
      getArchiveFolder,
    }),
    [
      serviceFolderOps.folders,
      serviceFolderOps.isFoldersLoading,
      normalizedFolders,
      virtualFolderCounts,
      currentSelectedFolder,
      selectedFolderTarget,
      selectedNav,
      provider,
      selectFolder,
      getFolderByPath,
      getSystemFolder,
      refreshFolders,
      reloadFolders,
      loadFolderMessages,
      decrementUnseenCount,
      adjustFolderCounts,
      createFolderOp,
      renameFolderOp,
      deleteFolderOp,
      isFolderSystem,
      getInboxFolder,
      getSentFolder,
      getDraftsFolder,
      getTrashFolder,
      getArchiveFolder,
    ],
  );
}

export default useFolderOperations;
