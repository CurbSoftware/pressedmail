/**
 * Prefetch Service Interface
 *
 * Defines the contract for background message body prefetching
 * with priority queue and cache-first loading.
 *
 * @since 2.0.0
 */

import type { EmailMessage } from "@/types";

/**
 * Fetch priority levels.
 * - "user-selected": Highest priority: user clicked a message.
 * - "visible": Medium: message is visible in the list.
 * - "background": Lowest: prefetch during idle time.
 */
export type FetchPriority = "user-selected" | "visible" | "background";

/**
 * Quad-state outcome of a single detail fetch:
 * - `{ detail }`        the message body loaded (or came from cache).
 * - `{ pending: true }` the server is still assembling the body (bodyState:'pending') or the
 *                       request hit its budget (RequestTimeoutError), the caller should show a
 *                       "taking longer" affordance and re-poll, NOT treat it as empty/failed.
 * - `{ failed: true }`  a hard error on an explicit user-selected fetch (thrown non-timeout error
 *                       OR an error-envelope response). The caller shows a distinct "couldn't load
 *                       this message" error branch with a manual Retry. NEVER a false "No content".
 * - `null`              a non-terminal miss on a background/visible prefetch (skipped, unhealthy,
 *                       or a best-effort hard error). Background behavior is unchanged.
 *
 * Pending/partial/failed outcomes are NEVER cached, so a re-poll always re-fetches and can complete.
 */
export type PrefetchOutcome =
  | { detail: EmailMessage }
  | { pending: true }
  | { failed: true; reason?: string; requiresRefresh?: boolean }
  | null;

/**
 * IPrefetchService Interface
 *
 * Manages a priority queue for fetching message details.
 * Cache-first: returns cached data instantly, queues fetches for misses.
 * Never aborts: all fetches run to completion and populate the cache.
 */
export interface IPrefetchService {
  /**
   * Fetch a single message detail.
   * Returns cached data immediately if available, otherwise queues
   * the fetch at the given priority and returns a promise.
   */
  fetchDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
    priority: FetchPriority,
  ): Promise<PrefetchOutcome>;

  /**
   * Prefetch multiple message bodies in the background.
   * Filters out already-cached messages and queues the rest
   * at "background" priority using the batch API.
   */
  prefetchBatch(
    accountId: string,
    folder: string,
    messageIds: Array<string | number>,
  ): void;

  /**
   * Check if a message detail is already cached.
   */
  hasDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): boolean;

  /**
   * Cancel all background-priority fetches (e.g., on folder change).
   * In-flight requests still complete and cache their results.
   */
  cancelBackground(): void;

  /**
   * Cancel all queued prefetches for a specific folder.
   * Called on folder switch to avoid fetching for the old folder.
   * In-flight requests still complete and cache their results.
   */
  cancelForFolder(accountId: string, folder: string): void;

  /**
   * Destroy the service (clear queues, cancel pending work).
   */
  destroy(): void;
}
