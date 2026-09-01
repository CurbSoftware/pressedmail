import { __ } from "@wordpress/i18n";
import { Loader2 } from "lucide-react";

import { useInboxState, useInbox } from "@/context/InboxContext";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

/**
 * Sentinel element for infinite scroll. Place at the bottom of a scrollable
 * message list. Triggers `loadMore()` via IntersectionObserver when visible.
 */
export function LoadMoreSentinel() {
  const { hasMore, isLoadingMore, isLoading, messages, totalCount } =
    useInboxState();
  const { loadMore } = useInbox();

  const { sentinelRef } = useInfiniteScroll({
    hasMore,
    isLoadingMore,
    isLoading,
    loadMore,
  });

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-4">
      {isLoadingMore && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{__("Loading more messages...", "pressedmail")}</span>
        </div>
      )}
      {!hasMore && messages.length > 0 && messages.length >= totalCount && (
        <span className="text-xs text-muted-foreground">
          {__("All messages loaded", "pressedmail")}
        </span>
      )}
    </div>
  );
}
