# Plan: Organic 2D positioning for Valence Shift

Status: **DRAFT — ready to build** · Owner: patcon · Created 2026-07-10

## Objective

`valenceShift.ts` currently maps a scalar valence to canvas position via `valenceToPosition()`,
which collapses every possible position for a given valence down to **one single point** on a
fixed line (negative → centroid → positive). Every simulated cursor with the same target valence
rides the exact same track, which reads as visibly unnatural — real people with "neutral" opinions
don't all stand on one line.

This plan replaces that with **organic 2D positioning**: for a given valence, sample a random point
from the *actual set* of canvas positions that produce that valence (a full chord across the anchor
triangle, not a point), and glide each user directly to their own sampled point ("most direct
route", independent per user — no shared track). A **spread** constant controls how tightly group
members cluster around a shared anchor point on that chord vs. scattering across its full width, so
the same mechanism can produce both a "tight cluster" look and a "fully organic scatter" look — the
user wants to explore both by hand-editing the constant, no UI control needed.

## Background — the math (verified)

`computeCursorValence()` (`app/utils/voteRegion.ts:71`) computes valence via barycentric weights:
`valence = wPositive − wNegative`, where `wPositive + wNegative + wNeutral = 1`. For a fixed valence
`v`, this is **one linear constraint on two free barycentric weights** — the solution set is a line
segment (a "chord") across the anchor triangle, not a point.

Solving for the two endpoints of that chord (derivation + numeric verification done in-session, all
round-tripped exactly through `computeCursorValence`):

```
A(v) = v >= 0 ? lerp(neutral, positive, v) : lerp(neutral, negative, -v)   // on a neutral-adjacent edge
B(v) = lerp(negative, positive, (v + 1) / 2)                              // on the negative–positive edge
chord(v, t) = lerp(A(v), B(v), t)   // t in [0,1] — any point on this chord has valence exactly v
```

Sanity checks (DEFAULT_ANCHORS, positive=(95,5) negative=(5,95) neutral=(95,95)):
- `v=0`: chord runs from **(50,50)** (today's `valenceToPosition` centroid point is on this chord,
  but so is the entire diagonal up to **(95,95)**, the neutral vertex — a ~64-unit-long chord).
- `v=±1`: chord collapses to a single point (the positive/negative vertex) — extremes are
  necessarily unambiguous.

This chord is the real "positions consistent with valence v" set the user is asking to sample from.

## New primitive: `sampleValencePosition`

Add to `app/utils/voteRegion.ts`, next to `valenceToPosition`/`computeCursorValence`:

```ts
export function valenceChordEndpoints(valence: number, anchors: ReactionAnchors): { a: Point; b: Point } {
  const v = Math.max(-1, Math.min(1, valence));
  const lerp = (p: Point, q: Point, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const a = v >= 0 ? lerp(anchors.neutral, anchors.positive, v) : lerp(anchors.neutral, anchors.negative, -v);
  const b = lerp(anchors.negative, anchors.positive, (v + 1) / 2);
  return { a, b };
}

export function sampleValencePosition(valence: number, t: number, anchors: ReactionAnchors): Point {
  const { a, b } = valenceChordEndpoints(valence, anchors);
  const clampedT = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * clampedT, y: a.y + (b.y - a.y) * clampedT };
}
```

`t` is supplied by the caller's seeded PRNG — this function is pure and deterministic given its
inputs, easy to unit test via round-trip through `computeCursorValence`.

**Test** (add to `tests/voteRegion.test.ts`, matching that file's existing style):
- For a spread of `valence` values (`-1, -0.6, -0.3, 0, 0.3, 0.6, 1`) and `t` values (`0, 0.25, 0.5,
  0.75, 1`), assert `computeCursorValence(sampleValencePosition(v, t, anchors)) ≈ v` (within float
  tolerance).
- `t=0`/`t=1`/any `t` all collapse to the same point when `valence = ±1` (chord degenerates to a
  vertex).
- Output stays within `DEFAULT_ANCHORS`' triangle (all barycentric weights in `[0,1]`) for valid
  inputs.

## Redesigning `valenceShift.ts`

The existing shift/glide architecture (global `nextShiftAt`, `travelStart`, eased-over-
`TRAVEL_DURATION_MS`) stays — **it turns out this doesn't need Region-hoppers' independent
per-cursor move/rest state machine at all.** All users already glide in lockstep on the shared
`SHIFT_INTERVAL_MS` timer; the only change is *what* they glide between: swap the scalar
`travelFrom`/`travelTo: number[]` (valence values, re-projected every tick via `valenceToPosition`)
for `travelFromX/Y`/`travelToX/Y: number[]` (canvas points, computed once per shift via
`sampleValencePosition`) and ease those directly. This is a smaller change than it first looks —
no new "ghost" abstraction needed for this program.

### Picking each member's destination point

Per shift, per group `g`:
1. Roll one shared **anchor fraction** `anchorT[g] = rnd()` — "where along this group's target
   valence chord does the group tend to sit this shift."
2. Each member `i` in group `g` also re-rolls its own personal offset `noiseOffset[i] = (rnd() * 2
   - 1) * NOISE_SPAN` **every shift**, not just once at init — a member that read as slightly more
   extreme than its group last hop isn't locked into being "the extreme one" forever; the personal
   deviation itself scrambles hop to hop, same as the group target does. It then computes its
   personal valence `clampValence(groupTarget[g] + noiseOffset[i])`, then its own chord endpoints
   `{a, b} = valenceChordEndpoints(personalValence[i], anchors)` and chord length
   `chordLen[i] = hypot(b.x - a.x, b.y - a.y)`, then its own chord position:
   `spreadFraction[i] = resolveSpreadFraction(SPREAD, chordLen[i])`
   `memberT[i] = clamp(anchorT[g] + (rnd() * 2 - 1) * spreadFraction[i] / 2, 0, 1)`
   `travelToXY[i] = sampleValencePosition(personalValence[i], memberT[i], anchors)`

**`SPREAD` is dual-mode** — a single number whose *units* are inferred from its magnitude, so one
constant still reaches every look without a second knob:
- **`0 <= SPREAD <= 1`** → treated as a **fraction of chord length**, exactly as before.
  `resolveSpreadFraction` returns `SPREAD` unchanged.
- **`SPREAD > 1`** → treated as **absolute canvas units** (the same 0–100 normalized space as
  anchors — note the canvas *diagonal* can exceed 100 units, so this range is open-ended, not
  capped at 100). `resolveSpreadFraction = min(1, SPREAD / chordLen[i])`.

```ts
function resolveSpreadFraction(spread: number, chordLen: number): number {
  if (spread <= 1) return spread;
  if (chordLen <= 0) return 1; // degenerate chord (v=±1): whole "chord" is the point itself
  return Math.min(1, spread / chordLen);
}
```

**Why two modes:** the chord's length is not constant — it shrinks toward 0 as `personalValence`
approaches `±1` (extreme opinions are geometrically less ambiguous, so there's less room to scatter
within). A purely proportional spread (mode 1) shrinks in lockstep, which reads as "extreme voters
all stand on top of each other" — unrealistic; real people occupy a roughly constant amount of
physical space regardless of how strong their opinion is. Absolute-unit mode (mode 2) holds that
footprint constant in canvas units as valence gets more extreme, and only degrades gracefully back
toward "use the whole chord" once the chord itself becomes shorter than the requested footprint —
never scatter than what's geometrically available, but never artificially tinier either.

- `SPREAD = 0` → every group member lands on the exact same point (today's behavior, minus the
  scalar-line artifact — still one point, just wherever `anchorT` landed on the chord instead of
  always the same `valenceToPosition` point).
- `SPREAD ≈ 0.15` (proportional) → **bounded jitter around a group anchor** — groups still read as
  visible clusters, members no longer overlap or ride one line, but the cluster visibly shrinks near
  `valence ≈ ±1`.
- `SPREAD ≈ 10` (absolute units) → **constant-footprint jitter** — same "bounded cluster" look near
  `valence ≈ 0` (chord ≈64 units, so ≈10/64 ≈ 0.16 fraction, close to the proportional default
  above), but groups near the extremes keep a similar-sized footprint instead of collapsing,
  clamped to the full (shorter) chord once it's less than 10 units long.
- `SPREAD = 1` → **full free scatter** — every member independently samples anywhere on their
  personal chord; groups may not read as visible clusters near `valence≈0` (chord ≈64 units wide).

This is one mechanism, not two separate code paths — a single `SPREAD` constant reaches every
requested behavior by hand-editing the value and re-running the demo; only its *interpretation*
switches on magnitude.

### State changes in `createValenceShiftProgram()`

- Drop `value: number[]` (scalar valence, no longer needed — position is eased directly).
- Add `travelFromX/Y: number[]`, `travelToX/Y: number[]`, `anchorT: number[]` (per group).
- `group` assignment: unchanged. `groupTarget` and `noiseOffset` are both re-rolled every shift
  (previously `noiseOffset` was fixed once at init — amended mid-build, see Resolved decisions).
- On shift (and at `init`, treating it as shift 0): reroll `anchorT`, recompute
  `travelToX/Y[i]` via the sampling above; `travelFromX/Y[i]` = current rendered (pre-wander) base
  position.
- `tick()`: same `easeInOutCubic` progress fraction `e` as today, applied directly to x/y:
  `x[i] = lerp(travelFromX[i], travelToX[i], e)`, same for y. Then layer the existing
  `noiseWanderOffset` micro-wander on top (unchanged from the current implementation) and
  `clampCoord`.
- `valenceToPosition` import is no longer used in this file — replaced entirely by
  `sampleValencePosition`.

### Spread as a hardcoded constant

No `SimContext`/UI plumbing — just a named, easily-editable constant in `valenceShift.ts`:

```ts
/** How far a group's members scatter around their shared anchor point on the target-valence
 *  chord. Dual-mode, inferred from magnitude — hand-edit to explore:
 *    0 <= SPREAD <= 1 → fraction of chord length (0 = single shared point, 1 = full chord).
 *    SPREAD > 1       → absolute canvas units (0-100 space, open-ended); holds a constant
 *                       scatter footprint as valence gets extreme instead of shrinking toward
 *                       the vertex, falling back to the full chord once it's shorter than this.
 */
const SPREAD = 0.15;
```

Editing this one value and re-running the demo moves between "tight cluster," "constant-footprint
cluster," and "full scatter" — no control-bar or `SimContext` changes needed.

## Task breakdown (TDD, one commit per task — mirrors the pattern already used on this branch)

1. **Add `sampleValencePosition` + `valenceChordEndpoints` to `voteRegion.ts`.** Tests first in
   `tests/voteRegion.test.ts` (round-trip assertions above), watch RED (function doesn't exist),
   implement, GREEN.
2. **Redesign `valenceShift.ts` to glide directly between sampled XY points**, using the hardcoded
   `SPREAD` constant and a `resolveSpreadFraction(spread, chordLen)` helper (dual-mode: `<=1` is a
   chord-length fraction, `>1` is absolute canvas units with a full-chord floor — see "Spread as a
   hardcoded constant" above). Export `resolveSpreadFraction` (or keep it module-local and test via
   the target-picking helper — whichever the existing file's export style favors) so it's unit
   testable in isolation from the RNG-driven per-tick logic. Update `valenceShift.test.ts`:
   - Existing tests should mostly still pass conceptually but will need re-verification against the
     new mechanism (positions are no longer literally `valenceToPosition(scalar)`); re-run and fix
     any that assumed the old single-line geometry.
   - New test: for `groupCount=1` with several users, after a shift, members are **not** all at the
     exact same point (chord + spread jitter is active) — this should be RED against the
     scalar-line implementation and GREEN after the redesign.
   - New test: round-trip — each user's rendered position (before wander) should map back via
     `computeCursorValence` to very close to that user's personal target valence.
   - New test: varying `SPREAD` (e.g. reconstructing the program with the constant patched to `0` vs
     `1` — or, more simply, testing the internal target-picking helper directly if it's exported)
     shows the resulting within-group spread scales up accordingly (monotonic, not just
     present/absent), proving the constant actually drives the effect claimed above.
   - New test for `resolveSpreadFraction` directly: `resolveSpreadFraction(0.15, anyChordLen) ===
     0.15` (proportional mode passes through unchanged); `resolveSpreadFraction(10, 64) ≈ 10/64`
     (absolute mode divides by chord length); `resolveSpreadFraction(10, 5) === 1` (absolute mode
     clamps to the full chord when the chord is shorter than the requested footprint);
     `resolveSpreadFraction(10, 0) === 1` (degenerate v=±1 chord doesn't divide by zero).
3. **(Separable cleanup, do last, only if time allows)** Consider whether any further code-sharing
   with `regionHoppersRealistic.ts` is now worthwhile. Given task 2's finding — Valence Shift doesn't
   need Region-hoppers' independent per-cursor move/rest state machine, since all users glide on one
   shared shift timer — there may be **nothing further to extract**; the two programs already share
   `easeInOutCubic` and `noiseWanderOffset` (done earlier this branch). Don't force an abstraction
   that isn't there; only extract if a *third* real duplication shows up.
4. **CHANGELOG.md** — one concise (per established preference — see feedback memory) entry folded
   into the existing Week 33 "Valence Shift" bullet (this feature hasn't shipped yet this week),
   describing organic chord-based positioning.

## Resolved decisions (from conversation)

1. Ship **one mechanism** (a `SPREAD` constant) rather than two separate code paths for
   "bounded jitter" vs "full scatter" — they're the same math at different parameter values.
2. **Hardcoded constant, no UI control** — the user will hand-edit `SPREAD` in the source to explore
   the range, not drag a live slider. No `SimContext`/`SimControlBar` changes needed.
3. Default `SPREAD = 0.15` (bounded jitter, groups read as clusters) so the out-of-the-box demo still
   looks like "correlated groups," with the option to hand-edit it to `1` to see full scatter.
4. No new shared "ghost" state-machine abstraction planned — the redesign turned out simpler than
   originally scoped (see task 3).
5. **`SPREAD` is dual-mode, inferred from magnitude** (`<=1` → chord-length fraction, `>1` → absolute
   canvas units, floored to the full chord when the chord is shorter than the requested footprint).
   Added mid-build: a purely proportional spread shrinks toward zero as `personalValence` approaches
   `±1` because the chord itself shrinks to a point there — real people don't cluster tighter and
   tighter just because their opinion is more extreme, so absolute-unit mode holds a constant scatter
   footprint instead, only degrading once the chord is physically too short to hold it.
6. **`noiseOffset` re-rolls every shift, not just once at init.** Added mid-build: with a
   fixed-at-init offset, a member that happened to draw a more extreme offset stayed "the extreme
   one" relative to its group for the whole session, every hop — read as fake/scripted. Scrambling
   it alongside `groupTarget` on every shift means each member's personal deviation is fresh each
   hop, same as the group's target itself.

## Files touched

```
app/utils/voteRegion.ts                          → sampleValencePosition, valenceChordEndpoints
tests/voteRegion.test.ts                         → round-trip tests for the above
app/lib/simulation/programs/valenceShift.ts       → redesigned glide (XY, not scalar), SPREAD const
app/lib/simulation/programs/valenceShift.test.ts  → updated + new tests
CHANGELOG.md                                      → Week 33 entry update
```
