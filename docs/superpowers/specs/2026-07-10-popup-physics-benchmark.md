# Pop-up Physics Benchmark — Chapter IV

**Goal (user, verbatim):** "have the physics of our popup page behave like real
paper, driven by page angle and the paper cutout glued and cut in proper
places. The benchmark should be very strict, visually it should be very
similar to real pop up books, paper cutouts visually creating a 3d
experience. Verify the chapter that we already have assets for and make sure
that the physics work, the paper cutout are folded correctly, nothing sticks
out, everything looks proper and realistic."

Test subject: **spread 5 (Chapter IV, the Vault-Dragon)** — the one spread
with real art (ch4-backdrop / ch4-midground / ch4-hero / ch4-foreground).

## Physical model under test

Normal book orientation: spine along Z, pages spanning ±X, page turns
right-to-left about the spine. Every pop-up piece is glued to BOTH pages of
its spread; its pose is a **pure function of the spread's dihedral angle β**
(0 = closed, π = open flat). During a 'next' turn with sheet angle θ ∈ [0, π]:
outgoing spread β = π − θ (closes, paper folds flat into the rising sheet);
incoming spread β = θ (opens, paper stretched open by the landing sheet).
No timers, no choreography, no springs during turns.

## Part A — Geometric invariants (unit tests, must all pass exactly)

A1. **Glue coherence.** At every β sampled in [0, π] (721 samples), every
    panel's glue-line vertices lie in their page's plane to within 1e-6
    world units. This is the user's core sentence made testable: the paper
    is *connected to the turning page*.

A2. **Rigidity.** Panel dimensions (glue-edge length, crease-edge length,
    panel widths) are constant across the sweep to within 1e-6 — paper does
    not stretch.

A3. **Flat fold at closed.** At β = 0.01 rad, every piece's maximum height
    above the page plane ≤ 0.02 world units (paper thickness allowance).
    The book closes completely.

A4. **Containment at closed ("nothing sticks out").** At β = 0.01 rad, every
    folded piece's footprint lies inside the page silhouette: distance from
    spine ≤ PAGE_W, spine coordinate within the page's z-range. Nothing
    protrudes from the closed book.

A5. **Reachability.** The mechanism solve succeeds (linkage neither tears
    nor jams) at every β in [0, π] — no NaN, no unreached configuration.

A6. **Continuity, no jitter.** Crease positions are continuous: max
    per-sample displacement between adjacent β samples bounded by
    C·Δβ (no branch flips, no snapping). Note: strict monotonicity is NOT
    required near β = π — real v-folds ease back slightly at full open
    (physical settle, verified in derivation sweep).

A7. **Landing continuity.** Pose at β = π computed through the turn path
    equals the at-rest pose exactly (bitwise same function) — no snap at
    turn commit.

A8. **Direction symmetry.** A 'prev' turn at sheet angle θ produces the
    mirror poses of a 'next' turn at π − θ.

A9. **No inter-piece collision at rest.** At β = π, no panel plane
    intersects another layer's panel within both quads' bounds (the four
    nested pieces clear each other).

A10. **Under-sheet clearance.** During a turn, no outgoing piece vertex
     rises above the turning sheet's plane on the sheet's closing side
     (paper cannot poke through the page pressing it flat), sampled at
     θ ∈ {10°, 30°, …, 170°}.

## Part B — Visual gates (deterministic screenshots, reviewed each loop)

Captured via the `?sbpose=<spread>:<t>:<dir>` dev hook + Playwright harness
(`.superpowers/sdd/bench/capture.mjs`) — pixel-reproducible poses, no timing
noise. Pose set: rest; turning INTO ch4 at t = 0.55/0.65/0.75/0.85/0.95;
turning OUT of ch4 at t = 0.05/0.15/0.25/0.35/0.45; two 'prev' mirrors.

Every capture must satisfy:

B1. **Rest pose reads as an open pop-up book:** four standing paper layers
    with visible center creases, backdrop tallest at the far side, hero
    dominating center, low foreground fringe near the free edges — a real
    3-D diorama, not billboards.

B2. **Mid-turn: paper visibly glued to the sheet.** Incoming pieces' left
    glue edges track the descending sheet exactly (no gap, no float);
    outgoing pieces' edges track the rising sheet.

B3. **The stretch.** Incoming pieces are pulled open THROUGH the turn —
    partially-opened poses lean toward the sheet; the bloom completes only
    as the sheet lays flat. Outgoing pieces fold flat progressively into
    the closing wedge, gone by the time the wedge closes.

B4. **Nothing clips.** No piece intersects the sheet, the static pages, or
    another piece in any frame.

B5. **Nothing sticks out.** No piece pokes past the page edges or out of
    the closing wedge in any frame.

B6. **Art integrity.** Prints undistorted (aspect preserved), center
    creases fall where the fold-aware art expects them, die-cut rims read
    as cut paper.

B7. **Craft plausibility.** Fold shading on the away-facing panels, contact
    shadows under standing paper, glue geometry a paper engineer would
    recognize (v-fold glue lines angled across the pages from apexes on
    the gutter).

From the construction research (see
`docs/superpowers/research/2026-07-10-popup-construction-reference.md` §3):

B8. **Rigid facets only.** Panels are flat planes bending ONLY at crease
    lines (PRBM: rigid panels, compliant creases). The turning page itself
    is rigid card stock — no paperback curl anywhere.
B9. **One shared driving angle.** Every layer's pose is a function of the
    same dihedral — no layer may appear to move on its own timer or easing.
B10. **Visible base attachment.** Standing pieces show where they meet the
     page (glue-tab fold line / contact shadow) — nothing erupts from
     nothing.
B11. **Soft, layered shadows.** Light reads as passing through paper —
     diffuse penumbras between layers, no hard AO-style self-shadowing.
B12. **Hard end-stop.** The rise stops firmly with the page's own landing
     (geometric limit), not an asymptotic decay.
B13. **Depth-ordered rise.** At a partial-open frame, layer rise progress
     tracks mechanism depth (shallow backdrop platforms vs steep hero V)
     rather than all layers matching one fraction.

## Loop protocol

1. Implement/adjust one increment.
2. Run Part A (vitest) — all invariants green before any capture.
3. Run capture harness → review every frame against Part B.
4. Record verdict + failures in `.superpowers/sdd/progress.md`; fix; repeat.
5. Benchmark passes when Part A is green and a full capture set has zero
   Part B violations.

## Verdict — 2026-07-10

**PASS after two iterations.**

- Part A: 71/71 invariant assertions green over every shipped layer
  (`__tests__/labs/storybook/popup-mechanics.test.ts`).
- Part B: 15 deterministic pose captures (sheet angles 5°–175°, both
  directions, both roles) + 5 live-motion captures (real turn, chained
  double turn, cover open) reviewed frame by frame — zero violations on
  the Chapter IV spread. Bench frames: `.superpowers/sdd/bench/out/`.
- Iteration 1 → 2 findings, all fixed: pop-ups anchored above the true
  page plane (floated at rest, pierced the sheet mid-turn — fixed by the
  shared hinge plane), backdrop art carried transparent padding (pipeline
  now trims backdrops), sheet lift inverted past vertical, shade slab too
  hard, missing-art 404s dirtied the console.
- Remaining visual roughness is placeholder art only (neighbor chapters'
  procedural cutouts, procedural page prints) — replaced by the user's
  Batch-2 / page-print generation, not physics.
- Full stack at verdict: 311/311 unit, lint, production build, e2e CI mode
  122 passed / 0 failed.

## Variation phase — 2026-07-10 (post-verdict)

User verdict on the benchmark pass: physics confirmed; next complaint was
composition ("cutouts are all too similar... more variation, different
sizes, asymmetry, visual storytelling"). The engine grew from one mechanism
to three — all validated numerically in
`.superpowers/sdd/bench/derive-variation.mjs` before landing, all still
posed by nothing but the spread dihedral:

1. **Asymmetric v-fold** (lit doc §3.3): one `skewDeg` knob keeps the
   Kawasaki flat-fold pairing (phiL + rhoL = phiR + rhoR) true by
   construction; the crease is solved as the general two-cone intersection
   and the piece LEANS. Wall regime caps at |skew| < (rho − phi)/2 before a
   panel stops standing — walls take their asymmetry mostly from off-center
   creases (`creaseU`), deep-V heroes lean with real skew.
2. **Parallel fold** (lit doc §4): planar four-bar strip creased along the
   spine (tents/awnings/counters); `wA = glueR + rise, wC = glueL + rise`
   folds it exactly flat at closed and stands it by `rise` of slack when
   open. Closed reach = glueL + glueR + rise must fit the page.
3. **Cascaded child v-fold** (Glassner generations, lit doc §5): rides a
   parent's central crease, driven by the parent's own panel dihedral.
   Frame-free construction (`g = cos(phi)·Zc + sin(phi)·b_panel`,
   `c = cos(Λ(eta))·Zc + sin(Λ(eta))·bisector`) satisfies the spherical
   linkage equation identically — machine-precision glue (1e-16).

Invariant suite extended to every mechanism and every shipped layer
(94 tests): A1 covers parallel glue lines and child glue-on-panel planes;
**A11 (new)** proves children are glued to actual parent paper (panel-basis
decomposition within the die-cut bounds); A9 runs per spread with
child↔parent contact excluded by the wedge-convexity argument (a child's
material cannot leave its parent's panel wedge). Flat-fold tolerance for
skewed/child pieces is 1e-5 (two-cone tangency sqrt noise) vs 1e-9
analytic for symmetric ones — paper is 0.02 thick.

Content: uniform `layerDefaults` abolished; six bespoke chapter
constructions (guarded by a no-two-chapters-share-a-signature test).
Batch-2 call sheet rewritten fold-aware (crease percentages, lean notes,
rider/tent conventions). Also fixed while verifying: art 404 console noise
eliminated deterministically via a committed art manifest consulted before
any request (Chrome logs fetch 404s too — the fetch-first probe only
narrowed the race).

## Richer-structure phase — 2026-07-10 (compound scenes)

User direction after the page-5 print landed: "richer pages... more paper
cutouts, maybe some that are bigger, some multi story ones different
cutouts making one scene." Pure composition work — zero engine changes;
the three mechanisms already compose:

- **Multi-story compounds** = one parent v-fold carrying SEVERAL children
  at different mounts/vDirs on the same crease: the coaching inn (key-sign
  + attic dormer), the rookery tower (dispatch balcony at mid-height +
  raven perched above), the treasury (vault door low, banner high).
- **Bigger centerpieces**: inn 0.95×0.62, treasury 1.00×0.72 (the book's
  largest hero) — checked against the closed-containment budget
  (corner reach glueLen·sin φ + h·sin(φ+ρ) ≤ PAGE_W).
- **Paired/asymmetric tents**: innyard stable (ridge at 41%), dispatch
  counter (59%), market awning (57%) — standing ridges pushed off-center
  toward opposite pages per spread.
- **Composition rule discovered in review**: from the fixed reading camera
  (+Z, elevation ~40°), a piece in the z-band behind a taller mid-page
  piece is fully occluded at rest (sight-line over a 0.6-tall hero lands
  ~0.8 behind it). Rich pieces therefore go IN FRONT of their hero or get
  flank width beyond it (the ch5 stall row's flanks read past the arch;
  the first-draft rear tents did not and were moved).

Suite grew 94 → 102 mechanics tests purely from the data-driven sweep
picking up the new layers (45 shipped pieces); A6's 720-sample sweep got
an explicit 30s timeout after flaking at the 5s default under full-suite
CPU contention. Full stack: 344/344 unit, lint, build 15 kB (three.js
still lazy). Captures: bench/out/rich-*.png, rich2-*.png. Call sheet:
eight new prompts (ch1-dormer/stable, ch2-bee-c, ch3-balcony,
ch5-stalls/lantern-b, ch6-door, title-crest), generation-order sessions
updated, tent ridge percentages re-derived.
