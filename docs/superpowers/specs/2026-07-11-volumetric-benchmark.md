# Volumetric Pop-up Benchmark — "More Dimensions"

**Goal (user, 2026-07-11, verbatim fragments):** "all the pieces are a piece
of paper folded in 1 dimension, while I remember that paper cutouts from
pop up books contained papers that were cut to have more dimensions,
sometime those would be 3d where from sides they would also tell a story
and would be hollow in the middle and the top would again be a painting" —
plus: "there is no real difference right now with the double fold"; the
counter/awning/stable tents "do not translate the idea"; riders must sit
"at distances and angles that they match the scene"; "more depth in the
overall book"; fold variety beyond the V ("a rectangle shaped fold").

Research foundation: docs/superpowers/research/2026-07-11-popup-box-mechanisms.md
(Ruiz 11-patch box-fold, Li type-1 45-degree diamond box, Li four-vector
closed-form pose framework, Winder step-fold equations).

## Model under test

Everything remains a pure function of the spread dihedral (the physics
covenant is unchanged). New mechanism families to implement, in order:

1. **BOX** — an enclosed prism with volume: walls + two-piece lid +
   backbone (Ruiz 11-patch) or the 45-degree diamond variant (Li type-1,
   8 patches). Faces are separate rigid patches; the assembly is 0-DOF at
   every beta (the backbone/brace requirement is now understood — see
   research doc section 2). Variants: lidded (painted top) and hollow
   (open top, interior visible — inner faces show unpainted paper).
2. **STEP FOLD** — Winder four-bar with L1+L4 = L2+L3, popping a
   rectangular profile (riser + tread) at 90 degrees: counters, tables,
   terraces. The "rectangle shaped fold."
3. Existing v-folds/tents/children stay, but tents are DEMOTED: no piece
   whose story needs a camera-facing face may be a gutter tent again.

Implementation path: the Li four-vector decomposition (lit doc section
3.2 + research doc section 5) — decompose each patch vertex once at the
open pose, re-evaluate per frame; rigidity is guaranteed by construction,
so patch shapes FOLLOW from the framework instead of being guessed.

## Part A — geometric invariants (extends the existing 100+ suite)

A12. **Multi-patch rigidity.** Every patch of a box/step assembly keeps
     all its pairwise vertex distances constant across the full beta sweep
     (<= 1e-9 relative) — no naive lid that stretches (our first diamond
     attempt drifted 0.37: the failure this test exists to catch).
A13. **Assembly closure.** Shared hinges between patches remain coincident
     lines at every beta (<= 1e-6): lids stay on walls, caps stay on the
     backbone plane, nothing tears.
A14. **0-DOF bracing.** The solved pose is locally unique: perturbing any
     internal patch angle at fixed beta violates a constraint (numeric
     check in the derive script; in-engine, poses come from closed form so
     this is a derive-time gate).
A15. **Volumetric flat-fold.** Boxes collapse completely flat at closed
     (all patches within paper thickness of the page sandwich) and their
     folded footprint stays inside the page (A3/A4 extended to multi-patch
     pieces).
A1-A11 continue to apply to every new mechanism (glue coherence, rigidity,
containment, continuity, separation, child glue-on-paper).

## Part B — visual gates (the "does it translate the idea" bar)

B14. **Camera-facing faces.** A box's front face reads squarely toward the
     reading camera at rest — a counter looks like a counter, a stable
     like a barn. (The tent failure mode: faces that only look left/right.)
B15. **Sides tell a story.** Under pointer tilt, a box's side faces are
     visibly DIFFERENT art from its front (side walls carry their own
     painting), and the parallax makes the volume readable.
B16. **Hollow and lidded reads.** At least one hollow box (interior
     visible from the high camera, inner faces read as raw paper) and one
     lidded box (painted top readable from the high camera) ship.
B17. **Fold-variety per spread.** No spread's construction reads as "all
     the same fold": each chapter mixes at least two mechanism families
     with visibly different silhouettes (V, box, step, children).
B18. **Riders at scene distances.** Small pieces sit at distances/angles
     that complete the scene rather than overlapping their parent's art
     (the ch1 sign/dormer standard).
B19. **Depth under tilt.** The doubled pointer tilt shows clean parallax
     between at least three depth planes per chapter spread, with no
     frustum clipping at the tilt extremes.

## Loop protocol

Same as the physics benchmark: derive numerically first (scripts in
.superpowers/sdd/bench/), Part A green before any capture, capture review
against Part B every iteration, verdicts in .superpowers/sdd/progress.md.
The physics benchmark's PASS remains a hard floor — no regression of
A1-A11 or B1-B13 is acceptable while adding volume.

## First composition targets (from the user's review)

- ch3 dispatch counter -> step fold or lidded box (desk front + top).
- ch1 stable -> hollow or lidded box barn (front facade + roof top).
- ch5 awning -> re-imagined once the box exists (canopy off the stall row
  or a boxed market stall; NOT a gutter tent).
- ch6 treasury + ch1 inn -> candidates for box buildings with painted
  side walls once he regenerates face art (call sheet v5 will spec
  multi-face strips: front / sides / top in one image with marked splits).
