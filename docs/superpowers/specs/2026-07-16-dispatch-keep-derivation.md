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
(stagger L / sMax preserved through the 2026-07-16 rigid-fold
re-derivation; only collapse paths changed):
- semaphore: L 0, sMax 0.09, range 90deg; pivot bisector-x 0.90
  (above crown ridge 0.84), arm len 0.16. UNCHANGED — at close it
  lies along the fold-invariant spine axis (0.015 residual =
  paper thickness).
- iris → ROOST-MOUTH SHUTTERS (re-derived rigid): 4 flaps hinged
  on the VERTICAL edges of the loft walls (KEEP[2] wallL+wallR,
  2 per wall), blade len IRIS_BLADE 0.10, deploy range rad(68),
  free edge swings +z (closed, in-wall) → +n (open, outward);
  z-stations 0.25/0.75, height band r 0.25..0.85. Off-wall reach
  0.10·sin(deploy) → 0 at close (rides a folding wall — the
  knee/lid idiom). MORE on-concept than the old floating ring:
  the shutters ARE the roost mouths' shutters.
- counterweight → IN-PLANE SASH-WEIGHT (FINAL, third derivation
  2026-07-16): a rigid block descending WITHIN the hall flank-wall
  plane (KEEP[0] wallR q1) as the winch winds. CW_R_TOP 0.60,
  CW_DROP_R 0.40 (≈0.10 world descent down the flank), CW_LIFT
  0.003 (z-fight seat off the wall face), block half-size CW_BW
  0.045 (z) × CW_BH 0.04 (up), extent within r [0.05, 0.85].
  Cam: drop = outCam(s(theta), L 0.11, sMax 0.07) · E(beta) — a
  FRACTION of CW_DROP_R, not an angle. Off-wall reach ZERO by
  construction → N8 wedge containment inherits the wall's own
  proof (measured counterweight-only min wedge −0.003 = the seat
  lift, over an 80×80×60 grid). At close E→0 returns it to the
  top and it rides the folded wall flat. A literal weight
  descending the flank. If a longer visible drop is ever wanted:
  the same block on the GALLERY flank is a zero-wedge-risk
  re-station (derive on demand).
  FORBIDDEN VARIANTS (both bench-recorded): the down-swing
  (−cos·e2 + sin·n; tip through the swinging page, worst +0.278
  at outgoing t 0.75; no hinge height fixes it — probes r 0.75
  still 0.13) and the vertical-hinge swing-out (lateral +n reach
  survives at partial deploy). Any counterweight with off-wall
  reach is the rejected class.

  WINDING LAW (integration find, 2026-07-16): the bench's
  storyPatches winds wallR z0-first (INWARD seat normal); the
  render's solveBoxPose winds z1-first (OUTWARD, FrontSide). Any
  HINGED rider on a keep wall therefore swings in OPPOSITE
  directions in bench vs a naive render port (measured: same
  constants, −0.015 contained vs −0.080 through-page). Every
  future wallR/wallL rider must reconcile winding explicitly
  (reorder the render quad to the bench's proven frame, as the
  shutter port does) — or better, prefer riders that TRANSLATE in
  the wall plane (the sash-weight idiom), which are winding-
  insensitive by construction. This hazard is a second,
  independent reason the in-plane counterweight is final.
Bench corrections (derive-keep-winch.mjs, all 7 gates green):
- N4 = BODY CONTAINMENT at book-closed (tL=tR=PI): max off-page
  world-Y <= FLAT_TOL 0.02; measured 0.0150 (semaphore spine
  residual is worst; shutters + panel fold flat). Never
  deployment-angle-only again.
- N6 excludes each body's GLUED host surface from D-G2 (shared
  hinge = legal joint, same rule as adjacent-story seams);
  0 illegal over full theta sweep + tilts. N7 real-time 81%
  margin; cams monotone C1 (cw slope 3.93).
- N8 (added after the A10 mid-turn dip) = MID-TURN WEDGE
  CONTAINMENT: every body point stays in the page wedge
  (dot(p,nL) >= −tol AND dot(p,nR) >= −tol, tol = paper 0.02)
  across the full beta × theta grid on BOTH turn paths. Measured
  min −0.0150 (the semaphore's at-close spine residual, inside
  paper thickness). Close-only containment (N4) is NEVER
  sufficient for bodies that deploy laterally — N8 is mandatory
  for every future user-drivable rider.
The old fixed-lateral-offset iris ring (R 0.24 perp plane) and
counterweight block (bisector-y 0.31) are FORBIDDEN geometry —
they sit ~0.3 proud at close (root cause: fixed lateral offsets
don't scale with sin(beta/2) the way box panels do).

WINGS: paint-on-keep back walls. The tested off-spine flat config
(front hingeX 0.64 / z 0.12 / w 0.36 / h 0.28; rear 0.86 / −0.16 /
0.46 / 0.32) FAILS real-time — never ship as erecting flats.

SKYLINE (validated GO, derive-keep-skyline.mjs — the conditional
low mound cleared all gates): fold-flat 7.5e-10, zero D-G2 vs keep
(turns + 4 tilts), zero mound-vs-mound, real-time 3% margin.
FEASIBLE BAND (hard): mound fore-hinge F in [0.64, 0.75] — inner
edge F−2w >= 0.44 clears the keep's mid-fold sweep; further out
busts the swinging-page vertex speed cap. Shippable config
(mound family, page-driven envelope, no knob): 3 mounds per outer
page stepping in Z (depth, not X) — F 0.64/0.72/0.75,
w 0.08/0.08/0.07, aRest 58/60/52 deg, zc −0.30/−0.02/0.26,
ridgeLen ~0.16. A low rooftop line flanking the keep.

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
- skyline mounds — reuse the existing mound poser (tabpiece mound
  path / knobtower tierQuads), page-driven by the envelope, no
  knob: a small 'skyline' layer or fold into the tabpiece family.
  No new solver.
- Loft die-cut arch walls = ART (per-face briefs), no mechanism.

ART-BRIEF CORRECTION: the board's wing-rank ×3/side STAND entries
are REMOVED. Replaced by (a) painted aerial-recession bands within
the keep's upper back-wall faces (stepped rooflines, dusk-violet
recession), and (b) skyline-mound ×3/side (STAND, low slate
rooftops with amber windows, dusk-violet on the deepest).

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
