import { getMessageIdentityKey } from "@/lib/message-identity";
import { useEffect } from "react";

import { useInbox, useInboxState } from "@/context/InboxContext";
import { isSyncBusy } from "@/hooks/useSyncDriver";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";

/**
 * How long to wait after the list settles before warming bodies. Long enough
 * that paging quickly through the list does not queue a fetch per page.
 */
const SETTLE_MS = 750;

/** How long to wait between warm batches, so one page is not a single burst. */
const WARM_BATCH_DELAY_MS = 800;

/**
 * Most batches one settle may send.
 *
 * A page window is fifty messages, so ten batches covers it. Twenty is the
 * ceiling that keeps a large consolidated view from turning the settle into an
 * unbounded walk; whatever is left is picked up when the list settles again.
 */
const MAX_WARM_BATCHES_PER_SETTLE = 20;

/**
 * Only the head of the list is warmed. The reader is looking at the top of the
 * page, and every row below the window is a fetch the next scroll will ask for
 * anyway.
 */
const WARM_PAGE_LIMIT = 50;

/**
 * Warm the bodies of the messages currently on screen, five at a time.
 *
 * Opening a message is slow on a modest server because the body is fetched from
 * IMAP on the click. The boot path used to warm the first few once, so paging or
 * changing folder landed back on cold bodies. This warms the page window instead,
 * in the same small batches the endpoint accepts, and it is the only warm driver:
 * the tab is open, so the tab does the work.
 *
 * It stands down completely whenever something else needs the server. An advance
 * in flight, a sync already reported slow, a hidden tab, or a click waiting to be
 * served each end the loop for this settle, because the site runs two PHP workers
 * and the reader's own message is what they are waiting for. The list settling
 * again, or the reader paging, starts a fresh pass.
 *
 * Already-cached messages are dropped by the prefetch service, so a repeat pass
 * over the same page costs one request that warms nothing and then stops.
 */
export function useVisibleBodyPrefetch(): void {
  const { prefetch, selectedAccountId, selectedFolder } = useInbox();
  const { messages } = useInboxState();

  // Identity of the current page window: changing folder, page or selection set
  // gives a new key, which cancels the loop and restarts the settle timer.
  const pageKey = messages
    .slice(0, WARM_PAGE_LIMIT)
    .map((message) => `${message.accountId ?? ""}:${message.uid ?? message.id}`)
    .join(",");

  useEffect(() => {
    if (!prefetch || messages.length === 0) return undefined;

    let cancelled = false;
    let timer: number | undefined;

    const wait = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    const warm = async (): Promise<void> => {
      // One queue per mailbox: a consolidated view mixes accounts and folders.
      const byMailbox = new Map<
        string,
        { accountId: string; folder: string; ids: Array<string | number> }
      >();

      for (const message of messages.slice(0, WARM_PAGE_LIMIT)) {
        const messageId = getMessageIdentityKey(message);
        if (!messageId) continue;

        const accountId = String(message.accountId ?? selectedAccountId ?? "");
        if (!accountId) continue;

        const folder = message.folder!;
        const key = JSON.stringify([accountId, folder]);
        const bucket = byMailbox.get(key) ?? {
          accountId,
          folder,
          ids: [] as Array<string | number>,
        };
        bucket.ids.push(messageId);
        byMailbox.set(key, bucket);
      }

      let sent = 0;

      for (const { accountId, folder, ids } of byMailbox.values()) {
        if (ids.length === 0) continue;

        while (!cancelled && sent < MAX_WARM_BATCHES_PER_SETTLE) {
          // A click wins, and so does anything the sync driver is doing. The
          // server has two workers, and a warm batch that takes one of them is
          // taking it from the message somebody is waiting for.
          if (prefetch.hasUserSelectedPending()) return;
          if (getConnectionStateService().getSyncDelayed()) return;
          if (isSyncBusy()) return;
          if (typeof document !== "undefined" && document.hidden) return;

          sent += 1;
          const outcome = await prefetch.warmBatch(accountId, folder, ids);
          if (cancelled) return;

          // Nothing warmed and nothing the server wants back: the rest of this
          // window is cached, skipped, or unknown to the mirror. Asking again
          // would only spend the rate budget to be told the same thing.
          if (outcome.warmed === 0 && outcome.deferred.length === 0) break;

          await wait(WARM_BATCH_DELAY_MS);
        }
      }
    };

    timer = window.setTimeout(() => {
      void warm();
    }, SETTLE_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // `pageKey` stands in for the message list: a new page restarts the warm-up.
  }, [pageKey, prefetch, selectedAccountId, selectedFolder, messages]);
}
