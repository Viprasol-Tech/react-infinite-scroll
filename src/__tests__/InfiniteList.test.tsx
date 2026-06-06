import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { InfiniteList } from "../InfiniteList.js";

/**
 * A controllable IntersectionObserver mock. jsdom does not implement
 * IntersectionObserver, so we install our own and expose a `trigger` helper
 * that drives intersection events against the observed sentinel.
 */
class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "0px";
  readonly thresholds: ReadonlyArray<number> = [0];

  callback: IntersectionObserverCallback;
  observed = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /**
   * Fire an intersection event for every observed target, flushing any
   * microtasks (e.g. a resolved `loadMore` promise) so the in-flight loading
   * state settles before the test continues.
   */
  async trigger(isIntersecting: boolean): Promise<void> {
    const entries = [...this.observed].map(
      (target) =>
        ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          time: 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
        }) as IntersectionObserverEntry,
    );
    await act(async () => {
      this.callback(entries, this);
      await Promise.resolve();
    });
  }

  /** The most-recently-created live (not disconnected) observer. */
  static current(): MockIntersectionObserver {
    const live = MockIntersectionObserver.instances.filter(
      (o) => !o.disconnected && o.observed.size > 0,
    );
    const found = live[live.length - 1];
    if (!found) throw new Error("no active IntersectionObserver");
    return found;
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderList(overrides: Partial<Parameters<typeof InfiniteList<number>>[0]> = {}) {
  const loadMore = overrides.loadMore ?? vi.fn();
  render(
    <InfiniteList<number>
      items={overrides.items ?? [1, 2, 3]}
      renderItem={(n) => <span>item-{n}</span>}
      loadMore={loadMore}
      hasMore={overrides.hasMore ?? true}
      enabled={overrides.enabled}
    />,
  );
  return { loadMore };
}

describe("<InfiniteList>", () => {
  it("renders all items", () => {
    renderList();
    expect(screen.getByText("item-1")).toBeInTheDocument();
    expect(screen.getByText("item-2")).toBeInTheDocument();
    expect(screen.getByText("item-3")).toBeInTheDocument();
  });

  it("calls loadMore once per intersection", async () => {
    const { loadMore } = renderList();
    const observer = MockIntersectionObserver.current();

    await observer.trigger(true);
    expect(loadMore).toHaveBeenCalledTimes(1);

    // Leaving and re-entering the viewport triggers another load.
    await observer.trigger(false);
    await observer.trigger(true);
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it("does not call loadMore when the sentinel is not intersecting", async () => {
    const { loadMore } = renderList();
    await MockIntersectionObserver.current().trigger(false);
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("does not call loadMore again while a load is in flight", async () => {
    let resolve!: () => void;
    const loadMore = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    renderList({ loadMore });
    const observer = MockIntersectionObserver.current();

    await observer.trigger(true); // starts loading (promise pending)
    await observer.trigger(true); // should be ignored while loading
    expect(loadMore).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve();
      await Promise.resolve();
    });
  });

  it("renders no sentinel and never loads when hasMore is false", () => {
    const { loadMore } = renderList({ hasMore: false });
    expect(
      screen.queryByTestId("infinite-scroll-sentinel"),
    ).not.toBeInTheDocument();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("does not load while disabled", () => {
    const { loadMore } = renderList({ enabled: false });
    // Disabled: the observer is never created, so nothing to trigger.
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(loadMore).not.toHaveBeenCalled();
  });
});
