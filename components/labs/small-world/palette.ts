/** Small World color system — spec: docs/superpowers/specs/2026-07-16-labs-small-world-design.md */
export const PALETTE = {
  meadow: '#7BC47F',
  leaf: '#4E9A51',
  sprout: '#A8DCA0',
  blossom: '#F7A8C4',
  blossomDeep: '#E86FA4',
  river: '#6FB7D9',
  riverDeep: '#4E9EC7',
  sky: '#FFF3D6',
  horizon: '#FFE3EC',
  clayPath: '#D98E6A',
  ink: '#2B2B33',
  // chapter accents (tints of the base system)
  honey: '#F7C948',
  dune: '#E8C58A',
  tuff: '#DE8E9E',
  // authored-biome tones (Task 15)
  snow: '#F5F2EA',
  earth: '#7E4E2E',
  pine: '#3B7A46',
  // per-wedge scene accents (Task 20)
  springGreen: '#59C56A', // A0 vivid spring
  petal: '#FF9DC2', // A1 flower-drift pink
  sand: '#E9D4A0', // A2 delta / B0 dune light sand
  goldSand: '#E6B24C', // B0 rich golden dune body
  earthDeep: '#5A3216', // B1 canyon channel floor / deep walls
  rust: '#A85A32', // B1 canyon terracotta bank
  ice: '#DCEAF2', // B2 frozen water rim / icy-lake sheet (Task 40)
  iceDeep: '#6E97AE', // B2 icy-lake pressed crack veins (Task 40) — darker blue-grey in the pale ice
  // field mottling (Task 29) — a drier, desaturated sage for the meadow's
  // "high-touch" smudges (variance WITHIN the green, still pastel, never muddy)
  meadowDry: '#A3BE96',
  // per-FIGURE identity (Task 23) — deeper SATURATION, still pastel daylight
  blossomRose: '#E8659B', // A1 deep-rose petal blob (the flower riot's richest bloom)
  bluebell: '#A79BE8', // periwinkle bell flower (A0/A1 — a cool note among the pinks)
  lupine: '#CE79CE', // spike flower (violet-magenta lupine/foxglove)
  foliageDeep: '#3F9A55', // deeper broadleaf crown (spring woods, lobed silhouette)
  pineDeep: '#357E48', // deep conifer green for pinched-cone crowns
  stone: '#94745C', // canyon boulder clay-stone (faceted pinch)
  // girl blend (Task 24) — contact-shadow pool at the ramp floor, warm ink so
  // she grounds into the clay rather than casting a cool neutral disc
  shadowClay: '#3A2F30',
  // Task 42 — jungle (A1, the 2nd green wedge): deep saturated jungle greens for the
  // ground AND the dense flora, so the wedge reads "very green". The ground base is
  // jungleFloor; the accent deepens to jungleDeep in the shadow pockets and lifts to
  // jungleMoss on the fern-lit highlights (the shared green field-mottle then layers its
  // foliageDeep pockets + pineDeep veins on top for a lush, mottled floor).
  jungleFloor: '#3C9450', // rich jungle ground green (A1 accent base)
  jungleCanopy: '#2E7D46', // broad-leaf canopy crowns
  jungleDeep: '#1F6236', // deep understory shadow-green (crowns + ground pockets)
  jungleMoss: '#4FA85C', // bright fern/moss highlight (ground + ferns)
  jungleVine: '#37703F', // hanging vine loops
  jungleLeaf: '#245E36', // dark understory big leaves
  jungleBark: '#6E4A32', // broad-leaf trunks
  // lurking jungle animals (Task 42) — one accent colour each
  snakeBody: '#3FA65A', // emerald snake coil
  snakeBelly: '#B7D98A', // pale snake underside
  jaguarFur: '#D9A24A', // golden cat fur
  jaguarEye: '#F2D65C', // amber glowing eyes
  parrotBody: '#E24B3A', // scarlet parrot
  parrotWing: '#3FA6C4', // teal wing + tail
  frogBody: '#5FBE4A', // bright green frog
  frogThroat: '#D7E7A0', // pale frog throat
  // Task 46 — desert life that appears on approach: the camels (merged single-draw clay
  // animals, sand-family body + a warm saddle accent) and the oasis palm cluster (reuses
  // leaf/clayPath). One accent colour each, in the golden-desert family.
  camelHide: '#D2A15E', // warm sandy-tan camel body (sits in the goldSand/dune family)
  camelHideDeep: '#B07E3F', // shaded camel underside / legs
  camelSaddle: '#B0563A', // terracotta saddle blanket accent
  reedGreen: '#8FB055', // dusty oasis reed/grass tuft (drier green than the jungle)
  // Task 48 — the A2 grand delta gets its OWN wet-sandy vocabulary, distinct from BOTH the
  // desert gold and the jungle deep-green: damp silt banks, pale wet sand bars and
  // olive-green wetland pockets. The ground base is deltaSilt; the mottle lifts to
  // deltaSand on the dry crests and sinks to deltaMoss in the reed-grown hollows.
  deltaSilt: '#828B54', // DAMP olive-silt delta ground (A2 accent base) — dark wet mud, reads
  // clearly wetter (lower value) than the bright DRY desert gold, so it never reads as desert
  deltaSand: '#B3AA72', // damp sandbar crest (levee tops, exposed bars) — muted, not bright sand
  deltaMoss: '#5E8140', // olive wetland green in the marshy hollows (distinct from jungle)
  // delta wildlife (Task 48) — one accent each, wader/marsh family
  heronBody: '#C9D2D8', // pale blue-grey heron plumage
  heronWing: '#8A98A4', // slate wing/back
  heronBill: '#E6B84C', // warm dagger bill + legs
  turtleShell: '#6E7A45', // mossy olive carapace
  turtleSkin: '#9AA86A', // pale olive turtle skin
  // delta structures (Task 48) — the stilt fishing hut on the levee
  stiltWall: '#C7A878', // sun-bleached reed-and-plank hut wall
  stiltRoof: '#8A6A46', // thatched brown roof / posts
  // Task 49 — canyon geysers + hoodoos (props on the B1 canyon floor). The geyser is a pale
  // mineral SINTER cone (bone-cream crust over the rust gorge) ringed by a bubbling pool, with
  // an erupting steamy-blue clay plume. Hoodoos are stacked terracotta rock spires. All prop
  // colours (reload-safe under the worker bake); one accent family each, tuned to the canyon.
  sinter: '#D8C7A2', // pale mineral sinter crust — the geyser cone / terrace rim
  sinterDeep: '#A98F66', // wet shaded sinter (cone base, terrace steps)
  geyserPlume: '#DCE7EB', // pale steamy mineral water — the erupting clay plume's billowing crown
  // Task 94 — the geyser's WATER got a real hue family. The old pool grey-blue (#A9C6D0)
  // sat one step from the sinter tan and the whole prop read as "a bell with a button"
  // (the T94 diagnosis crop). Hot-spring water is the one thing on a rust canyon that may
  // be truly AQUA — a mineral-teal accent, cool against every warm strata tone around it —
  // and the terraced pool is what says "thermal" before the jet even erupts.
  geyserPool: '#6FB0BE', // the vent pool + splash — mineral aqua, deep enough to read wet
  geyserTerrace: '#9AD4CB', // the wide terraced hot-spring sheet ringing the cone
  geyserJet: '#F3F8F6', // the erupting water jet — near-white, the plume's bright core
  hoodooRock: '#B0673B', // terracotta hoodoo spire body (canyon rust family)
  hoodooCap: '#C79A6A', // lighter caprock crowning each hoodoo
  // Task 50 — winter feel (B2). Cold-palette discipline: blue-white / ice / cold-spruce
  // dominate the winter ground + flora, with exactly ONE warm accent — the red fox curled in
  // a drift. All reload-safe prop colours + a couple of ground accents (baked, verified fresh).
  frostShadow: '#A9C2D4', // cool blue-white drift hollow (wind-scoured snow shadow)
  spruceDeep: '#274C38', // deep cold spruce green — snow-laden conifer foliage + shadow flecks
  // winter wildlife (one accent each; only the FOX is a warm note — the cold-scene punctuation)
  foxFur: '#D9743A', // rust red fox coat (THE one warm winter accent)
  foxBelly: '#F0E6DA', // cream fox underside / tail-tip / cheek
  foxDark: '#A84E22', // shaded fox legs / ear tips / nose bridge
  owlBody: '#8A7A64', // soft grey-brown owl plumage (cold neutral)
  owlFace: '#CBBBA0', // pale owl facial disc
  hareFur: '#DDE6EC', // cold white-grey snow hare
  hareShade: '#B8C6D0', // hare shadow / burrow-mouth rim
  // Task 53 — CHECKPOINT PEEKERS: the corner characters that lean in over each chapter's
  // panel. Each family borrows its wedge's existing accents where one already fits (the
  // jungle birds reuse parrotBody/parrotWing, the camels reuse camelHide/camelSaddle) and
  // only adds what the world had no colour for yet.
  crocHide: '#5C7A4A', // delta crocodile back — swampy olive-green, darker than deltaMoss
  crocBelly: '#C8CE9A', // pale under-jaw / throat
  crocRidge: '#3F5A34', // scute ridges + brow bumps (the crocodile's deepest note)
  pangolinScale: '#A8794B', // canyon pangolin armour plate — warm earth-bronze over the rust gorge
  pangolinScaleDeep: '#70502F', // shaded plate underside / the ball's core
  pangolinScaleLight: '#D9AC72', // sun-caught plate edge — the third tone that makes the armour
  // read as overlapping scales rather than one brown mass at corner scale
  yetiFur: '#EAF2F6', // winter yeti shag — brighter and bluer than the snow hare
  yetiMuzzle: '#B7CBD8', // yeti face patch / palms — cool grey-blue against the shag
  // Task 55 — CINEMATIC BIOME GRADE: the mood each chapter casts over the whole page as the
  // traveller arrives at its checkpoint. Three colours per biome, each read by a different layer:
  //   *Sky  — the high backdrop is pulled toward this. It carries most of the mood, and it can be
  //           saturated: it repaints the air behind the little world, nothing in front of it.
  //   *Glow — the low horizon band. Authored per biome rather than derived, because a green or
  //           teal mix into the pink horizon goes grey; every biome gets its own light instead.
  //   *Cast — a PALE colour the scene's key + ambient light are tinted toward (and the faint
  //           document haze above the canvas). This is the grade proper: it reaches the planet,
  //           the girl and the mascots as LIGHT, so every clay figure keeps its own hue.
  keyWarm: '#FFF2E0', // the scene's ungraded key light — warm daylight, the base every mood mixes from
  ambientBase: '#FFFFFF', // the scene's ungraded ambient fill (three.js's own AmbientLight default),
  // named so the grade's two base colours sit together and neither is a literal in the scene files
  gradeSpringSky: '#FFD7E4', // ch0 spring — soft blossom pink over the cream (the current feel)
  gradeSpringGlow: '#FFCFE0', // blossom horizon
  gradeSpringCast: '#FFE4D2', // warm blossom-cream light, barely there
  // Task 57 — the four middle biomes were re-authored for ADJACENT-PAIR distinctness. Read as
  // hexes the old set looked varied; read as what the consumers apply — each one mixed into the
  // same cream base — jungle/delta and desert/canyon landed inside one hue family each, so half
  // the arrivals announced nothing. The journey now alternates dark/light as well as hue:
  // dark canopy, bright humid water, hot amber noon, deep ember, cool dusk.
  gradeJungleSky: '#036B1E', // ch1 jungle — LUSH canopy green: saturation, not just darkness. A
  // deeper green desaturates to olive-moss once it is mixed into the cream and reads dim rather
  // than verdant, so the chroma has to survive the mix — this lands at C* 42 where #0D4522 gave 23.
  gradeJungleGlow: '#CCDD8E', // sunlit gap in the canopy: warm yellow-green at the horizon
  gradeJungleCast: '#A6DC8C', // pale sunlit-fern light, warmer than the canopy above it
  gradeDeltaSky: '#35C8DE', // ch2 delta — humid cyan: out from under the canopy, bright hazy air
  gradeDeltaGlow: '#EFCF92', // low silt-gold mist over the water
  gradeDeltaCast: '#5EC4E2', // pale lagoon light, blue rather than green — the jungle's opposite
  gradeDesertSky: '#FFBE33', // ch3 desert — warm amber noon haze
  gradeDesertGlow: '#FFEDBE', // bleached hot horizon
  gradeDesertCast: '#FFE0A6', // bleached noon gold — the palest cast after spring's
  gradeCanyonSky: '#8A2409', // ch4 canyon — TRUE EMBER: deep rust, not the desert's amber family
  gradeCanyonGlow: '#FF9A55', // hot ember light spilling along the rim
  gradeCanyonCast: '#EF8F55', // ember light, the deepest cast the pale-light rail allows
  gradeWinterSky: '#6E7FC2', // ch5 winter — cool blue-violet dusk
  gradeWinterGlow: '#E6E1F5', // pale lilac light off the snow
  gradeWinterCast: '#B3C2EE', // pale periwinkle light
  // Task 56 — CHECKPOINT MASCOTS. At roughly twice the R14 size the four-band toon ramp leaves a
  // character's interior almost flat, so each family gets one deeper SHADE tone painted into the
  // vertex colours (belly, underside, shadowed flank) to carry volume the lighting no longer does.
  parrotShade: '#A82C22', // deep scarlet under-belly, below parrotBody
  plumeShade: '#E3D3B4', // warm cream shadow under a cockatoo's pale plumage
  crocShade: '#3E5733', // shadowed crocodile flank, below crocHide
  camelShade: '#9A6C34', // shadowed camel underside, below camelHideDeep
  yetiShade: '#C6D8E4', // shadowed yeti shag, below yetiFur
  boughSnow: '#FBFDFF', // sunlit snow load on a winter bough (brighter than snow)
  mangroveBark: '#5A4030', // wet delta mangrove root/trunk — darker than jungleBark
  mossHang: '#93A86A', // pale hanging swamp moss
  palmFrond: '#7FA24B', // dry desert palm frond green
  palmTrunk: '#A9825A', // sun-bleached palm trunk
  strataDust: '#C98A5E', // canyon strata band, between hoodooRock and hoodooCap
  palmFrondDeep: '#5E7C39', // shaded olive-khaki palm frond — the desert canopy's recession tone
  bluebirdShade: '#6F62B8', // deep periwinkle under bluebell (the palette had nothing below it)
  // Task 56 review — the winter grade (a pale lilac wash) sits at almost the same lightness as the
  // near-white yeti fur, so that corner measured a median dL* of 20.7 against 40-52 everywhere
  // else. The yeti's MASS now uses a mid blue-grey coat and keeps the near-whites for lit tops and
  // the muzzle, which is what buys a silhouette back under the grade.
  yetiCoat: '#93A9C0', // mid blue-grey yeti body — the value that separates it from a lilac sky
  yetiCoatDeep: '#6F869F', // shadowed coat, under yetiCoat
  strataShade: '#7C4A2E', // deep shadowed canyon rock, darker than rust — a backdrop for a pangolin
  // Task 58 — the four polish items.
  //
  // TACK is its own family rather than a reuse of camelSaddle. The halter was drawn in the
  // terracotta saddle tone with a brass ring at the muzzle end, and at reading size a warm red bar
  // with a bright yellow tip sitting at the corner of a mouth reads as a lit cigarette. Leather is
  // COOL and low-chroma next to camelHide's warm tan, which is what makes a strap read as worked
  // stock lying on an animal rather than as a marking painted into it.
  tackLeather: '#736C60', // cool greyed harness leather — the halter and the calf's collar
  tackLeatherDeep: '#464036', // the strap's own shadow line, and the keeper at the junction
  // The winter drift's hollows were frostShadow, which sits about nine points of lightness off
  // yetiCoat in nearly the same hue — so the snow the yetis stand in read as a grey BOULDER of the
  // same value as the animal on it. The drift now runs bright, with this one deep tone kept for the
  // wind hollows and the contact pocket directly under each figure.
  driftShade: '#5E7488', // deep blue snow shadow, clearly below the yeti's coat
  // Task 61 — the recast cast (snake, fennec, eagle, polar bear, penguin).
  //
  // EVERY VALUE BELOW IS DERIVED, NOT PICKED. The four checkpoint backdrops were measured with the
  // rig unmounted under the real grade (bench/task61-backdrop.mjs) and each corner turns out to be
  // an almost flat wash — delta L* 82.5, desert 89.1, canyon 74.5, winter 85.6, all with under four
  // points of spread. A mascot pixel's contrast against it is therefore just
  // `backdrop − rendered`, and the toon ramp's darkest band (96/255) is what most of a corner
  // figure sits in, so `rendered ≈ L*(0.40 · Y_albedo)`. That model predicts the three shipped
  // corners to within about three points of what they measure (crocHide → 51.4 against a measured
  // 51.1; yetiCoat → 39.5 against 41.3), which makes it good enough to author against.
  //
  // Inverting it for the 40–52 band gives the albedo window each corner's DOMINANT mass has to
  // live in: delta 47–64, desert 55–73, canyon 39–53, winter 51–68. Pale accents are then a budget
  // spent by AREA rather than by taste, exactly as the yeti's near-whites were.
  boaCoil: '#B3833F', // delta snake — warm amber, deliberately OUT of the crocodile's olive family
  boaSaddle: '#6B4526', // its dark dorsal saddles, and the one thing that says "snake" in silhouette
  boaBelly: '#D8BE84', // pale banded underside, seen only where the coil turns over
  fennecCoat: '#C89055', // desert fennec — a redder, five points darker sand than camelHide
  fennecDeep: '#8F5C36', // its shadow side and the backs of the ears
  fennecCream: '#EBD6B2', // cheek ruff, chest and brow — the fox's pale notes, budgeted small
  fennecEar: '#DDA087', // warm inner ear; the ears ARE the silhouette, so they get their own tone
  eagleWing: '#66523F', // canyon eagle — a COLD umber, so it never joins the rust rock it perches on
  eagleDeep: '#3E3227', // primaries, tail bars and the wing's shadowed underside
  eagleNape: '#AD8A4A', // tawny-gold hackles on head and nape — the raptor cue, kept off the sky edge
  // THE POLAR BEAR IS WHITE. That is a ruling, and it overturns two earlier passes of mine.
  //
  // The 40-52 median dL* band this cast is otherwise held to CANNOT be met by a white animal here:
  // against a winter sky measured at L* 85.6 the band forces a figure median of L* 33.6-45.6, which
  // is a brown animal by arithmetic. I painted it to the metric twice — once cool, once warm — and
  // got grey-lilac stone and then a grizzly. The metric was simply the wrong statistic for a
  // white-on-light figure, and Aram asked for a white bear.
  //
  // So the mass is genuinely white and the SEPARATION is carried where white-on-snow carries it in
  // life, none of which a median can see: the ink contour the figure already has, a deep contact
  // shadow cast into the drift beneath it, and dark spruce massed behind the silhouette. The body's
  // own shade steps stay subtle — plush, not grey — because a white animal modelled in greys reads
  // as a dirty one. See the per-figure carve-out and its two edge-aware assertions in
  // peeker-cast.test.ts, which replace the median gate for this figure ALONE.
  bearCoat: '#F2EDE2', // warm near-white bear mass — white, and allowed to be
  bearDeep: '#DCD2C2', // its shade step: one stop, warm, deliberately shallow
  bearCast: '#4E6076', // the shadow it throws into the drift — this is what does the separating
  penguinBack: '#39434F', // penguin head/back — blue-charcoal rather than ink, so it is not a hole
  penguinFlash: '#EE8F33', // bill, feet and ear patch — the corner's one warm note, as the fox is

  // Task 60 — THE WINTER ENDING SET. The epilogue snow field is a very bright, very cold field,
  // so everything standing in it is chosen for CONTRAST against snow (L* ~95) rather than for
  // being wintry in itself: the mammoth is the darkest mass on the planet's ending face, and the
  // igloo earns its read from a shadowed doorway rather than from being whiter than the ground.
  mammothFur: '#6E4A34', // deep warm brown shag — the one dark mass in the ending vista
  mammothShag: '#523524', // its underside and the overlapping tufts that break the silhouette
  mammothTusk: '#EFE4CB', // ivory tusks; warmer than snow so the curve reads against the drift
  iglooShell: '#AFC3D2', // the igloo's DOME. Deliberately not snow: a white hut on a white field
  // has nothing to be lighter than, and the blocks laid over it are what read. Same lesson the
  // polar bear above is built on, applied to architecture instead of fur.
  iglooDoor: '#6B4A2E', // shadowed doorway and smoke hole — warm ochre PAINT, not a light

  // Task 62 — the two corners whose SEATS were rebuilt, and the rule both were fitted to.
  //
  // A checkpoint corner is a figure read against its own dressing, and T61's own canyon finding was
  // that an animal drawn in its setting's colour family camouflages into it. The two seats below are
  // therefore chosen against their occupants rather than against their biomes: the eagle is the
  // cast's DARKEST figure and was sitting on the darkest rock in the lab, so its nest is bleached
  // mid-tone dead wood; the penguin's charcoal back wants water DEEPER than itself under it, so the
  // floe's sea is the coldest, darkest note in the winter corner.
  nestStick: '#9C8A6E', // eagle eyrie — sun-bleached grey-tan dead branch, deliberately OUT of the
  // canyon's rust family so a stack of sticks never reads as one more course of strata
  nestStickDeep: '#6B5B45', // the shadowed sticks inside the bowl, and the twig ends in its lee
  polarSea: '#2F6C8C', // penguin floe — cold open polar water, well below iceDeep so a pale raft
  // has something to sit ON rather than a band of the same value to dissolve into
  polarSeaDeep: '#1E4E68', // the trough shadow under the floe's waterline and between the swells

  // Task 65 — THE DESK. Four colours, and all four are chosen against what they are seen NEXT TO
  // rather than against what a desk is: at full pull-back the slab fills the bottom two fifths of
  // the frame, and everything above it is the sky's own low glow, which the winter mood holds at a
  // pale lilac-pink. A warm mid tan is the one family that reads as a made object against that (a
  // grey slab joins the sky, a saturated terracotta fights the world's snow) — and the slab is lit
  // almost flat, its horizontal face taking dot(N,L) = 0.28 from the one key, so its albedo is very
  // nearly what ships to the eye. Hence a value chosen dark enough to survive being multiplied up.
  //
  // The VALUES are measured, not picked. A first pass authored the slab at #C39468 — a reasonable
  // hex for birch — and it rendered rgb(155,118,67): a mustard brown filling two fifths of the
  // money shot. The scene's one key rakes from the upper left, so a horizontal face takes
  // dot(N,L) = 0.28 and lands two bands down the four-step clay ramp, which costs about a fifth of
  // the albedo before the sRGB round trip. The slab and the note therefore carry AUTHORED normals
  // tilted into the key (see `tiltTowardKey`), which puts them on the ramp's top band, and their
  // albedos are then chosen against a ~0.94 render ratio instead of a ~0.79 one.
  deskTop: '#E0C3A0', // the slab — warm pale oak; renders near rgb(211,183,150)
  deskGrain: '#C09A70', // pressed grain, the hand-formed back edge, and the slab's own recession
  notePaper: '#F6EEDB', // the note sheet. Warmer than `snow` so paper never reads as one more drift
  deskShade: '#8A6242', // contact pockets under the props, and the dish's own shadowed interior
  notePaperLit: '#FFFFFF', // the lit corner of the note's paper wash, and
  notePaperTint: '#BE9669', // its warm shaded corner — the sheet's own lighting cue, painted into
  // the texture rather than asked of the scene, which has exactly one key light and no second
  deskMat: '#AFC0CB', // the blotter under the note and the stand. The frame's one COOL surface: the
  // desk is warm oak and the sky is a lilac-pink wash, and without a third note between them the
  // bottom of the composition is one unbroken field of tan

  // Task 68 — ALWINA'S DESK, candidate B. The room the little world was made in is BAKED (see
  // scene/props/desk-glb-contract.ts), so almost none of its palette needs naming here; what does
  // is the one surface the lab still builds itself and the DOM that sits over it.
  // THE STAND'S METAL, and it is a RENDER-tuned value rather than the albedo hex.
  //
  // T67's material is `#E3A995` at metallic 0.88, and that hex is what a rose-gold albedo looks
  // like in a swatch. It is not what the approved render's ring shows: measured, the ring renders
  // (210, 182, 173) — a soft warm grey-pink, because a metal at this metalness has no diffuse term
  // and simply multiplies the room, and the room is a pale pink cyc. Using the albedo directly made
  // the ring 2.42x the reference's chroma and railed its red channel across a third of its area.
  //
  // So the tint is solved backwards from the render: reference RGB divided by the environment the
  // ring actually samples. `ending-connect`-style: the value is a measurement, and the compare bench
  // re-checks the chroma of every metal region on every capture.
  //
  // RE-SOLVED IN TASK 71, AND THE REFERENCE DID NOT MOVE — the instrument did. The ring is the one
  // metal T69 did not rebuild, and it measures (198,165,155) in the old approved render and in the
  // new one alike. What changed is the sample: T68 read the ring through the largest rectangle that
  // fits inside it, which on a torus is a 98x11 strip of its BRIGHT TOP ARC, and matched the mean
  // there. Read over every pixel of the ring instead — the mask the whole bench now uses — that tint
  // rendered +23% hot with 5.7% of the ring railed at R >= 254 against a reference that rails 1.7%.
  // Both numbers were true of their own sample; only one of them is a statement about the ring.
  standRoseGold: '#BDA799', // the globe stand's turned metal

  // The DOM that sits ON the studio: the connect pills and the restart.
  //
  // Task 65 gave the three pills three tints from the clay palette (honey, blossom, river) — three
  // genuinely different hues, which is what let colour carry which link was which. Candidate B has
  // no such spread: its whole family is rose. Measured, ink on the three roses that would fit here
  // reads 4.72, 3.98 and 3.59 against a 4.5 floor for 15px bold — so ONE of the three could carry
  // the type and two could not, and a row where colour means something cannot be built out of one
  // usable colour.
  //
  // So the pill is a near-white card with ink type (13.59:1) and ONE border colour, and the label
  // is what says which link it is — which it always was. `ending-connect.test.tsx` measures every
  // one of these ratios against the pad the block actually sits on rather than against a hex
  // someone hoped was the background.
  studioPaper: '#FDFBF8', // the pill's own card — candidate B's PAPER
  studioRoseDeep: '#C95C87', // its border, its focus ring, and the restart's rule — B's BOX_PRINT

  // Task 74 — THE SHEET THE COMIC IS PRINTED ON, and it is a MEASUREMENT.
  //
  // The chapter spread is a manga page beside a data card, and the data card was
  // built on `sky` (#FFF3D6) — a warm cream that was the right paper when the art
  // slot held a pastel placeholder. Against the finished black-and-white pages it
  // is simply a different sheet: read off all seven shipped webps
  // (`bench/task74-paper.mjs`), the printed paper's near-white mode measures
  // 247–252 and is ACHROMATIC to within a point, mean rgb(250,250,250). The cream
  // sits 36 points of blue below that, which is why the two cards never looked
  // like they came out of the same printer however the borders matched.
  //
  // So the card, the pills and the mobile tab are all printed on this instead, and
  // the cream keeps exactly one job on the spread: the narrator CAPTION BOX, which
  // is a label stuck to the page rather than the page (`manga-lettering.tsx` draws
  // the comic's own captions in `sky` for the same reason, and the card's eyebrow
  // is now that same object).
  pagePaper: '#FAFAFA', // the printed sheet — the mean paper of the seven shipped pages

  // Task 99 — THE "LET'S CREATE" NEON, and why it is ROSE and not a new hue.
  //
  // The look-dev ran four colourways over the real money shot (blossom pink, honey gold, dusk
  // blue, and an arc variant): blue fights the warmth of the lights-up beat, gold introduces a
  // large field of a hue the room only carries in centimetre accents, and rose is the room's own
  // accent voice — studioRoseDeep already borders the connect pill and underlines the CV links,
  // so the sign and the row beneath it read as one hand. Two tones, the classic tube pair:
  //
  // TASK 103 — PASTELISED, and the number that decided it is a LUMINANCE, not a taste.
  //
  // Aram: "the whole sign should be MORE PASTEL, in the lab's colours". Measured off the shipped
  // money shot, the cyc behind the sign reads rgb(197,188,190) — luminance 190. T99's gas
  // `#F272A8` is (242,114,168): chroma 128, luminance 145. So the one thing in the frame that is
  // supposed to be EMITTING sat 45 points BELOW the wall it hangs on, and carried more chroma
  // than anything else in a room whose every prop is chalk pink, mint and cream. It read as a
  // sticker, not a tube.
  //
  // The new gas is `blossom` — the SAME HEX as the flower pink the clay planet is covered in,
  // and that identity is the point: "in the lab's colours" is answerable with a token rather
  // than with a new hue. Against T99's gas it is chroma 79 against 128 (−38%) and luminance 187
  // against 145 (+42), which is exactly what pastel means. It also sits level with the cyc, so
  // the tube's own fill contributes almost no value — what makes the sign read is the additive
  // halo on top of it, which is where the emission belongs.
  //
  // FIRST TRY WENT TOO FAR, and the capture said so: at `#FFB3CE` with T99's halo alphas the
  // sign railed to WHITE (sign-region mean chroma 8, against 30 on the shipped build). T99's
  // alphas were tuned against a halo that was MISREGISTERED — the hot core landed beside its
  // tube, so half of every stroke kept its colour. Registered, that core stacks on the fill and
  // both clip. The halo's passes are re-weighted in `props/neon-sign.tsx` to match; the gas is
  // one step deeper here so there is chroma left to survive the addition.
  //
  // The core stays near-white and gets a shade whiter: with the gas this soft, the core is what
  // still says LIT GLASS rather than painted line.
  neonTube: '#FFF3F8', // the glass core — near-white with the gas's blush, the filament pass
  neonRose: '#F7A8C4', // the gas colour — `blossom`, the clay world's own flower pink
} as const
