# Changelog

All notable changes to this project will be documented in this file. Releases cut every Monday morning ET; each section header is `## Week N (YYYY-MM-DD)` where the date is the Monday that week starts on, and Week 0 = 2025-11-17.

## Week 22 (2026-04-20)

### Fixed
- V4 People tab: "Send popup…" now sends the coder-role popup only to the targeted user/group/region instead of broadcasting to all participants

### Added
- V4 Interface tab: restructured as a table with Solo / Commons / Patch columns — Social Sharing promoted to a first-class radio row alongside Reaction Canvas, Image Canvas, and Soccer; Commons column is a placeholder for the future front-of-room screen ([#55](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/55))
- V4 Interface tab: Patch column with QR share button on the Social Sharing row — opens a dialog with `?interface=social` URL so participants can add the interface voluntarily without it being pushed; other rows show a greyed-out icon ([#55](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/55))
- V4 People tab: "Send popup…" added to `···` action menus on participant rows and group/region headers — opens a confirmation modal before dispatching the coder-role GitHub username popup ([#55](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/55))
- V4: Social Sharing is now a broadcast canvas activity — when the emcee selects it from the Interface tab all participants' personal screens switch to the social sharing UI; selecting any other mode restores their canvas ([#55](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/55))

### Changed
- Refactor: extracted shared `ActivityMode` type to `app/types.ts` replacing 12 inline union literals across server and client
- V4 Interface tab: coder-role popup trigger moved from Interface tab to the People tab "Send popup…" menu item

### Added
- V4: participants now receive a haptic buzz + indicator flash when the emcee silently changes the reaction labels, switches the canvas activity (Reaction Canvas / Soccer / Image Canvas), or sets a new image in Image Canvas; does not fire on the emcee's device or on initial page load ([#54](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/54))

### Added
- V4: haptic indicator button beside the QR share button — flashes when a buzz signal arrives; tap to toggle haptics on/off; on devices without haptic support it stays in "off" state but still flashes to show the signal arrived
- V4 People tab: emcee can now send a haptic buzz to individual participants, groups, or reaction regions — a confirmation modal shows the target before sending, and participants see a permission dialog before their device vibrates ([#34](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/34))

### Fixed
- V4 Moments: snapping a moment over a LAN IP (e.g. `192.168.x.x`) threw a silent `TypeError` because `crypto.randomUUID()` is only available in secure contexts (HTTPS + `localhost`) — fixed by extracting a `generateUUID()` utility in `app/utils/userId.ts` with a Math.random fallback; `ValenceViz` had the same bare call and is also fixed
- V4 People tab: the emcee's own connection now shows "(you)" next to their user ID so they can identify themselves before pushing interfaces ([#45](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/45))
- V4: image-canvas coordinate remapping no longer leaks into the regular reaction canvas — `Canvas` now gates the image-relative cursor math on `activity === 'image-canvas'`, and `TouchLayer` is only given `imageUrl` when that activity is active ([#37](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/37))

### Changed
- Refactor: split `AdminPanelV4` (1960 lines) into `AdminPanelV4/` directory — 6 custom hooks (`useAnchors`, `useLabels`, `useRoomConfig`, `useRecording`, `usePlayback`, `useParticipants`), 8 tab components, `ParticipantRow`, `OfferInterfaceModal`, and a thin `index.tsx` orchestrator; no behavior changes
- CI: typecheck (`tsc --noEmit`) and Storybook/Playwright tests (`vitest run`) now run as a required `check` job before every deploy (PR previews and production); add `typecheck` and `test` scripts to `package.json`

### Added
- Storybook: baseline stories for `AdminPanelV4` — 11 stories cover all 8 tabs (render + key static assertions) plus two local-state interaction tests (`LabelsCustomInputsReveal`, `EventsEmptyState`) to catch hook/prop mis-wiring in the component split refactor ([`5722984`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/5722984))

### Added
- Storybook: baseline stories for `AdminPanelV4` — 11 stories cover all 8 tabs (render + key static assertions) plus two local-state interaction tests (`LabelsCustomInputsReveal`, `EventsEmptyState`) to catch hook/prop mis-wiring in the component split refactor ([`5722984`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/5722984))

### Added
- V4 emcee: new Moments tab — snap a labeled snapshot of where all participants are, view collapsed stats per valence zone, expand to see the per-participant breakdown, and rename moments inline; snapshots persist via localStorage ([#46](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/46))
- V4 People tab: new "Valence: Moments" Group By option — pick a past moment snapshot and group participants by their region at that time, with full "Offer interface" support; "Valence Zone" renamed to "Valence: Current" ([#46](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/46))

### Fixed
- V4 emcee panel no longer overflows the screen when the interface chip bar is visible — the panel now fills the remaining height instead of claiming the full 100vh ([#42](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/42))

### Changed
- V4 People tab: clicking `···` on a participant row now opens a dropdown menu with "Offer interface…"; choosing it opens a dialog with a select limited to "social" and "emcee" (replaces the free-text input)

### Added
- V4 emcee: push interface invitations to individual participants or entire valence groups — click `···` on a participant row or group header in the Participants tab, enter a role name, and hit Send; targeted participants receive a GitHub-style popup asking whether to accept or decline; acceptances appear in a live list at the bottom of the Participants tab ([#32](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/32))
- V4: social sharing interface — emcee configures a default text field plus per-platform handles (Twitter/X, Bluesky, Mastodon, Instagram) via a "config" button in the Interfaces tab; participants with `?interface=social` see a Social chip and share buttons with platform icons; Twitter/X, Bluesky, and Mastodon open compose flows with prefilled text; Instagram shows separate "Open" and "Copy text" buttons since it has no URL-based prefill; Mastodon uses [mastodonshare.com](https://mastodonshare.com/) as a universal relay ([#29](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/29))
- V4: active interface chip persists across browser refreshes via localStorage — restores the last active chip on reload, falling back to default if that interface is no longer unlocked ([#29](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/29))
- V4 admin: removed "Peek Canvas" button and overlay — the emcee can now switch to the Canvas chip in the interface bar to see the live canvas directly ([#33](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/33))
- V4: interface chip bar — when the emcee interface is unlocked, a scrollable chip bar appears at the top letting the user switch between "Canvas" (participant view) and "Emcee" (admin panel); interfaces are mutually exclusive and fill the area below the bar ([#33](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/33))
- V4: `?interface=emcee` URL param — canonical way to unlock the emcee interface; `?admin=true` is now a deprecated alias that still works ([#33](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/33))
- Share QR button strips role params (`?interface`, `?admin`) and `?forceView` from the shared URL so participants always receive a clean participant link
- V4 admin: mobile-friendly layout — replaced the two-column desktop layout with a single-column tab-based UI; "Record" tab consolidates recording controls, status, playback, and the events table; config tabs (Labels, Anchors, Avatars, Interface, Events, People) are now top-level tabs in a horizontally-scrollable tab bar; "Peek Canvas" is now a toggle button in the persistent header that opens a full-screen overlay rather than a tab ([`14325d6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/14325d6))
- V4 admin: Participants tab — lists all connected users grouped by their current valence zone (using the active label set for group headings); users with no active cursor appear under "Lurking"; flat list available via grouping dropdown; row layout includes a disabled action button placeholder for future per-user actions ([`22b9ae8`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/22b9ae8))
- V4 admin: recorded events table is always visible in the Record tab, even before any events have been captured ([`d579f85`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d579f85))
- V4 admin: JSON download is available while recording is in progress, not only after stopping ([`d579f85`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d579f85))
- V4 admin: confirm dialog on the Clear button shows the current event count before discarding ([`d579f85`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d579f85))

### Fixed
- All versions: preview deployments now connect to their own isolated PartyKit server instead of production — replaced the hardcoded `process.env.PARTYKIT_HOST` build-time define with `window.location.hostname` so each environment (local dev, staging, PR preview, production) automatically uses its own server
- V4 admin: fix vertical bounce when swiping the tab bar on iOS/Android — added `touch-action: pan-x` and `overscroll-behavior-x: contain` so the browser treats tab-bar swipes as horizontal-only ([`d579f85`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d579f85))

## Week 21 (2026-04-13)

### Added
- V4 admin: Image Canvas interface mode — admin selects "Image Canvas" in the Interfaces tab and uses the adjacent "config" link to set a public image URL; the image is broadcast to all participants as the canvas background (fitted with `object-fit: contain`); cursor positions are normalized to image-relative coordinates so reactions stay anchored to the same image content regardless of screen size ([`3fa3d87`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3fa3d87))
- V4 admin: renamed "Canvas" interface option to "Reaction Canvas" in the Interfaces tab ([`3fa3d87`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3fa3d87))
- V2/V4/V5: share QR button — a small icon in the top-right corner of the reaction canvas opens a full-screen QR code modal showing the current page URL (with `forceView` param stripped), so participants can easily invite others ([`8f695b2`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/8f695b2))
- V4: vibe-coding activity — admin can push a GitHub username submission form to all participants from the Activities tab; participants are prompted to enter their GitHub username, which is validated against the public GitHub API (avatar + display name shown for confirmation); submissions appear live in a new Events tab in the V4 admin panel and can be downloaded as JSON ([`8b4fe4c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/8b4fe4c))
- V4 admin: two new label presets — `genz` (Based / Whack / Mid) and `engagement` (Engaged / Disengaged / Baseline) ([`c10a5c5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c10a5c5))
- V4 admin: custom label history — the last 5 applied custom label sets are saved to localStorage and shown as chips below the custom inputs; clicking a chip restores those values, and × removes it from history ([`c10a5c5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c10a5c5))

### Fixed
- Index: fix Android scroll bug where top cards were unreachable — changed `justify-content: center` to `justify-content: flex-start` on `.index-app` to prevent inaccessible top overflow in flex scroll containers ([`31fdd68`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/31fdd68))

## Week 20 (2026-04-06)

### Added
- Onboarding: added `valence-onboarding-v1.html` and `valence-onboarding-v2.html` to `public/` and linked both from the IndexApp landing page ([`3fbd33e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3fbd33e))
- Onboarding V2: increase cursor radius slider max from 8 to 30; fix line width slider by switching chord lines from `LineBasicMaterial` (WebGL ignores linewidth) to `LineSegments2`/`LineMaterial` (geometry-based thick lines) ([`9ee20f1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/9ee20f1))
- Onboarding V2: add "2d time series" view mode with fading cursor trace lines; "2d" renamed to "2d time slice"; trace style column in style grid now active in time-series and 3d views ([`b41cfc9`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b41cfc9))
- Onboarding V2: change default cursor radius to 10 and line width to 2.0 ([`0213a7e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/0213a7e))
- Onboarding V2: add "linear" geometry mode — all traces collapse to a single vertical line at centre; animated transition to/from parallel ([`0f7954b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/0f7954b))
- Onboarding V2: add "parallel" geometry mode — chords become vertical lines equally spaced across 2×R, positive (green) ends gather at top, negative (red) at bottom; animated transition to/from diametric; sequential/simultaneous animation modes work as expected ([`a4e25d0`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a4e25d0))
- Onboarding V2: rename UI labels — "enter/exit" → "entry/exit animation", "origin v2" → "origin" (origin v1 removed), "entry mode" → "chord persistence", buttons "redistributed"/"persistent" → "no"/"yes"; in persistent mode, chords never switch groups when count changes — new chords slot into their group's arc slice and existing group members stay put; other groups are unaffected ([`13b88a6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/13b88a6))
- Onboarding V2: changing the chord count (nchords slider) no longer resets existing traces; new chords are appended with empty history, removed chords are dropped from the end ([`9a7c093`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/9a7c093))
- Onboarding V2: in random order mode, adding/removing chords now maintains group ratios (adds to most-underrepresented group, removes from most-overrepresented) without reshuffling existing chord positions ([`13708f7`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/13708f7))
- Onboarding V2: add "enter/exit" toggle (none / origin v1 / origin v2); "origin v2" animates chord arrival with ease-out burst and departure with ease-in acceleration toward the zero-valence origin ([`dedd4ab`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/dedd4ab))
- Onboarding V2: pause now freezes trace history in addition to valence values ([`1ca0872`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/1ca0872))
- Onboarding V2: extend cursor trace history from 1s to 5s ([`20c06b1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/20c06b1))
- Onboarding V2: rename "fire event" button to "trigger valence shift" ([`4378854`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/4378854))
- Onboarding V2: disable "dynamic styling" checkbox (temporarily, pending fix) ([`e212f35`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/e212f35))
- Onboarding V2: disable alpha sliders in color controls (temporarily, pending fix) ([`7b0cc4c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/7b0cc4c))
- Onboarding V2: set neutral color default to background color (#0f0f0e) instead of black ([`0be6537`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/0be6537))
- Onboarding V2: add "all" links beside "group" and "valence" row labels in style matrix to set all columns at once ([`79b3af6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/79b3af6))
- Onboarding V2: rename "cursor radius" control to "cursor size" (now represents diameter; slider range 0–60, default 20) ([`b8e6bd3`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b8e6bd3))
- Onboarding V2: rename "line width" control to "radial width" ([`8eaf740`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/8eaf740))
- Onboarding V2: lower minimum chord count from 6 to 1 ([`60b871b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/60b871b))
- Onboarding V2: WebSocket connection panel — room input, connect/disconnect button, and live status; connected participants each appear as an additional blue (#4285F4) chord on top of simulated ones, with trace and fill surfaces; cursor color follows group/valence style setting; chord entry/exit animations run even when paused; cursor dot continues updating from live WS data while paused; group palette reordered so blue appears last (index 6) to keep live-user blue visually distinct ([`dcaa2fc`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/dcaa2fc))
- Onboarding V2: fill surface — a translucent wedge mesh connecting each chord's trace path back to the canvas origin along the time (Z) axis, coloured and faded like the trace; wired up the fill column in the style grid (group/valence buttons now active) ([`d3cb05d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d3cb05d))
- Onboarding V2: per-element opacity sliders in the style grid (radial / trace / cursor / fill), replacing the single global opacity slider; trace and fill sliders dim alongside their other controls when in 2d time slice mode ([`4ae95b2`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/4ae95b2))

### Fixed
- Onboarding V2: fix z-fighting glitch between guide lines and radial dots by setting `depthWrite:false`/`depthTest:false` on guides and using `renderOrder` (guides=-1, dots=10) ([`bb802d1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/bb802d1))
- Onboarding V2: fix 3D scroll-to-zoom (wheel on desktop, pinch on mobile); zoom now persists correctly instead of being overwritten each frame ([`d4119a7`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d4119a7))
- Onboarding V2: fix "origin v2" exit — chords now animate from their actual rendered position; fixes `departN` off-by-`idx` formula and group-slot position mismatch on departure ([`cb44de1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/cb44de1))
- Onboarding V2: fix "origin v2" entry/exit symmetry — new chords start at their group target value so entry is a pure scale-up (no post-animation drift); exit was already pure scale-down ([`22bb765`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/22bb765))
- Onboarding V2: in "none" enter/exit mode, new chords now appear immediately at their group target value instead of animating in from near-zero ([`3ed165c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3ed165c))
- Onboarding V2: "origin v2" entry/exit animations are now symmetric (both use ease-in: `t²` / `1-t²`) and 3.75× slower (30 frames instead of 8) ([`35d3523`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/35d3523))
- Onboarding V2: fix group-slot arc distribution in persistent mode — slices are now Fibonacci-proportional (matching `assignBase` weights) instead of equal `1/ng`, so chord density is uniform across groups in all geometry modes ([`2ba0975`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/2ba0975))
- Onboarding V2: fix fill surface origin — fill now anchors to each chord's historically-correct root position (stored alongside tip in history) instead of always the global canvas centre; fixes parallel mode where each chord has a distinct root x-position, and correctly tracks the root through geometry transitions ([`9d66611`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/9d66611))
- Onboarding V2: fix black chord/dot outlines appearing on fill surface when radial/cursor opacity is 0 — chord and dot materials now have `depthWrite:false`, consistent with trace and fill materials ([`ba20bba`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ba20bba))

## Week 19 (2026-03-30)

### Added
- Experience: Valence Viz — facilitator tool (`valence-viz.html`) wrapping the Three.js particle/wave valence visualization. Runs synthetic data by default (scrub bar + play/pause). "Audience Sync" toggle connects to a PartyKit room via WebSocket and drives valence values from live cursor positions using barycentric region weighting. Supports light-wave and charged-particle modes, group/valence coloring, and orbit camera. Index card added to landing page. ([`b790e0d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b790e0d))
- Experience: Mood Sounds — facilitator tool (`mood-sounds.html`) for ambient generative sound tied to live audience cursor positions. Connects as admin (invisible to participant count). Audience Sync toggle drives the mood slider from WebSocket cursor data; Valence toggle switches between Continuous (raw x-position average) and Unit (each cursor snapped to zone −1/0/+1 before averaging) modes. Room input updates the `?room=` URL param for shareability. ([`f2528a3`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/f2528a3))
- Index: added card linking to Mood Sounds. ([`f2528a3`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/f2528a3))
- Valence Viz: converted from standalone `public/valence-viz.html` to a React component (`app/components/ValenceViz.tsx`) routed via `#valence-viz`; three.js added as an npm dependency; the IndexApp card now links to `#valence-viz` instead of the removed HTML file ([`399d06e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/399d06e))
- Valence Viz: new **Path** selector in the mode bar with "simple curves" (existing Bézier, default) and "demo semantic" (spine driven by `sample-embeddings-3d.json`, 471-second duration); switching paths resets playback and rebuilds all geometry so particle/wave scales stay proportional (pipe-through-space effect) ([`1c88e95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/1c88e95))
- All versions: user identity is now persisted in `localStorage` (`polis_user_id`) so cursor identity and Supabase session grouping survive page refreshes ([`501395c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/501395c))
- Valence Viz: **camera mode** cycle button (click to rotate through `static` → `lerp` → `exp` → `spring` → `quat`); `static` preserves the original snap-to-position behaviour; the four smooth modes gradually follow the path — simple lerp, frame-rate-independent exponential decay, critically-damped spring physics, and exponential-decay position with quaternion slerp for rotation ([`87a98e6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/87a98e6))
- Valence Viz: spacebar toggles play/pause ([`0936996`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/0936996))
- Valence Viz: **target mode** toggle button (`head` / `trail`) — `head` keeps the existing orbit-around-cursor-head behaviour; `trail` positions the camera 80 steps behind the cursor head looking forward down the path; independent of the smoothing mode button so any combination works ([`9d8f45e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/9d8f45e))
- Valence Viz: increase simulation steps from 1000 to 1600 (`LIVE_STEPS` 800→1280, `HISTORY_STEPS` 200→320) so traces are denser along the longer semantic path; also switch semantic CatmullRom to arc-length parametrization (`getPointAt`/`getTangentAt`) so steps are spatially uniform rather than clustering near dense control points ([`78137f6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/78137f6))
- Valence Viz: set `radiusScale=1.0` for semantic path mode (was 0.1) so tube diameter, cursor scale, and effective camera distance are consistent with simple curves mode ([`674b819`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/674b819))
- Valence Viz: increase max zoom-out distance from 5.0 to 15.0 world units ([`2f66089`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/2f66089))
- Valence Viz: increase semantic path spread from 3.6 to 20.0 world units so tube diameter is proportionally smaller relative to the path ([`4c40168`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/4c40168))
- Valence Viz: fix trails/fills/tube disappearing at large path scale by setting `frustumCulled = false` on all dynamic geometry — Three.js was culling objects whose stale bounding sphere no longer intersected the frustum after switching to the larger semantic path ([`fc45f92`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/fc45f92))
- V4 Admin: load a previously recorded JSON file and replay it as puppeted playback cursors visible to all connected participants in real time; playback cursors are rendered purple with a dashed ring to distinguish them from real users; supports both positions mode (raw x/y) and transitions mode (snaps to anchor region + deterministic per-user jitter) ([`55764b6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/55764b6))
- Deploy: `npm run deploy:staging` script deploys a persistent staging environment to `staging.polislike-partykit-reaction-canvas.patcon.partykit.dev` ([`90572fd`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/90572fd))
- CI: PR preview environments — opening or pushing to a PR auto-deploys a preview at `pr-{N}.polislike-partykit-reaction-canvas.patcon.partykit.dev` and posts a comment with the URL; preview is deleted when the PR is closed ([`90572fd`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/90572fd))
- Valence Viz: timeline scrubber can now be dragged while playing (not just while paused); playback resumes from the scrubbed position on release ([`1995d2b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/1995d2b))
- All versions: `crypto.randomUUID()` now falls back to a `Math.random`-based UUID v4 on non-secure contexts (e.g. accessing the dev server via a local network IP over plain HTTP), fixing a crash on load ([`567d126`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/567d126))

### Fixed
- Local dev now works without deploying: WebSocket host is now detected by port (1999 = local server) instead of hostname, so accessing via a local network IP (e.g. `10.x.x.x:1999`) correctly connects to the local PartyKit server rather than the deployed one. ([`233a00e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/233a00e))
- CI: PR preview deploy and cleanup workflows now use `npx partykit` instead of bare `partykit`, which isn't on PATH after `npm ci` ([`6e01057`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/6e01057))
- CI: PR preview workflow now has `pull-requests: write` permission so it can post the preview URL comment ([`cf33121`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/cf33121))
- Valence Viz: WebSocket host detection now uses port instead of hostname, matching the rest of the app — fixes connecting to remote server when accessed via local network IP ([`d5e7368`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d5e7368))
- Valence Viz: live user dots now appear as soon as a participant connects (on `userJoined`) and disappear when they disconnect (on `userLeft`), rather than appearing only on first touch and never leaving ([`d5e7368`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d5e7368))
- Valence Viz: freed live slots now restore their original sim values, so the dot snaps back to the synthetic trajectory instead of freezing at the last live position ([`d5e7368`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/d5e7368))

## Week 18 (2026-03-23)

### Added
- V4 Admin: new "Activities" config tab — switch the room between Canvas (default reaction canvas) and Soccer modes; activity change is broadcast to all participants in real time ([`3ac6bd5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3ac6bd5))
- Soccer mode: top-down physics ball with cursor-based kicking (move your cursor near the ball), goals on the left and right edges, per-room score tracking, and a Reset Score button in admin; ball physics run server-side so all participants see the same state ([`3ac6bd5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3ac6bd5))
- V4 Admin: new "Avatars" config tab lets the admin select a DiceBear avatar style (adventurer, avataaars, bottts, fun-emoji, identicon, lorelei, micah, open-peeps, pixel-art, thumbs) or revert to colored dots; the choice is broadcast to all participants in the room ([`c327fd9`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c327fd9))
- Canvas: when an avatar style is set by the admin, each participant's cursor is rendered as a circular DiceBear avatar (seeded from their user ID) with a colored border ring; selecting "None" restores the original colored dot + label display ([`c327fd9`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c327fd9))

## Week 15 (2026-03-02)

### Added
- V1/V2/V3/V4: `?room=` is now the canonical param for setting the PartyKit room across all apps; `?videoId=` is a deprecated alias that still works for backward compatibility; in V2 `?room=` also sets the YouTube video ID ([`fdf5a3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/fdf5a3f))
- V2/V3/V4: presence counter now shows "X here · Y touching" (plus ▶️/⏸️ play state on V2) — participant count and active touching count (others' cursors + own touch if active) ([`1d2d27b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/1d2d27b))
- V2: paused overlay now shows a QR code beside the instructional text so others can scan to join; QR code encodes the current page URL ([`a24ee89`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a24ee89))
- V2: when the video is paused (no one touching the canvas), a semi-transparent overlay on the video area instructs users to put their finger on the space below to start and keep the video playing ([`60af9ab`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/60af9ab))
- V4 admin: recorded events are displayed live in a table below the recording controls; table shows the last 200 events with columns for row number, timestamp, connectionId, from/to (transitions mode) or type/x/y (positions mode) ([`6b0a38c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/6b0a38c))
- V4 admin: "Download JSON" button is now separate from stopping — it appears after recording has stopped and events are present; events accumulate across multiple recording sessions until cleared ([`6b0a38c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/6b0a38c))
- V4 admin: "Clear" button erases all accumulated events and resets the recording session start time ([`6b0a38c`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/6b0a38c))
- All admin panels: connections from admin pages are excluded from the participant presence count shown to canvas users; admin panels pass `isAdmin=true` on their WebSocket connection; the server tracks these separately and filters them out of `presenceCount` broadcasts ([`fc8524a`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/fc8524a))
- V1/V2/V4/V5: `?debug=1` URL param enables debug mode on load (in addition to the existing `d` key toggle) ([`a5244a4`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a5244a4))
- V5: in debug mode, YouTube player controls (timeline, play/pause) are enabled; overlay removed so controls and scrubber are tappable; touch-to-play behaviour unchanged ([`8429829`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/8429829))
- `partykit.example.json` with placeholder values for forking/setup ([`b42300e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b42300e))
- `docs/supabase.md`: clarified that credentials go in `partykit.json` directly, not via `partykit env add` ([`b42300e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b42300e))
- V2/V4/V5: dim "bypass" link in the bottom-right of the mobile-only QR gate screen; navigates to the current URL with `?forceView=mobile` added, preserving all other query params ([`b540ce4`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b540ce4))
- V5: REC badge always visible in the canvas — grey when Supabase is not configured, red when connected and recording ([`ae9e274`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ae9e274))
- V4: REC badge now always visible — grey when recording is off, red when active (was hidden entirely when not recording) ([`ae9e274`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ae9e274))
- `isSupabaseConfigured` export from `app/lib/supabase.ts` ([`ae9e274`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ae9e274))
- `.v3-rec-badge--off` CSS modifier: grey, dimmed version of the recording badge ([`ae9e274`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ae9e274))
- V5: new async YouTube reaction canvas (`#v5`) — each user watches independently at their own timecode; touch events are recorded to Supabase keyed to the video timecode; past recordings replay as animated purple cursor dots in sync with the video on any future watch session ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- V5: `ReplayCanvas` component — lightweight SVG overlay (no D3, no WebSocket) that renders recorded cursors at the correct position for the current video timecode, with position interpolation (linear lerp) and opacity fade (0.25–0.5s staleness window) ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- V5: `AdminPanelV5` — admin view with Labels, Anchors, and Peek Canvas tabs (from V4) plus a Recordings section showing Supabase event count and a "Clear all recordings" button ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- V5: three landing page cards — "V5: YouTube (Blank)", "V5: YouTube (Example)", and "V5: Admin" ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- `app/lib/supabase.ts` — typed Supabase client helpers: `insertEvent`, `fetchEvents`, `clearEvents`, `countEvents` ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- `TouchLayer`: new optional `onCursorEvent` prop (non-breaking); called on every move/touch/remove with normalized coords; used by V5 for Supabase recording ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- `docs/supabase.md` — setup guide: table schema, credential configuration for local dev and PartyKit deploy ([`ea01c3f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/ea01c3f))
- GitHub corner link (top-right, 50×50px black) on all app pages including the landing page ([`dbd2994`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/dbd2994))
- V4 admin: recording now captures `arrival` and `departure` events when participants connect or disconnect while recording is active ([`efe724a`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/efe724a))
- V2: reaction labels and anchor positions are now driven by the V4 admin panel; server-set labels/anchors override the `?labels=` URL param (URL param is still the fallback when the admin has not set anything); anchor changes move both the label overlays and the TouchLayer vote regions in real time ([`a09c411`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a09c411))
- Participant cap setting in V4 admin panel (above recording mode); when set, users joining a full room become read-only viewers; admin users are always exempt from the cap ([`012a92d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/012a92d))
- View-only mode: users who connect to a full room see a banner warning and have no `TouchLayer` (cannot send cursor events) ([`012a92d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/012a92d))
- "Join" button appears in the viewer banner when a participant slot opens up; clicking it upgrades the viewer to a full participant without reconnecting ([`012a92d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/012a92d))
- Connection counter shows viewer count (e.g. `· 2 watching`) when at least one viewer is present; participant count shows `N/cap` when a cap is active ([`012a92d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/012a92d))
- Applies to V2 and V4 participant-facing apps ([`012a92d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/012a92d))
- V4 admin: "Peek Canvas" top-level tab shows a live read-only canvas of all participant cursors, colored by vote region with debug region lines; admin connects as `isAdmin: 'true'` so the presence counter shown to participants is unaffected ([`4b4057e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/4b4057e))

### Changed
- V2: default example video updated to `izDAOvHz5Wc` (index card link and no-video placeholder link) ([`619786e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/619786e))
- All canvases: debug mode (press `d`) shows region boundary lines as dashed gray lines and anchor markers on the canvas; boundary lines are computed as the three barycentric-weight-equal lines (each passes through the centroid and the midpoint of the opposite anchor edge), so they update live when anchors change in the admin panel; a small gray `d: debug` hint is shown in the bottom-left on pointer/desktop devices only ([`c6221e5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c6221e5))
- V4: configurable anchor positions — admin can set X/Y coordinates (0–100) for each reaction region vertex; changes broadcast live to all participants and persist via server room state ([`c5ff25b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c5ff25b))
- V4: admin page has a "Coordinate system" selector (Barycentric pre-selected; Linear disabled/coming soon) and an "Anchor positions" section with per-vertex X/Y inputs, "Reset to defaults", and "Apply Anchors" ([`c5ff25b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c5ff25b))
- V4: `DEFAULT_ANCHORS` and `ReactionAnchors` type exported from `voteRegion.ts`; `computeReactionRegion` accepts an optional anchors parameter (defaults to `DEFAULT_ANCHORS`) ([`c5ff25b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c5ff25b))
- V4: admin page now has a labels config section; selecting a preset or entering custom values and clicking "Apply Labels" updates labels for all participants in real-time via server room metadata ([`550e3cf`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/550e3cf))
- V4: reaction labels switch from fixed CSS pixel offsets to inline percentage-based positioning (`left: x%; top: y%; transform: translate(-50%,-50%)`) derived from server anchor state; layout is now screen-size agnostic ([`c5ff25b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c5ff25b))
- V4: label configuration moved from a per-participant `?` help modal to the shared admin page; labels are now server-side state (room metadata) instead of URL params, so all participants see the same labels automatically ([`550e3cf`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/550e3cf))
- V4: removed the `?labels=` URL param and `?`-key settings modal from the canvas view; label selection no longer requires page reload or URL sharing ([`550e3cf`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/550e3cf))
- V2/V4/V5: `?labels=` URL param now overrides the admin-set room label for that participant only (previously it was only a fallback when no server label was set) ([`7d29ba4`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/7d29ba4))
- V4/V5 Admin: destructive buttons now use consistent bright-red style (`v3-admin-btn--destructive`) instead of dark maroon inline styles ([`60344b5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/60344b5))
- V4/V5 Admin: previously hidden buttons (Download JSON, Clear, Clear all recordings) are now always visible and shown as disabled when unavailable ([`60344b5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/60344b5))
- Index page: cards now sorted reverse-chronologically (V5 → V4 → V2 → V1), with participation cards before admin cards within each version ([`5bac1c6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/5bac1c6))
- Index page: YouTube app cards (V2, V5) now have a red-tinted background to distinguish them visually ([`5bac1c6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/5bac1c6))
- Index page: removed blank YouTube cards (V2 and V5 without a video set) ([`5bac1c6`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/5bac1c6))
- Default example video updated to `irc6creOFGs` across all apps (landing page cards and no-video placeholder links) ([`c32ff6a`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c32ff6a))
- V2/V5: "example" link in the no-video placeholder now preserves existing query params (e.g. `?forceView=mobile`) when navigating to the example video ([`c32ff6a`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c32ff6a))

### Fixed
- iOS Safari/Chrome: bottom labels pushed off-screen due to `100vh` including browser chrome (address bar + toolbar) making containers taller than the visual viewport; fixed by replacing `width: 100vw; height: 100vh` on `#app` with `inset: 0` (all four edges), which lets the browser compute height from the actual visual viewport; `.app-container` and `.v2-app-container` updated to `width/height: 100%` to inherit correctly ([`aa40e57`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/aa40e57))
- All canvases: reaction labels now anchor-aligned using inward-growing transform (`reactionLabelStyle` in `voteRegion.ts`): anchor point becomes the label's nearest-edge corner rather than its centre, so labels grow inward regardless of text length or screen size; V4 labels continue to follow server-configured anchor positions; V1/V2/V3 use `DEFAULT_ANCHORS`; also fixes V1/V2/V3 labels piling up in the top-left corner (broken when old CSS position rules were removed during V4 work) ([`824ffde`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/824ffde))
- `DEFAULT_ANCHORS` updated to 5%/95% margins (positive: 95,5 — negative: 5,95 — neutral: 95,95) so labels sit flush with edges by default ([`824ffde`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/824ffde))
- V5 Admin: "Clear all recordings" button is hidden for rooms listed in `PROTECTED_ROOMS` (currently `irc6creOFGs`) ([`da2972b`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/da2972b))
- Supabase credentials now correctly embedded in `partykit.json` `define` block; `npx partykit env add` does not reach the client build and was ineffective ([`b42300e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/b42300e))
- V5: YouTube video now loads on arrival (missing `videoId` in `YT.Player` constructor) ([`053c578`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/053c578))
- V5: touching the canvas now plays the video; lifting pauses it (single-user touch-to-play) ([`053c578`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/053c578))
- V5: live cursors from other connected users are no longer shown; only Supabase replay cursors appear ([`053c578`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/053c578))
- Canvas: new `hideCursors` prop suppresses cursor rendering while keeping labels/anchors sync active ([`053c578`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/053c578))

### Removed
- V4: `?` keyboard shortcut and help modal removed from the canvas view (settings moved to admin page) ([`550e3cf`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/550e3cf))
- V3 participation and admin components deleted; `#v3` now redirects to `#v4` and V3 cards removed from the app landing page ([`f6105e3`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/f6105e3))

## Week 14 (2026-02-23)

### Added
- V4: help modal (press `?`) with a label-set picker; hints with links per preset; custom option encodes labels as base64 in URL; "None" hides labels ([`89b7d95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/89b7d95))
- All canvases: `?labels=none` hides all reaction labels; `?labels=<base64>` allows arbitrary custom labels ([`89b7d95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/89b7d95))
- V3: admin page (`?admin=true#v3`): record cursor positions or vote-region transitions in-browser; download as JSON; broadcasting recording status shows a REC badge to all participants ([`2e79960`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/2e79960))
- V2: presence counter badge in top-left of the reaction canvas shows how many people are in the current video room ([`1b31861`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/1b31861))
- V2 mobile-only gate: non-touch devices see a QR code linking to the current URL instead of the canvas; override with `?forceView=mobile` ([`03ce2f1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/03ce2f1))
- V2 touch indicator: large blue circle follows finger on the reaction canvas ([`66c4873`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/66c4873))
- V2 video control: touching the canvas plays the YouTube video; releasing pauses it ([`66c4873`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/66c4873))
- V2: video plays only when every user in the room is touching the reaction canvas simultaneously; pauses as soon as anyone lifts their finger ([`3d0cb6d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/3d0cb6d))
- V2: video timecode is saved to the server when any user lifts their finger; all clients seek to that position so playback resumes in sync next time everyone touches ([`c049ab4`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c049ab4))
- TouchLayer: heartbeat re-sends current position every 2s while holding still, preventing Canvas's 3s staleness timeout from falsely dropping the cursor ([`2e5534a`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/2e5534a))
- Split V2 index card into two: "YouTube (Blank)" and "YouTube (Example)" with pre-loaded video ([`563e9be`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/563e9be))
- Configurable reaction label sets via `localStorage` (`polis_label_set` key) for minimal A/B testing ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `ReactionLabelSet` interface and `REACTION_LABEL_PRESETS` with three built-in sets: `default` (AGREE / DISAGREE / PASS), `yesno` (YES / NO / SKIP), and `supportive` (SUPPORT / OPPOSE / NEUTRAL) ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `getReactionLabelSet()` helper in `app/voteLabels.ts` reads from `localStorage` and falls back to `default` ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- V2 reaction canvas (`ReactionCanvasAppV2`) with YouTube embed above a touch canvas ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
  - YouTube player takes 45vh; remaining space is the vote canvas
  - Player chrome suppressed via URL params (`controls=0`, `modestbranding=1`, `rel=0`, etc.)
  - Placeholder with example link shown when `?videoId=` is omitted
- `heightOffset` prop on `Canvas` and `TouchLayer` so callers can override the default statement-panel offset for accurate cursor math in V2 ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Hash-based router in `client.tsx`: `#v1` loads `SimpleReactionCanvasAppV1`, `#v2` loads `ReactionCanvasAppV2`, root shows `IndexApp` ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `IndexApp` landing page with card grid linking to V1 canvas, ghost-cursor demo, admin panel, and a Polis conversation example ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Storybook (react-vite) + Vitest setup with stories for all components (`CountdownTimer`, `StatementPanel`, `Canvas`, `TouchLayer`, `AdminPanel`, `Counter`) ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
  - `partysocket/react` mocked in Storybook to prevent live WebSocket connections
  - Countdown stories use `render` functions with fresh `Date.now()` so timers animate on canvas load
- `CLAUDE.md` documenting project architecture, routing, components, and URL params ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))

### Changed
- All canvases: reaction label strings stored in title-case; displayed uppercase via CSS (`text-transform: uppercase`) ([`85d189e`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/85d189e))
- Label presets: removed `yesno` and `supportive`; added `atomic` (Attracted/Repelled/Neutral) and `valence` (Positive/Negative/Neutral); all presets have hint text ([`89b7d95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/89b7d95))
- Internal terminology: `VoteState`/`VoteRegion` → `ReactionState`/`ReactionRegion`; values `agree/disagree/pass` → `positive/negative/neutral`; `ReactionLabelSet` properties renamed to match; CSS semantic classes renamed (e.g. `.vote-label-agree` → `.reaction-label-positive`); Polis API fields (`agree_count` etc.) unchanged ([`817c975`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/817c975))
- V4 help modal: label picker shows title-case values only (no machine key) ([`89b7d95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/89b7d95))
- V2 & V3: `?mobile=true` replaced by `?forceView=mobile` ([`03ce2f1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/03ce2f1))
- V3: new full-page reaction canvas variant (no video, no statements); supports `?room=`, `?labels=`, presence counter, blue-dot cursor, and mobile-only QR gate with `?forceView=mobile` override ([`03ce2f1`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/03ce2f1))
- V2: `?labels=` query param selects a reaction label preset; falls back to localStorage / default if omitted or unrecognised ([`89b7d95`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/89b7d95))
- V2: cursor room is now derived from `?videoId=` — each video gets its own cursor space automatically; `?room=` param removed from V2 (it remains a V1 concept) ([`9194bc5`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/9194bc5))
- Vote labels in both V1 and V2 now rendered from `getReactionLabelSet()` rather than hardcoded strings ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `.vote-label` CSS class now has `white-space: nowrap` so longer labels display on one line ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `npm run deploy` now runs `npm run cachebust` automatically before uploading; cachebust no longer runs during `npm run dev` ([`974f12f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/974f12f))
- `.index-app` is now scrollable on mobile (`overflow-y: auto`, `touch-action: pan-y`) without affecting the touch canvas apps ([`974f12f`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/974f12f))

### Fixed
- Mobile taps no longer leave the cursor stuck as a persistent touch; the root cause was the browser's synthesized `mousemove` (fired ~300ms after every tap) landing in `handleMouseMove` and starting the heartbeat with no corresponding `mouseleave` to clean up — now suppressed with a 500ms post-touch guard ([`93dc7d8`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/93dc7d8))
- V2: video no longer auto-resumes on page refresh when it was previously playing; the iframe's `onLoad` now re-sends `pauseVideo` on non-touch devices (mobile browsers block autoplay natively so the guard is not needed there and was causing the player to go black) ([`93dc7d8`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/93dc7d8))
- V2: `seekTo` (triggered by timecode sync on lift) no longer unintentionally starts playback; a `pauseVideo` is sent immediately after every seek when not all touching ([`eab0e1d`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/eab0e1d))
- Fix connection counter in V2 always showing zero; root cause was server-side presenceCount logic never having been committed/deployed ([`fd2e041`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/fd2e041))
- Back button broken by `replaceState` normalising `?room=default` into the history entry — default room is now used silently without touching the URL ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))

## Week 1 (2025-11-24)

### Added
- Ghost cursors: 10 simulated cursors wandering the canvas with simplex noise at rest and moving toward vote-zone hotspots ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- `?ghostCursors=true/false` URL param to set ghost cursor state on load; admin panel toggle to change it at runtime ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Cursors colored by their current vote zone (agree / disagree / pass) with a drawn border ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Separate `TouchLayer` component capturing mouse and touch events, decoupled from D3 animations in `Canvas` ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Polis API proxy on the PartyKit server: room names starting with a digit trigger a fetch from the Polis API to populate the statement pool; others load from a local `statements.<room>.json` file ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- WebSocket-based active statement delivery (replaced polling) ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Shared types in `app/types.ts` (`PolisStatement`, `QueueItem`, `Statement`) ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Moderated statements shown as disabled in the admin panel with visual indicator ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))

### Changed
- Statement queue ordering: next statement is scheduled 10 seconds after the *last queued* statement, not 10 seconds from now ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Admin panel timecode column removed ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))

## Week 0 (2025-11-17)

### Added
- Canvas MVP: real-time shared cursor positions over WebSockets via PartyKit, rendered as a D3 SVG layer with normalized (0–100) coordinates ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Rooms: `?room=` URL param selects a named PartyKit room; defaults to `"default"` ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Agree / Disagree / Pass vote zones with background color change as cursor moves between zones ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Barycentric coordinate calculation for vote-zone assignment — the zone with the highest barycentric weight wins, with no dead zones ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Vote state stored in refs during touch drag so state changes don't interrupt touch events ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Cursor removed from canvas on mouse leave or touch end ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Statement panel displaying the active Polis statement ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Admin panel for managing the statement queue: add, reorder, clear queue, end voting ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Vote submission to the PartyKit server (agree = 1, disagree = −1, pass = 0) ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Progress bar counting down to the next queued statement; visible even when no next statement is queued ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Special-cased end-voting pseudo-statement (ID −1): displayed without voting or countdown delay ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Cache-busting step in the deploy workflow for production builds ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- GitHub Pages and PartyKit deploy workflows ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))

### Fixed
- Vote state freeze during drag caused by state changes interrupting touch events ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Labels occasionally falling outside the screen on certain viewports ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
- Viewport sizing issues on iOS across multiple browsers ([`a12d540`](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/a12d540))
