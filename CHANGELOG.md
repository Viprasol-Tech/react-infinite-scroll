# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/); versioning
follows [SemVer](https://semver.org/).

## [0.2.0] - 2025

### Added
- **Scroll direction** via `direction: "down" | "up"`. `"up"` is the chat /
  messaging pattern: the sentinel sits at the top and older items are prepended.
- **Error + retry state machine.** `useInfiniteScroll` now captures errors from
  a rejecting `loadMore`, pauses auto-loading while an error is outstanding, and
  exposes `error`, `retry()`, and `reset()`. An `onError` callback is also
  available on both the hook and `<InfiniteList>`.
- **`<InfiniteList>` error UI** with an accessible default (`role="alert"` plus a
  Retry button) and a `renderError` prop accepting static content or a
  `(error, retry) => ReactNode` render prop.
- **Scroll-restoration helper** `useScrollRestoration` plus pure helpers
  `captureScroll`, `restoreScrollTopAfterPrepend`, `isAtBottom`, and `isAtTop`.
  Keeps the viewport stable when content is prepended in reverse mode and can
  optionally "stick to bottom".
- **Reverse mode** in `<InfiniteList>` (`maintainScrollPosition`, `stickToBottom`)
  with the sentinel rendered above the items.
- **Accessibility:** the list container now uses `role="feed"`, toggles
  `aria-busy` while loading, accepts an `aria-label`, and the loader uses
  `role="status"` / `aria-live="polite"`.
- **`toError`** helper to normalize unknown thrown values into real `Error`s.
- Exported new types: `ScrollDirection`, `ScrollSnapshot`, `RenderError`,
  `UseScrollRestorationOptions`.

### Changed
- `shouldLoadMore` now also returns `false` when an error is outstanding
  (`hasError`), so failed loads do not auto-retry on every intersection.

### Tests
- Test count grown from 21 to 56, covering the new pure helpers, the hook's
  error/retry/reset lifecycle, reverse-mode rendering, and scroll restoration.

## [0.1.0] - 2025

### Added
- Initial release of react-infinite-scroll: Infinite scroll list/loader hook and component for React.
