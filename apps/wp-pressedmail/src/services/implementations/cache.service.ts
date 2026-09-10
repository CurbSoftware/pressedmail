import {
  getPrincipalStorageItem,
  removePrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";
/**
 * Cache Service Implementation
 *
 * Multi-layer caching for email data with session storage persistence.
 * Provides TTL-based expiration and pattern-based invalidation.
 *
 * @since 2.0.0
 */

import {
  getMessageIdentityKey,
  parseAccountQualifiedToken,
} from "@/lib/message-identity";
import type { EmailMessage, GroupedMessage } from "@/types";
import type {
  ICacheService,
  CacheKey,
  CacheKeyPattern,
  CachedMessageList,
  CacheStats,
  ImapFolder,
  StaleWhileRevalidateResult,
} from "../interfaces";
import { DEFAULT_CACHE_TTL } from "../interfaces";

/**
 * Internal cache entry with metadata.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Session storage keys.
 */
const STORAGE_KEYS = {
  MESSAGE_CACHE: "pressedmail-message-cache-v2",
  DETAIL_CACHE: "pressedmail-detail-cache-v2",
  FOLDER_CACHE: "pressedmail-folder-cache",
} as const;

const STORAGE_BUDGETS = {
  MESSAGE_CACHE_CHARS: 1_200_000,
  DETAIL_CACHE_CHARS: 500_000,
  FOLDER_CACHE_CHARS: 100_000,
  MESSAGE_CACHE_EMERGENCY_CHARS: 300_000,
  DETAIL_CACHE_EMERGENCY_CHARS: 100_000,
  FOLDER_CACHE_EMERGENCY_CHARS: 50_000,
  MAX_MESSAGE_PAGES: 40,
  MAX_DETAIL_ENTRIES: 100,
  MAX_FOLDER_ENTRIES: 25,
} as const;

/**
 * Build a cache key string from CacheKey object.
 */
function buildCacheKeyString(key: CacheKey): string {
  return JSON.stringify([
    key.accountId,
    key.folder,
    key.grouping ?? "list",
    key.filterSignature ?? "nofilters",
    key.consolidatedKey ?? null,
    key.offset ?? null,
    key.limit ?? null,
  ]);
}

function buildDetailKeyString(
  accountId: string,
  folder: string,
  messageId: string | number,
): string {
  const ref =
    typeof messageId === "string"
      ? parseAccountQualifiedToken(messageId)
      : null;
  return ref?.kind === "message" &&
    String(ref.accountId) === accountId &&
    ref.folder === folder
    ? JSON.stringify([ref.accountId, ref.folder, ref.uidValidity, ref.uid])
    : "";
}

function matchesMessageId(
  message: EmailMessage,
  messageId: string | number,
): boolean {
  const key = getMessageIdentityKey(message);
  return key !== "" && key === messageId;
}

function completeList(data: CachedMessageList): boolean {
  const rows = [
    ...data.messages,
    ...data.groupedMessages.flatMap((group) =>
      Array.isArray(group.emails) ? group.emails : [group.emails],
    ),
    ...Object.values(data.threadGroups ?? {}).flat(),
  ];
  return rows.every((row) => getMessageIdentityKey(row) !== "");
}

function isExpired<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp > entry.ttl;
}

function hasCurrentAttachmentParts(message: EmailMessage): boolean {
  return (message.attachments ?? []).every(
    (attachment) =>
      attachment.part_format === "imap-section-v1" &&
      attachment.metadata_format === "decoded-attachment-v1",
  );
}

function serializeBoundedCache<T>(
  cache: Map<string, CacheEntry<T>>,
  options: { maxEntries: number; maxChars: number },
): string {
  const candidates = [...cache.entries()]
    .filter(([, entry]) => !isExpired(entry))
    .sort(([, a], [, b]) => b.timestamp - a.timestamp)
    .slice(0, options.maxEntries);

  const record: Record<string, CacheEntry<T>> = {};
  let serialized = "{}";

  for (const [key, entry] of candidates) {
    const next = { ...record, [key]: entry };
    const nextSerialized = JSON.stringify(next);

    if (nextSerialized.length > options.maxChars) {
      if (serialized === "{}") {
        continue;
      }
      break;
    }

    record[key] = entry;
    serialized = nextSerialized;
  }

  return serialized;
}

/**
 * Check if a key matches a pattern.
 */
function matchesPattern(key: string, pattern: CacheKeyPattern): boolean {
  try {
    const [accountId, folder] = JSON.parse(key) as string[];
    return (
      (!pattern.accountId || pattern.accountId === accountId) &&
      (!pattern.folder || pattern.folder === folder)
    );
  } catch {
    return false;
  }
}

/**
 * Cache Service Implementation
 *
 * Implements ICacheService with in-memory Maps and session storage persistence.
 */
export class CacheService implements ICacheService {
  private messageCache = new Map<string, CacheEntry<CachedMessageList>>();
  private detailCache = new Map<string, CacheEntry<EmailMessage>>();
  private folderCache = new Map<string, CacheEntry<ImapFolder[]>>();

  // Stats tracking
  private hits = 0;
  private misses = 0;

  constructor() {
    removePrincipalStorageItem("session", "pressedmail-message-cache");
    removePrincipalStorageItem("session", "pressedmail-detail-cache");
    // Restore from session storage on initialization
    this.restoreFromStorage();

    // Setup periodic cleanup (every 5 minutes)
    if (typeof window !== "undefined") {
      setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  // ============== Message List Cache ==============

  getMessages(key: CacheKey): CachedMessageList | null {
    const cacheKey = buildCacheKeyString(key);
    const entry = this.messageCache.get(cacheKey);

    if (!entry || isExpired(entry)) {
      this.misses++;
      if (entry) {
        this.messageCache.delete(cacheKey);
      }
      return null;
    }

    this.hits++;
    return entry.data;
  }

  getMessagesAllowStale(key: CacheKey): StaleWhileRevalidateResult | null {
    const cacheKey = buildCacheKeyString(key);
    const entry = this.messageCache.get(cacheKey);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Hard TTL exceeded, evict
    if (isExpired(entry)) {
      this.misses++;
      this.messageCache.delete(cacheKey);
      return null;
    }

    this.hits++;
    const age = Date.now() - entry.timestamp;
    const isStale = age > DEFAULT_CACHE_TTL.MESSAGE_LIST_STALE;
    return { data: entry.data, isStale };
  }

  setMessages(
    key: CacheKey,
    data: CachedMessageList,
    ttl = DEFAULT_CACHE_TTL.MESSAGE_LIST,
  ): void {
    if (!completeList(data)) return;
    const cacheKey = buildCacheKeyString(key);
    this.messageCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Persist on significant changes
    this.debouncedPersist();
  }

  invalidateMessages(pattern: CacheKeyPattern): void {
    for (const key of this.messageCache.keys()) {
      if (matchesPattern(key, pattern)) {
        this.messageCache.delete(key);
      }
    }
    this.debouncedPersist();
  }

  // ============== Message Detail Cache ==============

  getMessageDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): EmailMessage | null {
    const cacheKey = buildDetailKeyString(accountId, folder, messageId);
    const entry = this.detailCache.get(cacheKey);

    if (!entry || isExpired(entry)) {
      this.misses++;
      if (entry) {
        this.detailCache.delete(cacheKey);
      }
      return null;
    }

    this.hits++;
    return entry.data;
  }

  hasDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): boolean {
    const cacheKey = buildDetailKeyString(accountId, folder, messageId);
    const entry = this.detailCache.get(cacheKey);
    if (!entry || isExpired(entry)) {
      if (entry) {
        this.detailCache.delete(cacheKey);
      }
      return false;
    }
    return true;
  }

  setMessageDetail(
    accountId: string,
    folder: string,
    message: EmailMessage,
    ttl = DEFAULT_CACHE_TTL.MESSAGE_DETAIL,
  ): void {
    const messageId = getMessageIdentityKey(message);
    if (!buildDetailKeyString(accountId, folder, messageId)) return;

    const cacheKey = buildDetailKeyString(accountId, folder, messageId);
    this.detailCache.set(cacheKey, {
      data: message,
      timestamp: Date.now(),
      ttl,
    });

    // Also update in any message lists
    this.updateMessageInLists(accountId, messageId, message, folder);

    this.debouncedPersist();
  }

  invalidateMessageDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): void {
    const cacheKey = buildDetailKeyString(accountId, folder, messageId);
    this.detailCache.delete(cacheKey);
    this.debouncedPersist();
  }

  // ============== Folder Cache ==============

  getFolders(accountId: string): ImapFolder[] | null {
    const entry = this.folderCache.get(accountId);

    if (!entry || isExpired(entry)) {
      this.misses++;
      if (entry) {
        this.folderCache.delete(accountId);
      }
      return null;
    }

    this.hits++;
    return entry.data;
  }

  setFolders(
    accountId: string,
    folders: ImapFolder[],
    ttl = DEFAULT_CACHE_TTL.FOLDER_LIST,
  ): void {
    this.folderCache.set(accountId, {
      data: folders,
      timestamp: Date.now(),
      ttl,
    });
    this.debouncedPersist();
  }

  invalidateFolders(accountId?: string): void {
    if (accountId) {
      this.folderCache.delete(accountId);
    } else {
      this.folderCache.clear();
    }
    this.debouncedPersist();
  }

  // ============== Cache Management ==============

  clear(): void {
    this.messageCache.clear();
    this.detailCache.clear();
    this.folderCache.clear();
    this.hits = 0;
    this.misses = 0;
    this.clearStorage();
  }

  clearForAccount(accountId: string): void {
    // Clear message lists
    for (const key of this.messageCache.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this.messageCache.delete(key);
      }
    }

    // Clear message details
    for (const key of this.detailCache.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this.detailCache.delete(key);
      }
    }

    // Clear folders
    this.folderCache.delete(accountId);

    this.debouncedPersist();
  }

  getStats(): CacheStats {
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;
    let memoryUsage = 0;

    // Calculate stats from all caches
    const allEntries: CacheEntry<unknown>[] = [
      ...this.messageCache.values(),
      ...this.detailCache.values(),
      ...this.folderCache.values(),
    ];

    for (const entry of allEntries) {
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
      // Rough memory estimate
      memoryUsage += JSON.stringify(entry.data).length * 2;
    }

    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      totalEntries:
        this.messageCache.size + this.detailCache.size + this.folderCache.size,
      memoryUsage,
      hitRate,
      hits: this.hits,
      misses: this.misses,
      oldestEntry,
      newestEntry,
    };
  }

  persistToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      this.writeStorageSnapshot({
        messageChars: STORAGE_BUDGETS.MESSAGE_CACHE_CHARS,
        detailChars: STORAGE_BUDGETS.DETAIL_CACHE_CHARS,
        folderChars: STORAGE_BUDGETS.FOLDER_CACHE_CHARS,
      });
    } catch (error) {
      // Storage quota exceeded or other error
      console.warn("[CacheService] Failed to persist to storage:", error);
      this.clearStorage();
      try {
        this.writeStorageSnapshot({
          messageChars: STORAGE_BUDGETS.MESSAGE_CACHE_EMERGENCY_CHARS,
          detailChars: STORAGE_BUDGETS.DETAIL_CACHE_EMERGENCY_CHARS,
          folderChars: STORAGE_BUDGETS.FOLDER_CACHE_EMERGENCY_CHARS,
        });
      } catch {
        this.clearStorage();
      }
    }
  }

  restoreFromStorage(): void {
    if (typeof window === "undefined") return;

    try {
      // Restore message cache
      const messageData = getPrincipalStorageItem(
        "session",
        STORAGE_KEYS.MESSAGE_CACHE,
      );
      if (messageData) {
        const parsed = JSON.parse(messageData) as Record<
          string,
          CacheEntry<CachedMessageList>
        >;
        for (const [key, entry] of Object.entries(parsed)) {
          if (
            !isExpired(entry) &&
            completeList(entry.data) &&
            entry.data.messages.every(hasCurrentAttachmentParts)
          ) {
            this.messageCache.set(key, entry);
          }
        }
      }

      // Restore detail cache
      const detailData = getPrincipalStorageItem(
        "session",
        STORAGE_KEYS.DETAIL_CACHE,
      );
      if (detailData) {
        const parsed = JSON.parse(detailData) as Record<
          string,
          CacheEntry<EmailMessage>
        >;
        for (const [key, entry] of Object.entries(parsed)) {
          if (
            !isExpired(entry) &&
            key === getMessageIdentityKey(entry.data) &&
            key !== "" &&
            hasCurrentAttachmentParts(entry.data)
          ) {
            this.detailCache.set(key, entry);
          }
        }
      }

      // Restore folder cache
      const folderData = getPrincipalStorageItem(
        "session",
        STORAGE_KEYS.FOLDER_CACHE,
      );
      if (folderData) {
        const parsed = JSON.parse(folderData) as Record<
          string,
          CacheEntry<ImapFolder[]>
        >;
        for (const [key, entry] of Object.entries(parsed)) {
          if (!isExpired(entry)) {
            this.folderCache.set(key, entry);
          }
        }
      }
    } catch (error) {
      console.warn("[CacheService] Failed to restore from storage:", error);
      this.clearStorage();
    }
  }

  cleanup(): void {
    // Remove expired entries from message cache
    for (const [key, entry] of this.messageCache.entries()) {
      if (isExpired(entry)) {
        this.messageCache.delete(key);
      }
    }

    // Remove expired entries from detail cache
    for (const [key, entry] of this.detailCache.entries()) {
      if (isExpired(entry)) {
        this.detailCache.delete(key);
      }
    }

    // Remove expired entries from folder cache
    for (const [key, entry] of this.folderCache.entries()) {
      if (isExpired(entry)) {
        this.folderCache.delete(key);
      }
    }

    this.debouncedPersist();
  }

  // ============== Update Operations ==============

  updateMessage(
    accountId: string,
    messageId: string | number,
    updates: Partial<EmailMessage>,
    folder: string,
  ): void {
    const key = buildDetailKeyString(accountId, folder, messageId);
    if (!key) return;
    this.updateMessageInLists(accountId, key, updates, folder);
    const entry = this.detailCache.get(key);
    if (entry && getMessageIdentityKey({ ...entry.data, ...updates }) === key) {
      this.detailCache.set(key, {
        ...entry,
        data: { ...entry.data, ...updates },
        timestamp: Date.now(),
      });
    }
    this.debouncedPersist();
  }

  removeMessage(accountId: string, messageId: string | number): void {
    const ref =
      typeof messageId === "string"
        ? parseAccountQualifiedToken(messageId)
        : null;
    if (ref?.kind !== "message") return;
    const token = buildDetailKeyString(accountId, ref.folder, messageId);
    if (!token) return;
    for (const [key, entry] of this.messageCache.entries()) {
      const keep = (message: EmailMessage) => !matchesMessageId(message, token);
      const messages = entry.data.messages.filter(keep);
      let changed = messages.length !== entry.data.messages.length;
      const groupedMessages = entry.data.groupedMessages.flatMap((group) => {
        const before = Array.isArray(group.emails)
          ? group.emails
          : [group.emails];
        const remaining = before.filter(keep);
        if (remaining.length === before.length) return [group];
        changed = true;
        return remaining.length
          ? [
              {
                ...group,
                count: Math.max(
                  0,
                  group.count - (before.length - remaining.length),
                ),
                emails: Array.isArray(group.emails) ? remaining : remaining[0]!,
              },
            ]
          : [];
      });
      const threadGroups = entry.data.threadGroups
        ? Object.fromEntries(
            Object.entries(entry.data.threadGroups).flatMap(([id, rows]) => {
              const remaining = rows.filter(keep);
              if (remaining.length !== rows.length) changed = true;
              return remaining.length ? [[id, remaining]] : [];
            }),
          )
        : undefined;
      if (changed)
        this.messageCache.set(key, {
          ...entry,
          timestamp: Date.now(),
          data: {
            ...entry.data,
            messages,
            groupedMessages,
            threadGroups,
            totalCount: Math.max(0, entry.data.totalCount - 1),
          },
        });
    }
    this.detailCache.delete(token);
    this.debouncedPersist();
  }

  // ============== Private Helpers ==============

  /**
   * Update a message in all relevant list caches.
   */
  private updateMessageInLists(
    accountId: string,
    messageId: string | number,
    updates: Partial<EmailMessage>,
    folder: string,
  ): void {
    const token = buildDetailKeyString(accountId, folder, messageId);
    if (!token) return;
    for (const [key, entry] of this.messageCache.entries()) {
      let updated = false;
      const update = (message: EmailMessage): EmailMessage => {
        if (!matchesMessageId(message, token)) return message;
        const next = { ...message, ...updates };
        if (getMessageIdentityKey(next) !== token) return message;
        updated = true;
        return next;
      };
      const messages = entry.data.messages.map(update);
      const groupedMessages = entry.data.groupedMessages.map((group) => ({
        ...group,
        emails: Array.isArray(group.emails)
          ? group.emails.map(update)
          : update(group.emails),
      }));
      const threadGroups = entry.data.threadGroups
        ? Object.fromEntries(
            Object.entries(entry.data.threadGroups).map(([id, rows]) => [
              id,
              rows.map(update),
            ]),
          )
        : undefined;
      if (updated)
        this.messageCache.set(key, {
          ...entry,
          timestamp: Date.now(),
          data: { ...entry.data, messages, groupedMessages, threadGroups },
        });
    }
  }

  /**
   * Debounced persist to avoid excessive storage writes.
   */
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private debouncedPersist(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }
    this.persistTimeout = setTimeout(() => {
      this.persistToStorage();
      this.persistTimeout = null;
    }, 1000);
  }

  private writeStorageSnapshot(budget: {
    messageChars: number;
    detailChars: number;
    folderChars: number;
  }): void {
    const saved = [
      setPrincipalStorageItem(
        "session",
        STORAGE_KEYS.MESSAGE_CACHE,
        serializeBoundedCache(this.messageCache, {
          maxEntries: STORAGE_BUDGETS.MAX_MESSAGE_PAGES,
          maxChars: budget.messageChars,
        }),
      ),
      setPrincipalStorageItem(
        "session",
        STORAGE_KEYS.DETAIL_CACHE,
        serializeBoundedCache(this.detailCache, {
          maxEntries: STORAGE_BUDGETS.MAX_DETAIL_ENTRIES,
          maxChars: budget.detailChars,
        }),
      ),
      setPrincipalStorageItem(
        "session",
        STORAGE_KEYS.FOLDER_CACHE,
        serializeBoundedCache(this.folderCache, {
          maxEntries: STORAGE_BUDGETS.MAX_FOLDER_ENTRIES,
          maxChars: budget.folderChars,
        }),
      ),
    ];
    if (saved.some((result) => !result))
      throw new Error("Mailbox cache could not be persisted.");
  }

  /**
   * Clear session storage.
   */
  private clearStorage(): void {
    if (typeof window === "undefined") return;

    removePrincipalStorageItem("session", STORAGE_KEYS.MESSAGE_CACHE);
    removePrincipalStorageItem("session", STORAGE_KEYS.DETAIL_CACHE);
    removePrincipalStorageItem("session", STORAGE_KEYS.FOLDER_CACHE);
  }
}

/**
 * Singleton instance for shared cache access.
 */
let cacheServiceInstance: CacheService | null = null;

/**
 * Get the shared CacheService instance.
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

/**
 * Reset the cache service (mainly for testing).
 */
export function resetCacheService(): void {
  if (cacheServiceInstance) {
    cacheServiceInstance.clear();
  }
  cacheServiceInstance = null;
}
