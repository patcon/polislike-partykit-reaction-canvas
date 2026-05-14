# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: Polislike Reaction Canvas

A real-time collaborative voting canvas built on PartyKit (WebSockets) and React. Participants move their cursor/touch into AGREE/DISAGREE/PASS regions of a canvas; cursor positions are shared live across all connected users.

## Vocabulary — git actions

**"push"** and **"commit"** are equivalent — both mean git commit/push on the current branch. Never interpret either as merging a PR.
**"merge"** means merging a PR, and only when the user says it explicitly.

If the user says "push" or "commit" right after one was already done, treat it as a mistake — do not merge.

## Contribution rules

**Always merge PRs with** `gh pr merge --merge --delete-branch` to delete both the local and remote branch automatically after merging. Only skip `--delete-branch` if explicitly asked to keep the branch.

**Always update `CHANGELOG.md`** when making any user-facing change (features, fixes, behaviour changes, config changes). Do this in the same commit as the code change. Add entries under the current week's section (e.g. `## Week 22 (2026-04-20)`); if it doesn't exist yet, create it at the top. Week 0 starts Mon 2025-11-17; each week is +7 days (the date in the header is the Monday the week starts on). Releases cut every Monday morning ET — start a new week section on each Monday at **7am ET** (not midnight; before 7am Monday still belongs to the previous week's section). Link each entry to the relevant PR, issue, or commit (in that priority order).

## Dev commands

```bash
pnpm run dev          # PartyKit dev server (frontend + server) on port 1999
pnpm run storybook    # Storybook on localhost:6006
pnpm run deploy       # Deploy to PartyKit — see rules below
pnpm run deploy:staging  # Deploy to staging preview environment
pnpm run cachebust    # Production build with cache-busting
pnpm vitest           # Run Storybook-based tests via Playwright/Chromium (headless)
```

`pnpm run dev` runs both the frontend and `party/server.ts` locally on port 1999. The app is accessible at `localhost:1999` or any local network IP on port 1999 (e.g. `10.x.x.x:1999`). The WebSocket host is detected by port — if you're on port 1999, sockets connect to the local server; otherwise they connect to the deployed server.

### UUID generation

**Never use `crypto.randomUUID()` directly.** It only works in secure contexts (HTTPS + `localhost`). HTTP LAN addresses like `192.168.x.x` are not secure contexts — calling it throws silently and breaks any feature that generates IDs at runtime.

Always use `generateUUID()` from `app/utils/userId.ts` instead. It calls `crypto.randomUUID?.()` with a Math.random-based fallback.

### PartyKit CLI notes

Use `--force` (not `--yes`) to skip confirmation prompts — e.g. `npx partykit delete --preview stg --force`. `--yes` is not a valid partykit option and will error.

### Deploy rules

> **Never deploy uncommitted changes.** Always commit `party/server.ts` (and any other changed files) before running `npm run deploy`.

CI deploys automatically on merge to `main`. Deploying from the workstation is also appropriate when you want to test `party/server.ts` changes against the production URL or share with others before merging.

### Cache-busting and `public/index.html`

`public/index.html` is **generated** from `public/index.template.html` by `npm run cachebust`, which stamps `?v=<timestamp>` onto the JS and CSS asset URLs to force browsers to reload after a deploy.

`pnpm run deploy` runs cachebust automatically before uploading. `pnpm run dev` and `pnpm run dev-https` also run cachebust on startup to generate `public/index.html` fresh. `public/index.html` is gitignored — do not commit it.

## Architecture

- **`party/server.ts`** — PartyKit server: manages the statement queue, broadcasts cursor events, stores votes, serves the Polis API proxy
- **`app/client.tsx`** — Entry point: hash-based router (`#v1`–`#v5`) + `IndexApp` landing page
- **`app/components/`** — React components (see `docs/components.md`)
- **`app/styles.css`** — All CSS; components use class names defined here
- **`app/types.ts`** — Shared types (`PolisStatement`, `QueueItem`, `Statement`)
- **`app/voteLabels.ts`** — Reaction label presets and custom label encoding/decoding
- **`app/utils/voteRegion.ts`** — Canvas region math: barycentric-coordinate region detection, anchor positioning
- **`app/lib/supabase.ts`** — Supabase client + CRUD helpers for `reaction_events` table (V5 only; see `docs/supabase.md`)
- **`public/`** — Static assets served by PartyKit; `index.template.html` is the HTML shell; standalone HTML pages (e.g. valence onboarding) live here too

Routing is hash-based (`#v1`–`#v5`). See `docs/routing.md` for the full routing table and all URL params. V4 URL params are reproduced below as they're most actively used.

## V4 URL params

| Param | Values | Effect |
|-------|--------|--------|
| `room` | string | PartyKit room name; defaults to `"default"` |
| `labels` | preset key or base64 custom | Selects a reaction label preset; falls back to localStorage / `default` if omitted |
| `forceView` | `mobile` | Bypasses the mobile-only QR gate; shows the canvas on desktop |
| `interface` | `emcee` | Unlocks the emcee interface chip; shows chip bar and defaults to emcee panel |
| `admin` | `true` | **Deprecated** alias for `?interface=emcee`; still works for backward compatibility |

## Storybook

Stories live in `stories/`. `partysocket/react` is aliased to a no-op mock in `.storybook/mocks/partysocket-react.ts` so components render without a live server. Stories with countdown timers use a `render` function (not static `args`) so `Date.now()` is fresh on each load. See `docs/storybook.md` for full testing guidance.

## Adding a new V4 interface panel

When adding a new interface panel (e.g. `my-panel`), always apply all of these by default unless explicitly told otherwise:

1. **`InterfacesTab.tsx` ROWS entry** — `patchable: true, activityMode: true` unless there's a specific reason not to.
2. **`ActivityMode` union** (`app/types.ts`) — add `'my-panel'` so the Solo radio button works.
3. **`OfferInterfaceModal.tsx`** — add `<option value="my-panel">my-panel</option>` so emcee can push it to participants.
4. **`ReactionCanvasAppV4.tsx`** — three places:
   - URL param unlock: `if (p.get('interface') === 'my-panel') interfaces.push('my-panel')`
   - `KNOWN_CHIPS`: `'my-panel': 'My Panel'`
   - Interface chip render: `} : activeInterface === 'my-panel' ? (<MyPanel ... />) : null}`
   - Canvas activity overlay: `{activeInterface === 'canvas' && activity === 'my-panel' && (<MyPanel ... />)}`
   - Hide canvas when active: extend the `activity !== ...` condition in the `v2-vote-canvas-container` `display` style.
