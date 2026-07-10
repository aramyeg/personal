# Real Pop-Up Book Construction — Research Reference

Research for the physically-correct WebGL pop-up book (three.js) test spread: 4 art layers at
different distances from the gutter — wide backdrop (far left page), midground (left of center),
hero (straddling the gutter), foreground (far right page).

---

## 1. Real construction technique

### 1.1 The V-fold — definition and the geometric knob that matters

Formally, a V-fold is a **spherical four-bar mechanism**: all of its joint axes (creases) intersect
at a single point that lies **on the gutter** (or on whatever crease it's mounted to — see §1.4).
Carter & Diaz call this family "angle folds"; the parallel-axis special case (axes parallel to the
gutter rather than meeting a point on it) is a "parallel fold."
[Winder, Magleby, Howell — *Kinematic Representations of Pop-Up Paper Mechanisms*, ASME J.
Mechanisms & Robotics, 2009, DOI 10.1115/1.3046128]

- **Glue tabs**: small flaps at the base of the V-fold panel are scored, bent back, and glued flat
  against the support (page) plane. Placement must be precise or the mechanism won't open/close
  fully — professional design tooling literally prints registration "targets" on the support pages
  showing exactly where each tab goes.
  [Glassner, *Interactive Pop-Up Card Design*, MSR-TR-98-03, 1998, §6]
- **The single most important artistic control**: the angle of the "V" cut at the base of the panel
  (before folding) directly and *indirectly* sets how far back the raised panel reclines when the
  book is fully open — Glassner calls the V-fold "one of the hardest pieces to design using paper
  and scissors" for exactly this reason: you're aiming a 3D lean angle through a 2D cut angle.
  [Glassner §6] Hobbyist taxonomy names three variants by this cut angle: right-angle, acute-angle,
  and obtuse-angle V-folds, each producing a different rise/lean character.
  [technologystudent.com/designpro/popup1.htm]
- **Tab spacing vs. pop height**: the further apart the two glue tabs sit from the center crease,
  the flatter/shallower the piece sits when raised; closer together = taller, more dramatic pop.
  Typical hobbyist tab width ≈ 1/4 in.
  [printninja.com/design-a-pop-up-book/; juditorosz.substack.com/p/v-fold-pop-up-tutorial]

### 1.2 Symmetric vs. asymmetric V-folds

- **Symmetric**: fold at the center of a square/rectangle; rotates a full 90° as the card goes from
  closed to open; glue tabs mirror around the center crease.
  [extremepapercrafting.com, Lesson 16 — "V Fold Pivot"]
- **Asymmetric**: the fold is placed off-center along the rectangle instead of at its midpoint. This
  changes the resulting motion from a straight vertical/forward rise into **lateral motion "side to
  side across the face of the card."** [extremepapercrafting.com, Lesson 17 — "Asymmetrical V Fold
  Pivot"] Glassner's rigorous version of the same idea (his "asymmetric single-slit," §5) derives
  the exact flat-closing condition: if the central pop-up crease meets the support crease at angle
  β and the piece's own internal angles are ψ, γ, δ, the crease-apex angle α that makes it fold
  flat exactly satisfies **α = γ** — a genuinely different, non-90°-symmetric relation from the
  ordinary V-fold.

### 1.3 Flat-foldability — the equations that govern whether it collapses cleanly

Model each mechanism as a 4-bar linkage: link 1 = right base page (ground), link 2 = left base
page, links 3–4 = the two moving panels of the pop-up, with link lengths L1–L4.
[Winder, Magleby, Howell, §4]

- Folds flat at **closed (0°)** iff `L1 + L4 = L2 + L3`
- Folds flat at **fully open (180°)** iff `L1 + L2 = L3 + L4`
- A **parallelogram** mechanism (`L1 = L3` and `L2 = L4`) automatically satisfies *both* conditions
  — it always folds flat at both extremes with zero extra tuning. This is why rectangular
  strap/platform shapes recur constantly in real books even under irregular printed artwork: the
  underlying *structural* piece is a parallelogram; only the glued-on decorative silhouette is
  irregular.
- One-piece (unassembled, single-sheet) mechanisms fold flat at 180° but not necessarily at 0°;
  layered (assembled/glued) mechanisms are the ones that can be built to pop up exactly *at* 180°
  (`L1 + L2 < L3 + L4`).

Abel/Demaine et al. (STACS 2013, MIT/Tufts/Waterloo/Münster/Pisa — *Algorithms for Designing
Pop-Up Cards*, https://www.cs.tufts.edu/r/geometry/pdf/popup-stacs13.pdf) prove the general case
rigorously: **any simple polygon can be built as a rigid, non-self-intersecting, single-degree-of-
freedom linkage that opens to any angle 0–360°**, built from nested V-fold-derived "rotation
gadgets" and "synchronizing gadgets." Their key non-crossing lemma (Thm. 5): two nested V-folds
that share a vertex and stay within one another's angular wedge **never touch or cross during the
whole closing motion**, except at full closure. This is the formal guarantee that lets real
paper engineers safely nest mechanisms on top of each other — *as long as each child stays strictly
inside the angular wedge swept by its parent.*

### 1.4 The core answer: how EACH plane in a multi-layer "theatrical stage" scene is driven

Two independent sources converge on the same mechanism, described in complementary vocabularies:

**Winder/Magleby/Howell (kinematics/mechanical-engineering framing):** complex pop-ups are built by
combining simple mechanisms in **series** or **parallel**. The mechanism directly spanning the
gutter (or connected to the pull-tab/primary actuation) is the *primary mechanism*; everything else
on the page is a *secondary mechanism*. In a **parallel** combination, one or more joints of the
secondary mechanism attach not to the base page but to a **link (panel) of the primary mechanism**
— the fold between that panel and its own "ground" *becomes the local support crease* for the
secondary mechanism. Opening the book actuates the primary mechanism, which then actuates the
secondary one riding on it. The named example of this is a **"floating layer."** In a **series**
combination (their examples: "solid shapes," "45° folds") the secondary mechanism shares no ground
attachment at all, and the combined result is usually a spatial (non-planar, non-spherical)
mechanism — used for more freeform 3D silhouette-following shapes rather than clean stage planes.

**Glassner (interactive-design-tool framing, same fact from the software side):** *"Since V-folds
don't cut into the page, they may be placed on any crease, which is then treated just like the
card's crease for that mechanism."* He demonstrates a **cascaded pair of V-folds**: the larger
V-fold uses the book's real spine as its support crease and creates one of its *own* side edges as
a fold; the smaller V-fold then uses **that edge** — a crease on the parent's raised panel, not the
book's gutter — as its support crease. *"So opening the card pops up the big V-fold, which then
drives the smaller one to pop up as well."* His whole software architecture models the card as a
**dependency graph of mechanisms rooted at the book's spine and walked outward**, which he notes is
"inherently acyclic... [due to] the physical nature of pop-up cards." [Glassner §6, §8]

**Practical mapping onto a 4-layer spread** (backdrop far-left, midground left-of-center, hero on
the gutter, foreground far-right):
- **Hero** (straddles gutter) = the *primary* mechanism: an ordinary V-fold or single-slit whose
  apex/fold sits at the true spine.
- **Midground** = a *secondary* mechanism attached in parallel: either its own V-fold/parallel-fold
  whose support crease is a fold placed further from the true spine but still parallel to it (a
  "V-fold... placed on any crease"), or literally glued onto a panel of the hero mechanism as in
  Glassner's cascade.
- **Backdrop / foreground** (far from the gutter, one page only) = driven either by a **tube
  strap** (§1.5) running from the gutter out to the panel's position, or by Glassner's **strap +
  pivot** combo (§1.5) — the strap displaces the effective crease line out to a position near the
  distant panel; a piece glued to one of the strap's own panels then pivots as the book opens.

### 1.5 Getting motion to a piece far from the gutter, on one page only

- **Tube strap**: a paper strip doubled up (folded into a flattened tube) for rigidity, that lets
  **one base page drive a mechanism anchored on the other page** (or far out on the same page) via
  a hidden rigid push-rod running under/behind the artwork. Kinematically it's an open "driver
  dyad" — it never appears alone, always terminating in an **arch / knee mechanism** (a
  slider-crank) at the far end that converts the strap's linear push into the local piece's rise.
  [Winder, Magleby, Howell, §4.4.3–4.4.4]
- **Strap + pivot** (Glassner, §7, Fig. 9): a strap-family mechanism (double-slit or independently
  glued layer) displaces the effective central crease to a parallel line away from the true gutter;
  attaching another piece to one of that strap's panels makes it **pivot** as the card opens.
  *"Creative designers can create pivot elements that extend far outside of the card when it's
  opened, yet fold down and tuck away completely out of view when the card is closed."*
- **V-fold raiser**: two identical V-folds acting in parallel with a flat platform glued across
  their tops — literally two struts holding up a stage floor. Taller V-folds give more lift but a
  structurally weaker platform; platforms themselves are typically non-moving pieces that just ride
  whatever mechanism carries them, and will wobble side-to-side unless horizontally braced.
  [paperpaul.com/top-10-pop-up-techniques/]

### 1.6 A directly implementable formula for multi-depth "stage" planes

For the restricted (and directly relevant) case where **all panels stay parallel to the gutter** —
exactly the "several standing planes parallel to the gutter at different depths" test-spread
layout — Abel/Demaine et al. give a closed-form **shear map**. With the spine along the z-axis and
opening angle **α**, a point at position `(x, y, z)` on a panel whose rest plane is parallel to one
of the book's cover half-planes, at perpendicular distance `y` from the gutter, maps to:

```
(x, y, z) → (x + y·sin(α), y·cos(α), z)
```

as the book opens. **Every plane parallel to the gutter, at any fixed offset y, is driven by the
exact same opening angle α** — each layer differs from the others only by its own fixed `y`,
plugged into the same one shear transform. This is the formal version of "several standing planes
parallel to the gutter at different depths, each just driven by the page angle," and is directly
implementable as the core transform for a multi-depth three.js stage rig (§3 of their paper,
"Scaffold Pop-Ups" / "pinwheel scaffold"). [Abel, Demaine et al., §5.2, Lemma 8]

### 1.7 Flat-foldability discipline in practice

Every hidden strut, riser, and platform must *itself* close flat when its own local "gutter" angle
returns to zero, or the piece it carries won't tuck away with the rest of the book. This is why
straps and platforms are built as parallelograms/rectangles under the hood (the shape guaranteed
flat-foldable at both extremes, §1.3) even when the visible glued-on artwork is an irregular
character silhouette. It's also why Abel/Demaine's non-crossing guarantee (§1.3) is stated as a
strict-nesting condition: nested mechanisms are only guaranteed collision-free if each child's
angular wedge stays inside its parent's — violate that and the formal guarantee no longer applies.

---

## 2. Material behavior

- **Stiffness / weight**: pop-up interiors use stiff, **uncoated cover stock**, commonly cited at
  ≈170–200 lb (~10pt), specifically because thinner stock "will bend or collapse over time," and
  because uncoated finish takes hand-applied glue far better than coated stock (every piece in a
  real pop-up is hand-glued). [printninja.com/design-a-pop-up-book/; gobookprinting.com]
- **Rigid-panel, compliant-crease model**: the formal mechanical-engineering treatment models paper
  mechanisms with the **pseudo-rigid-body model (PRBM)** — panels are treated as effectively rigid,
  and *all* compliance lives at the crease line itself, represented as a revolute joint with a
  torsional spring whose constant is usually "so small... it can be ignored." In other words:
  panels don't bow or curl in normal operation; only fold lines have any give, and even that is
  typically negligible for kinematic purposes. [Winder, Magleby, Howell, §4.3.1]
- **The one deliberate exception**: Glassner notes *"some pop-up books use the rigidity of the
  paper as a mechanical device to push and rotate other pieces into position"* — i.e., a sheet's
  own spring-back is occasionally harnessed as an actuator rather than avoided, but this is
  explicitly flagged as an advanced/uncommon technique (he lists it under future work he'd like to
  investigate further, not settled craft). [Glassner §9]
- **Production validation (VFX)**: Framestore's pop-up-book sequence for *Paddington 2* consulted
  working paper engineer **David Hawcock**, who built physical card mock-ups purely to nail scale
  and real-world fold behavior. Notably, the animators admit even their "real-world" rig took
  creative liberties: some CG folds "aren't necessarily real" because true paper folding requires
  every hinge to align to the central spine, a constraint they sometimes broke for shot composition
  — a useful caution that physical correctness and a satisfying pop-up *shot* aren't always the
  same target. For lighting, they deliberately let light pass *through* the paper for "a nice soft
  look" rather than over-darkening with hard contact shadows, and spent real effort matching
  surface grain/fiber detail at in-shot scale.
  [vfxvoice.com/inside-framestores-paddington-2-pop-up-book-sequence/]
- **Snap/settle at full open**: no citable primary source describes the exact "final degrees" snap
  dynamics directly (searched paper-engineer interviews and slow-motion breakdowns; nothing
  concrete surfaced). What *is* well supported: pop-up mechanisms are literal kinematic linkages
  with **hard geometric end-stops** (a 4-bar hits its `L1+L2` vs `L3+L4` length-sum limit, or the
  book cover itself stops rotating). The perceived "snap" a viewer sees is most plausibly just the
  linkage reaching its fully-open configuration abruptly, with the popped piece's velocity going to
  zero at the same instant the page itself stops — not a distinct secondary physical effect. Flag
  this as an inference from the kinematics literature, not a directly sourced claim.
- **Production pipeline / white dummy**: paper engineers hand off precise **dielines** (die-cutting
  blade paths) to a die-maker; production first assembles an all-**white "dummy"** — unprinted
  mockup — purely to test that the mechanism *functions*, followed by flat color art proofs, before
  any printed artwork is applied. Mechanism geometry is locked and function-tested in blank card
  stock first; only afterward does art get wrapped onto the die-cut panels.
  [raymarshall.com/articles/how-pop-up-books-are-made/; printninja.com] Sabuda's own process is
  described the same way — card stock, an X-Acto knife, and glue, folding/cutting to physically
  discover working mechanisms before any art is applied. [robertsabuda.com coverage]
- **Digital-papercraft texturing recipe** (not a pop-up book, but the closest documented real-time
  production pipeline for a physically-plausible paper *look*): *Paper Cut Mansion*'s "Reverse UV
  method" — hand-drawn pencil art scanned, composited onto a cardboard texture in Photoshop
  (Multiply blend + boosted contrast for a "pencil on cardboard" look, deliberately rough
  "wet-brush/watercolor" coloring rather than clean flat fills), built as flat Blender planes
  following the drawing's fold lines with UVs unwrapped to the scan, given real edge thickness plus
  a **visible corrugated-edge bevel via a Solidify modifier**, then brought into Unity for
  lighting/animation. [gamedeveloper.com/art/deep-dive-how-paper-cut-mansion-was-made]

---

## 3. Visual signatures of real pop-ups (benchmark criteria for a rendered frame)

No single source gave a ready-made checklist of "what a mid-turn photo looks like," so this list is
synthesized from the VFX/lighting sources above plus the mechanical/kinematic facts in §1 (items
marked *[inferred]* are reasoned from the mechanics literature rather than directly stated by a
photographic source — flagging that distinction rather than overstating sourcing):

1. **Rigid, flat-faceted panels only** — no paperback-style continuous curl anywhere except exactly
   at crease lines (rigid-panel/compliant-crease model, §2). Any panel curving away from its fold
   lines reads as wrong.
2. **One shared driving angle** *[inferred from §1.6]* — every layer's rise/lean is a function of
   the *same* single page-opening angle α, just evaluated at each layer's own depth/offset; layers
   should never appear to pop on independent timers or eased curves unrelated to the page's own
   rotation.
3. **Visible glue-tab creases / flap lines** at the base of major standing pieces — real pop-ups
   almost always show a small telltale fold or tab edge where a panel meets its support page or
   platform (§1.1). A piece erupting from nothing, with no visible base attachment, reads as
   CG-fake.
4. **Soft, layered contact shadows, not hard self-shadowing** — the VFX reference explicitly
   avoided heavy shadowing and let light pass through the paper for softness (§2); expect diffuse
   penumbras between stacked layers rather than crisp AO-style contact shadow.
5. **Slight lag/lean of larger or farther-from-gutter pieces** *[inferred from §1.4–1.5]* — pieces
   riding longer strut chains (tube straps, cascaded secondary V-folds) have a different angular
   relationship to the shared driving angle than pieces mounted directly at the spine, so at a
   partial-open frame they are visibly *not* at the same fraction of "fully open."
6. **Visible paper edge/thickness and a die-cut silhouette** — real card stock shows a cut edge
   (often a distinct unprinted white/cream core) and consistent thickness across every piece (§2).
   Infinitely-thin flat planes without edge geometry read as "screen," not "paper."
7. **Printed art continues logically across a fold** — art is printed before die-cutting, so
   texture must align seamlessly across a crease in the flattened state, only visually "breaking"
   because of the 3D fold itself, never because of a texture seam (§2, horizon-line correction
   note in §4).
8. **A hard geometric limit at full open, not an infinite ease-out** *[inferred from §2]* — because
   the mechanism is a rigid linkage with a hard end-of-travel, the rise motion should stop firmly
   at a fixed configuration tied to the cover's own open limit, not decay asymptotically forever.
9. **Occasional asymmetric/lateral motion, not everything rising straight up** — asymmetric V-folds
   and pivot mechanisms sweep pieces sideways or diagonally (§1.2, §1.5); a benchmark frame with
   only vertical risers under-represents the real repertoire.
10. **Backdrop/background layers stay flatter and closer to the page plane than hero layers at any
    given opening angle** *[inferred from §1.1, §1.5]* — because backdrop panels are typically
    shallow platforms or small-V-angle folds while hero pieces use taller/steeper V-folds, a
    partial-open frame should show a rough depth ordering in "how far each layer has risen" that
    tracks narrative depth, not just literal camera distance.

---

## 4. Prior digital / WebGL / game implementations

1. **Andrew Glassner, "Interactive Pop-Up Card Design"** (Microsoft Research TR-98-03, 1998; split
   into two parts in IEEE Computer Graphics & Applications, 2002). A real interactive
   design/simulation tool, not just a paper. Rigging approach: **pure analytic geometry, not
   skeletal/bone animation** — each mechanism type (single-slit, asymmetric single-slit, V-fold)
   has a closed-form solve for its moving point(s) as a function of page angle ω, derived by
   intersecting **three spheres** (radii = the fixed link lengths, centers = the fixed points) —
   i.e. a rigid-distance-preserving multilateration, not an eased/interpolated rotation curve.
   Complex cards are represented as a **dependency graph of mechanisms rooted at the book's own
   fold and walked outward**, "inherently acyclic" by the physical nature of paper stacking.
   Explicitly unsolved (flagged as future work even here): **no collision detection between
   pieces** — the tool "relies on the designer's eye to prevent pieces from hitting one another."
   Also solves: **horizon-line texture correction** (nudging texture placement along a V-fold's
   crease so a background horizon reads level once the piece stands at an angle) and automatic
   template nesting/packing for print.
   https://www.glassner.com/wp-content/uploads/2014/04/MSR-TR-98-03-Interactive-Pop-Up-Card-Design.pdf

2. **Abel, Demaine, Demaine, Eisenstat, Lubiw, Schulz, Souvaine, Vigliett, Winslow — "Algorithms
   for Designing Pop-Up Cards"** (STACS 2013). Rigorous computational-geometry treatment: the whole
   mechanism is a planar linkage of rigid bars and joints (common joints, "flaps," and
   scissor-like "sliceforms"). Proves any simple polygon pops up to any angle 0–360° via nested
   V-fold-derived gadgets with a formal non-crossing proof (§1.3 above). Gives the explicit **shear
   map for multi-depth stage planes** used in §1.6. References further prior systems worth chasing:
   Mitani/Suzuki's origamic-architecture CAD tool (commercialized as **Tama Software's "Pop-Up Card
   Designer"**), **Li/Shen/Huang/Ju/Hu, "Popup: automatic paper architectures from 3D models"**
   (SIGGRAPH 2010), **Hendrix & Eisenberg's "Popup Workshop"** for children's computationally
   assisted paper engineering, and **Iizuka/Endo/Mitani/Kanamori/Fukui, "An interactive design
   system for pop-up cards with a physical simulation"** (2011) — the last is a genuine
   physics-simulation approach, a useful contrast to the rigid-body-analytic approach of #1 and #2.
   https://www.cs.tufts.edu/r/geometry/pdf/popup-stacs13.pdf

3. **Winder, Magleby, Howell — "Kinematic Representations of Pop-Up Paper Mechanisms"** (ASME J.
   Mechanisms & Robotics, 2009, BYU). Mechanical-engineering (not graphics) treatment using
   standard robotics kinematic-chain math (4-bar linkages, spherical vs. planar mechanisms,
   Gruebler/Kutzbach mobility equations) plus the PRBM for crease compliance. Not a
   rendering/rigging system itself, but the clearest formal vocabulary — floating layer, tube
   strap, arch/knee mechanism, series vs. parallel combination — for classifying and combining
   sub-mechanisms, and it maps directly onto a scene-graph/rig hierarchy. DOI 10.1115/1.3046128.

4. **Ruiz, Le, Low — "Generating animated paper pop-ups from the motion of articulated
   characters"** (The Visual Computer, 2015). Takes a 3D character animation (skeleton + motion
   clip) as input and automatically maps each bone/linkage chain onto an appropriate pop-up
   mechanism type (floating layer, single patch, etc.), estimating patch lengths/orientations from
   the motion, then uses **simulated annealing** to search for a valid non-overlapping layout, and
   outputs a printable template. Directly relevant prior art for "drive pop-up mechanism parameters
   continuously from an animation input" rather than hand-tuning each mechanism — conceptually
   close to what a real-time three.js rig needs to do as a page's dihedral angle changes.
   https://link.springer.com/article/10.1007/s00371-015-1125-8 (paywalled; open-access record at
   https://animorepository.dlsu.edu.ph/faculty_research/1730/)

5. **"Paper Cut Mansion" (Space Lizard Studio) — the "Reverse UV method."** Not a pop-up book, but
   the closest shipped real-time (Unity) production pipeline for a physically-plausible papercraft
   look — see §2 for the texturing/thickness recipe. Useful for material fidelity even though it
   doesn't address pop-up *kinematics*.
   https://www.gamedeveloper.com/art/deep-dive-how-paper-cut-mansion-was-made

6. **Naive bone-rig approach (for contrast)** — hobbyist Blender-armature tutorials (e.g. Sardi
   Pax's pop-up book rig) simply hand-rotate bones by keyframed amounts to fake fold motion, with
   **no underlying kinematic/geometric constraint solve** — the opposite end of the spectrum from
   #1–#3. It can look plausible for one simple isolated fold but has no built-in mechanism for
   guaranteeing flat-closure, non-collision, or correctly-coupled multi-layer motion the way the
   analytic approaches do. Worth naming explicitly as the approach to avoid for anything beyond a
   single hero fold. https://lesterbanks.com/2014/02/rigging-animating-popup-book-blender/

### Common pitfalls reported across these sources

- **No collision/self-intersection detection** in the most-cited interactive tool (#1) — even
  Microsoft Research-grade 1998 software left this to the designer's eye. A from-scratch three.js
  implementation should expect to need explicit clearance/offset tuning between stacked layers
  rather than assuming pure geometry prevents clipping.
- The rigorous non-crossing guarantee that *does* exist (#2's nested-V-fold theorem) only holds if
  each child mechanism's angular wedge stays strictly inside its parent's — i.e., z-fighting/
  clipping between stacked flat pieces is a real, formally-studied recurring problem, not a minor
  implementation detail to hand-wave away.
- **Texture-across-crease correctness** required deliberate handling even in 1998 (#1's
  horizon-line correction) — printed art wrapping a fold needs explicit UV/placement care so it
  doesn't visibly misalign once the piece stands at an angle.
- **No source found** describes a general solution for double-sided/back-of-panel texturing (what a
  viewer sees looking at the *back* of a raised piece as the book keeps opening past it). Treat
  this as an open implementation question rather than assuming a documented best practice exists.
