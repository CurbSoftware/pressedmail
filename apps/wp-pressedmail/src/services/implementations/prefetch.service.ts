/**
 * Prefetch Service Implementation
 *
 * Priority-based fetch queue for message bodies with cache-first loading.
 * Never aborts fetches, every completed fetch populates the cache.
 *
 * @since 2.0.0
 */

import type { EmailMessage } from "@/types";
import {
  parseAccountQualifiedToken,
  getMessageIdentityKey,
  type MessageIdentityRef,
} from "@/lib/message-identity";
import type { IPrefetchService, FetchPriority, WarmBatchOutcome } from "../interfaces";
import type { PrefetchOutcome } from "../interfaces/prefetch.interface";
import type { ICacheService } from "../interfaces";
import type { IConnectionStateService } from "../interfaces/connection-state.interface";
import { messageDetailRouteApi, messageWarmRouteApi, buildApiUrl } from "@/context/Strings";
import { apiFetch, isRequestTimeoutError } from "@/lib/api-client";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";

/**
 * A user click gets a generous budget: the server bounds the live detail fetch under its own
 * ~8s deadline, so the client must not abort at the default 20s and miscount a slow-but-working
 * fetch as an error. Background/visible prefetches keep the default timeout (best-effort).
 */
const USER_SELECTED_TIMEOUT_MS = 45_000;

/**
 * Message bodies per warm request.
 *
 * The warm endpoint opens live IMAP, so this is deliberately small: five
 * messages is one or two seconds of server work, short enough that the reader's
 * next click is never more than one message away from being served. The server
 * refuses more than five regardless.
 */
const WARM_BATCH_SIZE = 5;

/**
 * Budget for one warm request.
 *
 * Long because it is live IMAP behind the server's own 12s total warm budget,
 * and short enough that a wedged provider gives the loop back rather than
 * holding it for the default 20s and then another.
 */
const WARM_REQUEST_TIMEOUT_MS = 30_000;

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
 * Build a deduplication key.
 */
function resolveReference(
  accountId: string,
  folder: string,
  messageId: string | number,
): MessageIdentityRef | null {
  const ref =
    typeof messageId === "string"
      ? parseAccountQualifiedToken(messageId)
      : null;
  return ref?.kind === "message" &&
    String(ref.accountId) === accountId &&
    ref.folder === folder
    ? ref
    : null;
}

function buildKey(
  accountId: string,
  folder: string,
  messageId: string | number,
): string {
  const ref = resolveReference(accountId, folder, messageId);
  return ref ? getMessageIdentityKey(ref as EmailMessage) : "";
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
  /**
   * Keys with a user-selected fetch ACTUALLY running. An item leaves the queue
   * before its fetch starts, so the queue alone cannot answer "is a click
   * waiting", which is what the warm loop pauses on.
   */
  private userSelectedActive = new Set<string>();
  private activeCount = 0;
  private destroyed = false;

  constructor(cache: ICacheService, connectionState?: IConnectionStateService) {
    this.cache = cache;
    this.connectionState = connectionState ?? null;

    // Bind the public contract so methods survive being extracted as detached
    // references. Consumers pass these around as callbacks / effect deps, e.g.
    // useVisibleBodyPrefetch reads `prefetch.warmBatch`, an unbound method makes
    // `this` undefined and the guards throw "Cannot read properties of undefined
    // (reading 'destroyed')".
    this.fetchDetail = this.fetchDetail.bind(this);
    this.warmBatch = this.warmBatch.bind(this);
    this.hasUserSelectedPending = this.hasUserSelectedPending.bind(this);
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
    if (!resolveReference(accountId, folder, messageId))
      return Promise.resolve({
        failed: true,
        requiresRefresh: true,
        reason: "The message identity is incomplete. Reload the mailbox.",
      });

    // Skip fetch for unhealthy accounts (except user-selected which is explicit)
    if (
      priority !== "user-selected" &&
      this.connectionState &&
      !this.connectionState.isHealthy(accountId)
    ) {
      return Promise.resolve(null);
    }

    const key = buildKey(accountId, folder, messageId);

    // Cache-first: check cache immediately
    const cached = this.cache.getMessageDetail(accountId, folder, messageId);
    if (
      cached &&
      getMessageIdentityKey(cached) === key &&
      hasMessageBody(cached)
    ) {
      return Promise.resolve({ detail: normalizeDetail(cached) });
    }

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

  /**
   * Warm a few message bodies ahead of a click.
   *
   * Never throws: warming is a convenience, so a refused or timed-out batch
   * reports zeros and the caller stops until the list settles again.
   */
  async warmBatch(
    accountId: string,
    folder: string,
    messageIds: Array<string | number>,
  ): Promise<WarmBatchOutcome> {
    const nothing: WarmBatchOutcome = { warmed: 0, deferred: [], skipped: 0 };
    if (this.destroyed) return nothing;

    // Warming an account the connection state already calls unhealthy would fetch
    // into a wall. A click is explicit and does not come through here.
    if (this.connectionState && !this.connectionState.isHealthy(accountId)) {
      return nothing;
    }

    const references: MessageIdentityRef[] = [];
    for (const id of messageIds) {
      const ref = resolveReference(accountId, folder, id);
      if (!ref) continue;
      const key = getMessageIdentityKey(ref as EmailMessage);
      if (!key || this.cache.hasDetail(accountId, folder, key)) continue;
      references.push(ref);
      if (references.length === WARM_BATCH_SIZE) break;
    }

    const first = references[0];
    if (!first) return nothing;

    // One mailbox generation per request, because the server refuses a batch that
    // straddles two. A page is one generation in practice; anything else waits for
    // the next pass, when the cached ones drop out and these come first.
    const uids = references
      .filter((ref) => ref.uidValidity === first.uidValidity)
      .map((ref) => ref.uid);
    const requested = new Set(
      references.map((ref) => getMessageIdentityKey(ref as EmailMessage)),
    );

    try {
      const response = await apiFetch(
        buildApiUrl(
          `${messageWarmRouteApi}${accountId}`,
          getMailboxSourceRequestParams(),
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            folder,
            uid_validity: first.uidValidity,
            uids,
            ...getMailboxSourceRequestParams(),
          }),
        },
        { timeoutMs: WARM_REQUEST_TIMEOUT_MS },
      );

      if (!response.ok) {
        console.warn(
          `[PrefetchService] warm batch HTTP ${response.status} for ${uids.length} UIDs`,
        );
        return nothing;
      }

      const data = await response.json();
      if (this.destroyed) return nothing;
      if (data?.status !== "success" || !data?.data) {
        console.warn(
          "[PrefetchService] warm batch returned non-success:",
          data?.status,
          data?.message,
        );
        return nothing;
      }

      const results = data.data as Record<string, EmailMessage>;
      let warmed = 0;

      for (const [uid, detail] of Object.entries(results)) {
        if (!detail) continue;
        const identity = getMessageIdentityKey(detail);
        // Only a detail whose identity was actually asked for, arriving under the
        // UID it claims, is trustworthy enough to cache under that identity.
        if (!requested.has(identity)) continue;
        if (uid !== String(detail.uid) && uid !== identity) continue;
        this.cache.setMessageDetail(accountId, first.folder, normalizeDetail(detail));
        warmed += 1;
      }

      return {
        warmed,
        deferred: Array.isArray(data?.deferred) ? data.deferred : [],
        skipped:
          data?.skipped && typeof data.skipped === "object"
            ? Object.keys(data.skipped).length
            : 0,
      };
    } catch (err) {
      console.warn("[PrefetchService] warm batch failed:", err);
      return nothing;
    }
  }

  hasUserSelectedPending(): boolean {
    return (
      this.userSelectedActive.size > 0 ||
      this.queue.some((item) => item.priority === "user-selected")
    );
  }

  hasDetail(
    accountId: string,
    folder: string,
    messageId: string | number,
  ): boolean {
    return (
      Boolean(resolveReference(accountId, folder, messageId)) &&
      this.cache.hasDetail(accountId, folder, messageId)
    );
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
      if (
        cached &&
        getMessageIdentityKey(cached) === key &&
        hasMessageBody(cached)
      ) {
        item.resolve({ detail: normalizeDetail(cached) });
        continue;
      }

      this.activeCount++;
      if (item.priority === "user-selected") this.userSelectedActive.add(key);

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
          if (item.priority === "user-selected") this.userSelectedActive.delete(key);
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
    const ref = resolveReference(accountId, folder, messageId);
    if (!ref)
      return {
        failed: true,
        requiresRefresh: true,
        reason: "Reload the mailbox before opening this message.",
      };
    try {
      const apiUrl = buildApiUrl(`${messageDetailRouteApi}${accountId}`, {
        folder,
        uid: ref.uid,
        uid_validity: ref.uidValidity,
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
        return isUserSelected
          ? {
              failed: true,
              requiresRefresh: response.status === 409,
              reason:
                response.status === 409
                  ? "The mailbox changed. Reload it before opening the message."
                  : `HTTP error! status: ${response.status}`,
            }
          : null;
      }

      const data = await response.json();
      if (this.destroyed) return null;

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

      if (
        getMessageIdentityKey(detail) !==
        getMessageIdentityKey(ref as EmailMessage)
      ) {
        return {
          failed: true,
          requiresRefresh: true,
          reason: "The message identity changed. Reload the mailbox.",
        };
      }

      // Cache the result, but NEVER a partial (budget/deadline-truncated) body, or a reopen
      // would serve the incomplete copy instead of re-fetching to complete it.
      if (data?.bodyState !== "partial") {
        this.cache.setMessageDetail(accountId, ref.folder, detail);
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
