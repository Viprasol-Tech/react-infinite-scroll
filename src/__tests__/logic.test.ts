import { describe, it, expect } from "vitest";
import {
  shouldLoadMore,
  normalizeRootMargin,
  buildObserverInit,
  latestEntry,
  toError,
  captureScroll,
  restoreScrollTopAfterPrepend,
  isAtBottom,
  isAtTop,
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

  it("returns false when an error is outstanding", () => {
    expect(shouldLoadMore({ ...base, hasError: true })).toBe(false);
  });

  it("treats an omitted hasError as no error (still loads)", () => {
    const { ...noErrorField } = base;
    expect(shouldLoadMore(noErrorField)).toBe(true);
  });
});

describe("normalizeRootMargin", () => {
  it("defaults to 0px", () => {
    expect(normalizeRootMargin()).toBe("0px");
  });

  it("expands a number to all four edges", () => {
    expect(normalizeRootMargin(200)).toBe("200px 200px 200px 200px");
  });

  it("expands zero correctly", () => {
    expect(normalizeRootMargin(0)).toBe("0px 0px 0px 0px");
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

  it("passes a provided root through", () => {
    const root = {} as Element;
    const init = buildObserverInit({ root });
    expect(init.root).toBe(root);
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

describe("toError", () => {
  it("returns Error instances unchanged", () => {
    const e = new Error("boom");
    expect(toError(e)).toBe(e);
  });

  it("wraps a string", () => {
    const e = toError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("nope");
  });

  it("serializes a plain object", () => {
    const e = toError({ code: 500 });
    expect(e.message).toBe('{"code":500}');
  });

  it("stringifies a value JSON cannot serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const e = toError(circular);
    expect(e).toBeInstanceOf(Error);
    expect(typeof e.message).toBe("string");
  });
});

function fakeEl(partial: Partial<{
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}>): Element {
  return {
    scrollTop: partial.scrollTop ?? 0,
    scrollHeight: partial.scrollHeight ?? 0,
    clientHeight: partial.clientHeight ?? 0,
  } as Element;
}

describe("captureScroll", () => {
  it("returns null without an element", () => {
    expect(captureScroll(null)).toBeNull();
    expect(captureScroll(undefined)).toBeNull();
  });

  it("captures scrollTop and scrollHeight", () => {
    const snap = captureScroll(fakeEl({ scrollTop: 120, scrollHeight: 900 }));
    expect(snap).toEqual({ scrollTop: 120, scrollHeight: 900 });
  });
});

describe("restoreScrollTopAfterPrepend", () => {
  it("offsets scrollTop by the growth in content", () => {
    const prev = { scrollTop: 100, scrollHeight: 1000 };
    expect(restoreScrollTopAfterPrepend(prev, 1300)).toBe(400);
  });

  it("never applies a negative delta", () => {
    const prev = { scrollTop: 100, scrollHeight: 1000 };
    expect(restoreScrollTopAfterPrepend(prev, 800)).toBe(100);
  });
});

describe("isAtBottom", () => {
  it("is true within tolerance of the bottom", () => {
    expect(
      isAtBottom(fakeEl({ scrollTop: 800, scrollHeight: 1000, clientHeight: 200 })),
    ).toBe(true);
  });

  it("is false when scrolled up", () => {
    expect(
      isAtBottom(fakeEl({ scrollTop: 100, scrollHeight: 1000, clientHeight: 200 })),
    ).toBe(false);
  });

  it("respects an explicit tolerance", () => {
    expect(
      isAtBottom(
        fakeEl({ scrollTop: 790, scrollHeight: 1000, clientHeight: 200 }),
        20,
      ),
    ).toBe(true);
  });

  it("is false without an element", () => {
    expect(isAtBottom(null)).toBe(false);
  });
});

describe("isAtTop", () => {
  it("is true at the top", () => {
    expect(isAtTop(fakeEl({ scrollTop: 0 }))).toBe(true);
  });

  it("is true within tolerance", () => {
    expect(isAtTop(fakeEl({ scrollTop: 5 }), 10)).toBe(true);
  });

  it("is false when scrolled down", () => {
    expect(isAtTop(fakeEl({ scrollTop: 50 }))).toBe(false);
  });

  it("is false without an element", () => {
    expect(isAtTop(undefined)).toBe(false);
  });
});
