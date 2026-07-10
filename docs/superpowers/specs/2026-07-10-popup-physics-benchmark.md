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
