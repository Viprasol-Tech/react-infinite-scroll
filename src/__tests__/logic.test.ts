import { describe, it, expect } from "vitest";
import {
  shouldLoadMore,
  normalizeRootMargin,
  buildObserverInit,
  latestEntry,
  type InfiniteScrollState,
} from "../logic.js";

const base: InfiniteScrollState = {
  isIntersecting: true,
  isLoading: false,
  hasMore: true,
  enabled: true,
};

describe("shouldLoadMore", () => {
  it("returns true when intersecting, enabled, has more, and not loading", () => {
    expect(shouldLoadMore(base)).toBe(true);
  });

  it("returns false when not intersecting", () => {
    expect(shouldLoadMore({ ...base, isIntersecting: false })).toBe(false);
  });

  it("returns false while loading", () => {
    expect(shouldLoadMore({ ...base, isLoading: true })).toBe(false);
  });

  it("returns false when there is nothing more to load", () => {
    expect(shouldLoadMore({ ...base, hasMore: false })).toBe(false);
  });

  it("returns false when disabled", () => {
    expect(shouldLoadMore({ ...base, enabled: false })).toBe(false);
  });
});

describe("normalizeRootMargin", () => {
  it("defaults to 0px", () => {
    expect(normalizeRootMargin()).toBe("0px");
  });

  it("expands a number to all four edges", () => {
    expect(normalizeRootMargin(200)).toBe("200px 200px 200px 200px");
  });

  it("passes a string through unchanged", () => {
    expect(normalizeRootMargin("10px 20px")).toBe("10px 20px");
  });
});

describe("buildObserverInit", () => {
  it("normalizes margin and applies defaults", () => {
    const init = buildObserverInit({ rootMargin: 50 });
    expect(init.root).toBeNull();
    expect(init.rootMargin).toBe("50px 50px 50px 50px");
    expect(init.threshold).toBe(0);
  });

  it("preserves an explicit threshold array", () => {
    const init = buildObserverInit({ threshold: [0, 0.5, 1] });
    expect(init.threshold).toEqual([0, 0.5, 1]);
  });
});

describe("latestEntry", () => {
  it("returns undefined for an empty batch", () => {
    expect(latestEntry([])).toBeUndefined();
  });

  it("returns the last entry of a batch", () => {
    const a = { isIntersecting: false } as IntersectionObserverEntry;
    const b = { isIntersecting: true } as IntersectionObserverEntry;
    expect(latestEntry([a, b])).toBe(b);
  });
});
