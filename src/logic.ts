/**
 * Pure, framework-agnostic logic for the infinite-scroll machinery.
 *
 * Keeping the decision logic free of React makes it trivial to unit test the
 * exact conditions under which a `loadMore` call is (or is not) allowed.
 */

/** The observable state that governs whether more items may be loaded. */
export interface InfiniteScrollState {
  /** The sentinel element is currently intersecting the viewport/root. */
  isIntersecting: boolean;
  /** A `loadMore` call is in flight; we must not start a second one. */
  isLoading: boolean;
  /** There are no more pages to load. */
  hasMore: boolean;
  /** The hook/observer is enabled. When false, nothing loads. */
  enabled: boolean;
}

/**
 * The single source of truth for "may we call loadMore right now?".
 *
 * Returns true only when the sentinel is visible, we are not already loading,
 * there is more data to fetch, and the mechanism is enabled. This is the pure
 * function the React layer delegates to, so the guard logic can be tested in
 * isolation without rendering anything.
 */
export function shouldLoadMore(state: InfiniteScrollState): boolean {
  return (
    state.enabled &&
    state.isIntersecting &&
    state.hasMore &&
    !state.isLoading
  );
}

/**
 * Build the `IntersectionObserverInit` options from the public hook options,
 * normalizing the root-margin into a CSS-string the observer understands.
 *
 * `rootMargin` may be supplied either as a ready-made CSS string
 * (e.g. `"200px 0px"`) or as a single number of pixels applied to every edge
 * (e.g. `200` -> `"200px 200px 200px 200px"`).
 */
export function buildObserverInit(opts: {
  root?: Element | Document | null;
  rootMargin?: string | number;
  threshold?: number | number[];
}): IntersectionObserverInit {
  const { root, rootMargin, threshold } = opts;
  return {
    root: root ?? null,
    rootMargin: normalizeRootMargin(rootMargin),
    threshold: threshold ?? 0,
  };
}

/** Normalize a numeric or string root margin into a valid CSS margin string. */
export function normalizeRootMargin(margin?: string | number): string {
  if (margin === undefined) return "0px";
  if (typeof margin === "number") {
    const px = `${margin}px`;
    return `${px} ${px} ${px} ${px}`;
  }
  return margin;
}

/**
 * Pick the most relevant entry from an IntersectionObserver callback batch.
 *
 * The observer may deliver several entries in one callback (e.g. when the
 * target rapidly crosses the boundary). We only ever observe a single
 * sentinel, so the last entry reflects the freshest state.
 */
export function latestEntry(
  entries: IntersectionObserverEntry[],
): IntersectionObserverEntry | undefined {
  return entries.length > 0 ? entries[entries.length - 1] : undefined;
}
