import * as THREE from 'three'
import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { alignY, cone, cyl, eye, facing, leafFan, limb, rockBed, sph, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the CANYON checkpoint: a banded red-rock shelf under a hoodoo spire, with two
 * PANGOLINS that roll in as armoured balls and unfurl on the ledge.
 *
 * Same corner grammar as `peeker-jungle.tsx` (the biome the look-dev gate ran against): one big
 * mass sweeping in from the frame's outer edge, a second vertical element climbing that edge, and
 * the characters sitting ON something rather than floating beside it. What changes is the
 * vocabulary — where the jungle reads by leaf density, the canyon reads by STRATA.
 *
 * VISIBLE BAND, the constraint every measurement below is fitted to: the frame's outer edge sits
 * at local x = −PEEKER_INSET_X (−0.64) and its bottom edge at local y ≈ −0.92. Dressing authored
 * past those is thrown away, which is exactly how the jungle's first pass lost its canopy. So the
 * strata run INWARD across the whole frame and only the lowest course crops off the bottom, and
 * the spire leans out over the corner rather than standing beyond it.
 *
 * VALUE: the corner is built as a LIGHT figure on a DARK field — the rock directly behind and
 * under the animal is sunk to `strataShade`/`earthDeep`, the armour lives in the
 * `pangolinScale`…`dune` end of its family, and the light tones that remain (the shelf's two ends,
 * the spire's sunlit crown, the sand drifts) are kept clear of the figure's outline.
 *
 * WEIGHT, and this is what the light-figure pass cost: rasterised over the corner crop, the rock
 * took 62% of it to the animal's 16%, where the jungle runs 32/25 and spring 25/23. A setting that
 * outweighs its subject four to one is a landscape with a pangolin in it, not a mascot corner. The
 * rock is now a WEDGE — full width only at the shelf the animal stands on, each course below it
 * ending further out than the one above (x ≈ +0.53, +0.11, +0.05, −0.09, −0.26), with a talus of
 * fallen stones marking the slope — the gorge wall is a low mound behind the BODY rather than a
 * field behind the whole figure, and the hoodoo is a spire the animal's head clears rather than a
 * column up the outer edge. That lands the corner at 33% rock to 18% animal with half the crop
 * left as sky, and it puts the head, which is the read, against nothing at all.
 */

// --- dressing ---------------------------------------------------------------

/** Top surface of the shelf — the line every prop and both animals are seated on. */
const LEDGE_TOP = -0.235

/**
 * The shelf the pangolins stand on: `[x, y, halfHeight, halfLength, dip, colour]`.
 *
 * Its TOP is level, because a bench in a gorge is a resistant caprock surface and because every
 * prop in this corner is seated on it. All the irregularity is spent on the UNDERSIDE — the
 * thickness swings from 0.041 to 0.080 across the run, so the line the eye actually reads (the
 * shelf's shadowed lower edge) wanders instead of ruling straight across the frame.
 *
 * This is the ONE course that still runs the full width: it is the ground, and cropping it would
 * leave the animal standing on a floating slab. Everything below it retreats.
 */
const SHELF: readonly (readonly [number, number, number, number, number, string])[] = [
  [-0.535, -0.271, 0.038, 0.128, 0.05, PALETTE.hoodooCap],
  [-0.3, -0.288, 0.055, 0.185, -0.02, PALETTE.strataShade],
  [-0.02, -0.297, 0.064, 0.205, 0.03, PALETTE.strataShade],
  [0.28, -0.28, 0.047, 0.19, -0.04, PALETTE.rust],
  [0.575, -0.267, 0.034, 0.155, 0.06, PALETTE.strataDust],
]

/**
 * The beds under the shelf, top down — and the shape of the whole corner's mass.
 *
 * Each course ENDS FURTHER OUT than the one above it (x ≈ +0.53, +0.11, +0.05, −0.09, −0.26), so
 * the stack is a wedge falling away toward the frame's outer-bottom corner instead of a wall
 * filling it. That is the same read the jungle branch and the spring bough have — dressing
 * sweeping in from one corner — and it hands the inner-bottom third of the frame back to sky,
 * which is where the animal's own silhouette has to be found.
 *
 * Within that, no two courses share a thickness, a dip or a run, and each ends at a different x so
 * their tips never line up into a seam. The pale `sinter` bed near the bottom is the mineral band
 * that stops the terracotta layers reading as one brown mass; it sits low and well clear of the
 * figure, where a light note balances the composition instead of eating it.
 */
const BEDS: readonly (readonly [number, number, number, number, number, string])[] = [
  [-0.505, -0.377, 0.072, 0.16, 0.06, PALETTE.hoodooRock],
  [-0.195, -0.393, 0.078, 0.185, -0.03, PALETTE.strataDust],
  [0.125, -0.378, 0.055, 0.16, 0.05, PALETTE.strataShade],
  [0.4, -0.362, 0.038, 0.125, -0.03, PALETTE.hoodooRock],

  [-0.45, -0.518, 0.07, 0.205, -0.05, PALETTE.rust],
  [-0.085, -0.542, 0.082, 0.19, 0.04, PALETTE.strataShade],

  [-0.55, -0.638, 0.04, 0.11, 0.09, PALETTE.hoodooCap],
  [-0.315, -0.66, 0.072, 0.19, -0.02, PALETTE.hoodooRock],
  [-0.06, -0.678, 0.05, 0.11, 0.03, PALETTE.strataShade],

  [-0.475, -0.782, 0.072, 0.185, 0.04, PALETTE.strataShade],
  [-0.2, -0.8, 0.046, 0.115, -0.05, PALETTE.sinter],

  [-0.45, -0.915, 0.078, 0.19, -0.03, PALETTE.hoodooRock],
]

/**
 * The spire's segments, base upward: `[radius at top, radius at bottom, height, colour]`. Pinched
 * waists alternating with bulges is what makes a hoodoo a hoodoo rather than a pillar.
 *
 * FOUR segments, not eight. At eight the spire ran the full height of the outer edge and the
 * animal's head sat halfway up a column of rock; at four its caprock tops out around y ≈ 0.49,
 * comfortably under the pangolin's crown, so the reading order is animal first and setting second.
 * The tones still climb out of shadow, which is what a spire in a gorge at low sun does and what
 * keeps the part of the rock nearest the figure's outline darker than the figure.
 */
const SPIRE: readonly (readonly [number, number, number, string])[] = [
  [0.086, 0.112, 0.13, PALETTE.strataShade],
  [0.065, 0.086, 0.13, PALETTE.rust],
  [0.084, 0.065, 0.13, PALETTE.strataDust],
  [0.058, 0.084, 0.13, PALETTE.hoodooRock],
]

/** Two dusty greens — a canyon scrub is never the jungle's saturated leaf. */
const SCRUB = [PALETTE.reedGreen, PALETTE.palmFrond, PALETTE.reedGreen]

/**
 * THE PANGOLIN'S HALF of the corner — the banded shelf under the hoodoo. Unchanged in Task 62
 * apart from its name: it is the composition the light-figure pass was tuned against (33% rock to
 * 18% animal, measured), and the animal it was tuned FOR still stands on it.
 */
function pangolinLedge(): ClayPart[] {
  const parts: ClayPart[] = []

  // The shadowed recess the figure is read against: a MOUND behind the animal's body, cresting
  // just under the shell's own skyline, not a field behind the whole figure. Three overlapping
  // masses rather than one, because a single ellipsoid behind a character reads as a disc.
  //
  // Everything above y ≈ 0.2 is deliberately left to sky. The armour needed a dark ground to
  // separate from and still has one; the HEAD does not — it is the lightest, most detailed thing
  // in the corner and it reads best with nothing behind it at all.
  parts.push(
    sph(0.31, PALETTE.strataShade, [-0.19, -0.14, -0.34], [1.24, 0.9, 0.11], 9),
    sph(0.185, PALETTE.rust, [0.15, -0.175, -0.35], [1.05, 0.78, 0.1], 8),
    // the mound's rim catching the low sun — the one light line allowed behind the figure, and
    // what keeps the mass from flattening into a backdrop card
    sph(0.26, PALETTE.hoodooRock, [-0.19, 0.14, -0.34], [1.15, 0.2, 0.1], 8),
    // the deepest pocket, directly behind the animal's body
    sph(0.24, PALETTE.earthDeep, [-0.06, -0.1, -0.3], [1.1, 0.78, 0.05], 9)
  )

  // A recessed backing slab behind the courses, laid ALONG the wedge rather than square across the
  // frame. Beds that thin and pinch leave gaps where their tips fall short of each other, and this
  // is what those gaps open onto: shadowed rock, the way a weathered face undercuts between
  // resistant ledges. Its ends stop where the courses do, so it never fills the sky the wedge
  // just opened.
  parts.push(
    cyl(
      0.22,
      0.22,
      0.72,
      PALETTE.strataShade,
      [-0.26, -0.61, -0.1],
      [0, 0, Math.PI / 2 + 0.2],
      [1, 1, 0.18],
      10
    )
  )

  // The shelf is given real depth in Z so it reads as a SURFACE the animals stand on rather than
  // as a line they stand behind; the beds below are shallow, since only their faces are ever seen.
  for (const spec of SHELF) parts.push(rockBed(spec, 0.115))
  for (const spec of BEDS) parts.push(rockBed(spec, 0.055))

  // The animal's own contact shadow, pooled into the shelf top. Without it a pale figure on dark
  // rock reads as pasted on rather than sitting in the corner.
  parts.push(sph(0.3, PALETTE.earthDeep, [-0.03, -0.256, 0], [1.2, 0.13, 0.33], 9))

  // Weathering cut into the face — a rubble chute and two undercut pockets, scattered rather than
  // spaced and none of them crossing the whole stack: the first pass's evenly spaced full-height
  // verticals were half of a crate read.
  parts.push(
    cyl(0.014, 0.03, 0.28, PALETTE.earthDeep, [-0.3, -0.57, 0.062], [0, 0, 0.24]),
    sph(0.05, PALETTE.earthDeep, [-0.5, -0.72, 0.062], [1.4, 0.5, 0.5], 7),
    sph(0.045, PALETTE.earthDeep, [0.05, -0.47, 0.062], [1.3, 0.5, 0.5], 7)
  )

  // The hoodoo, climbing the frame's outer edge and leaning a little further out as it rises so
  // the corner is framed rather than merely occupied. It sits well behind the animals in Z.
  for (let i = 0; i < SPIRE.length; i++) {
    const [rt, rb, h, color] = SPIRE[i]
    parts.push(
      cyl(rt, rb, h, color, [-0.46 - 0.0105 * i, LEDGE_TOP + 0.065 + 0.13 * i, -0.2 - 0.001 * i])
    )
  }
  parts.push(
    // the slender neck and the hard caprock it protects — the whole reason a hoodoo has a shape
    cyl(0.045, 0.054, 0.075, PALETTE.strataDust, [-0.508, 0.325, -0.21]),
    cyl(0.086, 0.098, 0.1, PALETTE.hoodooCap, [-0.515, 0.41, -0.21]),
    sph(0.078, PALETTE.hoodooCap, [-0.515, 0.458, -0.21], [1.35, 0.35, 1.0], 8)
  )

  // A low pinnacle at the inner end. It answers the spire across the composition, and being a
  // stub where the other is slender keeps them from reading as a repeated prop — but it stays
  // BELOW the shelf line, because the inner side of the corner is the animal's to own.
  parts.push(
    cyl(0.072, 0.088, 0.1, PALETTE.strataShade, [0.63, -0.185, -0.16]),
    cyl(0.05, 0.072, 0.085, PALETTE.hoodooCap, [0.638, -0.09, -0.16])
  )

  // Dry scrub: bare woody stems carrying a thin fan of stiff leaves, not the jungle's dense
  // canopy. The gap between stem and foliage is the whole read — a desert bush is mostly twig.
  parts.push(
    ...limb([[0.5, -0.26, -0.1], [0.47, -0.15, -0.1], [0.49, -0.05, -0.09]], 0.026, 0.013, PALETTE.clayPath),
    ...limb([[0.5, -0.22, -0.1], [0.57, -0.12, -0.09], [0.6, -0.02, -0.08]], 0.02, 0.011, PALETTE.clayPath),
    ...leafFan([0.47, 0.02, -0.1], 6, 0.24, [0.3, 1.9], SCRUB, undefined, 0.28),
    ...leafFan([0.54, -0.06, -0.09], 4, 0.18, [0.05, 1.1], SCRUB, undefined, 0.26),
    // a second bush at the foot of the spire, crossing the outer edge on purpose
    ...limb([[-0.4, -0.24, 0.06], [-0.44, -0.15, 0.06], [-0.47, -0.07, 0.07]], 0.022, 0.012, PALETTE.clayPath),
    ...leafFan([-0.46, -0.04, 0.06], 5, 0.2, [1.5, 3.3], SCRUB, undefined, 0.28)
  )

  // Dry grass, set in FRONT of the animals' feet (z well past the shell's own depth) so the
  // pangolins are bedded into the ledge instead of parked on top of it.
  parts.push(
    ...tufts([-0.34, -0.25, 0.24], 0.14, 5, PALETTE.reedGreen, 0.18, 0.88, 0.95),
    ...tufts([0.26, -0.24, 0.26], 0.12, 4, PALETTE.palmFrond, 0.16, 0.84, 1.0)
  )

  // Loose stones, low-segment so they facet.
  parts.push(
    sph(0.08, PALETTE.stone, [0.34, -0.185, 0.2], [1.2, 0.82, 1], 7),
    sph(0.05, PALETTE.sinterDeep, [0.45, -0.205, 0.24], [1.1, 0.85, 1], 6),
    sph(0.09, PALETTE.hoodooRock, [-0.42, -0.18, 0.16], [1.15, 0.85, 1], 7),
    sph(0.052, PALETTE.stone, [-0.55, -0.205, 0.14], [1, 0.9, 1], 6),
    // Wind-blown sand caught along the shelf — the warm note that keeps the corner from going
    // entirely to rock. Both drifts are pushed out to FLANK the animal rather than pool under it:
    // pale sand is the one dressing tone close enough to the lightened armour to blur its edge.
    sph(0.16, PALETTE.goldSand, [-0.44, -0.205, 0.14], [1.4, 0.3, 0.55], 9),
    sph(0.15, PALETTE.dune, [0.5, -0.21, 0.15], [1.5, 0.28, 0.55], 8)
  )

  // Talus: four stones trailing down the wedge's cut edge, sizes falling away with the slope. They
  // are what tells the eye the rock RETREATS below the shelf rather than simply ending — a bare
  // diagonal reads as a slice, a scatter of fallen rock along it reads as a slope.
  parts.push(
    sph(0.062, PALETTE.hoodooRock, [0.24, -0.53, 0.09], [1.15, 0.85, 1], 7),
    sph(0.048, PALETTE.strataDust, [0.12, -0.63, 0.08], [1.1, 0.9, 1], 7),
    sph(0.055, PALETTE.stone, [-0.02, -0.74, 0.08], [1.2, 0.8, 1], 7),
    sph(0.04, PALETTE.sinterDeep, [-0.16, -0.86, 0.07], undefined, 6)
  )

  return parts
}

// --- the eagle's eyrie ------------------------------------------------------

/**
 * THE EAGLE'S HALF (Task 62). Aram: the eagle should have a NEST, not the same cliff as the
 * pangolin.
 *
 * The corner used to be one composition mirrored, so the raptor perched on the pangolin's shelf
 * with the pangolin's hoodoo behind it — the setting repeated even after T61 stopped the cast from
 * repeating. What replaces it is a STACK NEST on a crag, and three of its decisions are corrections
 * rather than choices:
 *
 *  1. THE VALUE SCHEME IS INVERTED. The ledge is built as "a LIGHT figure on a DARK field", which
 *     is right for a pale armoured animal and exactly wrong for the darkest figure in the cast. The
 *     eagle was a cold umber bird on `strataShade`/`earthDeep` rock — dark on dark, which is a
 *     large part of why the review kept reading it as a hunched lump. So the shadow mound behind
 *     the body is gone, the rock under it runs in the LIGHTER half of the canyon family, and the
 *     nest itself is bleached wood: the bird is now the darkest thing in its own corner and its
 *     outline is drawn by the contrast rather than by the ink alone.
 *  2. THE VERTICAL IS THE CRAG, NOT A HOODOO. A spire behind the shoulder AND a tower under the
 *     nest would be two verticals fighting; and a hoodoo here would be the pangolin's own prop,
 *     reflected, which is the read this split exists to remove. The crag rises off the bottom crop
 *     to the nest, so the eyrie is HIGH — which is the one thing everybody knows about an eagle's.
 *  3. THE STICKS POKE OUT. A nest drawn as a bowl is a bowl; what makes it a nest is that its
 *     construction is visible at the edges, so the rim twigs project past the silhouette on every
 *     side and a few of them stick out well beyond it. This renderer cannot draw texture INSIDE a
 *     silhouette (the standing lesson in `shag`), so the nest has to be built out of its material.
 *
 * The eggs are the corner's one soft note, and they sit outboard of the bird where its own body
 * never covers them.
 */

/** Top of the nest's rim — the line the eagle's talons grip, and the level everything is placed at. */
const NEST_RIM = LEDGE_TOP

/**
 * A ring of laid twigs around an ellipse: each one a short cylinder rolled to the local TANGENT, so
 * the sticks lie the way a bird weaves them rather than radiating like a sunburst.
 *
 * Lengths and radii step through a fixed trig sequence rather than a random one — deterministic,
 * and it also stops the ring reading as a machined collar, which a run of identical sticks does.
 */
function twigRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  z: number,
  n: number,
  from: number,
  to: number,
  len: number,
  tones: readonly string[]
): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const a = from + (to - from) * f
    const l = len * (0.78 + 0.34 * Math.sin(i * 2.2 + 0.7))
    const thick = 0.019 + 0.009 * Math.sin(i * 1.6)
    // the tangent of the ellipse at angle a, which is what a laid stick lies along
    const tangent = Math.atan2(ry * Math.cos(a), -rx * Math.sin(a))
    out.push(
      cyl(
        thick,
        thick * (0.8 + 0.3 * Math.sin(i * 3.1)),
        l,
        tones[i % tones.length],
        [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z + 0.02 * Math.sin(i * 1.9)],
        [0, 0, tangent + Math.PI / 2 + 0.12 * Math.sin(i * 2.7)],
        undefined,
        6
      )
    )
  }
  return out
}

function eagleEyrie(): ClayPart[] {
  const parts: ClayPart[] = []

  // THE CRAG, bottom-up. It narrows as it rises and each mass steps a little inboard of the one
  // below, so the tower leans into the frame instead of standing as a straight post at the edge.
  // Tones climb OUT of shadow with height, which is what a stack in a gorge at low sun does and
  // what leaves the pale rock right under the nest, where it does the most work.
  //
  // Every mass below is fitted to the dressing envelope rather than drawn and then trimmed:
  // `DRESS_REACH.out` is 0.7 outward and the composition may reach 1.20 below the mascot's origin,
  // and a first pass at this crag measured 0.94 and 1.44.
  //
  // The crag is also SHORTER than the first sketch, and that was a capture's verdict rather than
  // the envelope's: at full height it disappeared entirely behind the nest, so the eyrie sat on
  // nothing. It now tops out well below the nest's underside, which is what lets the nest OVERHANG
  // it — the read that says a bird built this on a crag rather than that a crag grew a bowl.
  parts.push(
    sph(0.34, PALETTE.strataShade, [-0.18, -1.02, -0.1], [1.1, 0.44, 0.42], 11),
    sph(0.32, PALETTE.hoodooRock, [-0.18, -0.93, -0.09], [1.1, 0.4, 0.42], 10),
    sph(0.28, PALETTE.rust, [-0.16, -0.8, -0.08], [1.15, 0.42, 0.42], 10),
    sph(0.24, PALETTE.strataDust, [-0.14, -0.66, -0.07], [1.1, 0.4, 0.42], 10),
    // the crag's shadowed inner face, so the tower turns instead of reading as a flat card
    sph(0.18, PALETTE.earthDeep, [0.04, -0.86, -0.14], [0.6, 1.3, 0.3], 9),
    // and its sunlit outer edge, the one light line, kept OUTBOARD of the bird's own outline
    sph(0.12, PALETTE.hoodooCap, [-0.42, -0.82, -0.05], [0.45, 1.9, 0.35], 9)
  )

  // Two bedding courses cut across the crag — the canyon's own vocabulary, kept to the pale end and
  // low enough that they never run behind the bird.
  parts.push(
    rockBed([-0.22, -0.98, 0.045, 0.22, 0.05, PALETTE.strataDust], 0.07, 0.02),
    rockBed([-0.2, -0.72, 0.036, 0.18, -0.04, PALETTE.hoodooCap], 0.06, 0.03)
  )

  // THE NEST IS BUILT OUT OF STICKS, and it took two failed captures to accept how literally that
  // has to be meant. Both earlier passes gave it a MASS — first a wide flattened bowl, then a
  // lumpier mound — with twigs laid round the top. Both came back as a brown TABLE with a bird
  // standing on it, and for the same reason each time: a smooth ellipsoid under a four-band ramp
  // is one flat field of colour, this camera is straight-on, and a flat field with a curved edge is
  // a tabletop no matter what is scattered on it.
  //
  // So there is almost no mass here now. What there is is a small dark CORE, mostly covered, and
  // three rings of twigs at three depths that ARE the nest: the front ring crosses in front of the
  // core, the back ring stands behind it, and between them there is the dip. The silhouette is
  // consequently made of stick ends, which is the read — a nest is recognised by its edges.
  parts.push(
    sph(0.3, PALETTE.nestStickDeep, [-0.05, -0.42, 0.0], [1.15, 0.5, 0.55], 10),
    sph(0.24, PALETTE.earthDeep, [-0.05, -0.5, -0.02], [1.2, 0.4, 0.5], 9)
  )

  // The BACK ring, standing behind the core: these are the twigs seen over the far rim.
  parts.push(
    ...twigRing(-0.05, -0.42, 0.4, 0.13, -0.16, 10, Math.PI - 0.35, 2 * Math.PI + 0.35, 0.22, [
      PALETTE.nestStickDeep,
      PALETTE.nestStick,
    ])
  )

  // THE DIP: a shallow dark crescent along the top, set back in z. It is the whole of the bowl, and
  // being a LINE rather than a field is what keeps it from becoming a tabletop again.
  parts.push(
    sph(0.28, PALETTE.earthDeep, [-0.1, NEST_RIM - 0.015, -0.05], [1.2, 0.12, 0.45], 10),
    // the soft lining banked where the eggs sit, just catching the light over the dark
    sph(0.15, PALETTE.sinter, [-0.3, NEST_RIM - 0.05, -0.01], [1.2, 0.2, 0.55], 9)
  )

  // TWO EGGS, outboard of the bird so its own body never covers them, and sitting high enough in the
  // dip to break the rim line — an egg wholly inside a nest is an egg nobody sees. Dull ivory with a
  // rust speckle each: an eagle's egg is not white, and the speckle stops them reading as pebbles.
  for (const [x, y, z, r] of [
    [-0.3, -0.255, 0.0, 0.058],
    [-0.41, -0.268, -0.04, 0.05],
  ] as const) {
    parts.push(
      sph(r, PALETTE.mammothTusk, [x, y, z], [0.86, 1.0, 0.86], 10),
      sph(r * 0.3, PALETTE.rust, [x + r * 0.36, y + r * 0.3, z + r * 0.7], [1.2, 0.9, 0.5], 7)
    )
  }

  // The MIDDLE and FRONT rings. The front one is laid lower than the perch line so the bird's feet
  // and the eggs both show over it, and it is what turns the dip into an opening with a lip.
  parts.push(
    ...twigRing(-0.05, -0.44, 0.38, 0.15, 0.04, 12, Math.PI - 0.4, 2 * Math.PI + 0.4, 0.26, [
      PALETTE.nestStick,
      PALETTE.nestStickDeep,
      PALETTE.sinter,
    ]),
    ...twigRing(-0.04, -0.46, 0.34, 0.14, 0.22, 9, Math.PI - 0.15, 2 * Math.PI + 0.15, 0.24, [
      PALETTE.nestStick,
      PALETTE.nestStickDeep,
    ])
  )

  // Sticks laid ACROSS the rim, nearly horizontal — the weave, and the only place the nest's own
  // construction crosses the bird's own outline.
  for (const [x, y, z, len, ang, tone] of [
    [-0.16, -0.3, 0.28, 0.34, -0.14, PALETTE.nestStick],
    [0.14, -0.33, 0.26, 0.28, 0.16, PALETTE.nestStickDeep],
    [-0.34, -0.34, 0.24, 0.26, 0.1, PALETTE.nestStick],
  ] as const) {
    parts.push(cyl(0.021, 0.016, len, tone, [x, y, z], [0, 0, ang + Math.PI / 2], undefined, 6))
  }

  // STICKS BREAKING THE SILHOUETTE — long, chunky and angled every which way, several jutting well
  // past the mass where there is sky behind them.
  for (const [x, y, z, len, ang, tone] of [
    [-0.44, -0.36, 0.14, 0.32, 0.3, PALETTE.nestStick],
    [-0.5, -0.5, 0.04, 0.26, -0.24, PALETTE.nestStickDeep],
    [0.4, -0.34, 0.12, 0.28, -0.42, PALETTE.nestStick],
    [0.46, -0.5, 0.02, 0.22, 0.2, PALETTE.nestStickDeep],
    [0.2, -0.6, 0.16, 0.24, 1.26, PALETTE.nestStick],
    [-0.28, -0.62, 0.14, 0.22, 1.44, PALETTE.nestStickDeep],
    [0.06, -0.64, 0.1, 0.26, 0.42, PALETTE.nestStick],
    [-0.42, -0.56, 0.16, 0.24, -0.5, PALETTE.nestStick],
  ] as const) {
    parts.push(cyl(0.023, 0.017, len, tone, [x, y, z], [0, 0, ang + Math.PI / 2], undefined, 6))
  }

  // The bird's own contact shadow, pooled into the rim it grips. Same job as the pangolin's on the
  // shelf: without it a figure is pasted onto its perch rather than standing on it.
  parts.push(sph(0.24, PALETTE.earthDeep, [-0.05, NEST_RIM - 0.015, 0.15], [1.15, 0.1, 0.34], 9))

  // Dry scrub rooted in the crag's cracks — the canyon note, and it breaks the tower's long edge.
  parts.push(
    ...limb([[-0.34, -0.95, 0.08], [-0.39, -0.88, 0.08], [-0.42, -0.8, 0.09]], 0.02, 0.011, PALETTE.clayPath),
    ...leafFan([-0.42, -0.78, 0.09], 5, 0.18, [1.4, 3.2], SCRUB, undefined, 0.26),
    ...limb([[0.16, -0.98, 0.06], [0.22, -0.92, 0.06], [0.25, -0.86, 0.07]], 0.018, 0.01, PALETTE.clayPath),
    ...leafFan([0.25, -0.84, 0.07], 4, 0.16, [0.1, 1.5], SCRUB, undefined, 0.26)
  )

  // A couple of fallen stones at the crag's foot, low-segment so they facet like the ledge's do.
  parts.push(
    sph(0.075, PALETTE.stone, [0.3, -1.02, 0.12], [1.2, 0.8, 1], 7),
    sph(0.05, PALETTE.sinterDeep, [0.44, -1.08, 0.1], [1.1, 0.85, 1], 6),
    sph(0.06, PALETTE.hoodooRock, [-0.52, -1.04, 0.08], [1.15, 0.85, 1], 7)
  )

  return parts
}

/**
 * The canyon corner's dressing, per figure — the banded shelf for the pangolin that was drawn on
 * it, a stick eyrie on a crag for the eagle. See `eagleEyrie` for why one mirrored composition
 * could not serve both.
 */
export function canyonDressing(kind: 'pangolinBig' | 'eagle'): ClayPart[] {
  return kind === 'eagle' ? eagleEyrie() : pangolinLedge()
}

// --- pangolins --------------------------------------------------------------

/**
 * The three armour tones, deepest first, plus the seam tone the plates are rimmed with.
 *
 * The tone step per plate IS the armour: at corner scale a single brown carries no plate
 * boundaries at all. But a LADDER is not enough on its own — the first light-figure pass cycled
 * these with a height bias that handed the whole upper half the top two rungs, so three tones
 * became one pale mass with a snout. The cycle below spends the full ladder everywhere the plates
 * are actually seen, and `pangolinScaleDeep` rims each of them (see `armourPlate`) so the
 * boundaries are drawn rather than merely implied.
 *
 * All three plate tones sit clear of the rock: the darkest, `pangolinScale`, is still ~45 points
 * of luminance above `strataShade`, which is the wall directly behind the figure.
 */
const PLATE_TONES = [PALETTE.pangolinScale, PALETTE.pangolinScaleLight, PALETTE.dune]

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const REAR = new THREE.Vector3(-1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const _n = new THREE.Vector3()
const _t = new THREE.Vector3()
const _lift = new THREE.Vector3()

/**
 * One armour plate laid over the shell, in two pieces.
 *
 * The plate proper is a flattened disc pushed out along the surface normal and then TILTED toward
 * the tail, so its outer edge lifts clear of the ball the way a real pangolin's scales overlap
 * backward. Under it sits a wider, deeper, UNTILTED disc — the seam. Because the plate is lifted
 * and the seam is not, the seam shows as a dark rim all round it, heaviest under the lifted edge.
 *
 * That rim is the internal contrast the figure lives or dies by. Lighten the plates enough to
 * separate the animal from a dark gorge and the tone steps between neighbouring plates stop
 * carrying the body's form on their own; a drawn boundary under each plate carries it regardless
 * of how close two neighbours land on the ramp.
 */
function armourPlate(nx: number, ny: number, nz: number, d: number, r: number, color: string): ClayPart[] {
  _n.set(nx, ny, nz)
  const axis = Math.abs(nx) > 0.92 ? UP : REAR
  _t.copy(axis).addScaledVector(_n, -axis.dot(_n)).normalize()
  _lift.copy(_n).addScaledVector(_t, 0.44).normalize()
  const flat = alignY(_n)
  const tilted = alignY(_lift)
  const s = d * 0.985
  return [
    {
      ...sph(r * 1.16, PALETTE.pangolinScaleDeep, [nx * s, ny * s, nz * s], [1.1, 0.22, 0.88], 8),
      rot: flat,
    },
    {
      ...sph(r, color, [nx * d, ny * d, nz * d], [1.12, 0.3, 0.86], 10),
      rot: tilted,
    },
  ]
}

type Pangolin = {
  /** Core radius of the ball the figure arrives as. Bounded by the unfurl stretch: the gesture
   *  scales the shell 1.34x in X, so the plated reach times that has to stay inside MASCOT_BOX. */
  ball: number
  /** Points in the golden-angle spiral, before the hidden and belly ones are dropped. Deliberately
   *  low — a fine spiral turns to fuzz at 300px, so the count buys plate SIZE. */
  spiral: number
  plateLo: number
  plateHi: number
  /** Neck joint on the ball's upper front, and the tail root at its lower rear. */
  neck: V3
  tailAt: V3
  tailLen: number
  /** Head geometry, about the neck joint. Everything on the head is derived from `skullR` and
   *  `snoutLen`, so the two builds' faces scale as units rather than drifting apart part by part. */
  skullAt: V3
  skullR: number
  snoutLen: number
  eyeR: number
}

/**
 * The two builds. The small one is not the big one scaled down — both are authored ~1 unit tall,
 * so it has to read as a JUVENILE instead: a rounder ball under fewer, chunkier plates, a bigger
 * skull, a bigger eye, a stubbier snout and a shorter tail.
 *
 * HEAD-TO-SHELL is set deliberately rather than anatomically. A real pangolin's head is a small
 * point on a large body; at 300px that reads as a pale lump with a bump on it, which is exactly
 * what the corner did — the skull used to be 0.58x the ball's radius and it disappeared. It is now
 * 0.82x on the adult and 0.90x on the juvenile, because the head is what tells a reader this is a
 * pangolin and not a generic brown animal.
 *
 * The SNOUT then went too far the other way: at 0.315 on a 0.155 skull it was as long again as the
 * skull is wide and only 0.68·R at the base, which is an anteater's proportion rather than a
 * pangolin's. It is now 0.235 (0.205 on the juvenile) on a wider base — see `pangolinHead`.
 *
 * The snout is angled ~19° below horizontal rather than level partly because the inward envelope is
 * the binding constraint on this build — length spent in −y has 0.55 of unused envelope where +x
 * has almost none — and partly because an animal nosing down at the ledge it has just unrolled onto
 * is the pose the beat is about.
 */
const BIG: Pangolin = {
  ball: 0.19,
  spiral: 22,
  plateLo: 0.102,
  plateHi: 0.16,
  // The neck joint sits a touch BEHIND the figure's centre. Not styling: the unfurl rotates the
  // whole head piece ~2.6 rad, so the forelimb sweeps through +X on the way out and the joint's
  // own offset is added to that whole arc. Pushing it forward is what breaks the inward clearance.
  neck: [-0.01, 0.325, 0.1],
  tailAt: [-0.178, -0.088, 0],
  tailLen: 1.05,
  skullAt: [0.118, 0.205, 0],
  skullR: 0.155,
  snoutLen: 0.235,
  eyeR: 0.055,
}

/**
 * The axis of the muzzle's main wedge: forward and ~19° below horizontal. Written out rather than
 * left implicit in a rotation constant because the muzzle END and the nostril are placed ALONG it —
 * see `pangolinHead`. The two tone cones that split the wedge lengthwise keep their own −1.82 and
 * −1.97 on purpose, so this is the wedge's axis rather than one the whole chain shares.
 */
const SNOUT_TILT = -1.9
const SNOUT_DX = -Math.sin(SNOUT_TILT)
const SNOUT_DY = Math.cos(SNOUT_TILT)

/**
 * Slot 'c' — the SHELL, centred on the figure's origin because the arrival spins the whole rig
 * about it. Authored as a ball that plausibly stretches into a body, since the unfurl gesture
 * scales it (1+0.34u, 1−0.22u, 1−0.06u) rather than swapping geometry.
 *
 * The spiral covers the ball except two windows: the far side, which is never drawn, and the
 * lower front, where a real pangolin's soft unarmoured belly goes. The core under it is the deep
 * seam tone, so anywhere the plates fall short shows shadow rather than more mid-brown.
 */
function pangolinShell(p: Pangolin, d: 1 | -1): ClayPart[] {
  const parts: ClayPart[] = [
    sph(p.ball, PALETTE.pangolinScaleDeep, [0, 0, 0], undefined, 14),
    sph(
      p.ball * 0.7,
      PALETTE.sinter,
      [p.ball * 0.16, -p.ball * 0.44, p.ball * 0.34],
      [1.2, 0.86, 0.8],
      10
    ),
  ]

  const dist = p.ball + 0.016
  for (let i = 0; i < p.spiral; i++) {
    const ny = 1 - (2 * (i + 0.5)) / p.spiral
    const rad = Math.sqrt(Math.max(0, 1 - ny * ny))
    const a = i * GOLDEN_ANGLE
    const nx = Math.cos(a) * rad
    const nz = Math.sin(a) * rad
    if (nz < -0.42) continue
    if (ny < -0.4 && nz > 0.2) continue
    const r = p.plateLo + (p.plateHi - p.plateLo) * (0.5 + 0.5 * ny)
    // The full three-tone ladder cycles across the flank and the back — one plate in three takes
    // the deep tone, and because consecutive spiral indices land ~137° apart, no plate shares a
    // tone with a spatial neighbour. Only the two extremes are biased: the crest, which is the arc
    // drawn against sky and takes the sun, is held to the top two rungs, and the belly to the
    // bottom two, since a bright plate stranded on the underside reads as a hole in the armour.
    const tone = ny < -0.34 ? i % 2 : ny > 0.45 ? 1 + (i % 2) : i % 3
    parts.push(...armourPlate(nx, ny, nz, dist, r, PLATE_TONES[tone]))
  }

  parts.push(
    // Hind legs, tucked at the ball's rear. They stay in the shell group so the unfurl squat
    // spreads them with the body — a pangolin coming out of a roll settles onto its haunches.
    sph(p.ball * 0.5, PALETTE.pangolinScaleLight, [-p.ball * 0.28, -p.ball * 0.74, p.ball * 0.6], [1.05, 1.08, 0.95], 9),
    sph(p.ball * 0.34, PALETTE.pangolinScale, [-p.ball * 0.22, -p.ball * 1.2, p.ball * 0.78], [1.5, 0.66, 1.1], 8),
    cone(p.ball * 0.085, p.ball * 0.3, PALETTE.snow, [p.ball * 0.04, -p.ball * 1.38, p.ball * 0.95], [0, 0, -2.5], undefined, 5),
    sph(p.ball * 0.42, PALETTE.pangolinScale, [-p.ball * 0.56, -p.ball * 0.8, -p.ball * 0.3], [1, 1.05, 0.95], 8)
  )

  return facing(d, parts)
}

/**
 * Slot 'a' — head and near forelimb, authored about the neck joint so the gesture can rotate the
 * whole piece ~2.5 rad and shrink it to 0.4 while rolled, then swing it out along the ball's
 * equator as the figure unfurls.
 *
 * The head is carried HIGH, well above the stretched shell's silhouette, and the long wedge snout
 * points forward and down off it. That is the deliberate departure from pangolin anatomy: a head
 * held in line with the body disappears into the shell's own outline at reading size, whereas an
 * animal lifting its snout out of the ball is both legible and the whole point of the beat.
 *
 * Three tone steps carry the head's form, because a skull this size is otherwise one flat patch
 * under the four-band ramp: a shadowed cheek under the brow, a deep bridge along the top of the
 * muzzle, and a deep collar where the neck disappears into the shell.
 */
function pangolinHead(p: Pangolin, d: 1 | -1): ClayPart[] {
  const [sx, sy] = p.skullAt
  const R = p.skullR
  const L = p.snoutLen
  // The eye rides well FORWARD on the skull, on the snout side of its centre. Set back near the
  // middle of the crown an animal with a long muzzle reads as looking past its own face.
  const ex = sx + R * 0.33
  const ey = sy + R * 0.38
  const ez = 0.098
  // Root of the muzzle, off the skull's lower front quarter, and the point its axis ends at.
  const mx = sx + R * 0.82
  const my = sy - R * 0.8
  const tipX = mx + SNOUT_DX * L * 0.5
  const tipY = my + SNOUT_DY * L * 0.5
  // the muzzle's own up-normal, for seating the nostril on TOP of the wedge rather than on its end
  const upX = -SNOUT_DY
  const upY = SNOUT_DX
  return facing(d, [
    ...limb([[-0.02, -0.115, 0], [0.05, 0.05, 0], [sx - 0.01, sy - 0.02, 0]], 0.115, 0.098, PALETTE.pangolinScaleLight),
    // the collar: the head is the lightest thing in the corner and the shell behind it is nearly
    // as light, so the join needs a drawn shadow or the two masses merge into one lump
    sph(0.09, PALETTE.pangolinScaleDeep, [-0.02, -0.115, 0.02], [1.15, 0.8, 0.9], 9),
    sph(R, PALETTE.pangolinScaleLight, [sx, sy, 0], [1.0, 0.94, 0.95], 12),
    // the shade step: a shadowed cheek under the brow, carrying the volume the four-band toon
    // ramp flattens out of a smooth skull at this size
    sph(R * 0.84, PALETTE.pangolinScale, [sx - 0.02, sy - R * 0.46, 0.03], [1.1, 0.8, 0.95], 10),
    // Snout: one wedge, and the whole silhouette read of the animal. The paler under-jaw and the
    // deep bridge split it lengthwise so it does not collapse into a single blunt cone.
    //
    // SHORT AND WIDE, and both halves of that matter. Drawn long and thin — snout as long again as
    // the skull is wide, on a base of 0.68·R — the wedge became a stick, and the dark bead at its
    // end became a bead ON a stick: the corner read as an ANTEATER, or as something stuck to the
    // animal's face. A pangolin's muzzle is a stout cone continuous with the skull, so the base is
    // now 0.88·R and the run is a third shorter, which also hands the inward envelope back the
    // reach the old snout spent on being narrow.
    cone(R * 0.88, L, PALETTE.pangolinScaleLight, [mx, my, 0], [0, 0, SNOUT_TILT], [1, 1, 0.84]),
    cone(R * 0.58, L * 0.78, PALETTE.sinter, [mx - 0.008, my - 0.038, 0.03], [0, 0, -1.82], [1, 1, 0.8]),
    cone(R * 0.44, L * 0.7, PALETTE.pangolinScale, [mx + 0.014, my + R * 0.32, -0.02], [0, 0, -1.97], [1, 1, 0.7]),
    // The muzzle's blunt END, in the ANIMAL'S OWN tone. A cone tapers to a point, so whatever is
    // put at its tip becomes the tip; with the nose there, the darkest thing in the corner was also
    // its furthest-forward point. The tip is the pangolin's, and the nose sits back off it.
    sph(R * 0.27, PALETTE.pangolinScaleLight, [tipX - SNOUT_DX * R * 0.12, tipY - SNOUT_DY * R * 0.12, 0.02], [0.94, 1, 0.9], 10),
    // One small nostril, on TOP of the wedge and set back from its end — a third of the bead the
    // first pass hung off the point, and read as part of a face rather than as a mounted object.
    sph(
      R * 0.105,
      PALETTE.ink,
      [tipX - SNOUT_DX * 0.012 + upX * R * 0.15, tipY - SNOUT_DY * 0.012 + upY * R * 0.15, 0.05],
      [1.2, 0.85, 0.75],
      8
    ),
    // A wider pale bead behind the eye, centred a hair BEHIND the pupil. `eye()`'s own sclera is
    // sized for a songbird's head; on a skull this size the pupil lands hard against its rim and
    // the eye reads as a fixed sideways glance. Widening the pale and centring it on the pupil
    // (with the small forward offset that remains) puts the dark of the eye where the animal is
    // going — the same device as the macaw's face patch, shrunk to an eye ring.
    sph(p.eyeR * 1.15, PALETTE.snow, [ex + p.eyeR * 0.12, ey - p.eyeR * 0.04, ez], [1, 1.02, 0.6], 12),
    ...eye([ex, ey, ez], p.eyeR, {
      sclera: PALETTE.snow,
      iris: PALETTE.ink,
      lid: PALETTE.pangolinScale,
      // The lid rides HIGH at the snout end. A brow dropping toward the back of the skull reads
      // alert; the first pass tilted it the other way, which reads as a glower.
      lidTilt: 0.22,
    }),
    sph(0.038, PALETTE.pangolinScale, [sx - R * 0.55, sy + R * 0.42, 0.06], [1, 1.35, 0.7], 8),
    // scaled crown — the armour runs onto the head, which is what a bare-skulled version loses,
    // and the two crown plates take two different rungs of the same ladder the shell uses
    { ...sph(R * 0.58, PALETTE.dune, [sx - R * 0.22, sy + R * 0.62, 0], [1.1, 0.3, 0.95], 8), rot: [0, 0, -0.3] as V3 },
    { ...sph(R * 0.46, PALETTE.pangolinScale, [sx - R * 0.66, sy + R * 0.48, -0.01], [1.1, 0.3, 0.95], 8), rot: [0, 0, -0.42] as V3 },
    // Near forelimb, PLANTED. It used to be held clear of the rock — an animal still coming out of
    // a roll not having put its front feet down yet — but a paw raised away from the body reads as
    // a wave and breaks the silhouette into two unrelated shapes. Dropped onto the ledge it does
    // the opposite job: it seats the figure on the shelf, and the three digging claws a pangolin
    // is built around splay FORWARD along the rock, where they are read against it rather than
    // silhouetted against sky.
    cyl(0.064, 0.08, 0.17, PALETTE.pangolinScaleLight, [0.03, -0.2, 0.13], [0, 0, 0.12]),
    cyl(0.054, 0.064, 0.15, PALETTE.pangolinScale, [0.062, -0.375, 0.15], [0, 0, -0.08]),
    sph(0.072, PALETTE.pangolinScale, [0.086, -0.508, 0.16], [1.25, 0.72, 1.0], 9),
    cone(0.019, 0.095, PALETTE.snow, [0.142, -0.542, 0.185], [0, 0, -1.98], undefined, 5),
    cone(0.018, 0.088, PALETTE.snow, [0.134, -0.558, 0.135], [0, 0, -1.86], undefined, 5),
    cone(0.017, 0.082, PALETTE.snow, [0.128, -0.534, 0.215], [0, 0, -2.12], undefined, 5),
  ])
}

/** The tail's centreline and the plates riding its upper edge, at `tailLen` = 1. */
const TAIL_PATH: readonly V3[] = [
  [0.02, 0.01, 0],
  [-0.11, -0.045, 0],
  [-0.21, -0.115, 0],
  [-0.3, -0.225, 0],
]
const TAIL_PLATES: readonly (readonly [number, number, number, number, number])[] = [
  // x, y, radius, roll (the plate's normal follows the curve's tangent), tone index
  [-0.045, 0.045, 0.108, 0.38, 2],
  [-0.145, -0.005, 0.098, 0.44, 0],
  [-0.235, -0.06, 0.086, 0.55, 1],
  [-0.3, -0.14, 0.072, 0.72, 2],
  [-0.325, -0.21, 0.055, 0.85, 0],
]

/**
 * Slot 'b' — the plated tail, authored about its root so the gesture can fold it over the ball
 * while rolled and let it trail out behind once parked. Its five plates are the largest single
 * pieces of armour on the figure: the tail is the part that stays clear of the shell in every
 * pose, so it is where the overlapping-plate read is cheapest to buy — and each one carries the
 * same deep seam disc the shell's plates do, for the same reason.
 */
function pangolinTail(p: Pangolin, d: 1 | -1): ClayPart[] {
  const k = p.tailLen
  const girth = 0.6 + 0.4 * k
  const pts = TAIL_PATH.map(([x, y, z]) => [x * k, y * k, z] as V3)
  return facing(d, [
    ...limb(pts, 0.088 * girth, 0.03 * girth, PALETTE.pangolinScaleDeep),
    ...TAIL_PLATES.flatMap(([x, y, r, roll, tone]) => [
      {
        ...sph(r * girth * 1.14, PALETTE.pangolinScaleDeep, [x * k, y * k, -0.008], [1.12, 0.24, 0.9], 8),
        rot: [0, 0, roll] as V3,
      },
      {
        ...sph(r * girth, PLATE_TONES[tone], [x * k, y * k, 0], [1.15, 0.3, 0.9], 8),
        rot: [0, 0, roll] as V3,
      },
    ]),
  ])
}

// --- the eagle --------------------------------------------------------------

/**
 * Task 61 — the second pangolin is replaced by an EAGLE. Aram: "We can have an eagle with
 * pangolin." The roll-in beat stays with the animal that owns it; what this corner gains is a
 * second species and a vertical.
 *
 * WHERE IT PERCHES (Task 62): its own NEST, on its own crag — see `eagleEyrie`. It used to stand on
 * the pangolin's shelf, which was the only surface the corner had, and that made the pair one
 * composition mirrored.
 *
 * The one thing that did NOT change with the seat is the level: `PERCH_Y` is still `LEDGE_TOP`, so
 * the talons grip the nest's rim exactly where they used to grip the shelf's lip. Keeping the
 * contact line put the whole rebuild below into the dressing where it belongs, and left the figure
 * free to be judged on its own proportions — which is the other half of this round's work.
 *
 * (The hoodoo remains illegal as a perch, for the record, and for the same reason it always was:
 * the spire stands at x ≈ −0.46…−0.52 while `FACE_BOX` stops the head at −0.20, so a bird up there
 * would have to crane a third of a figure-height back inboard. That is a contortion, not a pose.)
 *
 * WHY IT IS A COLD BROWN. The canyon's own review finding was that the first pangolin "camouflages
 * into its own dressing" because animal and rock shared a family, and the fix was to put a light
 * tan animal on deep rust rock. A dark eagle inverts that trick rather than repeating it: it sits
 * BELOW the rock's value instead of above it. But that only works if the hue separates too, so
 * `eagleWing` is a low-chroma cold umber where every rock tone here (`rust`, `hoodooRock`,
 * `strataDust`) is a saturated orange. The head then goes the other way again into `eagleNape`'s
 * tawny gold, which is the golden eagle's own marking and, more to the point, the only reason the
 * head does not vanish into the body — a raptor drawn in one brown is a lump with a beak.
 *
 * READS RAPTOR AT CORNER SCALE. Four cues, in the order a reader gets them: the MANTLED WING
 * breaking the outline, the HOOKED beak, the heavy overhanging BROW (the thing that makes an
 * eagle's eye fierce rather than owlish), and the TALONS gripping the rock. Everything else is
 * subordinate.
 *
 * ...AND FOR TWO ROUNDS IT DID NOT, WHICH IS WHAT TASK 62 IS FOR. The R18 review's verdict after
 * the head was rebuilt was that "the dodo is gone; it now reads VULTURE", and it diagnosed the
 * remaining fault precisely: the head was correct and the SILHOUETTE was still two large round
 * lobes — the body and the folded wing — which no head fix can overcome. It named the lever as
 * `eagleBody`'s proportions and required a follow-up rather than a third head tweak.
 *
 * THE REBALANCE, and it is three separate moves because the fault was three things at once:
 *
 *  1. THE BODY IS NARROWER, NOT SMALLER. Simply shrinking it would have made a small fat bird. The
 *     main mass loses about a quarter of its WIDTH and only a seventh of its height, and the mass
 *     under it tapers harder to the vent, so the outline is an upright teardrop instead of a ball.
 *     Width is what read as bulk; height is what reads as a perched raptor standing tall.
 *  2. THE HEAD AND SHOULDERS WIN. The skull is about a fifth larger in every dimension and the
 *     mantling shoulders crest higher over the nape. Together with (1) the head goes from roughly
 *     half the body's height to about two thirds of it, which is the proportion that reads as a
 *     raptor rather than as a pigeon — a real eagle's head is smaller than this, and drawing it
 *     honestly at 300px is what produced the lump.
 *  3. THE TAIL IS LONGER AND IT HANGS. A raptor perched has a long tail behind and below the feet;
 *     the first build's was a short squared fan sticking straight out, which read as another lobe
 *     rather than as a counterweight. It is now six feathers on a wider sweep, angled down, with
 *     the dark terminal band at its end — and the extra length is spent DOWNWARD, where the
 *     envelope has 0.57 of unused reach, rather than outward where it has almost none.
 *
 * The wing's own share of the fix is in `eagleWing`.
 */

/** Where the wing hinges off the shoulder, and where the eagle's feet meet the shelf. */
const WING_AT: V3 = [-0.1, 0.24, 0.14]
const PERCH_Y = LEDGE_TOP

/**
 * One row of PRIMARIES: long, separately drawn feathers fanning off the wing's trailing edge.
 *
 * Drawn as individual blades rather than as one mass because separation is the whole read. A wing
 * painted as a single lozenge is a fin; what says "bird" is that the outer feathers are distinct
 * fingers with sky between them, and at this size that has to be built rather than shaded — the
 * four-band ramp will not draw a feather edge inside a silhouette.
 */
function primaries(
  at: V3,
  n: number,
  from: number,
  to: number,
  len: number,
  color: string
): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const a = from + (to - from) * f
    // the outermost feathers are the longest — a wing's tip is its point, and an even row reads as
    // a comb the same way the winter icicles did before their lengths were staggered
    const l = len * (0.72 + 0.42 * f)
    out.push(
      cone(
        0.03,
        l,
        color,
        [at[0] + Math.cos(a) * l * 0.5, at[1] + Math.sin(a) * l * 0.5, at[2] - 0.012 * i],
        [0, 0, a - Math.PI / 2],
        [1, 1, 0.34],
        6
      )
    )
  }
  return out
}

/**
 * Body, tail, far wing and the head.
 *
 * The FAR wing lives here rather than on a hinge and is drawn a size down, darker and further back
 * in Z. Two identical wings at one depth read as one flat shape with a notch; the pair only reads
 * as a bird with wings ON it when one is clearly behind the other — the same rule the fennec's ears
 * are built to in the desert corner.
 */
function eagleBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // FAR WING first, so the body draws over its root. Its reach is set by `MASCOT_BOX.out` rather
    // than by taste: a feather is placed at its own half-length and then runs a full length beyond,
    // so the origin has to sit a whole feather clear of the limit, not half of one. The first pass
    // put it at x = −0.40 and the tip measured −0.769 against a 0.68 box.
    ...primaries([-0.26, 0.09, -0.16], 5, 3.38, 3.9, 0.22, PALETTE.eagleDeep),
    sph(0.13, PALETTE.eagleDeep, [-0.21, 0.15, -0.14], [1.2, 0.66, 0.36], 12),

    // TAIL: six feathers on a wide sweep, angled back and DOWN past the feet, with a dark terminal
    // band across the end. Long rather than square — see (3) above; the short fan the first build
    // used read as a second body lobe, and the length is what turns it into a counterweight.
    ...primaries([-0.15, -0.16, -0.07], 6, 3.45, 3.85, 0.42, PALETTE.eagleWing),
    { ...sph(0.09, PALETTE.eagleDeep, [-0.46, -0.44, -0.08], [1.7, 0.4, 0.4], 10), rot: [0, 0, 0.55] as V3 },

    // BODY: an upright teardrop, NARROW at the shoulders and tapering to the vent. Set upright
    // rather than horizontal because a perched bird stands, and because the corner's other animal
    // is a low round ball and the pair needs one vertical between them. The width is the whole
    // argument — see (1) in the docblock.
    sph(0.175, PALETTE.eagleWing, [-0.075, 0.06, 0.0], [0.8, 1.16, 0.86], 14),
    sph(0.118, PALETTE.eagleWing, [-0.115, -0.135, -0.01], [0.86, 0.95, 0.85], 12),
    // the breast, forward and a touch lighter, so the bird has a front as well as an outline
    sph(0.115, PALETTE.eagleWing, [0.01, 0.045, 0.13], [0.66, 1.12, 0.44], 12),
    sph(0.115, PALETTE.eagleDeep, [-0.135, -0.03, 0.09], [0.6, 1.25, 0.44], 12),
    // scapular coverts stepping down the back — the drawn break that stops the body being one egg
    ...[
      [-0.165, 0.16, 0.05],
      [-0.2, 0.045, 0.045],
      [-0.215, -0.06, 0.038],
    ].map(([x, y, r]) => ({
      ...sph(r, PALETTE.eagleDeep, [x, y, 0.055], [1.5, 0.66, 0.5], 8),
      rot: [0, 0, 0.5] as V3,
    })),

    // LEGS AND TALONS. Feathered to the ankle (a golden eagle's "trousers", and a real cue), then
    // bare yellow tarsi and four toes wrapped OVER the shelf's edge. Toes that end on top of a
    // surface read as feet resting near it; toes that curl down its front read as a grip, and the
    // grip is what ties the bird to the rock.
    sph(0.095, PALETTE.eagleWing, [-0.045, -0.175, 0.13], [0.86, 1.06, 0.68], 10),
    cyl(0.028, 0.032, 0.09, PALETTE.goldSand, [-0.035, PERCH_Y + 0.08, 0.17], [0, 0, 0.06]),
    cyl(0.026, 0.03, 0.08, PALETTE.goldSand, [-0.145, PERCH_Y + 0.075, 0.1], [0, 0, 0.09]),
    ...[
      [-0.035, 0.17, 1],
      [-0.145, 0.1, -1],
    ].flatMap(([x, z, s]) => [
      sph(0.036, PALETTE.goldSand, [x, PERCH_Y + 0.028, z], [1.3, 0.8, 1.0], 8),
      cone(0.014, 0.062, PALETTE.goldSand, [x + 0.045 * s, PERCH_Y + 0.012, z + 0.02], [0, 0, -1.9 * s], undefined, 6),
      cone(0.013, 0.055, PALETTE.goldSand, [x - 0.04 * s, PERCH_Y + 0.012, z + 0.01], [0, 0, 1.9 * s], undefined, 6),
      // one ink talon per foot, hooked under the shelf's lip
      cone(0.009, 0.04, PALETTE.ink, [x + 0.072 * s, PERCH_Y - 0.028, z + 0.02], [0, 0, -2.5 * s], undefined, 6),
    ]),

    // NECK AND HEAD. It read as a DODO on the first two passes and the three reasons were all here,
    // so they are all named:
    //
    //  1. THE BEAK WAS A CHAIN OF SPHERES. A raptor's bill is a WEDGE with a hook — a deep base
    //     narrowing to a point that swings down BELOW the jaw line. Rounded blobs in a warm tone
    //     make a dodo's bulbous bill however big they are drawn, which is precisely what happened.
    //     It is now a tapered wedge plus a separate down-curved hook, and the hook overhangs.
    //  2. THE SKULL WAS A DOME. Raptors are FLAT-CROWNED — the brow ridge runs back level with the
    //     top of the head, and that flat line over a hooked bill is most of the read. A dome over a
    //     round body is a pigeon.
    //  3. THE HEAD SAT ON TOP OF THE BODY. A perched raptor MANTLES: the shoulders carry above the
    //     neck's base so the head is set forward and DOWN between them. That hunch is the raptor
    //     silhouette; a head balanced on a round body is a dodo's.
    sph(0.088, PALETTE.eagleNape, [0.02, 0.3, 0.06], [0.85, 1.0, 0.85], 12),
    ...tufts([0.01, 0.3, 0.02], 0.12, 6, PALETTE.eagleNape, 0.45, 1.45, 0.5),
    // the shoulders MANTLING above the neck's base — the hunch, in two dark masses that crest
    // higher than the nape does. Raised in T62: over a narrower body the mantle has to carry more
    // of the figure's width, or the bird reads as narrow-shouldered rather than as hunched.
    sph(0.145, PALETTE.eagleWing, [-0.115, 0.355, 0.0], [1.12, 0.7, 0.68], 12),
    sph(0.1, PALETTE.eagleDeep, [-0.185, 0.315, 0.055], [1.05, 0.66, 0.55], 10),
    // the skull, wider than tall and set FORWARD of the neck — about a fifth larger than the first
    // build's, which is the other half of the head-to-body rebalance
    sph(0.15, PALETTE.eagleNape, [0.11, 0.465, 0.07], [1.16, 0.92, 0.94], 14),
    // THE FLAT CROWN, in the dark tone: a low slab across the top of the skull, running BACK past
    // the nape. The straight line is the point — it is what a dome cannot give.
    { ...sph(0.128, PALETTE.eagleWing, [0.085, 0.535, 0.05], [1.1, 0.22, 0.7], 12), rot: [0, 0, 0.13] as V3 },

    // THE BROW, heavier and further forward than the first pass: a raptor's supraorbital ridge
    // OVERHANGS the eye and throws it into shadow, and that shelf is the glare. Drawn in ink
    // because at reading size a shaded ridge is invisible and a drawn one is not.
    //
    // EVERY FEATURE BELOW MOVED WITH THE SKULL, and it moved by ARITHMETIC rather than by eye: the
    // whole face is the old placement scaled 1.17 about the skull's own centre, which is the ratio
    // the skull itself grew by. Nudging a brow and a beak into a bigger head one part at a time is
    // how a face drifts out of proportion with itself — the pangolin's two builds are documented
    // next door as deriving from `skullR` and `snoutLen` for exactly this reason.
    ...limb(
      [
        [0.2446, 0.52, 0.135],
        [0.1451, 0.5446, 0.155],
        [0.0281, 0.5294, 0.13],
      ],
      0.024,
      0.031,
      PALETTE.ink
    ),
    // A pale orbital patch for the eye to be read AGAINST. Without it the eye is a dark bead under
    // a dark brow on a dark head — three darks in a row, and the glare disappears into them. This
    // is the same device the penguin's face patch does in the winter corner.
    { ...sph(0.072, PALETTE.eagleNape, [0.157, 0.465, 0.135], [1.15, 0.85, 0.6], 10), rot: [0, 0, 0.1] as V3 },
    // The eye, set UNDER the shelf and forward. Small and hard: a big round eye is an owl's, and a
    // small one tucked under a brow is what reads as a glare.
    ...eye([0.151, 0.46, 0.15], 0.049, { sclera: PALETTE.honey, iris: PALETTE.ink }),
    // a dark cheek stripe running back from the eye, which is what stops the face reading as blank
    { ...sph(0.07, PALETTE.eagleWing, [0.057, 0.436, 0.12], [1.5, 0.34, 0.6], 8), rot: [0, 0, 0.12] as V3 },

    // THE BEAK: a WEDGE and a HOOK, not a chain of beads.
    // The cere first — a stepped base in the dark tone, which is what makes the bill look SET INTO
    // the face rather than stuck on it.
    { ...sph(0.064, PALETTE.eagleDeep, [0.2095, 0.439, 0.14], [0.8, 1.0, 0.85], 10), rot: [0, 0, 0.2] as V3 },
    // the upper mandible, tapering forward and down
    ...limb(
      [
        [0.2153, 0.4322, 0.145],
        [0.2914, 0.4088, 0.145],
        [0.344, 0.3808, 0.14],
      ],
      0.061,
      0.035,
      PALETTE.goldSand
    ),
    // THE HOOK — a separate cone swung down BELOW the jaw line and coming to a point. This is the
    // single piece that decides raptor or dodo, so it is drawn long enough to overhang.
    cone(0.035, 0.135, PALETTE.goldSand, [0.358, 0.322, 0.138], [0, 0, 3.32], [1, 1, 0.85], 8),
    // the short lower mandible, tucked under the hook's overhang
    { ...sph(0.042, PALETTE.goldSand, [0.28, 0.362, 0.15], [1.35, 0.5, 0.8], 10), rot: [0, 0, 0.14] as V3 },
    // the gape line and one ink nostril on the cere
    ...limb(
      [
        [0.3323, 0.3655, 0.16],
        [0.2446, 0.3854, 0.17],
        [0.1744, 0.4018, 0.155],
      ],
      0.009,
      0.014,
      PALETTE.ink
    ),
    sph(0.013, PALETTE.ink, [0.2212, 0.4463, 0.185], undefined, 6),
  ])
}

/**
 * The near wing, hinged at the shoulder and authored FOLDED — reaching out and down along the
 * flank. `applyMantle` lifts it from there.
 *
 * Built in three bands back to front: the shoulder's covert mass, a row of secondaries, and the
 * long primaries at the tip. The bands step DARKER outward (`eagleWing` → `eagleDeep`), which is
 * both what a real wing does and what stops the whole limb reading as one flat paddle once the ramp
 * has flattened its interior.
 *
 * TASK 62 — IT HANGS DOWN THE FLANK NOW, AND THAT IS THE WHOLE FIX. The R18 review's blocking
 * finding was that the outline was "two large round lobes, body and folded wing". I first answered
 * only the roundness — flattening the coverts into a plane with a drawn leading edge — and the
 * capture showed why that was half the problem: the blade still ran OUTWARD from the shoulder,
 * roughly horizontally, so a flatter version of it read as a stiff plank sticking out of the bird
 * at both ends of the gesture. A wing that leaves the body at right angles is an open wing however
 * it is shaded.
 *
 * A folded wing lies ALONG the flank, pointing down and slightly back, with the primaries carrying
 * on past the vent. So the blade is now authored nearly vertical (its long axis rolled ~1.3 rad off
 * horizontal) and `applyMantle` opens it outward from there — which is also a better gesture, since
 * a mantle is a wing OPENING rather than a wing waving. It is bounded by a drawn leading edge on
 * the breast side and a dark trailing edge on the flank side, because the four-band ramp will not
 * shade a plane into existence at this size.
 */
function eagleWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // The coverts are `eagleNape`, NOT the body tone, and that is the whole fix for the first
    // pass's vulture. A limb drawn in the same value as the mass it crosses comes back from the
    // four-band ramp as one silhouette — the yeti's arm went missing for exactly this reason and
    // the fix there was the same one: give the limb its own value. A golden eagle's wing coverts
    // really are paler than its back, so the honest drawing and the legible one agree here.
    { ...sph(0.13, PALETTE.eagleNape, [-0.035, -0.11, 0.05], [1.5, 0.6, 0.4], 12), rot: [0, 0, 1.28] as V3 },
    { ...sph(0.1, PALETTE.eagleNape, [-0.075, -0.28, 0.04], [1.45, 0.58, 0.38], 12), rot: [0, 0, 1.34] as V3 },
    // THE LEADING EDGE — a drawn line down the blade's breast side. This is the piece that decides
    // plane or lobe: a rounded mass with no margin line is a bulge whatever tone it carries.
    { ...sph(0.15, PALETTE.eagleDeep, [0.015, -0.14, 0.07], [1.5, 0.1, 0.3], 10), rot: [0, 0, 1.34] as V3 },
    // ...and the trailing edge on the flank side, so the blade is bounded on both rather than fading
    { ...sph(0.13, PALETTE.eagleDeep, [-0.1, -0.2, 0.05], [1.5, 0.12, 0.32], 10), rot: [0, 0, 1.28] as V3 },
    // The wing tip is what binds `MASCOT_BOX.out` on this figure, and it binds it at the TOP of the
    // mantle rather than at rest: opening the blade swings its tip outward. Measured over the full
    // gesture sweep, not at the parked pose — an earlier pass was authored against the rest pose
    // and measured 0.769 against a 0.68 box once the mantle was included.
    ...primaries([-0.09, -0.34, -0.02], 6, 3.9, 4.45, 0.24, PALETTE.eagleDeep),
    // the shoulder's own dark cap, so the pale coverts have a top line and do not simply run into
    // the neck's hackles
    { ...sph(0.06, PALETTE.eagleDeep, [0.0, 0.02, 0.06], [1.3, 0.4, 0.45], 10), rot: [0, 0, 0.3] as V3 },
  ])
}

export function canyonPieces(kind: 'pangolinBig' | 'eagle', dir: 1 | -1): PeekerPiece[] {
  if (kind === 'eagle') {
    return [
      { slot: 'body', at: [0, 0, 0], parts: eagleBody(dir), ink: true },
      { slot: 'a', at: [WING_AT[0] * dir, WING_AT[1], WING_AT[2]], parts: eagleWing(dir), ink: true },
    ]
  }
  const p = BIG
  return [
    // 'c' is the whole-body deformer the unfurl stretches; 'a' and 'b' are its siblings, hinged at
    // joints that sit INSIDE the ball so both are hidden by the shell while the figure is rolled.
    { slot: 'c', at: [0, 0, 0], parts: pangolinShell(p, dir), ink: true },
    { slot: 'a', at: [p.neck[0] * dir, p.neck[1], p.neck[2]], parts: pangolinHead(p, dir), ink: true },
    // No `ink` on the tail: only INK_PIECE_LIMIT (2) pieces are ever drawn with a contour, so a
    // flag here would be silently dropped.
    { slot: 'b', at: [p.tailAt[0] * dir, p.tailAt[1], p.tailAt[2]], parts: pangolinTail(p, dir) },
  ]
}
