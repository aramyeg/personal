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

E-G2 SIGHTLINE (the "book completes 3D space" law)
  - From the reading camera at rest AND both parallax extremes:
    no story-role piece FULLY or MOSTLY (>50%) hidden behind a
    backdrop or another piece. HARD ZERO, no whitelist for the
    fully-hidden class.
  - Partial overlaps remain governed by the D-G7 whitelist.
  - Automated check: [TBD-E0c: per-piece visibility technique the
    sightline audit proves out — pixel-diff toggle or analytic
    projection] wired as a bench script; runs per spread change.

E-G3 SCALE FLOORS (anti-debris)
  - Each spread's HERO/centerpiece: height >= [TBD-E1: fraction of
    backdrop height the approved boards establish; charter target
    "approaching backdrop height"] and footprint >= [TBD].
  - Story-role pieces: minimum on-screen size at rest >= [TBD-E0a:
    from the texel-density audit — the size below which painterly
    art cannot read] px at reference viewport.
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

E-G5 ART FIDELITY (in-scene == generated)
  - Side-by-side law: every painted piece's in-scene render must
    read as the same artwork as its source file — audited with the
    E0a side-by-side method at art integration time.
  - Pipeline floors: [TBD-E0a: per-degrader — e.g. minimum texture
    px per on-screen px, tone/material rules, no mirror-squeeze,
    art aspect == mesh aspect within tolerance].

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

- [ ] E-G1 diff threshold (from E0d flake measurement)
- [ ] E-G2 automated visibility technique (from E0c)
- [ ] E-G3 hero fraction + min on-screen px (from E1 boards + E0a)
- [ ] E-G4 frame-time numbers + artifact capture technique (E0b)
- [ ] E-G5 pipeline floors per degrader (E0a)
