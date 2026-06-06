import {
  type ReactNode,
  type CSSProperties,
  type Key,
} from "react";
import { useInfiniteScroll } from "./useInfiniteScroll.js";

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
  /** Margin around the root, as CSS string or px number. Defaults to "200px". */
  rootMargin?: string | number;
  /** Visibility ratio(s) that trigger a load. Defaults to 0. */
  threshold?: number | number[];
  /** Content shown while a `loadMore` call is in flight. */
  loader?: ReactNode;
  /** Content shown once `hasMore` is false. */
  endMessage?: ReactNode;
  /** Class applied to the outer container. */
  className?: string;
  /** Inline styles applied to the outer container. */
  style?: CSSProperties;
}

/**
 * A scrollable list that calls `loadMore` as the user nears the end, using an
 * IntersectionObserver sentinel under the hood. The loading guard is handled
 * by {@link useInfiniteScroll}, which in turn delegates to the pure
 * `shouldLoadMore` decision function.
 */
export function InfiniteList<T>(props: InfiniteListProps<T>): JSX.Element {
  const {
    items,
    renderItem,
    getKey,
    loadMore,
    hasMore,
    enabled = true,
    rootMargin = "200px",
    threshold,
    loader,
    endMessage,
    className,
    style,
  } = props;

  const { sentinelRef, isLoading } = useInfiniteScroll<HTMLDivElement>({
    loadMore,
    hasMore,
    enabled,
    rootMargin,
    threshold,
  });

  return (
    <div className={className} style={style} data-testid="infinite-list">
      {items.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index}>
          {renderItem(item, index)}
        </div>
      ))}

      {hasMore && (
        <div ref={sentinelRef} data-testid="infinite-scroll-sentinel" aria-hidden="true" />
      )}

      {isLoading && loader != null && (
        <div data-testid="infinite-scroll-loader">{loader}</div>
      )}

      {!hasMore && endMessage != null && (
        <div data-testid="infinite-scroll-end">{endMessage}</div>
      )}
    </div>
  );
}
