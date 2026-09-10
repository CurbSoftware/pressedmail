import { getMessageIdentityKey } from "@/lib/message-identity";
import { useEffect, useRef } from "react";

import { useInbox, useInboxState } from "@/context/InboxContext";
import { isSyncBusy } from "@/hooks/useSyncDriver";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";

/**
 * How long to wait after the list settles before warming bodies. Long enough
 * that paging quickly through the list does not queue a fetch per page.
 */
const SETTLE_MS = 750;

/** How long to wait before looking again when the sync driver was mid-tick. */
const RETRY_MS = 4000;

/** Give up re-checking after this many busy passes, until the list changes again. */
const MAX_RETRIES = 5;

/**
 * Warm the bodies of the messages currently on screen.
 *
 * Opening a message is slow on a modest server because the body is fetched from
 * IMAP on the click. The boot path already warms the first few, but only once,
 * so paging or changing folder lands back on cold bodies.
 *
 * This warms the whole visible page instead, and only while nothing else is
 * running: an advance in flight, or a sync already reported as slow, means the
 * server has no spare capacity and prefetching would make the thing it is
 * trying to help worse. Work goes through the existing batch endpoint, which
 * takes fifteen messages per request, so a full page costs two requests against
 * a fifty-per-minute budget.
 *
 * Already-cached messages are filtered out by the prefetch service, so a repeat
 * pass over the same page is free.
 */
export function useVisibleBodyPrefetch(): void {
  const { prefetch, selectedAccountId, selectedFolder } = useInbox();
  const { messages } = useInboxState();
  const retriesRef = useRef(0);

  // Identity of the current page: changing folder, page or selection set gives
  // a new key, which restarts the settle timer and the retry budget.
  const pageKey = messages
    .map((message) => `${message.accountId ?? ""}:${message.uid ?? message.id}`)
    .join(",");

  useEffect(() => {
    if (!prefetch || messages.length === 0) return undefined;

    retriesRef.current = 0;
    let timer: number | undefined;
    let cancelled = false;

    const attempt = (): void => {
      if (cancelled) return;

      // The server is already behind. Adding body fetches now is the opposite
      // of helpful, so wait for the next list change rather than retrying.
      if (getConnectionStateService().getSyncDelayed()) return;

      if (isSyncBusy()) {
        if (retriesRef.current >= MAX_RETRIES) return;
        retriesRef.current += 1;
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }

      // One batch per mailbox: a consolidated view mixes accounts and folders.
      const byMailbox = new Map<
        string,
        { accountId: string; folder: string; ids: Array<string | number> }
      >();

      for (const message of messages) {
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

      for (const { accountId, folder, ids } of byMailbox.values()) {
        if (ids.length > 0) {
          prefetch.prefetchBatch(accountId, folder, ids);
        }
      }
    };

    timer = window.setTimeout(attempt, SETTLE_MS);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // `pageKey` stands in for the message list: a new page restarts the warm-up.
  }, [pageKey, prefetch, selectedAccountId, selectedFolder, messages]);
}
