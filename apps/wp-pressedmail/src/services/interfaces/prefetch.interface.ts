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
 * What one warm batch did.
 *
 * `warmed` counts the bodies this client cached, which is the number that
 * decides whether another batch is worth sending. `deferred` is the server
 * asking for those UIDs back on the next settle, rather than in a tight loop.
 */
export interface WarmBatchOutcome {
  warmed: number;
  deferred: Array<string | number>;
  skipped: number;
}

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
   * Warm a few message bodies ahead of a click, five at a time.
   *
   * The endpoint behind this opens live IMAP, so it is bounded on purpose:
   * already-cached ids are dropped, only one mailbox generation is sent, and a
   * failure is never an error. The caller stops on a failed batch and retries
   * whatever the server deferred on the next settle.
   */
  warmBatch(
    accountId: string,
    folder: string,
    messageIds: Array<string | number>,
  ): Promise<WarmBatchOutcome>;

  /**
   * Whether a click is queued or in flight. The warm loop pauses on true, so a
   * background fetch never sits in front of the message somebody just opened.
   */
  hasUserSelectedPending(): boolean;

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
