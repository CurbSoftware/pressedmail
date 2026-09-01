import { useRef, useEffect, useCallback } from "react";

interface UseInfiniteScrollOptions {
  /** Whether more items are available to load */
  hasMore: boolean;
  /** Whether items are currently being loaded */
  isLoadingMore: boolean;
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Function to load more items */
  loadMore: () => void;
  /** Root margin for early trigger (default: "200px") */
  rootMargin?: string;
}

/**
 * Hook that uses IntersectionObserver to trigger loading more items
 * when a sentinel element becomes visible near the bottom of a scroll container.
 */
export function useInfiniteScroll({
  hasMore,
  isLoadingMore,
  isLoading,
  loadMore,
  rootMargin = "200px",
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
        loadMore();
      }
    },
    [hasMore, isLoadingMore, isLoading, loadMore],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin,
    });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersect, rootMargin]);

  return { sentinelRef };
}
