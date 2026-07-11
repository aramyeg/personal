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

**Escalation (user, 2026-07-11, second round):** "make sure the whole
aesthetics improves and the experience truly leads to a 3d illusion
created with papers territory, just a flat piece of paper should[n't] be
on our agenda, only some backdrops or scene settings maybe." This
upgrades the goal from "at least one volumetric piece per chapter" to
**volumetric by default**: a flat single-fold sheet is now the exception
that needs a reason (backdrop, scenery, figure standee), not the norm.

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

## Composition covenant — volumetric by default

Every layer in content.ts declares a **role**:

- `backdrop` — the big scenic sheet near the spine. Flat allowed.
- `scenery` — mid-page scene-setting planes (walls, tree lines, fringes).
  Flat allowed, sparingly.
- `figure` — character/creature standees (heroes, bees, ravens). Flat
  cutouts are AUTHENTIC pop-up vocabulary for figures — but they must be
  separate cutouts at scene depth (the treasury-split standard), never
  painted onto a structure.
- `story` — buildings, furniture, props that carry the scene's physical
  world (inn, stable, treasury, counter, arch, stalls, market row).
  **Must be volumetric**: box, step, or a multi-patch compound. A bare
  v-fold or gutter tent in a story role is a covenant violation.

Enforced by a unit test over CHAPTERS (roles are data, the rule is CI).

## Renderer physicality — "made of paper" cues

The aesthetic half of the escalation. The illusion is sold not just by
geometry but by how the paper renders:

- **Cut edges**: die rims show the white paper edge (real cutouts always
  reveal the sheet's core at the cut).
- **Contact shadows**: standing pieces ground themselves with soft
  shadows onto the page; floating = illusion broken.
- **Raw-paper interiors**: hollow boxes' inner faces read as unpainted
  stock, not mirrored art.
- **Fold seams**: creases visible as slight tone breaks at grazing light.

These are engine work (three.js material/geometry passes), independent of
his art generation, and land as their own iteration.

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

## Part C — the illusion gates (goal-level benchmark)

Part A proves the math; Part B proves each mechanism reads; Part C is
the benchmark for the GOAL — the whole book lands in "3D illusion
created with papers" territory. Scored per spread, all six required:

C1. **Volumetric census.** The spread contains at least one enclosed
    volume (box or step assembly), and every story-role piece is
    volumetric. Flat sheets appear only in backdrop/scenery/figure
    roles. (Automated: the covenant unit test.)
C2. **Three-face readability.** Each volumetric piece shows >= 3
    distinct faces (front + side + top) with meaningful projected area
    from the reading camera across the tilt range. (Automated geometric
    check in the derive/bench script + capture confirmation.)
C3. **Depth occupancy.** Pieces occupy >= 4 distinct depth bands between
    spine and page edge, and max-tilt parallax between nearest and
    farthest band is clearly visible in captures. (Semi-automated:
    z-centroid histogram + capture.)
C4. **Fold vocabulary.** >= 3 mechanism families visible per spread
    (v-fold / box / step / parallel / child) with distinct silhouettes.
    (Automated census.)
C5. **Paper physicality.** Cut edges, contact shadows, raw-paper
    interiors, fold seams present in renders (see renderer section).
    (Capture review.)
C6. **The blind illusion test — the human gate.** A screenshot at an
    arbitrary tilt angle should be mistakable for a PHOTOGRAPH of a
    handmade paper diorama. The user's verdict, per spread, is the
    final gate; no automated proxy substitutes for it.

**Definition of done for the phase:** A12-A15 numerically green, all six
Part C gates pass on every chapter spread, and the physics benchmark
(A1-A11, B1-B13) shows zero regression.

## Loop protocol

Same as the physics benchmark: derive numerically first (scripts in
.superpowers/sdd/bench/), Part A green before any capture, capture review
against Part B and Part C every iteration, verdicts in
.superpowers/sdd/progress.md. The physics benchmark's PASS remains a hard
floor — no regression of A1-A11 or B1-B13 is acceptable while adding
volume.

## C6 round-1 verdict (user, 2026-07-11, on the six-frame kraft deck)

"I don't get what I am looking at, also feels like most of these would
be impossible inside a pop up book, usually I saw a structure in such
books like left wall, right wall and a ceiling."

Rulings adopted: (1) fully enclosed cap-fronted boxes read as alien —
the CANONICAL volumetric form is the OPEN-FRONT ROOM: left wall, right
wall, ceiling/roof, hollow middle, back wall as the brace, opening
toward the reader (this is also the original ask verbatim: "hollow in
the middle and the top would again be a painting"). Barn and stall
converted (capFront: false); closed boxes remain legal for small props
(chest, hive, strongbox, counter) pending his next verdict. (2) B15's
tilt lever resolved: DRAG-TO-TILT shipped — hover keeps subtle parallax,
holding and dragging swings the desk (0.26/0.5 rad caps), released tilt
drains back. (3) Raw kraft among painted pieces suppresses the read —
final C6 verdicts wait for face art.

## C6 rounds 2-3 + course correction (user, 2026-07-11, later)

Round 2: drag-to-tilt VETOED on first touch ("I hate the new drag
thing") — it collided with the existing swipe-to-turn gesture; REVERTED,
and the follow-up ruling is final: **NO DEEP TILT, hover parallax only**.
Round 3 on the open-front rooms: "they aren't open, there is clearly a
wall right behind it" (unlit interiors rendered as bright as exteriors —
interior shadow tint shipped in reply) and, decisively: "Nothing changed
that much, the shapes are still mostly closed from all positions...
we are starting to drift away from the original pop up book idea. Most
of the items in a popup book are not just a piece of paper, they have
dimensions — research what dimensions they usually have."

COURSE CORRECTION ADOPTED: stop iterating box variants; ground the
vocabulary in the real thing. Research commissioned into the dimensional
anatomy of commercial pop-up pieces (Carter/Diaz Elements of Pop-Up
taxonomy, Sabuda/Reinhart multi-piece assembly anatomy, FLOATING LAYERS /
multi-tier platforms, angle-fold multi-plane assemblies, pull-tab
mechanics) → its report defines the next mechanism set and revises Part
B/C acceptance upward ("we need to increase the level of acceptance").

FUTURE PHASE (user-declared, not yet scheduled): INTERACTIVE PAPER —
pieces the reader DRAGS through cut slits (pull-tabs/sliders), pieces
that slide into/out of a page, inventory-like takeaway parts. Input must
be disambiguated against the swipe-to-turn grammar (the drag-tilt
lesson). RESOURCES UNLOCKED: "we can use all the needed resources",
including Blender (MCP available) for 3D models of artwork if needed.

## First composition targets (from the user's review)

- ch3 dispatch counter -> step fold or lidded box (desk front + top).
- ch1 stable -> hollow or lidded box barn (front facade + roof top).
- ch5 awning -> re-imagined once the box exists (canopy off the stall row
  or a boxed market stall; NOT a gutter tent).
- ch6 treasury + ch1 inn -> candidates for box buildings with painted
  side walls once he regenerates face art (call sheet v5 will spec
  multi-face strips: front / sides / top in one image with marked splits).
- Renderer physicality pass (cut edges, contact shadows, raw-paper
  interiors, fold seams) as its own iteration once the first box ships.
- Role field + covenant test over CHAPTERS lands with the first
  recomposition (roles assigned to all 45 existing pieces).
