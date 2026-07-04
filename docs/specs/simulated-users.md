# Spec: Simulated Users (Demo-page simulation engine)

Status: **DRAFT — awaiting review** · Owner: patcon · Created 2026-07-03

## Objective

Give a developer on the individual demo pages (`/demos/*`) a small control bar to
**select a "program" of simulated user activity and play / pause / stop it**, injecting
25–100 fake cursors into the demo's live room so the existing UIs (CursorField, mood-tones,
valence) render and react to a realistic crowd — without needing real phones connected.

Today, simulated cursors are generated six different ways (boids mock stream, k6 perf orbits,
removed V1 ghost cursors, valence-onboarding drift, emcee record/playback, Storybook mock bus),
each with its own motion model, emission path, and fake-user id convention. This feature
introduces **one clean abstraction** — a pluggable *program* (motion source) feeding the single
canonical cursor event shape into a selectable *sink* — and ships it on the demo pages. Existing
systems are left untouched but the interfaces are designed so they *could* migrate later.

### Users & success

- **Primary user**: a developer/demoer viewing `/demos/admin-canvas` or `/demos/canvas-mood`.
- **Success looks like**: open a demo page → pick a program → press play → 25–100 purple/dashed
  "simulated" cursors appear on both phone mockups (and any real phone that joins the room via QR),
  moving realistically → pause freezes them → stop removes them cleanly.

### Non-goals (MVP)

- Scrubbing through events, or changing playback speed (design *for* it, don't build it).
- Running the engine in perf infra or server-side (keep interfaces portable; don't wire them).
- Making simulated users affect **presence count / region targeting** (those are connection-derived;
  sim cursors are visible but not counted — documented limitation, not a bug to fix here).
- Per-UI affordances beyond what already exists to distinguish simulated cursors.

## Tech Stack

TypeScript · React · PartyKit (WebSockets) · Vite · TanStack Router (path routes) · Vitest +
Storybook stories. No new runtime dependencies expected.

## Commands

```
Dev (HTTPS, port 1999):  pnpm run dev-https
Storybook:               pnpm run storybook
Test (stories + unit):   pnpm vitest
```

Manual verification target: `https://localhost:1999/demos/canvas-mood`.

## Background — the backbone that already exists

- **One canonical cursor event** (`party/types.ts`, `party/perf-server.ts:3-13`):
  ```ts
  { type: 'move' | 'touch' | 'remove',
    position: { x: number; y: number; timestamp: number; userId: string } }   // coords 0..100
  ```
- **Identity is in the payload** (`position.userId`), not the connection — so one socket can drive
  many virtual users. (`party/server.ts:346,351` key state by `position.userId`.)
- **Server rebroadcast precedent**: `handlePlaybackCursorBroadcast` (`party/server.ts:332-339`)
  already takes a cursor from one client and rebroadcasts it to everyone. Our `simCursorBatch`
  mirrors this for an *array*.
- **"Simulated" convention**: userIds starting with `replay_` render purple/dashed and are counted
  as simulated (`CursorField.tsx:117,275,801`, `ValenceViz.tsx:828`). We add a `sim_` prefix to the
  same recognition.

## Architecture — how to build it

Three small pieces plus a UI component and one server handler.

```
SimControlBar (demo page)
   │  play/pause/stop, select program, user count
   ▼
SimulationEngine ── ticks at SIM_TICK_MS ──►  program.tick(t) : CursorEvent[]
   │                                          (Drift | RegionHoppers | RecordedPlayback)
   ▼
SimSink.emit(events)  ──►  SocketSimSink  ──►  send({ type:'simCursorBatch', cursors:[...] })
                                                     │
                                            party/server.ts handler
                                                     │  update cursorPositions, rebroadcast
                                                     ▼
                                            { type:'cursorBatch', cursors:[...] }  → all clients
```

### Interfaces

```ts
// app/lib/simulation/types.ts
interface SimContext {
  userCount: number;            // how many sim users to drive
  seed: number;                 // deterministic PRNG seed
  regionAnchors: RegionAnchors; // AGREE/DISAGREE/PASS anchor points (from voteRegion util)
}

interface SimulationProgram {
  readonly id: string;          // stable key, e.g. 'drift'
  readonly label: string;       // human label for the dropdown
  init(ctx: SimContext): void;  // (re)initialize per-user state
  tick(tMs: number, dtMs: number): CursorEvent[];  // events to emit this tick
  teardown(): CursorEvent[];    // 'remove' events for all sim users (on stop)
}

interface SimSink { emit(events: CursorEvent[]): void; }
```

- **Generators** (Drift, RegionHoppers) emit one `move` per user per tick (current position).
- **RecordedPlayback** emits the recorded events whose timestamp falls in `(lastT, tMs]`.
- Sim user ids are `sim_0 … sim_{n-1}` (the `sim_` prefix drives the "simulated" rendering).

### Engine

`app/lib/simulation/engine.ts` — a small state machine `idle → running ⇄ paused`.

- Ticks at `SIM_TICK_MS` (50ms / 20fps, matching the server's 50ms batch window).
- Tracks elapsed *sim* time, excluding paused spans, so pause/resume is seamless.
- **While running**: `sink.emit(program.tick(t, dt))`.
- **While paused**: emit a heartbeat batch (re-send last positions) every `CURSOR_HEARTBEAT_MS`
  (2s) so paused cursors don't hit `CURSOR_STALE_MS` (3s) and get pruned — mirrors the emcee
  playback pause heartbeat.
- **On stop**: `sink.emit(program.teardown())` (a `remove` per sim user), reset to `idle`.

### Sink

`app/lib/simulation/sinks/socketSink.ts` — `SocketSimSink(send)` wraps events into
`{ type: 'simCursorBatch', cursors }` and calls the `useRoomSocket().send` string API.
Future sinks (`LocalSimSink` writing a `positionsRef`, `MockBusSimSink` for Storybook) are
out of scope but the interface allows them.

### Programs (MVP set)

The two generators share **one easing engine** ("ease toward a target; pick a new target on
arrival"); they differ only in *target source*.

1. **Drift / Wander** (`programs/drift.ts`) — port of `BoidsSpike.stories.tsx:34-79`'s
   `useMockCoordStream`. Per user `{x,y,tx,ty}`; each tick `x += (tx-x)*0.02`; on arrival
   (`hypot < 3`) retarget to a random canvas point (`8 + rnd()*84`). Deterministic seeded PRNG.
   Free-roaming organic motion.
2. **Region-hoppers** (`programs/regionHoppers.ts`) — same easing, but targets snap to
   AGREE/DISAGREE/PASS anchors (from `app/utils/voteRegion.ts`) with small jitter, with a short
   dwell before hopping. Looks like deliberate voting.
3. **Recorded playback** (`programs/recordedPlayback.ts`) — consumes a `PlaybackFile` JSON (the
   existing emcee format, `AdminPanelNoDB/types.ts:13-19`) and re-emits events by timestamp,
   looping. File-upload is a later enhancement.
   - **Event shape** (confirmed from the real capture): each event is
     `{ connectionId, type, timestamp, x?, y? }` where `type ∈ {arrival, departure, move, touch,
     remove}` and `x/y` (0..100) are present on `move`/`touch`. Top-level `mode` is `'positions'`.
   - **Mapping**: each `connectionId` → sim user `sim_<connectionId>`; `move`/`touch` → emit the
     same-type cursor event, `remove`/`departure` → emit `remove`; `arrival` is a no-op (the first
     `move`/`touch` establishes the cursor). Loops on reaching `recordingEnd`.

   #### Sample recording (provenance + slicing recipe)
   Source (full, **not** committed — ~29 MB, 151k events, ~26 h span but activity concentrated in
   the first ~35 min, room `default`, mode `positions`): the owner's `PlaybackFile` at
   <https://drive.google.com/file/d/1tC0nEfnCTSL2WVbLn1xxlo6hS2SkSUF7/view>
   (download id `1tC0nEfnCTSL2WVbLn1xxlo6hS2SkSUF7`). The full file is too large to ship; we use a
   **trimmed slice**, chosen for a lively spread of disagreement + movement (not a boring stretch):
   - Window: **+885 s → +975 s** (14:45–16:15), selected by scoring 90 s windows on region spread
     (Gini-Simpson over agree/disagree/neutral) × path-length movement. This window has all three
     regions represented (~agree 0.19 / disagree 0.29 / neutral 0.52) with high movement.
   - Rebase all timestamps so the slice starts at `0`; set `recordingStart: 0`,
     `recordingEnd: 90000`.
   - Round `x`/`y` to **2 decimal places**.
   - Result: **7 users, 7,335 events, 90 s, ~0.78 MB.**
   - **Where it lives**: `public/sim-recordings/sample.json` (served at runtime), but **gitignored**
     (`.gitignore`) so it's local-but-uncommitted. **Whether/how to ship it is a pre-merge decision**
     (commit the slice as-is, thin it further, host it as a downloadable, or generate on demand).
     The recipe above regenerates it from the source at any time.

`programs/index.ts` exports a `PROGRAMS` registry `[{ id, label, create }]` the control bar reads.

### Server change

`party/server.ts` — add a `simCursorBatch` case to the `onMessage` switch and a
`handleSimCursorBatch(cursors, sender)` mirroring `handlePlaybackCursorBroadcast`: for each cursor
update `cursorPositions`, then rebroadcast the whole set as one `cursorBatch` to all clients except
the sender. Add the `SimCursorBatch` type to the `ClientEvent` union in `party/types.ts`.
(Presence/targeting are intentionally not touched.)

### Sim-identity recognition

Add `app/utils/simulatedUser.ts`:
```ts
export const SIM_PREFIX = 'sim_';
export const REPLAY_PREFIX = 'replay_';
export const isSimulatedUserId = (id: string) =>
  id.startsWith(SIM_PREFIX) || id.startsWith(REPLAY_PREFIX);
```
Refactor the existing `replay_` checks in `CursorField.tsx` and `ValenceViz.tsx` to call it —
behavior for `replay_` is unchanged; `sim_` now gets the same purple/dashed treatment.

### UI — SimControlBar & mount

- `app/components/demos/SimControlBar.tsx` — a compact bottom bar styled after `InterfaceChipBar`
  (`app/styles/panels.css`): program `<select>`, a user-count **preset select (25 / 50 / 100,
  default 25)**, and play / pause / stop buttons. Calls `useRoomSocket().send`.
- `DemoLayout.tsx` gains an optional `controls` slot rendered as the last child of `.demo-page`
  (the layout already reserves 64px bottom padding). The slot is wrapped in its **own**
  `RoomSocketProvider room={room}` (a dedicated "sim driver" connection) so the bar can send into
  the shared `demo-<uuid>` room independently of the two phone providers. The driver connection
  uses a **fixed** `sim-driver` userId (the demo room is a random `demo-<uuid>`, so collisions
  aren't naturally expected; sim identities live in the payload regardless).
- Both demo pages (`DemoAdminCanvas.tsx`, `DemoCanvasMood.tsx`) pass `<SimControlBar />` into the
  new slot. Same program set on both pages.

## Project Structure

```
app/lib/simulation/
  types.ts                     → SimulationProgram, SimSink, SimContext, constants
  engine.ts                    → SimulationEngine (loop + state machine)
  sinks/socketSink.ts          → SocketSimSink (simCursorBatch)
  programs/
    drift.ts                   → Drift / Wander
    regionHoppers.ts           → Region-hoppers
    recordedPlayback.ts        → Recorded playback
    index.ts                   → PROGRAMS registry
  recordings/sample.json       → sample recording slice (~1.3MB, GITIGNORED — decide before merge)
app/utils/simulatedUser.ts     → SIM_PREFIX + isSimulatedUserId()
app/components/demos/SimControlBar.tsx
app/components/demos/DemoLayout.tsx        (edit: add `controls` slot)
app/components/demos/DemoAdminCanvas.tsx   (edit: pass SimControlBar)
app/components/demos/DemoCanvasMood.tsx    (edit: pass SimControlBar)
party/server.ts                (edit: simCursorBatch handler)
party/types.ts                 (edit: SimCursorBatch in ClientEvent union)
stories/SimControlBar.stories.tsx
tests/simulation/*.test.ts
```

## Code Style

Match the codebase: functional React, hooks, no classes for components (the engine may be a plain
class or a closure factory — prefer a closure factory to match `useRecording`/`usePlayback` style).
Deterministic PRNG (no `Math.random`) so tests are reproducible, mirroring
`BoidsSpike.stories.tsx:58-59`. Use `generateUUID()` (never `crypto.randomUUID()` directly) if any
runtime id is needed for the driver connection.

```ts
// programs/drift.ts — shape to match
export function createDriftProgram(): SimulationProgram {
  let users: Map<string, { x: number; y: number; tx: number; ty: number }> = new Map();
  let rnd = () => 0;
  return {
    id: 'drift',
    label: 'Drift / Wander',
    init(ctx) { /* seed PRNG, place ctx.userCount users */ },
    tick(t) { /* ease each user, retarget on arrival, return move events */ },
    teardown() { /* return remove events for every sim user */ },
  };
}
```

## Testing Strategy

- **Unit (Vitest, `tests/simulation/`)**:
  - Each program's `tick` is deterministic for a fixed seed (positions reproducible run-to-run).
  - Generators keep coords within 0..100; retarget triggers on arrival.
  - RecordedPlayback emits events in timestamp order and loops.
  - Engine state machine: play→running, pause→heartbeat only, stop→teardown emits one `remove`
    per user and returns to idle; elapsed time excludes paused spans.
  - `SocketSimSink` produces a well-formed `simCursorBatch`.
  - `isSimulatedUserId` recognizes both prefixes.
- **Storybook**: a `SimControlBar` story (mock socket bus) rendering the bar and exercising
  play/pause/stop without a live server.
- **Manual (Definition of Done)**: on `/demos/canvas-mood`, run each program with 25 and 100 users;
  confirm purple/dashed sim cursors appear on both phones, mood-tones reacts, pause freezes, stop
  clears; check the browser has one sim-driver socket (not 25–100 connections).

## Boundaries

- **Always**: keep coords normalized 0..100; use `sim_` prefix for sim user ids; run `pnpm vitest`
  before commit; update `CHANGELOG.md` (current week section) in the same commit as user-facing
  changes; commit `party/server.ts` before any deploy.
- **Ask first**: adding a new runtime dependency; changing the canonical cursor event shape;
  touching presence/targeting; migrating any existing system (playback/perf/boids) onto this engine.
- **Never**: use `crypto.randomUUID()` directly; commit `public/index.html`; alter the `replay_`
  behavior; open one websocket per simulated user.

## Success Criteria

1. On both `/demos/*` pages, a bottom control bar lets a developer pick one of {Drift, Region-hoppers,
   Recorded playback} and play / pause / stop it.
2. Playing drives 25–100 simulated cursors into the demo's live room over **one** websocket
   connection (verified in devtools), rendered purple/dashed on both phones and any real joiner.
3. Pause freezes cursors (no staleness pruning); stop removes all sim cursors cleanly.
4. Mood-tones / valence read side reacts to the simulated crowd on `canvas-mood`.
5. Existing simulation systems (playback, perf, boids, onboarding) are unchanged and still pass.
6. `pnpm vitest` green, including new deterministic program tests.

## Resolved Decisions

1. **Sample recording** — ✅ Use a real capture from the owner's 25 MB Drive `PlaybackFile`, trimmed
   to a 51-user / 90 s slice (recipe under "Sample recording" above). Slice lives at
   `app/lib/simulation/recordings/sample.json`, **gitignored for now**.
2. **User-count control** — ✅ Preset select (25 / 50 / 100, default 25).
3. **Sim-driver connection userId** — ✅ Fixed `sim-driver`.

## Open Questions (pre-merge)

1. **Recording storage** — settle before merging the PR: commit the 1.3 MB slice as-is, thin it
   further (e.g. drop touch frame-rate), host it as a downloadable asset, or generate on demand.
   Until decided, the slice stays gitignored.
