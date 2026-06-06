export {
  shouldLoadMore,
  buildObserverInit,
  normalizeRootMargin,
  latestEntry,
  toError,
  captureScroll,
  restoreScrollTopAfterPrepend,
  isAtBottom,
  isAtTop,
  type InfiniteScrollState,
  type ScrollDirection,
  type ScrollSnapshot,
} from "./logic.js";

export {
  useInfiniteScroll,
  type UseInfiniteScrollOptions,
  type UseInfiniteScrollResult,
} from "./useInfiniteScroll.js";

export {
  useScrollRestoration,
  type UseScrollRestorationOptions,
} from "./useScrollRestoration.js";

export {
  InfiniteList,
  type InfiniteListProps,
  type RenderError,
} from "./InfiniteList.js";
