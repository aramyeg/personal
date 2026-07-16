# The Dispatch Keep — derivation handoff (E1 pilot)

2026-07-16. Bench-proven mechanism spec for the approved pilot
showpiece (board: .superpowers/sdd/bench/out/e0/bakeoff/ch3/
board.md; charter: 2026-07-14-showpiece-reset-goal.md). All
numbers reproducible: `node .superpowers/sdd/bench/
derive-keep-{stack,gallery,winch,wings}.mjs`. Decisions herein are
orchestrator calls under the autonomy amendment, reasoning in the
ledger.

## Verdicts

1. STORY CASCADE — 9/9 gates. Four stacked BOX FOLDS; each story
   = boxPose(+baseH) seated on the story below's flat lid. The lid
   opens at dihedral EXACTLY beta, so the stack is one rigid chain
   driven by the page: fold-flat exact (off-page 0.0), glue-chain
   gap 0.0, rigidity 3e-15, 0 illegal collisions (rest + tilt),
   crown world-Y 0.844 = 107% of backdrop crest, real-turn worst
   step 34% under GLOBAL_CAP.
   DECISION: stories rise in proportional LOCKSTEP (all geared to
   beta). Temporal stagger REJECTED — a per-story cam re-times
   geometry against the glue chain (the D-G5 shear wall). The
   staged-drama budget lives in the winch.

2. JUTTING BALCONY — 6/6 gates. Two-panel deck riding the HALL
   LID (the gallery floor), overhanging +z toward the reader;
   folds flat by construction. Flat-fold 3e-10, rest rake 2deg,
   containment maxZ 0.44 < fore-edge 0.75. SIGHTLINE: 0.0%
   occluded at rest AND all 9 parallax tilts (the E-P4 reversal
   of the old invisible ch3-balcony). Gallery front must be an
   OPEN ARCADE (capFront:false).

3. TOWER-HOIST WINCH — 7/7 gates + H1–H8 mapping. Reuses the
   popup-knobtower Scotch yoke s(theta)=crankR(1−cos theta);
   STAGGERED slack thresholds sequence THREE outputs from one
   drag: semaphore (engages 0deg) → shutter-ring iris (55deg) →
   counterweight drop (81deg). Crank exact 5.6e-17, all cams
   monotone + C1, fold-flat 0.0 for ANY frozen theta (disc
   remembers the twist), THETA_MAX 112.6deg (~0.31 turn, one
   comfortable drag), 0 illegal, autonomous-collapse real-time
   margin 88%. This is the E-G6 composed-machine moment.

4. STAGE-SET WINGS — WALL, honestly derived (3 re-derivations in
   the bench header): a tall spine-anchored wall behind the keep
   is geometrically impossible (keep back-caps bulge to z=−0.559
   standing; page ends −0.75; two central spine talls always
   intersect). Off-spine erecting flats at readable height bust
   real-time by 46%; short ones catch the keep's mid-fold sweep.
   DECISION: the citadel canyon is PAINTED aerial recession on
   the keep's own stepped upper back walls (rides the keep — zero
   real-time cost, no separate collider), plus one low skyline
   mound ONLY if it clears D-G2 + real-time in a bench check at
   integration; otherwise dropped. Staged-lift-cam alternative
   REJECTED (re-timing class, third occurrence). Art consequence:
   the board's wing-rank ×3/side briefs become painted recession
   bands within the keep back-wall faces (+ possibly one
   skyline-mound brief).

## Constants (bench-verified)

World: PAGE_W 1.15, PAGE_H 1.5, rest bloom 176deg, reading cam
EYE[0,2.6,2.9] LOOKAT[0,0.32,0.15] fov 34, GLOBAL_CAP 0.0497,
D-G2 illegal iff plane-angle >= 15deg AND crossing height >= 0.028.

STORIES (stacked box folds; baseH = cumulative lower height;
telescoping a_k <= a_{k-1} and nested z-spans are REQUIRED,
bench-asserted):

| story   | a    | H    | z-span        | roof  | capFront | capBack | baseH |
|---------|------|------|---------------|-------|----------|---------|-------|
| hall    | 0.30 | 0.26 | [-0.26, 0.26] | flat  | false    | true    | 0.00  |
| gallery | 0.26 | 0.22 | [-0.22, 0.22] | flat  | false    | true    | 0.26  |
| loft    | 0.22 | 0.18 | [-0.15, 0.15] | flat  | true*    | true    | 0.48  |
| crown   | 0.11 | 0.10 | [-0.11, 0.11] | gable (rise 0.08) | — | — | 0.66 |

hall: open arched mouth, lit interior + counter inside. gallery:
open arcade loggia. loft (*): walls carry die-cut arch voids —
see-through belfry (art, not mechanism). crown: spire; top
world-Y 0.844.

BALCONY: two-panel deck on the hall lid, world half-width 0.17,
z [0.24, 0.44] (starts just in front of gallery wall 0.22 → 0%
occlusion), world-Y 0.26.

WINCH: disc side 'left', hubD 0.34, hubZ 0.30, discR 0.13,
crankR 0.13 (pin on rim), THETA_MAX 112.6deg. Outputs
(stagger L / sMax / range):
- semaphore: L 0, sMax 0.09, range 90deg; pivot bisector-x 0.90
  (above crown ridge 0.84), arm len 0.16
- iris: L 0.055, sMax 0.075, range 58deg; rim bisector-x 0.66,
  ring R 0.24 (outside loft walls), N=6 blades
- counterweight: L 0.11, sMax 0.07, drop 0.24; lateral 0.31
  (outside gallery wall), xTop 0.62
All outputs: out_shown = out(theta) · E(beta); E(0)=0 → exact
collapse at close; the disc holds theta (H4).

WINGS: paint-on-keep back walls. The tested off-spine flat config
(front hingeX 0.64 / z 0.12 / w 0.36 / h 0.28; rear 0.86 / −0.16 /
0.46 / 0.32) FAILS real-time — never ship as erecting flats.

## Layer plan

NEW:
- book/popup-keepstack.ts — stacked-box poser: boxPose(+baseH)
  per story with per-story cap flags; emits BoxPatch[] per story;
  renders through the existing popup-box-layer.tsx renderer (one
  instance per story). The keep is ONE content entry expanding to
  4 box poses.
- balcony deck — two-panel deck riding a box lid (a 'lidoverhang'
  dress variant on popup-box-layer, or a tiny dedicated two-panel
  layer). Rigid ride, zero DOF.
- book/popup-keepwinch.ts — extends popup-knobtower: one disc
  (H4 'knob' grab kind, existing use-book-input channel) driving
  3 cammed output bodies. Release holds theta.
- Loft die-cut arch walls = ART (per-face briefs), no mechanism.

FATE LIST (mechanism-grounded):
- ABSORB ch3-towers + ch3-rank → painted recession on keep back
  walls (their v-fold mass retires).
- ABSORB ch3-balcony → the hall-lid overhang deck (child v-fold
  dies).
- ABSORB ch3-counter (+ledgers +scale) → interior dress inside
  the hollow hall.
- ABSORB ch3-towerworks + ch3-semaphore → popup-keepwinch (both
  die into it).
- KEEP ch3-raven-a (hero raven at crown), ch3-fringe (fore wall).
- PRUNE ch3-perch-raven, ch3-sorting, ch3-raven-b.

Integration order: keepstack (core) → balcony (rides hall lid) →
winch (rides crown/loft) → wings art → per-face art briefs.
Every integration step diffs against golden blessed v1 (E-G1);
spread-4 boards will intentionally change wholesale — bless flows
through the orchestrator only.
