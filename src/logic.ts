/**
 * Pure, framework-agnostic logic for the infinite-scroll machinery.
 *
 * Keeping the decision logic free of React makes it trivial to unit test the
 * exact conditions under which a `loadMore` call is (or is not) allowed.
 */

/**
 * The direction in which new pages are appended.
 *
 * - `"down"` is the classic feed: the sentinel sits at the bottom and new
 *   items are appended, scrolling away from the top.
 * - `"up"` is the chat/messaging pattern: the sentinel sits at the top and
 *   older items are prepended above the current view.
 */
export type ScrollDirection = "down" | "up";

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
  /**
   * The previous `loadMore` attempt failed and has not been cleared/retried.
   * While an error is outstanding we do not auto-load on intersection; the
   * consumer must explicitly call `retry`. Defaults to `false` when omitted.
   */
  hasError?: boolean;
}

/**
 * The single source of truth for "may we call loadMore right now?".
 *
 * Returns true only when the sentinel is visible, we are not already loading,
 * there is more data to fetch, the mechanism is enabled, and there is no
 * outstanding error awaiting a retry. This is the pure function the React
 * layer delegates to, so the guard logic can be tested in isolation without
 * rendering anything.
 */
export function shouldLoadMore(state: InfiniteScrollState): boolean {
  return (
    state.enabled &&
    state.isIntersecting &&
    state.hasMore &&
    !state.isLoading &&
    !state.hasError
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

/**
 * Coerce an unknown thrown value into a real `Error`.
 *
 * `loadMore` may reject with anything (a string, an object, `undefined`). We
 * normalize it so consumers always receive a proper `Error` with a message.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/** A snapshot of a scroll position, suitable for restoration after re-render. */
export interface ScrollSnapshot {
  /** The container's `scrollTop` at capture time. */
  scrollTop: number;
  /** The container's `scrollHeight` at capture time. */
  scrollHeight: number;
}

/**
 * Capture a scroll snapshot from a container element.
 *
 * Returns `null` when no element is supplied so callers can no-op safely in
 * SSR / unmounted scenarios.
 */
export function captureScroll(el: Element | null | undefined): ScrollSnapshot | null {
  if (!el) return null;
  return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
}

/**
 * Compute the `scrollTop` that preserves the user's visual position after
 * content has been **prepended** (reverse / chat mode).
 *
 * When older messages are added above the viewport the container grows; to
 * keep the same messages under the user's eyes we offset `scrollTop` by the
 * amount the content grew (`newScrollHeight - previous.scrollHeight`).
 */
export function restoreScrollTopAfterPrepend(
  previous: ScrollSnapshot,
  newScrollHeight: number,
): number {
  const delta = newScrollHeight - previous.scrollHeight;
  return previous.scrollTop + Math.max(0, delta);
}

/**
 * Whether a container is scrolled to (within `tolerance` px of) its bottom.
 *
 * Useful in chat UIs to decide whether to auto-stick to the newest message
 * after new content arrives.
 */
export function isAtBottom(
  el: Element | null | undefined,
  tolerance = 1,
): boolean {
  if (!el) return false;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;
}

/**
 * Whether a container is scrolled to (within `tolerance` px of) its top.
 *
 * The "load older messages" trigger in reverse mode.
 */
export function isAtTop(el: Element | null | undefined, tolerance = 1): boolean {
  if (!el) return false;
  return el.scrollTop <= tolerance;
}
