# Physically-Correct Pop-up Book Kinematics — Literature + Closed-Form Math

Research date: 2026-07-10. Purpose: derive exact, rigid (no-stretch) closed-form kinematics for
WebGL pop-up pieces whose pose is a pure function of the spread's page-dihedral angle. Covers the
V-fold (spherical mechanism) and the parallel-fold / floating-layer (planar mechanism), the
constraints that make a piece stand-when-open / hide-when-closed, multi-layer scene rigging, and the
motion character ("snap/bloom" near fully open).

Legend: **[LIT]** = taken from the cited literature. **[DERIVED]** = my own derivation (grounded in
the cited rigid-origami / spherical-linkage framework), marked so you can re-check it.

---

## 1. Sources found

Primary (full text obtained and read):

- **Glassner, A. "Interactive Pop-up Card Design, Part 1."** IEEE CG&A 22(1), 2002, pp. 79–86.
  https://www.glassner.com/wp-content/uploads/2014/04/CG-CGA-PDF-02-01-Pop-Up-Cards-1-Jan02.pdf
  — Single-slit + asymmetric-slit geometry; the **three-sphere intersection** construction for the
  central crease point B; introduces the V-fold and the "floating layer" (parallel folding lines).
- **Glassner, A. "Interactive Pop-up Card Design, Part 2."** IEEE CG&A 22(2), 2002, pp. 74–85.
  https://www.glassner.com/wp-content/uploads/2014/04/CG-CGA-PDF-02-03-Pop-Up-Cards-2-Mar02.pdf
  — V-fold as generalization of single slit; full **three-sphere → radical-plane → line → ray-sphere**
  algorithm; **rotate-point-about-line** routine; floating layer; strap; generations (cascading);
  containment ("staying in bounds") and collision sweeping.
- **Winder, B. G., Magleby, S. P., Howell, L. L. "Kinematic Representations of Pop-Up Paper
  Mechanisms."** ASME J. Mechanisms & Robotics 1(2), 021009, 2009 (DETC2007).
  https://fab.cba.mit.edu/classes/865.18/discrete/folding/KinematicPaperMechanisms.pdf
  — Proves the V-fold is a **spherical four-bar**; single-slit/double-slit are spherical four-bars;
  parallel folds (tent, tube strap, arch, double-slit) are **planar four-bars/slider-cranks**; and,
  most importantly, the **link-length conditions** for fold-flat-at-0, fold-flat-at-180, and
  pop-up-at-180 (Eqs. 3–10 below).
- **Li, X-Y., Ju, T., Gu, Y., Hu, S-M. "A Geometric Study of V-style Pop-ups: Theories and
  Algorithms."** (Tsinghua/WashU; journal extension of the SIGGRAPH 2010 "Popup" paper.)
  https://cg.cs.tsinghua.edu.cn/papers/vpopup.pdf
  — The cleanest, directly-implementable rigid model: **every piece pose is a fixed linear
  combination of four moving unit axis-vectors X(t),Y(t),Z(t),W(t)** (their Eq. 1/2). Gives the
  Angle Condition (foldability), Decomposition/Hinge Condition (rigid connectivity), Stability
  (force-free), Enclosure (containment), and closed-form intersection tests (their Prop. 3).
- **Li, Shen, Huang, Ju, Hu. "Popup: Automatic Paper Architectures from 3D Models."** ACM TOG 29(4)
  (SIGGRAPH 2010). https://dl.acm.org/doi/10.1145/1778765.1778848 — the *parallel* special case
  (two groups of patches parallel to the pages) with stability conditions; superseded for our
  purposes by the v-style paper above, which cites and generalizes it.

Secondary / context (metadata + abstracts read):

- Okamura, S., Igarashi, T. "An Interface for Assisting the Design and Production of Pop-up Card."
  Springer LNCS 5531 (Smart Graphics 2009). https://link.springer.com/chapter/10.1007/978-3-642-02115-2_6
  — cube/box folds and closing-simulation intersection feedback (role only; formulas not needed).
- Iizuka, Endo et al. "An interactive design system for pop-up cards with a physical simulation."
  The Visual Computer, 2011. https://link.springer.com/article/10.1007/s00371-011-0564-0 — mass-spring
  *simulation*, not closed form; confirms the closed-form approach is the right call for us.
- Firgelli, "Spherical Four-bar Linkage Mechanism Explained."
  https://www.firgelliauto.com/blogs/mechanisms/spherical-four-bar-linkage — plain-language confirmation
  that spherical-linkage "length" = great-circle **arc angle** between joint axes.
- Hayes et al. "Planar and spherical four-bar linkage input–output equations."
  https://carleton.ca/johnhayes/wp-content/uploads/MECHMT-D-22-02564-F.pdf — algebraic spherical IO
  equation (Freudenstein analogue in direction cosines) if an algebraic (vs. geometric) solver is wanted.
- Foundational theorems used below: Kawasaki–Justin (flat-foldability) and Maekawa (M−V=±2), standard
  in Demaine & O'Rourke, *Geometric Folding Algorithms* (2007), and Hull, *Project Origami* (2006).

Note on secondary access: the SIGGRAPH "Popup" 2010 PDF is paywalled on the ACM DL; its stability
result is fully reproduced (and generalized) inside the v-style paper we did read, so nothing is lost.

---

## 2. Coordinate convention (used throughout) **[DERIVED — stated explicitly]**

Right-handed. Per spread, with its vertex at the point where the pop-up's central crease meets the gutter:

- **Gutter (spine) = the Z axis**, `ẑ = (0,0,1)`. Pages turn by rotating about `ẑ`.
- **Page dihedral `β ∈ (0, π]`** = the angle between the two pages, measured through the reader/front
  side. `β = 0` ⇒ closed (pages coincident), `β = π` ⇒ open flat. (This matches Winder's convention:
  0°=closed, 90°=perpendicular, 180°=open flat.)
- **Opening opens toward +X**; the two pages are symmetric about the **XZ plane** (the dihedral
  bisector plane). +X points "forward/up out of the open book"; the fully-open page plane is the YZ
  plane (`x=0`).
- **Per-page outward directions** (unit, ⟂ gutter, pointing from spine into the page):
  ```
  e_R(β) = ( cos(β/2), −sin(β/2), 0 )     // right page
  e_L(β) = ( cos(β/2), +sin(β/2), 0 )     // left  page
  ```
  Check: `cos∠(e_R,e_L) = cos²(β/2) − sin²(β/2) = cos β` ⇒ dihedral through +X is exactly `β`.
  At `β=0` both = `(1,0,0)` (coincident, closed); at `β=π` they are `(0,∓1,0)` (flat open, in the YZ
  page-plane). A page half-plane is `span(ẑ, e_page)`; its outward normal is `ẑ × e_page`.

Everything below expresses each rigid piece's frame in these axes as a **pure function of β**.

---

## 3. V-fold — the spherical mechanism (pieces glued across BOTH pages)

A V-fold is a separate paper piece with a single central crease dividing it into a right panel and a
left panel; each panel is glued to a page along a **glue crease** that makes angle `φ` with the gutter.
**[LIT: Winder §4.5.2; Glassner P1 "V-fold mechanisms"]** it is a **spherical four-bar**: all four
crease axes pass through the common vertex O on the gutter, so all faces move on a unit sphere about O.
The four faces around O are Right Page, Right Panel, Left Panel, Left Page; the four creases are the
gutter (Page|Page), right glue (RightPage|RightPanel), central crease (RightPanel|LeftPanel), left glue
(LeftPage|LeftPanel). **[LIT]** "the axes of the joints all intersect at the same point … the individual
links rotate about this fixed point" (Winder, citing Lee 1996 and Glassner).

### 3.1 Symmetric V-fold — exact closed form **[DERIVED; reproduces Glassner's bisector claim]**

Design parameters: glue-line angle `φ` (from gutter), and the rigid **panel corner angle `ρ`** =
the fixed angle, at O, between a panel's glue crease and the central crease (an invariant of the cut).

Glue-crease unit vectors (a ray in each page plane at angle `φ` from the gutter):
```
g_R(β) = cos φ · ẑ + sin φ · e_R(β) = ( sin φ cos(β/2), −sin φ sin(β/2), cos φ )
g_L(β) = cos φ · ẑ + sin φ · e_L(β) = ( sin φ cos(β/2), +sin φ sin(β/2), cos φ )
```
By symmetry the **central crease lies in the bisector (XZ) plane** — this is exactly Glassner's
observation "point B must lie on the plane that's halfway between plane 1 and plane 2 at any stage."
Write it as a unit vector at elevation `Λ` from the gutter:
```
c(β) = ( sin Λ, 0, cos Λ )
```
Rigidity of the right panel = the angle between crease `g_R` and crease `c` is the constant `ρ`:
```
cos ρ = c · g_R = cos φ · cos Λ + ( sin φ cos(β/2) ) · sin Λ                     (V1)
```
(The left panel gives the same equation by symmetry, so `c` is fully pinned.) Solve (V1), a linear
`A cosΛ + B sinΛ = cosρ` with `A = cosφ`, `B = sinφ cos(β/2)`:
```
Λ(β) = Φ(β) + arccos( cos ρ / R(β) )
R(β) = sqrt( cos²φ + sin²φ · cos²(β/2) )          // = |(A,B)|,  ranges cosφ (β=π) … 1 (β=0)
Φ(β) = atan2( sin φ cos(β/2), cos φ )                                            (V2)
```
Then build the panel frames directly:
```
n_R(β) = normalize( g_R(β) × c(β) )     // right-panel plane normal
n_L(β) = normalize( c(β) × g_L(β) )     // left-panel  plane normal
panel dihedral (angle between panels about c):  cos η = n_R · n_L                (V3)
```
A rigid point on the right panel with panel-local coords is placed as
`O + (its component along g_R)·g_R + (its component along c)·c` (barycentric-in-creases, exactly
Glassner Part 2's "riser" scheme: scale the central edge and a bottom edge, then add).

**Sanity checks of (V2):**
- `β→0` (closed): `R=1`, `Φ=φ`, so `Λ = φ + ρ` — the crease lies flat in the collapsed page plane
  (glue at φ plus panel angle ρ). ⇒ **the V-fold folds flat when closed, automatically.** ✓
- `β=π` (open flat): `R=cosφ`, `Φ=0`, so `Λ_open = arccos(cosρ / cosφ)`.
  - If **`ρ = φ`** ⇒ `Λ_open = 0` ⇒ crease along gutter, panels flat ⇒ the classic greeting-card V-fold
    that is flat at 0° AND 180° and peaks at 90° (Winder's "90° structure").
  - If **`ρ > φ`** ⇒ `Λ_open > 0` ⇒ **the V-fold STANDS when the book is open.** ← this is our case.

**⇒ Standing-when-open condition (symmetric V-fold): `ρ > φ`** (panel corner angle exceeds the glue
angle). This is the closed-form answer to "what makes it stand at 180 but hide at 0."

### 3.2 The rigid four-vector framework — general, multi-piece, directly implementable **[LIT: Li-Ju-Gu-Hu]**

This is the model to actually code. A v-style pop-up's whole state is carried by **four moving unit
axis-vectors** and **fixed per-vertex coefficients**. Their Eq. (1)/(2):
```
   every material point p:   p = x_p·X + y_p·Y + z_p·Z + w_p·W          (coords fixed for all time)
   its pose at fold-time:  f(p,t) = x_p·X(t) + y_p·Y(t) + z_p·Z(t) + w_p·W(t)         (Li Eq. 2)
```
Axis meanings **[LIT]**: `X` ∥ (right plane ∧ backdrop), `Y` ∥ (left plane ∧ ground),
`Z` ∥ (both left & right moving planes), `W` ∥ the central hinge (the gutter). How they move:
```
Y(t) = Y                 (ground axis — fixed; the ground page doesn't move)
W(t) = W                 (gutter axis — fixed; it is the rotation axis)
X(t) = rotate X about W by −φ·t   (the backdrop page turning about the spine)     (Li §3.2)
Z(t) = the unit vector at fixed angle γ from Y(t) and fixed angle δ from X(t)      (Li §3.2)
```
`Z(t)` is the crux: it is the **intersection of two cones** (equivalently two circles on the unit
sphere) — the locus at angle γ from the fixed `Y` and at angle δ from the moving `X(t)`. As the page
turns, `Z(t)` traces the pose of the two standing planes. Choose the branch continuously (see §7).
Because `X(t)` is literally the backdrop page rotated about the spine, **re-parameterising Li's `t` by
our page dihedral β is direct**: rotate `X` about `W` so the ground↔backdrop dihedral equals β.

**Angle Condition (foldability / no lock)** **[LIT: Li Prop. 1]**, with the four inter-axis angles
`α,β_ax,γ,δ` (renamed `β_ax` to avoid clashing with the page dihedral):
```
   α + β_ax > π,     α + β_ax + γ + δ > 2π,     α − γ = β_ax − δ > 0.
```
This guarantees the two cones defining `Z(t)` keep intersecting for all `t∈[0,1]` — i.e. the mechanism
never jams. **Cartesian special case** (recommended for a clean engine): pick `X,Y,Z` mutually
orthogonal (the Cartesian axes) and `W` on the angular bisector of `X,Y`; then `α=β_ax=π/2`,
`γ=δ=3π/4`, and the intersection tests collapse to the simple inequalities in §6.

### 3.3 Asymmetric V-fold / asymmetric slit (`φ_L ≠ φ_R`) **[LIT: Glassner P1 + Kawasaki–Justin]**

Glassner's asymmetric single slit: the central crease `AB` makes angle to the support crease, and the
**flat-fold condition places B so the two induced triangles are congruent-in-angle** (his result, with
the fold no longer following the backing crease). The general law for any single degree-4 vertex is:

**Kawasaki–Justin theorem (flat-foldability):** a single vertex with sector angles `θ₁…θ_{2n}` in
cyclic order folds flat **iff** alternating sums are equal:
`θ₁+θ₃+… = θ₂+θ₄+… = π`. For degree-4: `θ₁+θ₃ = θ₂+θ₄ = π`.
**Maekawa:** #mountain − #valley = ±2 at the vertex.

For the asymmetric V-fold with glue angles `φ_L, φ_R` and panel corner angles `ρ_L, ρ_R`, the four O-sectors
are `(φ_R, ρ_R, ρ_L, φ_L)`; flat-foldability at closed requires the Kawasaki pairing on those four
sectors. The pose still solves as a spherical four-bar: `g_L,g_R` are as in §3.1 but with `φ_L,φ_R`;
`c` is **no longer in the XZ plane** — solve it as the point at angle `ρ_R` from `g_R` and `ρ_L` from
`g_L` (two-cone / circle intersection, §4/§7), then `n_R = g_R×c`, `n_L = c×g_L` as before. If an
algebraic solver is preferred over the geometric one, use the spherical four-bar input–output equation
(Freudenstein analogue in direction cosines; Hayes et al.).

### 3.4 Glassner's three-sphere solver (alternative, and the general non-symmetric fallback) **[LIT: Glassner P1+P2]**

Glassner locates the free crease point **B** (works for slit and V-fold; V-fold just uses different
radii) as the intersection of three spheres. Given fixed points A, D and the rotated point C (C is C
rotated about the fold line by the current opening), with `B0` = position of B when β=0:
```
spheres:  S_A=(A, |A B0|),  S_D=(D, |D B0|),  S_C=(C, |D B0|)
```
Solve their common point:
1. For a sphere pair (C1,r1),(C2,r2) at distance d, the **radical plane** passes through
   `J = C1 + (C2−C1)·(d² + r1² − r2²)/(2 d²)` with normal `C2−C1`.  (Glassner P1/P2)
2. Intersect two radical planes → the radical **line** `L = B + tV` (use Blinn's two-plane line
   formula for stability; `V = N_P × N_Q`).
3. Intersect `L` with the **largest** sphere (ray–sphere) → two points; pick the branch on the
   reader side using the sign of `(point − D)·n_D` where `n_D` is the D-riser normal (design flag).

Also needed — **rotate point P about line (A,B) by angle φ** (Glassner P2, a Rodrigues form):
```
C = B−A ;  M = A + Ĉ (Ĉ·(P−A)) ;  H = P−M ;  V = H×C ;  r = |P−M|
Q = M + r·Ĥ·cos φ + r·V̂·sin φ
```
Use the four-vector framework (§3.2) as the primary engine; keep the sphere solver as a general
fallback for irregular/asymmetric glue layouts.

---

## 4. Parallel-fold / floating-layer — the planar mechanism (creases ∥ gutter)

**[LIT: Winder §4.4 — "planar mechanisms have parallel joint axes … parallel to the gutter; Carter &
Diaz call these parallel folds."]** Work in the **cross-section plane ⟂ gutter**. The two pages are two
rays from the origin O with dihedral `β` between them. This is a **planar four-bar** loop
`O → A → B → C → O`:

- `A` = glue point on the **left** page at distance `dL`:  `A = dL · L̂(β)`
- `C` = glue point on the **right** page at distance `dR`:  `C = dR · R̂(β)`
- rigid strut A→B of length `wA`, rigid strut B→C of length `wC`; **B is the floating crease** to solve.

In the cross-section use 2D page directions `L̂ = (−sin(β/2), cos(β/2))`, `R̂ = (sin(β/2), cos(β/2))`
(x = across-spine, y = up-out-of-open-book), so the pages open symmetrically about +y.

### 4.1 Circle–circle intersection for B — full solution **[DERIVED — standard construction]**

`B` is the intersection of `circle(A, wA)` and `circle(C, wC)`:
```
D   = |C − A|                                   // current distance between glue points
ê   = (C − A)/D                                 // unit A→C
a   = (D² + wA² − wC²) / (2D)                    // signed dist. A→foot of radical line
h²  = wA² − a²                                   // must be ≥ 0
M   = A + a·ê                                    // foot on line AC
n̂   = (−ê_y, ê_x)                                // left-normal to AC (2D)
B±  = M ± sqrt(h²)·n̂                             // two branches
```
Pick the branch with the larger `y` (platform above the pages) and keep it continuous in β (§7).
**Existence / non-lock:** `|wA − wC| ≤ D(β) ≤ wA + wC` for all β in the used range (else `h²<0`, the
mechanism has torn or reached a singular lock). Lift B back to 3D by adding its gutter coordinate:
a platform corner at gutter position `z0` is `(B_x, B_y, z0)`; a whole rigid platform is two such
corners swept along z, i.e. the strut/panel frames are `{B−A}`, `{C−B}` extruded along `ẑ`.

### 4.2 Flat-fold, standing, and "stays-parallel" constraints **[LIT: Winder Eqs. 3–10]**

Map the four link lengths `L1=dL (O→A)`, `L2=wA (A→B)`, `L3=wC (B→C)`, `L4=dR (C→O)`:

- **Won't reach fully-open** (locks before β=π), Winder Eq. 3:  `L1+L2 < L3+L4`  ⇒ `dL+wA < wC+dR`.
- **Folds flat at 0° (hidden when closed)**, Eq. 4:  `L1+L4 = L2+L3`  ⇒ **`dL + dR = wA + wC`**.
- **Folds flat at 180° (lies flat when open)**, Eq. 5:  `L1+L2 = L3+L4`  ⇒ `dL + wA = wC + dR`.
- **Pops up / stands at 180°** (layered), Eq. 10:  `L1+L2 ≠ L3+L4` — take `dL + wA > wC + dR`.
- **Parallelogram (platform stays PARALLEL to the pages, flat at both 0° & 180°)**, Eqs. 8–9:
  `L1=L3, L2=L4` ⇒ **`dL = wC` and `wA = dR`**. A parallelogram four-bar holds its coupler (the
  platform) parallel to the ground — this **is** Glassner's "floating layer."

**⇒ Design recipe for a floating platform that is hidden-flat when closed but STANDS proud when open:**
keep flat-at-0 (`dL+dR = wA+wC`) and break the flat-at-180 equality toward `dL+wA > wC+dR`. For a
*parallel-holding* platform that rises straight up, use the symmetric parallelogram `dL=wC`, `wA=dR`,
`dL=dR` (rises vertically, stays horizontal).

**[LIT: Glassner P2 "floating layer"]** Practical floating layers use **two side supports at equal
height and equal distance from the spine (plus a middle support for stability)**; unequal support
heights tilt the platform from flat to inclined ("mountain/tent" if the side supports shrink, "valley"
if the middle shrinks).

---

## 5. Multi-layer theatrical scene rigging (one page-turn drives everything)

Two literature patterns, both giving "one dihedral drives all layers":

- **Single shared parameter (Li-Ju-Gu-Hu).** Because *every* patch pose is
  `f(p) = x_p X(β) + y_p Y(β) + z_p Z(β) + w_p W(β)` with the SAME four axis-vectors, a scene of many
  standing planes at different spine-distances is just many patches with different fixed
  `(x,y,z,w)` coefficients. Turning the page updates `X(β),Z(β)` once; **all layers follow for free**,
  rigidly and collision-consistently. Planes parallel to the gutter (theatrical flats at different
  depths) get `z_p=0` and differ only in their `x_p`/`y_p` (depth). This is the recommended rig.
- **Cascading / "generations" (Glassner P2).** A pop-up need not be driven by the central card fold —
  it can be driven by the **induced crease of an earlier riser** ("as the riser pops up, it's like a
  little card opening, and the fold of that little card drives another pop-up"). Kinematically this is
  Winder's **series/parallel combination** (§5): *parallel* = a secondary mechanism also anchored to a
  base page (e.g. a floating layer, Winder Fig. 20); *series* = the secondary rides entirely on the
  primary (e.g. a V-fold sitting on one edge of a strap that spans the gutter — the ship-behind-iceberg
  card). Depth ordering falls out of the shared β, so parallax between layers is automatic.

Practical note **[LIT: Glassner P2]**: each V-fold generation sits at an angle a little closer to the
viewer and on a shallower crease, so only a few clean generations stack before viewing angles degrade —
prefer many *parallel* layers driven by one β over deep *series* cascades.

---

## 6. Validity constraints (bake these into the engine)

- **Rigidity / no stretch** — automatic if you use §3.2 or §4.1: poses are rigid combinations of
  fixed coefficients with length-preserving axis vectors. Never interpolate vertex positions directly.
- **Foldability / no jam** — V-fold: satisfy the **Angle Condition** (§3.2) so `Z(β)` always exists;
  symmetric case needs `cos ρ ≤ R(β)` for all β, guaranteed when `ρ > φ`. Parallel-fold: keep
  `|wA−wC| ≤ D(β) ≤ wA+wC` (§4.1).
- **Containment when closed (enclosure)** — **[LIT: Li §3.4; Glassner P2 "staying in bounds"]** set
  β→0 and require every point's closed position `x_pX(1)+y_pY(1)+z_pZ(1)+w_pW(1)` to lie inside the
  ground patch (Li). Glassner does the same operationally: fold to 0°, recompute all points, flag any
  outside the outermost card.
- **No self-intersection during motion** — **[LIT: Li Prop. 3]** two points with coefficient
  difference `{x′,y′,z′,w′}` collide at some `t∈(0,1)` **iff all** hold:
  1. `{x′>0, y′>0, z′<0, w′<0}` or the all-flipped sign pattern;
  2. `x′² + x′z′cosα − x′w′cosδ = y′² + y′z′cosβ_ax − y′w′cosγ` (call it ρ*);
  3. `z′² + x′z′cosα + y′z′cosβ_ax = w′² − x′w′cosδ − y′w′cosγ`;
  4. `−x′y′cos(δ−γ) < ρ* < −x′y′cos(δ+γ)`.
  **Cartesian** simplification (`α=β_ax=π/2, γ=δ=3π/4`): (1) same sign pattern; (2) `x′=y′`;
  (3) `z′² = w′(2x′+w′)`; (4) `w′ > 2z′`. Cheap enough to run per-pair or via their conservative
  tile test. Glassner's fallback is a **sweep**: step β 0→π (~250 steps), reposition, flag any edge
  passing through any plane.
- **Stability / force-free (no floppy pieces)** — **[LIT: Li Prop. 2]** there must be a patch ordering
  `h1,h2,…` with `h1,h2` = the two pages, and every later patch pinned by **two non-colinear hinges**
  to earlier patches (or a pair pinned together). Equivalent to Winder: no sub-loop has a spare DOF.
- **Monotonic motion** — **[LIT: Li Def. 2]** the fold transform requires the dihedral to change
  monotonically; the inverse is monotone too. So pose is a single-valued function of β with no
  reversals — provided you stay on one circle-intersection branch (§7).

---

## 7. Motion character — the "snap/bloom" near fully open is in the geometry **[DERIVED + LIT]**

The characteristic real-pop-up feeling (slow build, then a fast bloom in the last few degrees of
opening) is **not** hand-animation; it falls straight out of the closed form. From the symmetric V-fold
(§3.1), the standing height of a unit-length central crease, measured ⟂ to the fully-open page plane
(= its +X component), is
```
h(β) = sin Λ(β),     Λ(β) = Φ(β) + arccos( cos ρ / R(β) ),   R(β)=sqrt(cos²φ + sin²φ cos²(β/2)).
```
Differentiate the arccos term: `d/dβ arccos(cosρ/R) = [cosρ /(R² √(1 − cos²ρ/R²))] · dR/dβ`. As
`R → cos ρ`, the factor `√(1 − cos²ρ/R²) → 0`, so **`dΛ/dβ → ∞`**: a geometric snap. `R(β)` decreases
monotonically from `1` (β=0) to its minimum `cos φ` (β=π). Therefore:

- If `ρ < φ`: there is a `β* < π` where `R(β*) = cos ρ` — a **hard lock/snap-flat** (the panel goes
  singular and the spread refuses to open past β*). This is Winder's Eq. 3 lock, felt as a snap.
- If `ρ > φ` (our standing case): `R(β) > cos ρ` for all β (min `R=cosφ > cosρ`), so **no interior
  singularity** — motion is smooth, and the closest approach to the singular value is exactly at
  **β = π**, where `|dΛ/dβ|` is largest. ⇒ **the pop-up accelerates into its final bloom as the book
  reaches flat-open**, tapering elsewhere. Making `ρ` only slightly greater than `φ` gives a sharp
  late snap; `ρ ≫ φ` gives a gentle, even rise. **The timing is a free consequence of `ρ`, `φ`.**

Corollary for the "90° card" (`ρ = φ`): height peaks at β=90° and returns to zero at both ends — near
fully-open such a piece is *descending*. So whether a piece blooms or settles near 180° is decided by
the sign of `ρ − φ`. Drive the animation by the true dihedral β (e.g. from a page-turn easing curve),
**not** by lerping the pose, and the geometry supplies the organic non-linear rise for free.

---

## 8. Pitfalls the literature warns about

- **Singularities at β=0 and β=π.** At β=0 pages coincide → page normals and cross-products degenerate;
  at β=π the bisector-plane normal and the circle/cone intersections go **tangent**. Glassner (P1)
  explicitly: "the most extreme case is when the card is fully open or closed, and the circles are
  tangent — they never fully separate." Clamp β to `(ε, π−ε)` for frame math, or special-case the
  endpoints analytically (endpoints have closed forms: §3.1 gives `Λ(0)=φ+ρ`, `Λ(π)=arccos(cosρ/cosφ)`).
- **Branch selection (the big one).** Circle–circle and cone–cone intersections have **two** solutions;
  the wrong branch flips the piece under the page or inside-out. Choose once by the reader-side test
  (Glassner: same side of the radical plane as the known point C / sign of `(pt−D)·n_D`; Li: the fixed
  coefficient **sign pattern**), then **carry the branch continuously** across frames — never re-pick
  by nearest-root mid-motion or the piece will pop through the singularity.
- **Rigid vs. real paper.** All formulas assume zero-thickness, rigid, weightless paper (Li's
  assumptions; Glassner treats stiff sheets). Real snaps also store elastic energy (see the
  snap-through-of-folded-strips literature) — fine to ignore for a visual engine, but it means our
  "snap" is purely kinematic (geometry), which is what we want for determinism.
- **Deep cascades degrade** (Glassner §"Generations"): prefer parallel layers on one β over many
  series generations.
- **General foldability is NP-hard** (Uehara–Teramoto 2006, cited by Li): do **not** attempt a
  general solver — stay inside the v-style / parallel-fold families, which have the closed forms above.

---

## 9. What to implement (bottom line)

1. Represent each spread by its **page dihedral β(t)**; a page turn is one spread's β going π→0 while
   the next spread's β goes 0→π. Pieces are glued to a spread and posed purely from that spread's β.
2. For standing pieces use the **four-vector rig** (§3.2): fixed per-vertex `(x,y,z,w)`, moving
   `X(β),Y,Z(β),W`; `Z(β)` from the two-cone intersection with a **fixed branch**.
3. For floating platforms / theatrical flats parallel to the spine use the **planar four-bar** (§4):
   circle–circle for B, parallelogram `dL=wC, wA=dR` to hold parallel, or break it toward
   `dL+wA > wC+dR` to make it stand.
4. Enforce: flat-at-0 (`dL+dR=wA+wC` / `Λ(0)=φ+ρ`), stand-at-open (`ρ>φ` / `dL+wA>wC+dR`), Angle
   Condition, enclosure at β=0, Li's Prop-3 intersection test, Prop-2 stability ordering.
5. Get the snap for free by driving with real β and choosing `ρ` slightly above `φ`.
