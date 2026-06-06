import { useCallback, useLayoutEffect, useRef } from "react";
import {
  captureScroll,
  isAtBottom,
  restoreScrollTopAfterPrepend,
  type ScrollSnapshot,
} from "./logic.js";

/** Options for {@link useScrollRestoration}. */
export interface UseScrollRestorationOptions {
  /**
   * A value that changes whenever items are prepended (reverse/chat mode) — most
   * commonly the item count or the first item's id. When it changes the hook
   * restores the user's prior visual position so the viewport does not jump.
   */
  prependKey: unknown;
  /** Enable position restoration on prepend. Defaults to true. */
  enabled?: boolean;
  /**
   * When true, if the user was already pinned to the bottom before the change,
   * the hook keeps them pinned to the bottom afterwards (chat "stick to latest"
   * behaviour). Defaults to false.
   */
  stickToBottom?: boolean;
  /** Pixel tolerance for the bottom-pinned check. Defaults to 8. */
  bottomTolerance?: number;
}

/**
 * Preserve a scroll container's visual position across content changes.
 *
 * Attach the returned `containerRef` to your scrollable element. Before React
 * commits new content the hook snapshots the scroll metrics; in a layout effect
 * (before paint) it restores `scrollTop` so prepended content does not shift the
 * viewport, or — when `stickToBottom` is set and the user was at the bottom —
 * keeps them pinned to the newest content.
 */
export function useScrollRestoration<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollRestorationOptions,
): { containerRef: (node: T | null) => void; capture: () => void } {
  const {
    prependKey,
    enabled = true,
    stickToBottom = false,
    bottomTolerance = 8,
  } = options;

  const elRef = useRef<T | null>(null);
  const snapshotRef = useRef<ScrollSnapshot | null>(null);
  const wasAtBottomRef = useRef(false);
  const lastKeyRef = useRef(prependKey);

  const capture = useCallback(() => {
    const el = elRef.current;
    snapshotRef.current = captureScroll(el);
    wasAtBottomRef.current = isAtBottom(el, bottomTolerance);
  }, [bottomTolerance]);

  const containerRef = useCallback((node: T | null) => {
    elRef.current = node;
  }, []);

  // Snapshot synchronously during render so we have a pre-change baseline even
  // when the consumer does not call `capture` manually.
  if (enabled && prependKey !== lastKeyRef.current && snapshotRef.current === null) {
    snapshotRef.current = captureScroll(elRef.current);
    wasAtBottomRef.current = isAtBottom(elRef.current, bottomTolerance);
  }

  useLayoutEffect(() => {
    if (!enabled) {
      lastKeyRef.current = prependKey;
      return;
    }
    if (prependKey === lastKeyRef.current) return;
    const el = elRef.current;
    const prev = snapshotRef.current;
    lastKeyRef.current = prependKey;
    snapshotRef.current = null;
    if (!el) return;

    if (stickToBottom && wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (prev) {
      el.scrollTop = restoreScrollTopAfterPrepend(prev, el.scrollHeight);
    }
  }, [prependKey, enabled, stickToBottom]);

  return { containerRef, capture };
}
