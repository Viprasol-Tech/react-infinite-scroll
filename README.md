<div align="center">
  <img src="docs/assets/logo.png" alt="Viprasol Tech" width="120" />

  <h1>react-infinite-scroll</h1>

  <p><strong>Infinite scroll list/loader hook and component for React.</strong></p>

  <p>Built and maintained by Viprasol Tech</p>

  <p>
    <a href="https://github.com/Viprasol-Tech/react-infinite-scroll/actions"><img src="https://github.com/Viprasol-Tech/react-infinite-scroll/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT" /></a>
    <a href="https://www.npmjs.com/package/react-infinite-scroll"><img src="https://img.shields.io/npm/v/react-infinite-scroll.svg" alt="npm" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript" /></a>
  </p>
</div>

---

## Features

- `useInfiniteScroll` hook powered by the native `IntersectionObserver` — no scroll listeners, no throttling math to maintain.
- `<InfiniteList>` component for the common "render items + sentinel + loader" pattern, batteries included.
- Re-entrancy safe: `loadMore` is never called twice concurrently, and never while `hasMore` is false or the hook is disabled.
- Pure, exported decision helper `shouldLoadMore(state)` so the load guard is fully testable.
- Fully typed, generic over your item type, written in strict TypeScript with zero runtime dependencies.

## Install

```bash
npm i react-infinite-scroll
```

`react` and `react-dom` (>=18) are peer dependencies.

## Usage

```tsx
import { useState, useCallback } from "react";
import { InfiniteList } from "react-infinite-scroll";

export function Feed() {
  const [items, setItems] = useState<number[]>([0, 1, 2]);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    const next = await fetchPage(items.length);
    setItems((prev) => [...prev, ...next.items]);
    setHasMore(next.hasMore);
  }, [items.length]);

  return (
    <InfiniteList
      items={items}
      hasMore={hasMore}
      loadMore={loadMore}
      renderItem={(n) => <div className="row">Row #{n}</div>}
      loader={<p>Loading more…</p>}
      endMessage={<p>You have reached the end.</p>}
      rootMargin={200}
    />
  );
}
```

Prefer to wire up your own markup? Use the hook directly:

```tsx
import { useInfiniteScroll } from "react-infinite-scroll";

function List({ items, hasMore, loadMore }: Props) {
  const { sentinelRef, isLoading } = useInfiniteScroll({ loadMore, hasMore });
  return (
    <ul>
      {items.map((it) => (
        <li key={it.id}>{it.label}</li>
      ))}
      {hasMore && <li ref={sentinelRef} aria-hidden />}
      {isLoading && <li>Loading…</li>}
    </ul>
  );
}
```

## API

### `useInfiniteScroll(options)`

| Option       | Type                                  | Default   | Description                                            |
| ------------ | ------------------------------------- | --------- | ------------------------------------------------------ |
| `loadMore`   | `() => void \| Promise<void>`         | —         | Called when the sentinel becomes visible.              |
| `hasMore`    | `boolean`                             | —         | Whether more pages exist. When false, never loads.     |
| `enabled`    | `boolean`                             | `true`    | Disable the observer without unmounting.               |
| `root`       | `Element \| Document \| null`         | `null`    | The scroll root; defaults to the viewport.             |
| `rootMargin` | `string \| number`                    | `"0px"`   | Margin around the root (number = px on every edge).    |
| `threshold`  | `number \| number[]`                  | `0`       | Visibility ratio(s) that trigger a load.               |

Returns `{ sentinelRef, isLoading }`. Attach `sentinelRef` to an element at the end of your list.

### `<InfiniteList>`

Accepts everything above (except `root`) plus: `items`, `renderItem(item, index)`, `getKey(item, index)`, `loader`, `endMessage`, `className`, and `style`.

### `shouldLoadMore(state)`

Pure helper returning `true` only when `enabled && isIntersecting && hasMore && !isLoading`. Exposed for testing and custom integrations.

## A note on jsdom

`IntersectionObserver` is not implemented in jsdom, so when unit-testing components that use this library you should stub it with a controllable mock (see `src/__tests__/InfiniteList.test.tsx` in this repo for a complete example).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Contact — Viprasol Tech Private Limited

- Website: [viprasol.com](https://viprasol.com)
- Email: [support@viprasol.com](mailto:support@viprasol.com)
- Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) | WhatsApp: +91 96336 52112
- GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) | [LinkedIn](https://www.linkedin.com/in/viprasol/) | X [@viprasol](https://twitter.com/viprasol)

## License

[MIT](LICENSE) (c) 2025 Viprasol Tech Private Limited
