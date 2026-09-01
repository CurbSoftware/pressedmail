/**
 * Prefetch Service Implementation
 *
 * Priority-based fetch queue for message bodies with cache-first loading.
 * Never aborts fetches, every completed fetch populates the cache.
 *
 * @since 2.0.0
 */

import type { EmailMessage } from "@/types";
import type { IPrefetchService, FetchPriority } from "../interfaces";
import type { PrefetchOutcome } from "../interfaces/prefetch.interface";
import type { ICacheService } from "../interfaces";
import type { IConnectionStateService } from "../interfaces/connection-state.interface";
import {
  messageDetailRouteApi,
  messageBatchDetailRouteApi,
  buildApiUrl,
} from "@/context/Strings";
import { apiFetch, isRequestTimeoutError } from "@/lib/api-client";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";

/**
 * A user click gets a generous budget: the server bounds the live detail fetch under its own
 * ~8s deadline, so the client must not abort at the default 20s and miscount a slow-but-working
 * fetch as an error. Background/visible prefetches keep the default timeout (best-effort).
 */
const USER_SELECTED_TIMEOUT_MS = 45_000;

/**
 * Internal queue item.
 */
interface QueueItem {
  accountId: string;
  folder: string;
  messageId: string | number;
  priority: FetchPriority;
  resolve: (value: PrefetchOutcome) => void;
  reject: (error: Error) => void;
}

/**
 * Priority weights for sorting (lower = higher priority).
 */
const PRIORITY_WEIGHT: Record<FetchPriority, number> = {
  "user-selected": 0,
  visible: 1,
  background: 2,
};

/**
 * Max concurrent fetches to avoid overloading the server.
 */
const MAX_CONCURRENT = 2;

/**
 * Max batch size for background prefetch.
 */
const MAX_BATCH_SIZE = 15;

/**
 * Build a deduplication key.
 */
function buildKey(
  accountId: string,
  folder: string,
  messageId: string | number,
): string {
  return `${accountId}:${folder}:${messageId}`;
}

/**
 * Normalize API response message detail.
 */
function normalizeDetail(detail: EmailMessage): EmailMessage {
  const htmlBody =
    detail.htmlBody ?? detail.bodyHtml ?? detail.html_body ?? detail.body_html;
  const plainBody = detail.plainBody ?? detail.plain_body;
  const textBody = detail.textBody ?? detail.text_body;

  return {
    ...detail,
    ...(htmlBody !== undefined ? { htmlBody } : {}),
    ...(plainBody !== undefined ? { plainBody } : {}),
    ...(textBody !== undefined ? { textBody } : {}),
    labels: Array.isArray(detail.labels)
      ? detail.labels
      : detail.labels
        ? [String(detail.labels)]
        : [],
  };
}

function hasMessageBody(detail: EmailMessage): boolean {
  return Boolean(
    detail.htmlBody ||
    detail.bodyHtml ||
    detail.html_body ||
    detail.body_html ||
    detail.plainBody ||
    detail.plain_body ||
    detail.textBody ||
    detail.text_body ||
    detail.body,
  );
}

/**
 * Prefetch Service Implementation
 */
export class PrefetchService implements IPrefetchService {
  private cache: ICacheService;
  private connectionState: IConnectionStateService | null;
  private queue: QueueItem[] = [];
  private inFlight = new Map<string, Promise<PrefetchOutcome>>();
  private activeCount = 0;
  private destroyed = false;

  constructor(cache: ICacheService, connectionState?: IConnectionStateService) {
    this.cache = cache;
    this.connectionState = connectionState ?? null;

    // Bind the public contract so methods survive being extracted as detached
    // references. Consumers pass these around as callbacks / effect deps, e.g.
    // useInboxSurfaceBoot does `const prefetchBatch = inbox.prefetch.prefetchBatch`
    // then calls it bare, without binding, `this` is undefined and the guards
    // throw "Cannot read properties of undefined (reading 'destroyed')".
    this.fetchDetail = this.fetchDetail.bind(this);
    this.prefetchBatch = this.prefetchBatch.bind(this);
    this.hasDetail = this.hasDetail.bind(this);
    this.cancelBackground = this.cancelBackground.bind(this);
    this.cancelForFolder = this.cancelForFolder.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  fetchDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
    priority: FetchPriority,
  ): Promise<PrefetchOutcome> {
    if (this.destroyed) return Promise.resolve(null);

    // Skip fetch for unhealthy accounts (except user-selected which is explicit)
    if (
      priority !== "user-selected" &&
      this.connectionState &&
      !this.connectionState.isHealthy(accountId)
    ) {
      return Promise.resolve(null);
    }

    // Cache-first: check cache immediately
    const cached = this.cache.getMessageDetail(accountId, folder, messageId);
    if (cached && hasMessageBody(cached)) {
      return Promise.resolve({ detail: normalizeDetail(cached) });
    }

    const key = buildKey(accountId, folder, messageId);

    // Deduplication: if already in-flight, return the same promise
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    // Queue the fetch and return a promise
    const promise = new Promise<PrefetchOutcome>((resolve, reject) => {
      // If user-selected, remove any existing lower-priority entry for this key
      if (priority === "user-selected") {
        this.queue = this.queue.filter(
          (item) =>
            buildKey(item.accountId, item.folder, item.messageId) !== key,
        );
      }

      this.queue.push({
        accountId,
        folder,
        messageId,
        priority,
        resolve,
        reject,
      });

      // Sort: highest priority first
      this.queue.sort(
        (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority],
      );
    });

    this.inFlight.set(key, promise);

    // Clean up in-flight map when promise settles
    promise.finally(() => {
      this.inFlight.delete(key);
    });

    // Kick the queue processor
    this.processQueue();

    return promise;
  }

  prefetchBatch(
    accountId: string,
    folder: string,
    messageIds: Array<string | number>,
  ): void {
    if (this.destroyed) return;

    // Skip batch prefetch for unhealthy accounts
    if (this.connectionState && !this.connectionState.isHealthy(accountId)) {
      console.warn(
        `[PrefetchService] skipping batch prefetch, account ${accountId} unhealthy`,
      );
      return;
    }

    // Filter out already-cached messages
    const uncached = messageIds.filter(
      (id) => !this.cache.hasDetail(accountId, folder, id),
    );

    if (uncached.length === 0) return;

    // For background prefetch, use the batch API directly
    // instead of queueing individual fetches
    const batches: Array<Array<string | number>> = [];
    for (let i = 0; i < uncached.length; i += MAX_BATCH_SIZE) {
      batches.push(uncached.slice(i, i + MAX_BATCH_SIZE));
    }

    this.executeBatchesSequentially(accountId, folder, batches);
  }

  hasDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): boolean {
    return this.cache.hasDetail(accountId, folder, messageId);
  }

  cancelBackground(): void {
    // Remove all background-priority items from the queue
    const removed = this.queue.filter((item) => item.priority === "background");
    this.queue = this.queue.filter((item) => item.priority !== "background");

    // Resolve removed items as null (they weren't fetched)
    for (const item of removed) {
      item.resolve(null);
      const key = buildKey(item.accountId, item.folder, item.messageId);
      this.inFlight.delete(key);
    }
  }

  /**
   * Cancel all queued (non-active) prefetches for a specific folder.
   * Called on folder switch to avoid wasting bandwidth on the old folder.
   * In-flight requests are NOT cancelled since they'll populate the cache.
   */
  cancelForFolder(accountId: string, folder: string): void {
    const removed = this.queue.filter(
      (item) => item.accountId === accountId && item.folder === folder,
    );
    this.queue = this.queue.filter(
      (item) => !(item.accountId === accountId && item.folder === folder),
    );

    for (const item of removed) {
      item.resolve(null);
      const key = buildKey(item.accountId, item.folder, item.messageId);
      this.inFlight.delete(key);
    }
  }

  destroy(): void {
    this.destroyed = true;
    // Resolve all pending items as null
    for (const item of this.queue) {
      item.resolve(null);
    }
    this.queue = [];
    this.inFlight.clear();
  }

  // ============== Private Queue Processing ==============

  private processQueue(): void {
    if (this.destroyed) return;

    while (this.activeCount < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      const key = buildKey(item.accountId, item.folder, item.messageId);

      // Double-check cache (might have been populated by a batch fetch)
      const cached = this.cache.getMessageDetail(
        item.accountId,
        item.folder,
        item.messageId,
      );
      if (cached && hasMessageBody(cached)) {
        item.resolve({ detail: normalizeDetail(cached) });
        continue;
      }

      this.activeCount++;

      this.executeSingleFetch(
        item.accountId,
        item.folder,
        item.messageId,
        item.priority,
      )
        .then((outcome) => {
          item.resolve(outcome);
        })
        .catch((err) => {
          item.resolve(null);
          console.error("[PrefetchService] fetch error:", err);
        })
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  private async executeSingleFetch(
    accountId: string,
    folder: string,
    messageId: string | number,
    priority: FetchPriority,
  ): Promise<PrefetchOutcome> {
    const isUserSelected = priority === "user-selected";
    try {
      const apiUrl = buildApiUrl(`${messageDetailRouteApi}${accountId}`, {
        folder,
        uid: String(messageId),
        ...getMailboxSourceRequestParams(),
      });

      const response = await apiFetch(
        apiUrl,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
        // A user click gets the generous budget so a slow-but-working server is not aborted
        // at 20s and miscounted as an error; background/visible keep the default.
        isUserSelected ? { timeoutMs: USER_SELECTED_TIMEOUT_MS } : {},
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // The server still assembling the body reports bodyState:'pending' with only a header
      // stub. Surface it as pending and NEVER cache (a re-poll must re-fetch to complete it).
      if (data?.bodyState === "pending") {
        return { pending: true };
      }

      if (data?.status !== "success" || !data?.data) {
        // An error-envelope response. On an explicit user click surface a distinct hard failure so
        // the reading pane can show a "couldn't load this message" error branch (with Retry) rather
        // than a false "No content". Background/visible prefetches stay best-effort (null).
        if (isUserSelected) {
          const reason =
            typeof data?.message === "string" ? data.message : undefined;
          return { failed: true, reason };
        }
        return null;
      }

      const bodyState = ["full", "partial", "pending"].includes(
        String(data?.bodyState),
      )
        ? (data.bodyState as EmailMessage["bodyState"])
        : undefined;
      const detail = normalizeDetail({
        ...(data.data as EmailMessage),
        ...(bodyState ? { bodyState } : {}),
      });

      // Cache the result, but NEVER a partial (budget/deadline-truncated) body, or a reopen
      // would serve the incomplete copy instead of re-fetching to complete it.
      if (data?.bodyState !== "partial") {
        this.cache.setMessageDetail(accountId, detail.folder || folder, detail);
      }

      return { detail };
    } catch (err) {
      // A user-selected fetch that hits its (generous) budget is "still working", not a hard
      // error: surface pending so the UI shows a "taking longer" affordance and re-polls.
      if (isUserSelected && isRequestTimeoutError(err)) {
        return { pending: true };
      }
      console.error("[PrefetchService] single fetch error:", err);
      // A hard (non-timeout) error on an explicit user click is a distinct failure, surface it so
      // the pane shows an error branch with Retry instead of a false "No content". Background/
      // visible prefetches remain best-effort (null), so background behavior is unchanged.
      if (isUserSelected) {
        return {
          failed: true,
          reason: err instanceof Error ? err.message : undefined,
        };
      }
      return null;
    }
  }

  private async executeBatchesSequentially(
    accountId: string,
    folder: string,
    batches: Array<Array<string | number>>,
  ): Promise<void> {
    for (const batch of batches) {
      if (this.destroyed) return;
      await this.executeBatchFetch(accountId, folder, batch);
    }
  }

  private async executeBatchFetch(
    accountId: string,
    folder: string,
    uids: Array<string | number>,
  ): Promise<void> {
    try {
      const response = await apiFetch(
        buildApiUrl(
          messageBatchDetailRouteApi,
          getMailboxSourceRequestParams(),
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_id: accountId,
            folder,
            uids,
            ...getMailboxSourceRequestParams(),
          }),
        },
      );

      if (!response.ok) {
        console.error(
          `[PrefetchService] batch fetch HTTP ${response.status} for ${uids.length} UIDs`,
        );
        return;
      }

      const data = await response.json();
      if (data?.status !== "success" || !data?.data) {
        console.warn(
          "[PrefetchService] batch fetch returned non-success:",
          data?.status,
          data?.message,
        );
        return;
      }

      const results = data.data as Record<string, EmailMessage>;

      for (const [uid, detail] of Object.entries(results)) {
        if (!detail) continue;
        const normalized = normalizeDetail(detail);
        this.cache.setMessageDetail(
          accountId,
          normalized.folder || folder,
          normalized,
        );

        // If there's a pending queue item for this UID, resolve it
        const key = buildKey(accountId, folder, uid);
        const queueIdx = this.queue.findIndex(
          (item) =>
            buildKey(item.accountId, item.folder, item.messageId) === key,
        );
        if (queueIdx !== -1) {
          const removed = this.queue.splice(queueIdx, 1);
          if (removed[0]) {
            removed[0].resolve({ detail: normalized });
            this.inFlight.delete(key);
          }
        }
      }
    } catch (err) {
      console.error("[PrefetchService] batch fetch error:", err);
    }
  }
}

/**
 * Singleton instance.
 */
let prefetchServiceInstance: PrefetchService | null = null;

/**
 * Get the shared PrefetchService instance.
 */
export function getPrefetchService(
  cache: ICacheService,
  connectionState?: IConnectionStateService,
): PrefetchService {
  if (!prefetchServiceInstance) {
    prefetchServiceInstance = new PrefetchService(cache, connectionState);
  }
  return prefetchServiceInstance;
}

/**
 * Reset the prefetch service (for testing or cleanup).
 */
export function resetPrefetchService(): void {
  if (prefetchServiceInstance) {
    prefetchServiceInstance.destroy();
  }
  prefetchServiceInstance = null;
}
