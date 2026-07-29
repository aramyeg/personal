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

export function canyonDressing(): ClayPart[] {
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

const SMALL: Pangolin = {
  ball: 0.176,
  spiral: 17,
  plateLo: 0.11,
  plateHi: 0.172,
  neck: [-0.01, 0.29, 0.1],
  tailAt: [-0.165, -0.083, 0],
  tailLen: 0.88,
  skullAt: [0.122, 0.19, 0],
  skullR: 0.158,
  snoutLen: 0.205,
  eyeR: 0.064,
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

export function canyonPieces(kind: 'pangolinBig' | 'pangolinSmall', dir: 1 | -1): PeekerPiece[] {
  const p = kind === 'pangolinBig' ? BIG : SMALL
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
