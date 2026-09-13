/**
 * Folder Service Implementation
 *
 * Implements IFolderOperations for IMAP folder management.
 * Handles folder listing, caching, system folder mapping, and folder operations.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";
import type {
  IFolderOperations,
  ImapFolder,
  SystemFolderType,
  FolderResult,
  FolderListResult,
  CreateFolderOptions,
  ICacheService,
  VirtualFlagCount,
  VirtualFolderCounts,
} from "../interfaces";
import type { IConnectionStateService } from "../interfaces/connection-state.interface";
import { isAuthError } from "./connection-state.service";
import {
  buildApiUrl,
  messagesFoldersRouteApi,
  routeApiPrefix,
} from "@/context/Strings";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import {
  apiFetch,
  isAbortError,
  isNetworkFetchError,
  isRequestTimeoutError,
} from "@/lib/api-client";
import {
  buildConsolidatedAccountScopeKey,
  normalizeConsolidatedAccountIds,
} from "@/lib/consolidated-account-scope";
import { sortMailFoldersByWorkflow } from "@/lib/mail-folder-order";
import {
  buildPerAccountPathDestination,
  collectPerAccountFolderUnion,
  CONSOLIDATED_ACCOUNT_PATH_PREFIX,
} from "@/lib/folder-destination";

interface FolderListApiResponse {
  status?: string;
  folders?: ImapFolder[];
  folder_tree?: ImapFolder[];
  message?: string;
  cached?: boolean;
  counts_partial?: boolean;
  virtual_counts?: {
    important?: unknown;
    starred?: unknown;
  };
}

const emptyVirtualFolderCounts = (): VirtualFolderCounts => ({
  important: { count: 0, partial: false },
  starred: { count: 0, partial: false },
});

function normalizeVirtualFlagCount(raw: unknown): VirtualFlagCount | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as { count?: unknown; partial?: unknown };
  if (
    typeof record.count !== "number" ||
    !Number.isFinite(record.count) ||
    record.count < 0 ||
    typeof record.partial !== "boolean"
  ) {
    return undefined;
  }

  return {
    count: Math.floor(record.count),
    partial: record.partial === true,
  };
}

/** Preserve only complete, authoritative Important/Starred snapshots. */
function normalizeVirtualFolderCounts(
  raw: FolderListApiResponse["virtual_counts"],
): VirtualFolderCounts | undefined {
  const important = normalizeVirtualFlagCount(raw?.important);
  const starred = normalizeVirtualFlagCount(raw?.starred);

  return important && starred ? { important, starred } : undefined;
}

interface FolderCollectionApiResponse {
  status?: string;
  folders?: ImapFolder[];
  message?: string;
}

interface FolderOperationApiResponse {
  status?: string;
  folder?: Partial<ImapFolder> & {
    create_status?: ImapFolder["createStatus"];
    create_error?: string | null;
    unread_count?: number;
    total_count?: number;
  };
  message?: string;
  queued?: boolean;
}

/**
 * System folder name mappings by provider.
 * Maps provider-specific folder names to our standard types.
 */
const SYSTEM_FOLDER_MAPPINGS: Record<
  string,
  Record<string, SystemFolderType>
> = {
  gmail: {
    inbox: "inbox",
    "[gmail]/sent mail": "sent",
    "[gmail]/drafts": "drafts",
    "[gmail]/trash": "trash",
    "[gmail]/spam": "spam",
  },
  outlook: {
    inbox: "inbox",
    "sent items": "sent",
    sent: "sent",
    drafts: "drafts",
    "deleted items": "trash",
    "junk email": "spam",
    junk: "spam",
    archive: "archive",
    outbox: "outbox",
  },
  generic: {
    inbox: "inbox",
    sent: "sent",
    "sent items": "sent",
    "sent mail": "sent",
    drafts: "drafts",
    draft: "drafts",
    trash: "trash",
    deleted: "trash",
    "deleted items": "trash",
    spam: "spam",
    junk: "spam",
    "junk email": "spam",
    "bulk mail": "spam",
    archive: "archive",
    archives: "archive",
    outbox: "outbox",
    templates: "templates",
  },
};

/**
 * Normalize a folder path for comparison.
 */
function normalizeFolderPath(path: string): string {
  return path.toLowerCase().trim().replace(/\/+$/, "").replace(/^\/+/, "");
}

function normalizeFolderName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeOperationFolder(
  folder: FolderOperationApiResponse["folder"],
): ImapFolder | undefined {
  if (!folder || typeof folder !== "object") {
    return undefined;
  }

  const path =
    folder.path ??
    folder.imapPath ??
    folder.imap_path ??
    (typeof folder.name === "string" ? folder.name : "");
  const name = typeof folder.name === "string" ? folder.name : path;
  const count =
    typeof folder.count === "number"
      ? folder.count
      : typeof folder.total_count === "number"
        ? folder.total_count
        : 0;
  const unseen =
    typeof folder.unseen === "number"
      ? folder.unseen
      : typeof folder.unread_count === "number"
        ? folder.unread_count
        : undefined;
  const createStatus = folder.createStatus ?? folder.create_status;
  const createError = folder.createError ?? folder.create_error ?? null;

  return {
    ...folder,
    name,
    path,
    count,
    unseen,
    createStatus,
    createError,
    queued: Boolean(folder.queued),
  };
}

/**
 * Detect the provider's real "All Mail" folder so it can be hidden from the
 * folder list entirely. PressedMail no longer surfaces an All Mail view, so
 * the provider's all-mail folder (e.g. Gmail's [Gmail]/All Mail) must never
 * appear as a selectable folder.
 */
function isProviderAllMailFolder(folder: ImapFolder): boolean {
  // The `all` role is retained internally (Gmail archive targets \All), but the
  // folder must never be surfaced. Catch it by role/systemType too.
  const role = normalizeFolderName(
    (folder as ImapFolder & { role?: string; systemType?: string })
      .systemType ??
      (folder as ImapFolder & { role?: string }).role ??
      "",
  );
  if (role === "all") {
    return true;
  }

  const normalizedName = normalizeFolderName(folder.name ?? "");
  if (normalizedName === "all mail" || normalizedName === "all") {
    return true;
  }

  const normalizedPath = normalizeFolderPath(folder.path ?? "");
  return (
    normalizedPath === "[gmail]/all mail" ||
    normalizedPath === "all mail" ||
    normalizedPath === "all" ||
    normalizedPath.endsWith("/all mail")
  );
}

function normalizeSystemFolderType(
  value: string | undefined | null,
): SystemFolderType | undefined {
  const normalized = normalizeFolderName(value ?? "");
  if (!normalized) {
    return undefined;
  }

  if (normalized === "junk") {
    return "spam";
  }

  if (
    [
      "inbox",
      "sent",
      "drafts",
      "trash",
      "archive",
      "spam",
      "all",
      "outbox",
      "templates",
    ].includes(normalized)
  ) {
    return normalized as SystemFolderType;
  }

  return undefined;
}

/**
 * Detect the email provider from folder list.
 */
function detectProvider(
  folders: ImapFolder[],
): "gmail" | "outlook" | "generic" {
  const flatList = flattenFolders(folders);
  const paths = flatList.map((f) => normalizeFolderPath(f.path));

  // Check for Gmail-specific folders
  if (paths.some((p) => p.includes("[gmail]"))) {
    return "gmail";
  }

  // Check for Outlook-specific folders
  if (
    paths.some(
      (p) => p === "sent items" || p === "deleted items" || p === "junk email",
    )
  ) {
    return "outlook";
  }

  return "generic";
}

/**
 * Flatten a nested folder structure into a single array.
 */
function flattenFolders(folders: ImapFolder[]): ImapFolder[] {
  const result: ImapFolder[] = [];

  function traverse(folderList: ImapFolder[]): void {
    for (const folder of folderList) {
      result.push(folder);
      if (folder.children && folder.children.length > 0) {
        traverse(folder.children);
      }
    }
  }

  traverse(folders);
  return result;
}

/**
 * Add system folder type annotations to folders.
 */
function annotateSystemFolders(
  folders: ImapFolder[],
  provider: "gmail" | "outlook" | "generic",
): ImapFolder[] {
  const mappings =
    SYSTEM_FOLDER_MAPPINGS[provider] ?? SYSTEM_FOLDER_MAPPINGS.generic;

  function annotateFolder(folder: ImapFolder): ImapFolder {
    const normalizedPath = normalizeFolderPath(folder.path);
    const normalizedName = folder.name.toLowerCase().trim();
    const genericMappings = SYSTEM_FOLDER_MAPPINGS.generic;
    const explicitType =
      normalizeSystemFolderType(folder.systemType) ??
      normalizeSystemFolderType(
        (folder as ImapFolder & { role?: string }).role,
      ) ??
      normalizeSystemFolderType(folder.type);

    // Check path first, then name
    const systemType =
      explicitType ??
      mappings?.[normalizedPath] ??
      mappings?.[normalizedName] ??
      genericMappings?.[normalizedPath] ??
      genericMappings?.[normalizedName];

    return {
      ...folder,
      systemType,
      children: folder.children?.map(annotateFolder),
    };
  }

  return folders.map(annotateFolder);
}

interface ConsolidatedFolderList {
  accountId: number;
  folders: ImapFolder[];
  folderTree?: ImapFolder[];
}

function buildFolderTreeFromFlat(folders: ImapFolder[]): ImapFolder[] {
  const nodes = new Map<number, ImapFolder>();
  const roots: ImapFolder[] = [];

  for (const folder of folders) {
    if (typeof folder.id === "number" && folder.id > 0) {
      nodes.set(folder.id, { ...folder, children: [] });
    }
  }

  for (const folder of folders) {
    if (typeof folder.id !== "number" || folder.id <= 0) continue;
    const node = nodes.get(folder.id);
    if (!node) continue;
    const parentId = folder.parentId ?? folder.parent_id ?? null;
    const parent =
      typeof parentId === "number" ? nodes.get(parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }

  for (const folder of folders) {
    if (typeof folder.id !== "number" || folder.id <= 0) {
      roots.push({ ...folder, children: folder.children ?? [] });
    }
  }

  return roots;
}

function reconcileFolderTreeWithFlat(
  tree: ImapFolder[],
  flatFolders: ImapFolder[],
): ImapFolder[] {
  const byId = new Map(
    flatFolders.flatMap((folder) =>
      typeof folder.id === "number" ? [[folder.id, folder] as const] : [],
    ),
  );

  const visit = (folder: ImapFolder): ImapFolder => {
    const flat =
      typeof folder.id === "number" ? byId.get(folder.id) : undefined;
    return {
      ...folder,
      ...flat,
      children: (folder.children ?? []).map(visit),
    };
  };

  return tree.map(visit);
}

function filterVisibleProviderTree(folders: ImapFolder[]): ImapFolder[] {
  return folders.flatMap((folder) => {
    const children = filterVisibleProviderTree(folder.children ?? []);
    if (
      isProviderAllMailFolder(folder) ||
      isProviderVirtualStateFolder(folder)
    ) {
      return children;
    }
    return [{ ...folder, children }];
  });
}

function getConsolidatedMergeKey(folder: ImapFolder): string {
  if (folder.systemType) {
    return `system:${folder.systemType}`;
  }

  const normalizedName = normalizeFolderName(folder.name || folder.path);
  return `name:${normalizedName || normalizeFolderPath(folder.path)}`;
}

function isGmailLabelOnlyFolder(folder: ImapFolder): boolean {
  const normalizedPath = normalizeFolderPath(folder.path || folder.name);
  const normalizedName = normalizeFolderName(folder.name || folder.path);

  return (
    normalizedPath === "[gmail]/notes" ||
    normalizedPath === "notes" ||
    normalizedName === "notes"
  );
}

function isProviderVirtualStateFolder(folder: ImapFolder): boolean {
  const normalizedPath = normalizeFolderPath(folder.path || folder.name);
  const normalizedName = normalizeFolderName(folder.name || folder.path);
  const explicitRole = normalizeFolderName(
    (folder as ImapFolder & { role?: string; systemType?: string })
      .systemType ??
      (folder as ImapFolder & { role?: string }).role ??
      "",
  );
  const candidates = new Set([normalizedPath, normalizedName, explicitRole]);

  return (
    candidates.has("important") ||
    candidates.has("[gmail]/important") ||
    candidates.has("starred") ||
    candidates.has("[gmail]/starred") ||
    candidates.has("flagged") ||
    candidates.has("scheduled") ||
    candidates.has("snoozed") ||
    normalizedPath.endsWith("/important") ||
    normalizedPath.endsWith("/starred") ||
    normalizedPath.endsWith("/flagged") ||
    normalizedPath.endsWith("/scheduled") ||
    normalizedPath.endsWith("/snoozed")
  );
}

function shouldSkipConsolidatedFolder(
  folder: ImapFolder,
  provider: "gmail" | "outlook" | "generic",
): boolean {
  if (folder.selectable === false) {
    return true;
  }

  if (isProviderVirtualStateFolder(folder)) {
    return true;
  }

  if (provider === "gmail" && isGmailLabelOnlyFolder(folder)) {
    return true;
  }

  return false;
}

function mergeSourceFolders(
  existing: ImapFolder["sourceFolders"],
  source: NonNullable<ImapFolder["sourceFolders"]>[number],
): NonNullable<ImapFolder["sourceFolders"]> {
  const sources = existing ? [...existing] : [];
  const hasSource = sources.some(
    (item) =>
      item.accountId === source.accountId &&
      normalizeFolderPath(item.path) === normalizeFolderPath(source.path),
  );

  if (!hasSource) {
    sources.push(source);
  }

  return sources;
}

function mergeSourceAccountIds(
  existing: ImapFolder["sourceAccountIds"],
  accountId: number,
): number[] {
  return Array.from(new Set([...(existing ?? []), accountId]));
}

function mergeConsolidatedFolders(
  folderLists: ConsolidatedFolderList[],
): ImapFolder[] {
  const mergedByKey = new Map<string, ImapFolder>();
  const accountTrees: ImapFolder[] = [];

  for (const { accountId, folders, folderTree } of folderLists) {
    const provider = detectProvider(folders);
    const annotatedFolders = annotateSystemFolders(folders, provider);
    const annotatedTree = annotateSystemFolders(
      folderTree ?? buildFolderTreeFromFlat(folders),
      provider,
    );
    const countedMergeKeys = new Set<string>();

    for (const folder of flattenFolders(annotatedFolders)) {
      const folderPath = folder.path || folder.name;
      if (!folderPath || shouldSkipConsolidatedFolder(folder, provider)) {
        continue;
      }

      // Only canonical system/virtual roles are merged across accounts. Real
      // provider trees are retained below under their owning account.
      if (!folder.systemType) {
        continue;
      }

      const mergeKey = getConsolidatedMergeKey(folder);
      const accountMergeKey = `${accountId}:${mergeKey}`;
      if (countedMergeKeys.has(accountMergeKey)) {
        continue;
      }
      countedMergeKeys.add(accountMergeKey);

      const count = Number.isFinite(folder.count) ? folder.count : 0;
      const unseen = Number.isFinite(folder.unseen ?? 0)
        ? (folder.unseen ?? 0)
        : 0;
      const sourceFolder = {
        accountId,
        path: folderPath,
        name: folder.name,
      };
      const existing = mergedByKey.get(mergeKey);

      if (!existing) {
        mergedByKey.set(mergeKey, {
          ...folder,
          // A merged folder belongs to EVERY contributing account, carrying
          // the first account's id/accountId made folderMutationTarget emit an
          // account-bound FolderTarget that hard-failed for every other
          // account's messages. String-path targets take the per-account
          // sourceFolders remap instead.
          id: undefined,
          accountId: undefined,
          path: folderPath,
          count,
          unseen,
          children: undefined,
          sourceAccountIds: [accountId],
          sourceFolders: [sourceFolder],
        });
        continue;
      }

      mergedByKey.set(mergeKey, {
        ...existing,
        count: existing.count + count,
        unseen: (existing.unseen ?? 0) + unseen,
        selectable:
          existing.selectable !== false || folder.selectable !== false,
        systemType: existing.systemType ?? folder.systemType,
        sourceAccountIds: mergeSourceAccountIds(
          existing.sourceAccountIds,
          accountId,
        ),
        sourceFolders: mergeSourceFolders(existing.sourceFolders, sourceFolder),
      });
    }

    const retainRealTree = (folder: ImapFolder): ImapFolder[] => {
      if (
        isProviderAllMailFolder(folder) ||
        isProviderVirtualStateFolder(folder) ||
        (provider === "gmail" && isGmailLabelOnlyFolder(folder))
      ) {
        return [];
      }

      const children = (folder.children ?? []).flatMap(retainRealTree);
      if (folder.systemType) {
        return children;
      }

      return [
        {
          ...folder,
          accountId,
          children,
          sourceAccountIds: [accountId],
          sourceFolders: [{ accountId, path: folder.path, name: folder.name }],
        },
      ];
    };

    const realTree = annotatedTree.flatMap(retainRealTree);
    if (realTree.length > 0) {
      const sum = (nodes: ImapFolder[], field: "count" | "unseen"): number =>
        nodes.reduce(
          (total, node) =>
            total +
            (Number.isFinite(node[field] ?? 0) ? Number(node[field] ?? 0) : 0) +
            sum(node.children ?? [], field),
          0,
        );
      accountTrees.push({
        id: -accountId,
        accountId,
        name: `Account ${accountId}`,
        path: `pressedmail-account://${accountId}`,
        count: sum(realTree, "count"),
        unseen: sum(realTree, "unseen"),
        selectable: false,
        canHaveChildren: false,
        children: realTree,
        sourceAccountIds: [accountId],
      });
    }
  }

  return [
    ...sortMailFoldersByWorkflow(Array.from(mergedByKey.values())),
    ...accountTrees,
  ];
}

/**
 * Detect aborted fetches so we can avoid treating them as hard failures.
 */
/**
 * Extract a readable error message from common WP REST/API payload shapes.
 */
function extractApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const candidateKeys = ["message", "error", "detail", "title"] as const;
  const record = payload as Record<string, unknown>;

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const nested = record.data;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    for (const key of candidateKeys) {
      const value = nestedRecord[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

function isFolderPathMatch(folder: ImapFolder, path: string): boolean {
  const normalizedTarget = normalizeFolderPath(path);
  const candidates = [folder.path, folder.imapPath, folder.imap_path].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return candidates.some(
    (candidate) => normalizeFolderPath(candidate) === normalizedTarget,
  );
}

/**
 * Build a detailed HTTP error including server payload details when available.
 */
async function buildHttpError(response: Response): Promise<Error> {
  let serverMessage = "";
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as unknown;
      serverMessage = extractApiErrorMessage(payload);
    } catch {
      // Ignore parse errors and fall back to text/auth defaults.
    }
  }

  if (!serverMessage) {
    try {
      const text = (await response.text()).trim();
      if (text) {
        serverMessage = text.replace(/\s+/g, " ").slice(0, 300);
      }
    } catch {
      // Ignore body read failures.
    }
  }

  if (!serverMessage && (response.status === 401 || response.status === 403)) {
    serverMessage =
      "Authentication failed. Please check your email account credentials.";
  }

  return new Error(
    `HTTP error: ${response.status}${serverMessage ? ` - ${serverMessage}` : ""}`,
  );
}

/**
 * Folder Service Implementation
 *
 * Implements IFolderOperations for IMAP folder management.
 */
export class FolderService implements IFolderOperations {
  private cache: ICacheService | null;
  private connectionState: IConnectionStateService | null;
  private _folders: ImapFolder[] = [];
  private _selectedFolder = "INBOX";
  private _isLoading = false;
  private _flatFolderList: ImapFolder[] = [];
  private _provider: "gmail" | "outlook" | "generic" = "generic";

  // Request deduplication: track in-flight loads by accountId+forceRefresh
  private _pendingLoad = new Map<string, Promise<FolderListResult>>();

  // Bounded retry budget for counts_partial recovery, per account. A folder load
  // that reports partial IMAP STATUS counts schedules ONE follow-up force-refresh
  // with exponential backoff, capped, never an unbounded 5s retry loop (which,
  // on a large account whose STATUS keeps partialling, hammered live IMAP forever
  // and thrashed re-renders).
  private static readonly COUNTS_PARTIAL_MAX_RETRIES = 4;
  private static readonly COUNTS_PARTIAL_BASE_MS = 5_000;
  private _countsPartialRetries = new Map<string, number>();
  private _countsPartialTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  // Monotonic load generation. reset() (account/scope switch) bumps it; a folder
  // load captures it at entry and refuses to apply its result if the generation
  // moved on while its fetch was in flight, so a slow load for the PREVIOUS
  // account can never clobber the new account's folders after a switch. (The
  // AbortController handles most cases; this closes the resolved-but-not-yet-
  // applied window.)
  private _loadGeneration = 0;

  // Abort controllers for in-flight folder fetches, so a context reset can
  // cancel work that would otherwise complete and overwrite the new context.
  private _activeFolderControllers = new Set<AbortController>();

  // Timestamp of last successful folder load (cache hit or API)
  private _lastLoadedAt = 0;

  // Folder caches contain only real IMAP folders, so virtual counts are kept as
  // separate authoritative per-account snapshots. Consolidated scopes sum the
  // selected accounts and OR their partial flags.
  private _accountVirtualFolderCounts = new Map<number, VirtualFolderCounts>();
  private _virtualFolderCounts: VirtualFolderCounts =
    emptyVirtualFolderCounts();

  // useSyncExternalStore support
  private _listeners = new Set<() => void>();
  private _version = 0;

  constructor(
    cache?: ICacheService,
    connectionState?: IConnectionStateService,
  ) {
    this.cache = cache ?? null;
    this.connectionState = connectionState ?? null;
  }

  // ============== useSyncExternalStore ==============

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getSnapshot(): number {
    return this._version;
  }

  private notify(): void {
    this._version++;
    this._listeners.forEach((l) => l());
  }

  // ============== State Accessors ==============

  get folders(): ImapFolder[] {
    return this._folders;
  }

  get selectedFolder(): string {
    return this._selectedFolder;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get lastLoadedAt(): number {
    return this._lastLoadedAt;
  }

  get flatFolderList(): ImapFolder[] {
    return this._flatFolderList;
  }

  get virtualFolderCounts(): VirtualFolderCounts {
    return this._virtualFolderCounts;
  }

  private _publishVirtualFolderCounts(
    accountIds: Array<string | number>,
    fresh?: Map<number, VirtualFolderCounts>,
  ): void {
    if (fresh) {
      for (const [accountId, counts] of fresh) {
        this._accountVirtualFolderCounts.set(accountId, counts);
      }
    }

    const totals = emptyVirtualFolderCounts();
    for (const accountId of accountIds) {
      const remembered = this._accountVirtualFolderCounts.get(
        Number(accountId),
      );
      if (!remembered) {
        continue;
      }

      totals.important.count += remembered.important.count;
      totals.important.partial =
        totals.important.partial || remembered.important.partial;
      totals.starred.count += remembered.starred.count;
      totals.starred.partial =
        totals.starred.partial || remembered.starred.partial;
    }
    this._virtualFolderCounts = totals;
  }

  private _hasVirtualFolderCountsFor(
    accountIds: Array<string | number>,
  ): boolean {
    return accountIds.every((accountId) =>
      this._accountVirtualFolderCounts.has(Number(accountId)),
    );
  }

  // ============== Core Operations ==============

  async loadFolders(
    accountId: string | number,
    forceRefresh = false,
  ): Promise<FolderListResult> {
    // Deduplication: if an identical request is in-flight, return its promise
    const dedupeKey = `${accountId}:${forceRefresh ? "force" : "cached"}`;
    const existing = this._pendingLoad.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const controller = new AbortController();
    this._activeFolderControllers.add(controller);
    const loadPromise = this._doLoadFolders(
      accountId,
      forceRefresh,
      controller.signal,
    );
    this._pendingLoad.set(dedupeKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this._activeFolderControllers.delete(controller);
      this._pendingLoad.delete(dedupeKey);
    }
  }

  async loadConsolidatedFolders(
    accountIds: number[],
    forceRefresh = false,
  ): Promise<FolderListResult> {
    const normalizedAccountIds = normalizeConsolidatedAccountIds(accountIds);
    const scopeKey = buildConsolidatedAccountScopeKey(normalizedAccountIds);

    if (normalizedAccountIds.length === 0) {
      this._folders = [];
      this._flatFolderList = [];
      this._provider = "generic";
      this._virtualFolderCounts = emptyVirtualFolderCounts();
      this._lastLoadedAt = Date.now();
      this.notify();
      return { success: true, folders: [] };
    }

    const dedupeKey = `${scopeKey}:${forceRefresh ? "force" : "cached"}`;
    const existing = this._pendingLoad.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const controller = new AbortController();
    this._activeFolderControllers.add(controller);
    const loadPromise = this._doLoadConsolidatedFolders(
      normalizedAccountIds,
      scopeKey,
      forceRefresh,
      controller.signal,
    );
    this._pendingLoad.set(dedupeKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this._activeFolderControllers.delete(controller);
      this._pendingLoad.delete(dedupeKey);
    }
  }

  private async _fetchFolderList(
    accountId: string | number,
    forceRefresh: boolean,
    signal?: AbortSignal,
  ): Promise<FolderListApiResponse> {
    const numericId = Number(accountId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return { status: "error", message: "Invalid account ID" };
    }
    const baseUrl = `${messagesFoldersRouteApi}${accountId}`;
    const url = buildApiUrl(baseUrl, {
      force: forceRefresh ? 1 : undefined,
      ...getMailboxSourceRequestParams(),
    });
    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw await buildHttpError(response);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Server returned non-JSON response");
    }

    return response.json();
  }

  private async _doLoadConsolidatedFolders(
    accountIds: number[],
    scopeKey: string,
    forceRefresh: boolean,
    signal?: AbortSignal,
  ): Promise<FolderListResult> {
    const startGeneration = this._loadGeneration;
    if (
      !forceRefresh &&
      this.cache &&
      this._hasVirtualFolderCountsFor(accountIds)
    ) {
      const cachedFolders = this.cache.getFolders(scopeKey);
      if (cachedFolders && cachedFolders.length > 0) {
        // Hide the provider's real All Mail folder so it never appears in the
        // consolidated list. Filtering here keeps cached and returned arrays
        // in agreement even if a stale cache entry still contains it.
        const visibleFolders = cachedFolders.filter(
          (folder) =>
            !isProviderAllMailFolder(folder) &&
            !isProviderVirtualStateFolder(folder),
        );
        const orderedFolders = sortMailFoldersByWorkflow(visibleFolders);
        this._folders = orderedFolders;
        this._flatFolderList = flattenFolders(orderedFolders);
        this._provider = detectProvider(orderedFolders);
        this._publishVirtualFolderCounts(accountIds);
        this._lastLoadedAt = Date.now();
        this.notify();
        return {
          success: true,
          folders: visibleFolders,
          fromCache: true,
        };
      }
    }

    const previousFolders = this._folders;
    this._isLoading = true;
    this.notify();

    try {
      const folderLists: ConsolidatedFolderList[] = [];
      const errors: string[] = [];
      let allFromCache = true;

      // Load each account's folder list concurrently. Serial per-account awaits
      // made an N-account combined inbox N sequential round trips; parallel
      // fetches collapse that to a single round-trip wall-clock. Order is
      // preserved (results indexed by accountIds) so consolidated merge stays
      // deterministic, and per-account failures are isolated.
      const perAccount = await Promise.allSettled(
        accountIds.map(async (accountId) => {
          if (
            !forceRefresh &&
            this.cache &&
            this._accountVirtualFolderCounts.has(accountId)
          ) {
            const cachedFolders = this.cache.getFolders(String(accountId));
            if (cachedFolders && cachedFolders.length > 0) {
              return {
                folders: sortMailFoldersByWorkflow(cachedFolders),
                folderTree: buildFolderTreeFromFlat(cachedFolders),
                fromCache: true,
                virtualCounts: undefined,
              };
            }
          }

          const data = await this._fetchFolderList(
            accountId,
            forceRefresh,
            signal,
          );

          if (data?.status === "error") {
            throw new Error(
              data.message || __("Failed to fetch folders", "pressedmail"),
            );
          }

          const rawFolders = Array.isArray(data?.folders) ? data.folders : [];
          const provider = detectProvider(rawFolders);
          const annotatedFolders = sortMailFoldersByWorkflow(
            annotateSystemFolders(rawFolders, provider),
          );
          const rawFolderTree = Array.isArray(data?.folder_tree)
            ? data.folder_tree
            : buildFolderTreeFromFlat(rawFolders);

          if (this.cache) {
            this.cache.setFolders(String(accountId), annotatedFolders);
          }

          return {
            folders: annotatedFolders,
            folderTree: annotateSystemFolders(rawFolderTree, provider),
            fromCache: false,
            virtualCounts: normalizeVirtualFolderCounts(data?.virtual_counts),
          };
        }),
      );

      const freshVirtualCounts = new Map<number, VirtualFolderCounts>();
      perAccount.forEach((result, index) => {
        const accountId = accountIds[index] as number;
        if (result.status === "fulfilled") {
          folderLists.push({
            accountId,
            folders: result.value.folders,
            folderTree: result.value.folderTree,
          });
          if (result.value.virtualCounts) {
            freshVirtualCounts.set(accountId, result.value.virtualCounts);
          }
          if (!result.value.fromCache) {
            allFromCache = false;
          }
        } else {
          allFromCache = false;
          const errorMsg =
            result.reason instanceof Error
              ? result.reason.message
              : __("Failed to load folders", "pressedmail");
          if (isAuthError(errorMsg) && this.connectionState) {
            this.connectionState.markUnhealthy(String(accountId), errorMsg);
          }
          errors.push(errorMsg);
        }
      });

      if (folderLists.length === 0 && errors.length > 0) {
        return {
          success: false,
          folders: previousFolders,
          error: errors[0],
          authError: errors.some(isAuthError),
        };
      }

      // Hide the provider's real All Mail folder so it never appears in the
      // consolidated list. Filtering here keeps the cached and returned arrays
      // in agreement across every account in the combined inbox.
      const mergedFolders = mergeConsolidatedFolders(folderLists).filter(
        (folder) =>
          !isProviderAllMailFolder(folder) &&
          !isProviderVirtualStateFolder(folder),
      );
      // A newer account/scope switch superseded this load while it was in flight
      // Return its data to the caller but do NOT publish it as the live folders.
      if (startGeneration !== this._loadGeneration) {
        return { success: true, folders: mergedFolders, fromCache: false };
      }
      this._folders = mergedFolders;
      this._flatFolderList = flattenFolders(mergedFolders);
      this._provider = detectProvider(mergedFolders);
      this._publishVirtualFolderCounts(accountIds, freshVirtualCounts);

      if (this.cache) {
        this.cache.setFolders(scopeKey, mergedFolders);
      }

      this._lastLoadedAt = Date.now();
      this.notify();

      return {
        success: true,
        folders: mergedFolders,
        fromCache: allFromCache,
        error: errors.length > 0 ? errors[0] : undefined,
      };
    } finally {
      this._isLoading = false;
      this.notify();
    }
  }

  /**
   * Internal load implementation with state preservation and count merging.
   */
  private async _doLoadFolders(
    accountId: string | number,
    forceRefresh: boolean,
    signal?: AbortSignal,
  ): Promise<FolderListResult> {
    const numericId = Number(accountId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return {
        success: false,
        folders: [],
        error: "Invalid account ID",
        authError: false,
      };
    }
    const startGeneration = this._loadGeneration;
    // Check cache first (unless forcing refresh)
    if (
      !forceRefresh &&
      this.cache &&
      this._hasVirtualFolderCountsFor([numericId])
    ) {
      const cachedFolders = this.cache.getFolders(String(accountId));
      if (cachedFolders && cachedFolders.length > 0) {
        const visibleFolders = cachedFolders.filter(
          (folder) =>
            !isProviderAllMailFolder(folder) &&
            !isProviderVirtualStateFolder(folder),
        );
        const orderedFolders = sortMailFoldersByWorkflow(visibleFolders);
        this._folders = orderedFolders;
        this._flatFolderList = flattenFolders(orderedFolders);
        this._provider = detectProvider(orderedFolders);
        this._publishVirtualFolderCounts([numericId]);
        if (this._lastLoadedAt === 0) {
          this._lastLoadedAt = Date.now();
        }
        this.notify();
        return {
          success: true,
          folders: visibleFolders,
          fromCache: true,
        };
      }
    }

    // Snapshot previous state for fallback on error
    const previousFolders = this._folders;

    this._isLoading = true;
    this.notify();

    try {
      const fetchFolders = async () => {
        const baseUrl = `${messagesFoldersRouteApi}${accountId}`;
        const url = buildApiUrl(baseUrl, {
          force: forceRefresh ? 1 : undefined,
          ...getMailboxSourceRequestParams(),
        });
        const response = await apiFetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal,
        });

        if (!response.ok) {
          throw await buildHttpError(response);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }

        return response.json();
      };

      let data: FolderListApiResponse;
      data = await fetchFolders();

      if (data?.status === "error") {
        const errorMsg =
          data.message || __("Failed to fetch folders", "pressedmail");
        const authDetected = isAuthError(errorMsg);

        // Report auth error to circuit breaker (API returned 200 but body has auth failure)
        if (authDetected && this.connectionState) {
          this.connectionState.markUnhealthy(String(accountId), errorMsg);
        }

        console.error("[FolderService] API error:", errorMsg);
        return {
          success: false,
          folders: previousFolders,
          error: errorMsg,
          authError: authDetected,
        };
      }

      // Process the folders
      const rawFolders: ImapFolder[] = data?.folders || [];
      const freshVirtualCounts = normalizeVirtualFolderCounts(
        data?.virtual_counts,
      );

      // If API returned empty but we had previous data, keep previous state
      if (rawFolders.length === 0 && previousFolders.length > 0) {
        console.warn(
          "[FolderService] API returned empty folders; keeping previous state",
        );
        if (startGeneration === this._loadGeneration) {
          this._publishVirtualFolderCounts(
            [numericId],
            freshVirtualCounts
              ? new Map([[numericId, freshVirtualCounts]])
              : undefined,
          );
          this.notify();
        }
        return {
          success: true,
          folders: previousFolders,
          fromCache: false,
        };
      }

      this._provider = detectProvider(rawFolders);
      const annotatedFolders = sortMailFoldersByWorkflow(
        annotateSystemFolders(rawFolders, this._provider),
      );

      // On force-refresh, merge counts to protect against IMAP STATUS failures
      // that silently return 0 for folders that actually have messages
      const countedFolders =
        forceRefresh && previousFolders.length > 0
          ? this._mergeFolderCounts(annotatedFolders, previousFolders)
          : annotatedFolders;

      // Hide the provider's real All Mail folder so it never appears in the
      // list. Filtering here keeps the cached and returned arrays in agreement.
      const mergedFolders = countedFolders.filter(
        (folder) =>
          !isProviderAllMailFolder(folder) &&
          !isProviderVirtualStateFolder(folder),
      );
      const suppliedTree = Array.isArray(data?.folder_tree)
        ? annotateSystemFolders(data.folder_tree, this._provider)
        : buildFolderTreeFromFlat(mergedFolders);
      const visibleTree = filterVisibleProviderTree(
        reconcileFolderTreeWithFlat(suppliedTree, mergedFolders),
      );

      // A newer account/scope switch superseded this load while its fetch was in
      // flight, hand the data back to the caller but do NOT publish it as the
      // live folder list (that would show the previous account's folders).
      if (startGeneration !== this._loadGeneration) {
        return {
          success: true,
          folders: mergedFolders,
          fromCache: false,
        };
      }

      // Update internal state
      this._folders = visibleTree;
      this._flatFolderList = flattenFolders(visibleTree);
      this._publishVirtualFolderCounts(
        [numericId],
        freshVirtualCounts
          ? new Map([[numericId, freshVirtualCounts]])
          : undefined,
      );

      // Cache the folders
      if (this.cache) {
        this.cache.setFolders(String(accountId), visibleTree);
      }

      this._lastLoadedAt = Date.now();
      this.notify();

      // If the backend reported partial counts (some STATUS queries failed),
      // schedule a BOUNDED, backed-off recovery refresh, never an unbounded
      // 5s loop. A clean (non-partial) load clears the budget below.
      if (data?.counts_partial && !forceRefresh) {
        this._scheduleCountsPartialRetry(accountId);
      } else if (!data?.counts_partial) {
        this._clearCountsPartialRetry(accountId);
      }

      return {
        success: true,
        folders: mergedFolders,
        folderTree: visibleTree,
        fromCache: Boolean(data?.cached),
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          success: false,
          folders: previousFolders,
          error: "Request aborted",
          authError: false,
        };
      }

      const errorMsg =
        error instanceof Error
          ? error.message
          : __("Failed to load folders", "pressedmail");
      const authDetected = isAuthError(errorMsg);

      if (authDetected && this.connectionState) {
        this.connectionState.markUnhealthy(String(accountId), errorMsg);
      }

      if (isNetworkFetchError(error) || isRequestTimeoutError(error)) {
        console.warn("[FolderService] loadFolders network error:", errorMsg);
      } else {
        console.error("[FolderService] loadFolders error:", error);
      }
      return {
        success: false,
        folders: previousFolders,
        error: errorMsg,
        authError: authDetected,
      };
    } finally {
      this._isLoading = false;
      this.notify();
    }
  }

  /**
   * Merge folder counts: when a fresh folder has count=0 but the previous had
   * count>0, keep the previous count. Protects against IMAP STATUS failures
   * that silently return 0.
   */
  private _mergeFolderCounts(
    freshFolders: ImapFolder[],
    previousFolders: ImapFolder[],
  ): ImapFolder[] {
    const previousByPath = new Map<string, ImapFolder>();
    for (const folder of flattenFolders(previousFolders)) {
      previousByPath.set(normalizeFolderPath(folder.path), folder);
    }

    const mergeFolder = (folder: ImapFolder): ImapFolder => {
      const prev = previousByPath.get(normalizeFolderPath(folder.path));
      if (!prev) return folder;

      // A folder coming back with total count 0 while it previously had
      // messages is the signature of a transient IMAP STATUS failure, keep the
      // prior counts. But a fresh unread of 0 while the folder STILL has
      // messages is legitimate (everything was just read), so trust it; keeping
      // the stale unread there is what froze the sidebar badge after reading.
      const statusLikelyFailed = folder.count === 0 && prev.count > 0;
      const mergedCount = statusLikelyFailed ? prev.count : folder.count;
      const mergedUnseen =
        statusLikelyFailed && (prev.unseen ?? 0) > 0
          ? prev.unseen
          : folder.unseen;

      return {
        ...folder,
        count: mergedCount,
        unseen: mergedUnseen,
        children: folder.children?.map(mergeFolder),
      };
    };

    return freshFolders.map(mergeFolder);
  }

  async selectFolder(folderPath: string): Promise<void> {
    this._selectedFolder = folderPath;
    this.notify();
  }

  getSystemFolder(type: SystemFolderType): ImapFolder | undefined {
    return this._flatFolderList.find((f) => f.systemType === type);
  }

  getFolderByPath(path: string): ImapFolder | undefined {
    const normalizedPath = normalizeFolderPath(path);
    return this._flatFolderList.find(
      (f) =>
        normalizeFolderPath(f.path) === normalizedPath ||
        normalizeFolderPath(f.imapPath ?? "") === normalizedPath ||
        normalizeFolderPath(f.imap_path ?? "") === normalizedPath,
    );
  }

  private async resolveFolderRecord(
    accountId: string | number,
    path: string,
  ): Promise<ImapFolder | null> {
    const existingFolder = this.getFolderByPath(path);
    if (existingFolder?.id && existingFolder.id > 0) {
      return existingFolder;
    }

    const response = await apiFetch(`${routeApiPrefix}/folders/${accountId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw await buildHttpError(response);
    }

    const data = (await response.json()) as FolderCollectionApiResponse;

    const folders = Array.isArray(data?.folders) ? data.folders : [];
    const matchedFolder = folders.find((folder) =>
      isFolderPathMatch(folder, path),
    );

    return matchedFolder ?? existingFolder ?? null;
  }

  // ============== Folder Management ==============

  async createFolder(
    accountId: string | number,
    options: CreateFolderOptions,
  ): Promise<FolderResult> {
    try {
      let parentId: number | null = options.parentId ?? null;

      if (parentId === null && options.parentPath) {
        const parentFolder = await this.resolveFolderRecord(
          accountId,
          options.parentPath,
        );
        parentId = parentFolder?.id ?? null;
      }

      const response = await apiFetch(`${routeApiPrefix}/folders/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: accountId,
          name: options.name,
          parent_id: parentId ?? options.parentPath ?? null,
        }),
      });

      const data = (await response.json()) as FolderOperationApiResponse;

      if (!response.ok || data?.status === "error") {
        return {
          success: false,
          error: data?.message || `HTTP error: ${response.status}`,
        };
      }

      // Refresh folder list to include the new folder
      await this.loadFolders(accountId, true);

      const folder = normalizeOperationFolder(data?.folder);
      const queued = Boolean(data?.queued || folder?.queued);

      return { success: true, folder, queued };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to create folder", "pressedmail"),
      };
    }
  }

  async renameFolder(
    accountId: string | number,
    path: string,
    newName: string,
    parentId?: number | null,
  ): Promise<FolderResult> {
    try {
      const folder = await this.resolveFolderRecord(accountId, path);
      if (!folder?.id) {
        return { success: false, error: "Folder not found" };
      }

      const response = await apiFetch(
        `${routeApiPrefix}/folders/update/${folder.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newName,
            ...(parentId !== undefined ? { parent_id: parentId } : {}),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || data?.status === "error") {
        return {
          success: false,
          error: data?.message || `HTTP error: ${response.status}`,
        };
      }

      const refreshed = await this.loadFolders(accountId, true);
      if (isFolderPathMatch({ path } as ImapFolder, this._selectedFolder)) {
        const refreshedFolder = refreshed.folders.find(
          (candidate) => candidate.id === folder.id,
        );
        if (refreshedFolder?.path) {
          this._selectedFolder = refreshedFolder.path;
        }
      }

      return { success: true, folder: data?.folder };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to rename folder", "pressedmail"),
      };
    }
  }

  async deleteFolder(
    accountId: string | number,
    path: string,
  ): Promise<FolderResult> {
    try {
      const folder = await this.resolveFolderRecord(accountId, path);
      if (!folder?.id) {
        return { success: false, error: "Folder not found" };
      }

      const response = await apiFetch(
        `${routeApiPrefix}/folders/delete/${folder.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || data?.status === "error") {
        return {
          success: false,
          error: data?.message || `HTTP error: ${response.status}`,
        };
      }

      if (isFolderPathMatch({ path } as ImapFolder, this._selectedFolder)) {
        this._selectedFolder = "INBOX";
      }

      await this.loadFolders(accountId, true);
      this.notify();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : __("Failed to delete folder", "pressedmail"),
      };
    }
  }

  // ============== Folder Utilities ==============

  getUnreadCount(path: string): number | undefined {
    const folder = this.getFolderByPath(path);
    return folder?.unseen;
  }

  async refreshCounts(
    accountId: string | number,
    paths?: string[],
  ): Promise<void> {
    // Refresh folder counts by reloading folders
    // A more efficient implementation would call a dedicated endpoint
    await this.loadFolders(accountId, true);
  }

  isSystemFolder(path: string): boolean {
    const folder = this.getFolderByPath(path);
    return folder?.systemType !== undefined;
  }

  normalizePath(path: string): string {
    return normalizeFolderPath(path);
  }

  // ============== Additional Utilities ==============

  /**
   * Get the detected email provider for this account.
   */
  getProvider(): "gmail" | "outlook" | "generic" {
    return this._provider;
  }

  /**
   * Find the inbox folder (always returns something).
   */
  getInboxFolder(): ImapFolder {
    const inbox = this.getSystemFolder("inbox");
    if (inbox) return inbox;

    // Fallback to first folder named INBOX or first selectable folder
    const byName = this._flatFolderList.find(
      (f) => f.name.toLowerCase() === "inbox",
    );
    if (byName) return byName;

    const selectable = this._flatFolderList.find((f) => f.selectable !== false);
    if (selectable) return selectable;

    // Ultimate fallback
    return {
      name: "INBOX",
      path: "INBOX",
      count: 0,
      systemType: "inbox",
    };
  }

  /**
   * Get folders suitable for move operations.
   * Excludes special folders that shouldn't be move targets.
   *
   * Consolidated mode returns the merged system folders plus ONE deduped,
   * case-insensitive union of every account's custom folders by name chain.
   * Union entries carry a cross-account destination (`consolidatedDestination`)
   * the server resolves, and creates when missing, per account; the old
   * behavior listed each account's subtree as foreign account-bound targets,
   * which hard-failed for every other account's messages and leaked
   * "Account <id>" labels into the menu.
   */
  getMoveTargetFolders(): ImapFolder[] {
    const accountRoots = this._folders.filter((folder) =>
      String(folder.path ?? "").startsWith(CONSOLIDATED_ACCOUNT_PATH_PREFIX),
    );

    if (accountRoots.length === 0) {
      const targets: ImapFolder[] = [];
      const visit = (folders: ImapFolder[], ancestors: string[]) => {
        for (const folder of folders) {
          const labels = [...ancestors, folder.name || folder.path];
          if (folder.selectable !== false) {
            targets.push({ ...folder, name: labels.join(" / ") });
          }
          visit(folder.children ?? [], labels);
        }
      };
      visit(this._folders, []);
      return targets;
    }

    const targets: ImapFolder[] = [];
    for (const folder of this._folders) {
      if (
        String(folder.path ?? "").startsWith(CONSOLIDATED_ACCOUNT_PATH_PREFIX)
      ) {
        continue;
      }
      if (folder.selectable !== false) {
        targets.push({ ...folder });
      }
    }

    for (const entry of collectPerAccountFolderUnion(this._folders)) {
      targets.push({
        id: undefined,
        accountId: undefined,
        name: entry.displayPath,
        path: entry.displayPath,
        count: entry.count,
        unseen: entry.unseen,
        selectable: true,
        sourceAccountIds: entry.accounts,
        consolidatedDestination: buildPerAccountPathDestination(
          entry.chain,
          entry.chain.join("/"),
          entry.known,
        ),
      });
    }

    return targets;
  }

  /**
   * Check if a folder path represents the trash folder.
   */
  isTrashFolder(path: string): boolean {
    const folder = this.getFolderByPath(path);
    return folder?.systemType === "trash";
  }

  /**
   * Get the trash folder for permanent deletion operations.
   */
  getTrashFolder(): ImapFolder | undefined {
    return this.getSystemFolder("trash");
  }

  /**
   * Get the archive folder.
   */
  getArchiveFolder(): ImapFolder | undefined {
    return this.getSystemFolder("archive");
  }

  /**
   * Abort all in-flight folder fetches so a context switch cannot let a stale
   * folder list complete and overwrite the new context.
   */
  private abortActiveFolderLoads(): void {
    for (const controller of this._activeFolderControllers) {
      controller.abort();
    }
    this._activeFolderControllers.clear();
  }

  /**
   * Optimistically adjust a folder's unread count (e.g. -1 when a message is read,
   * +1 when marked unread) so the sidebar badge updates IMMEDIATELY, without
   * waiting on a live IMAP STATUS round-trip. A subsequent folder refresh
   * reconciles with the server. New folder object identities are produced so
   * React re-renders. No-op if the folder isn't in the list.
   */
  applyUnreadDelta(folderPath: string, delta: number): void {
    if (!folderPath || delta === 0) {
      return;
    }
    const target = normalizeFolderPath(folderPath);
    let changed = false;

    const adjust = (folders: ImapFolder[]): ImapFolder[] =>
      folders.map((folder) => {
        const nextChildren = folder.children
          ? adjust(folder.children)
          : folder.children;
        if (normalizeFolderPath(folder.path) === target) {
          changed = true;
          return {
            ...folder,
            unseen: Math.max(0, (folder.unseen ?? 0) + delta),
            children: nextChildren,
          };
        }
        return nextChildren === folder.children
          ? folder
          : { ...folder, children: nextChildren };
      });

    const nextFolders = adjust(this._folders);
    if (changed) {
      this._folders = nextFolders;
      this._flatFolderList = flattenFolders(nextFolders);
      this.notify();
    }
  }

  /**
   * Schedule a single bounded, backed-off recovery refresh after a partial-count
   * load. Each account gets at most COUNTS_PARTIAL_MAX_RETRIES attempts with
   * exponential backoff (5s, 10s, 20s, 40s); a pending timer is never stacked.
   */
  private _scheduleCountsPartialRetry(accountId: string | number): void {
    const key = String(accountId);
    if (this._countsPartialTimers.has(key)) {
      // A recovery refresh is already queued for this account, don't stack.
      return;
    }
    const attempt = this._countsPartialRetries.get(key) ?? 0;
    if (attempt >= FolderService.COUNTS_PARTIAL_MAX_RETRIES) {
      // Budget exhausted, stop retrying so a persistently-partial STATUS can't
      // hammer live IMAP forever. The next sweep / manual refresh can recover.
      return;
    }
    const delay = FolderService.COUNTS_PARTIAL_BASE_MS * 2 ** attempt;
    this._countsPartialRetries.set(key, attempt + 1);
    const timer = globalThis.setTimeout(() => {
      this._countsPartialTimers.delete(key);
      void this.loadFolders(accountId, true);
    }, delay);
    this._countsPartialTimers.set(key, timer);
  }

  /** Clear the counts_partial retry budget once a clean load succeeds. */
  private _clearCountsPartialRetry(accountId: string | number): void {
    const key = String(accountId);
    this._countsPartialRetries.delete(key);
    const timer = this._countsPartialTimers.get(key);
    if (timer !== undefined) {
      globalThis.clearTimeout(timer);
      this._countsPartialTimers.delete(key);
    }
  }

  /**
   * Clear internal state (useful when switching accounts).
   */
  reset(): void {
    // Supersede any in-flight loads so a slow fetch for the previous account
    // can't publish its folders after this reset (e.g. an account switch).
    this._loadGeneration++;
    this.abortActiveFolderLoads();
    this._folders = [];
    this._flatFolderList = [];
    this._selectedFolder = "INBOX";
    this._isLoading = false;
    this._provider = "generic";
    this._pendingLoad.clear();
    for (const timer of this._countsPartialTimers.values()) {
      globalThis.clearTimeout(timer);
    }
    this._countsPartialTimers.clear();
    this._countsPartialRetries.clear();
    this._lastLoadedAt = 0;
    this._virtualFolderCounts = emptyVirtualFolderCounts();
    this.notify();
  }
}

/**
 * Singleton instance for shared folder operations.
 */
let folderServiceInstance: FolderService | null = null;

/**
 * Get the shared FolderService instance.
 */
export function getFolderService(
  cache?: ICacheService,
  connectionState?: IConnectionStateService,
): FolderService {
  if (!folderServiceInstance) {
    folderServiceInstance = new FolderService(cache, connectionState);
  }
  return folderServiceInstance;
}

/**
 * Reset the folder service (mainly for testing or account switching).
 */
export function resetFolderService(): void {
  if (folderServiceInstance) {
    folderServiceInstance.reset();
  }
  folderServiceInstance = null;
}
