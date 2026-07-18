# What makes claymation read as clay — and how to get it under a 4-step toon ramp

Synthesis of two research passes (physical craft + digital reproduction),
2026-07-18. Source lists at the bottom.

## The one-line diagnosis for our fields

Our imperfections live at FEATURE EDGES (ridges, rims, shores). The open
fields between them are mathematically smooth in the two channels that
matter — albedo variance and micro-shadow — so they read as uniform CG
plastic. Aram's ping-pong-ball brief is the exact craft consensus: Aardman
calls it "thumbiness" (Nick Park encourages animators to be ROUGHER so
fingerprints show); Laika "chases imperfections and pulls them into the
work." Digital clay is an anti-uniformity problem.

## The ranked physical cues (scale as % of object diameter D)

1. Out-of-round silhouette (~1–5% D lobes) — WE HAVE (features + jitter).
2. Thumb-press ridges/dimples (dimples 2–5% D) — PARTIAL (dimple octave
   exists; reads weakly in fields — see quantization below).
3. **Pressed points read DARKER (dent AO)** — the halo of a dent darkens ~
   its own width. WE LACK IN FIELDS (crease dirt is slope-gated, fields
   are flat). This is Aram's "imperfections cast some shadow", literally.
4. **Multi-scale field lumpiness (2–8% D)** — WE LACK (fields smooth
   between features).
5. Tool marks / smear streaks (0.5–2% D wide, 10–20% D long) — WE LACK.
6. Matte-waxy sheen breakup — partial via ramp.
7. **Color mottling within one color (patches 5–20% D)** — value/sat
   drift, dirtier at "high-touch" spots. WE LACK ENTIRELY — biome colors
   are uniform per biome. Aram's "some parts deeper green."
8. Marbling veins (0.5–3% D, sparse) — foreign-hue streaks. WE LACK.
9. Seams — SKIP (Laika paints these out; mechanical, not material).
10. Subsurface translucency — SKIP for now (needs material work; the ramp
    + pastel palette already softens).
11. **Boil** — stepped (8–12 fps, NOT smooth) micro-jitter, amplitude
    well under 1% D. The Kirby "shifting finger impressions" cue. DIAL.
12. Grime specks (sub-0.5% D, sparse) — cheap garnish.

## The pipeline physics (why fields failed until now)

Flat facets + 4-step gradient ramp = each facet lands wholly in ONE
shading band. Micro-normal detail inside a facet is invisible; detail only
reads where a facet's normal crosses a band threshold (near terminators).
Two consequences:

- **Vertex COLOR is the unquantized channel.** The ramp quantizes light,
  then multiplies albedo — so color/value mottling survives at ANY
  frequency. It is the cheapest, most reliable clay cue we have.
- **Micro-shadow must be BAKED into color.** No shadow maps exist; dent
  self-shadowing (cue 3) can only ship as AO darkening painted into the
  vertex colors from the displacement field itself.
- **Facet-normal jitter is the third channel**: tuned so neighboring
  facets straddle a ramp boundary, quantization itself becomes the
  mottle mechanism — band-split speckle exactly where real clay shows
  texture (near the terminator).

High-frequency normal/bump detail (literal fingerprint maps) is doubly
dead: needs UVs we don't have, and the ramp throws it away. Claybook
(SDF) and Harold Halibut (photogrammetry) are non-portable pipelines;
their lesson is only WHAT to sell: cavity shadow + deformed silhouette +
scanned-imperfection albedo.

## The build recipe (Task 29)

1. Multi-scale vertex-color mottling per biome: value + slight saturation
   drift in patches 5–20% D; deeper-hue pockets (deeper greens in
   meadows); "high-touch" desaturated smudges; sparse marbling veins;
   rare grime specks. Deterministic hash noise, palette-derived shifts.
2. Field press-dents: legible shallow oval dimples (2–5% D) scattered in
   OPEN FIELDS, inward-only, gated exactly 0 on the lane band (contact
   budget 0.01247/0.0128R must not move).
3. Dent AO into albedo: every dent (new + existing dimple octaves)
   darkens its hollow ~ its own width, independent of slope — fields
   included.
4. Terminator mottle: facet-normal jitter measured against the ramp
   thresholds so field facets split bands near the terminator.
5. Boil dial: stepped ~10fps, amplitude ≲0.3% D, normals/color only
   (never ground truth), default SUBTLE — Aram feel-tests, easy off.

## Sources (credibility-ranked highlights)

Physical: Aardman/Newplast (Chromacolour supplier pages; AWN "Aardman at
50"; The Kid Should See This / Tested studio video; The Conversation);
Laika pipeline (Variety, befores & afters, Screen Daily); boil params
(Blender Stop Motion Animator extension docs; Dragonframe flicker guide);
SSS-absence = plastic (MeltFlex; 360render).

Digital: Claybook GDC 2018 (Aaltonen slides + video); Kirby Rainbow Curse
(Killscreen); Harold Halibut photogrammetry (Creative Bloq; devblog);
LAIKA SIGGRAPH 2019/2020 (blog.siggraph.org); toon-ramp × normal-detail
mechanics (Ronja's tutorials; Unity discussions); Blender clay shader
recipes (BlenderNation/SouthernShotty; Clay Doh); stepped-boil params
(Visini, camillovisini.com).
