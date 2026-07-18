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

## Resolved: 120° per chapter (Aram called it, 2026-07-17)

The parked question is decided: per-chapter turn goes 60° → 120°, total
720° = TWO full laps; "the planet will need to generate new content" for
the revisited longitudes. Design:

1. **Mechanical switch (Phase 3a):** `ROTATION_TOTAL = 4π`; CHAPTER_SLICE
   derives (120°). Chapter sets already anchor via `chapterTheta` — sets
   4–6 land on lap-1 longitudes mod 2π, which is SAFE by the morph
   adjacency rule (only chapters i and i−1 are ever visible; the set that
   used a longitude one lap ago is fully sunk). Girl crosses each bridge
   twice — a real planet, fine. Pacing: track lengthens
   (TRACK_VH_PER_CHAPTER 150 → ~240) so degrees-per-scroll stays cozy;
   timeline tests that pin 2π-derived rotations update deliberately (the
   ONE sanctioned test change). Burst/panel windows are segment-fractions —
   unchanged.
2. **New content on lap 2 (Phase 3b — "changing the landshaft"):** the lap
   boundary (rotation = 2π) falls exactly at the chapter 3→4 transition,
   whose PANEL DWELL freezes rotation — the world morph plays there,
   behind the comic panel, and finishes by the release. Mechanism: bake
   TWO land variants (bumpA/bumpB + colorsA/colorsB); CPU-lerp the
   geometry's position+color attributes over the dwell window;
   `terrainBump`/`surfaceYAt`/`walkYAt`/`anchorTransform` gain a lap-blend
   parameter so ground math follows the morph. CONSTRAINT: water geography
   (ocean/sea/lake/rivers/crossings) stays IDENTICAL across laps — bridges
   and dryness contracts must hold on both — only LAND changes: autumn
   color story (meadow→honey, blossoms→amber), mountains grow, canyon
   deepens, snow region spreads; dressing/delights get lap-gated variants
   (grow/sink like ChapterSets). One dryness scan per variant.

## Round 5 (2026-07-17): backstage restaging — the planet as a rolling stage

Aram's call, confirmed in his own words: the hidden side of the planet must
"render new stuff" while out of view, so each chapter's arrival brings a
genuinely fresh scene — this SUPERSEDES the one-shot lap-boundary panel morph
(Task 18), which is absorbed as content. Confirmed scope: terrain + water +
bridges + dressing all restage per chapter wedge. Also confirmed: (a) the
ocean-through-river read failed and gets redone properly (ocean-scale blue on
BOTH sides, visibly threaded by a river), (b) MORE clay definition, (c) NEW —
a deep-brown canyon-like plasticine CREEK as one stage's centerpiece,
(d) stronger per-scene color accents.

**Architecture — the renewal front:**

1. **Six wedge-scenes.** With 120°/chapter × 6 = two laps, the planet has 3
   longitude bands (banded by `chapterTheta` arcs, meridians at
   j·2π/3 + STANCE_ALPHA); each band carries TWO authored variants — variant
   A themes chapters 1–3, variant B themes chapters 4–6. 3 bands × 2 = six
   distinct scenes, one per chapter.
2. **The traveling flip.** Each vertex (canonical theta θc, wrap aligned to
   the band-0 meridian) blends A→B once, while provably occluded:
   `renewalGate(θc, rotation)` ramps over rotation−θc ∈ [FLIP_START,
   FLIP_START+FLIP_WIDTH] (≈[1.4, 2.4]), the window diametrically opposite
   the view axis (camera fov 38, pitch 20°, 5.5R) — hidden at EVERY latitude
   including relief tips ≤0.35R peeking over the limb (numeric bench proof).
   Whenever a point is visible its gate is exactly 0 or 1: nothing ever
   morphs on camera; the reveal is scenery rising over the front horizon
   already final.
3. **Ground truth follows.** surfaceYAt/walkYAt/anchors lerp bumpA/bumpB by
   the same gate — the spine may now DIFFER per lap (the old spine-identity
   gate retires); the girl always stands on an exactly-flipped surface.
   Crossings/bridges become per-variant lists; bridge props gate like
   terrain. Water geography is variant terrain dipping under the global
   water sphere — only the water sphere's depth COLORS dual-bake.
4. **Structural seams.** (a) Polar caps |nx| ≳ 0.75 are variant-INVARIANT
   permanent oceans (right AND left limb always deep blue — silhouette-pop
   safe, and Aram's "ocean on both sides" holds every frame); (b) neutral
   connective meadow bands (~0.12 rad) at the three band meridians, where
   every variant converges to the shared base — covers the canonical-wrap
   discontinuity and lets consecutive scenes abut cleanly.
5. **Wedge themes** (creative license per his vibe law): A0 BlueNet spring
   meadow; A1 FLYERBEE flower riot; A2 360dialog GRAND DELTA — right polar
   ocean → wide channel under her bridge → left polar ocean, the redone
   item-(a) read; B0 Accenture golden dunes + oasis; B1 AKNA deep-brown
   plasticine canyon creek (his item c); B2 xDataGroup winter-meets-blossom
   summit. Every wedge threads water to a polar ocean and owns ≥1 bridge;
   every wedge gets a saturated accent identity (item d).
6. **Clay push (item b):** hand-pinched vertex irregularity (tangential
   jitter breaking the geodesic grid), bigger thumb dents, stronger crease
   dirt, chunkier water lumps — render-only, pastel calibration guardrails
   from Task 16 stand.

Gate-0 verdict (2026-07-16): palette approved for now; facing-the-viewer
orientation confirmed and shipped. Future dressing he named (not now):
earthy textures, blue water on the globe, bridges, animals along the sides.

Gate-2 direction (Aram, 2026-07-16, after Phase 2 shipped):
- Girl scale raised 0.53 → 0.7 at his immediate ask ("bigger") — she should
  command the planet. Badge and shadow retuned with it.
- THE PLANET IS THE NEXT BIG WORKSTREAM — "it doesn't look good right now."
  Two directions he's weighing, undecided: (a) richer SMALL planet — clay
  water, mountains, valleys, more trees, overall variety (procedural or
  generated); (b) BIGGER planet cropped to its top half, which would also
  absorb the >360° rotation question. His lean: "I'd rather keep the planet
  small." Resolve with a look-dev comparison before committing either way.
- Per-chapter weather/time-of-day: confirmed as a real future direction
  ("would also be cool, we will work towards it later") — upgrades the
  spec's sky/light-shift promise from parked to planned.

## Round 6 (2026-07-18): asymmetric continents, per-element clay identity, girl blend

Aram's direction (sent mid-Task-21, verbatim intent): (1) he dislikes the
symmetric always-both-limbs oceans — his initial vision is ONE big ocean on
the left, connected/filled by flow from the land; the planet should read as
CONTINENTS — land masses connected, narrowed into isthmuses, taking
interesting continent shapes, some cut off by water so the girl crosses on
bridges. Variety means asymmetry. (2) The clay push means each clay FIGURE
has its own molded structure so it doesn't blend smoothly into the planet —
mountains, canyon ridges, and water (tougher, deeper-blue, molded at
places); flowers, trees, all small details get descriptive shapes and a
deeper palette. (3) Open question he wants answered: techniques to blend
the generated girl GLB with the generated world (shadows, palette). (4)
Process: a visual verify loop per step — back to planning or green-light.

Architecture:

1. **Asymmetric water plan (ground truth, bench-gated).** The ±x rotation
   poles are the only screen-stable points — whatever sits there is on the
   limbs forever. So: POLAR_L (−x) grows into THE ocean — radius up,
   coastline noise-warped (deterministic, low-frequency) so the left limb
   reads as an irregular sea with bays and headlands, not a circle cap.
   POLAR_R (+x) is DELETED as an ocean; the right limb becomes continental
   coast — land with warped shoreline where a narrower shelf sea laps in
   only at some longitudes (wedge-varying is allowed off the invariant
   core). Invariant rule stays structural but asymmetric: A === B wherever
   |nx| beyond the silhouette-safe latitude, on BOTH limbs — the left limb
   is invariantly ocean, the right limb invariantly coast.
2. **Continents.** Wedge interiors reshape from "meadow with features" to
   continent reads: connected land masses, at least one narrow isthmus
   moment (land pinched between waters), at least one wedge where the
   lane's land is cut off and ONLY a bridge continues the journey. The
   grand delta redesigns: with no right ocean, the artery rises inland
   (highland spring/lake chain) and drains INTO the left ocean — "the
   river fills the ocean on the left", Aram's original round-5 sentence,
   now literally the geography.
3. **Non-negotiable benches BEFORE look-dev:** renewal-scan 0 violations
   (new asymmetric relief on limbs must respect per-latitude occlusion
   tips), lane dryness both variants except authored crossings, all seated
   prop anchors dry on their own variant, tips ≤ 1.35R, meridian identity
   (bumpA === bumpB on meridians), delta-continuity scan rewritten for the
   new inland-source artery.
4. **Per-element clay identity (materiality, look-dev-gated).** Per-biome
   displacement signatures instead of one global noise voice: ridged sharp
   noise on mountain groups, stratified terrace layers on canyon walls,
   deep molded troughs vs shallow rims on water (structural depth + darker
   abyss tint — beyond Task 21's lump-scale chunking), distinct silhouette
   pushes on props (flowers/trees get shape variants + deeper per-scene
   palette entries). Rule: identity per FIGURE, smooth blending is the
   failure mode being fixed.
5. **Girl GLB blend (answer + implementation).** In payoff order: share
   the world's meshToonMaterial 4-step gradientMap on her materials (one
   ramp family = "she belongs"); palette-grade her texture toward the
   pastel set (compress saturation/contrast); keep/retune the contact
   blob to the ramp floor; slight flat-normal clay treatment so her
   surface family matches the faceted world; same crease/AO logic; cast
   shadow only if the rig allows without new lights. Binding guardrail:
   NO fill light — if the shared ramp costs shadow-side readability,
   STOP and report.
6. **Verify loop (process, now formalized).** Every task ends in a
   capture gate reviewed by the orchestrator against the task's named
   levers: green-light, or a punch list back to planning/implementation.
   Ground-truth tasks additionally gate on benches BEFORE any look-dev.
7. **Amendment (Aram, 2026-07-18 08:22): the polar caps must NOT be
   stone-set.** He rejects screen-stable oceans as a permanent structure —
   the planet is non-canonical; rotation generates new landmasses, and
   the ±x caps should evolve too. Accepted as a separate task (Task 25)
   on top of the asymmetric-continents base: Mechanism A first — extend
   the discrete renewal flip to the caps and let the occlusion bench
   decide empirically (cap relief is low; near-pole points at |nx|≈0.8
   may already own a hidden window); fall back to Mechanism B —
   continuous phase-driven coastline evolution where EVERY frame is a
   valid coastline (no invalid half-state to hide), the only mechanism
   fully valid at the limb itself. Task 22 therefore implements its cap
   coastline as a parameterized per-variant-capable function even while
   A === B holds, so Task 25 diverges caps without a rewrite; its
   invariance tests are pinned as "current regime, Task 25 rewrites".

## Risks

- **Meshy character quality below the bar** — mitigated by Gate 0 ordering;
  if it fails, the concept reshapes (smaller/distant character or different
  hero) before structural work exists.
- **Morph jank** — pre-agreed pivot to fixed sculpted planet at Gate 1.
- **Skinned mesh + props on mobile** — keep draw calls low, merge static
  prop geometry per chapter, compress textures; perf check at Gate 1.
- **Point-light museum ceiling** (~8 labs) — this is lab #6 in the hall;
  watch lighting cost when the painting hangs.
