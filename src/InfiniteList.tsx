import {
  type ReactNode,
  type CSSProperties,
  type Key,
} from "react";
import { useInfiniteScroll } from "./useInfiniteScroll.js";
import { useScrollRestoration } from "./useScrollRestoration.js";
import type { ScrollDirection } from "./logic.js";

/**
 * Render-prop signature for a custom error UI. Receives the captured error and
 * a `retry` callback that clears the error and re-attempts the load.
 */
export type RenderError = (error: Error, retry: () => void) => ReactNode;

/** Props for {@link InfiniteList}. */
export interface InfiniteListProps<T> {
  /** The items to render. */
  items: T[];
  /** Render a single item. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Derive a stable React key for an item. Defaults to the array index. */
  getKey?: (item: T, index: number) => Key;
  /** Called when the sentinel scrolls into view and loading is allowed. */
  loadMore: () => void | Promise<void>;
  /** Whether more pages exist. */
  hasMore: boolean;
  /** Disable loading without unmounting. Defaults to true. */
  enabled?: boolean;
  /**
   * Where new pages are appended. `"down"` (default) places the sentinel at
   * the bottom; `"up"` (chat mode) places it at the top and prepends content.
   */
  direction?: ScrollDirection;
  /**
   * Enable scroll-position restoration so prepending older content (reverse
   * mode) does not jump the viewport. Defaults to `true` when `direction` is
   * `"up"`, otherwise `false`.
   */
  maintainScrollPosition?: boolean;
  /**
   * In reverse mode, keep the viewport pinned to the bottom if the user was
   * already at the bottom when new content arrives. Defaults to false.
   */
  stickToBottom?: boolean;
  /** Margin around the root, as CSS string or px number. Defaults to "200px". */
  rootMargin?: string | number;
  /** Visibility ratio(s) that trigger a load. Defaults to 0. */
  threshold?: number | number[];
  /** Content shown while a `loadMore` call is in flight. */
  loader?: ReactNode;
  /** Content shown once `hasMore` is false. */
  endMessage?: ReactNode;
  /**
   * Error UI. Either static content or a render-prop receiving `(error, retry)`.
   * When omitted, a minimal accessible default with a Retry button is shown.
   */
  renderError?: ReactNode | RenderError;
  /** Called when `loadMore` rejects. Receives the normalized error. */
  onError?: (error: Error) => void;
  /** Accessible label applied to the scroll region. */
  "aria-label"?: string;
  /** Class applied to the outer container. */
  className?: string;
  /** Inline styles applied to the outer container. */
  style?: CSSProperties;
}

function isRenderError(
  value: ReactNode | RenderError | undefined,
): value is RenderError {
  return typeof value === "function";
}

/**
 * A scrollable list that calls `loadMore` as the user nears the end (or top, in
 * chat mode), using an IntersectionObserver sentinel under the hood. The
 * loading guard is handled by {@link useInfiniteScroll}; reverse mode keeps the
 * viewport stable via {@link useScrollRestoration}; failed loads surface an
 * accessible error with a Retry affordance.
 */
export function InfiniteList<T>(props: InfiniteListProps<T>): JSX.Element {
  const {
    items,
    renderItem,
    getKey,
    loadMore,
    hasMore,
    enabled = true,
    direction = "down",
    maintainScrollPosition,
    stickToBottom = false,
    rootMargin = "200px",
    threshold,
    loader,
    endMessage,
    renderError,
    onError,
    className,
    style,
  } = props;

  const reverse = direction === "up";
  const restorationEnabled = maintainScrollPosition ?? reverse;

  const { sentinelRef, isLoading, error, retry } = useInfiniteScroll<HTMLDivElement>({
    loadMore,
    hasMore,
    enabled,
    direction,
    rootMargin,
    threshold,
    onError,
  });

  const { containerRef } = useScrollRestoration<HTMLDivElement>({
    prependKey: items.length,
    enabled: restorationEnabled,
    stickToBottom,
  });

  const sentinel = hasMore && !error && (
    <div
      ref={sentinelRef}
      data-testid="infinite-scroll-sentinel"
      aria-hidden="true"
    />
  );

  const loaderNode = isLoading && loader != null && (
    <div data-testid="infinite-scroll-loader" role="status" aria-live="polite">
      {loader}
    </div>
  );

  const endNode = !hasMore && !error && endMessage != null && (
    <div data-testid="infinite-scroll-end">{endMessage}</div>
  );

  const errorNode = error != null && (
    <div data-testid="infinite-scroll-error" role="alert">
      {isRenderError(renderError) ? (
        renderError(error, retry)
      ) : renderError != null ? (
        renderError
      ) : (
        <span>
          <span data-testid="infinite-scroll-error-message">{error.message}</span>{" "}
          <button
            type="button"
            onClick={retry}
            data-testid="infinite-scroll-retry"
          >
            Retry
          </button>
        </span>
      )}
    </div>
  );

  const list = items.map((item, index) => (
    <div key={getKey ? getKey(item, index) : index}>
      {renderItem(item, index)}
    </div>
  ));

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      data-testid="infinite-list"
      role="feed"
      aria-busy={isLoading}
      aria-label={props["aria-label"]}
    >
      {reverse && (
        <>
          {sentinel}
          {loaderNode}
          {errorNode}
          {endNode}
        </>
      )}

      {list}

      {!reverse && (
        <>
          {sentinel}
          {loaderNode}
          {errorNode}
          {endNode}
        </>
      )}
    </div>
  );
}
