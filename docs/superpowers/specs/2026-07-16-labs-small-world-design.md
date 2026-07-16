# Small World — Lab Design Spec

**Date:** 2026-07-16
**Slug:** `small-world`
**Branch/worktree:** `worktree-labs-small-world` at `.claude/worktrees/labs-small-world`
**Status:** Approved design, pre-implementation

## Concept

The career told as one skip around a tiny handmade clay planet. A 3D girl in
the visual language of Pixar's *Turning Red* (chunky, rounded, toon-bright)
skips in place at a fixed screen position while the planet rotates beneath
her feet, driven by scroll. Six discovery stops — one per career chapter from
`data/experience.ts`, chronological (BlueNet 2016 → xDataGroup present) —
each staged as a themed clay prop set that grows out of the planet as the
previous set sinks away. At each stop she plays a discovery animation and
manga/comic panels take over the frame to tell that chapter.

Manifest thesis: "A clay planet small enough to walk in an afternoon — every
lap of it is a career. Scroll to skip through six chapters; the world
resculpts itself under her feet."

## Decisions (settled with Aram, 2026-07-16)

1. **Interaction: scroll-driven journey.** Scroll is the single input; no
   player control, no autonomous loop. Deterministic, polishable, touch-free.
2. **Content: career chapters.** The journey IS the timeline from
   `data/experience.ts`. Skills/technologies appear inside each chapter's
   panels.
3. **Planet: morphing stage-planet**, with a pre-agreed pivot: if morphing
   reads janky or costs too much at Gate 1 (two chapters live), pivot to one
   fixed fully-sculpted planet. Prop sets are built as independent anchored
   groups either way, so the pivot loses the morph animation, not the assets.
4. **Approach A: live R3F 3D scene** (over pre-rendered scrub and 2.5D
   illustration).

## Visual identity

- **Palette (starting system, refined only at Gate 0):** meadow green
  `#7BC47F` / deep leaf `#4E9A51` / light sprout `#A8DCA0` as ground truth;
  blossom pink `#F7A8C4` with deep accent `#E86FA4`; glazed river blue
  `#6FB7D9` with depth `#4E9EC7`; butter-cream sky `#FFF3D6` graded to a
  pink horizon `#FFE3EC`; terracotta clay paths `#D98E6A`; panel ink
  `#2B2B33`. Soft vignette over everything. Chapters tint from this base,
  never replace it.
- **Type (candidates, final pick at Gate 0 via next/font):** chapter-title
  display — Baloo 2 or Fredoka (rounded, chunky); supporting sans — Nunito
  Sans; panel lettering — Bangers or Mochiy Pop One (panels only, never in
  body copy).
- **Motion grammar:** squash-and-stretch everywhere; springy overshoot
  easing, no linear tweens. The girl's skip cycle is the metronome of the
  piece. Soft clay-dot cursor treatment.
- Clay read comes from shading as much as geometry: toon ramp / matcap, soft
  AO, subtle fingerprint roughness.

## Architecture

- Full-viewport R3F canvas, lazy-loaded behind the repo's three-free bundle
  boundary, wrapped in `<GalleryChrome>`.
- Tall native scroll track (~150vh per chapter, ≈900vh total) is the single
  source of truth.
- **`journey-timeline.ts` — pure module**, unit-tested: maps scroll progress
  → planet rotation angle, active chapter index, per-chapter morph states,
  panel visibility windows. All scene components read from it; no scattered
  scroll math.
- Girl pinned near the planet's front-top, FACING THE VIEWER and skipping
  toward the camera (Aram's direction, 2026-07-16): the planet rotates about
  the screen-horizontal axis so the surface moves away beneath her while each
  chapter's scenery rises over the front horizon below her — the viewer sees
  discoveries coming. Skip cadence distance-locked to surface rotation
  (foot-contact sync — no moonwalking). Idle bounce when scroll rests.
- Fixed camera with gentle mouse/gyro parallax. Sky gradient and light
  temperature shift subtly per chapter (each era gets its own hour of day).

## Chapter staging

Each chapter owns a themed prop set anchored to its planet region. Between
chapters the outgoing set sinks into the clay while the incoming set grows
with springy scale/slide overshoot — the swap is a visible delight, not a
hidden trick. First-pass theming:

1. **BlueNet/FreeDOM** — sprouting seedlings, small clay hotel with
   reception bell (career origin, first shoots of spring)
2. **FLYERBEE** — beehive, fat clay bees over pink flowers, winding
   delivery path
3. **360dialog** — wide blue river delta, message-pebble stepping stones,
   carrier birds
4. **Accenture (SNB)** — warm golden dunes rising from the green, palm,
   geometric bank facade
5. **AKNA** — clay market street, stacked component-block buildings
   (Yerevan pink tuff tint)
6. **xDataGroup** — blossom summit at present day: tallest hill, pink trees
   in full bloom, small vault door in the hillside

Copy rule: respect no-lead-title-claims — Senior Frontend Engineer at
xDataGroup, never Technical Lead/leading.

## Discovery moments & comic panels

- Approach: "!" burst over her head → discovery animation (jump-spin or
  crouch-and-find) → radial manga speed-lines flash at frame edges → panels
  enter.
- **Panels are HTML overlay, not 3D textures:** thick ink borders, halftone
  dots, tilted compositions. Per chapter: 1–2 generated art panels (Aram,
  ChatGPT) + one typeset panel where role/company/period/technologies render
  as real selectable HTML styled as comic captions and burst badges — this
  doubles as SEO/a11y content.
- Dismiss by continuing scroll or tap; journey ends with a "to be
  continued…" panel carrying contact links.

## Assets & pipeline

Aram generates, we integrate; procedural fallbacks so nothing blocks.

- **Girl:** asset manifest handed to Aram (exact ChatGPT prompts for a
  Turning Red-style turnaround sheet + Meshy image-to-3D settings).
  Animation lane researched first: Meshy auto-rig + animation library
  preferred, Mixamo retarget fallback. Clips needed: skip cycle, idle
  bounce, discovery jump, end wave. Capsule-proxy stand-in unblocks
  development.
- **Planet & props:** base sphere terrain + simple clay props via Blender
  MCP (allowed lane for non-character assets); hero landmarks optionally
  Meshy generations.
- **Panels:** ChatGPT generations, manifest-gated like storybook art (no
  console 404s, graceful placeholders).
- **Museum kit:** poster `public/labs/small-world/poster.jpg` (portrait
  ~3:4, ≤200 KB, generator in `scripts/posters/`) + per-lab OG image.

## Research phase (first work after planning)

Parallel research agents; docs to `docs/superpowers/research/`:

a. Meshy capabilities 2026 — image-to-3D quality, auto-rig, animation
   library, GLB export — plus ChatGPT character-sheet prompting
b. Skip/walk animation retargeting into three.js (Mixamo pipeline,
   AnimationMixer, retarget utils)
c. Reference sweep: tiny-planet / character-journey scroll sites
   (awwwards-level) + Little Prince / Turning Red visual language
d. Clay & toon shading techniques in three.js (toon ramps, matcaps,
   outlines, AO)
e. Walking-on-sphere + foot-sync techniques
f. Manga panel grammar for the overlay system

## Structure, fallback & testing

- Standard lab anatomy: manifest entry (`status: 'wip'` until final gate),
  `app/labs/small-world/`, `components/labs/small-world/`, content read only
  from `data/experience.ts`.
- No-WebGL / reduced-motion / crawler path: server-rendered illustrated
  timeline of the same six chapters (catalogue-pattern equivalent).
- Unit tests on `journey-timeline.ts` (rotation math, chapter windows,
  morph curves, panel windows). Repo convention: test files explicitly
  import from vitest.
- E2E (five browsers): lab loads, Esc → museum, panels appear at chapter
  anchors, fallback path renders, mobile touch scroll. `E2E_PORT` for
  concurrent worktrees.

## Gates (Aram's involvement, batched)

- **Gate 0 — look-dev:** girl skipping on a plain clay sphere in the
  palette. Blesses or kills the Meshy character lane before any structure.
  Character-hinged labs have failed twice; this gate is the risk kill-switch.
- **Gate 1 — morph proof:** two chapters staged and morphing. Morph-vs-fixed
  pivot decision lives here.
- **Gate 2 — full journey:** all six chapters + panels + fallback, Vercel
  preview before merge.

Between gates: orchestrator runs strict visual reviews solo (autonomy
directive); implementation delegated to subagents (opus/sonnet, never
haiku), orchestrator reviews and commits.

## Risks

- **Meshy character quality below the bar** — mitigated by Gate 0 ordering;
  if it fails, the concept reshapes (smaller/distant character or different
  hero) before structural work exists.
- **Morph jank** — pre-agreed pivot to fixed sculpted planet at Gate 1.
- **Skinned mesh + props on mobile** — keep draw calls low, merge static
  prop geometry per chapter, compress textures; perf check at Gate 1.
- **Point-light museum ceiling** (~8 labs) — this is lab #6 in the hall;
  watch lighting cost when the painting hangs.
