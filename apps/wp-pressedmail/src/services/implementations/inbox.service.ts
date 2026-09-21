/**
 * Inbox Service Implementation
 *
 * Orchestrates message loading, caching, filtering, and pagination.
 * Coordinates CacheService, ThreadingService, and MessageService.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";
import type {
  EmailMessage,
  EmailThread,
  EmailThreadGroupMap,
  GroupedMessage,
} from "@/types";
import type {
  IInboxOperations,
  LoadMessagesOptions,
  LoadMessagesResult,
  RefreshOptions,
  MessageFilters,
  ICacheService,
  IThreadingService,
  CacheKey,
  MessageSyncDelta,
  MessageListSort,
} from "../interfaces";
import type { IConnectionStateService } from "../interfaces/connection-state.interface";
import { isAuthError } from "./connection-state.service";
import {
  messagesLoadRouteApi,
  messagesConsolidatedRouteApi,
  buildApiUrl,
} from "@/context/Strings";
import {
  apiFetch,
  isAbortError,
  isNetworkFetchError,
  isRequestTimeoutError,
} from "@/lib/api-client";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import {
  buildConsolidatedAccountScopeKey,
  normalizeConsolidatedAccountIds,
  serializeConsolidatedAccountIds,
} from "@/lib/consolidated-account-scope";
import { serializeConsolidatedFolderMap } from "@/lib/consolidated-folder-map";
import {
  parseConsolidatedAccountReadiness,
  type ConsolidatedAccountReadiness,
} from "@/lib/consolidated-account-readiness";
import { normalizeEmailDate, parseEmailDate } from "@/lib/email-date";
import type { EmailListGroupingMode } from "@/lib/message-grouping";
import { getEffectiveEmailListGrouping } from "@/lib/effective-email-list-grouping";
import { matchesMessageById } from "@/lib/consolidated-message-match";
import {
  getMessageIdentityKey,
  getMessageIdentityRef,
  parseAccountQualifiedToken,
} from "@/lib/message-identity";

/**
 * Default pagination settings.
 */
const DEFAULT_LIMIT = 50;
const LOAD_MORE_LIMIT = 25;
const LOAD_MORE_NETWORK_COOLDOWN_MS = 8_000;
const REQUEST_TIMEOUT_MS = 30_000;
const NON_INBOX_TIMEOUT_MS = 30_000;

const MESSAGE_LIST_SORTS = new Set<MessageListSort>([
  "newest",
  "oldest",
  "sender",
  "subject",
]);

function normalizeMessageListSort(value: unknown): MessageListSort {
  return typeof value === "string" &&
    MESSAGE_LIST_SORTS.has(value as MessageListSort)
    ? (value as MessageListSort)
    : "newest";
}

/**
 * Normalize a message to ensure consistent shape.
 */
function normalizeMessage(msg: EmailMessage): EmailMessage {
  const receivedDate = normalizeEmailDate(
    msg.receivedDate ?? msg.received_at ?? msg.received_date ?? msg.date,
  );
  const important =
    typeof msg.important === "boolean"
      ? msg.important
      : Boolean(msg.is_important);

  return {
    ...msg,
    date: receivedDate ?? msg.date,
    receivedDate: receivedDate ?? msg.receivedDate,
    labels: Array.isArray(msg.labels)
      ? msg.labels
      : msg.labels
        ? [String(msg.labels)]
        : [],
    read: Boolean(msg.read),
    starred: Boolean(msg.starred),
    important,
    hasAttachments: Boolean(msg.hasAttachments || msg.attachments?.length),
  };
}

function hasRequestParams(params: Record<string, unknown>): boolean {
  return Object.values(params).some((value) => value !== undefined);
}

function getMessageListSourceRequestParams(options: {
  folder: string | null | undefined;
  consolidated: boolean;
  hasTags: boolean;
  hasFilters: boolean;
  threaded: boolean;
}): { mailbox_source?: "imap" | "db" } {
  const rolloutParams = getMailboxSourceRequestParams();

  if (!rolloutParams.mailbox_source) {
    return {};
  }

  // The backend is DB-mirror-authoritative for ALL list reads (it never blocks on
  // live IMAP, the synchronous live fallthrough was removed). Always request the
  // db source so the read is charged to the cheaper READ rate-limit tier instead of
  // the expensive live-IMAP tier (a normal Refresh could otherwise 429 on the small
  // expensive budget). The old per-case gate below was for the "IMAP owns
  // pagination" model, which no longer exists.
  return rolloutParams;
}

function isSameRequestScope(
  left: string | number | null,
  right: string | number | null,
): boolean {
  return String(left ?? "") === String(right ?? "");
}

function isSameFolderPath(left: string | null, right: string | null): boolean {
  const leftPath = String(left ?? "INBOX");
  const rightPath = String(right ?? "INBOX");
  // Only the reserved IMAP INBOX name is case-insensitive.
  return (
    leftPath === rightPath ||
    (leftPath.toUpperCase() === "INBOX" && rightPath.toUpperCase() === "INBOX")
  );
}

// Module-level so a subscription outlives resetInboxService() on account switch.
const removalListeners = new Set<(token: string) => void>();

function canonicalMessageToken(messageId: string | number): string | null {
  const ref = parseAccountQualifiedToken(String(messageId));
  return ref?.kind === "message"
    ? JSON.stringify([ref.accountId, ref.folder, ref.uidValidity, ref.uid])
    : null;
}

function updatesPreserveIdentity(
  token: string,
  updates: Partial<EmailMessage>,
): boolean {
  const ref = parseAccountQualifiedToken(token);
  if (ref?.kind !== "message") return false;
  // Validate against the captured reference, never the current view's folder.
  return (
    getMessageIdentityKey({
      id: ref.uid,
      ...ref,
      ...updates,
    } as EmailMessage) === token
  );
}

function sortMessagesNewestFirst(messages: EmailMessage[]): EmailMessage[] {
  return [...messages].sort((left, right) => {
    const leftTime =
      parseEmailDate(left.receivedDate ?? left.date)?.getTime() ?? 0;
    const rightTime =
      parseEmailDate(right.receivedDate ?? right.date)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

function resolveConsolidatedRequestScope(
  accountId: string | number,
  accountIds: unknown,
): { requestScopeId: string | number; accountIds: number[] } {
  const normalizedAccountIds = normalizeConsolidatedAccountIds(accountIds);

  return {
    requestScopeId:
      normalizedAccountIds.length > 0
        ? buildConsolidatedAccountScopeKey(normalizedAccountIds)
        : accountId,
    accountIds: normalizedAccountIds,
  };
}

function buildGroupedMessages(
  messages: EmailMessage[],
  threading: IThreadingService | null,
  groupedData: GroupedMessage[] = [],
): GroupedMessage[] {
  if (groupedData.length > 0) {
    return groupedData;
  }

  if (!threading) {
    return [];
  }

  const threadResult = threading.groupByThread(messages);
  return threadResult.map((thread) => ({
    name: thread.subject,
    count: thread.messageCount,
    emails: thread.messages,
  }));
}

function normalizeThreadGroups(rawThreadGroups: unknown): EmailThreadGroupMap {
  const threadGroups: EmailThreadGroupMap = {};

  if (!rawThreadGroups) {
    return threadGroups;
  }

  if (Array.isArray(rawThreadGroups)) {
    for (const item of rawThreadGroups) {
      const thread = item as Partial<EmailThread> & {
        id?: string;
        messages?: EmailMessage[];
      };
      if (!thread?.id || !Array.isArray(thread.messages)) {
        continue;
      }
      threadGroups[String(thread.id)] = thread.messages.map(normalizeMessage);
    }
    return threadGroups;
  }

  if (typeof rawThreadGroups !== "object") {
    return threadGroups;
  }

  for (const [threadId, messages] of Object.entries(
    rawThreadGroups as Record<string, unknown>,
  )) {
    if (Array.isArray(messages)) {
      threadGroups[threadId] = messages.map((message) =>
        normalizeMessage(message as EmailMessage),
      );
    }
  }

  return threadGroups;
}

function mergeThreadGroups(
  current: EmailThreadGroupMap,
  next: EmailThreadGroupMap,
): EmailThreadGroupMap {
  return {
    ...current,
    ...next,
  };
}

function stringifyField(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyField).join(" ");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatSearchableDate(value: unknown): string {
  const raw = stringifyField(value);
  if (!raw) {
    return "";
  }

  const date = parseEmailDate(raw);
  if (!date) {
    return raw;
  }

  return [
    raw,
    date.toISOString(),
    date.toLocaleString(),
    date.toLocaleDateString(),
    date.toLocaleTimeString(),
  ].join(" ");
}

function getSearchableMessageText(message: EmailMessage): string {
  return [
    message.id,
    message.uid,
    message.msg_no,
    message.messageId,
    message.consolidatedUid,
    message.subject,
    message.from,
    message.email,
    message.name,
    message.to,
    message.cc,
    message.bcc,
    message.accountEmail,
    message.accountLabel,
    message.folder,
    message.folderLabel,
    formatSearchableDate(message.receivedDate ?? message.date),
    message.snippet,
    message.preview,
    message.body,
    message.htmlBody,
    message.textBody,
    message.text,
    message.plainBody,
    // Include applied tag names so the search box finds emails by tag.
    (Array.isArray(message.tags) ? message.tags : [])
      .map((tag) => tag?.name ?? "")
      .join(" "),
  ]
    .map(stringifyField)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Parse a MessageFilters.tags list into unique, positive numeric tag ids for
 * the server-side `tags=<ids>` query. Non-numeric entries (legacy tag names)
 * are dropped so only id-based selections reach the backend filter.
 */
function parseTagIdsFilter(tags: MessageFilters["tags"]): number[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const ids = tags
    .map((value) => Number.parseInt(String(value), 10))
    .filter((id) => Number.isInteger(id) && id > 0);
  return Array.from(new Set(ids));
}

function toIsoParam(value: Date | string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function buildListFilterRequestParams(
  filters: MessageFilters,
): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {};
  const searchTerm = filters.searchTerm?.trim();
  const from = filters.from?.trim();
  const to = filters.to?.trim();
  const subject = filters.subject?.trim();
  const folder = filters.folder?.trim();

  if (searchTerm) params.search = searchTerm;
  if (from) params.from = from;
  if (to) params.to = to;
  if (subject) params.subject = subject;
  if (folder) params.filter_folder = folder;
  if (filters.readStatus && filters.readStatus !== "all") {
    params.read_status = filters.readStatus;
  }
  if (typeof filters.starred === "boolean") {
    params.starred = filters.starred ? 1 : 0;
  }
  if (typeof filters.important === "boolean") {
    params.important = filters.important ? 1 : 0;
  }
  if (typeof filters.hasAttachments === "boolean") {
    params.has_attachments = filters.hasAttachments ? 1 : 0;
  }
  if (filters.scheduledOnly) {
    params.scheduled_only = 1;
  }

  params.date_from = toIsoParam(filters.dateRange?.start);
  params.date_to = toIsoParam(filters.dateRange?.end);

  return params;
}

function buildListFilterSignature(
  filters: MessageFilters,
  tagIds: number[],
): string {
  const params = buildListFilterRequestParams(filters);
  if (tagIds.length > 0) {
    params.tags = tagIds.join(",");
  }

  const entries = Object.entries(params)
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return "nofilters";
  }

  return entries
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
}

function buildListCacheSignature(
  filters: MessageFilters,
  tagIds: number[],
  sort: MessageListSort,
): string {
  return `${buildListFilterSignature(filters, tagIds)}|sort:${sort}`;
}

/**
 * Apply filters to a message list.
 */
export function filterMessages(
  messages: EmailMessage[],
  filters: MessageFilters,
): EmailMessage[] {
  const searchTerm = filters.searchTerm?.trim().toLowerCase();

  return messages.filter((msg) => {
    // General search term across standard email fields.
    if (searchTerm && !getSearchableMessageText(msg).includes(searchTerm)) {
      return false;
    }

    // Read status filter
    if (filters.readStatus === "read" && !msg.read) return false;
    if (filters.readStatus === "unread" && msg.read) return false;

    // Starred filter
    if (filters.starred !== undefined && msg.starred !== filters.starred) {
      return false;
    }

    // Important filter
    if (
      filters.important !== undefined &&
      Boolean(msg.important) !== filters.important
    ) {
      return false;
    }

    // Attachments filter
    if (filters.hasAttachments !== undefined) {
      const hasAtt = Boolean(msg.hasAttachments || msg.attachments?.length);
      if (hasAtt !== filters.hasAttachments) return false;
    }

    if (filters.scheduledOnly && !msg.scheduledEmailId && !msg.isScheduled) {
      return false;
    }

    // Labels filter
    if (filters.labels && filters.labels.length > 0) {
      const msgLabels = Array.isArray(msg.labels) ? msg.labels : [];
      const hasLabel = msgLabels.some((l) => filters.labels!.includes(l));
      if (!hasLabel) return false;
    }

    // PressedMail user tag filter: additive AND: the message must carry every
    // requested tag (matched by id or, for legacy filters, by name).
    if (filters.tags && filters.tags.length > 0) {
      const msgTags = Array.isArray(msg.tags) ? msg.tags : [];
      const requestedTags = filters.tags.map((tag) => tag.toLowerCase());
      const hasEveryTag = requestedTags.every((requested) =>
        msgTags.some((tag) => {
          const tagName = String(tag.name ?? "").toLowerCase();
          const tagId = String(tag.id ?? "").toLowerCase();
          return tagName === requested || tagId === requested;
        }),
      );
      if (!hasEveryTag) return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const msgDate = parseEmailDate(msg.receivedDate ?? msg.date);
      if (!msgDate) return false;
      if (filters.dateRange.start && msgDate < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && msgDate > filters.dateRange.end) {
        return false;
      }
    }

    // From filter (case-insensitive partial match)
    if (filters.from) {
      const fromLower = filters.from.toLowerCase();
      const msgFrom = (msg.from || msg.email || "").toLowerCase();
      if (!msgFrom.includes(fromLower)) return false;
    }

    // To filter (case-insensitive partial match)
    if (filters.to) {
      const toLower = filters.to.toLowerCase();
      const msgTo = Array.isArray(msg.to) ? msg.to.join(" ") : msg.to || "";
      if (!msgTo.toLowerCase().includes(toLower)) return false;
    }

    // Subject filter (case-insensitive partial match)
    if (filters.subject) {
      const subjectLower = filters.subject.toLowerCase();
      const msgSubject = (msg.subject || "").toLowerCase();
      if (!msgSubject.includes(subjectLower)) return false;
    }

    // Folder filter
    if (filters.folder) {
      const folderLower = filters.folder.toLowerCase();
      const msgFolder = (
        msg.folder ||
        msg.folderLabel ||
        "INBOX"
      ).toLowerCase();
      if (msgFolder !== folderLower && !msgFolder.includes(folderLower)) {
        return false;
      }
    }

    // Account filter (consolidated inbox view)
    if (filters.accountEmails && filters.accountEmails.length > 0) {
      if (
        !msg.accountEmail ||
        !filters.accountEmails.includes(msg.accountEmail)
      ) {
        return false;
      }
    }

    return true;
  });
}

interface MessagePageData {
  messages: EmailMessage[];
  groupedMessages: GroupedMessage[];
  threadGroups: EmailThreadGroupMap;
  grouping: EmailListGroupingMode;
  totalCount: number;
  offsetStart: number;
  offsetEnd: number;
  hasMore: boolean;
  syncToken: string | null;
  lastSyncedAt: number;
}

/**
 * Create an AbortController that also aborts when an optional source signal
 * aborts. Used so the service can own/cancel a list fetch while still honoring
 * any caller-supplied signal.
 */
function createLinkedAbortController(source?: AbortSignal): AbortController {
  const controller = new AbortController();
  if (source) {
    if (source.aborted) {
      controller.abort();
    } else {
      source.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }
  return controller;
}

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
 * Snapshot of per-folder inbox state, saved when switching folders.
 * Used to restore state instantly when the user returns to a folder.
 */
interface FolderStateSnapshot {
  messages: EmailMessage[];
  filteredMessages: EmailMessage[];
  groupedMessages: GroupedMessage[];
  threadGroups: EmailThreadGroupMap;
  selectedMessage: EmailMessage | null;
  totalCount: number;
  offset: number;
  offsetStart: number;
  limit: number;
  hasMore: boolean;
  syncToken: string | null;
  lastSyncedAt: number | null;
  grouping: EmailListGroupingMode;
  savedAt: number;
  scrollPosition: number;
}

/**
 * Max number of folder states to keep in memory (LRU eviction). Raised from 10
 * so power users with many folders keep instant-restore snapshots instead of
 * forcing a network refetch when revisiting a recently-viewed folder.
 */
// Retain enough per-folder snapshots that revisiting any recently-viewed folder
// restores instantly (no blank) even for accounts with many folders/labels.
// Each entry is one ~50-row page summary: cheap.
const MAX_FOLDER_STATES = 60;

/**
 * Inbox Service Implementation
 *
 * Implements IInboxOperations for message list management.
 */
export class InboxService implements IInboxOperations {
  private cache: ICacheService | null;
  private threading: IThreadingService | null;
  private connectionState: IConnectionStateService | null;

  // Internal state
  private _messages: EmailMessage[] = [];
  private _filteredMessages: EmailMessage[] = [];
  private _groupedMessages: GroupedMessage[] = [];
  private _threadGroups: EmailThreadGroupMap = {};
  private _selectedMessage: EmailMessage | null = null;
  private _isLoading = false;
  private _isLoadingMore = false;
  private _hasMore = false;
  private _totalCount = 0;
  private _currentFolder = "INBOX";
  private _isConsolidated = false;
  private _currentAccountId: string | number | null = null;
  private _currentConsolidatedAccountIds: number[] = [];
  private _currentConsolidatedFolderMap?: Record<string | number, string>;
  private _currentConsolidatedFolderMapKey = "";
  // Per-account readiness from the last combined read (empty for single-mailbox),
  // so the UI can show "Syncing N of M mailboxes…" instead of a silently-partial page.
  private _consolidatedAccountReadiness: ConsolidatedAccountReadiness[] = [];
  private _activeFilters: MessageFilters = {};
  // Numeric PressedMail tag ids driving the server-side `tags=<ids>` query.
  // Derived from _activeFilters.tags; non-numeric values (legacy names) are
  // ignored here and matched in-memory instead.
  private _tagIds: number[] = [];
  private _currentOffsetStart = 0;
  private _currentLimit = DEFAULT_LIMIT;
  private _currentGrouping: EmailListGroupingMode = "list";
  private _currentSort: MessageListSort = "newest";
  private _offset = 0;
  private _loadMoreCooldownUntil = 0;
  private _lastLoadMoreError = "";
  private _currentSyncToken: string | null = null;
  private _lastSyncedAt: number | null = null;

  // Per-folder state map for instant folder switches (LRU, max 10 entries)
  private _folderStates = new Map<string, FolderStateSnapshot>();
  private _scrollPosition = 0;

  // Request deduplication: if a fetch for the same context is already in
  // flight, return that promise instead of firing a duplicate request.
  // Key: "{accountId}:{folder}:{offset}:{limit}:{consolidated}"
  private _inFlightRequests = new Map<string, Promise<LoadMessagesResult>>();

  // Monotonic counter bumped on every context switch/reset. A list fetch
  // captures the generation at start; if it has changed by completion the
  // result is treated as superseded (cache-only, never applied to live state).
  private _requestGeneration = 0;

  // Abort controllers for in-flight list fetches, so a context switch can
  // cancel work that would otherwise complete and overwrite the new context.
  private _activeListControllers = new Set<AbortController>();

  // useSyncExternalStore support
  private _listeners = new Set<() => void>();
  private _version = 0;

  constructor(
    cache?: ICacheService,
    threading?: IThreadingService,
    connectionState?: IConnectionStateService,
  ) {
    this.cache = cache ?? null;
    this.threading = threading ?? null;
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

  get messages(): EmailMessage[] {
    // Return filtered messages if filters are active, otherwise all
    return Object.keys(this._activeFilters).length > 0
      ? this._filteredMessages
      : this._messages;
  }

  get groupedMessages(): GroupedMessage[] {
    return this._groupedMessages;
  }

  get threadGroups(): EmailThreadGroupMap {
    return this._threadGroups;
  }

  get currentGrouping(): EmailListGroupingMode {
    return this._currentGrouping;
  }

  get selectedMessage(): EmailMessage | null {
    return this._selectedMessage;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get hasMore(): boolean {
    return this._hasMore;
  }

  get totalCount(): number {
    return this._totalCount;
  }

  /**
   * Drop cached message pages for a folder so the next load refetches it fresh.
   * Used after a draft is saved so the Drafts folder shows the new draft when
   * the user navigates to it, even if Drafts is not the currently-open folder.
   */
  invalidateFolderMessages(folder: string): void {
    if (!folder) return;
    this.cache?.invalidateMessages({ folder });
    // A kept folder snapshot would be restored on open ahead of the cache.
    for (const key of [...this._folderStates.keys()]) {
      if (key.slice(key.indexOf(":") + 1).startsWith(`${folder}:`)) {
        this._folderStates.delete(key);
      }
    }
  }

  get currentFolder(): string {
    return this._currentFolder;
  }

  get isLoadingMore(): boolean {
    return this._isLoadingMore;
  }

  /**
   * Per-account readiness from the most recent combined read (empty for
   * single-mailbox reads). Drives the "Syncing N of M mailboxes…" affordance.
   */
  get consolidatedAccountReadiness(): ConsolidatedAccountReadiness[] {
    return this._consolidatedAccountReadiness;
  }

  get activeFilters(): MessageFilters {
    return { ...this._activeFilters };
  }

  get scrollPosition(): number {
    return this._scrollPosition;
  }

  setScrollPosition(position: number): void {
    this._scrollPosition = position;
  }

  getCurrentSyncToken(): string | null {
    return this._currentSyncToken;
  }

  /** Offset of the currently-displayed page (0 for page 1). */
  getCurrentOffsetStart(): number {
    return this._currentOffsetStart;
  }

  getLastSyncedAt(): number | null {
    return this._lastSyncedAt;
  }

  private getSnapshotCacheKey(
    accountId: string | number,
    folder: string,
    grouping = this._currentGrouping,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): CacheKey {
    return {
      accountId: String(accountId),
      folder,
      grouping,
      filterSignature,
      consolidatedKey: this.currentConsolidatedCacheKey(),
    };
  }

  /**
   * Consolidated scope discriminator for cache keys: the serialized per-account
   * folder_map for the current combined read, or undefined for single-mailbox
   * reads (so their keys stay byte-identical). Two combined pages over the same
   * logical folder but different per-account routing must not collide.
   */
  private currentConsolidatedCacheKey(): string | undefined {
    if (!this._isConsolidated) {
      return undefined;
    }
    // Fold the ACCOUNT-SCOPE into the consolidated cache key. `_currentAccountId`
    // is the combined-inbox scope id (`buildConsolidatedAccountScopeKey`, e.g.
    // "all:2,5"), so switching the selected accounts changes the key and the page
    // is refetched instead of serving the previous selection's cached results.
    // Previously this returned the folder-map only ("consolidated" when no map),
    // so [2,5] → [1,3] (same folder/offset) collided → the combined inbox showed
    // the wrong, unchanged messages.
    const scope = String(this._currentAccountId ?? "consolidated");
    const folderMap = this._currentConsolidatedFolderMapKey || "";
    return folderMap ? `${scope}|${folderMap}` : scope;
  }

  private getPageCacheKey(
    accountId: string | number,
    folder: string,
    offset: number,
    limit: number,
    grouping = this._currentGrouping,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): CacheKey {
    return {
      accountId: String(accountId),
      folder,
      offset,
      limit,
      grouping,
      filterSignature,
      consolidatedKey: this.currentConsolidatedCacheKey(),
    };
  }

  private reconcileSelectedMessage(
    messages: EmailMessage[],
    clearIfMissing = true,
  ): void {
    if (!this._selectedMessage) {
      return;
    }

    const selectedId = getMessageIdentityKey(this._selectedMessage);
    if (!selectedId) {
      this._selectedMessage = null;
      return;
    }
    const nextSelected = messages.find(
      (message) => getMessageIdentityKey(message) === selectedId,
    );

    if (nextSelected) {
      this._selectedMessage = {
        ...this._selectedMessage,
        ...nextSelected,
      };
      return;
    }

    if (clearIfMissing) {
      this._selectedMessage = null;
    }
  }

  private hydrateFromCache(
    cached: {
      messages: EmailMessage[];
      groupedMessages: GroupedMessage[];
      totalCount: number;
      offset: number;
      hasMore: boolean;
      syncToken?: string | null;
      lastSyncedAt?: number | null;
      threadGroups?: EmailThreadGroupMap;
      grouping?: EmailListGroupingMode;
      timestamp?: number;
    },
    clearSelectedIfMissing = true,
  ): void {
    this._messages = cached.messages.map(normalizeMessage);
    this._filteredMessages = filterMessages(
      this._messages,
      this._activeFilters,
    );
    this._groupedMessages = buildGroupedMessages(
      this._messages,
      this.threading,
      cached.groupedMessages,
    );
    this._threadGroups = cached.threadGroups ?? {};
    this._totalCount = cached.totalCount;
    this._offset = Math.max(
      cached.offset ?? this._messages.length,
      this._messages.length,
    );
    this._hasMore = cached.hasMore ?? this._offset < this._totalCount;
    this._currentSyncToken = cached.syncToken ?? null;
    this._lastSyncedAt = cached.lastSyncedAt ?? cached.timestamp ?? Date.now();
    this._currentGrouping = cached.grouping ?? this._currentGrouping;
    this.reconcileSelectedMessage(this._messages, clearSelectedIfMissing);
  }

  private hydrateFromPageData(
    pageData: MessagePageData,
    clearSelectedIfMissing = true,
  ): void {
    this.hydrateFromCache(
      {
        messages: pageData.messages,
        groupedMessages: pageData.groupedMessages,
        totalCount: pageData.totalCount,
        offset: pageData.offsetEnd,
        hasMore: pageData.hasMore,
        syncToken: pageData.syncToken,
        lastSyncedAt: pageData.lastSyncedAt,
        threadGroups: pageData.threadGroups,
        grouping: pageData.grouping,
        timestamp: pageData.lastSyncedAt,
      },
      clearSelectedIfMissing,
    );
  }

  private cacheSnapshotFor(
    accountId: string | number,
    folder: string,
    snapshot: MessagePageData,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): void {
    if (!this.cache) {
      return;
    }

    this.cache.setMessages(
      this.getSnapshotCacheKey(
        accountId,
        folder,
        snapshot.grouping,
        filterSignature,
      ),
      {
        messages: snapshot.messages,
        groupedMessages: snapshot.groupedMessages,
        threadGroups: snapshot.threadGroups,
        totalCount: snapshot.totalCount,
        offset: snapshot.offsetEnd,
        timestamp: snapshot.lastSyncedAt,
        hasMore: snapshot.hasMore,
        syncToken: snapshot.syncToken,
        lastSyncedAt: snapshot.lastSyncedAt,
        grouping: snapshot.grouping,
      },
    );
  }

  private cacheSnapshot(): void {
    if (this._currentAccountId === null) {
      return;
    }

    this.cacheSnapshotFor(this._currentAccountId, this._currentFolder, {
      messages: this._messages,
      groupedMessages: this._groupedMessages,
      threadGroups: this._threadGroups,
      grouping: this._currentGrouping,
      totalCount: this._totalCount,
      offsetStart: this._currentOffsetStart,
      offsetEnd: this._offset,
      hasMore: this._hasMore,
      syncToken: this._currentSyncToken,
      lastSyncedAt: this._lastSyncedAt ?? Date.now(),
    });
  }

  private cachePage(
    accountId: string | number,
    folder: string,
    offset: number,
    limit: number,
    messages: EmailMessage[],
    totalCount: number,
    hasMore: boolean,
    syncToken: string | null,
    lastSyncedAt: number | null,
    threadGroups: EmailThreadGroupMap = {},
    grouping = this._currentGrouping,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): void {
    if (!this.cache) {
      return;
    }

    this.cache.setMessages(
      this.getPageCacheKey(
        accountId,
        folder,
        offset,
        limit,
        grouping,
        filterSignature,
      ),
      {
        messages,
        groupedMessages: buildGroupedMessages(messages, this.threading),
        threadGroups,
        totalCount,
        offset: offset + messages.length,
        timestamp: Date.now(),
        hasMore,
        syncToken,
        lastSyncedAt,
      },
    );
  }

  // ============== Per-Folder State Persistence ==============

  private getFolderStateKey(
    accountId: string | number,
    folder: string,
    grouping = this._currentGrouping,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): string {
    return `${accountId}:${folder}:${grouping}:${filterSignature}`;
  }

  private saveFolderState(): void {
    if (this._currentAccountId === null) return;

    const key = this.getFolderStateKey(
      this._currentAccountId,
      this._currentFolder,
      this._currentGrouping,
      buildListCacheSignature(
        this._activeFilters,
        this._tagIds,
        this._currentSort,
      ),
    );
    const snapshot: FolderStateSnapshot = {
      messages: this._messages,
      filteredMessages: this._filteredMessages,
      groupedMessages: this._groupedMessages,
      threadGroups: this._threadGroups,
      selectedMessage: this._selectedMessage,
      totalCount: this._totalCount,
      offset: this._offset,
      offsetStart: this._currentOffsetStart,
      limit: this._currentLimit,
      hasMore: this._hasMore,
      syncToken: this._currentSyncToken,
      lastSyncedAt: this._lastSyncedAt,
      grouping: this._currentGrouping,
      savedAt: Date.now(),
      scrollPosition: this._scrollPosition,
    };

    // LRU: delete existing entry so re-insertion puts it at end
    this._folderStates.delete(key);
    this._folderStates.set(key, snapshot);

    // Evict oldest entries if over capacity
    while (this._folderStates.size > MAX_FOLDER_STATES) {
      const oldest = this._folderStates.keys().next().value;
      if (oldest !== undefined) {
        this._folderStates.delete(oldest);
      }
    }
  }

  private restoreFolderState(
    accountId: string | number,
    folder: string,
    grouping = this._currentGrouping,
    filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      this._currentSort,
    ),
  ): FolderStateSnapshot | null {
    const key = this.getFolderStateKey(
      accountId,
      folder,
      grouping,
      filterSignature,
    );
    const snapshot = this._folderStates.get(key);
    if (!snapshot) return null;

    // LRU: move to end (most recently accessed)
    this._folderStates.delete(key);
    this._folderStates.set(key, snapshot);

    return snapshot;
  }

  private hydrateFromFolderState(snapshot: FolderStateSnapshot): void {
    this._messages = snapshot.messages;
    this._filteredMessages = snapshot.filteredMessages;
    this._groupedMessages = snapshot.groupedMessages;
    this._threadGroups = snapshot.threadGroups;
    this._selectedMessage = snapshot.selectedMessage;
    this._totalCount = snapshot.totalCount;
    this._offset = snapshot.offset;
    this._currentOffsetStart = snapshot.offsetStart;
    this._currentLimit = snapshot.limit;
    this._hasMore = snapshot.hasMore;
    this._currentSyncToken = snapshot.syncToken;
    this._lastSyncedAt = snapshot.lastSyncedAt;
    this._currentGrouping = snapshot.grouping;
    this._scrollPosition = snapshot.scrollPosition;
    this._isLoading = false;
    this._isLoadingMore = false;
    this._loadMoreCooldownUntil = 0;
    this._lastLoadMoreError = "";
  }

  // ============== Core Operations ==============

  /**
   * Public loadMessages: deduplicates concurrent requests for the same
   * context. If a request for the same (account, folder, offset, limit,
   * consolidated) tuple is already in flight, return that promise instead
   * of firing a duplicate. This is the "never interrupt, queue next" pattern.
   */
  async loadMessages(
    options: LoadMessagesOptions,
  ): Promise<LoadMessagesResult> {
    const grouping = getEffectiveEmailListGrouping(options.grouping ?? "list");
    const sort = normalizeMessageListSort(options.sort);
    const filterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      sort,
    );
    const { requestScopeId } = options.consolidated
      ? resolveConsolidatedRequestScope(options.accountId, options.accountIds)
      : { requestScopeId: options.accountId };

    // Dedup key does NOT include forceRefresh, a forced refresh overrides
    // any in-flight non-forced request by waiting for it then refetching.
    //
    // It also does NOT include the caller-supplied folderMap. The folderMap is
    // a deterministic function of (consolidated scope + folder); different
    // callers (boot, selectFolder, sync) build it at different times, boot may
    // omit it entirely before folders load, so including it would defeat
    // deduplication for what is logically the same consolidated request.
    const dedupKey = [
      requestScopeId,
      options.folder ?? "INBOX",
      options.offset ?? 0,
      options.limit ?? DEFAULT_LIMIT,
      options.consolidated ? "1" : "0",
      grouping,
      sort,
      filterSignature,
    ].join(":");

    // If an identical request is already in flight, return its promise.
    // This prevents duplicate API calls when rapid user actions (folder
    // clicks, account switches) would otherwise fire the same fetch twice.
    const inFlight = this._inFlightRequests.get(dedupKey);
    if (inFlight && !options.forceRefresh) {
      return inFlight;
    }

    const promise = this._loadMessagesImpl(options).finally(() => {
      this._inFlightRequests.delete(dedupKey);
    });

    this._inFlightRequests.set(dedupKey, promise);
    return promise;
  }

  async loadMessagesSnapshot(
    options: LoadMessagesOptions,
  ): Promise<LoadMessagesResult> {
    const {
      accountId,
      folder = "INBOX",
      offset = 0,
      limit = DEFAULT_LIMIT,
      forceRefresh = false,
      signal,
      timeoutMs,
      consolidated = false,
      accountIds,
      folderMap,
    } = options;
    const grouping = getEffectiveEmailListGrouping(options.grouping ?? "list");
    const sort = normalizeMessageListSort(options.sort);
    const activeFilterParams = buildListFilterRequestParams(
      this._activeFilters,
    );
    const listSourceParams = getMessageListSourceRequestParams({
      folder,
      consolidated,
      hasTags: this._tagIds.length > 0,
      hasFilters: hasRequestParams(activeFilterParams),
      threaded: grouping === "threads",
    });
    const { requestScopeId, accountIds: consolidatedAccountIds } = consolidated
      ? resolveConsolidatedRequestScope(accountId, accountIds)
      : { requestScopeId: accountId, accountIds: [] };
    const consolidatedFolderMapKey = consolidated
      ? (serializeConsolidatedFolderMap(folderMap) ?? "")
      : "";
    let requestController: AbortController | null = null;

    try {
      requestController = createLinkedAbortController(signal);
      this._activeListControllers.add(requestController);
      const effectiveSignal = requestController.signal;

      const fetchMessages = async () => {
        const apiUrl = consolidated
          ? buildApiUrl(messagesConsolidatedRouteApi, {
              offset,
              limit,
              folder: folder !== "INBOX" ? folder : undefined,
              account_ids: serializeConsolidatedAccountIds(
                consolidatedAccountIds,
              ),
              folder_map: consolidatedFolderMapKey || undefined,
              force: forceRefresh ? 1 : undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: grouping === "threads" ? 1 : undefined,
              sort,
              ...activeFilterParams,
              ...listSourceParams,
            })
          : buildApiUrl(`${messagesLoadRouteApi}${accountId}`, {
              offset,
              limit,
              folder: folder !== "INBOX" ? folder : undefined,
              force: forceRefresh ? 1 : undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: grouping === "threads" ? 1 : undefined,
              sort,
              ...activeFilterParams,
              ...listSourceParams,
            });

        const defaultTimeout =
          folder !== "INBOX" ? NON_INBOX_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
        const response = await apiFetch(
          apiUrl,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: effectiveSignal,
          },
          { timeoutMs: timeoutMs ?? defaultTimeout },
        );

        if (!response.ok) {
          throw await buildHttpError(response);
        }

        return response.json();
      };

      // DB-mirror read: NEVER gate on the transport circuit breaker. The mirror
      // needs no IMAP, is cheap, and is rate-limited server-side, so it must
      // always be served even when the account's IMAP transport is unhealthy /
      // auth-failed. A real transport failure of THIS fetch still marks the
      // account unhealthy below (from the error response), preserving backoff.
      const data = await fetchMessages();

      if (effectiveSignal.aborted) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Request aborted",
        };
      }

      if (data?.status === "error") {
        const errorMsg =
          data.message || __("Failed to load messages", "pressedmail");
        const authDetected = isAuthError(errorMsg);
        if (authDetected && this.connectionState) {
          this.connectionState.markUnhealthy(String(requestScopeId), errorMsg);
        }
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: errorMsg,
          authError: authDetected,
        };
      }

      const rawMessages: EmailMessage[] =
        data?.data?.emails || data?.emails || [];
      const threadGroups = normalizeThreadGroups(
        data?.data?.thread_groups ??
          data?.thread_groups ??
          data?.data?.threads ??
          data?.threads,
      );
      const totalCount = Number(
        grouping === "threads"
          ? (data?.data?.total_threads ??
              data?.total_threads ??
              data?.data?.thread_count ??
              data?.thread_count ??
              data?.data?.num_messages ??
              data?.num_messages ??
              0)
          : (data?.data?.num_messages ?? data?.num_messages ?? 0),
      );
      const normalizedMessages = rawMessages.map(normalizeMessage);
      const safeTotal = Number.isFinite(totalCount) ? totalCount : 0;

      return {
        success: true,
        messages: normalizedMessages,
        total: safeTotal,
        hasMore: offset + normalizedMessages.length < safeTotal,
        fromCache: false,
        syncToken:
          data?.data?.syncToken ??
          data?.data?.sync_token ??
          data?.syncToken ??
          data?.sync_token ??
          null,
        lastSyncedAt: Date.now(),
        threadGroups,
      };
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Request aborted",
        };
      }

      const errorMsg =
        error instanceof Error
          ? error.message
          : __("Failed to load messages", "pressedmail");
      const authDetected = isAuthError(errorMsg);

      if (authDetected && this.connectionState) {
        this.connectionState.markUnhealthy(String(requestScopeId), errorMsg);
      }

      if (isNetworkFetchError(error) || isRequestTimeoutError(error)) {
        console.warn(
          "[InboxService] loadMessagesSnapshot network error:",
          errorMsg,
        );
      } else {
        console.error("[InboxService] loadMessagesSnapshot error:", error);
      }

      return {
        success: false,
        messages: [],
        total: 0,
        hasMore: false,
        error: errorMsg,
        authError: authDetected,
      };
    } finally {
      if (requestController) {
        this._activeListControllers.delete(requestController);
      }
    }
  }

  private async _loadMessagesImpl(
    options: LoadMessagesOptions,
  ): Promise<LoadMessagesResult> {
    const {
      accountId,
      folder = "INBOX",
      offset = 0,
      limit = DEFAULT_LIMIT,
      forceRefresh = false,
      signal,
      timeoutMs,
      consolidated = false,
      silent = false,
      accountIds,
      folderMap,
    } = options;
    const grouping = getEffectiveEmailListGrouping(options.grouping ?? "list");
    const sort = normalizeMessageListSort(options.sort);
    const activeFilterParams = buildListFilterRequestParams(
      this._activeFilters,
    );
    const listSourceParams = getMessageListSourceRequestParams({
      folder,
      consolidated,
      hasTags: this._tagIds.length > 0,
      hasFilters: hasRequestParams(activeFilterParams),
      threaded: grouping === "threads",
    });
    const activeFilterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      sort,
    );
    const { requestScopeId, accountIds: consolidatedAccountIds } = consolidated
      ? resolveConsolidatedRequestScope(accountId, accountIds)
      : { requestScopeId: accountId, accountIds: [] };
    const consolidatedFolderMapKey = consolidated
      ? (serializeConsolidatedFolderMap(folderMap) ?? "")
      : "";

    const isNewContext =
      requestScopeId !== this._currentAccountId ||
      folder !== this._currentFolder ||
      consolidated !== this._isConsolidated ||
      consolidatedFolderMapKey !== this._currentConsolidatedFolderMapKey ||
      grouping !== this._currentGrouping ||
      sort !== this._currentSort;

    // Save current folder state before switching to a new context
    if (
      isNewContext &&
      this._currentAccountId !== null &&
      this._messages.length > 0
    ) {
      this.saveFolderState();
    }

    this._currentAccountId = requestScopeId;
    this._currentFolder = folder;
    this._isConsolidated = consolidated;
    this._currentConsolidatedAccountIds = consolidated
      ? consolidatedAccountIds
      : [];
    this._currentConsolidatedFolderMap = consolidated ? folderMap : undefined;
    this._currentConsolidatedFolderMapKey = consolidated
      ? consolidatedFolderMapKey
      : "";
    this._currentOffsetStart = offset;
    this._currentLimit = limit;
    this._currentGrouping = grouping;
    this._currentSort = sort;

    // Try to restore from per-folder state map (instant, no network)
    if (isNewContext && !forceRefresh) {
      const savedState = this.restoreFolderState(
        requestScopeId,
        folder,
        grouping,
        activeFilterSignature,
      );
      if (savedState && savedState.messages.length > 0) {
        this.hydrateFromFolderState(savedState);
        this.notify();
        const age = Date.now() - savedState.savedAt;
        const isStale = age > 2 * 60 * 1000; // stale after 2 minutes
        return {
          success: true,
          messages: this._messages,
          total: this._totalCount,
          hasMore: this._hasMore,
          fromCache: true,
          stale: isStale,
          syncToken: this._currentSyncToken,
          lastSyncedAt: this._lastSyncedAt,
          threadGroups: this._threadGroups,
        };
      }
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh && this.cache) {
      const snapshotCacheKey = this.getSnapshotCacheKey(
        requestScopeId,
        folder,
        grouping,
        activeFilterSignature,
      );
      const pageCacheKey = this.getPageCacheKey(
        requestScopeId,
        folder,
        offset,
        limit,
        grouping,
        activeFilterSignature,
      );
      const cachedPage = this.cache.getMessages(pageCacheKey);
      const cachedSnapshot = this.cache.getMessages(snapshotCacheKey);
      const snapshotLoadedCount = cachedSnapshot
        ? Math.max(
            cachedSnapshot.offset ?? cachedSnapshot.messages.length,
            cachedSnapshot.messages.length,
          )
        : null;
      const safeSnapshot =
        offset === 0 &&
        cachedSnapshot &&
        snapshotLoadedCount !== null &&
        snapshotLoadedCount <= limit
          ? cachedSnapshot
          : null;
      const cached = cachedPage ?? safeSnapshot;

      if (cached && cached.messages.length > 0) {
        this.hydrateFromCache(cached, isNewContext);
        this._loadMoreCooldownUntil = 0;
        this._lastLoadMoreError = "";
        this.notify();
        return {
          success: true,
          messages: this._messages,
          total: this._totalCount,
          hasMore: this._hasMore,
          fromCache: true,
          syncToken: this._currentSyncToken,
          lastSyncedAt: this._lastSyncedAt,
          threadGroups: this._threadGroups,
        };
      }

      // Stale-while-revalidate: if fresh cache missed, try stale data
      // This prevents the loading flash on folder switches by showing
      // slightly stale data immediately while a background diff runs
      if (isNewContext) {
        const staleSnapshot =
          this.cache.getMessagesAllowStale(snapshotCacheKey);
        const stalePage = this.cache.getMessagesAllowStale(pageCacheKey);
        const staleResult = stalePage ?? staleSnapshot;

        if (staleResult && staleResult.data.messages.length > 0) {
          this.hydrateFromCache(staleResult.data, isNewContext);
          this._loadMoreCooldownUntil = 0;
          this._lastLoadMoreError = "";
          this.notify();
          return {
            success: true,
            messages: this._messages,
            total: this._totalCount,
            hasMore: this._hasMore,
            fromCache: true,
            stale: staleResult.isStale,
            syncToken: this._currentSyncToken,
            lastSyncedAt: this._lastSyncedAt,
            threadGroups: this._threadGroups,
          };
        }
      }
    }

    if (isNewContext && !silent) {
      // Genuine folder/scope switch with no restorable cache: clear and enter the
      // loading state in a SINGLE notify so the UI renders one skeleton frame
      // instead of flashing empty-then-loading.
      this._offset = 0;
      this._messages = [];
      this._filteredMessages = [];
      this._groupedMessages = [];
      this._threadGroups = {};
      this._hasMore = false;
      this._currentSyncToken = null;
      this._lastSyncedAt = null;
      this._loadMoreCooldownUntil = 0;
      this._lastLoadMoreError = "";
      this._isLoading = true;
      this.notify();
    } else if (!silent) {
      // Same-folder refresh: keep the visible rows; just flag loading.
      this._isLoading = true;
      this.notify();
    }

    // Owned abort controller + generation snapshot so a context switch during
    // this fetch cancels it and a superseded completion never overwrites state.
    let requestController: AbortController | null = null;
    // Captured BEFORE the try so the catch can tell whether this request was
    // superseded (folder/account switched, or a newer load bumped the
    // generation), a stale request's error must not be surfaced or mark the
    // account unhealthy.
    const startGeneration = this._requestGeneration;
    const filtersChanged = () =>
      activeFilterSignature !==
      buildListCacheSignature(
        this._activeFilters,
        this._tagIds,
        this._currentSort,
      );
    const isSuperseded = () =>
      startGeneration !== this._requestGeneration ||
      filtersChanged() ||
      !isSameFolderPath(folder, this._currentFolder) ||
      consolidated !== this._isConsolidated ||
      sort !== this._currentSort ||
      !isSameRequestScope(requestScopeId, this._currentAccountId);

    try {
      requestController = createLinkedAbortController(signal);
      this._activeListControllers.add(requestController);
      const effectiveSignal = requestController.signal;

      const fetchMessages = async () => {
        const apiUrl = consolidated
          ? buildApiUrl(messagesConsolidatedRouteApi, {
              offset,
              limit,
              folder: folder !== "INBOX" ? folder : undefined,
              account_ids: serializeConsolidatedAccountIds(
                consolidatedAccountIds,
              ),
              folder_map: consolidatedFolderMapKey || undefined,
              force: forceRefresh ? 1 : undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: grouping === "threads" ? 1 : undefined,
              sort,
              ...activeFilterParams,
              ...listSourceParams,
            })
          : buildApiUrl(`${messagesLoadRouteApi}${accountId}`, {
              offset,
              limit,
              folder: folder !== "INBOX" ? folder : undefined,
              force: forceRefresh ? 1 : undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: grouping === "threads" ? 1 : undefined,
              sort,
              ...activeFilterParams,
              ...listSourceParams,
            });

        const defaultTimeout =
          folder !== "INBOX" ? NON_INBOX_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
        const response = await apiFetch(
          apiUrl,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: effectiveSignal,
          },
          { timeoutMs: timeoutMs ?? defaultTimeout },
        );

        if (!response.ok) {
          throw await buildHttpError(response);
        }

        return response.json();
      };

      // DB-mirror read: NEVER gate on the transport circuit breaker (see the
      // primary loadMessages path above). A real transport failure still marks
      // the account unhealthy from the error response below.
      const data: any = await fetchMessages();

      if (effectiveSignal.aborted) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Request aborted",
        };
      }

      if (data?.status === "error") {
        // Drop a superseded request's error quietly, the user already left this
        // folder; do not mark unhealthy or wipe the (now-current) list.
        if (isSuperseded()) {
          return {
            success: false,
            messages: this._messages,
            total: this._totalCount,
            hasMore: this._hasMore,
            error: "Context changed during request",
          };
        }
        this._hasMore = false;
        const errorMsg =
          data.message || __("Failed to load messages", "pressedmail");
        const authDetected = isAuthError(errorMsg);

        if (authDetected && this.connectionState) {
          this.connectionState.markUnhealthy(String(requestScopeId), errorMsg);
        }

        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: errorMsg,
          authError: authDetected,
        };
      }

      const rawMessages: EmailMessage[] =
        data?.data?.emails || data?.emails || [];
      const groupedData: GroupedMessage[] =
        data?.data?.groups || data?.groups || [];
      const threadGroups = normalizeThreadGroups(
        data?.data?.thread_groups ??
          data?.thread_groups ??
          data?.data?.threads ??
          data?.threads,
      );
      const totalCount = Number(
        grouping === "threads"
          ? (data?.data?.total_threads ??
              data?.total_threads ??
              data?.data?.thread_count ??
              data?.thread_count ??
              data?.data?.num_messages ??
              data?.num_messages ??
              0)
          : (data?.data?.num_messages ?? data?.num_messages ?? 0),
      );
      const syncToken =
        data?.data?.syncToken ??
        data?.data?.sync_token ??
        data?.syncToken ??
        data?.sync_token ??
        null;
      // Cold/partial mirror page flag (a background refresh is queued
      // server-side). Boot keeps the gate up while this is true and the page is
      // empty, re-polling until a serviceable page is served.
      const servedPartial =
        data?.data?.served_partial ?? data?.served_partial ?? undefined;
      // Per-account readiness (combined inbox only) so the UI can flag mailboxes
      // that are still cold/syncing rather than presenting a partial page as done.
      const consolidatedAccountReadiness = consolidated
        ? parseConsolidatedAccountReadiness(
            data?.data?.accounts ?? data?.accounts,
          )
        : [];
      const lastSyncedAt = Date.now();
      const normalizedMessages = rawMessages.map(normalizeMessage);

      // If the user switched context during this fetch, do NOT overwrite
      // live state, but DO cache the result so it's available when they
      // return to this folder. This is the "keep already retrieved" pattern.
      // A folder/consolidation change, or an explicit generation bump (account
      // switch / reset), always supersedes this completion. A bare account-id
      // representation change (e.g. numeric id normalized to email mid-fetch)
      // only supersedes once real messages are already visible, this preserves
      // the very first paint of a freshly-loaded folder.
      const generationSuperseded = startGeneration !== this._requestGeneration;
      const folderChanged = !isSameFolderPath(folder, this._currentFolder);
      const consolidationChanged = consolidated !== this._isConsolidated;
      const sortChanged = sort !== this._currentSort;
      const scopeChanged = !isSameRequestScope(
        requestScopeId,
        this._currentAccountId,
      );
      const contextChanged =
        generationSuperseded ||
        filtersChanged() ||
        folderChanged ||
        consolidationChanged ||
        sortChanged ||
        (scopeChanged && this._messages.length > 0);

      if (contextChanged) {
        const completedSyncedAt = Date.now();
        const hasMoreCompleted =
          offset + normalizedMessages.length <
          (Number.isFinite(totalCount) ? totalCount : 0);

        // Cache the page result for the folder that was requested
        this.cachePage(
          requestScopeId,
          folder,
          offset,
          limit,
          normalizedMessages,
          Number.isFinite(totalCount) ? totalCount : 0,
          hasMoreCompleted,
          syncToken,
          completedSyncedAt,
          threadGroups,
          grouping,
          activeFilterSignature,
        );

        // Also update the per-folder state snapshot so instant restore works
        this.cacheSnapshotFor(
          requestScopeId,
          folder,
          {
            messages: normalizedMessages,
            groupedMessages: buildGroupedMessages(
              normalizedMessages,
              this.threading,
              groupedData,
            ),
            threadGroups,
            grouping,
            totalCount: Number.isFinite(totalCount) ? totalCount : 0,
            offsetStart: offset,
            offsetEnd: offset + normalizedMessages.length,
            hasMore: hasMoreCompleted,
            syncToken,
            lastSyncedAt: completedSyncedAt,
          },
          activeFilterSignature,
        );

        return {
          success: true,
          messages: normalizedMessages,
          total: Number.isFinite(totalCount) ? totalCount : 0,
          hasMore: hasMoreCompleted,
          fromCache: false,
          servedPartial,
          error: "Context changed during request. Result cached",
          threadGroups,
        };
      }

      // A still-warming mirror can serve an empty served_partial page; that must
      // not wipe an already-populated folder (the "emails disappear during
      // background sync" flash). Keep the visible rows, refresh only the sync
      // metadata, and let the next warmed read replace them. Only applies to a
      // same-folder first-page re-read, a genuine empty (non-partial) page, a
      // folder switch, or a paginated read still replace the list.
      if (
        servedPartial === true &&
        normalizedMessages.length === 0 &&
        this._messages.length > 0 &&
        offset === 0 &&
        !isNewContext
      ) {
        this._lastSyncedAt = lastSyncedAt;
        this._currentSyncToken = syncToken;
        this.notify();
        return {
          success: true,
          messages: this._messages,
          total: this._totalCount,
          hasMore: this._hasMore,
          fromCache: false,
          servedPartial,
          syncToken: this._currentSyncToken,
          lastSyncedAt: this._lastSyncedAt,
          threadGroups: this._threadGroups,
        };
      }

      this._messages = normalizedMessages;
      this._filteredMessages = filterMessages(
        normalizedMessages,
        this._activeFilters,
      );
      this._groupedMessages = buildGroupedMessages(
        normalizedMessages,
        this.threading,
        groupedData,
      );
      this._threadGroups = threadGroups;
      this._totalCount = Number.isFinite(totalCount) ? totalCount : 0;
      this._offset = offset + normalizedMessages.length;
      this._hasMore = this._offset < this._totalCount;
      this._currentSyncToken = syncToken;
      this._lastSyncedAt = lastSyncedAt;
      this._consolidatedAccountReadiness = consolidatedAccountReadiness;
      this.reconcileSelectedMessage(this._messages, isNewContext);

      this.cachePage(
        requestScopeId,
        folder,
        offset,
        limit,
        this._messages,
        this._totalCount,
        this._hasMore,
        this._currentSyncToken,
        this._lastSyncedAt,
        this._threadGroups,
        grouping,
        activeFilterSignature,
      );
      this.cacheSnapshot();

      this._loadMoreCooldownUntil = 0;
      this._lastLoadMoreError = "";
      this.notify();
      return {
        success: true,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        fromCache: false,
        servedPartial,
        syncToken: this._currentSyncToken,
        lastSyncedAt: this._lastSyncedAt,
        threadGroups: this._threadGroups,
      };
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        this._hasMore = false;
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Request aborted",
        };
      }

      // A superseded request (the user switched folder/account, or a newer load
      // bumped the generation) must NOT mark the account unhealthy or surface a
      // hard error, that turns harmless rapid-switch churn into a 401/429 loop.
      if (isSuperseded()) {
        return {
          success: false,
          messages: this._messages,
          total: this._totalCount,
          hasMore: this._hasMore,
          error: "Context changed during request",
        };
      }

      const errorMsg =
        error instanceof Error
          ? error.message
          : __("Failed to load messages", "pressedmail");
      const authDetected = isAuthError(errorMsg);

      if (authDetected && this.connectionState) {
        this.connectionState.markUnhealthy(String(requestScopeId), errorMsg);
      }

      this._hasMore = false;

      if (isNetworkFetchError(error) || isRequestTimeoutError(error)) {
        console.warn("[InboxService] loadMessages network error:", errorMsg);
      } else {
        console.error("[InboxService] loadMessages error:", error);
      }
      return {
        success: false,
        messages: [],
        total: 0,
        hasMore: false,
        error: errorMsg,
        authError: authDetected,
      };
    } finally {
      if (requestController) {
        this._activeListControllers.delete(requestController);
      }
      if (!silent) {
        this._isLoading = false;
        this.notify();
      }
    }
  }

  async loadMore(): Promise<LoadMessagesResult> {
    if (
      !this._currentAccountId ||
      this._isLoading ||
      this._isLoadingMore ||
      !this._hasMore ||
      this._offset <= 0 ||
      this._messages.length === 0
    ) {
      return {
        success: false,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        error: "Cannot load more messages",
      };
    }

    if (Date.now() < this._loadMoreCooldownUntil) {
      const seconds = Math.max(
        1,
        Math.ceil((this._loadMoreCooldownUntil - Date.now()) / 1000),
      );
      return {
        success: false,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        error:
          this._lastLoadMoreError ||
          `Load more temporarily paused after network error. Retry in ${seconds}s.`,
      };
    }

    const requestAccountId = this._currentAccountId;
    const requestFolder = this._currentFolder;
    const requestOffset = this._offset;
    const requestTotalCount = this._totalCount;
    const requestConsolidated = this._isConsolidated;
    const requestConsolidatedAccountIds = [
      ...this._currentConsolidatedAccountIds,
    ];
    const requestConsolidatedFolderMap = this._currentConsolidatedFolderMap;
    const requestConsolidatedFolderMapKey =
      this._currentConsolidatedFolderMapKey;
    const requestGrouping = this._currentGrouping;
    const requestSort = this._currentSort;
    const requestFilterParams = buildListFilterRequestParams(
      this._activeFilters,
    );
    const requestListSourceParams = getMessageListSourceRequestParams({
      folder: requestFolder,
      consolidated: requestConsolidated,
      hasTags: this._tagIds.length > 0,
      hasFilters: hasRequestParams(requestFilterParams),
      threaded: requestGrouping === "threads",
    });
    const requestFilterSignature = buildListCacheSignature(
      this._activeFilters,
      this._tagIds,
      requestSort,
    );

    this._isLoadingMore = true;
    this.notify();

    try {
      const fetchMore = async () => {
        const apiUrl = requestConsolidated
          ? buildApiUrl(messagesConsolidatedRouteApi, {
              offset: requestOffset,
              limit: LOAD_MORE_LIMIT,
              folder: requestFolder !== "INBOX" ? requestFolder : undefined,
              account_ids: serializeConsolidatedAccountIds(
                requestConsolidatedAccountIds,
              ),
              folder_map: requestConsolidatedFolderMapKey || undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: requestGrouping === "threads" ? 1 : undefined,
              sort: requestSort,
              ...requestFilterParams,
              ...requestListSourceParams,
            })
          : buildApiUrl(`${messagesLoadRouteApi}${requestAccountId}`, {
              offset: requestOffset,
              limit: LOAD_MORE_LIMIT,
              folder: requestFolder !== "INBOX" ? requestFolder : undefined,
              tags: this._tagIds.length ? this._tagIds.join(",") : undefined,
              threaded: requestGrouping === "threads" ? 1 : undefined,
              sort: requestSort,
              ...requestFilterParams,
              ...requestListSourceParams,
            });

        const response = await apiFetch(
          apiUrl,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
          { timeoutMs: REQUEST_TIMEOUT_MS },
        );

        if (!response.ok) {
          throw await buildHttpError(response);
        }

        return response.json();
      };

      // DB-mirror read (pagination): NEVER gate on the transport circuit breaker.
      // A real transport failure still marks the account unhealthy below.
      const data: any = await fetchMore();

      if (data?.status === "error") {
        this._hasMore = false;
        const errorMsg =
          data.message || __("Failed to load more messages", "pressedmail");
        const authDetected = isAuthError(errorMsg);

        if (authDetected && this.connectionState) {
          this.connectionState.markUnhealthy(
            String(requestAccountId),
            errorMsg,
          );
        }

        return {
          success: false,
          messages: this._messages,
          total: this._totalCount,
          hasMore: this._hasMore,
          error: errorMsg,
          authError: authDetected,
        };
      }

      // Parse response data
      const rawMessages: EmailMessage[] =
        data?.data?.emails || data?.emails || [];
      const normalizedMessages = rawMessages.map(normalizeMessage);
      const nextThreadGroups = normalizeThreadGroups(
        data?.data?.thread_groups ??
          data?.thread_groups ??
          data?.data?.threads ??
          data?.threads,
      );
      const responseTotal = Number(
        requestGrouping === "threads"
          ? (data?.data?.total_threads ??
              data?.total_threads ??
              data?.data?.thread_count ??
              data?.thread_count ??
              requestTotalCount)
          : (data?.data?.num_messages ??
              data?.num_messages ??
              requestTotalCount),
      );
      const nextTotalCount = Number.isFinite(responseTotal)
        ? responseTotal
        : requestTotalCount;
      const nextSyncToken =
        data?.data?.syncToken ??
        data?.data?.sync_token ??
        data?.syncToken ??
        data?.sync_token ??
        this._currentSyncToken;

      if (
        requestAccountId !== this._currentAccountId ||
        requestFolder !== this._currentFolder ||
        requestConsolidated !== this._isConsolidated ||
        requestSort !== this._currentSort
      ) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Account changed during request",
        };
      }

      const lastSyncedAt = Date.now();

      this.cachePage(
        requestAccountId,
        requestFolder,
        requestOffset,
        LOAD_MORE_LIMIT,
        normalizedMessages,
        nextTotalCount,
        requestOffset + normalizedMessages.length < nextTotalCount,
        nextSyncToken,
        lastSyncedAt,
        nextThreadGroups,
        requestGrouping,
        requestFilterSignature,
      );

      this._messages = [...this._messages, ...normalizedMessages];
      this._threadGroups = mergeThreadGroups(
        this._threadGroups,
        nextThreadGroups,
      );
      this._filteredMessages = filterMessages(
        this._messages,
        this._activeFilters,
      );
      this._offset = this._messages.length;
      this._totalCount = nextTotalCount;
      this._hasMore = this._messages.length < this._totalCount;
      this._currentSyncToken = nextSyncToken;
      this._lastSyncedAt = lastSyncedAt;
      this.reconcileSelectedMessage(this._messages);
      this._groupedMessages = buildGroupedMessages(
        this._messages,
        this.threading,
      );
      this.cacheSnapshot();
      this.notify();
      this._loadMoreCooldownUntil = 0;
      this._lastLoadMoreError = "";

      return {
        success: true,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        fromCache: false,
        syncToken: this._currentSyncToken,
        lastSyncedAt: this._lastSyncedAt,
        threadGroups: this._threadGroups,
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          success: false,
          messages: [],
          total: 0,
          hasMore: false,
          error: "Request aborted",
        };
      }

      const errorMsg =
        error instanceof Error
          ? error.message
          : __("Failed to load more", "pressedmail");
      const authDetected = isAuthError(errorMsg);
      const networkDetected =
        isNetworkFetchError(error) || isRequestTimeoutError(error);

      if (authDetected && this.connectionState) {
        this.connectionState.markUnhealthy(
          String(this._currentAccountId),
          errorMsg,
        );
      }

      if (networkDetected) {
        this._hasMore = false;
        this._loadMoreCooldownUntil =
          Date.now() + LOAD_MORE_NETWORK_COOLDOWN_MS;
        this._lastLoadMoreError = errorMsg;
        console.warn("[InboxService] loadMore network error:", errorMsg);
      } else {
        this._hasMore = false;
        console.error("[InboxService] loadMore error:", error);
      }
      return {
        success: false,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        error: errorMsg,
        authError: authDetected,
      };
    } finally {
      this._isLoadingMore = false;
      this.notify();
    }
  }

  async loadPage(
    page: number,
    pageSize = DEFAULT_LIMIT,
  ): Promise<LoadMessagesResult> {
    if (!this._currentAccountId) {
      return {
        success: false,
        messages: this._messages,
        total: this._totalCount,
        hasMore: this._hasMore,
        error: "Cannot load page without an active account",
      };
    }

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset = (safePage - 1) * safePageSize;

    const options: LoadMessagesOptions = {
      accountId: this._currentAccountId,
      folder: this._currentFolder,
      offset,
      limit: safePageSize,
      consolidated: this._isConsolidated,
      accountIds: this._isConsolidated
        ? this._currentConsolidatedAccountIds
        : undefined,
      folderMap: this._isConsolidated
        ? this._currentConsolidatedFolderMap
        : undefined,
      grouping: this._currentGrouping,
      sort: this._currentSort,
    };

    const first = await this.loadMessages(options);
    if (
      first.success &&
      first.servedPartial === true &&
      first.messages.length === 0 &&
      first.total > offset
    ) {
      return this.loadMessages(options);
    }

    return first;
  }

  async refresh(options?: RefreshOptions): Promise<void> {
    if (!this._currentAccountId) return;

    await this.loadMessages({
      accountId: this._currentAccountId,
      folder: options?.folder ?? this._currentFolder,
      offset: this._currentOffsetStart,
      limit: this._currentLimit,
      forceRefresh: true,
      consolidated: this._isConsolidated,
      accountIds: this._isConsolidated
        ? this._currentConsolidatedAccountIds
        : undefined,
      folderMap: this._isConsolidated
        ? this._currentConsolidatedFolderMap
        : undefined,
      grouping: this._currentGrouping,
      sort: this._currentSort,
    });
  }

  // ============== Selection ==============

  async selectMessage(message: EmailMessage | null): Promise<void> {
    this._selectedMessage = message;

    // If selecting a message and we have cache service, try to get full detail
    const ref = getMessageIdentityRef(message);
    if (message && ref && this.cache) {
      const token = getMessageIdentityKey(message);
      const detail = this.cache.getMessageDetail(
        String(ref.accountId),
        ref.folder,
        token,
      );

      if (
        detail &&
        getMessageIdentityKey(detail) === token &&
        (detail.htmlBody || detail.textBody)
      ) {
        this._selectedMessage = {
          ...message,
          ...detail,
          id: detail.id ?? message.id,
          uid: detail.uid ?? message.uid,
          folder: detail.folder || message.folder,
          accountId: detail.accountId ?? message.accountId,
          uidValidity:
            detail.uidValidity ??
            detail.uid_validity ??
            message.uidValidity ??
            message.uid_validity,
          messageId:
            detail.messageId ||
            detail.message_id ||
            message.messageId ||
            message.message_id,
        };
      }
    }

    this.notify();
  }

  clearSelection(): void {
    this._selectedMessage = null;
    this.notify();
  }

  // ============== Filtering ==============

  applyFilters(filters: MessageFilters): void {
    const previousFilterSignature = buildListFilterSignature(
      this._activeFilters,
      this._tagIds,
    );
    this._activeFilters = { ...filters };
    this._tagIds = parseTagIdsFilter(filters.tags);
    this._filteredMessages = filterMessages(
      this._messages,
      this._activeFilters,
    );

    const nextFilterSignature = buildListFilterSignature(
      this._activeFilters,
      this._tagIds,
    );

    // Thread groups belong to the result set that produced them. Keeping them
    // across a filter change lets threaded display re-inject the very messages
    // the new filter just removed (the Scheduled view rendering the whole
    // conversation). Drop them; the refresh below supplies scoped ones.
    if (nextFilterSignature !== previousFilterSignature) {
      this._threadGroups = {};
      this._currentOffsetStart = 0;
    }
    this.notify();

    // Server-backed filters must pull the full matching set from the server
    // because the in-memory filter only sees the loaded page.
    if (nextFilterSignature !== previousFilterSignature) {
      void this.refresh();
    }
  }

  clearFilters(): void {
    const previousFilterSignature = buildListFilterSignature(
      this._activeFilters,
      this._tagIds,
    );
    this._activeFilters = {};
    this._tagIds = [];
    this._filteredMessages = [...this._messages];
    if (previousFilterSignature !== "nofilters") {
      this._threadGroups = {};
      this._currentOffsetStart = 0;
    }
    this.notify();

    // Drop server-side filters by refetching the unfiltered folder.
    if (previousFilterSignature !== "nofilters") {
      void this.refresh();
    }
  }

  getAllLabels(): string[] {
    const labels = new Set<string>();

    for (const msg of this._messages) {
      if (Array.isArray(msg.labels)) {
        for (const label of msg.labels) {
          labels.add(label);
        }
      }
    }

    return Array.from(labels).sort();
  }

  // ============== Message Updates ==============

  /**
   * Match a complete mailbox reference in both individual and combined views.
   */
  private matchesMessageId(
    msg: EmailMessage,
    messageId: string | number,
  ): boolean {
    return matchesMessageById(msg, messageId);
  }

  updateMessage(
    messageId: string | number,
    updates: Partial<EmailMessage>,
  ): void {
    const token = canonicalMessageToken(messageId);
    if (!token || !updatesPreserveIdentity(token, updates)) return;
    const ref = parseAccountQualifiedToken(token);
    if (ref?.kind !== "message") return;

    // Update in messages array
    this._messages = this._messages.map((msg) =>
      this.matchesMessageId(msg, messageId) ? { ...msg, ...updates } : msg,
    );

    this._filteredMessages =
      Object.keys(this._activeFilters).length > 0
        ? filterMessages(this._messages, this._activeFilters)
        : [...this._messages];

    // Update selected message if it matches
    if (
      this._selectedMessage &&
      this.matchesMessageId(this._selectedMessage, messageId)
    ) {
      this._selectedMessage = { ...this._selectedMessage, ...updates };
    }

    // Update in grouped messages
    this._groupedMessages = this._groupedMessages.map((group) => {
      const emails = Array.isArray(group.emails)
        ? group.emails
        : [group.emails];
      return {
        ...group,
        emails: emails.map((msg: EmailMessage) =>
          this.matchesMessageId(msg, messageId) ? { ...msg, ...updates } : msg,
        ),
      };
    });

    // Thread rows also feed selection and the persisted folder snapshot.
    this._threadGroups = Object.fromEntries(
      Object.entries(this._threadGroups).map(([threadId, rows]) => [
        threadId,
        rows.map((msg) =>
          this.matchesMessageId(msg, messageId) ? { ...msg, ...updates } : msg,
        ),
      ]),
    );

    // Update cache
    if (this.cache) {
      this.cache.updateMessage(
        String(ref.accountId),
        token,
        updates,
        ref.folder,
      );
    }

    this.cacheSnapshot();
    this.notify();
  }

  /**
   * Hear about every row a delete or move took out of the mailbox, so a
   * composer bound to that draft can close instead of resaving it.
   */
  onMessageRemoved(listener: (token: string) => void): () => void {
    removalListeners.add(listener);
    return () => {
      removalListeners.delete(listener);
    };
  }

  removeMessage(messageId: string | number): void {
    const token = canonicalMessageToken(messageId);
    if (!token) return;
    const ref = parseAccountQualifiedToken(token);
    if (ref?.kind !== "message") return;
    removalListeners.forEach((listener) => listener(token));
    const knownMessages = [
      ...this._messages,
      ...Object.values(this._threadGroups).flat(),
      ...this._groupedMessages.flatMap((group) => group.emails),
      ...(this._selectedMessage ? [this._selectedMessage] : []),
    ];
    const removedKnownMessage = knownMessages.some((msg) =>
      this.matchesMessageId(msg, token),
    );
    // Remove from messages array
    this._messages = this._messages.filter(
      (msg) => !this.matchesMessageId(msg, messageId),
    );

    // Remove from filtered messages
    this._filteredMessages = this._filteredMessages.filter(
      (msg) => !this.matchesMessageId(msg, messageId),
    );

    // Clear selection if it's the removed message
    if (
      this._selectedMessage &&
      this.matchesMessageId(this._selectedMessage, messageId)
    ) {
      this._selectedMessage = null;
    }

    // Remove from grouped messages
    this._groupedMessages = this._groupedMessages
      .map((group) => {
        const emails = Array.isArray(group.emails)
          ? group.emails
          : [group.emails];
        const filteredEmails = emails.filter(
          (msg: EmailMessage) => !this.matchesMessageId(msg, messageId),
        );
        return {
          ...group,
          emails: filteredEmails,
          count: filteredEmails.length,
        };
      })
      .filter((group) => {
        const emails = Array.isArray(group.emails)
          ? group.emails
          : [group.emails];
        return emails.length > 0;
      });

    // Prune thread groups too: a moved/swept message otherwise survives as a
    // ghost thread-child row until a full reload.
    if (this._threadGroups && Object.keys(this._threadGroups).length > 0) {
      let changed = false;
      const nextGroups: EmailThreadGroupMap = {};
      for (const [threadId, rows] of Object.entries(this._threadGroups)) {
        const remaining = rows.filter(
          (msg: EmailMessage) => !this.matchesMessageId(msg, messageId),
        );
        if (remaining.length !== rows.length) {
          changed = true;
        }
        if (remaining.length > 0) {
          nextGroups[threadId] = remaining;
        }
      }
      if (changed) {
        this._threadGroups = nextGroups;
      }
    }

    // Update total count
    if (removedKnownMessage) {
      this._totalCount = Math.max(0, this._totalCount - 1);
    }
    this._offset = this._messages.length;
    this._hasMore = this._messages.length < this._totalCount;

    // Update cache
    if (this.cache) {
      this.cache.removeMessage(String(ref.accountId), token);
    }

    this.cacheSnapshot();
    this.notify();
  }

  getRequestGeneration(): number {
    return this._requestGeneration;
  }

  applyDiff(delta: MessageSyncDelta, generation?: number): boolean {
    if (!delta || delta.folder !== this._currentFolder) {
      return false;
    }

    // Reject stale deltas from before the last context switch/reset.
    if (generation !== undefined && generation < this._requestGeneration) {
      return false;
    }

    // Consolidated scope guard: reject delta if the account set it was built
    // for no longer matches the current consolidated selection. This prevents
    // stale in-flight deltas from accounts the user just deselected from
    // being applied to the updated view.
    if (
      this._isConsolidated &&
      delta.consolidatedAccountIds &&
      this._currentAccountId
    ) {
      const scopeStr = String(this._currentAccountId);
      // _currentAccountId in consolidated mode is "all:1,2,3"
      const colonIdx = scopeStr.indexOf(":");
      const idsPart = colonIdx >= 0 ? scopeStr.slice(colonIdx + 1) : scopeStr;
      const currentIds = normalizeConsolidatedAccountIds(
        idsPart.split(",").map((s) => Number(s.trim())),
      ).sort((a, b) => a - b);
      const deltaIds = [...delta.consolidatedAccountIds].sort((a, b) => a - b);
      if (
        currentIds.length !== deltaIds.length ||
        currentIds.some((id, i) => id !== deltaIds[i])
      ) {
        return false;
      }
    }

    const deletedTokens = delta.deleted.map(canonicalMessageToken);
    const updatedTokens = delta.updated.map((update) =>
      canonicalMessageToken(update.localId),
    );
    if (
      this._messages.some((message) => !getMessageIdentityKey(message)) ||
      delta.added.some(
        (message) => !getMessageIdentityKey(message as EmailMessage),
      ) ||
      deletedTokens.some((token) => token === null) ||
      delta.updated.some((update, index) => {
        const token = updatedTokens[index];
        return !token || !updatesPreserveIdentity(token, update.changes);
      })
    ) {
      // The caller must reload instead of applying a partially identified delta.
      return false;
    }

    const messageMap = new Map<string, EmailMessage>();
    for (const message of this._messages) {
      messageMap.set(getMessageIdentityKey(message), normalizeMessage(message));
    }

    for (const deletedId of deletedTokens) {
      if (deletedId) messageMap.delete(deletedId);
    }

    for (const message of delta.added as EmailMessage[]) {
      const normalized = normalizeMessage(message);
      messageMap.set(getMessageIdentityKey(normalized), normalized);
    }

    for (const [index, update] of delta.updated.entries()) {
      const token = updatedTokens[index];
      if (!token) continue;
      const existing = messageMap.get(token);
      if (!existing) {
        continue;
      }

      messageMap.set(
        token,
        normalizeMessage({
          ...existing,
          ...update.changes,
        }),
      );
    }

    this._messages = sortMessagesNewestFirst(Array.from(messageMap.values()));
    const changesByToken = new Map(
      delta.updated.map((update, index) => [
        updatedTokens[index],
        update.changes,
      ]),
    );
    this._threadGroups = Object.fromEntries(
      Object.entries(this._threadGroups)
        .map(
          ([threadId, rows]) =>
            [
              threadId,
              rows
                .filter(
                  (row) => !deletedTokens.includes(getMessageIdentityKey(row)),
                )
                .map((row) => {
                  const changes = changesByToken.get(
                    getMessageIdentityKey(row),
                  );
                  return changes
                    ? normalizeMessage({ ...row, ...changes })
                    : row;
                }),
            ] as const,
        )
        .filter(([, rows]) => rows.length > 0),
    );
    this._filteredMessages = filterMessages(
      this._messages,
      this._activeFilters,
    );
    this._groupedMessages = buildGroupedMessages(
      this._messages,
      this.threading,
    );
    this._totalCount = Number.isFinite(delta.total)
      ? delta.total
      : this._messages.length;
    this._offset = this._messages.length;
    this._hasMore = this._messages.length < this._totalCount;
    this._currentSyncToken = delta.syncToken;
    this._lastSyncedAt = Date.now();

    const selectedId = this._selectedMessage
      ? getMessageIdentityKey(this._selectedMessage)
      : null;
    if (selectedId && deletedTokens.includes(selectedId)) {
      this._selectedMessage = null;
    } else {
      const changes = selectedId ? changesByToken.get(selectedId) : undefined;
      if (this._selectedMessage && changes) {
        this._selectedMessage = normalizeMessage({
          ...this._selectedMessage,
          ...changes,
        });
      }
      this.reconcileSelectedMessage(
        [...this._messages, ...Object.values(this._threadGroups).flat()],
        false,
      );
    }

    // Combined-inbox readiness can change mid-session (e.g. a mailbox auth-fails
    // between full page loads); refresh the chips from the diff so the UI flips to
    // an error chip within one head-delta cycle instead of showing a stale
    // "syncing…" spinner until the next full reload.
    if (this._isConsolidated && delta.consolidatedAccountReadiness) {
      this._consolidatedAccountReadiness = delta.consolidatedAccountReadiness;
    }

    this.cacheSnapshot();
    this.notify();
    return true;
  }

  // ============== Additional Utilities ==============

  /**
   * Get the current account ID.
   */
  getCurrentAccountId(): string | number | null {
    return this._currentAccountId;
  }

  /**
   * Get raw unfiltered messages.
   */
  getRawMessages(): EmailMessage[] {
    return this._messages;
  }

  /**
   * Full reset: clears all state including per-folder snapshots.
   * Used on logout or when all state must be discarded.
   */
  /**
   * Abort all in-flight list fetches and advance the request generation so any
   * superseded completions become cache-only instead of overwriting state.
   */
  private abortActiveListRequests(): void {
    this._requestGeneration++;
    for (const controller of this._activeListControllers) {
      controller.abort();
    }
    this._activeListControllers.clear();
  }

  reset(): void {
    this.abortActiveListRequests();
    this._messages = [];
    this._filteredMessages = [];
    this._groupedMessages = [];
    this._threadGroups = {};
    this._selectedMessage = null;
    this._isLoading = false;
    this._isLoadingMore = false;
    this._hasMore = false;
    this._totalCount = 0;
    this._currentFolder = "INBOX";
    this._currentAccountId = null;
    this._isConsolidated = false;
    this._currentConsolidatedAccountIds = [];
    this._activeFilters = {};
    this._currentOffsetStart = 0;
    this._currentLimit = DEFAULT_LIMIT;
    this._currentGrouping = "list";
    this._currentSort = "newest";
    this._offset = 0;
    this._loadMoreCooldownUntil = 0;
    this._lastLoadMoreError = "";
    this._currentSyncToken = null;
    this._lastSyncedAt = null;
    this._folderStates.clear();
    this._inFlightRequests.clear();
    this.notify();
  }

  /**
   * Soft reset for account switches: saves current folder state,
   * clears in-memory state, but preserves per-folder snapshots
   * so returning to a previously visited account+folder is instant.
   */
  switchContext(accountId: string | number, folder: string): void {
    // Cancel any in-flight list fetch for the previous context so it cannot
    // complete late and overwrite the account/folder we are switching to.
    this.abortActiveListRequests();

    // Save current state before switching
    if (this._currentAccountId !== null && this._messages.length > 0) {
      this.saveFolderState();
    }

    // Reset in-memory state
    this._messages = [];
    this._filteredMessages = [];
    this._groupedMessages = [];
    this._threadGroups = {};
    this._selectedMessage = null;
    this._isLoading = false;
    this._isLoadingMore = false;
    this._hasMore = false;
    this._totalCount = 0;
    this._currentFolder = folder;
    this._currentAccountId = accountId;
    this._isConsolidated = false;
    this._currentConsolidatedAccountIds = [];
    this._activeFilters = {};
    this._currentOffsetStart = 0;
    this._currentLimit = DEFAULT_LIMIT;
    this._currentGrouping = "list";
    this._currentSort = "newest";
    this._offset = 0;
    this._loadMoreCooldownUntil = 0;
    this._lastLoadMoreError = "";
    this._currentSyncToken = null;
    this._lastSyncedAt = null;

    // Try to restore from saved state for the new context
    const savedState = this.restoreFolderState(accountId, folder);
    if (savedState && savedState.messages.length > 0) {
      this.hydrateFromFolderState(savedState);
    }

    this.notify();
  }
}

/**
 * Singleton instance for shared inbox operations.
 */
let inboxServiceInstance: InboxService | null = null;

/**
 * Get the shared InboxService instance.
 */
export function getInboxService(
  cache?: ICacheService,
  threading?: IThreadingService,
  connectionState?: IConnectionStateService,
): InboxService {
  if (!inboxServiceInstance) {
    inboxServiceInstance = new InboxService(cache, threading, connectionState);
  }
  return inboxServiceInstance;
}

/**
 * Reset the inbox service (mainly for testing or account switching).
 */
export function resetInboxService(): void {
  if (inboxServiceInstance) {
    inboxServiceInstance.reset();
  }
  inboxServiceInstance = null;
}
