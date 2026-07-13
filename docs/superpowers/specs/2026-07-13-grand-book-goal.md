# The Grand Book — goal charter (Part D)

2026-07-13. Supersedes the C-series benchmark as the umbrella goal; all
C laws (L1–L6) and gates remain in force and only ratchet upward. Book
knowledge base: `~/.claude/skills/paper-engineering/` (Birmingham 120 +
Hiebert), engine map in the volumetric spec.

## North star (pinnable one-liner)

A pop-up book you can't stop touching: every spread a mechanical paper
stage — varied fold families erecting, sliding and articulating with
the physical truth of real card stock, lit like a real object, telling
the six-kingdoms story — and the reader's own hand can pull, twist,
and keep pieces.

User's framing (approximate, per standing doctrine): pulley systems,
strip-driven moving pieces, visual clarity, fold variety, multi-level
systems, crisp real-paper animation, no interpenetration, proper
light, paper stacking, compelling story with complementary art
overlaps, removable-by-strip pieces, knob-twist tower erection.

## Pillars (each = an eye-testable definition of done)

P1 MECHANICAL VARIETY (L6 institutionalized at book scale)
   - Across the book: ≥6 distinct mechanism families on stage
     (v-fold clan, platforms/quadrilaterals, strips/flaps, kinetic
     linkages [hubs/discs/moving arms], spirals/twists, stage-set or
     shutter transitions), each family appearing somewhere as a HERO,
     not only as garnish.
   - Per spread: ≥2–3 families at varied stations/scales/drives; no
     two consecutive spreads share the same hero mechanism.
   - Multi-level: at least two spreads build vertically (stacked
     tiers, mechanisms riding mechanisms) per the stacked-V /
     multi-layer platform families.

P2 PAPER TRUTH (the "crisp like real paper" pillar)
   - No interpenetration at ANY opening angle, not just rest: the
     collision gate sweeps the full fold cycle; draw order/occlusion
     always matches physical stacking.
   - Sheets have visible thickness; stacked pieces rest ON each
     other; the closed book is a believable stack.
   - Every mechanism folds dead flat at closed (existing law) and
     moves with its family's motion character (strip early-rise,
     v-fold late-bloom, flap lever arcs).
   - Animation is hitchless: one clock, smoothness benches, no snap.

P3 LIGHT TRUTH
   - One consistent key light across the book; every lifted piece
     casts a contact shadow that anchors it; shadow scales with
     elevation and bloom.
   - Paper is a material: subtle translucency on thin pieces,
     edge highlights on cut edges, interior shading in gullies.
   - Sabuda principle honored: silhouette + shadow must carry a
     spread even before artwork lands on it.

P4 STORY & ART
   - Six kingdoms = six narrative beats (career story), each spread
     with one signature "wow moment" that fires as the page settles.
   - Artworks overlap ONLY where they complement (framing, depth
     echo, silhouette dialogue) — never accidental occlusion.
   - Art pipeline: I maintain the art call sheet (layer-ID contract,
     per-face UV notes); the user generates assets against it.
     Placeholders never block mechanism work.

P5 THE HAND IN THE BOOK (interaction)
   - Strip tabs visible at the fore edge invite pull/push to erect or
     fold their piece (user drive overrides page drive smoothly).
   - At least one knob/wheel station: twisting a paper disc drives a
     linkage that erects a structure (tower) tier by tier.
   - At least one removable keepsake: a strip pulls a piece fully out
     of the page; it lives outside the book until returned/reset.
   - Every gesture keeps the explicit-affordance law (grab handles;
     no gesture ambiguity with page swipes); rotation gets its own
     handle law when the knob family lands.

## Phase roadmap (each phase = derive bench → engine → covenant/tests
→ captures → user eye-test; thresholds only rise)

D1 STRIP WORKS (in flight): tabpiece with visible fore-edge tab —
   "knee" (mound) + table forms, page-internal strip, geared to book
   openness; automatic-strip vocabulary for future page-driven flap
   pieces. Foundation for P5.
D2 PAPER TRUTH PASS: full-sweep collision gates, draw-order audit,
   sheet thickness/stacking model, motion smoothness benches. Fixes
   the standing "cutouts go through each other" complaint. (P2)
D3 LIGHT TRUTH PASS: shadow system v2, key-light consistency,
   translucency/edge treatment; look-dev captures are the gate. (P3)
D4 KINETIC THEATRE: hub/pivot family — turning discs, moving arms,
   articulated figures; the knob-twist tower erection. (P1, P5)
D5 STORY ROLL-OUT: beat sheet per kingdom, palette placement pass
   across all spreads (variety audit against P1 quotas), art call
   sheet + integration of user-generated artwork, overlap-complement
   pass, one wow moment per spread. (P4)
D6 THE HAND: interactive strip pull/push, knob interaction, removable
   keepsake, polish (die-cut voids, endpapers), optional paper-sound
   moments. (P5)

## Known walls to derive through (not around)

- Removable pieces break fold-flat while removed: needs a "keepsake
  seat" rule (piece detaches to a desk plane in front of the book;
  the book only closes when its pieces are home, or the piece
  auto-returns on page turn). Derivation owed in D6.
- Knob rotation gesture vs existing pointer laws: rotation handle
  law owed in D4.
- True sheet thickness may conflict with current solved-plane
  geometry (SHEET_STACK_T is cosmetic today): derive bench owed in
  D2 before any renderer change.
- Full-sweep collision for strip-driven pieces crosses drive domains
  (page angle vs strip travel): the sweep must scrub both.

## Resources

Supplied: Birmingham (geometry canon), Hiebert (craft/material).
Worth supplying if available: Diaz & Carter "The Elements of Pop-Up"
(the professional production reference — multi-level builds, nesting,
production tolerances); slow-motion video of real pop-up books
opening/closing (motion truth reference for P2 easing). I can also
research targeted questions as they arise.
