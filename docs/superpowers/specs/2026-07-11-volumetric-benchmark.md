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

## Part C v2 — raised acceptance (2026-07-11, post-anatomy research)

Research basis: docs/superpowers/research/2026-07-11-popup-anatomy.md.
Its core finding inverts the box-era premise: real pop-up "dimensions"
do NOT come from enclosed volumes. They come from ASSEMBLY ANATOMY —
a few kinematic primitives combined in parallel/series, carrying MANY
decoratively-shaped non-kinematic patches ("links may be curved,
partially cut away, extended beyond their joints" — Winder on Sabuda),
stacked in floating tiers, silhouettes staggered in depth with
inter-tier shadows. A closed box is rare in real books; a dressed open
assembly is the norm.

Vocabulary to add (build order):

1. FLOATING PLATFORM — identical struts sharing one closed form, a
   rigid plate spanning the strut tops, ONE art piece spanning the gap
   between tiers; tiers stack (2-3 typical). The single biggest visual
   win per the research.
2. ANGLE-FOLD FAN — k >= 2 v-folds sharing one spine apex with
   distinct angles (Birmingham M-fold: 6 planes / 9 gullies from one
   sheet).
3. RECURSION — a local-dihedral utility phi_child(theta) between any
   parent patch pair, so existing solvers mount ON mechanisms (Ruiz
   placement rules + non-intersection guards).
4. DRESSED ASSEMBLIES — kinematic core + decorative die-cut silhouette
   patches riding the links; the actual Sabuda recipe; every hero
   recomposed this way (call sheet v6 follows the geometry).

Raised gates (supersede C1-C4; C5 gains a cue; C6 unchanged):

C1v2. ANATOMY CENSUS — every story-role piece is a dressed assembly
      (kinematic core + >= 2 shaped dress patches riding its links) or
      a multi-tier platform. A bare primitive — v-fold, tent, OR BOX —
      in a story role fails CI. Boxes are demoted exactly as tents were.
C2v2. SILHOUETTE READABILITY — story pieces read by shaped outline
      (concave die-cuts, not rectangles) and tier-stagger from the
      reading camera; the three-face box check remains only for
      surviving boxes.
C3v2. DEPTH OCCUPANCY RAISED — >= 5 depth bands per spread AND >= 1
      floating tier (art held above the page plane by struts).
C4v2. FOLD VOCABULARY RAISED — >= 4 mechanism families per spread from
      {v-fold family, box family, platform, fan, recursive child}.
C5v2. C5 + INTER-TIER SHADOWS — tiers cast soft shadow on the tier
      below (the research's top visual cue for stacked paper).
C6.   Unchanged — the user's blind "photo of a real paper diorama?"
      verdict per spread, judged against this raised bar.

Definition of done for the phase: platform + fan + recursion prove
A12-A15 in their derive scripts before any capture, every hero
recomposed as a dressed assembly, C1v2-C5v2 green in CI/captures, C6
verdict from the user per spread. The physics benchmark (A1-A11,
B1-B13) remains a hard floor. The box-era composition targets below
are SUPERSEDED by this section.

## C6 round 4 (user, 2026-07-12, on the anatomy-phase deck)

"Overall I can see the improvements, but we still have a lot that should
be done" — direction holds, bar rises. Verbatim asks, mapped to
workstreams:

A. CRISP TURN (defects first): "there is still some flashing on the
   right page when a page is turned"; "no visual fold, or dimension
   between the pages, suggesting there was something folded between the
   page" — gutter must read as a real valley holding folded paper
   (fold seam, gutter shadow, slight gape/bulge implying content).
B. PAPER REALISM: "papers should behave very realistic, the creases,
   folds, animation of it folding and unfolding, the rougher paper
   feel" — crease/scored-fold rendering on every piece, rougher stock
   feel, fold/unfold nuance (visual cues only — the pure-f(theta)
   covenant stands; realism comes through shading and print, never
   springs).
C. PAGE DIE-CUTS: "some cut places on the pages which reveal box type
   cutouts which would have to be made from cutting" — pages show the
   VOIDS their pop-ups were cut from: die-cut windows in the page print
   at piece footprints, darkened reveal beneath.
D. COMPOSITION SPREAD: "some chapters have too many items in front of
   one another, instead of being spread throughout the book" — pieces
   cluster in the spine column (every mechanism is gutter-anchored);
   redistribute across the page area: leans/off-center creases pushed
   harder, children mounted toward panel outer edges, mechanisms on
   mechanism creases as off-spine rails, the 3 occluded platforms and
   the miniature ch5 fan re-placed (fan showcase belongs where there is
   room — CH2 or the title spread).
E. INTERACTIVE PAPER (now scheduled, was "future"): "the idea with
   moving pieces and some 2 dimensional pieces that will slide in and
   out of the book are also not made" — pull-tabs/sliders (independent
   scalar input s, orthogonal to theta per the anatomy research),
   pieces sliding out of page slits, inventory takeaways. HARD
   CONSTRAINT: input must be disambiguated from swipe-to-turn (the
   drag-tilt lesson) — explicit grab handles on visible tabs, never a
   canvas-wide gesture.

Execution order: A (defects) -> D (composition) -> B/C (realism passes)
-> E (new input channel). Each lands with derive/tests where mechanisms
are involved, captures for his verdict every round.

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

## C6 round 5 (2026-07-12) — verdicts on the flicker fix + new items

Turn flicker: ACCEPTED ("acceptable at this moment"). Residual noted: "still
some repositioning before the start and end of the turn" — the sheet-lift
parallax pop; polish target for workstream B.

New items, mapped:

- **B (paper realism)** — "The middle seam disappears from the turning page
  when the turn starts, and appears only when the turn ends and there is a
  click in place type of motion." The gutter-crease strip lives only on the
  static pages, so the sheet's faces carry no seam mid-air and the landed
  sheet hides the strip until commit. The sheet's printed faces need
  spine-side crease continuity (shading on the face prints themselves).
- **B/bulge (cover path)** — "the very first turn of the book doesn't
  properly work, first we see the inside of the seam and the page appears
  filled on the left part once the turn is made." The cover turn hides the
  left page/block for its whole duration (the cover is the left support
  board only at rest) — reveal needs a real support treatment instead of a
  commit-time pop-in.
- **DONE (this round)** — "we should add some sort of loading state when
  first loading the book" → boot gate shipped: store `booted` flag flipped
  from the frame loop (≥12 real frames + ≥600ms + all warm-window prints
  resolved), desk-colored veil fades over the canvas, "Open the book" CTA
  and ALL turn input gated on it.
- **bulge (now a requirement, not optional)** — "the pages having some width
  between them, also the pages should stack and grow thicker on the left
  side and thinner on the right side during the turning towards the end."
  Supersedes the constant-full-height block design; needs the PAGE_SURFACE_Y
  shared-hinge contract re-derived (the A3 relaxation work).

Directive: "apart from these issues, we can move on" → resume order stands:
D pt 2 (composition spread) → bulge → B → C → E.
