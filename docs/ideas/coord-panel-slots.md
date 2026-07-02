# Slot-Based Coord Panels: Headless Hooks + Free Composition

## Problem Statement
How might we decompose CursorField's hardcoded per-panel branches into a
headless coordinate-stream hook that panels compose freely — so new ways of
rendering others/self/overlays become cheap render swaps, not edits to a
god-component?

## Recommended Direction
Direction A — headless hooks + free composition (not a mandated host/slot host).

Extract the data spine out of CursorField into `useCoordStream()` returning
{ positionsRef (per-frame readable), positions (opt-in React state), self,
helpers, send }. A panel becomes a plain React component that composes the
hook and renders however it likes — cursors, boids, a bar chart, whatever.
This kills the god-component by *dissolution*: there is no host left to
accrete branches.

Two sibling data hooks, not one forced model: `useCoordStream()` (x/y points)
and `useStrokeStream()` (signature paths). The abstraction that unifies these
panels is STRUCTURAL (hook + composition + input source), not a single data
channel. Signature is structurally in, data-wise separate.

InputSource (#6) is designed-in but built-last: the hook contract leaves room
for swappable drivers (my touch / playback / simulated / remote-controlled
shared cursor), but only the render prototype ships first. The one wish-list
item needing new server state — give-a-participant-control — waits behind it.

Layer-stack convention (#3) is deferred until 3+ panels demonstrably repeat
layer ordering. Mandating it now is premature structure.

## Key Assumptions to Validate
- [ ] The stream separates cleanly from D3/RAF animation.
      Test: build boids on useCoordStream with CursorField untouched; if the
      hook drags in rendering concerns, the seam is wrong. (CursorField.tsx:144-248)
- [ ] positionsRef is readable ~60fps without per-frame React re-renders.
      Test: boids RAF loop reads positionsRef.current each frame; profile for
      re-render storms.
- [ ] The shared shell (labels, presence, valence bg) survives dissolution.
      Test: extract shell pieces as small standalone components; confirm the
      boids panel can opt in without inheriting a god-component.
      (ReactionCanvasParticipant.tsx:216-283)
- [ ] Two hooks stay two. New data channels require explicit justification.

## MVP Scope
IN: `useCoordStream()` extracted (read-only spine); a NEW BoidsPanel component
    that consumes it and renders a boids sim over the live human XY stream
    (dynamic-allocation mode first — robust to join/leave churn). CursorField
    left fully intact and working.
OUT: touching CursorField; migrating canvas/soccer/image; layer stack; the
     stroke hook; any server changes; strict 1:1 pairing (variant, later).

## Not Doing (and Why)
- Mandated layer stack (#3) — premature; let it emerge from repetition.
- Unified particle/view-model (#5) — contradicts raw-stream pick; boids proved
  raw XY is enough.
- Fixing the panel-mode/canvas-mode schism (#7) now — signature stays as-is;
  revisit once the hook shape is proven.
- Shared-cursor backend state — designed-in via InputSource, built after the
  render contract is validated.
- Forcing signature onto the coord stream — it's path data; it gets its own hook.

## Open Questions
- Dynamic allocation vs strict 1:1 for the prototype? (Recommend dynamic —
  survives churn; strict needs boid-count reconciliation on join/leave.)
- Does `helpers` belong on the coord hook, or as free-standing pure fns
  imported where needed? (Leaning free functions — fewer things bound to the hook.)
- Where does own-touch capture live once TouchLayer is no longer canvas-bound?
