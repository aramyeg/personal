import * as THREE from 'three'
import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { alignY, cone, cyl, eye, facing, leafFan, limb, sph, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the CANYON checkpoint: a banded red-rock shelf under a hoodoo spire, with two
 * PANGOLINS that roll in as armoured balls and unfurl on the ledge.
 *
 * Same corner grammar as `peeker-jungle.tsx` (the biome the look-dev gate ran against): one big
 * mass sweeping in from the frame's outer edge, a second vertical element climbing that edge, and
 * the characters sitting ON something rather than floating beside it. What changes is the
 * vocabulary — where the jungle reads by leaf density, the canyon reads by STRATA: horizontal
 * colour bands stacked into a shelf, and the same banding wrapped around a spire.
 *
 * VISIBLE BAND, the constraint every measurement below is fitted to: the frame's outer edge sits
 * at local x = −PEEKER_INSET_X (−0.64) and its bottom edge at local y ≈ −0.92. Dressing authored
 * past those is thrown away, which is exactly how the jungle's first pass lost its canopy. So the
 * strata run INWARD across the whole frame and only the lowest band crops off the bottom, and the
 * spire leans out over the corner rather than standing beyond it.
 */

// --- dressing ---------------------------------------------------------------

/**
 * The strata stack, top (the shelf the pangolins stand on) downward: `[cx, cy, halfHeight, length,
 * colour]`. Widths and centres are deliberately UNEQUAL — a stack of equal slabs reads as a
 * staircase, which is the one thing a canyon wall never looks like, whereas alternating overhang
 * and undercut is what differential erosion actually leaves behind. The pale `sinterDeep` seam
 * near the bottom is the mineral band that stops six terracotta layers reading as one brown mass.
 */
const STRATA: readonly (readonly [number, number, number, number, string])[] = [
  [0.03, -0.305, 0.07, 1.4, PALETTE.hoodooCap],
  [0.06, -0.435, 0.072, 1.34, PALETTE.strataDust],
  [0.01, -0.565, 0.072, 1.38, PALETTE.hoodooRock],
  [0.07, -0.69, 0.07, 1.3, PALETTE.rust],
  [0.02, -0.815, 0.068, 1.36, PALETTE.sinterDeep],
  [0.07, -0.94, 0.062, 1.26, PALETTE.hoodooRock],
]

/** Top surface of the shelf — the line every prop and both animals are seated on. */
const LEDGE_TOP = -0.235

/**
 * The spire's segments, base upward: `[radius at top, radius at bottom, height, colour]`. Pinched
 * waists alternating with bulges is what makes a hoodoo a hoodoo rather than a pillar, and the
 * tones cycle through the same three the shelf uses so the two masses read as the same rock.
 */
const SPIRE: readonly (readonly [number, number, number, string])[] = [
  [0.115, 0.15, 0.13, PALETTE.hoodooRock],
  [0.088, 0.115, 0.13, PALETTE.rust],
  [0.112, 0.088, 0.13, PALETTE.strataDust],
  [0.078, 0.112, 0.13, PALETTE.hoodooRock],
  [0.102, 0.078, 0.13, PALETTE.rust],
  [0.072, 0.102, 0.13, PALETTE.strataDust],
  [0.096, 0.072, 0.13, PALETTE.hoodooRock],
  [0.07, 0.096, 0.13, PALETTE.rust],
]

/** Two dusty greens — a canyon scrub is never the jungle's saturated leaf. */
const SCRUB = [PALETTE.reedGreen, PALETTE.palmFrond, PALETTE.reedGreen]

export function canyonDressing(): ClayPart[] {
  const parts: ClayPart[] = []

  // The shelf. Each band is a capsule-ended slab lying along X; the top one is given real depth in
  // Z so it reads as a SURFACE the animals stand on rather than as a line they stand behind.
  for (let i = 0; i < STRATA.length; i++) {
    const [cx, cy, r, len, color] = STRATA[i]
    parts.push(
      cyl(r, r, len, color, [cx, cy, 0], [0, 0, Math.PI / 2], [1, 1, i === 0 ? 1.7 : 0.85])
    )
  }

  // Erosion channels cut down across the bands — the vertical break that stops six horizontals
  // reading as a stack of pancakes.
  parts.push(
    cyl(0.02, 0.026, 0.46, PALETTE.earthDeep, [-0.4, -0.62, 0.06], [0, 0, 0.08]),
    cyl(0.018, 0.023, 0.4, PALETTE.earthDeep, [0.16, -0.56, 0.06], [0, 0, -0.06]),
    cyl(0.016, 0.021, 0.38, PALETTE.earthDeep, [0.5, -0.66, 0.05], [0, 0, 0.12])
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
    cyl(0.062, 0.07, 0.08, PALETTE.strataDust, [-0.542, 0.845, -0.21]),
    cyl(0.115, 0.128, 0.11, PALETTE.hoodooCap, [-0.55, 0.94, -0.21]),
    sph(0.1, PALETTE.hoodooCap, [-0.55, 1.0, -0.21], [1.35, 0.35, 1.0], 8)
  )

  // A short second stack at the inner end. It answers the tall spire across the composition, and
  // being stubby where the other is slender keeps them from reading as a repeated prop.
  for (const [rt, rb, h, y, color] of [
    [0.078, 0.095, 0.11, -0.18, PALETTE.hoodooRock],
    [0.058, 0.078, 0.1, -0.075, PALETTE.strataDust],
    [0.074, 0.058, 0.1, 0.025, PALETTE.rust],
    [0.05, 0.074, 0.09, 0.12, PALETTE.hoodooRock],
    [0.088, 0.062, 0.07, 0.2, PALETTE.hoodooCap],
  ] as const) {
    parts.push(cyl(rt, rb, h, color, [0.638, y, -0.16]))
  }

  // A flat-topped butte set deep behind everything: the one piece of RECESSION in a composition
  // that is otherwise all foreground, and what makes the shelf read as part of a gorge.
  parts.push(
    cyl(0.3, 0.36, 0.3, PALETTE.rust, [0.16, -0.175, -0.3], undefined, [1, 1, 0.24], 6),
    cyl(0.3, 0.3, 0.05, PALETTE.strataDust, [0.16, -0.005, -0.3], undefined, [1, 1, 0.24], 6),
    sph(0.15, PALETTE.earthDeep, [-0.1, -0.18, -0.29], [0.55, 1.5, 0.3], 8)
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

  // Loose stones, low-segment so they facet. Two are dropped onto the band below the shelf, which
  // is what tells the eye the lower bands are surfaces too and not a painted backdrop.
  parts.push(
    sph(0.08, PALETTE.stone, [0.34, -0.185, 0.2], [1.2, 0.82, 1], 7),
    sph(0.05, PALETTE.sinterDeep, [0.45, -0.205, 0.24], [1.1, 0.85, 1], 6),
    sph(0.09, PALETTE.hoodooRock, [-0.42, -0.18, 0.16], [1.15, 0.85, 1], 7),
    sph(0.052, PALETTE.stone, [-0.55, -0.205, 0.14], [1, 0.9, 1], 6),
    sph(0.07, PALETTE.hoodooRock, [0.3, -0.47, 0.16], [1.1, 0.9, 1], 7),
    sph(0.045, PALETTE.sinterDeep, [-0.24, -0.53, 0.14], undefined, 6),
    // wind-blown sand caught along the shelf — the warm note that keeps the corner from going
    // entirely to rock, and the tone that ties this biome to the desert chapter before it
    sph(0.22, PALETTE.goldSand, [-0.24, -0.2, 0.15], [1.4, 0.3, 0.55], 9),
    sph(0.15, PALETTE.dune, [0.36, -0.21, 0.16], [1.5, 0.28, 0.55], 8)
  )

  return parts
}

// --- pangolins --------------------------------------------------------------

/**
 * The three armour tones, deepest first. Cycling them is not decoration: at corner scale a single
 * brown carries no plate boundaries at all, and the R14 pangolin's whole failure was reading as
 * "a generic brown animal with a snout" once it unfurled. The tone step per plate IS the armour.
 */
const PLATE_TONES = [PALETTE.pangolinScaleDeep, PALETTE.pangolinScale, PALETTE.pangolinScaleLight]

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const REAR = new THREE.Vector3(-1, 0, 0)
const UP = new THREE.Vector3(0, 1, 0)
const _n = new THREE.Vector3()
const _t = new THREE.Vector3()
const _lift = new THREE.Vector3()

/**
 * One armour plate laid over the shell: a flattened disc pushed out along the surface normal and
 * then TILTED toward the tail, so its outer edge lifts clear of the ball the way a real pangolin's
 * scales overlap backward. Without that tilt the spiral reads as a spotted ball — the plates need
 * an edge catching the light to become plates.
 */
function armourPlate(nx: number, ny: number, nz: number, d: number, r: number, color: string): ClayPart {
  _n.set(nx, ny, nz)
  const axis = Math.abs(nx) > 0.92 ? UP : REAR
  _t.copy(axis).addScaledVector(_n, -axis.dot(_n)).normalize()
  _lift.copy(_n).addScaledVector(_t, 0.44).normalize()
  return {
    ...sph(r, color, [nx * d, ny * d, nz * d], [1.12, 0.3, 0.86], 10),
    rot: alignY(_lift),
  }
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
  /** Head geometry, about the neck joint. */
  skullAt: V3
  skullR: number
  snoutLen: number
  eyeR: number
}

/**
 * The two builds. The small one is not the big one scaled down — both are authored ~1 unit tall,
 * so it has to read as a JUVENILE instead: a rounder ball under fewer, chunkier plates, a bigger
 * skull, a bigger eye, a stubbier snout and a shorter tail.
 */
const BIG: Pangolin = {
  ball: 0.2,
  spiral: 24,
  plateLo: 0.098,
  plateHi: 0.158,
  // The neck joint sits a touch BEHIND the figure's centre. Not styling: the unfurl rotates the
  // whole head piece ~2.6 rad, so the forelimb sweeps through +X on the way out and the joint's
  // own offset is added to that whole arc. Pushing it forward is what breaks the inward clearance.
  neck: [-0.01, 0.3, 0.1],
  tailAt: [-0.185, -0.09, 0],
  tailLen: 1,
  skullAt: [0.13, 0.19, 0],
  skullR: 0.115,
  snoutLen: 0.25,
  eyeR: 0.048,
}

const SMALL: Pangolin = {
  ball: 0.182,
  spiral: 19,
  plateLo: 0.104,
  plateHi: 0.168,
  neck: [-0.01, 0.265, 0.1],
  tailAt: [-0.17, -0.085, 0],
  tailLen: 0.82,
  skullAt: [0.125, 0.175, 0],
  skullR: 0.125,
  snoutLen: 0.19,
  eyeR: 0.058,
}

/**
 * Slot 'c' — the SHELL, centred on the figure's origin because the arrival spins the whole rig
 * about it. Authored as a ball that plausibly stretches into a body, since the unfurl gesture
 * scales it (1+0.34u, 1−0.22u, 1−0.06u) rather than swapping geometry.
 *
 * The spiral covers the ball except two windows: the far side, which is never drawn, and the
 * lower front, where a real pangolin's soft unarmoured belly goes. Plates grow toward the spine
 * because the upper back is the SKYLINE — the arc the ink contour draws against the pale sky, and
 * the only stretch of armour guaranteed to be read from across the frame.
 */
function pangolinShell(p: Pangolin, d: 1 | -1): ClayPart[] {
  const parts: ClayPart[] = [
    sph(p.ball, PALETTE.pangolinScaleDeep, [0, 0, 0], undefined, 14),
    sph(
      p.ball * 0.7,
      PALETTE.dune,
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
    // Three tones cycle on the spiral index, biased by height: the spine gets mid-and-light, the
    // flank gets all three, the underside gets deep-and-mid. Cycling on the index alone strands a
    // bright plate on the belly — which reads as a hole in the armour rather than as a scale —
    // and leaves the spine no brighter than anywhere else, wasting the one arc drawn against sky.
    const band = ny > 0.25 ? 2 : ny > -0.3 ? 1 : 0
    const tone = Math.min(2, Math.max(0, band + ((i % 3) - 1)))
    parts.push(armourPlate(nx, ny, nz, dist, r, PLATE_TONES[tone]))
  }

  parts.push(
    // Hind legs, tucked at the ball's rear. They stay in the shell group so the unfurl squat
    // spreads them with the body — a pangolin coming out of a roll settles onto its haunches.
    sph(p.ball * 0.42, PALETTE.pangolinScale, [-p.ball * 0.3, -p.ball * 0.78, p.ball * 0.62], [1, 1.05, 0.95], 9),
    sph(p.ball * 0.3, PALETTE.pangolinScaleDeep, [-p.ball * 0.24, -p.ball * 1.24, p.ball * 0.78], [1.5, 0.62, 1.1], 8),
    cone(p.ball * 0.08, p.ball * 0.28, PALETTE.snow, [p.ball * 0.02, -p.ball * 1.4, p.ball * 0.95], [0, 0, -2.5], undefined, 5),
    sph(p.ball * 0.36, PALETTE.pangolinScaleDeep, [-p.ball * 0.58, -p.ball * 0.82, -p.ball * 0.3], [1, 1.05, 0.95], 8)
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
 */
function pangolinHead(p: Pangolin, d: 1 | -1): ClayPart[] {
  const [sx, sy] = p.skullAt
  return facing(d, [
    ...limb([[-0.01, -0.06, 0], [0.06, 0.07, 0], [sx - 0.01, sy - 0.02, 0]], 0.1, 0.085, PALETTE.pangolinScale),
    sph(p.skullR, PALETTE.pangolinScale, [sx, sy, 0], [1.0, 0.94, 0.95], 12),
    // the shade step: a shadowed cheek under the brow, carrying the volume the four-band toon
    // ramp flattens out of a smooth skull at this size
    sph(p.skullR * 0.81, PALETTE.pangolinScaleDeep, [sx - 0.015, sy - 0.055, 0.03], [1.1, 0.82, 0.95], 10),
    // Snout: one long wedge, and the whole silhouette read of the animal. The paler under-jaw
    // splits it lengthwise so it does not collapse into a single blunt cone.
    cone(0.078, p.snoutLen, PALETTE.pangolinScale, [sx + 0.107, sy - 0.1, 0], [0, 0, -1.72], [1, 1, 0.84]),
    cone(0.052, p.snoutLen * 0.8, PALETTE.dune, [sx + 0.102, sy - 0.14, 0.03], [0, 0, -1.64], [1, 1, 0.8]),
    sph(0.042, PALETTE.ink, [sx + 0.107 + p.snoutLen * 0.5, sy - 0.132, 0.005], [0.85, 1, 0.95], 8),
    ...eye([sx + 0.022, sy + 0.048, 0.098], p.eyeR, {
      sclera: PALETTE.snow,
      iris: PALETTE.ink,
      lid: PALETTE.pangolinScaleDeep,
      lidTilt: -0.25,
    }),
    sph(0.034, PALETTE.pangolinScaleDeep, [sx - 0.075, sy + 0.055, 0.06], [1, 1.35, 0.7], 8),
    // scaled crown — the armour runs onto the head, which is what a bare-skulled version loses
    { ...sph(0.078, PALETTE.pangolinScaleLight, [sx - 0.03, sy + 0.085, 0], [1.1, 0.3, 0.95], 8), rot: [0, 0, -0.3] as V3 },
    // Forelimb with the three digging claws a pangolin is built around, hung forward of the chest
    // in Z so it clears the stretched shell instead of sinking into it, and held just clear of the
    // rock — an animal still coming out of a roll has not put its front feet down yet, and a
    // raised paw is also the one pose where the claws are read rather than buried in the ledge.
    cyl(0.058, 0.072, 0.155, PALETTE.pangolinScale, [0.085, -0.185, 0.115], [0, 0, 0.18]),
    cyl(0.05, 0.058, 0.135, PALETTE.pangolinScaleDeep, [0.125, -0.315, 0.15], [0, 0, -0.2]),
    sph(0.06, PALETTE.pangolinScaleDeep, [0.15, -0.395, 0.165], [1.1, 0.85, 1.0], 9),
    cone(0.018, 0.1, PALETTE.snow, [0.2, -0.425, 0.185], [0, 0, -2.2], undefined, 5),
    cone(0.017, 0.09, PALETTE.snow, [0.19, -0.45, 0.145], [0, 0, -2.0], undefined, 5),
    cone(0.016, 0.085, PALETTE.snow, [0.18, -0.462, 0.19], [0, 0, -2.4], undefined, 5),
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
  [-0.045, 0.045, 0.1, 0.38, 2],
  [-0.145, -0.005, 0.09, 0.44, 1],
  [-0.235, -0.06, 0.08, 0.55, 2],
  [-0.3, -0.14, 0.068, 0.72, 1],
  [-0.325, -0.21, 0.052, 0.85, 0],
]

/**
 * Slot 'b' — the plated tail, authored about its root so the gesture can fold it over the ball
 * while rolled and let it trail out behind once parked. Its five plates are the largest single
 * pieces of armour on the figure: the tail is the part that stays clear of the shell in every
 * pose, so it is where the overlapping-plate read is cheapest to buy.
 */
function pangolinTail(p: Pangolin, d: 1 | -1): ClayPart[] {
  const k = p.tailLen
  const girth = 0.6 + 0.4 * k
  const pts = TAIL_PATH.map(([x, y, z]) => [x * k, y * k, z] as V3)
  return facing(d, [
    ...limb(pts, 0.088 * girth, 0.03 * girth, PALETTE.pangolinScaleDeep),
    ...TAIL_PLATES.map(([x, y, r, roll, tone]) => ({
      ...sph(r * girth, PLATE_TONES[tone], [x * k, y * k, 0], [1.15, 0.3, 0.9], 8),
      rot: [0, 0, roll] as V3,
    })),
  ])
}

export function canyonPieces(kind: 'pangolinBig' | 'pangolinSmall', dir: 1 | -1): PeekerPiece[] {
  const p = kind === 'pangolinBig' ? BIG : SMALL
  return [
    // 'c' is the whole-body deformer the unfurl stretches; 'a' and 'b' are its siblings, hinged at
    // joints that sit INSIDE the ball so both are hidden by the shell while the figure is rolled.
    { slot: 'c', at: [0, 0, 0], parts: pangolinShell(p, dir), ink: true },
    { slot: 'a', at: [p.neck[0] * dir, p.neck[1], p.neck[2]], parts: pangolinHead(p, dir), ink: true },
    { slot: 'b', at: [p.tailAt[0] * dir, p.tailAt[1], p.tailAt[2]], parts: pangolinTail(p, dir), ink: true },
  ]
}
