# Memory Card Elevation v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.
> Spec: `docs/superpowers/specs/2026-07-12-labs-memory-card-elevation-design.md` (governs).
> Research artifacts for briefs: `.superpowers/sdd/redesign/r1..r4` + `shots/`.
> Blender pipeline: `.superpowers/sdd/char-pipeline/` (fitkit.py, build_fit*.py, tex/, char-fit1.blend).

**Goal:** Rebuild the select screen as a split-hero character select (spinning character
≈ half screen; flat 2D slot select on the other half) and rebuild all six character fits
era-authentically (paint-first), to the spec's surface system.

**Architecture:** Two lanes. Lane A (Blender, headless CLI) rebuilds the character GLBs —
proof-first on fit 1, then batch. Lane B (web) look-devs the composition, then rebuilds
`save-select/screen.tsx` + tokens + motion. Lanes run in parallel; only one lane commits
at a time (orchestrator serializes). Forward commits only on `feat/labs-ps1-rework`.

**Tech stack:** Blender 5.1 headless bpy + Cycles bake · Next.js 15 · react-three-fiber 9
(demand frameloop) · vitest + Playwright.

## Global Constraints (verbatim-binding)

- Approximate-requests law: a wall means the design is wrong — STOP, re-derive, present
  divergence. NEVER patch around a wall (flag/special case/shim/parallel path/weakened
  test). Patch-around-a-wall = Critical review finding.
- ONE live WebGL scene on the select screen (the hero). Card fan and its scene die.
- Era renderer law: NearestFilter, no mipmaps, ≤256px textures, unlit/vertex-lit, no
  normal/PBR maps. Canvas clear color == exact ink token (seam law).
- Casing law: no CSS uppercase transform on save titles ("iBank" must render intact).
- tabular-nums on all stat/year/meter numerals.
- Accent discipline: teal = system accent; per-save accent owns hero atmosphere + active
  slot; other glyph colors only on owned objects.
- Motion tokens: --ease-entrance cubic-bezier(0.19,1,0.22,1); --ease-move
  cubic-bezier(0.86,0,0.07,1); signature select transition one shared ~280ms timing;
  reduced-motion = opacity-only/static.
- Standing laws: character-agnostic code/copy/tests · no /lead/i · attribution lines
  unchanged · mulberry32 only · sounds from gestures · 44px targets · tokens-only ·
  StrictMode texture/material law · headless playwright verification only · e2e
  --workers=1 locally · forward commits only, never two concurrent committers.
- Gates: orchestrator zoom-crop review on E1 renders and E3 mock BEFORE their lanes
  scale; garment deformation verified IN MOTION; user gates only the Vercel preview.

## File Structure (targets)

- `components/labs/memory-card/save-select/screen.tsx` — split-hero layout (rework)
- `components/labs/memory-card/save-select/slot-select.tsx` — NEW flat 2D slot rows
  (absorbs index-rail semantics; roving listbox preserved; card-label visual language)
- `components/labs/memory-card/save-select/index-rail.tsx` — retired into slot-select
- `components/labs/memory-card/save-select/story-band.tsx` — folded into active-slot
  meta (small text) per look-dev
- `components/labs/memory-card/three/figure-stage.tsx` — hero stage: turntable, ground,
  fog, accent atmosphere, era renderer settings
- `components/labs/memory-card/three/card-arc.tsx` — DELETE (+ shell texture usage audit)
- `components/labs/memory-card/tokens.ts` — ink ramp (5 steps), motion tokens, grain
- `components/labs/memory-card/boot.tsx` — brand-moment rework + visibility fix
- `public/labs/memory-card/models/fits/char-fit{1..6}.glb` — repainted (Lane A output)
- `e2e/labs-memory-card.spec.ts`, `__tests__/labs/memory-card/**` — updated contracts

## Tasks

### E1 — Lane A proof: fit 1 era repaint (Blender, NO repo commits)
Brief carries r2's Blender Fix Plan. Delete tee/jeans shells from fit1; repaint garments
on body UVs; bake AO+folds+seams into one 256 atlas; face repaint (pixel eyes, brows,
mouth); Y2K silhouette items (glasses, chain, shoes) slimmed to ≤1.5cm standoff; painted
scalp hairline. Save the .blend (export-without-save incident law). Export GLB to
char-pipeline out/. Deliver: 8 turntable stills + animation frame strip (motion check).
GATE: orchestrator zoom-crop review. Iterate here until passed; only then E2.

### E2 — Lane A batch: fits 2–6 repaint + GLB swap commit
Apply the proven E1 recipe per fit (grunge band tee + cut-offs paint; skate; engineer;
rollerblade; flannel keeps a slimmed open-shirt shell). Each fit: stills + motion strip;
orchestrator spot-review each (proof-first batch law). Then ONE commit swapping all six
GLBs in public/ (sizes noted), plus updated tex sources in char-pipeline (uncommitted).
Verify: existing fit-loading unit tests still green; GLB bounds sane; clip name
'fit-idle' intact; sizes ≤ ~1.2MB each.

### E3 — Lane B proof: composition look-dev (NO commits)
Static mock of split-hero at 1440×900 + 390×844: hero left (use current fit render as
stand-in silhouette), slot-select right as flat card-label rows (active expanded with
small text: role line, year, blocks meter, stack chips), display title placement, ink
ramp + grain applied, accent atmosphere suggestion. Two variants max, self-critiqued
against r1 Cheap-Tells checklist before submission.
GATE: orchestrator zoom review; result presented to user as a checkpoint image (non-blocking).

### E4 — Structural rebuild: screen + slot select + tokens
Implement the approved E3 composition: tokens.ts ink ramp/grain/motion tokens;
screen.tsx split-hero grid (desktop) and stacked mobile (footer overlap fixed);
slot-select.tsx replaces index-rail.tsx (KEEP: roving tabindex, kind-gated select(),
keyboard journeys, aria contract — e2e names may not regress silently); story-band
content folds into active-slot meta; card-arc.tsx deleted; casing law + tabular-nums
applied; unit tests updated alongside (listbox semantics, saves mapping, casing
regression test asserting 'iBank' renders intact).

### E5 — Hero stage: turntable + atmosphere + signature transition
figure-stage.tsx: slow turntable (24–32s/rev; demand-frameloop invalidate discipline —
continuous slow spin uses a rAF-driven invalidate loop, paused off-screen and for
reduced-motion static pose); ground contact gradient + fog; per-save accent atmosphere
(backdrop ramp/rim — NOT material lights; era unlit law); canvas clear == ink token;
save-change choreography on the shared ~280ms timing (atmosphere crossfade + title swap
+ slot expand), reduced-motion instant. Preload strategy for six GLBs unchanged.

### E6 — Boot beat as brand moment + fix
Root-cause the ~250ms flash (dev vs prod verify at production build); rebuild the beat:
full 3s glyph choreography at scale, skip-on-input + Esc ownership + sessionStorage laws
intact; PS1 boot audio arming unchanged. e2e boot journeys updated if timings change.

### E7 — Test battery + e2e journey updates
Update e2e for new select semantics (slot rows, no card canvas, hero present), keep 8
journeys × 5 browsers; unit suite green; tsc; lint; `pnpm build` exit 0; live headless
sweep incl. console-clean check; mobile spot-checks.

### E8 — Final whole-branch review + poster + handoff
Most-capable-model reviewer on full branch diff (review-package from merge-base);
fix wave (one fixer, full findings list); poster regen via scripts/posters; push;
PR #10 description updated; STOP for user's Vercel verdict.

## Sequencing

E1 ∥ E3 (proofs, no commits) → gates → E4 (commits) → E2 (commits, serialized after E4
or before — orchestrator picks the free window) → E5 → E6 → E7 → E8.
