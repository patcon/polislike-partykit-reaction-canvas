# Plan: Simulated Users (implementation)

Status: **DRAFT — awaiting review** · Companion to `docs/specs/simulated-users.md` · 2026-07-03

This is the Phase-2 plan + Phase-3 task breakdown. Nothing here is implemented yet. Review the
build order, risks, and tasks before we start coding.

## Component / dependency graph

```
                 ┌────────────────────────┐
                 │ T1 foundation           │  types.ts + simulatedUser.ts
                 │ (types + sim_ recogn.)  │  (+ wire CursorField/ValenceViz)
                 └───────────┬─────────────┘
             ┌───────────────┼───────────────┐
             ▼               ▼                ▼
     ┌──────────────┐ ┌─────────────┐  ┌──────────────┐
     │ T3 engine +  │ │ T4 Drift    │  │ T7 Region-   │
     │ socket sink  │ │ program     │  │ hoppers      │
     └──────┬───────┘ └──────┬──────┘  └──────┬───────┘
            │                │                │
   ┌────────┴────────┐       │         ┌──────┴───────┐
   │ T2 server        │      │         │ T8 Recorded  │
   │ simCursorBatch   │──────┤         │ playback     │
   │ (parallel to T1) │      │         └──────────────┘
   └────────┬─────────┘      │
            ▼                ▼
     ┌──────────────────────────────┐
     │ T5 SimControlBar + DemoLayout │  ← integration checkpoint (walking skeleton)
     │ slot, wired into canvas-mood  │
     └──────────────┬───────────────┘
                    ▼
     ┌──────────────────────────────┐
     │ T6 wire into admin-canvas     │
     │ T9 Storybook story            │
     └──────────────────────────────┘
```

## Build order — vertical slices

Each slice ends at a runnable checkpoint. We build a **walking skeleton first** (simplest program,
end-to-end, one demo page) before breadth.

### Slice 0 — Walking skeleton (prove the whole path with Drift)
Goal: on `/demos/canvas-mood`, press play → real `sim_` cursors flow through the server to both
phones and mood-tones reacts. This de-risks the integration before we invest in more programs.

- **T1** foundation (types + `sim_` recognition)
- **T2** server `simCursorBatch` handler *(parallel with T1)*
- **T3** engine + socket sink
- **T4** Drift program
- **T5** SimControlBar + `DemoLayout` `controls` slot + own `RoomSocketProvider`, wired into
  `DemoCanvasMood` only
- **Checkpoint CP3 (manual):** play/pause/stop Drift at 25 & 100 users on canvas-mood.

### Slice 1 — Breadth (second page + remaining programs)
- **T6** wire SimControlBar into `DemoAdminCanvas`
- **T7** Region-hoppers program *(parallel with T8)*
- **T8** Recorded playback program + runtime loading of the sample slice (graceful if absent)

### Slice 2 — Hardening & ship prep
- **T9** Storybook story for SimControlBar (mock bus)
- **T10** coverage pass (fill any gaps in program-determinism / engine / sink / recognition tests)
- **T11** `CHANGELOG.md` entry (current week section)
- **T12** short docs note (`docs/components.md` and/or `docs/routing.md`: the demo simulator)

## Parallelization

- **T1 ∥ T2** — foundation and server handler are independent.
- After T1: **T3 ∥ T4 ∥ T7** can proceed (T7 only needs types + the shared easing helper from T4;
  simplest is to land T4 first, then T7/T8 reuse its easing core).
- **T7 ∥ T8** after the skeleton.
- Everything else is sequential through the T5 integration point.

## Risks & mitigations

- **R1 — throughput at 100 users.** 100 cursors × 20 fps = one ≤100-entry batch every 50 ms,
  rebroadcast to N clients. CursorField already handles `cursorBatch`, but 100 hasn't been exercised
  on the demo path. *Mitigation:* test at 100 in CP3, not just 25; watch for dropped frames / CPU.
- **R2 — sim cursors invisible to presence/targeting** (connection-derived). *Mitigation:* accepted
  & documented; verify the read side (mood-tones / valence) keys off cursor *positions* by `userId`,
  not presence — the explorer confirmed `useCoordStream` does. Re-confirm in CP3.
- **R3 — paused cursors get stale-pruned** at `CURSOR_STALE_MS` (3 s). *Mitigation:* engine emits a
  heartbeat batch every `CURSOR_HEARTBEAT_MS` (2 s) while paused; explicitly test a >3 s pause.
- **R4 — the sim-driver adds a 3rd connection** to the demo room. Harmless (it only sends, never
  renders its own cursor), but it counts as one real connection in presence. *Mitigation:* note it;
  don't send a cursor for the driver's own `sim-driver` id.
- **R5 — the sample recording is gitignored**, so CI/other clones won't have it. A static bundle
  `import` of a missing file **breaks the Vite build**. *Mitigation (decided here):* the Recorded
  playback program **fetches the slice at runtime** from a static path rather than importing it, and
  **degrades gracefully** if the fetch 404s (the program is marked unavailable and its dropdown
  option is disabled with a tooltip). This means relocating the slice to a served, gitignored path
  — `public/sim-recordings/sample.json` — and updating `.gitignore` accordingly in T8. Tests and
  Storybook must **not** depend on the file.
- **R6 — determinism vs real-time ticks.** Programs must be seed-deterministic for tests, but the
  engine ticks on wall-clock. *Mitigation:* engine takes an injectable scheduler/`now()` (default
  real); tests drive ticks manually. Programs use a seeded PRNG (no `Math.random`), mirroring
  `BoidsSpike.stories.tsx:58-59`.

## Verification checkpoints

| CP | After | Check |
|----|-------|-------|
| CP1 | T1 | `pnpm vitest` green (no behavior change); `isSimulatedUserId` unit test passes; `replay_` behavior unchanged. |
| CP2 | T3 | Engine state-machine + sink unit tests green (fake program + fake sink, manual clock). |
| CP3 | T5 | **Manual, the big one:** canvas-mood, Drift at 25 & 100 → purple/dashed `sim_` cursors on both phones, mood reacts; pause >3 s freezes (no pruning); stop clears; devtools shows **one** sim-driver socket. |
| CP4 | T8 | All three programs selectable & working on both pages; Recorded playback works with the local slice and **disables gracefully** when the file is absent. |
| CP5 | T12 | `pnpm vitest` fully green incl. program-determinism tests; Storybook story renders; CHANGELOG updated; manual pass on both demo pages. |

## Tasks (Phase 3)

Sized to ≤ ~5 files each; ordered by dependency.

- [x] **T1 — Foundation: types + `sim_` recognition**
  - Acceptance: `app/lib/simulation/types.ts` defines `SimulationProgram`, `SimSink`, `SimContext`,
    constants (`SIM_TICK_MS`, heartbeat), re-exports the canonical `CursorEvent`.
    `app/utils/simulatedUser.ts` exports `SIM_PREFIX`, `REPLAY_PREFIX`, `isSimulatedUserId()`.
    `CursorField.tsx` & `ValenceViz.tsx` call `isSimulatedUserId` instead of inline `replay_` checks;
    `replay_` behavior is byte-for-byte unchanged.
  - Verify: unit test for `isSimulatedUserId` (both prefixes, negatives); `pnpm vitest` green.
  - Files: `app/lib/simulation/types.ts`, `app/utils/simulatedUser.ts`, `CursorField.tsx`,
    `viz/ValenceViz.tsx`, `tests/simulation/simulatedUser.test.ts`.

- [x] **T2 — Server `simCursorBatch` handler** *(parallel with T1)*
  - Acceptance: `party/types.ts` adds `SimCursorBatch` to the `ClientEvent` union; `party/server.ts`
    handles it — updates `cursorPositions` per cursor and rebroadcasts a single `cursorBatch` to all
    clients except the sender. Mirrors `handlePlaybackCursorBroadcast`. Presence/targeting untouched.
  - Verify: unit/integration test if the server harness allows, else a scripted manual check over
    `dev-https` (send a `simCursorBatch`, observe a `cursorBatch` broadcast). Commit before any deploy.
  - Files: `party/server.ts`, `party/types.ts`, (optional) `tests/…server.test.ts`.

- [x] **T3 — Engine + socket sink**
  - Acceptance: `engine.ts` implements `idle → running ⇄ paused` with an injectable scheduler; ticks
    at `SIM_TICK_MS`; running → `sink.emit(program.tick())`; paused → heartbeat every
    `CURSOR_HEARTBEAT_MS`; stop → `sink.emit(program.teardown())` then idle; elapsed excludes paused
    spans. `sinks/socketSink.ts` wraps events into `{type:'simCursorBatch',cursors}` via `send`.
  - Verify: engine unit tests with a fake program + fake sink + manual clock (transitions, heartbeat
    while paused, teardown emits one `remove`/user, elapsed math); sink shape test.
  - Files: `app/lib/simulation/engine.ts`, `app/lib/simulation/sinks/socketSink.ts`,
    `tests/simulation/engine.test.ts`, `tests/simulation/socketSink.test.ts`.

- [x] **T4 — Drift / Wander program**
  - Acceptance: `programs/drift.ts` ports `useMockCoordStream` (seeded PRNG, `x += (tx-x)*0.02`,
    retarget random canvas point on arrival), emits one `move` per user per tick keyed `sim_<i>`;
    `teardown` emits a `remove` per user. Shared easing core extracted for reuse by T7.
  - Verify: determinism test (same seed → identical positions run-to-run); coords stay 0..100;
    retarget triggers on arrival.
  - Files: `app/lib/simulation/programs/drift.ts`, `app/lib/simulation/programs/_easing.ts`,
    `app/lib/simulation/programs/index.ts`, `tests/simulation/drift.test.ts`.

- [x] **T5 — SimControlBar + DemoLayout slot + canvas-mood wiring** *(integration; CP3 verified)*
  - Acceptance: `SimControlBar.tsx` renders program `<select>`, user-count preset (25/50/100),
    play/pause/stop; drives the engine via `useRoomSocket().send`. `DemoLayout` gains a `controls`
    slot at the bottom of `.demo-page`; the slot is wrapped in its own `RoomSocketProvider room`
    with a fixed `sim-driver` userId (no self-cursor). `DemoCanvasMood` passes `<SimControlBar/>`.
  - Verify: **CP3 manual** (see table). Bar styled like `InterfaceChipBar`.
  - Files: `SimControlBar.tsx`, `DemoLayout.tsx`, `DemoCanvasMood.tsx`, `app/styles/demos.css`.

- [x] **T6 — Wire SimControlBar into admin-canvas**
  - Acceptance: `DemoAdminCanvas` shows the same control bar; same program set.
  - Verify: manual — same as CP3 on `/demos/admin-canvas`.
  - Files: `DemoAdminCanvas.tsx`.

- [x] **T7 — Region-hoppers program** *(parallel with T8)*
  - Acceptance: `programs/regionHoppers.ts` reuses `_easing.ts` but targets AGREE/DISAGREE/PASS
    anchors (`app/utils/voteRegion.ts`) with jitter + short dwell before hopping.
  - Verify: determinism test; targets resolve to region anchors ± jitter; registered in `index.ts`.
  - Files: `app/lib/simulation/programs/regionHoppers.ts`, `programs/index.ts`,
    `tests/simulation/regionHoppers.test.ts`.

- [x] **T8 — Recorded playback program + runtime slice loading**
  - Acceptance: `programs/recordedPlayback.ts` fetches `public/sim-recordings/sample.json` at
    runtime, parses the `PlaybackFile` (`connectionId` → `sim_<connectionId>`; `move`/`touch` →
    same, `remove`/`departure` → `remove`; `arrival` no-op), replays by timestamp, loops. If the
    fetch fails, the program reports unavailable and its dropdown option is disabled with a tooltip.
    Relocate the slice to `public/sim-recordings/sample.json`; update `.gitignore`.
  - Verify: with the file present, cursors replay & loop; with it removed, the option is disabled and
    nothing throws. Determinism not required (data-driven), but ordering test on a tiny fixture.
  - Files: `app/lib/simulation/programs/recordedPlayback.ts`, `programs/index.ts`, `.gitignore`,
    `SimControlBar.tsx` (disabled-option affordance), `tests/simulation/recordedPlayback.test.ts`.

- [x] **T9 — Storybook story for SimControlBar**
  - Acceptance: a story renders the bar over the mock socket bus; play/pause/stop exercised without
    a live server; no dependency on the recording file.
  - Verify: story loads headless in `pnpm vitest`.
  - Files: `stories/SimControlBar.stories.tsx`.

- [x] **T10 — Coverage pass**
  - Acceptance: gaps from T1–T8 filled; all sim tests deterministic and green.
  - Verify: `pnpm vitest` green.
  - Files: `tests/simulation/*`.

- [x] **T11 — CHANGELOG entry**
  - Acceptance: current-week section entry (append to bottom) describing the demo-page simulator,
    linked to the PR.
  - Verify: entry present under the right week header.
  - Files: `CHANGELOG.md`.

- [ ] **T12 — Docs note**
  - Acceptance: brief mention in `docs/components.md` (SimControlBar) and/or `docs/routing.md`
    (demo simulator); link to the spec.
  - Verify: docs render; links resolve.
  - Files: `docs/components.md`, `docs/routing.md`.
