# Task List: Migrate Prototype Pages to GitHub Pages

Branch: `feat/prototype-pages-github-pages` (from `main`)

## Phase 1: Move HTML pages to docs/pages/

- [ ] **Task 1** — Create `docs/pages/`, copy `valence-onboarding-v1.html` as-is, create `docs/pages/index.html`
- [ ] **Task 2** — Copy `valence-onboarding-v2.html` to `docs/pages/`, add server input, replace `connectWs` host logic with `buildWsUrl`
- [ ] **Task 3** — Copy `valence-onboarding-v3.html` to `docs/pages/`, add server input, replace `connectWs` host logic with `buildWsUrl` (preserve `qrUrl` as-is)
- [ ] **Task 4** — Copy `mood-sounds.html` to `docs/pages/`, add server input, replace `wsUrl` host logic

### Checkpoint A
- [ ] All 5 files in `docs/pages/`
- [ ] No `window.location` WS construction in any moved page
- [ ] Pages load without JS errors

## Phase 2: Wiring (parallel)

- [ ] **Task 5** — Create `.github/workflows/pages.yml`
- [ ] **Task 6** — Update `OldFrontPage.tsx` (4 links) + `NewFrontPage.tsx` (2 hrefs) to GitHub Pages URLs; add `target="_blank"` to OldFrontPage links
- [ ] **Task 7** — Delete 4 HTML files from `public/`; add `## Week 33 (2026-07-06)` section to `CHANGELOG.md`

### Checkpoint B
- [ ] `ls public/*.html` → only `index.html` + `index.template.html`
- [ ] `grep -r "/valence-onboarding\|/mood-sounds" app/` → no hits
- [ ] `pnpm vitest` passes
- [ ] Open PR against `main`
