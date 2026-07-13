# Part D benchmark (v1) — gates for the grand book

2026-07-13. The measuring stick for the Part D loop (goal charter:
2026-07-13-grand-book-goal.md). Same doctrine as the C-series: every
gate is a numeric floor in tests/benches PLUS a capture review half;
floors only ratchet upward; where a spread measures above its floor,
it ratchets at the measured value.

## Gates

D-G1 VARIETY (P1) — covenant test over CHAPTERS
  - Families-per-spread ≥ 2 (target 3 by end of D5). Family derived
    from mech + seat + drive (vfold clan / platform-quad / box /
    fan / strip-driven / kinetic-linkage / spiral / stage-set).
  - Hero rotation: each spread declares a hero layer; no two
    consecutive spreads share the hero's family.
  - Book-wide by end of D5: ≥ 6 families have been hero at least
    once.

D-G2 FULL-SWEEP COLLISION (P2) — bench + vitest
  - Zero interpenetration beyond margin 0.005 between any two solved
    panels of a spread at 25 stations across the fold sweep (from
    near-closed ~8° to rest bloom), not just at rest. Below ~8° the
    closed-stack model owns the geometry.
  - Strip-driven pieces scrub BOTH domains: page angle x strip
    travel (11 travel stations per page station on touched pairs).
  - Replaces/extends A9. Current A9 rest-only version is the floor;
    D2 raises it to the sweep.

D-G3 DRAW ORDER / OCCLUSION (P2) — probe + capture review
  - At every capture station, no piece renders through a nearer
    piece; z-order audit enumerates offending pairs. The "covered
    and messed up" class of bugs lives or dies here.

D-G4 FLAT-FOLD (P2) — existing, kept and ratcheted
  - Closed book: every mechanism folds flat within its family
    tolerance (exact seats 1e-9, general 1e-6). New mechanisms enter
    at these tolerances or tighter.

D-G5 MOTION (P2) — benches + eye-test
  - No-snap: across the sweep, max per-vertex frame step < 3x mean
    step (the pull-strip bench gate, generalized to every family).
  - Family character preserved (floors from measured benches): strip
    pieces early-rise (>= 45 deg lift by quarter-rest), v-folds
    late-bloom; a family's curve shape may not migrate toward
    another's.
  - One-clock rule stays absolute; capture review judges hitchless
    page turns at real speed.

D-G6 LIGHT (P3) — covenant + capture review
  - Every piece with elevation > 0.02 casts a contact shadow placed
    under its footprint; shadow strength scales with bloom (existing
    sin^2 law is the floor) and with elevation by end of D3.
  - Key-light consistency: shadow offset direction identical across
    all spreads.
  - Silhouette gate: captures with art textures disabled must still
    read as a compelling paper scene (Sabuda principle) — capture
    review at every phase boundary.

D-G7 ART & OVERLAP (P4) — covenant + call sheet
  - Every layer id has an art call-sheet entry (the id contract is
    already law; the call sheet becomes complete).
  - Screen-space overlaps between story-role pieces at rest must be
    whitelisted, and each whitelist entry names its complement
    reason (framing / depth echo / silhouette dialogue). Unlisted
    overlap = failure.

D-G8 WOW (P4) — content check + eye-test
  - Each spread declares exactly one hero layer whose motion is the
    signature moment; hero sweep displacement >= 0.35 x page height
    (or the piece is interactive, D6+). Eye-test confirms the moment
    actually lands.

## Capture set (the review half, produced at every phase boundary)

Per spread: rest bloom, three mid-turn stations, closed stack, one
silhouette-mode shot (textures off), two tilt extremes. Plus cover
and one full turn recording. Delivered as a contact sheet for the
user's eye-test; captures happen twice (warm compile, then settled).

## Loop protocol (what "working in a loop" means)

Per roadmap item: derive bench → engine + tests → gates green
(ratchet where measured above floor) → captures of touched spreads →
commit → ledger entry → next item. PAUSE only (a) at phase
boundaries, presenting the capture contact sheet for eye-test, or
(b) when a wall demands re-derivation — present the divergence and
the re-derived design, per standing doctrine. Keepsake/knob stay
parked until D6. Report outcomes, not mechanism math.
