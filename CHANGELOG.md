# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- Onboarding V2: fix 3D scroll-to-zoom (wheel on desktop, pinch on mobile); zoom now persists correctly instead of being overwritten each frame
- Onboarding V2: fix z-fighting glitch between guide lines and radial dots by setting `depthWrite:false`/`depthTest:false` on guides and using `renderOrder` (guides=-1, dots=10)
- Valence Viz: timeline scrubber can now be dragged while playing (not just while paused); playback resumes from the scrubbed position on release
- All versions: `crypto.randomUUID()` now falls back to a `Math.random`-based UUID v4 on non-secure contexts (e.g. accessing the dev server via a local network IP over plain HTTP), fixing a crash on load
- CI: PR preview deploy and cleanup workflows now use `npx partykit` instead of bare `partykit`, which isn't on PATH after `npm ci`
- CI: PR preview workflow now has `pull-requests: write` permission so it can post the preview URL comment


### Added
- Onboarding V2: changing the chord count (nchords slider) no longer resets existing traces; new chords are appended with empty history, removed chords are dropped from the end
- Onboarding V2: in random order mode, adding/removing chords now maintains group ratios (adds to most-underrepresented group, removes from most-overrepresented) without reshuffling existing chord positions
- Onboarding V2: pause now freezes trace history in addition to valence values
- Onboarding V2: extend cursor trace history from 1s to 5s
- Onboarding V2: rename "fire event" button to "trigger valence shift"
- Onboarding V2: disable "dynamic styling" checkbox (temporarily, pending fix)
- Onboarding V2: disable alpha sliders in color controls (temporarily, pending fix)
- Onboarding V2: set neutral color default to background color (#0f0f0e) instead of black
- Onboarding V2: add "all" links beside "group" and "valence" row labels in style matrix to set all columns at once
- Onboarding V2: rename "cursor radius" control to "cursor size" (now represents diameter; slider range 0–60, default 20)
- Onboarding V2: rename "line width" control to "radial width"
- Onboarding V2: lower minimum chord count from 6 to 1
- Onboarding V2: add "2d time series" view mode with fading cursor trace lines; "2d" renamed to "2d time slice"; trace style column in style grid now active in time-series and 3d views
- Onboarding V2: change default cursor radius to 10 and line width to 2.0
- Onboarding V2: add "linear" geometry mode — all traces collapse to a single vertical line at centre; animated transition to/from parallel
- Onboarding V2: add "parallel" geometry mode — chords become vertical lines equally spaced across 2×R, positive (green) ends gather at top, negative (red) at bottom; animated transition to/from diametric; sequential/simultaneous animation modes work as expected
- Onboarding: added `valence-onboarding-v1.html` and `valence-onboarding-v2.html` to `public/` and linked both from the IndexApp landing page
- Onboarding V2: increase cursor radius slider max from 8 to 30; fix line width slider by switching chord lines from `LineBasicMaterial` (WebGL ignores linewidth) to `LineSegments2`/`LineMaterial` (geometry-based thick lines)
- Valence Viz: converted from standalone `public/valence-viz.html` to a React component (`app/components/ValenceViz.tsx`) routed via `#valence-viz`; three.js added as an npm dependency; the IndexApp card now links to `#valence-viz` instead of the removed HTML file
- Valence Viz: fix trails/fills/tube disappearing at large path scale by setting `frustumCulled = false` on all dynamic geometry — Three.js was culling objects whose stale bounding sphere no longer intersected the frustum after switching to the larger semantic path
- Valence Viz: increase semantic path spread from 3.6 to 20.0 world units so tube diameter is proportionally smaller relative to the path
- Valence Viz: increase max zoom-out distance from 5.0 to 15.0 world units
- Valence Viz: set `radiusScale=1.0` for semantic path mode (was 0.1) so tube diameter, cursor scale, and effective camera distance are consistent with simple curves mode
- Valence Viz: increase simulation steps from 1000 to 1600 (`LIVE_STEPS` 800→1280, `HISTORY_STEPS` 200→320) so traces are denser along the longer semantic path; also switch semantic CatmullRom to arc-length parametrization (`getPointAt`/`getTangentAt`) so steps are spatially uniform rather than clustering near dense control points
- Valence Viz: **target mode** toggle button (`head` / `trail`) — `head` keeps the existing orbit-around-cursor-head behaviour; `trail` positions the camera 80 steps behind the cursor head looking forward down the path; independent of the smoothing mode button so any combination works
- Valence Viz: spacebar toggles play/pause
- Valence Viz: **camera mode** cycle button (click to rotate through `static` → `lerp` → `exp` → `spring` → `quat`); `static` preserves the original snap-to-position behaviour; the four smooth modes gradually follow the path — simple lerp, frame-rate-independent exponential decay, critically-damped spring physics, and exponential-decay position with quaternion slerp for rotation
- Valence Viz: new **Path** selector in the mode bar with "simple curves" (existing Bézier, default) and "demo semantic" (spine driven by `sample-embeddings-3d.json`, 471-second duration); switching paths resets playback and rebuilds all geometry so particle/wave scales stay proportional (pipe-through-space effect)
- All versions: user identity is now persisted in `localStorage` (`polis_user_id`) so cursor identity and Supabase session grouping survive page refreshes
- V4 Admin: load a previously recorded JSON file and replay it as puppeted playback cursors visible to all connected participants in real time; playback cursors are rendered purple with a dashed ring to distinguish them from real users; supports both positions mode (raw x/y) and transitions mode (snaps to anchor region + deterministic per-user jitter)
- Deploy: `npm run deploy:staging` script deploys a persistent staging environment to `staging.polislike-partykit-reaction-canvas.patcon.partykit.dev`
- CI: PR preview environments — opening or pushing to a PR auto-deploys a preview at `pr-{N}.polislike-partykit-reaction-canvas.patcon.partykit.dev` and posts a comment with the URL; preview is deleted when the PR is closed

### Fixed
- Local dev now works without deploying: WebSocket host is now detected by port (1999 = local server) instead of hostname, so accessing via a local network IP (e.g. `10.x.x.x:1999`) correctly connects to the local PartyKit server rather than the deployed one.
- Valence Viz: WebSocket host detection now uses port instead of hostname, matching the rest of the app — fixes connecting to remote server when accessed via local network IP
- Valence Viz: live user dots now appear as soon as a participant connects (on `userJoined`) and disappear when they disconnect (on `userLeft`), rather than appearing only on first touch and never leaving
- Valence Viz: freed live slots now restore their original sim values, so the dot snaps back to the synthetic trajectory instead of freezing at the last live position

### Added
- Experience: Valence Viz — facilitator tool (`valence-viz.html`) wrapping the Three.js particle/wave valence visualization. Runs synthetic data by default (scrub bar + play/pause). "Audience Sync" toggle connects to a PartyKit room via WebSocket and drives valence values from live cursor positions using barycentric region weighting. Supports light-wave and charged-particle modes, group/valence coloring, and orbit camera. Index card added to landing page.
- Experience: Mood Sounds — facilitator tool (`mood-sounds.html`) for ambient generative sound tied to live audience cursor positions. Connects as admin (invisible to participant count). Audience Sync toggle drives the mood slider from WebSocket cursor data; Valence toggle switches between Continuous (raw x-position average) and Unit (each cursor snapped to zone −1/0/+1 before averaging) modes. Room input updates the `?room=` URL param for shareability.
- Index: added card linking to Mood Sounds.
- V4 Admin: new "Activities" config tab — switch the room between Canvas (default reaction canvas) and Soccer modes; activity change is broadcast to all participants in real time
- Soccer mode: top-down physics ball with cursor-based kicking (move your cursor near the ball), goals on the left and right edges, per-room score tracking, and a Reset Score button in admin; ball physics run server-side so all participants see the same state
- V4 Admin: new "Avatars" config tab lets the admin select a DiceBear avatar style (adventurer, avataaars, bottts, fun-emoji, identicon, lorelei, micah, open-peeps, pixel-art, thumbs) or revert to colored dots; the choice is broadcast to all participants in the room
- Canvas: when an avatar style is set by the admin, each participant's cursor is rendered as a circular DiceBear avatar (seeded from their user ID) with a colored border ring; selecting "None" restores the original colored dot + label display

## [Unreleased] (2026-03-03)

### Added
- V1/V2/V4/V5: `?debug=1` URL param enables debug mode on load (in addition to the existing `d` key toggle)
- V5: in debug mode, YouTube player controls (timeline, play/pause) are enabled; overlay removed so controls and scrubber are tappable; touch-to-play behaviour unchanged

### Changed
- V2/V4/V5: `?labels=` URL param now overrides the admin-set room label for that participant only (previously it was only a fallback when no server label was set)

### Changed
- V4/V5 Admin: destructive buttons now use consistent bright-red style (`v3-admin-btn--destructive`) instead of dark maroon inline styles
- V4/V5 Admin: previously hidden buttons (Download JSON, Clear, Clear all recordings) are now always visible and shown as disabled when unavailable

### Fixed
- V5 Admin: "Clear all recordings" button is hidden for rooms listed in `PROTECTED_ROOMS` (currently `irc6creOFGs`)
- Supabase credentials now correctly embedded in `partykit.json` `define` block; `npx partykit env add` does not reach the client build and was ineffective

### Added
- `partykit.example.json` with placeholder values for forking/setup
- `docs/supabase.md`: clarified that credentials go in `partykit.json` directly, not via `partykit env add`

### Changed
- Index page: cards now sorted reverse-chronologically (V5 → V4 → V2 → V1), with participation cards before admin cards within each version
- Index page: YouTube app cards (V2, V5) now have a red-tinted background to distinguish them visually
- Index page: removed blank YouTube cards (V2 and V5 without a video set)

### Added
- V2/V4/V5: dim "bypass" link in the bottom-right of the mobile-only QR gate screen; navigates to the current URL with `?forceView=mobile` added, preserving all other query params

### Changed
- Default example video updated to `irc6creOFGs` across all apps (landing page cards and no-video placeholder links)
- V2/V5: "example" link in the no-video placeholder now preserves existing query params (e.g. `?forceView=mobile`) when navigating to the example video

### Added
- V5: REC badge always visible in the canvas — grey when Supabase is not configured, red when connected and recording
- V4: REC badge now always visible — grey when recording is off, red when active (was hidden entirely when not recording)
- `isSupabaseConfigured` export from `app/lib/supabase.ts`
- `.v3-rec-badge--off` CSS modifier: grey, dimmed version of the recording badge

### Fixed
- V5: YouTube video now loads on arrival (missing `videoId` in `YT.Player` constructor)
- V5: touching the canvas now plays the video; lifting pauses it (single-user touch-to-play)
- V5: live cursors from other connected users are no longer shown; only Supabase replay cursors appear
- Canvas: new `hideCursors` prop suppresses cursor rendering while keeping labels/anchors sync active

### Added
- V5: new async YouTube reaction canvas (`#v5`) — each user watches independently at their own timecode; touch events are recorded to Supabase keyed to the video timecode; past recordings replay as animated purple cursor dots in sync with the video on any future watch session
- V5: `ReplayCanvas` component — lightweight SVG overlay (no D3, no WebSocket) that renders recorded cursors at the correct position for the current video timecode, with position interpolation (linear lerp) and opacity fade (0.25–0.5s staleness window)
- V5: `AdminPanelV5` — admin view with Labels, Anchors, and Peek Canvas tabs (from V4) plus a Recordings section showing Supabase event count and a "Clear all recordings" button
- V5: three landing page cards — "V5: YouTube (Blank)", "V5: YouTube (Example)", and "V5: Admin"
- `app/lib/supabase.ts` — typed Supabase client helpers: `insertEvent`, `fetchEvents`, `clearEvents`, `countEvents`
- `TouchLayer`: new optional `onCursorEvent` prop (non-breaking); called on every move/touch/remove with normalized coords; used by V5 for Supabase recording
- `docs/supabase.md` — setup guide: table schema, credential configuration for local dev and PartyKit deploy

### Added
- GitHub corner link (top-right, 50×50px black) on all app pages including the landing page

### Removed
- V3 participation and admin components deleted; `#v3` now redirects to `#v4` and V3 cards removed from the app landing page

### Added
- V4 admin: recording now captures `arrival` and `departure` events when participants connect or disconnect while recording is active
- V2: reaction labels and anchor positions are now driven by the V4 admin panel; server-set labels/anchors override the `?labels=` URL param (URL param is still the fallback when the admin has not set anything); anchor changes move both the label overlays and the TouchLayer vote regions in real time
- Participant cap setting in V4 admin panel (above recording mode); when set, users joining a full room become read-only viewers; admin users are always exempt from the cap
- View-only mode: users who connect to a full room see a banner warning and have no `TouchLayer` (cannot send cursor events)
- "Join" button appears in the viewer banner when a participant slot opens up; clicking it upgrades the viewer to a full participant without reconnecting
- Connection counter shows viewer count (e.g. `· 2 watching`) when at least one viewer is present; participant count shows `N/cap` when a cap is active
- Applies to V2 and V4 participant-facing apps
- V4 admin: "Peek Canvas" top-level tab shows a live read-only canvas of all participant cursors, colored by vote region with debug region lines; admin connects as `isAdmin: 'true'` so the presence counter shown to participants is unaffected

## [Unreleased] (2026-03-02)

### Added
- V1/V2/V3/V4: `?room=` is now the canonical param for setting the PartyKit room across all apps; `?videoId=` is a deprecated alias that still works for backward compatibility; in V2 `?room=` also sets the YouTube video ID
- V2/V3/V4: presence counter now shows "X here · Y touching" (plus ▶️/⏸️ play state on V2) — participant count and active touching count (others' cursors + own touch if active)
- V2: paused overlay now shows a QR code beside the instructional text so others can scan to join; QR code encodes the current page URL
- V2: when the video is paused (no one touching the canvas), a semi-transparent overlay on the video area instructs users to put their finger on the space below to start and keep the video playing
- V4 admin: recorded events are displayed live in a table below the recording controls; table shows the last 200 events with columns for row number, timestamp, connectionId, from/to (transitions mode) or type/x/y (positions mode)
- V4 admin: "Download JSON" button is now separate from stopping — it appears after recording has stopped and events are present; events accumulate across multiple recording sessions until cleared
- V4 admin: "Clear" button erases all accumulated events and resets the recording session start time
- All admin panels: connections from admin pages are excluded from the participant presence count shown to canvas users; admin panels pass `isAdmin=true` on their WebSocket connection; the server tracks these separately and filters them out of `presenceCount` broadcasts

### Changed
- V2: default example video updated to `izDAOvHz5Wc` (index card link and no-video placeholder link)
- All canvases: debug mode (press `d`) shows region boundary lines as dashed gray lines and anchor markers on the canvas; boundary lines are computed as the three barycentric-weight-equal lines (each passes through the centroid and the midpoint of the opposite anchor edge), so they update live when anchors change in the admin panel; a small gray `d: debug` hint is shown in the bottom-left on pointer/desktop devices only
- V4: configurable anchor positions — admin can set X/Y coordinates (0–100) for each reaction region vertex; changes broadcast live to all participants and persist via server room state
- V4: admin page has a "Coordinate system" selector (Barycentric pre-selected; Linear disabled/coming soon) and an "Anchor positions" section with per-vertex X/Y inputs, "Reset to defaults", and "Apply Anchors"
- V4: `DEFAULT_ANCHORS` and `ReactionAnchors` type exported from `voteRegion.ts`; `computeReactionRegion` accepts an optional anchors parameter (defaults to `DEFAULT_ANCHORS`)
- V4: admin page now has a labels config section; selecting a preset or entering custom values and clicking "Apply Labels" updates labels for all participants in real-time via server room metadata

### Changed
- V4: reaction labels switch from fixed CSS pixel offsets to inline percentage-based positioning (`left: x%; top: y%; transform: translate(-50%,-50%)`) derived from server anchor state; layout is now screen-size agnostic
- V4: label configuration moved from a per-participant `?` help modal to the shared admin page; labels are now server-side state (room metadata) instead of URL params, so all participants see the same labels automatically
- V4: removed the `?labels=` URL param and `?`-key settings modal from the canvas view; label selection no longer requires page reload or URL sharing

### Fixed
- iOS Safari/Chrome: bottom labels pushed off-screen due to `100vh` including browser chrome (address bar + toolbar) making containers taller than the visual viewport; fixed by replacing `width: 100vw; height: 100vh` on `#app` with `inset: 0` (all four edges), which lets the browser compute height from the actual visual viewport; `.app-container` and `.v2-app-container` updated to `width/height: 100%` to inherit correctly
- All canvases: reaction labels now anchor-aligned using inward-growing transform (`reactionLabelStyle` in `voteRegion.ts`): anchor point becomes the label's nearest-edge corner rather than its centre, so labels grow inward regardless of text length or screen size; V4 labels continue to follow server-configured anchor positions; V1/V2/V3 use `DEFAULT_ANCHORS`; also fixes V1/V2/V3 labels piling up in the top-left corner (broken when old CSS position rules were removed during V4 work)
- `DEFAULT_ANCHORS` updated to 5%/95% margins (positive: 95,5 — negative: 5,95 — neutral: 95,95) so labels sit flush with edges by default

### Removed
- V4: `?` keyboard shortcut and help modal removed from the canvas view (settings moved to admin page)

---

## [Unreleased] (2026-03-01)

### Added
- V4: help modal (press `?`) with a label-set picker; hints with links per preset; custom option encodes labels as base64 in URL; "None" hides labels
- All canvases: `?labels=none` hides all reaction labels; `?labels=<base64>` allows arbitrary custom labels
- V3: admin page (`?admin=true#v3`): record cursor positions or vote-region transitions in-browser; download as JSON; broadcasting recording status shows a REC badge to all participants

### Changed
- All canvases: reaction label strings stored in title-case; displayed uppercase via CSS (`text-transform: uppercase`)
- Label presets: removed `yesno` and `supportive`; added `atomic` (Attracted/Repelled/Neutral) and `valence` (Positive/Negative/Neutral); all presets have hint text
- Internal terminology: `VoteState`/`VoteRegion` → `ReactionState`/`ReactionRegion`; values `agree/disagree/pass` → `positive/negative/neutral`; `ReactionLabelSet` properties renamed to match; CSS semantic classes renamed (e.g. `.vote-label-agree` → `.reaction-label-positive`); Polis API fields (`agree_count` etc.) unchanged
- V4 help modal: label picker shows title-case values only (no machine key)
- V2 & V3: `?mobile=true` replaced by `?forceView=mobile`
- V3: new full-page reaction canvas variant (no video, no statements); supports `?room=`, `?labels=`, presence counter, blue-dot cursor, and mobile-only QR gate with `?forceView=mobile` override
- V2: `?labels=` query param selects a reaction label preset; falls back to localStorage / default if omitted or unrecognised

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
