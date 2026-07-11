# Volumetric Pop-up Mechanisms — Box-Fold Research (2026-07-11)

Research agent report (sonnet, primary sources fetched in full), commissioned
after the user's volumetric feedback: "paper cutouts from pop up books
contained papers that were cut to have more dimensions... 3d where from
sides they would also tell a story and would be hollow in the middle and the
top would again be a painting."

## 1. THE OPEN BOX — full construction (Ruiz/Le/Yu/Low box-fold)

Primary source: Ruiz Jr., C.R., Le, S.N., Yu, J., Low, K.-L. (2014).
"Multi-style Paper Pop-up Designs from 3D Models." Computer Graphics Forum
33(2), 487-496. DOI 10.1111/cgf.12320.
PDF: https://www.comp.nus.edu.sg/~lowkl/publications/multistyle_popup_eg2014.pdf
(plus the SIGGRAPH Asia 2013 Technical Briefs precursor, .../multistyle_popup_sa2013.pdf)
This is the ONLY paper formally defining the box-fold as a rigid mechanism
("box-fold has yet to be formulated in detail in previous work").

**11 patches**: G, B (the two book pages), L, R (side walls), F_L, F_R
(front pair), B_L, B_R (back pair), T_G, T_B (top, split in two), and C
(a "special backbone").

Layout:
- L and R glued so they "form equal angles with G and B, and are
  equidistant to the central fold." All hinges B-R, R-T_B, T_B-T_G, T_G-L,
  L-G are PARALLEL to the central fold (gutter).
- **C is the rigidizing element**: "a special backbone glued
  perpendicularly to G and B at their common fold line" — a strip standing
  up out of the gutter, splitting the box front-to-back.
- T_G + T_B form the lid, hinged along C's top edge and along the L/R
  side creases — structurally a V-fold sitting on top of the box.
- F_L/F_R (front) and B_L/B_R (back): F_L and F_R share a hinge and
  connect to L and R respectively; **the F_L-F_R hinge (and B_L-B_R) must
  be coplanar with patch C** (bisector plane). The F/B patches are NOT
  glued to C — they float against it. Only one pair is strictly required;
  both are used "for better symmetry and sturdiness"; multiple stacked
  pairs allowed (stepped fronts).
- Only G and B touch the pages; everything else glues patch-to-patch.
- Cross-sections (their Fig. 6/7): front cross-section is quadrilateral
  loop g-l-c-r-b with tops t_g/t_b; top cross-section is loop
  g-f_l-c-f_r-b — two coupled four-bar loops sharing the dihedral.

## 2. RIGIDITY — what kills the sway mode

Direct quote: "If the angle between C and G may change while G and B are
held stationary, then the box will undergo a shearing effect. However, it
also contains the front and back patches, F_L, F_R, B_L, B_R, which keep
L and R from shearing. In other words, C cannot rotate while G and B are
opened at an arbitrary angle. As a result, a box-fold structure is stable."

I.e. the naive model (side walls glued + front/back walls hinged between
them) is missing C. Without C the box parallelogram-sways (confirmed
independently by our own derivation, derive-box.mjs). Diagnostic in real
books: the visible **vertical center seam** down a box's front/back faces
is C peeking through between F_L/F_R.

## 3. FLAT-FOLD CONDITIONS

Via Hara & Sugihara 2009 (2D quadrilateral folds flat iff a+b = c+d):
- Front cross-section: **b + r = c + t_b** and **g + l = c + t_g**
  (lowercase = side lengths of same-named patches).
- The F/B patches fold flat automatically because their hinges are
  coplanar with C and bisect the L-R angle.
This generalizes Winder's planar four-bar Eq. 4 (L1+L4 = L2+L3): the
box-fold is two coupled four-bars sharing the dihedral as common input.

## 4. STEP FOLD — Winder's four-bar equations (confirmed)

Winder, B.G., Magleby, S.P., Howell, L.L. (2009). "Kinematic
Representations of Pop-Up Paper Mechanisms." ASME J. Mechanisms &
Robotics 1(2):021009. DOI 10.1115/1.3046128.
https://fab.cba.mit.edu/classes/865.18/discrete/folding/KinematicPaperMechanisms.pdf
- Flat at 0 (closed): L1 + L4 = L2 + L3 (Eq. 4)
- Flat at 180 (open): L1 + L2 = L3 + L4 (Eq. 5)
- Won't reach 180: L1 + L2 > L3 + L4 (Eq. 3)
- Pops up at 180: L1 + L2 < L3 + L4 (Eq. 10)
- Deltoid: L1=L2, L3=L4; Parallelogram: L1=L3, L2=L4 (flat at BOTH ends).
- Ruiz's step-fold = Li et al.'s mechanism "D2": S1 parallel to S3, S2
  parallel to S4, pops at 90 degrees.
- Tent-fold: |T1|=|T2|, |T3|=|T4|, |T3|>|T1|, creases parallel to gutter.
NOTE (agent flag): a separate Winder BYU "thesis" document and any
Sequin/Berkeley connection could NOT be verified — treat that citation
lineage with suspicion; the ASME paper is the real source.

## 5. CLOSED-FORM POSE MATH — the implementation path

Li, Xian-Ying; Ju, Tao; Gu, Yan; Hu, Shi-Min (2011). "A Geometric Study of
V-style Pop-ups: Theories and Algorithms." ACM TOG 30(4):98 (SIGGRAPH).
https://cg.cs.tsinghua.edu.cn/papers/vpopup.pdf
(Already summarized in our kinematics lit doc section 3.2 — the rigid
four-vector framework.)

- Every patch is parallel to one of FOUR planes: ground, backdrop,
  left-plane, right-plane ("v-style"). Define unit vectors X, Y, Z, W with
  pairwise angles obeying the Angle Condition (gamma+delta > pi,
  alpha+beta+gamma+delta > 2pi, gamma-alpha = delta-beta > 0).
- Decomposition (once, at the reference pose): p = x_p X + y_p Y + z_p Z + w_p W.
- Pose at fold parameter t: f(p,t) = x_p X(t) + y_p Y(t) + z_p Z(t) + w_p W(t),
  with Y, W fixed, X(t) = X rotated about W by the fold angle, Z(t) = the
  unique vector keeping constant angles with Y(t) and X(t) (two-cone
  construction, same as our bisectorCrease). No per-frame solve.
- Prop. 1 proves rigidity + parallelism for all t; Prop. 2 gives a
  combinatorial stability (bracing) test.
- TERMINOLOGY TRAP: Li et al. call their D2 mechanism "box-fold" but it is
  the STEP fold; Ruiz's 11-patch structure is the actual enclosed prism.
- **Li's "type-1 v-fold" (their Fig. 5c, 8 patches: G, B, F_L, F_R, B_L,
  B_R, T_G, T_B — no C, no L/R)** also "forms a complete box" at open —
  the classic 45-DEGREE DIAMOND BOX (front/back walls at 45 degrees to the
  gutter). Simpler primitive, worth having both.

## 6. FLAT-TOPPED BOX / LIDS

The T_G+T_B pair IS the lid — integral, hinged into walls + backbone,
zero independent DOF. No documented "loose resting lid" variant (would
need gravity/friction, incompatible with pose-as-function-of-beta).
Alternative pattern (non-academic, flagged): pre-assembled rigid solid box
driven by a separate "tube post" armature (Winder's series combination /
driver dyad) — a second code path for solid, non-hollow boxes.

## 7. OUR OWN DERIVATION FINDINGS (this session, .superpowers/sdd/bench/)

- derive-box.mjs (naive: side walls glued full-edge + front/back hinged
  between them, no C): (a) the exactly-open pose is a TANGENCY SINGULARITY
  (front wall pulls dead straight at beta=pi — branch = pre-creased buckle
  direction, path-follow from near-open); (b) the assembly has a LATERAL
  PARALLELOGRAM SWAY mode — confirming C is load-bearing, matching Ruiz.
- derive-diamondbox.mjs (Li type-1 attempt): two mirrored phi=45/rho=90
  v-folds stand perfectly vertical at open (rho=90 IS the 45-degree box
  rule: Lambda_open = 90deg exactly) and their lid QUAD IS PLANAR through
  the whole sweep (2.8e-17) — but a lid naively spanning
  [apexTop, glueTop] edges of the two walls DEFORMS (max edge drift 0.37):
  the type-1 box's T patches must hinge along different edges than I
  guessed. NEXT: pull Li Fig. 5c's exact patch adjacency (which edges T_G
  hinges on) or build the box in the four-vector framework directly, where
  rigidity is guaranteed by construction and the patch shapes FOLLOW from
  the decomposition.

## 8. Unverified / open

- Birmingham's box/cylinder chapter rules (no full text access) — only his
  taxonomy quote via Winder: "'true pop-ups' are extensions of the V-fold,
  the parallelogram, and/or the 45 deg fold."
- Ruiz cap/tab microdetails (tab shapes) — the paper auto-generates flaps.
- Hara & Sugihara 2009 not fetched directly (theorem quoted inside Ruiz).
