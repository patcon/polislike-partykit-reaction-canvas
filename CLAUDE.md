# Project: Polislike Reaction Canvas

A real-time collaborative voting canvas built on PartyKit (WebSockets) and React. Participants move their cursor/touch into AGREE/DISAGREE/PASS regions of a canvas; cursor positions are shared live across all connected users.

## Dev commands

```bash
npm run dev          # PartyKit dev server on localhost:1999
npm run storybook    # Storybook on localhost:6006
npm run deploy       # Deploy to PartyKit
npm run cachebust    # Production build with cache-busting
```

### Cache-busting and `public/index.html`

`public/index.html` is **generated** from `public/index.template.html` by `npm run cachebust`, which stamps `?v=<timestamp>` onto the JS and CSS asset URLs to force browsers to reload after a deploy.

`npm run deploy` runs cachebust automatically before uploading. The committed `public/index.html` serves local dev as-is (stale timestamp is fine locally). Do not run cachebust manually or commit the result — CI handles it.

## Architecture

- **`party/server.ts`** — PartyKit server: manages the statement queue, broadcasts cursor events, stores votes, serves the Polis API proxy
- **`app/client.tsx`** — Entry point: hash-based router (`#v1`, `#v2`) + `IndexApp` landing page
- **`app/components/`** — React components (see below)
- **`app/styles.css`** — All CSS; components use class names defined here
- **`app/types.ts`** — Shared types (`PolisStatement`, `QueueItem`, `Statement`)
- **`public/`** — Static assets served by PartyKit; `index.template.html` is the HTML shell

## Routing

Hash-based, managed in `App` in `client.tsx`:

| Hash | Component | Notes |
|------|-----------|-------|
| *(none)* | `IndexApp` | Landing page with app cards |
| `#v1` | `SimpleReactionCanvasAppV1` | Statement voting canvas |
| `#v2` | `ReactionCanvasAppV2` | YouTube embed + reaction canvas |

URL params are read by each sub-app independently (`?room=`, `?admin=`, `?ghostCursors=`, `?videoId=`). Do **not** use `replaceState` to normalise URL params — it breaks the browser back button.

## Components

| Component | Purpose |
|-----------|---------|
| `SimpleReactionCanvasAppV1` | Full V1 app: socket, statement panel, canvas, touch layer, admin mode |
| `ReactionCanvasAppV2` | Full V2 app: YouTube embed + canvas + touch layer, no statements |
| `Canvas` | D3 SVG layer rendering other users' cursors; `pointerEvents: none` |
| `TouchLayer` | Transparent div capturing mouse/touch; converts position to vote state |
| `StatementPanel` | Displays active Polis statement + countdown bar |
| `CountdownTimer` | Animated progress bar counting down to next queued statement |
| `AdminPanel` | Queue management + vote monitoring (admin mode only) |
| `Counter` | Legacy PartyKit starter example (not used in main app) |

`Canvas` and `TouchLayer` both accept an optional `heightOffset` prop (pixels to subtract from `window.innerHeight` for dimension math). Default is the statement panel height (~140px). Pass the YouTube player height in V2.

## V1 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `admin` | `true` | Renders `AdminPanel` instead of the voting canvas |
| `ghostCursors` | `true`/`false` | Enables/disables 10 simulated ghost cursors |

## V2 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `videoId` | YouTube video ID | Embeds that video; shows placeholder with example link if omitted |

## Storybook

Stories live in `stories/`. `partysocket/react` is aliased to a no-op mock in `.storybook/mocks/partysocket-react.ts` so components render without a live server.

Stories that include a countdown timer use a `render` function (not static `args`) so `Date.now()` is evaluated fresh on each canvas load — otherwise timestamps go stale and the bar never animates.

Components that are socket-driven (`AdminPanel`, `Counter`) will show their loading/initial state in Storybook since no real data arrives.
