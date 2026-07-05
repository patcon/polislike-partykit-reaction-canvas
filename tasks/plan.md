# Implementation Plan: Migrate Prototype HTML Pages to GitHub Pages

## Overview

Four standalone HTML pages (`valence-onboarding-v1/v2/v3.html`, `mood-sounds.html`) currently live in `public/` but are broken in production because `partykit.json`'s `singlePageApp: true` intercepts all requests before static files can be served. The fix is to move them to `docs/pages/`, deploy via GitHub Actions to GitHub Pages (`https://patcon.github.io/polislike-partykit-reaction-canvas/`), and update all references in the main React app. Three of the four pages have WebSocket connections hardcoded to `window.location`, which will be wrong on GitHub Pages — those get a new "server" text input defaulting to the production PartyKit URL.

## Architecture Decisions

- **`docs/pages/` as the GH Pages root** — `docs/` already contains markdown docs; `docs/pages/` isolates the deployable HTML from the markdown docs so the GitHub Actions workflow can point `path: docs/pages/` without uploading `.md` files.
- **Server input per-page (not a shared util)** — pages are self-contained single-file HTML; no shared JS layer exists. Duplicating the `buildWsUrl` helper across v2, v3, and mood-sounds is the correct tradeoff.
- **New tab links in React** — links from the main app to GitHub Pages cross origins; `target="_blank" rel="noopener noreferrer"` is required for security.
- **Delete from `public/` last** — only after all pages are confirmed moved and correct in `docs/pages/`, to avoid a window where pages are missing from both locations.

## Dependency Graph

```
docs/pages/ folder created (Task 1)
    │
    ├── v1 moved as-is (Task 1)
    ├── v2 moved + server input (Task 2)  ← independent of Task 3, 4
    ├── v3 moved + server input (Task 3)  ← independent of Task 2, 4
    └── mood-sounds moved + server input (Task 4)  ← independent of Task 2, 3
            │
            └── CHECKPOINT A: all 4 pages in docs/pages/
                    │
                    ├── GH Actions workflow (Task 5)  ← independent of Task 6
                    ├── React link updates (Task 6)   ← independent of Task 5
                    └── Remove from public/ + CHANGELOG (Task 7)
                                │
                                └── CHECKPOINT B: migration complete
```

Tasks 2, 3, 4 are independent of each other. Tasks 5 and 6 are independent of each other. Task 7 depends on 1–4.

---

## Phase 1: Move HTML pages to docs/pages/

### Task 1: Create docs/pages/ and move valence-onboarding-v1.html

**Description:** Create the `docs/pages/` directory, move `valence-onboarding-v1.html` there unchanged (it has no WebSocket code), and create a minimal `docs/pages/index.html` listing all four prototype pages with a dark monospace aesthetic matching the prototypes.

**Acceptance criteria:**
- [ ] `docs/pages/valence-onboarding-v1.html` exists and is byte-for-byte identical to the current `public/valence-onboarding-v1.html`
- [ ] `docs/pages/index.html` exists with links to all four prototype filenames
- [ ] `docs/pages/index.html` uses a dark background with monospace font, consistent with the prototype aesthetic

**Verification:**
- [ ] `ls docs/pages/` shows `index.html` and `valence-onboarding-v1.html`
- [ ] `diff public/valence-onboarding-v1.html docs/pages/valence-onboarding-v1.html` exits 0 (or v1 not yet deleted from public)
- [ ] Open `docs/pages/index.html` in a browser — four links render correctly, page is dark/monospace

**Dependencies:** None

**Files touched:**
- `docs/pages/valence-onboarding-v1.html` (new, copy of public/)
- `docs/pages/index.html` (new)

**Estimated scope:** S

---

### Task 2: Move valence-onboarding-v2.html + add server input

**Description:** Copy `public/valence-onboarding-v2.html` to `docs/pages/`, add a "server" text input row above the existing "room" row, replace the `connectWs` host-derivation logic with a `buildWsUrl` function that reads the new input, and wire the reconnect call to pass through `buildWsUrl`.

**Current code to replace** (`connectWs`, ~line 639–646):
```js
function connectWs(room){
  ...
  const host=window.location.port==='1999'?`${window.location.hostname}:1999`:window.location.host;
  const proto=window.location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(`${proto}://${host}/parties/main/...`);
```

**Acceptance criteria:**
- [ ] `docs/pages/valence-onboarding-v2.html` exists with the server input row in the HTML
- [ ] `id="server-input"` element present with default value `wss://whispering-gallery.patcon.partykit.dev`
- [ ] `buildWsUrl(room)` function exists, reads from `#server-input`, handles `wss://`, `ws://`, and bare hostnames
- [ ] `connectWs` no longer references `window.location` for host/proto derivation
- [ ] Old `window.location.protocol/hostname/port/host` usage for WS construction is fully replaced

**Verification:**
- [ ] `grep "window.location.host\|window.location.hostname\|window.location.port\|window.location.protocol" docs/pages/valence-onboarding-v2.html` returns no WS-related lines
- [ ] `grep "server-input" docs/pages/valence-onboarding-v2.html` returns the input element
- [ ] Load in browser, change server input to a custom URL, confirm WS URL changes in DevTools Network tab

**Dependencies:** Task 1 (docs/pages/ exists)

**Files touched:**
- `docs/pages/valence-onboarding-v2.html` (new, modified copy of public/)

**Estimated scope:** S

---

### Task 3: Move valence-onboarding-v3.html + add server input

**Description:** Copy `public/valence-onboarding-v3.html` to `docs/pages/`, add server input, replace `connectWs` host-derivation with `buildWsUrl`. The structure is similar to v2 but the room input sits inside a nested group (`#conn-row` is at ~line 159 inside a nested div block).

**Current code** (`connectWs`, ~line 754–763):
```js
function connectWs(room){
  const {hostname,port}=window.location;
  const host=port==='1999'?`${hostname}:1999`:window.location.host;
  const proto=window.location.protocol==='https:'?'wss':'ws';
  ws=new WebSocket(`${proto}://${host}/parties/main/...`);
```

**Acceptance criteria:**
- [ ] `docs/pages/valence-onboarding-v3.html` exists with the server input row
- [ ] `id="server-input"` present, default `wss://whispering-gallery.patcon.partykit.dev`
- [ ] `buildWsUrl(room)` reads from `#server-input`
- [ ] `connectWs` no longer destructures `window.location` for WS construction
- [ ] The `qrUrl` helper (~line 808) that uses `window.location` for the *app URL* (not WS) is **not modified** — it's generating a link back to the main app, not a WebSocket URL

**Verification:**
- [ ] `grep "window.location" docs/pages/valence-onboarding-v3.html | grep -v qrUrl` — any remaining `window.location` hits are only in `qrUrl` or unrelated non-WS context
- [ ] `grep "server-input" docs/pages/valence-onboarding-v3.html` returns the input element

**Dependencies:** Task 1

**Files touched:**
- `docs/pages/valence-onboarding-v3.html` (new, modified copy of public/)

**Estimated scope:** S

---

### Task 4: Move mood-sounds.html + add server input

**Description:** Copy `public/mood-sounds.html` to `docs/pages/`, add server input row near the existing `<label for="room-input">`, replace `wsUrl(room)` function's host-derivation logic with one that reads `#server-input`. The HTML structure is different — the room input uses a `<label>` + `<input>` pattern (not a `.row/.label` span pattern), so the server input should match that style.

**Current code** (`wsUrl`, ~line 1031–1035):
```js
function wsUrl(room) {
  const host = window.location.hostname === 'localhost'
    ? 'localhost:1999'
    : window.location.host;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
```

**Acceptance criteria:**
- [ ] `docs/pages/mood-sounds.html` exists with the server input
- [ ] `id="server-input"` present, default `wss://whispering-gallery.patcon.partykit.dev`
- [ ] `wsUrl(room)` reads from `#server-input` instead of `window.location`
- [ ] The server input is styled consistently with the page's `<label>/<input>` convention

**Verification:**
- [ ] `grep "window.location.host\|window.location.hostname\|window.location.protocol" docs/pages/mood-sounds.html` returns no WS-related lines
- [ ] `grep "server-input" docs/pages/mood-sounds.html` returns the input element

**Dependencies:** Task 1

**Files touched:**
- `docs/pages/mood-sounds.html` (new, modified copy of public/)

**Estimated scope:** S

---

## Checkpoint A: All pages in docs/pages/

- [ ] `ls docs/pages/` shows all 5 files: `index.html`, `valence-onboarding-v1.html`, `valence-onboarding-v2.html`, `valence-onboarding-v3.html`, `mood-sounds.html`
- [ ] No `window.location`-based WS construction remains in any of the four pages
- [ ] Open each page locally in a browser — no JS errors on load

---

## Phase 2: Wiring (parallel tasks)

### Task 5: Create GitHub Actions pages deployment workflow

**Description:** Create `.github/workflows/pages.yml` exactly as specified in the spec. Triggers on push to `main` when `docs/pages/**` changes, or manually via `workflow_dispatch`. Uses the official GitHub Actions for Pages (`configure-pages`, `upload-pages-artifact`, `deploy-pages`).

**Acceptance criteria:**
- [ ] `.github/workflows/pages.yml` exists with the correct content
- [ ] `permissions.pages: write` and `permissions.id-token: write` are set
- [ ] `path: docs/pages/` is the artifact path
- [ ] `concurrency.group: pages` with `cancel-in-progress: false`

**Verification:**
- [ ] `cat .github/workflows/pages.yml` matches the spec exactly
- [ ] `gh workflow list` shows "Deploy prototype pages to GitHub Pages"

**Dependencies:** None (can be done in parallel with Task 6)

**Files touched:**
- `.github/workflows/pages.yml` (new)

**Estimated scope:** XS

---

### Task 6: Update React component links to GitHub Pages URLs

**Description:** Update hardcoded relative `/xxx.html` links in `OldFrontPage.tsx` and `NewFrontPage.tsx` to the full GitHub Pages URLs. Add `target="_blank" rel="noopener noreferrer"` to all four links in `OldFrontPage.tsx` (they are `<a>` tags). In `NewFrontPage.tsx`, the hrefs are in a data array — update the two href values there.

**Mapping:**
- `/mood-sounds.html` → `https://patcon.github.io/polislike-partykit-reaction-canvas/mood-sounds.html`
- `/valence-onboarding-v1.html` → `https://patcon.github.io/polislike-partykit-reaction-canvas/valence-onboarding-v1.html`
- `/valence-onboarding-v2.html` → `https://patcon.github.io/polislike-partykit-reaction-canvas/valence-onboarding-v2.html`
- `/valence-onboarding-v3.html` → `https://patcon.github.io/polislike-partykit-reaction-canvas/valence-onboarding-v3.html`

**Acceptance criteria:**
- [ ] `OldFrontPage.tsx`: all 4 links use the full GitHub Pages URL
- [ ] `OldFrontPage.tsx`: all 4 links have `target="_blank" rel="noopener noreferrer"`
- [ ] `NewFrontPage.tsx`: both href values in the PROTOTYPES array use the full GitHub Pages URL

**Verification:**
- [ ] `grep "/valence-onboarding\|/mood-sounds" app/components/OldFrontPage.tsx app/components/NewFrontPage.tsx` returns no relative-path hits
- [ ] `pnpm vitest` passes (no TypeScript errors)
- [ ] Load the main app in dev — clicking a prototype link opens the GitHub Pages URL in a new tab

**Dependencies:** None (can be done in parallel with Task 5)

**Files touched:**
- `app/components/OldFrontPage.tsx`
- `app/components/NewFrontPage.tsx`

**Estimated scope:** S

---

### Task 7: Remove files from public/, update CHANGELOG

**Description:** Delete the four `.html` files from `public/`. Add the Week 33 CHANGELOG entry exactly as specified in the spec.

**Acceptance criteria:**
- [ ] `public/valence-onboarding-v1.html`, `v2.html`, `v3.html`, `mood-sounds.html` are deleted
- [ ] `public/index.html` and `public/index.template.html` are untouched
- [ ] `CHANGELOG.md` has a `## Week 33 (2026-07-06)` section at the top with the specified entry

**Verification:**
- [ ] `ls public/*.html` returns only `index.html` and `index.template.html`
- [ ] `head -20 CHANGELOG.md` shows the Week 33 section
- [ ] `pnpm vitest` still passes

**Dependencies:** Tasks 1–4 (pages confirmed moved)

**Files touched:**
- `public/valence-onboarding-v1.html` (deleted)
- `public/valence-onboarding-v2.html` (deleted)
- `public/valence-onboarding-v3.html` (deleted)
- `public/mood-sounds.html` (deleted)
- `CHANGELOG.md`

**Estimated scope:** S

---

## Checkpoint B: Migration Complete

- [ ] `ls public/*.html` shows only `index.html` and `index.template.html`
- [ ] `ls docs/pages/` shows all 5 files
- [ ] `grep -r "/valence-onboarding\|/mood-sounds" app/` returns no relative-path hits
- [ ] `pnpm vitest` passes
- [ ] `CHANGELOG.md` Week 33 entry present
- [ ] Ready for PR and human review

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| v3's `qrUrl` helper also reads `window.location` — easy to accidentally break it | Med | Task 3 explicitly calls out NOT to modify `qrUrl`; verify step checks for non-WS `window.location` uses |
| mood-sounds uses `<label>/<input>` not `.row/.label` pattern | Low | Task 4 notes to match the page's own convention, not copy v2/v3 HTML verbatim |
| GH Pages might not be wired to the `github-pages` environment yet | Med | Spec says Pages is already configured as `workflow` type — verify with `gh api repos/patcon/polislike-partykit-reaction-canvas/pages` before expecting the deploy to succeed |
| Deleting from `public/` before verifying GH Pages deploy | High | Task 7 is Phase 2 (after files confirmed in `docs/pages/`); first deploy validates the pages are accessible before cutting over |

## Open Questions

- None — spec is fully specified. The only external dependency is that GitHub Pages is already configured as `workflow` type on the repo, which the spec confirms.
