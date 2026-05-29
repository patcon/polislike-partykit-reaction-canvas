# Storybook & Testing

Stories live in `stories/`. `partysocket/react` is aliased to a no-op mock in `.storybook/mocks/partysocket-react.ts` so components render without a live server.

Stories that include a countdown timer use a `render` function (not static `args`) so `Date.now()` is evaluated fresh on each canvas load — otherwise timestamps go stale and the bar never animates.

Components that are socket-driven (`AdminPanel`, `Counter`) will show their loading/initial state in Storybook since no real data arrives.

Tests run via `pnpm vitest`, which runs two projects in parallel: Storybook stories as browser tests in headless Chromium via Playwright (1280×720 viewport), and plain unit tests from `tests/` in Node.

## What the current test setup covers well

`play` functions in stories can test UI state transitions — tab navigation, modal visibility, button enable/disable — using `userEvent.click`, `within`, and `expect` from `storybook/test`. `fn()` creates spies whose `.mock.calls` you can inspect. See `stories/AdminPanelV4.stories.ts` for examples.

## What it does NOT cover well

- **Internal coordinate math** (e.g. whether `TouchLayer` normalises cursor position correctly for image vs. full-canvas mode). These paths involve DOM geometry (`getBoundingClientRect`), async image loading, and exact pixel values — reliable to test only as pure utility functions, not as component interaction tests.
- **Socket-driven state** — `activity`, remote cursors, server-pushed config — never arrives in Storybook because the socket is a no-op mock. Tests that need `activity !== 'canvas'` cannot be written against the current component interfaces.

**Rule of thumb:** if the behavior-under-test requires knowing the viewport size or depends on socket messages, extract it to a pure function and write a plain vitest unit test instead. If it's purely a UI state machine, a `play` function story is the right home.

## Unit tests

Plain unit tests live in `tests/` as `*.test.ts` files and run in Node (no browser). Use these for pure logic: data integrity checks, utility functions, anything that doesn't need React or the DOM. See `tests/panelRegistry.test.ts` for an example.
