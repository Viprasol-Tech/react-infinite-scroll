import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildObserverInit,
  latestEntry,
  shouldLoadMore,
} from "./logic.js";

/** Options accepted by {@link useInfiniteScroll}. */
export interface UseInfiniteScrollOptions {
  /**
   * Called when the sentinel becomes visible and loading is permitted.
   * May be synchronous or return a Promise; the hook tracks the in-flight
   * state so `loadMore` is never invoked twice concurrently.
   */
  loadMore: () => void | Promise<void>;
  /** Whether more pages exist. When false, `loadMore` will not be called. */
  hasMore: boolean;
  /** Disable the observer entirely without unmounting. Defaults to true. */
  enabled?: boolean;
  /** The scroll root. Defaults to the browser viewport (null). */
  root?: Element | Document | null;
  /** Margin around the root, as CSS string or px number. Defaults to "0px". */
  rootMargin?: string | number;
  /** Visibility ratio(s) that trigger the callback. Defaults to 0. */
  threshold?: number | number[];
}

/** Values returned by {@link useInfiniteScroll}. */
export interface UseInfiniteScrollResult<T extends Element> {
  /** Attach this ref to the sentinel element at the end of your list. */
  sentinelRef: (node: T | null) => void;
  /** True while a `loadMore` call is in flight. */
  isLoading: boolean;
}

/**
 * Observe a sentinel element with IntersectionObserver and call `loadMore`
 * exactly once each time it becomes visible — provided we are enabled, not
 * already loading, and there is more data to fetch.
 *
 * The actual "may we load?" decision is delegated to the pure
 * {@link shouldLoadMore} helper so the guard logic stays testable.
 */
export function useInfiniteScroll<T extends Element = HTMLDivElement>(
  options: UseInfiniteScrollOptions,
): UseInfiniteScrollResult<T> {
  const {
    loadMore,
    hasMore,
    enabled = true,
    root = null,
    rootMargin,
    threshold,
  } = options;

  const [isLoading, setIsLoading] = useState(false);

  // Refs hold the freshest values so the observer callback (created once per
  // observed node) never reads stale props captured at subscription time.
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);
  const enabledRef = useRef(enabled);
  const isLoadingRef = useRef(false);

  loadMoreRef.current = loadMore;
  hasMoreRef.current = hasMore;
  enabledRef.current = enabled;

  const nodeRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const runLoadMore = useCallback(async () => {
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      await loadMoreRef.current();
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const handleEntries = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = latestEntry(entries);
      if (!entry) return;
      const allowed = shouldLoadMore({
        isIntersecting: entry.isIntersecting,
        isLoading: isLoadingRef.current,
        hasMore: hasMoreRef.current,
        enabled: enabledRef.current,
      });
      if (allowed) {
        void runLoadMore();
      }
    },
    [runLoadMore],
  );

  const observe = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    const node = nodeRef.current;
    if (!node || !enabledRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      handleEntries,
      buildObserverInit({ root, rootMargin, threshold }),
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [handleEntries, root, rootMargin, threshold]);

  // Callback ref: re-subscribe whenever the sentinel node changes.
  const sentinelRef = useCallback(
    (node: T | null) => {
      nodeRef.current = node;
      observe();
    },
    [observe],
  );

  // Re-subscribe when enable/observer options change, and clean up on unmount.
  useEffect(() => {
    observe();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [observe, enabled]);

  return { sentinelRef, isLoading };
}
