# Valence Onboarding Pages

Standalone HTML files in `public/` — **not React components**, no PartyKit, purely client-side. Linked from the index landing page.

| File | Rendering | Notes |
|------|-----------|-------|
| `valence-onboarding-v1.html` | 2D Canvas (native) | Geometry, animation, trace, group, and color controls |
| `valence-onboarding-v2.html` | Three.js WebGL | Adds 3D orbit view (drag/scroll); per-element style grid (radial/cursor × group/valence) |
| `valence-onboarding-v3.html` | Three.js WebGL | (see file for details) |

Both visualise the "valence wave — cross-section" concept: participant reactions arranged along diametric or radial geometry, animated sequentially or simultaneously. Dark minimal aesthetic: `DM Mono` font, `#0f0f0e` background, muted `rgba(200,198,190,…)` palette throughout.

Because these files are self-contained, changes to React components or `app/styles.css` do **not** affect them — they must be edited directly.
