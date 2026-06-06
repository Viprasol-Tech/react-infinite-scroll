import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildObserverInit,
  latestEntry,
  shouldLoadMore,
  toError,
  type ScrollDirection,
} from "./logic.js";

/** Options accepted by {@link useInfiniteScroll}. */
export interface UseInfiniteScrollOptions {
  /**
   * Called when the sentinel becomes visible and loading is permitted.
   * May be synchronous or return a Promise; the hook tracks the in-flight
   * state so `loadMore` is never invoked twice concurrently. If it rejects,
   * the hook captures the error, stops auto-loading, and waits for `retry`.
   */
  loadMore: () => void | Promise<void>;
  /** Whether more pages exist. When false, `loadMore` will not be called. */
  hasMore: boolean;
  /** Disable the observer entirely without unmounting. Defaults to true. */
  enabled?: boolean;
  /**
   * Where new pages are appended. `"down"` (default) is a classic bottom
   * sentinel feed; `"up"` is the chat pattern with a top sentinel. The value
   * does not change the observer mechanics but is surfaced so the component
   * layer (and consumers) can position the sentinel and restore scroll.
   */
  direction?: ScrollDirection;
  /** The scroll root. Defaults to the browser viewport (null). */
  root?: Element | Document | null;
  /** Margin around the root, as CSS string or px number. Defaults to "0px". */
  rootMargin?: string | number;
  /** Visibility ratio(s) that trigger the callback. Defaults to 0. */
  threshold?: number | number[];
  /**
   * Called when `loadMore` throws/rejects. Receives the normalized `Error`.
   * The hook also exposes the error via its return value.
   */
  onError?: (error: Error) => void;
}

/** Values returned by {@link useInfiniteScroll}. */
export interface UseInfiniteScrollResult<T extends Element> {
  /** Attach this ref to the sentinel element at the end (or top) of your list. */
  sentinelRef: (node: T | null) => void;
  /** True while a `loadMore` call is in flight. */
  isLoading: boolean;
  /**
   * The error from the most recent failed `loadMore`, or `null`. While this is
   * non-null, automatic loading is paused until `retry` (or `reset`) is called.
   */
  error: Error | null;
  /**
   * Clear any outstanding error and immediately re-attempt `loadMore`
   * (subject to the usual guards). No-op while already loading.
   */
  retry: () => void;
  /** Clear any outstanding error without triggering a load. */
  reset: () => void;
  /** The resolved scroll direction (`"down"` | `"up"`). */
  direction: ScrollDirection;
}

/**
 * Observe a sentinel element with IntersectionObserver and call `loadMore`
 * exactly once each time it becomes visible — provided we are enabled, not
 * already loading, there is more data to fetch, and no error is outstanding.
 *
 * The actual "may we load?" decision is delegated to the pure
 * {@link shouldLoadMore} helper so the guard logic stays testable. Errors from
 * `loadMore` are captured into `error`; while set, auto-loading is paused and
 * the consumer drives recovery with `retry`.
 */
export function useInfiniteScroll<T extends Element = HTMLDivElement>(
  options: UseInfiniteScrollOptions,
): UseInfiniteScrollResult<T> {
  const {
    loadMore,
    hasMore,
    enabled = true,
    direction = "down",
    root = null,
    rootMargin,
    threshold,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs hold the freshest values so the observer callback (created once per
  // observed node) never reads stale props captured at subscription time.
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);
  const enabledRef = useRef(enabled);
  const onErrorRef = useRef(onError);
  const isLoadingRef = useRef(false);
  const hasErrorRef = useRef(false);

  loadMoreRef.current = loadMore;
  hasMoreRef.current = hasMore;
  enabledRef.current = enabled;
  onErrorRef.current = onError;

  const nodeRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const runLoadMore = useCallback(async () => {
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      await loadMoreRef.current();
      // A successful load clears any previously recorded error.
      hasErrorRef.current = false;
      setError(null);
    } catch (err) {
      const normalized = toError(err);
      hasErrorRef.current = true;
      setError(normalized);
      onErrorRef.current?.(normalized);
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
        hasError: hasErrorRef.current,
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

  const reset = useCallback(() => {
    hasErrorRef.current = false;
    setError(null);
  }, []);

  const retry = useCallback(() => {
    if (isLoadingRef.current) return;
    if (!hasMoreRef.current || !enabledRef.current) {
      reset();
      return;
    }
    hasErrorRef.current = false;
    setError(null);
    void runLoadMore();
  }, [reset, runLoadMore]);

  // Re-subscribe when enable/observer options change, and clean up on unmount.
  useEffect(() => {
    observe();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [observe, enabled]);

  return { sentinelRef, isLoading, error, retry, reset, direction };
}
