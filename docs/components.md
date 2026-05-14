# Components & Vote Regions

## Components

| Component | Purpose |
|-----------|---------|
| `SimpleReactionCanvasAppV1` | Full V1 app: socket, statement panel, canvas, touch layer, admin mode |
| `ReactionCanvasAppV2` | Full V2 app: YouTube embed + realtime canvas + touch layer, no statements |
| `ReactionCanvasAppV4` | Full V4 app: full-page canvas, mobile-only gate, live JSON recording |
| `ReactionCanvasAppV5` | Full V5 app: YouTube async + Supabase recording + `ReplayCanvas` |
| `Canvas` | D3 SVG layer rendering other users' cursors; `pointerEvents: none` |
| `ReplayCanvas` | D3 SVG layer replaying recorded cursors synced to YouTube timecode (V5) |
| `TouchLayer` | Transparent div capturing mouse/touch; converts position to vote state |
| `StatementPanel` | Displays active Polis statement + countdown bar |
| `CountdownTimer` | Animated progress bar counting down to next queued statement |
| `AdminPanel` | V1 queue management + vote monitoring (admin mode only) |
| `AdminPanelV4` | V4 admin: records live reaction data, downloads as JSON |
| `AdminPanelV5` | V5 admin: manages labels/anchors/participant cap, views/clears Supabase data |
| `Counter` | Legacy PartyKit starter example (not used in main app) |

`Canvas` and `TouchLayer` both accept an optional `heightOffset` prop (pixels to subtract from `window.innerHeight` for dimension math). Default is the statement panel height (~140px). Pass the YouTube player height in V2/V5.

## Vote Regions and Labels

Cursor position maps to a reaction region (`positive`/`negative`/`neutral`) via barycentric coordinate detection against three configurable anchor points (`ReactionAnchors` in `app/utils/voteRegion.ts`). Default anchors: positive top-right, negative bottom-left, neutral bottom-right.

Label presets are defined in `app/voteLabels.ts`:

| Key | Labels |
|-----|--------|
| `default` | Agree / Disagree / Pass |
| `abu` | A / B / U |
| `atomic` | Attracted / Repelled / Neutral |
| `valence` | Positive / Negative / Neutral |

Custom labels can be passed as a base64-encoded `labels` param using `encodeCustomLabels(positive, negative, neutral)` from `voteLabels.ts`.
