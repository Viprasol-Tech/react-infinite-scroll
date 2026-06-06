import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useRef } from "react";
import { useScrollRestoration } from "../useScrollRestoration.js";

afterEach(cleanup);

/**
 * jsdom does not lay elements out, so scrollHeight/clientHeight are 0 and the
 * container's geometry must be stubbed. The harness exposes the hook's
 * `capture` so a test can snapshot the pre-prepend position (exactly as a real
 * consumer would, just before fetching older content), then grow the container
 * and bump the key to simulate the prepend.
 */
function Harness(props: {
  count: number;
  stickToBottom?: boolean;
  enabled?: boolean;
  apiBox: { current: { capture: () => void } | null };
  elBox: { current: HTMLDivElement | null };
}) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const { containerRef, capture } = useScrollRestoration<HTMLDivElement>({
    prependKey: props.count,
    stickToBottom: props.stickToBottom,
    enabled: props.enabled,
  });
  props.apiBox.current = { capture };
  return (
    <div
      ref={(node) => {
        localRef.current = node;
        props.elBox.current = node;
        containerRef(node);
      }}
      data-testid="container"
    />
  );
}

function stubMetrics(
  el: HTMLDivElement,
  m: { scrollTop: number; scrollHeight: number; clientHeight: number },
) {
  let scrollTop = m.scrollTop;
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => { scrollTop = v; },
  });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => m.scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => m.clientHeight,
  });
}

function growScrollHeight(el: HTMLDivElement, value: number) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => value,
  });
}

describe("useScrollRestoration", () => {
  it("offsets scrollTop by the content growth on prepend", () => {
    const elBox: { current: HTMLDivElement | null } = { current: null };
    const apiBox: { current: { capture: () => void } | null } = { current: null };
    const metrics = { scrollTop: 50, scrollHeight: 1000, clientHeight: 300 };
    const { rerender } = render(
      <Harness count={10} apiBox={apiBox} elBox={elBox} />,
    );
    const el = elBox.current!;
    stubMetrics(el, metrics);

    // Snapshot the position before older content is prepended.
    act(() => { apiBox.current!.capture(); });

    // Now the content grows (older items prepended) and the key changes.
    act(() => {
      growScrollHeight(el, 1300);
      rerender(<Harness count={20} apiBox={apiBox} elBox={elBox} />);
    });

    // delta = 1300 - 1000 = 300, so scrollTop = 50 + 300 = 350.
    expect(el.scrollTop).toBe(350);
  });

  it("pins to the bottom when stickToBottom and user was at the bottom", () => {
    const elBox: { current: HTMLDivElement | null } = { current: null };
    const apiBox: { current: { capture: () => void } | null } = { current: null };
    // At bottom: scrollHeight - scrollTop - clientHeight = 0.
    const metrics = { scrollTop: 700, scrollHeight: 1000, clientHeight: 300 };
    const { rerender } = render(
      <Harness count={5} stickToBottom apiBox={apiBox} elBox={elBox} />,
    );
    const el = elBox.current!;
    stubMetrics(el, metrics);

    act(() => { apiBox.current!.capture(); });

    act(() => {
      growScrollHeight(el, 1400);
      rerender(<Harness count={6} stickToBottom apiBox={apiBox} elBox={elBox} />);
    });

    expect(el.scrollTop).toBe(1400);
  });

  it("does nothing when disabled", () => {
    const elBox: { current: HTMLDivElement | null } = { current: null };
    const apiBox: { current: { capture: () => void } | null } = { current: null };
    const metrics = { scrollTop: 50, scrollHeight: 1000, clientHeight: 300 };
    const { rerender } = render(
      <Harness count={1} enabled={false} apiBox={apiBox} elBox={elBox} />,
    );
    const el = elBox.current!;
    stubMetrics(el, metrics);

    act(() => { apiBox.current!.capture(); });

    act(() => {
      growScrollHeight(el, 1300);
      rerender(<Harness count={2} enabled={false} apiBox={apiBox} elBox={elBox} />);
    });

    expect(el.scrollTop).toBe(50);
  });
});
