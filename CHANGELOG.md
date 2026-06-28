# Changelog

All notable changes to this project will be documented in this file. Releases cut every Monday morning ET; each section header is `## Week N (YYYY-MM-DD)` where the date is the Monday that week starts on, and Week 0 = 2025-11-17.

**Format:** [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) — section types in order: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Weeks are reverse-chronological (newest week at top); bullets within each section are chronological (oldest bullet at top, newest at bottom — append new entries). One set of type sections per week; never create a second `### Added` or `### Changed` block within the same week.

**Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) — e.g. `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

## Week 32 (2026-06-29)

### Changed
- **PR preview deployments replaced with shared staging env** — per-PR preview, cleanup, and event-preview workflows disabled (broken upstream: partykit/partykit#985); new `staging-deploy.yml` deploys every PR to the shared `staging` preview environment instead. Staging is never torn down.

## Week 31 (2026-06-22)

### Added
- **Side-by-side demo pages** — new `/demos/` routes showing two panels in phone frames sharing one room: `/demos/admin-canvas`, `/demos/canvas-mood`, plus a `/demos/` index. Gated to wide screens (≥ 860px). Adds an opt-in `autoSize` prop to `Canvas` (sizes to parent instead of the window).

### Changed
- **Demo participant uses the real app component** — extracted the participant canvas out of `ReactionCanvasAppV4` into a shared `ReactionCanvasParticipant`, now rendered by both the app and the demos. The demo participant gains live-updating labels, label coloring on cursor move, the share-QR button (opening the real room), and spring cursor motion — previously missing from the hand-built demo view.
- **Share prompt callout on demo participant phones** — `PhoneFrame` gains a `showSharePrompt` boolean prop that renders a yellow callout badge ("↘ Click to join from your phone") over the phone frame, pointing at the share-QR button. Enabled on the participant phone in `DemoAdminCanvas` and `DemoCanvasMood`.
- **Share QR modal contained within demo phone frame** — `transform: translateZ(0)` on `.demo-phone-content` creates a new containing block for `position: fixed` descendants, trapping the share-QR modal inside the phone screen instead of covering the full viewport.
- **`pnpm dev` / `pnpm dev-https` no longer hang on exit** — switched from `trap`+`&` shell backgrounding to `concurrently --kill-others`, which properly terminates esbuild worker processes on Linux; use `Ctrl+C` to stop (interactive b/c/x keys from the partykit UI are no longer available).

## Week 29 (2026-06-08)

### Added
- **Whisper Gallery front page** — new product-style landing page component (`app/components/NewFrontPage.tsx`) with "Whisper Gallery" branding, typewriter room-name suggestions, participant/emcee open buttons, an Experiments section (YouTube Videos → V5, Sync'd YouTube Watch Party → V2) with YouTube URL input and label-preset style selector, and a More Prototypes footer; exposed via Storybook story at `Pages/NewFrontPage` only (does not replace the existing landing page).

### Fixed
- **V5 silent DB failure** — `#v5` now shows an amber warning banner ("Database unreachable — reactions are not being recorded. Contact admin") when the Supabase connection check fails on mount; previously failed silently with no visible feedback. Includes a `DatabaseUnreachable` Storybook story that injects a failing connection function to verify the banner renders.
- **Front page buttons: cmd+click / right-click** — "Participant View", "Emcee View", "Open Experiment", and "Admin" converted from `<button onClick>` to `<a href>` so the browser can open them in a new tab and the right-click context menu works.
- **SPA routing: direct navigation to room paths** — restored `singlePageApp: true` in `partykit.json` so paths like `/default` serve the app shell instead of "Not found"; removed the broken custom `onFetch` that replaced it (`.html` static pages in `public/` are served correctly by `singlePageApp` without special handling).

## Week 28 (2026-06-01)

### Added
- **CI: deploy to legacy URL** — production deploy now also pushes to `polislike-partykit-reaction-canvas.patcon.partykit.dev` (old app name) so previously-shared links continue to work after the rename to `whispering-gallery`.
- **Perf test CI workflow** — `deploy:perf` npm script and `.github/workflows/perf-test.yml` deploy to a persistent `perf` PartyKit preview and run the k6 load test suite (200 VUs, 30s) against `wss://perf.whispering-gallery.patcon.partykit.dev/parties/perf/perf-default`; triggered manually or on a daily schedule (skipped if no commits in 24h).
- **k6 load test improvements** — adds `cursor_delivery_ms` end-to-end latency metric (sender timestamp echoed back via `cursorBatch`), `connection_success` rate metric replacing the meaningless `ws_sessions` threshold, fixes `cursors_received` to count only cursor events (not `presenceCount` messages), staggered 18–22s VU close timer to avoid reconnect storms, and a `handleSummary` fanout ratio display.
- **ArrivalCanvas panel** — new patchable panel that turns arrivals into an audio-visual moment: the screen transitions black → white and a THX deep note synthesizes and converges to a D major chord as participants join. Emcee sets room capacity via a gear-icon config modal; count and capacity are displayed on screen. Includes a `SimulatingArrivals` Storybook story with a mock driver that steps through arrivals over 10 seconds.
- **Smooth cursor: avatar support** — smooth cursors now render DiceBear and custom photo avatars when an avatar style is selected in the emcee Avatars tab; DiceBear uses `?radius=50` for native circular rendering (no SVG clip paths); custom photos still use clip paths; falls back to a plain dot when no style is set.
- **`pnpm perf-100` script** — shorthand for `pnpm run perf --vus 100 --duration 30s`.
- **NeighborPanel** — new panel for building a live social graph of nearby audience members; participants see their own 4-digit code and enter neighbours' codes via an on-screen keypad; emcee can view a D3 force-directed map of all connections in real time ([#134](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/134))
- **Screen Light panel** — new canvas activity mode (`screen-light`) that turns a participant's phone into a full-screen colored light; color and brightness are controlled remotely by an admin running the Light Show panel; screen wake lock is on by default with a subtle toggle in the bottom-right corner.
- **Light Show panel** — new patchable controller panel (`light-show`) for setting the color (via presets + custom picker) and brightness (dimmer slider) of all connected Screen Light phones in real time.
- **Chromatic Storybook deploy** — GitHub Actions workflow publishes Storybook to Chromatic on every push; visual changes are auto-accepted so CI never blocks on review. ([#137](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/137))
- **Plugin architecture** — panels can now be developed as self-contained packages bundling component, config modal, and server logic. ([feat/pluggable-panel-architecture](https://github.com/patcon/polislike-partykit-reaction-canvas/compare/main...feat/pluggable-panel-architecture))
- **`helloWorld` example plugin** — minimal reference implementation with step-by-step authoring guide in `plugins/README.md`. ([c569167](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c569167))

### Changed
- **Perf test CI: add `party` and `room` inputs** — `workflow_dispatch` now accepts a `party` dropdown (`perf`/`main`, default `perf`) and a `room` text field (default `default`); WS URL is constructed dynamically from these inputs. Renames the hard-coded `perf-default` room to `default` throughout the k6 script, `perf:remote` npm script, and `PerfCanvasApp`.
- **NeighborPanel graph view** — nodes are now coloured by live reaction-canvas valence (green/red/yellow) using the same `computeReactionRegion` logic as other projection maps; grey for users with no cursor data yet; no special "you are here" highlight for own node.
- **NeighborPanel graph view** — new nodes spawn at SVG centre instead of top-left; removed tick-handler coordinate clamping so dragging works correctly when graph is rotated.
- **Greeter migrated to plugin** — establishes the persisted-state pattern for future panel migrations.
- **Plugin config modals self-contained** — config modals send/receive via `useAdminSocket()` directly; admin panel renders all plugin modals generically. ([70a5ea4](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/70a5ea4))
- **Plugins auto-register in Interfaces tab** — adding a plugin to `plugins/index.ts` is sufficient for it to appear; no other changes needed. ([c569167](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/c569167))
- **Rename modal CSS classes** — `github-modal-*` → `app-modal-*` for the shared modal system.
- **Image Canvas migrated to plugin** — introduces `CanvasOverlay` API for canvas-mode activities that configure the canvas rather than replacing it.
- **Extract `makeImageCoordTransform` utility** — letterbox coordinate math moved from Canvas.tsx into `app/utils/imageCanvasCoords.ts`, removing the duplication between the smooth-cursor RAF tick and the actual-cursor drawing effect; 16 Vitest unit tests added covering linear fallback, pillarbox, letterbox, centre mapping, and out-of-bounds clamping.
- **Screen Light + Light Show migrated to plugin** — introduces multi-panel plugin packages: both panels live in `plugins/light/` and are enabled independently. The `screen-light` plugin owns `lightColor` server state (persisted); `light-show` is client-only. Because the plugin router calls all plugins' `onMessage` for every message, `setLightColor` is now a general-purpose server event — any future panel can send it without additional routing plumbing.
- **Map Maker + Map Viewer migrated to plugin** — both panels packaged as `plugins/map/`; `mapProjection` server state and message handling moved from core `party/server.ts` into the plugin's `ServerPlugin`; `MapViewerConfig` (color mode, moment selector) moved from React context into a localStorage-backed hook (`plugins/map/useMapViewerConfig.ts`) with window-event reactivity, removing the config from core entirely.
- **`/debug-state` server endpoint** — `GET /parties/main/:room/debug-state` returns the raw persisted storage state plus live in-memory plugin states as JSON; `DELETE` clears persisted storage.
- **Remaining simple panels migrated to plugin** — `mood-tones`, `treevites`, `valence-beat-pad` (client-only), plus `social-sharing` and `arrival-canvas` (with server state + config modals) now live in `plugins/` and self-register via `plugins/index.ts`; their hard-coded `PANEL_REGISTRY` rows, `PANEL_COMPONENTS` entries, direct imports, and bespoke `party/server.ts` / `useRoomConfig` plumbing are removed. Social config and arrival capacity now persist under each plugin's `pluginStates` slice (instead of top-level `roomSocialConfig` / `arrivalCapacity`), so existing rooms reset these to defaults on first load after deploy. Setting arrival capacity is no longer admin-gated on the server, consistent with the other migrated plugins. Also removes two stale duplicate `map-maker` / `map-viewer` registry rows that shadowed the map plugin. Server-plugin unit tests added for both.
- **Signature Canvas migrated to plugin** — `plugins/signatureCanvas/` is now a self-contained plugin; `strokeSegment` and `clearSignature` server routing removed from core `party/server.ts`; `signatureStrokes` state, `isPresenter` state, and all `activity === 'signature'` render blocks removed from `ReactionCanvasAppV4`; the two-mode UI (participant drawing vs. presenter grid) lives entirely inside the plugin component.
- **Plugin API: `onRequest?` hook** — `ServerPlugin<S>` now supports an optional `onRequest?(request, ctx, state)` method; the main server delegates every HTTP request to plugins before its own switch, returning the first non-null `Response`; enables plugins that need REST endpoints (e.g. large-payload uploads).
- **Steno + Story Tracer migrated to `narrative` plugin** — both panels moved into `plugins/narrative/` as two plugins sharing one folder (`[stenoPlugin, storyTracerPlugin]`); all Steno and StoryTracer state, message handlers, and the `storyTracerSetPoints` HTTP endpoint removed from core `party/server.ts`; `StoryTracerPoint`/`StoryTracerMeta` types moved into `plugins/narrative/types.ts`; `storyTracerUtils.ts` and `useEmbeddingWorker.ts` relocated into the plugin; `ActivityMode` entries and URL params (`?interface=steno`, `?interface=story-tracer`) are unchanged; lock release on disconnect moved into the steno plugin's `onClose` hook.
- **Plugin-owned React contexts** — `SocialMediaConfigProvider`/`useSocialMediaConfig` moved into `plugins/socialSharing/context.ts`; `ImageCanvasConfigProvider`/`useImageCanvasConfig` moved into `plugins/imageCanvas/context.ts`; `app/context/PanelConfigs.tsx` deleted. A TODO in `ReactionCanvasAppV4` marks the remaining step of making provider wiring generic via a `PanelPlugin.provider` field.
- **VoiceCall migrated to plugin** — `plugins/voiceCall/` is now a self-contained plugin; `callQueue`, `callPairs`, `callAlgorithm` state and all call-related message handlers removed from core `party/server.ts`; call-queue cleanup on disconnect moved into the plugin's `onClose` hook; `PluginContext` gains `sendToUser(userId, msg)` for targeted delivery (used by WebRTC signalling relay and hang-up notifications); `callAlgorithm` admin config modal now self-contained via `useAdminSocket()`; `WebRTCOfferEvent` / `HangUpCallEvent` etc. types moved from `party/types.ts` into `plugins/voiceCall/types.ts`. All plugin server tests consolidated to use `makeCtx` / `makeConn` from shared `plugins/testHelpers.ts`. ([feat/pluggable-panel-architecture](https://github.com/patcon/polislike-partykit-reaction-canvas/compare/main...feat/pluggable-panel-architecture))

### Fixed
- **Smooth cursor: tune damping to 0.5** — reduces trailing lag while keeping motion smooth.
- **Smooth cursor: add black stroke for contrast** — smooth cursors now render with `stroke: #000000 / stroke-width: 2` matching actual cursors; playback cursors get the same lighter dashed stroke.
- **Smooth cursor styling and terminology** — renames `spring*` → `smooth*` / `hideCursors` → `hideActualCursors` throughout Canvas, PerfCanvasApp, V4, V5, and `cursor.ts`; smooth cursors now render with the same color and radius as actual cursors (vote-based coloring, default color, avatar radius); actual cursors are hidden in V4 when smooth cursor is enabled.
- **Spring cursor in main app** — `SPRING_CURSOR_ENABLED` and `SPRING_CONFIG` constants added to `app/utils/cursor.ts`; V4 canvas now uses spring smoothing by default; PerfCanvasApp slider defaults updated to match.
- **Add `DEBUG=true` msg-rate logging to server** — when `DEBUG=true` is set in `.env`, the server logs incoming message rate every second as both msg/s and avg ms between messages; adds `.env.example` documenting all local env vars.
- **Standardize cursor send rate to 33ms (~30fps)** — adds `CURSOR_THROTTLE_MS = 33` in `app/utils/cursor.ts` as the single source of truth; `TouchLayer` now defaults to it (was unthrottled), `PerfCanvasApp` uses it when adaptive throttle is off (was also unthrottled), adaptive throttle base slider defaults to it (was 50ms), and the k6 load test mirrors it with a comment.
- **Perf test CI: install k6 before running** — adds `grafana/setup-k6-action@v1` step so k6 is available on the runner; previously the `run-k6-action` step failed with `spawn k6 ENOENT`.
- **k6 load test: migrate from `k6/ws` to `k6/websockets`** — uses the modern global-event-loop module (browser-standard WebSocket API) which supports concurrent connections per VU; replaces socket-scoped `setInterval`/`setTimeout` with globals and tracks connection success via `onopen`/`onclose` instead of checking the response status.
- **k6 load test: revert from k6/websockets back to k6/ws** — `k6/websockets` global event loop runs for the entire VU lifetime so iterations never complete and the test never terminates; `k6/ws` blocks the VU inside `ws.connect()` until the socket closes, giving clean per-iteration lifecycle; socket-scoped `socket.setInterval/setTimeout` work correctly within the connect callback so there was no reason to migrate in the first place.
- **NeighborPanel graph** — "node not found" crash (and resulting WSOD) when a link referenced a user ID missing from the nodes array due to server/timing inconsistency; D3 link mutation also caused the same crash on second map open; both resolved by normalising and filtering links in `freshLinks()` before passing to any simulation.
- **NeighborPanel graph** — nodes now appear/disappear in real time: `userJoined` adds a dot immediately (no need to leave and re-open the graph); `userLeft` removes the dot and any associated edges; `neighborEdgesCleared` also clears all dots; `neighborEdgeAdded` now drives ref updates + `restartSim` directly instead of the unreliable live-patch path.
- **NeighborPanel graph** — joining users and their prior edges now merge into the live simulation without resetting it; `userJoined` adds the node directly via `addNodeLive`; the subsequent snapshot response merges new nodes/edges incrementally (`addEdgeLive`-style, no flash); `restartSim` is only called on initial graph open or full clears.
- **NeighborPanel graph view** — added ↺ refresh button to re-randomise the force layout; added ±180° rotation slider beside the flip buttons; removed active-state highlighting from flip buttons since orientation has no canonical "true" state.
- **Image canvas: restore cursor coordinate remapping for smooth cursors** — smooth cursor RAF tick was mapping 0–100 coords to raw screen pixels, ignoring the letterbox transform; cursors now spring toward the correct image-relative position on all screen sizes, and edge-clamping is preserved.
- **Soccer config modal** — modal was invisible and contents floated in the bottom-left corner because `SoccerConfigModal` still used the removed `github-modal-*` CSS classes; updated to `app-modal-*`.
- **Map Viewer: × button deletes current projection** — previously cleared all history except the current entry; now removes only the viewed projection and advances the index to the next one (or steps back if it was the last).
- **Map Maker: persist algorithm settings to localStorage** — algorithm choice, standard params, advanced params, KNN backend, and KNN params are restored when returning to the panel.
- **Map Viewer: persist projection history to localStorage** — history ring buffer (up to 5 entries), current index, and per-entry flip states survive panel switches and page refreshes; duplicate-detection on reconnect prevents double-entries.

## Week 27 (2026-05-25)

### Added
- **MapViewerPanel: moment pagination** — ‹ › arrows and an x/y counter appear beside the moment label in the header when colour mode is "Valence: Moments", letting you step through all stored moments without opening settings; resets to the configured moment when the settings change.
- **MapViewerPanel: clear history button** — × button beside the nav arrows discards older projections, keeping only the current one; disabled when history has only one entry.
- **MapViewerPanel: projection history navigation** — ‹ › buttons in the bottom-left let you step back and forward through the last 5 projections received; each entry remembers its own flip state, and navigating between them animates the dots smoothly.
- **MapViewerPanel: flip H/V buttons** — two toggle buttons in the bottom-left corner of the scatter plot let you mirror the map horizontally (↔) or vertically (↕); active state is highlighted in green; flips reset and animate smoothly when a new projection arrives (flip is encoded in D3 scale ranges so transitions stay continuous). — two toggle buttons in the bottom-left corner of the scatter plot let you mirror the map horizontally (↔) or vertically (↕); active state is highlighted in green.
- **MapViewerPanel: animate dot positions** — scatter plot dots now smoothly transition to their new coordinates (400 ms) when a new projection is pushed; entering dots snap into position immediately.
- **MapViewerPanel: Valence: Now color mode** — new live coloring option in the Map Viewer config modal; colors each participant dot by their current reaction in real time (green=agree, red=disagree, yellow=pass, gray=idle/not touching, dark gray=offline). Dots return to idle after 3 s with no cursor activity. Existing "Moment" mode renamed to "Valence: Moments".
- **MapViewerPanel: color-by-moment** — gear icon in Interfaces tab opens a config modal; choose "None" (uniform dots) or "Valence: Moments" (select a moment to color participants by their vote: green=agree, red=disagree, yellow=pass, gray=missing). Active moment name and color legend shown in the panel header.
- **MapMakerPanel: advanced settings** — collapsible Advanced section exposes algorithm-specific tuning params (epochs, seed, learning rate, repulsion strength, etc.) and KNN backend options (Annoy / HNSW with their own param sliders) for PaCMAP and LocalMAP algorithms; backend selection and params are wired through to the reduction worker.
- **MapMakerPanel** — new emcee-facing interface that reads moment data (including Polis CSV imports), builds a sparse participant × moment vote matrix, mean-imputes missing values, and reduces it to 2D using UMAP, PaCMAP, or LocalMAP (via reddwarf-ts). The reduction runs in a dedicated esbuild Web Worker (`druidWorker.ts`) to keep the UI responsive. Progress bar updates every 10 iterations. On completion, the 2D projection is broadcast to all connected clients via server state.
- **MapViewerPanel** — participant-facing interface that receives the computed projection from server state and renders a minimal D3 scatter plot (zoom/pan supported). Shows a placeholder when no projection has been computed yet. Both panels appear in the Interfaces tab and OfferInterfaceModal.
- **ReactionCanvas Storybook stories** — two stories (`Interactive`, `Recorder`) under `Canvas/ReactionCanvas` let you try the voting canvas outside the full app; `Recorder` captures cursor events via `onCursorEvent` and displays copyable JSON fixture data for use in future stories.
- **ValenceBeatPadPanel** — new V4 interface panel: a 4×4 musical pad whose valence (scale/timbre/reverb) is driven by audience cursor positions when audience sync is on. Supports keyboard play (`7890 / uiop / jkl; / m,./`), auto-oscillating valence, chord detection (up to 6 diatonic chords from anchor pad), a chord-chip strip above the grid for touch-based chord activation, and manual chord saving via multi-touch. No instructional text on mobile — chips are the sole chord affordance.
- **`shortLabel` on `PanelMeta`** — optional field used in the interface chip bar when a shorter display name is desired; `ValenceBeatPadPanel` uses `shortLabel: 'Beat Pad'`.
- **Fakeable Storybook socket mock** — `.storybook/mocks/partysocket-react.ts` now subscribes to a shared message bus; stories can call `emitToRoom(room, data)` from their `play` functions to push fake socket messages into components. `MoodTonesPanel` migrated from a hand-rolled `WebSocket` to `usePartySocket` so it benefits from the same mock. `MapViewerPanel`'s `initialProjection` prop (a Storybook-only hack) removed; its `WithGaussianBlob` story now drives projection via `emitToRoom`. New `OscillatingAudienceMood` story for `MoodTonesPanel` shows the mood slider animating from simulated audience cursor positions. Closes [#123](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/123).

### Changed
- **Unified panel rendering** — the 18-branch conditional render in `ReactionCanvasAppV4` replaced by a `PANEL_COMPONENTS` map; chip-based and activity-based paths unified into a single derived `activePanelId`; canvas visibility check simplified from a long `activity !== X` chain to `!PANEL_COMPONENTS[activity]`.
- **PanelDefinition type** — `app/panelRegistry.ts` now exports `PanelDefinition` extending `PanelMeta` with a `component: React.ComponentType` field; `inviteEdges` added to `PanelContextValue` and `TreevitesPanel` migrated to context, making all nine non-emcee panels fully prop-free and typeable as `PanelDefinition`.
- **PanelConfigs contexts** — `greeterConfig`, `socialMediaConfig`, and `mapViewerConfig` now injected via panel-specific React contexts (`app/context/PanelConfigs.tsx`); `GreeterPanel`, `SocialMediaPanel`, and `MapViewerPanel` migrated to `useGreeterConfig()`, `useSocialMediaConfig()`, and `useMapViewerConfig()` respectively. All nine non-emcee panels are now prop-free.
- **PanelContext** — `room` and `userId` are now injected via React context (`app/context/PanelContext.tsx`) rather than props; six panels (`MoodTonesPanel`, `StenoPanel`, `StoryTracerPanel`, `VoiceCallPanel`, `MapMakerPanel`, `MapViewerPanel`) migrated to `usePanelContext()`. Foundation for panel package extraction.
- **Panel registry** — introduced `app/panelRegistry.ts` as a single source of truth for all panel metadata (id, label, description, patchable, activityMode); `KNOWN_CHIPS` in `ReactionCanvasAppV4`, `ROWS` in `InterfacesTab`, and the hardcoded `<option>` list in `OfferInterfaceModal` now all derive from this registry. Adding a new panel no longer requires edits in three separate files.
- **Social sharing panel id renamed** — activity/interface key changed from `'social'` → `'social-media'` → `'social-sharing'` to match its label. Affects URL `addInterface` param, localStorage interface lists, and emcee push messages. Old values stored in localStorage will silently fall back to the canvas interface on next load.

### Fixed
- **CI: preview-cleanup workflow node-version bumped to 22** — `pnpm` now requires Node ≥22.13; the delete-preview job was pinned to Node 18, causing it to fail silently after every PR merge. ([57cdd01](https://github.com/patcon/polislike-partykit-reaction-canvas/commit/57cdd01))
- **OfferInterfaceModal: show panel labels in dropdown** — the interface selector now shows human-readable labels (e.g. "Social Sharing") instead of internal IDs (e.g. "social-media").
- **VoiceCallPanel: fix WSOD on HTTP LAN** — guard `navigator.mediaDevices` before using the `in` operator; `mediaDevices` is `undefined` in insecure contexts (HTTP non-localhost), which caused a crash on render.
- **InterfacesTab: warn when mic unavailable** — Voice calls and Steno rows now show an ⚠ SSL required badge when `navigator.mediaDevices` is unavailable (HTTP non-localhost), so emcees know those interfaces won't work without HTTPS.
- **Moments: migrate storage from localStorage to IndexedDB** — importing large Polis CSVs no longer throws `QuotaExceededError`; moments are now stored in IndexedDB (no practical size limit) via a new `app/utils/idbStorage.ts` helper.
- **ValenceBeatPadPanel: ghost tick on valence slider when pads held**
- **`computeCursorValence` shared utility** — extracted barycentric cursor-to-valence calculation into `app/utils/voteRegion.ts`; `MoodTonesPanel` and `ValenceBeatPadPanel` now both use it, removing three copies of the logic. Also fixes `ValenceBeatPadPanel` mapping Pass/neutral cursors to ~0 instead of 50. — a small white marker overlays the slider track at the locked valence position while any pad is pressed.
- **ValenceBeatPadPanel: freeze audio/chord to valence at first press** — note frequency, timbre, reverb, and chord detection all lock to the valence captured when the anchor pad is pressed; `getPlayValence()` is the single toggle point.
- **ValenceBeatPadPanel: freeze pad colour/scale to valence at first press** — pad background, text colour, and note names now lock to the valence value captured when the anchor pad is pressed and release when all pads are lifted.
- **ValenceBeatPadPanel: highlight chord chip when manually holding all its notes** — assembling a chord by holding its pads one by one now auto-highlights the matching chip; releasing a note un-highlights it.
- **ValenceBeatPadPanel: stable stat box height** — stat labels (scale/timbre/reverb) now use `white-space: nowrap` + ellipsis so boxes never resize when text changes as valence shifts.
- **ValenceBeatPadPanel: disable oscillate controls when audience sync is on** — the oscillate row is now dimmed and non-interactive while audience sync is enabled; enabling audience sync also stops any active oscillation.

## Week 26 (2026-05-18)

### Added
- **Moments: import Polis CSV exports** — load a `*comments.csv` and `*votes.csv` from a Polis export to generate synthetic Moments in the emcee Moments tab. Each comment becomes a Moment (labeled with the comment body); votes are mapped onto People-tab participants by randomly assigning the most-participatory Polis voters to seen users. ([#103](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/103))
- **PhonePanel: wake lock during calls** — screen stays on as soon as a user joins the queue and releases on hang up. A small "screen on" indicator appears while active.
- **PhonePanel: Media Session API** — lock-screen call card with title and hang-up action on iOS 15+; hardware buttons (headphone remote, AirPods, Bluetooth) can hang up the call. Android notification not yet working ([#112](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/112)).
- **Refactor: `useWakeLock` hook** — extracted into `app/utils/useWakeLock.ts`; `StenoPanel` and `ReactionCanvasAppV4` now use it instead of inline acquire/release logic.
- **Voice calls panel** — a new V4 interface for peer-to-peer audio calls over WebRTC. Participants tap "Accept Call" to join a queue; the next person to tap is instantly connected. Signaling (offer/answer/ICE) flows through PartyKit; audio is peer-to-peer with no central server. Features: mute toggle, hang-up button, call duration timer, and familiar phone affordances. Emcee can configure the **Matching Mode** (currently "First Available" / FIFO) via a settings dialog in the Interfaces tab. Unlock via `?interface=phone` or push to participants from the emcee panel.
- **Story Tracer: live 3D preview and replay during reducer iterations** — the 3D plot animates in real-time as dimensionality reduction runs, showing each intermediate layout as the algorithm converges. After the run (or cancel), a play/pause button and scrub slider let you replay the full optimization journey frame-by-frame. Works for all backends (umap-js, umap-druid, PaCMAP, LocalMAP).
- **Story Tracer: cache embeddings with resume support** — raw embedding vectors are cached per-chunk in-memory and in IndexedDB. Re-running with different reducer params skips embedding entirely. Cancelling mid-run and re-running resumes from where it left off — only un-cached chunks are re-embedded. ([#96](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/96))

### Changed
- **Event preview workflow: health check before posting URL** — after deploy, the workflow polls the preview URL with Fibonacci backoff (1, 1, 2, 3, 5, 8, 13, 21, 34, 55s — up to ~2m20s total) and only posts the "deployed" comment once it returns 200. Fails the job if it never comes up.

### Fixed
- **Greeter: guild event URL survives server restarts** — `greeterConfig` (including the event URL) is now included in `PersistedState` and written to PartyKit durable storage alongside other room config; previously it was lost on every restart.

## Week 25 (2026-05-11)

### Added
- **Yes / No / Maybe label preset** — added a new `yes` reaction label preset (Yes / No / Maybe) available in the emcee Labels tab.
- **Story Tracer: reducer algorithm selector + parameter controls** — choose between four dimensionality reduction algorithms via a new dropdown in the Story Tracer settings: UMAP (umap-js, default), UMAP (DruidJS), LocalMAP, and PaCMAP. Per-algorithm parameter inputs appear below the selector (e.g. neighbors, min dist, spread for UMAP; MN/FP ratio and low-dist threshold for PaCMAP/LocalMAP; epochs with auto-calculation for DruidJS UMAP). The selected algorithm is persisted to localStorage and stored alongside the computed points' metadata. All algorithms run inside the existing Web Worker. ([#94](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/94))
- **Story Tracer panel** — a new V4 interface that takes the current Steno VTT transcript and processes it into a 3D semantic narrative path using text embeddings + UMAP. Unlock via `?interface=story-tracer`. Features: model selection (MiniLM-L6/L12, MPNet, Multilingual MiniLM), sliding window chunking (configurable size + overlap), progress bars for model download / embedding / UMAP reduction, cancel and rerun support, server-persisted 3D points (with approximate wall-clock timestamps from VTT cues), and an expandable preview of the text segments before running.
- **Story Tracer: 3D narrative path viewer** — after computing, a Three.js scene renders the narrative path as a green→red gradient line (green = start, red = end) with orbit/zoom controls. The viewer fills the panel above the Rerun/Clear controls.
- **Steno: VTT transcript format** — the Steno panel now stores transcriptions as WebVTT with absolute ISO 8601 wall-clock timestamps (e.g. `2026-05-09T14:30:05Z --> 2026-05-09T14:30:08Z`) so cues are independently timestamped without relative-offset math. A VTT / Plaintext toggle switches between the editable raw VTT view and a read-only concatenated text view.
- **Steno interface** — a new V4 interface for live shared speech-to-text transcription. Unlock via `?interface=steno`, or push it to participants via the Emcee → Participants tab. Features: streaming Web Speech API (`continuous` mode with interim-text preview), a single-user recording mutex (one person transcribes at a time), server-persisted transcript shared live to all connected participants, Wake Lock while recording, and editable textarea (read-only for observers while another user holds the lock). ([#85](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/85))
- Canvas settings modal: **Valence Input tab** — emcee can now switch participants between four input modes ([#82](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/82)):
  - **Touch** (default) — finger position on canvas
  - **Orientation (Horizontal)** — phone face-up = agree, face-down = disagree; works for any flip direction or combination (`cos β · cos γ`)
  - **Orientation (Vertical)** — phone upright = agree, flat = pass, upside-down = disagree (`sin β`)
  - **Orientation (Rotation)** — steering-wheel from landscape: rotate right toward portrait = agree, rotate left toward upside-down = disagree (`cos(atan2(γ, β))`)
- In orientation modes the cursor travels through the triangle centroid (barycentric centre) rather than along the edges, giving a direct disagree → centre → agree path.
- Orientation modes require HTTPS; blocked by Chrome on plain HTTP LAN. iOS prompts for `DeviceOrientationEvent` permission on first tap; Android and other platforms require no permission.
- `pnpm dev-https` script — runs `partykit dev --live --https` for local HTTPS testing of orientation APIs on LAN devices.
- **Wake lock indicator** — a screen-lock toggle button appears below the vibration icon whenever an orientation valence mode is active. Tap to keep the screen awake during orientation-based sessions; the lock icon (`MdScreenLockLandscape`) shows when held, the screen icon (`MdSmartScreen`) shows when off. The lock is released and hidden automatically when switching back to touch mode. ([#84](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/84))

### Changed
- **Interface assignment via `?addInterface=`** — admin QR codes in the Interfaces tab now use `?addInterface=<name>` instead of `?interface=<name>`. Scanning the QR stores the interface in localStorage immediately and strips the param from the URL. The active interface is reflected live in `?interface=` (updated on every tab switch via `replaceState`, no history entries). The active interface is also persisted to localStorage and restored on reload. `?interface=emcee` still grants emcee access directly from a URL; all other patchable interfaces are localStorage-only (making admin "Clear all role assignments" reliably effective). Old-style `?interface=social` / `?interface=steno` etc. links no longer unlock those panels.
- **Renamed PartyKit deployment** — URL changed from `polislike-partykit-reaction-canvas.patcon.partykit.dev` to `whispering-gallery.patcon.partykit.dev`. The slug is now defined only in `partykit.json`; standalone HTML pages derive the host from `window.location` and the CI preview workflow reads it from `partykit.json` at runtime.
- **Interfaces tab** — renamed from "Interface" to "Interfaces"; added Emcee row at the top with a shareable patch URL so emcee access can be granted without a push.
- **Interfaces tab: Solo column** — replaced radio inputs with `FaCheckCircle` / `FaCircle` icon buttons; clicking the icon is the only way to select (row label no longer acts as a click target).
- **Batsignal: Fibonacci-milestone notifications** — instead of a single notification when 3 unique users have ever visited, the batsignal now tracks max concurrent participants and fires at each Fibonacci milestone (3, 5, 8, 13, 21, …). The Telegram message now includes the actual count (e.g. "👀 5 devices in the reaction canvas"). State resets on server restart. Batsignal Telegram credentials are now also pushed to PR preview and event-preview deployments during CI, so the signal fires in those environments too. ([#98](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/98))

### Fixed
- **QR codes are now right-click saveable as images** — switched from `QRCodeSVG` to `QRCodeCanvas` throughout; canvas elements support "Save image as" in all browsers.
- **CI deploy** — added `esbuild` as a direct `devDependency` so the `build:worker` script can find the binary in CI (it was only a transitive dep through vite/storybook, which isn't guaranteed to land in PATH).
- **Steno: max 5-second segment duration** — VTT cues are now force-flushed after 5 seconds of continuous speech even if no natural pause is detected, preventing ~60-second monolithic chunks in rapid panel discussions where speakers don't pause between turns.
- Haptic feedback now works immediately on Android without needing to toggle the icon off and on; the icon starts dim and lights up on first touch as the Vibration API is primed. If the first touch lands on the icon itself it activates rather than toggling off. ([#84](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/84))
- Changing valence input mode now triggers a haptic buzz, matching the existing behaviour for label and activity changes. ([#84](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/84))
- WebSocket connections now use `wss://` when the page is served over HTTPS, preventing mixed-content errors on LAN addresses (`192.168.x.x`). Extracted shared `getPartySocketConfig()` utility (`app/utils/partyHost.ts`) used by all six socket-holding components. ([#82](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/82))
- Standalone HTML pages (`mood-sounds.html`, `valence-onboarding-v2.html`, `valence-onboarding-v3.html`) now derive the WebSocket scheme from `window.location.protocol` rather than hostname/port heuristics, fixing `ws://` mixed-content errors when accessed over HTTPS on LAN addresses.
- `getPartySocketConfig()` now uses `window.location.protocol` instead of `window.isSecureContext` to pick `ws` vs `wss`, fixing WebSocket failures on `http://localhost:1999` and `http://127.0.0.1:1999` (browsers treat loopback as a secure context even over plain HTTP, so `isSecureContext` was incorrectly returning `wss://` for the plain HTTP dev server).
- **Labels tab: custom fields pre-filled on load** — switching to a preset radio now pre-fills the Custom fields even when the selection is restored from the server on arrival, not just on explicit click.

## Week 24 (2026-05-04)

### Added
- Add `valence-onboarding-v3.html` with a new **Particle** geometry mode: all chords become physics-driven particles that cluster around a fixed central speaker ("S") point using a configurable per-group force matrix, with 3D time-depth trail support and disabled chord-mode controls.
- `valence-onboarding-v3.html`: switching into particle mode now transitions cursors from their current geometry positions instead of spawning at random locations.
- Greeter: **Attendee QR popup** — clicking any attendee row shows a popup with a QR code that pre-fills `?customPhoto=` with their Guild profile photo URL. The admin shows this to the arriving attendee to scan.
- Greeter: **Gravatar fallback** — attendee photos now use Guild primary photo → Gravatar (via `emailMd5`) → Guild default avatar, in that priority order. Popup shows "photo set via Guild.host" or "photo set via Gravatar" when applicable.
- Greeter: **Event title links to Guild.host** — the event name in the header is a link to the event page (or group page in group mode).
- Avatar tab: **Custom (e.g., Guild)** avatar mode — when selected, participants who have scanned a greeter QR code show their real photo on everyone's canvas; unregistered participants fall back to a colored dot.
- Avatar tab: **Highlight valence** checkbox — when enabled, cursor dots and avatar borders cycle through reaction colors; when off, they use a configurable default color (default: off, `#d4d4d4`).
- Avatar tab: **Default color picker** — choose the default cursor/avatar border color shown when valence highlight is off.
- Canvas: `disableCursorValence` and `disableBackgroundValence` props — image-canvas mode now suppresses both cursor valence coloring and background color changes.
- Canvas settings modal: **Display own valence via** — radio group (Background / Labels / None) controls how a participant's own reaction region is shown: canvas background color shift, a subtle highlight on the matching label, or no visual feedback. Default: Labels.
- Server: `registerCustomAvatar`, `setColorCursorsByVote`, `setDefaultCursorColor`, `setOwnValenceDisplay` messages; all settings are broadcast and included in the `connected` payload.

### Fixed
- Greeter quiz: Gravatar users now appear in the deck when "Hide default avatars" is on, but only after their Gravatar is eagerly verified on attendee load (users with no real Gravatar are excluded).
- Signature layer: darkened Clear and Rotate button backgrounds for accessible contrast against the grey overlay.
- Signature activity: **mode toggle button** in the top-right — flips between signing mode and presenter view without needing the `?presenter=true` URL param.
- Signature layer: add top/bottom padding so the signing box and buttons never overflow onto the chip bar on wide/short desktop viewports.
- Signature presenter grid: only show a tile for users who have drawn at least one stroke.
- Removed `?presenter=true` URL param — presenter mode is now toggled via the in-UI mode button.
- Signature mode button: shifted right to clear the rotate button in pseudo-landscape signing mode.
- Interfaces tab: renamed "Signature" to "Signature Canvas" and moved to 3rd position.

## Week 23 (2026-04-27)

### Added
- All QR displays: **copy-to-clipboard button** beside the URL text — one tap copies the URL with a 2-second checkmark confirmation; falls back to `execCommand` for iOS Safari / HTTP contexts.
- V4 canvas QR popup: **Share / Scan tab switcher** — Share tab shows the existing QR code and copy button; Scan tab opens the device camera to scan a QR code and navigate to the scanned URL in-place. Camera permission is requested lazily when the Scan tab is opened and released on close.
- Server: **persistent social config** — `roomSocialConfig` is now saved to PartyKit durable storage and restored on worker restart. Opt out per deployment with `DISABLE_STORAGE_PERSISTENCE=true`.
- Greeter config modal now pre-fills with `https://guild.host/civic-tech-toronto` when no config is set.

### Fixed
- V4: admin-triggered popups (interface offer, GitHub username, feedback stars, haptic modal) now appear for participants even when they are viewing a non-canvas interface (Social, Greeter, etc.) — modals were previously hidden because they rendered inside a `display: none` canvas container.
- V4: stray haptic buzz no longer fires when a tab wakes from sleep or the server restarts — the `connected` re-sync no longer routes through `onActivityChange`; only genuine `activityChanged` events from the server trigger a buzz.

### Added
- Greeter Quiz: **Reversed mode** — a "Reversed" checkbox flips which side is the prompt vs. the answer (name → photo for Image/Name; first name → last name for Last/First). Progress is tracked separately for each direction, so memorizing forward does not count as memorizing reversed.
- Greeter Quiz: **Hide default avatars on by default** — the "Hide default avatars" filter now starts enabled so initials-only photos are excluded from the image deck without manual toggling.
- Greeter: **Quiz Yourself** — spaced-repetition flashcard quiz launched from a button at the bottom of the attendee list. Two modes: Image → Name (photo on front, full name revealed on back) and Last → First (last name on front, first name revealed). Three answer buttons mirror Anki's learning flow — **Again** re-queues the card after ~3 cards, **Hard** sends it to the end of the round, **Good** memorizes it for the entire browser session (cross-event). A "Hide default avatars" toggle excludes initials-only photos from the image deck. Progress indicator shows remaining / total.
- V4: new **Greeter** interface — emcee configures a Guild event or group URL in the Interfaces tab; the panel fetches and displays attendees (photo + name) from the Guild GraphQL API with in-person/online/all filter, first/last name sort, and ← → event navigation. Defaults to the current day's event until midnight. Patchable via QR and pushable to participants from the People tab. ([#73](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/73))
- Server: **Brigade Bat-Signal** — when a room's participant count crosses 3, a Telegram message is sent to a configured group with a direct link to the room. Fires on every upward crossing (intentionally noisy). Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` PartyKit secrets; silent no-op if absent. Closes [#23](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/23). ([#72](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/72))

### Added
- V4: new **Leaderboard** interface — invite-tree leaderboard showing downstream invite counts. Every shareable QR carries an invite chain so the tree builds passively; the leaderboard UI is only shown to participants issued the interface via the People tab or the Interfaces "Share" QR. Closes [#68](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/68). ([#69](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/69))
- CI: PR preview deployments now report a GitHub Deployment status, so the PR header shows "This branch was successfully deployed" with a direct link to the preview environment. ([#69](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/69))

### Fixed
- V4 Leaderboard: selecting Leaderboard as the Solo interface from the Interfaces tab now correctly shows the leaderboard instead of the canvas. ([#69](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/69))
- V4 Leaderboard: `?inviteChain` URL param is stripped after being read into localStorage, preventing accidental sharing of the raw invite chain. ([#69](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/69))
- V4 Leaderboard: stored invite chain now takes priority over any `?inviteChain` URL param — once a parent is established, rescanning a different QR code cannot reassign parentage, preserving tree integrity across server restarts. ([#69](https://github.com/patcon/polislike-partykit-reaction-canvas/pull/69))

### Fixed
- V4 mood-tones: WebSocket no longer hardcodes the production PartyKit host — derives host from `window.location` so preview deployments connect to their own server instead of prod

### Added
- Event preview deployment: open an issue with the `event-preview` label to spin up a stealth preview on a secondary PartyKit project; close the issue to tear it down. The preview serves a bare redirect page (no tool branding) and the GitHub corner is compiled out of the bundle for event builds.

### Added
- Mood Sounds: volume slider (0–200%) added above the start button
- Mood Sounds: significantly boosted output level — tripled oscillator gains, tightened compressor, added 2.5× makeup gain after compression
- V4: new `mood-tones` interface — ambient generative audio keyed to live audience reaction position; unlock via `?interface=mood-tones` or push from the People tab; audience sync defaults on

### Fixed
- V4 haptic modal: "Show this popup when a buzz is sent" checkbox now defaults to unchecked on non-haptic devices

### Added
- Valence onboarding v2: "style past like cursor" checkbox — when unchecked, trace and fill segments retain the color they held at the moment they were drawn rather than retroactively reflecting the cursor's current valence

### Fixed
- Valence onboarding v2: WebSocket connect now works on LAN IPs (e.g. `192.168.x.x`) — `crypto.randomUUID` is unavailable in non-secure contexts, replaced with a UUID v4 fallback using `Math.random`
- Valence onboarding v2: configuration panel no longer requires horizontal scrolling on mobile — rows now wrap, compound rows (geometry/animation, traces/order) break cleanly at their separator, disabled alpha sliders and 3D orbit hint hidden on narrow screens

### Added
- V4 Interfaces tab: Reaction Canvas now has a gear (⚙) settings dialog — first setting is "Show 'Now' label on canvas", which broadcasts the current moment label as a live text overlay at the top of the canvas for all participants; the overlay clears automatically when the moment is snapped
- V4 Moments tab: "Now" label input is persisted in localStorage per room — survives browser refresh; cleared on snap

### Fixed
- V4 Image Canvas modal: URL input no longer auto-focuses on open, preventing the keyboard from popping up on mobile
- V4 Moments tab: push-to-talk mic button no longer locks up after enabling — root cause was `getUserMedia` holding the mic stream open and conflicting with `SpeechRecognition`; recognition instance is now created once and reused, and the Permissions API is used to skip the enable step if mic was already granted in a prior session

### Added
- Index page: always-visible QR code linking to the index page itself, so facilitators can share the app list from any screen
- V4 Moments tab: press-and-hold mic button at the bottom of the tab uses the browser's Web Speech API to pre-fill the upcoming "Now" moment label by voice — button starts disabled and requests mic permission on first tap; each hold-to-speak overrides the previous label
- V4 People tab: "Send popup…" now shows two selectable options — "Coder role" (GitHub username) and "★ Star rating" (feedback); selecting star rating sends a 1–5 star modal to participants, and their responses are stored in the emcee's localStorage ([#30](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/30))
- V4 People tab: new "Feedback Stars" group-by option — groups all seen participants into buckets by their submitted star rating (5★ down to 0★ plus "No response"), enabling the emcee to target high or low scorers with follow-up actions ([#30](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/30))

## Week 22 (2026-04-20)

### Changed
- V4 Image Canvas modal: replaced focus-triggered URL dropdown with a persistent thumbnail row — past images are always visible and clickable to populate the URL input ([#49](https://github.com/patcon/polislike-partykit-reaction-canvas/issues/49))
- V4 People tab: "Group by" simplified to Valence / None; moment picker merged into the same row as a second select defaulting to "Now", with saved moments as additional options

### Fixed
- V4 admin: active tab is now persisted to localStorage per room — switching to the canvas and back no longer resets the tab to Record
- V4 People tab: "Send popup…" now sends the coder-role popup only to the targeted user/group/region instead of broadcasting to all participants
- V4 People tab: group-level actions (Offer interface, Send buzz, Send popup) in the valence grouping now snapshot membership at click time — people who move after the menu opens are no longer included or excluded

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
