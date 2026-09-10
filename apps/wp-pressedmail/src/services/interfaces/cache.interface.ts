/**
 * Cache Service Interface
 *
 * Multi-layer caching abstraction for email data.
 * Supports in-memory caching with session storage persistence.
 *
 * @since 2.0.0
 */

import type { EmailMessage, EmailThreadGroupMap, GroupedMessage } from "@/types";
import type { EmailListGroupingMode } from "@/lib/message-grouping";
import type { ImapFolder } from "./folder.interface";

/**
 * Cache key for message lists.
 */
export interface CacheKey {
  /** Account identifier (email or ID) */
  accountId: string;
  /** IMAP folder path */
  folder: string;
  /** Pagination offset (optional) */
  offset?: number;
  /** Page size limit (optional) */
  limit?: number;
  /** List grouping mode represented by the cached page. */
  grouping?: EmailListGroupingMode;
  /** Stable signature for active list filters represented by the cache entry. */
  filterSignature?: string;
  /**
   * Combined-inbox scope discriminator (serialized per-account folder_map +
   * account set). Present ONLY for consolidated reads so two combined pages over
   * the same logical folder but different per-account routing don't collide.
   * Omitted for single-mailbox reads, which keeps their key bytes unchanged.
   */
  consolidatedKey?: string;
}

/**
 * Pattern for cache invalidation.
 * Undefined fields act as wildcards.
 */
export interface CacheKeyPattern {
  /** Account identifier pattern */
  accountId?: string;
  /** Folder pattern */
  folder?: string;
}

/**
 * Cached message list entry.
 */
export interface CachedMessageList {
  /** List of messages */
  messages: EmailMessage[];
  /** Grouped messages (by thread/category) */
  groupedMessages: GroupedMessage[];
  /** Total message count in folder */
  totalCount: number;
  /** Current offset */
  offset: number;
  /** Cache timestamp */
  timestamp: number;
  /** Whether more messages exist */
  hasMore: boolean;
  /** Sync token for incremental polling */
  syncToken?: string | null;
  /** Last successful sync timestamp */
  lastSyncedAt?: number | null;
  /** Server-provided thread messages keyed by thread id. */
  threadGroups?: EmailThreadGroupMap;
  /** Grouping mode represented by this cache entry. */
  grouping?: EmailListGroupingMode;
}

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Total number of cache entries */
  totalEntries: number;
  /** Estimated memory usage in bytes */
  memoryUsage: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Oldest entry timestamp */
  oldestEntry?: number;
  /** Newest entry timestamp */
  newestEntry?: number;
}

/**
 * Default TTL values in milliseconds.
 */
export const DEFAULT_CACHE_TTL = {
  /** Message list hard TTL: 10 minutes (data evicted after this) */
  MESSAGE_LIST: 10 * 60 * 1000,
  /** Message list stale threshold: 2 minutes (background diff triggered after this) */
  MESSAGE_LIST_STALE: 2 * 60 * 1000,
  /** Message detail TTL: 30 minutes */
  MESSAGE_DETAIL: 30 * 60 * 1000,
  /** Folder list TTL: 5 minutes */
  FOLDER_LIST: 5 * 60 * 1000,
  /** Folder counts TTL: 1 minute */
  FOLDER_COUNTS: 1 * 60 * 1000,
} as const;

/**
 * Result from stale-while-revalidate cache lookup.
 */
export interface StaleWhileRevalidateResult {
  /** The cached data */
  data: CachedMessageList;
  /** Whether the data is past the stale threshold (needs background refresh) */
  isStale: boolean;
}

/**
 * ICacheService Interface
 *
 * Multi-layer caching abstraction.
 * Implementations handle in-memory caching, TTL expiration,
 * and optional session storage persistence.
 */
export interface ICacheService {
  // ============== Message List Cache ==============

  /**
   * Get cached message list.
   *
   * @param key - Cache key
   * @returns Cached entry or null if not found/expired
   */
  getMessages(key: CacheKey): CachedMessageList | null;

  /**
   * Get cached message list with stale-while-revalidate semantics.
   * Returns data past the stale threshold but before hard TTL expiry,
   * signaling that a background refresh should be triggered.
   *
   * @param key - Cache key
   * @returns Object with data and staleness flag, or null if not found/hard-expired
   */
  getMessagesAllowStale(key: CacheKey): StaleWhileRevalidateResult | null;

  /**
   * Store message list in cache.
   *
   * @param key - Cache key
   * @param data - Message list data to cache
   * @param ttl - Time-to-live in milliseconds (optional)
   */
  setMessages(key: CacheKey, data: CachedMessageList, ttl?: number): void;

  /**
   * Invalidate message cache entries matching pattern.
   *
   * @param pattern - Pattern to match (undefined = wildcard)
   */
  invalidateMessages(pattern: CacheKeyPattern): void;

  // ============== Message Detail Cache ==============

  /**
   * Get cached message detail (with full body).
   *
   * @param accountId - Account identifier
   * @param folder - Folder path
   * @param messageId - Message identifier
   * @returns Cached message or null if not found/expired
   */
  getMessageDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): EmailMessage | null;

  /**
   * Store message detail in cache.
   *
   * @param accountId - Account identifier
   * @param folder - Folder path
   * @param message - Full message with body
   * @param ttl - Time-to-live in milliseconds (optional)
   */
  setMessageDetail(
    accountId: string,
    folder: string,
    message: EmailMessage,
    ttl?: number,
  ): void;

  /**
   * Check if a message detail exists in cache (without returning the full object).
   *
   * @param accountId - Account identifier
   * @param folder - Folder path
   * @param messageId - Message identifier
   * @returns True if cached and not expired
   */
  hasDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): boolean;

  /**
   * Invalidate a specific message detail.
   *
   * @param accountId - Account identifier
   * @param folder - Folder path
   * @param messageId - Message identifier
   */
  invalidateMessageDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): void;

  // ============== Folder Cache ==============

  /**
   * Get cached folder list.
   *
   * @param accountId - Account identifier
   * @returns Cached folders or null if not found/expired
   */
  getFolders(accountId: string): ImapFolder[] | null;

  /**
   * Store folder list in cache.
   *
   * @param accountId - Account identifier
   * @param folders - Folder list
   * @param ttl - Time-to-live in milliseconds (optional)
   */
  setFolders(accountId: string, folders: ImapFolder[], ttl?: number): void;

  /**
   * Invalidate folder cache for an account.
   *
   * @param accountId - Account identifier (undefined = all accounts)
   */
  invalidateFolders(accountId?: string): void;

  // ============== Cache Management ==============

  /**
   * Clear all cache entries.
   */
  clear(): void;

  /**
   * Clear cache for a specific account.
   *
   * @param accountId - Account identifier
   */
  clearForAccount(accountId: string): void;

  /**
   * Get cache statistics.
   *
   * @returns Cache stats object
   */
  getStats(): CacheStats;

  /**
   * Persist cache to session storage.
   * Called automatically on significant changes.
   */
  persistToStorage(): void;

  /**
   * Restore cache from session storage.
   * Called on service initialization.
   */
  restoreFromStorage(): void;

  /**
   * Run cache cleanup to remove expired entries.
   * Called periodically or manually.
   */
  cleanup(): void;

  // ============== Update Operations ==============

  /**
   * Update a message in all relevant cache entries.
   * Used for optimistic updates after mutations.
   *
   * @param accountId - Account identifier
   * @param messageId - Message identifier
   * @param updates - Partial message data to merge
   * @param folder - Source IMAP folder; UIDs are only unique within a folder
   */
  updateMessage(
    accountId: string,
    messageId: string | number,
    updates: Partial<EmailMessage>,
    folder: string,
  ): void;

  /**
   * Remove a message from all relevant cache entries.
   * Used for optimistic updates after deletion.
   *
   * @param accountId - Account identifier
   * @param messageId - Message identifier
   */
  removeMessage(accountId: string, messageId: string | number): void;
}
