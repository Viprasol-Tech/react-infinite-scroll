import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
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
  const utils = render(
    <InfiniteList<number>
      items={overrides.items ?? [1, 2, 3]}
      renderItem={(n) => <span>item-{n}</span>}
      loadMore={loadMore}
      hasMore={overrides.hasMore ?? true}
      enabled={overrides.enabled}
      direction={overrides.direction}
      loader={overrides.loader}
      endMessage={overrides.endMessage}
      renderError={overrides.renderError}
      onError={overrides.onError}
      aria-label={overrides["aria-label"]}
    />,
  );
  return { loadMore, ...utils };
}

describe("<InfiniteList>", () => {
  it("renders all items", () => {
    renderList();
    expect(screen.getByText("item-1")).toBeInTheDocument();
    expect(screen.getByText("item-2")).toBeInTheDocument();
    expect(screen.getByText("item-3")).toBeInTheDocument();
  });

  it("exposes the feed role and aria-label", () => {
    renderList({ "aria-label": "Activity feed" });
    const feed = screen.getByRole("feed");
    expect(feed).toHaveAttribute("aria-label", "Activity feed");
    expect(feed).toHaveAttribute("aria-busy", "false");
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

  it("shows the loader while loading and toggles aria-busy", async () => {
    let resolve!: () => void;
    const loadMore = vi.fn(
      () => new Promise<void>((r) => { resolve = r; }),
    );
    renderList({ loadMore, loader: <span>Loading more</span> });
    const observer = MockIntersectionObserver.current();

    await observer.trigger(true);
    expect(screen.getByTestId("infinite-scroll-loader")).toBeInTheDocument();
    expect(screen.getByRole("feed")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId("infinite-scroll-loader")).not.toBeInTheDocument();
  });

  it("renders the end message when hasMore is false", () => {
    renderList({ hasMore: false, endMessage: <span>The end</span> });
    expect(screen.getByTestId("infinite-scroll-end")).toHaveTextContent("The end");
  });

  describe("error + retry", () => {
    it("surfaces a default error UI when loadMore rejects, and calls onError", async () => {
      const onError = vi.fn();
      const loadMore = vi.fn(() => Promise.reject(new Error("network down")));
      renderList({ loadMore, onError });

      await MockIntersectionObserver.current().trigger(true);

      expect(screen.getByTestId("infinite-scroll-error")).toHaveAttribute(
        "role",
        "alert",
      );
      expect(
        screen.getByTestId("infinite-scroll-error-message"),
      ).toHaveTextContent("network down");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it("removes the sentinel while an error is outstanding", async () => {
      const loadMore = vi.fn(() => Promise.reject("boom"));
      renderList({ loadMore });
      await MockIntersectionObserver.current().trigger(true);
      expect(
        screen.queryByTestId("infinite-scroll-sentinel"),
      ).not.toBeInTheDocument();
    });

    it("retries successfully and clears the error", async () => {
      let attempt = 0;
      const loadMore = vi.fn(() => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error("temporary"))
          : Promise.resolve();
      });
      renderList({ loadMore });

      await MockIntersectionObserver.current().trigger(true);
      expect(screen.getByTestId("infinite-scroll-error")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId("infinite-scroll-retry"));
        await Promise.resolve();
      });

      expect(loadMore).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId("infinite-scroll-error")).not.toBeInTheDocument();
      // Sentinel comes back once the error is cleared.
      expect(screen.getByTestId("infinite-scroll-sentinel")).toBeInTheDocument();
    });

    it("supports a render-prop error UI", async () => {
      const loadMore = vi.fn(() => Promise.reject(new Error("custom")));
      renderList({
        loadMore,
        renderError: (err, retry) => (
          <button onClick={retry}>retry: {err.message}</button>
        ),
      });
      await MockIntersectionObserver.current().trigger(true);
      expect(screen.getByText("retry: custom")).toBeInTheDocument();
    });
  });

  describe("reverse / chat mode", () => {
    it("renders the sentinel before the items when direction is up", () => {
      renderList({ direction: "up", items: [1, 2] });
      const feed = screen.getByRole("feed");
      const sentinel = screen.getByTestId("infinite-scroll-sentinel");
      const firstItem = screen.getByText("item-1");
      // Sentinel should come before the first item in DOM order.
      const position = sentinel.compareDocumentPosition(firstItem);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(feed).toBeInTheDocument();
    });

    it("still loads more when the top sentinel intersects", async () => {
      const { loadMore } = renderList({ direction: "up" });
      await MockIntersectionObserver.current().trigger(true);
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
  });
});
