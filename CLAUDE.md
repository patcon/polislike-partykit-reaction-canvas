# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Polislike Reaction Canvas

A real-time collaborative voting canvas built on PartyKit (WebSockets) and React. Participants move their cursor/touch into AGREE/DISAGREE/PASS regions of a canvas; cursor positions are shared live across all connected users.

## Contribution rules

**Always update `CHANGELOG.md`** under `## [Unreleased]` when making any user-facing change (features, fixes, behaviour changes, config changes). Do this in the same commit as the code change.

## Dev commands

```bash
npm run dev          # PartyKit dev server (frontend + server) on port 1999
npm run storybook    # Storybook on localhost:6006
npm run deploy       # Deploy to PartyKit — see rules below
npm run deploy:staging  # Deploy to staging preview environment
npm run cachebust    # Production build with cache-busting
npx vitest           # Run Storybook-based tests via Playwright/Chromium (headless)
```

`npm run dev` runs both the frontend and `party/server.ts` locally on port 1999. The app is accessible at `localhost:1999` or any local network IP on port 1999 (e.g. `10.x.x.x:1999`). The WebSocket host is detected by port — if you're on port 1999, sockets connect to the local server; otherwise they connect to the deployed server.

### Deploy rules

> **Never deploy uncommitted changes.** Always commit `party/server.ts` (and any other changed files) before running `npm run deploy`.

CI deploys automatically on merge to `main`. Deploying from the workstation is also appropriate when you want to test `party/server.ts` changes against the production URL or share with others before merging.

### Cache-busting and `public/index.html`

`public/index.html` is **generated** from `public/index.template.html` by `npm run cachebust`, which stamps `?v=<timestamp>` onto the JS and CSS asset URLs to force browsers to reload after a deploy.

`npm run deploy` runs cachebust automatically before uploading. The committed `public/index.html` serves local dev as-is (stale timestamp is fine locally). Do not run cachebust manually or commit the result — CI handles it.

## Architecture

- **`party/server.ts`** — PartyKit server: manages the statement queue, broadcasts cursor events, stores votes, serves the Polis API proxy
- **`app/client.tsx`** — Entry point: hash-based router (`#v1`–`#v5`) + `IndexApp` landing page
- **`app/components/`** — React components (see below)
- **`app/styles.css`** — All CSS; components use class names defined here
- **`app/types.ts`** — Shared types (`PolisStatement`, `QueueItem`, `Statement`)
- **`app/voteLabels.ts`** — Reaction label presets and custom label encoding/decoding
- **`app/utils/voteRegion.ts`** — Canvas region math: barycentric-coordinate region detection, anchor positioning
- **`app/lib/supabase.ts`** — Supabase client + CRUD helpers for `reaction_events` table (V5 only)
- **`public/`** — Static assets served by PartyKit; `index.template.html` is the HTML shell

## Routing

Hash-based, managed in `App` in `client.tsx`:

| Hash | Component | Notes |
|------|-----------|-------|
| *(none)* | `IndexApp` | Landing page with app cards |
| `#v1` | `SimpleReactionCanvasAppV1` | Statement voting canvas (Polis integration) |
| `#v2` | `ReactionCanvasAppV2` | YouTube embed + realtime reaction canvas |
| `#v3` | *(redirect)* | Redirects to `#v4` |
| `#v4` | `ReactionCanvasAppV4` | Full-page canvas, no video, live recording via JSON download |
| `#v5` | `ReactionCanvasAppV5` | YouTube async + Supabase-backed recording + replay |

URL params are read by each sub-app independently (`?room=`, `?admin=`, `?ghostCursors=`). `?room=` is the canonical way to set the PartyKit room for all versions. In YouTube-style apps (V2/V5), `?room=` also doubles as the YouTube video ID. `?videoId=` is a deprecated alias for `?room=` kept for backward compatibility. Do **not** use `replaceState` to normalise URL params — it breaks the browser back button.

## Components

| Component | Purpose |
|-----------|---------|
| `SimpleReactionCanvasAppV1` | Full V1 app: socket, statement panel, canvas, touch layer, admin mode |
| `ReactionCanvasAppV2` | Full V2 app: YouTube embed + realtime canvas + touch layer, no statements |
| `ReactionCanvasAppV4` | Full V4 app: full-page canvas, mobile-only gate, live JSON recording |
| `ReactionCanvasAppV5` | Full V5 app: YouTube async + Supabase recording + `ReplayCanvas` |
| `Canvas` | D3 SVG layer rendering other users' cursors; `pointerEvents: none` |
| `ReplayCanvas` | D3 SVG layer replaying recorded cursors synced to YouTube timecode (V5) |
| `TouchLayer` | Transparent div capturing mouse/touch; converts position to vote state |
| `StatementPanel` | Displays active Polis statement + countdown bar |
| `CountdownTimer` | Animated progress bar counting down to next queued statement |
| `AdminPanel` | V1 queue management + vote monitoring (admin mode only) |
| `AdminPanelV4` | V4 admin: records live reaction data, downloads as JSON |
| `AdminPanelV5` | V5 admin: manages labels/anchors/participant cap, views/clears Supabase data |
| `Counter` | Legacy PartyKit starter example (not used in main app) |

`Canvas` and `TouchLayer` both accept an optional `heightOffset` prop (pixels to subtract from `window.innerHeight` for dimension math). Default is the statement panel height (~140px). Pass the YouTube player height in V2/V5.

## Vote regions and labels

Cursor position maps to a reaction region (`positive`/`negative`/`neutral`) via barycentric coordinate detection against three configurable anchor points (`ReactionAnchors` in `app/utils/voteRegion.ts`). Default anchors: positive top-right, negative bottom-left, neutral bottom-right.

Label presets are defined in `app/voteLabels.ts`:

| Key | Labels |
|-----|--------|
| `default` | Agree / Disagree / Pass |
| `abu` | A / B / U |
| `atomic` | Attracted / Repelled / Neutral |
| `valence` | Positive / Negative / Neutral |

Custom labels can be passed as a base64-encoded `labels` param using `encodeCustomLabels(positive, negative, neutral)` from `voteLabels.ts`.

## V1 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `admin` | `true` | Renders `AdminPanel` instead of the voting canvas |
| `ghostCursors` | `true`/`false` | Enables/disables 10 simulated ghost cursors |

## V2 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | YouTube video ID | Sets the PartyKit room **and** the YouTube video to embed; shows placeholder if omitted |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `videoId` | YouTube video ID | **Deprecated** alias for `room`; still works for backward compatibility |

## V4 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `admin` | `true` | Renders `AdminPanelV4` for recording reaction data as JSON download |

## V5 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | YouTube video ID | Sets the PartyKit room **and** the YouTube video to embed |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `admin` | `true` | Renders `AdminPanelV5` for managing Supabase-backed reaction data |

## Supabase (V5)

V5 stores reaction events in a Supabase `reaction_events` table. Credentials are injected at **build time** via `partykit.json`'s `define` field:

- `PARTYKIT_SUPABASE_URL`
- `PARTYKIT_SUPABASE_ANON_KEY`

In local dev without these secrets, `app/lib/supabase.ts` catches the `ReferenceError` and all Supabase calls become no-ops. `isSupabaseConfigured` (exported from `supabase.ts`) reflects whether a client was created.

## Storybook

Stories live in `stories/`. `partysocket/react` is aliased to a no-op mock in `.storybook/mocks/partysocket-react.ts` so components render without a live server.

Stories that include a countdown timer use a `render` function (not static `args`) so `Date.now()` is evaluated fresh on each canvas load — otherwise timestamps go stale and the bar never animates.

Components that are socket-driven (`AdminPanel`, `Counter`) will show their loading/initial state in Storybook since no real data arrives.

Tests run via `npx vitest`, which uses `@storybook/addon-vitest` to execute stories as browser tests in headless Chromium via Playwright.
