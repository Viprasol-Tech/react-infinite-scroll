import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { useInfiniteScroll } from "../useInfiniteScroll.js";

/** Minimal controllable IntersectionObserver, shared shape with the list tests. */
class MockIO implements IntersectionObserver {
  static instances: MockIO[] = [];
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly thresholds: ReadonlyArray<number> = [0];
  callback: IntersectionObserverCallback;
  observed = new Set<Element>();
  disconnected = false;

  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIO.instances.push(this);
  }
  observe(t: Element) { this.observed.add(t); }
  unobserve(t: Element) { this.observed.delete(t); }
  disconnect() { this.observed.clear(); this.disconnected = true; }
  takeRecords(): IntersectionObserverEntry[] { return []; }

  async trigger(isIntersecting: boolean) {
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

  static current(): MockIO {
    const live = MockIO.instances.filter((o) => !o.disconnected && o.observed.size > 0);
    const found = live[live.length - 1];
    if (!found) throw new Error("no active observer");
    return found;
  }
}

/** A tiny harness component that renders the hook's observable state. */
function Harness(props: {
  loadMore: () => void | Promise<void>;
  hasMore?: boolean;
  enabled?: boolean;
  direction?: "up" | "down";
  onError?: (e: Error) => void;
}) {
  const { sentinelRef, isLoading, error, retry, reset, direction } =
    useInfiniteScroll<HTMLDivElement>({
      loadMore: props.loadMore,
      hasMore: props.hasMore ?? true,
      enabled: props.enabled,
      direction: props.direction,
      onError: props.onError,
    });
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="error">{error ? error.message : ""}</div>
      <div data-testid="direction">{direction}</div>
      <button data-testid="retry" onClick={retry}>retry</button>
      <button data-testid="reset" onClick={reset}>reset</button>
      {props.hasMore !== false && <div ref={sentinelRef} data-testid="sentinel" />}
    </div>
  );
}

beforeEach(() => {
  MockIO.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIO);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useInfiniteScroll", () => {
  it("defaults direction to down and reflects an explicit direction", () => {
    const { rerender } = render(<Harness loadMore={vi.fn()} />);
    expect(screen.getByTestId("direction")).toHaveTextContent("down");
    rerender(<Harness loadMore={vi.fn()} direction="up" />);
    expect(screen.getByTestId("direction")).toHaveTextContent("up");
  });

  it("sets and clears isLoading around an async loadMore", async () => {
    let resolve!: () => void;
    const loadMore = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<Harness loadMore={loadMore} />);
    await MockIO.current().trigger(true);
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    await act(async () => { resolve(); await Promise.resolve(); });
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("captures an error and pauses auto-loading until retry", async () => {
    let attempt = 0;
    const loadMore = vi.fn(() => {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error("fail-1")) : Promise.resolve();
    });
    render(<Harness loadMore={loadMore} />);
    const io = MockIO.current();

    await io.trigger(true);
    expect(screen.getByTestId("error")).toHaveTextContent("fail-1");

    // While the error stands, further intersections must NOT load.
    await io.trigger(false);
    await io.trigger(true);
    expect(loadMore).toHaveBeenCalledTimes(1);

    // Retry clears the error and re-attempts.
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry"));
      await Promise.resolve();
    });
    expect(loadMore).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  it("reset clears the error without loading again", async () => {
    const loadMore = vi.fn(() => Promise.reject(new Error("boom")));
    render(<Harness loadMore={loadMore} />);
    await MockIO.current().trigger(true);
    expect(screen.getByTestId("error")).toHaveTextContent("boom");

    await act(async () => {
      fireEvent.click(screen.getByTestId("reset"));
      await Promise.resolve();
    });
    expect(screen.getByTestId("error")).toHaveTextContent("");
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("retry is a no-op when there is nothing more to load", async () => {
    const loadMore = vi.fn();
    render(<Harness loadMore={loadMore} hasMore={false} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry"));
      await Promise.resolve();
    });
    expect(loadMore).not.toHaveBeenCalled();
  });

  it("does not create an observer when disabled", () => {
    render(<Harness loadMore={vi.fn()} enabled={false} />);
    expect(MockIO.instances).toHaveLength(0);
  });
});
