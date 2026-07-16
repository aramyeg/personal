# Part E benchmark (v0 SKELETON) — visual gates for the showpiece reset

2026-07-15. Measuring stick for the Part E loop (charter:
2026-07-14-showpiece-reset-goal.md). DRAFT: gate structure fixed,
thresholds marked TBD are filled from the E0 diagnosis before this
spec is pinned. All D-benchmark gates (2026-07-13-grand-book-
benchmark.md, D-G1..D-G9) remain in force as floors underneath —
they are necessary and insufficient: they cannot see cheap. E-gates
judge what the D-gates cannot: how it LOOKS and how it FEELS.

## Doctrine

- A visual gate FAILURE blocks a change even when every numeric
  test is green.
- Golden boards are the unit of judgment: standardized capture sets
  per spread, blessed by the user, diffed on every change.
- Floors only ratchet upward, same as C/D doctrine.

## Gates

E-G1 GOLDEN-BOARD DIFF (the anti-degradation gate)
  - Harness: .superpowers/sdd/bench/golden/ (built in E0d).
  - Stations per spread: rest, mid-turn 25/50/75%, two parallax
    tilt extremes, each drivable piece at ~60% travel.
  - Every change touching visuals runs diff-boards against the
    blessed set. Any image over threshold [TBD-E0d: measured
    flake-floor + margin] requires either a bless (intentional,
    improvement — orchestrator judgment, user at phase boundary)
    or a revert. Degradation never ships.
  - Blessed set lineage: user-approved at phase boundaries; between
    boundaries the orchestrator blesses only strict improvements.

E-G2 SIGHTLINE (the "book completes 3D space" law) — RESOLVED by
  E0c audit 2026-07-16
  - Technique (proven, capture-verified): run the real pose solvers
    in Node for true world-space geometry, sample each layer's own
    surface on a fine screen grid, ray-cast from the reading camera
    (book-scene EYE/LOOKAT) against all nearer layer quads. Measure
    at rest + all 4 parallax-tilt extremes (±0.07/±0.11 rad).
  - Classification (adopted from E0c): FULLY_HIDDEN >= 95%,
    MOSTLY_HIDDEN > 50%, PARTIAL > 8% (D-G7 overlap floor), else
    CLEAR.
  - Gate: no STORY-role piece FULLY or MOSTLY hidden at rest —
    HARD ZERO, no whitelist. Tilt-extreme-only crossings (> 50%
    only at a parallax corner) are reviewed, not auto-failed.
  - Partial overlaps remain governed by the D-G7 whitelist; stale
    whitelist entries invalidated by measurement are removed (the
    "ch2-hero x ch2-meadow depth-echo" entry is measured FALSE —
    meadow is 100% hidden at rest).
  - E0c measured debt (fix during E1/E2 rebuilds, worst first):
    ch2-meadow 100% (story platform, invisible); ch6-strongbox
    assembly 73–100% (box/crest/seal/coins behind ch6-fringe);
    ch4-chest assembly 70–100% (behind ch4-foreground); plus
    lower-priority scenery cases in the E0c table.
  - CORRECTION to the charter: ch3-balcony is only 2.4% occluded —
    its invisibility is CAMOUFLAGE (matching placeholder tint), an
    E-G5 art-legibility case, not a sightline case.
  - Full data: .superpowers/sdd/bench/out/e0/sightline/
    (occlusion-raw.json, occlusion-table.tsv, annotated captures).

E-G3 SCALE FLOORS (anti-debris)
  - Each spread's HERO/centerpiece: height >= [TBD-E1: fraction of
    backdrop height the approved boards establish; charter target
    "approaching backdrop height"] and footprint >= [TBD].
  - Story-role pieces: minimum on-screen size at rest — E0a data
    brackets the legibility floor: 115–215px long edge all fail,
    >= 620px reads (1600px reference viewport). Proposed floor
    ~300–400px CSS long edge; CONFIRM against the E1 boards before
    pinning.
  - Dressing pieces exempt but counted: max [TBD] small pieces per
    spread (prune law).

E-G4 FRAME-TIME + ARTIFACT (crisp motion, his pinned bar)
  - Frame-time half: during page turns and interactive drags,
    p95 frame <= 16.7ms and worst frame <= [TBD-E0b: measured
    now + ratchet plan] at reference viewport (dev-mode numbers
    recorded separately; the gate binds on production build
    measurements at phase boundaries).
  - Artifact half, ZERO TOLERANCE: no flashing, no flickering, no
    unintended dimming, no z-fighting shimmer, no texture pop-in
    during any turn/drag/spread change. Verified by burst-capture
    sequences [TBD-E0b: technique from the artifact profile] —
    any single anomalous frame is a failure.

E-G5 ART FIDELITY (in-scene == generated) — RESOLVED by E0a audit
  2026-07-16 (full ranked-degrader report:
  .superpowers/sdd/bench/out/e0/art-fidelity/findings.md)
  - Side-by-side law: every painted piece's in-scene render must
    read as the same artwork as its source file — audited with the
    E0a side-by-side method at art integration time.
  - Pipeline floors (from the measured degraders):
    (a) art aspect == mesh aspect — hard rule (v-folds already
        honor it and read well; failures were the squeezed family);
    (b) tone rule: no ACES film tone-map on flat painted prints
        (measured 17% luminance loss + desat on a full-res
        aspect-true backdrop before any other degrader);
    (c) no single-texture fold across a knee — every face of a
        folded structure gets its own per-face art brief;
    (d) art textures get max anisotropy (today: 1 vs 4 for
        procedural — the most foreshortened pieces are least
        filtered);
    (e) texel floor: >= ~0.5 texture px per screen px (pieces at
        7–11x minify all fail; <= 4x pass);
    (f) FOLD_SHADE_TINT reserved for placeholder stock — painted
        art never multiplied by the shade tint;
    (g) camouflage check: no piece tinted within legibility range
        of the neighbor it sits against (the ch3-balcony class —
        geometrically visible, visually absent).
  - OPEN BUG (fix wave, highest severity): knob-tier art loads
    (manifest + disk + 200 fetch, wiring reads correct) but the
    tier renders the kraft branch — runtime trace needed
    (timing/dispose/strict-mode suspect). Orchestrator-verified
    via edge-color branch test (gold tint.edge, not #f6eedb).

E-G6 COMPOSED INTERACTION (no lone planes)
  - Every interactive moment moves >= 2 linked parts or produces
    secondary motion + settle; a single flat piece rotating on one
    axis with no consequence is a failure regardless of physics
    correctness.
  - Eye-test half: the interaction reads as operating a precious
    paper machine.

## Review protocol

- Per phase boundary: full golden capture -> contact sheets ->
  user judgment (his pinned cadence: per phase or batched).
- Between boundaries: orchestrator runs E-G1..E-G5 on every visual
  change; subagents never bless.

## TBD ledger (fill before pinning)

- [ ] E-G1 diff threshold (from E0d flake measurement; interim
      data: noise floor 0.039% on identical rest captures — dust
      motes — vs 0.73% on a real piece move; awaiting per-station
      worst-case across all spreads)
- [x] E-G2 automated visibility technique (E0c: solver + screen-
      grid ray-cast; thresholds 95/50/8; resolved 2026-07-16)
- [~] E-G3 min on-screen px (E0a: bracketed 115–215 fail / 620
      pass; proposed 300–400px — confirm vs E1 boards); hero
      fraction still TBD-E1
- [ ] E-G4 frame-time numbers + artifact capture technique (E0b)
- [x] E-G5 pipeline floors per degrader (E0a: resolved 2026-07-16;
      knob-tier wiring bug filed for the fix wave)
