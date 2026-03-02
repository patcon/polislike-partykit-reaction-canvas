# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] (2026-03-01)

### Added
- V4: help modal (press `?`) with a label-set picker that updates a reload link; no state changes until the link is clicked
- All canvases: `?labels=none` hides all reaction labels
- V3: admin page (`?admin=true#v3`): record cursor positions or vote-region transitions in-browser; download as JSON; broadcasting recording status shows a REC badge to all participants

### Changed
- All canvases: reaction label strings stored in title-case; displayed uppercase via CSS (`text-transform: uppercase`)
- V4 help modal: label picker shows title-case values only (no machine key); includes "None" option
- V2 & V3: `?mobile=true` replaced by `?forceView=mobile`
- V3: new full-page reaction canvas variant (no video, no statements); supports `?room=`, `?labels=`, presence counter, blue-dot cursor, and mobile-only QR gate with `?forceView=mobile` override
- V2: `?labels=` query param selects a reaction label preset (`default`, `yesno`, `supportive`, `abu`); falls back to localStorage / default if omitted or unrecognised
- `abu` label set: agree=A, disagree=B, pass=U

### Fixed
- Mobile taps no longer leave the cursor stuck as a persistent touch; the root cause was the browser's synthesized `mousemove` (fired ~300ms after every tap) landing in `handleMouseMove` and starting the heartbeat with no corresponding `mouseleave` to clean up — now suppressed with a 500ms post-touch guard
- V2: video no longer auto-resumes on page refresh when it was previously playing; the iframe's `onLoad` now re-sends `pauseVideo` on non-touch devices (mobile browsers block autoplay natively so the guard is not needed there and was causing the player to go black)
- V2: `seekTo` (triggered by timecode sync on lift) no longer unintentionally starts playback; a `pauseVideo` is sent immediately after every seek when not all touching

### Added
- V2: video plays only when every user in the room is touching the reaction canvas simultaneously; pauses as soon as anyone lifts their finger
- V2: video timecode is saved to the server when any user lifts their finger; all clients seek to that position so playback resumes in sync next time everyone touches
- TouchLayer: heartbeat re-sends current position every 2s while holding still, preventing Canvas's 3s staleness timeout from falsely dropping the cursor

### Fixed
- Fix connection counter in V2 always showing zero; root cause was server-side presenceCount logic never having been committed/deployed

### Changed
- V2: cursor room is now derived from `?videoId=` — each video gets its own cursor space automatically; `?room=` param removed from V2 (it remains a V1 concept)

### Added
- V2: presence counter badge in top-left of the reaction canvas shows how many people are in the current video room
- V2 touch indicator: large blue circle follows finger on the reaction canvas
- V2 video control: touching the canvas plays the YouTube video; releasing pauses it
- V2 mobile-only gate: non-touch devices see a QR code linking to the current URL instead of the canvas; override with `?forceView=mobile`
- Split V2 index card into two: "YouTube (Blank)" and "YouTube (Example)" with pre-loaded video
- Configurable reaction label sets via `localStorage` (`polis_label_set` key) for minimal A/B testing
- `ReactionLabelSet` interface and `REACTION_LABEL_PRESETS` with three built-in sets: `default` (AGREE / DISAGREE / PASS), `yesno` (YES / NO / SKIP), and `supportive` (SUPPORT / OPPOSE / NEUTRAL)
- `getReactionLabelSet()` helper in `app/voteLabels.ts` reads from `localStorage` and falls back to `default`
- V2 reaction canvas (`ReactionCanvasAppV2`) with YouTube embed above a touch canvas
  - YouTube player takes 45vh; remaining space is the vote canvas
  - Player chrome suppressed via URL params (`controls=0`, `modestbranding=1`, `rel=0`, etc.)
  - Placeholder with example link shown when `?videoId=` is omitted
- `heightOffset` prop on `Canvas` and `TouchLayer` so callers can override the default statement-panel offset for accurate cursor math in V2
- Hash-based router in `client.tsx`: `#v1` loads `SimpleReactionCanvasAppV1`, `#v2` loads `ReactionCanvasAppV2`, root shows `IndexApp`
- `IndexApp` landing page with card grid linking to V1 canvas, ghost-cursor demo, admin panel, and a Polis conversation example
- Storybook (react-vite) + Vitest setup with stories for all components (`CountdownTimer`, `StatementPanel`, `Canvas`, `TouchLayer`, `AdminPanel`, `Counter`)
  - `partysocket/react` mocked in Storybook to prevent live WebSocket connections
  - Countdown stories use `render` functions with fresh `Date.now()` so timers animate on canvas load
- `CLAUDE.md` documenting project architecture, routing, components, and URL params

### Changed
- Vote labels in both V1 and V2 now rendered from `getReactionLabelSet()` rather than hardcoded strings
- `.vote-label` CSS class now has `white-space: nowrap` so longer labels display on one line
- `npm run deploy` now runs `npm run cachebust` automatically before uploading; cachebust no longer runs during `npm run dev`
- `.index-app` is now scrollable on mobile (`overflow-y: auto`, `touch-action: pan-y`) without affecting the touch canvas apps

### Fixed
- Back button broken by `replaceState` normalising `?room=default` into the history entry — default room is now used silently without touching the URL

## [0.2.0] (2025-11-26)

### Added
- Ghost cursors: 10 simulated cursors wandering the canvas with simplex noise at rest and moving toward vote-zone hotspots
- `?ghostCursors=true/false` URL param to set ghost cursor state on load; admin panel toggle to change it at runtime
- Cursors colored by their current vote zone (agree / disagree / pass) with a drawn border
- Separate `TouchLayer` component capturing mouse and touch events, decoupled from D3 animations in `Canvas`
- Polis API proxy on the PartyKit server: room names starting with a digit trigger a fetch from the Polis API to populate the statement pool; others load from a local `statements.<room>.json` file
- WebSocket-based active statement delivery (replaced polling)
- Shared types in `app/types.ts` (`PolisStatement`, `QueueItem`, `Statement`)
- Moderated statements shown as disabled in the admin panel with visual indicator

### Changed
- Statement queue ordering: next statement is scheduled 10 seconds after the *last queued* statement, not 10 seconds from now
- Admin panel timecode column removed

## [0.1.0] (2025-11-20)

### Added
- Canvas MVP: real-time shared cursor positions over WebSockets via PartyKit, rendered as a D3 SVG layer with normalized (0–100) coordinates
- Rooms: `?room=` URL param selects a named PartyKit room; defaults to `"default"`
- Agree / Disagree / Pass vote zones with background color change as cursor moves between zones
- Barycentric coordinate calculation for vote-zone assignment — the zone with the highest barycentric weight wins, with no dead zones
- Vote state stored in refs during touch drag so state changes don't interrupt touch events
- Cursor removed from canvas on mouse leave or touch end
- Statement panel displaying the active Polis statement
- Admin panel for managing the statement queue: add, reorder, clear queue, end voting
- Vote submission to the PartyKit server (agree = 1, disagree = −1, pass = 0)
- Progress bar counting down to the next queued statement; visible even when no next statement is queued
- Special-cased end-voting pseudo-statement (ID −1): displayed without voting or countdown delay
- Cache-busting step in the deploy workflow for production builds
- GitHub Pages and PartyKit deploy workflows

### Fixed
- Vote state freeze during drag caused by state changes interrupting touch events
- Labels occasionally falling outside the screen on certain viewports
- Viewport sizing issues on iOS across multiple browsers
