import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import {
  cone,
  cyl,
  eye,
  facing,
  leafFan,
  limb,
  rockBed,
  sph,
  strand,
  tufts,
  type V3,
} from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the DESERT checkpoint: a date palm rooted at the frame's outer edge, a cut sandstone
 * ledge running off that edge, and a camel with her calf leaning in over it.
 *
 * Follows the pattern the jungle set at the look-dev gate — one woody spine rising from the frame's
 * outer edge, a canopy arcing INWARD over the character, something cropping past the bottom edge,
 * and the animal staged in it rather than in front of it. What changes is the vocabulary: a palm
 * has few, huge, ARCHING fronds instead of a mass of broad leaves, and the ground is a quarried
 * shelf rather than a branch.
 *
 * VISIBLE BAND, which every position below is chosen against: the frame's outer edge is at local
 * x = −PEEKER_INSET_X (−0.64) and its bottom edge at y ≈ −0.92. The dressing deliberately crosses
 * both — that is what makes it read as a world continuing off-screen — but its MASS stays inside.
 *
 * WHAT THE COMPOSITION IS BUILT AROUND, in the order a reader takes it in:
 *
 *  1. THE HEAD WINS THE CORNER. The neck is the supporting line, not the subject: it is a soft
 *     capsule chain through a curved centreline (see `neckRun`), roughly half the width the head
 *     is tall, and the shelf crops it early. An earlier pass drew it as a straight tapered beam of
 *     cylinders, which the toon ramp turned into jointed timber with more presence than the face.
 *  2. THE CROWN IS CLEAR OF THE SKULL. Pushed OUT and DOWN — outboard of the neck, well below the
 *     eye line — with fronds that ARC rather than radiate, so they climb nearly vertically out of
 *     the crown and only turn inward once they are over the head. The band of open sky between the
 *     head's silhouette and the nearest blade is the whole fix; without it she wears a headdress.
 *  3. THE LEDGE IS A SHELF, NOT A CONTAINER — and it is ROCK, not joinery. A level top line, a face
 *     that falls away below it, and nothing curling back toward the viewer: as a closed box with a
 *     lip all round it read as a trough she stood in, and as constant-section slabs it read as
 *     stacked planks. It is built from irregular lozenges now (see `LEDGE`), the same rebuild that
 *     took the canyon's strata off a wooden crate.
 *  4. THE TWO ANIMALS ARE DIFFERENT DRAWINGS. Same vocabulary, different pose — see `CALF`.
 */

// --- the palm ---------------------------------------------------------------

/** The bole, leaning OUT as it rises: that lean is what carries the crown away from the skull. */
const TRUNK: readonly V3[] = [
  [-0.42, -1.14, -0.20],
  [-0.46, -0.70, -0.20],
  [-0.50, -0.28, -0.19],
  [-0.525, 0.06, -0.18],
  [-0.53, 0.30, -0.18],
]

const FROND_LIT = [PALETTE.palmFrond, PALETTE.reedGreen] as const
const FROND_MID = [PALETTE.palmFrond, PALETTE.palmFrondDeep] as const
const FROND_FAR = [PALETTE.palmFrondDeep, PALETTE.palmFrond] as const
const FROND_DRY = [PALETTE.dune, PALETTE.goldSand] as const

/** How far the leaflets sweep back from the rachis. Perpendicular pairs read as a fish skeleton. */
const LEAFLET_SWEEP = 0.75
const FROND_NODES = 4

/**
 * One frond, built as an ARC rather than a fan.
 *
 * A date palm's frond leaves the crown almost vertical and falls over as it runs out of stiffness,
 * and that curve is the whole reason the canopy can sit out at the frame's edge and still reach
 * across the top of the picture: a straight fan aimed at the same place would have to pass through
 * the camel's skull to get there. The rachis is integrated between the launch angle `a0` and the
 * tip angle `a1`, so the bend is continuous rather than a kink.
 *
 * The pale straw rachis is the other half of the read. `leaf`'s dark mid-rib is tuned for a broad
 * jungle leaf, whereas a date palm's spine is bleached LIGHTER than its leaflets, so the spine is a
 * `dune` limb and the leaflets carry no rib at all.
 */
function frond(
  root: V3,
  a0: number,
  a1: number,
  len: number,
  leaflet: number,
  colors: readonly string[]
): ClayPart[] {
  const step = len / FROND_NODES
  const nodes: V3[] = [root]
  let x = root[0]
  let y = root[1]
  for (let i = 0; i < FROND_NODES; i++) {
    const a = a0 + ((a1 - a0) * i) / FROND_NODES
    x += Math.cos(a) * step
    y += Math.sin(a) * step
    // each node creeps a hair toward the camera so the blades never z-fight with their own spine
    nodes.push([x, y, root[2] + (i + 1) * 0.005])
  }
  const parts = limb(nodes, 0.026, 0.007, PALETTE.dune, 5)
  for (let i = 1; i <= FROND_NODES; i++) {
    // the tangent of the segment that ARRIVES at this node, so a pair sits square to the spine
    const t = a0 + ((a1 - a0) * (i - 0.5)) / FROND_NODES
    // real leaflets shorten toward the tip, and here that also opens the sky gap over the head
    const l = leaflet * (1.05 - 0.5 * (i / FROND_NODES))
    // wide = 0.18 turns `leaf`'s broad teardrop into a long blade, which is the leaflet shape
    parts.push(...leafFan(nodes[i], 2, l, [t + LEAFLET_SWEEP, t - LEAFLET_SWEEP], colors, undefined, 0.18))
  }
  return parts
}

// --- the ledge --------------------------------------------------------------

/**
 * Top of the shelf. Everything that stands on the stone is placed against this one number, and so
 * is everything BEHIND it: the shelf is what crops the camel's neck, so its height sets how much
 * neck is on screen at all. Raised from −0.62 for exactly that reason.
 */
const LEDGE_TOP = -0.54

/**
 * The shelf's top course and the beds under it, as `[x, y, halfHeight, halfLength, dip, colour]` —
 * the canyon's strata vocabulary, brought across because the desert had the canyon's exact defect.
 *
 * Both corners were first drawn as constant-section slabs: two straight parallel edges, a butt
 * joint at each end and one dark bedding line ruled across the face. That is how DECKING is drawn,
 * and both read as it — the canyon as a wooden crate, this as a stack of planks. Rock is irregular
 * along its length, so each course here is a run of lozenges with no two sharing a thickness, a dip
 * or an end, and the courses below the shelf each stop at a different x so the stack falls away
 * toward the frame's outer corner instead of walling it.
 *
 * What does NOT vary is the shelf's TOP: every top-course lozenge is seated at `LEDGE_TOP − hy`, so
 * the line the camel is cropped against and the props are seated on stays level. All of the
 * irregularity is spent on the underside, which is the edge the eye actually reads.
 */
const LEDGE: readonly (readonly [number, number, number, number, number, string])[] = [
  // the outer lozenge's run is set by DRESS_REACH.out, not by taste: it is the piece of the corner
  // that reaches furthest toward the frame edge
  [-0.545, LEDGE_TOP - 0.058, 0.058, 0.13, 0.05, PALETTE.sinter],
  [-0.35, LEDGE_TOP - 0.075, 0.075, 0.155, -0.03, PALETTE.sinterDeep],
  [-0.11, LEDGE_TOP - 0.086, 0.086, 0.175, 0.03, PALETTE.sinter],
  [0.13, LEDGE_TOP - 0.066, 0.066, 0.15, -0.05, PALETTE.stone],
  [0.36, LEDGE_TOP - 0.08, 0.08, 0.165, 0.04, PALETTE.dune],
  [0.58, LEDGE_TOP - 0.052, 0.052, 0.13, -0.06, PALETTE.sinterDeep],
]

/**
 * The bands cut into the shelf's FACE, laid on the shelf body as relief rather than stacked as free
 * masses. That distinction is the whole difference between rock and rubble: the ink contour traces
 * whatever the outermost primitive is, so a course of lozenges with sky between them is drawn as a
 * row of separately outlined pebbles. Sat on a continuous body they are bedding planes on one wall.
 */
const LEDGE_BEDS: readonly (readonly [number, number, number, number, number, string])[] = [
  [-0.5, -0.712, 0.055, 0.17, -0.04, PALETTE.stone],
  [-0.2, -0.735, 0.07, 0.18, 0.04, PALETTE.sinterDeep],
  [0.13, -0.716, 0.05, 0.16, -0.05, PALETTE.dune],
  [0.42, -0.726, 0.06, 0.16, 0.05, PALETTE.stone],

  [-0.48, -0.858, 0.062, 0.175, 0.05, PALETTE.sinterDeep],
  // the one pale mineral band, low and well clear of the animal
  [-0.14, -0.875, 0.05, 0.155, -0.03, PALETTE.goldSand],
  [0.2, -0.855, 0.065, 0.185, 0.04, PALETTE.stone],

  [-0.42, -0.998, 0.07, 0.185, -0.04, PALETTE.sinterDeep],
  [-0.02, -1.012, 0.055, 0.17, 0.03, PALETTE.stone],
]

export function desertDressing(): ClayPart[] {
  const parts: ClayPart[] = [
    ...limb(TRUNK, 0.085, 0.062, PALETTE.palmTrunk),
    // A palm trunk is a stack of old leaf scars, not a smooth pole. Three proud collars are what
    // stop it reading as a length of dowel once the toon ramp has flattened its shading.
    cyl(0.094, 0.094, 0.05, PALETTE.stone, [-0.475, -0.52, -0.195], [0, 0, 0.09], [1, 1, 0.85], 7),
    cyl(0.088, 0.088, 0.046, PALETTE.stone, [-0.505, -0.14, -0.19], [0, 0, 0.07], [1, 1, 0.85], 7),
    cyl(0.08, 0.08, 0.044, PALETTE.stone, [-0.525, 0.14, -0.185], [0, 0, 0.04], [1, 1, 0.85], 7),
    // the fibrous crownshaft every frond and date stalk springs from
    sph(0.088, PALETTE.palmTrunk, [-0.53, 0.31, -0.18], [1, 0.95, 0.9], 8),
    sph(0.062, PALETTE.dune, [-0.5, 0.345, -0.12], [1.15, 0.8, 0.85], 8),
  ]

  // The canopy. Every frond springs from within 0.1 of the crownshaft — a palm's fronds all radiate
  // from one growing point, and a blade floated off it reads as a loose branch rather than as the
  // tree. Three climb and arch INWARD across the top of the frame; two hang as the dead skirt a
  // date palm always carries below its live crown, which is the tone break that keeps the canopy
  // from being one flat green wedge and reads pure desert rather than transplanted jungle.
  parts.push(
    ...frond([-0.5, 0.34, -0.08], 1.53, 0.16, 0.86, 0.2, FROND_LIT),
    ...frond([-0.515, 0.36, -0.15], 1.52, 0.0, 0.88, 0.19, FROND_MID),
    ...frond([-0.525, 0.3, -0.22], 1.66, 0.68, 0.72, 0.17, FROND_FAR),
    ...frond([-0.49, 0.27, -0.2], 4.45, 4.85, 0.44, 0.13, FROND_DRY),
    ...frond([-0.44, 0.24, 0.03], 4.15, 4.72, 0.38, 0.12, FROND_DRY)
  )

  // ONE date bunch, hung under the crown on a stalk that starts at the crownshaft itself.
  //
  // Dates hang as a splayed head of many short strands off one thick stem, and drawing that shape
  // is the difference between fruit and a fault: a single vertical bead chain with a pale bead at
  // the bottom — which is what an earlier pass drew — reads as a plumb-bob on a string, or worse as
  // something falling. So there are three strands leaning APART, two loose fruit filling the gaps
  // between them, and no tapering tip at all.
  parts.push(
    ...limb([[-0.525, 0.29, -0.07], [-0.475, 0.215, -0.055], [-0.435, 0.155, -0.04]], 0.024, 0.013, PALETTE.dune, 6),
    ...strand([-0.475, 0.125, -0.05], 3, 0.05, 0.032, PALETTE.rust, -0.024, 0.96),
    ...strand([-0.43, 0.115, -0.02], 3, 0.052, 0.034, PALETTE.rust, 0.004, 0.96),
    ...strand([-0.39, 0.135, 0.015], 3, 0.048, 0.03, PALETTE.clayPath, 0.026, 0.96),
    sph(0.031, PALETTE.rust, [-0.445, 0.075, -0.005], [1, 1.1, 0.85], 8),
    sph(0.028, PALETTE.clayPath, [-0.415, 0.04, 0.005], [1, 1.1, 0.85], 8)
  )

  // The ledge: a shelf, not a container. It runs off the outer edge, crops past the bottom of the
  // frame, and crumbles away at its inner end — the camel stands BEHIND it, so it is also what
  // crops her neck and hides her shoulder.
  //
  // The shelf's BODY: one continuous mass carrying the whole face, so the courses below the
  // caprock are relief on a wall rather than a row of loose stones with sky between them.
  // its reach is bounded on three sides at once: DRESS_REACH.out on the left and the bottom of the
  // dressing envelope below, both with the ink hull's own 0.012 on top
  parts.push(sph(0.34, PALETTE.sinterDeep, [-0.05, -0.865, 0.02], [1.85, 0.92, 0.42], 12))

  // The top course is given real depth in Z and pushed forward, because it is a SURFACE: the drift,
  // the grass and the camel's own crop line are all seated on it. It also stands PROUD of the body
  // in Z, so the caprock overhangs the beds the way a resistant bed does.
  for (const spec of LEDGE) parts.push(rockBed(spec, 0.26, 0.1))
  for (const spec of LEDGE_BEDS) parts.push(rockBed(spec, 0.05, 0.2))

  // Two fallen stones where the shelf breaks up at its inner end — the same job the canyon's talus
  // does: a bare cut edge reads as a slice, stone along it reads as a slope.
  parts.push(
    sph(0.075, PALETTE.stone, [0.6, -0.73, 0.24], [1.25, 0.82, 0.9], 7),
    sph(0.055, PALETTE.sinter, [0.46, -0.83, 0.22], [1.2, 0.85, 0.9], 6)
  )

  // Sand drifted ONTO the shelf and spilling over its front lip — the one thing allowed to break
  // the straight top line, and what stops the stone reading as a bare pedestal.
  parts.push(
    sph(0.24, PALETTE.goldSand, [-0.3, LEDGE_TOP - 0.005, 0.22], [1.3, 0.22, 0.5], 10),
    sph(0.18, PALETTE.sand, [0.06, LEDGE_TOP + 0.005, 0.24], [1.4, 0.2, 0.45], 10),
    // the tongue of sand that has already gone over the lip: wide and shallow, because a round
    // lump on the face of the shelf reads as something stuck to the stone rather than as spill
    sph(0.13, PALETTE.goldSand, [-0.24, LEDGE_TOP - 0.075, 0.3], [1.7, 0.5, 0.28], 8)
  )

  // Dry grass rooted in the drift. `tufts` defaults to a short shaggy fringe; at len ≈ 2 the cones
  // become blades long enough to break the shelf's top line, which is the only thing that line needs.
  parts.push(
    ...tufts([-0.4, LEDGE_TOP + 0.02, 0.24], 0.085, 3, PALETTE.reedGreen, 0.18, 0.82, 1.9),
    ...tufts([0.14, LEDGE_TOP + 0.02, 0.26], 0.075, 3, PALETTE.goldSand, 0.14, 0.86, 2.0)
  )

  return parts
}

// --- the camels -------------------------------------------------------------

/**
 * Everything in the head cluster is placed about this point — the base of the muzzle. Working about
 * the muzzle rather than the eyeline is what lets a head be tilted or resized without driving the
 * lip further into the middle of the screen, which is the wall MASCOT_BOX puts up first.
 */
const HEAD_PIVOT: V3 = [0.3, 0.3, 0]
/** The jaw hinge, at the back of the skull; the jaw's own parts are authored about it. */
const JAW_HINGE: V3 = [-0.02, 0.4, 0]
/** Where the neck meets the underside of the skull. Carried through the head's pose with it. */
const THROAT: V3 = [-0.06, 0.34, -0.02]

const ORIGIN: V3 = [0, 0, 0]

/**
 * One camel's drawing. The two animals share a vocabulary and nothing else: shrinking one build and
 * mirroring it gives a pair that reads as one asset used twice, which is the single loudest tell
 * that a corner was assembled rather than drawn. So a pose carries its own head angle, its own
 * muzzle proportions, its own ear attitude and its own neck curve.
 */
type CamelPose = {
  /** Rotation of the whole head cluster about `HEAD_PIVOT` — the head's ANGLE, not its place. */
  tilt: number
  /** Size of the head cluster about `HEAD_PIVOT`. */
  scale: number
  /** The muzzle chain: how far out along the wedge the bridge, the nose block and the lip sit. */
  bridgeX: number
  noseX: number
  lipX: number
  noseR: number
  /** Eye radius, which is NOT proportional to the head — see `CALF`. */
  eyeR: number
  /** Near and far ear, and the roll that splays them off the skull. */
  earAt: readonly [V3, V3]
  earSplay: number
  /** Forelock count and length, in `tufts` units. */
  lock: readonly [number, number]
  /** Neck centreline, BASE first. The throat node is appended from the head's own pose. */
  neck: readonly V3[]
  /** Neck radius at the cropped base and at the throat. */
  neckR: readonly [number, number]
  /** How many tufts break the front line of the neck. */
  fringe: number
}

const ADULT: CamelPose = {
  tilt: 0,
  // Big: the head has to out-weigh the neck, and it is the head that carries every feature worth
  // looking at. Bounded by MASCOT_BOX's inward wall, which the lip sits closest to.
  scale: 1.12,
  bridgeX: 0.215,
  noseX: 0.3,
  lipX: 0.33,
  noseR: 0.112,
  eyeR: 0.062,
  earAt: [
    [-0.05, 0.68, 0.07],
    [-0.13, 0.655, -0.1],
  ],
  earSplay: 0.1,
  lock: [3, 0.6],
  // A long S: it leaves the throat almost upright, sweeps BACK through the middle of its run and
  // straightens again into the shoulder. Held to a third of the neck's own width — a bigger bow
  // reads as a swan, and none at all is the tapered beam this replaces.
  neck: [
    [-0.44, -0.68, -0.18],
    [-0.405, -0.44, -0.16],
    [-0.315, -0.19, -0.13],
    [-0.19, 0.02, -0.09],
    [-0.122, 0.19, -0.05],
  ],
  neckR: [0.086, 0.048],
  fringe: 3,
}

/** Uniformly scale a part list about a pivot. */
function scaledAbout(pivot: V3, s: number, parts: ClayPart[]): ClayPart[] {
  if (s === 1) return parts
  return parts.map((p) => ({
    ...p,
    pos: [
      pivot[0] + ((p.pos?.[0] ?? 0) - pivot[0]) * s,
      pivot[1] + ((p.pos?.[1] ?? 0) - pivot[1]) * s,
      pivot[2] + ((p.pos?.[2] ?? 0) - pivot[2]) * s,
    ] as V3,
    scl: [(p.scl?.[0] ?? 1) * s, (p.scl?.[1] ?? 1) * s, (p.scl?.[2] ?? 1) * s] as V3,
  }))
}

/**
 * Rotate a part list in the screen plane about a pivot. Every part in the head cluster is authored
 * with a Z-only rotation, so turning the group is exactly a rotation of each position plus an
 * addition on each part's own roll — no Euler composition to get wrong.
 */
function rotatedAbout(pivot: V3, a: number, parts: ClayPart[]): ClayPart[] {
  if (a === 0) return parts
  const c = Math.cos(a)
  const s = Math.sin(a)
  return parts.map((p) => {
    const dx = (p.pos?.[0] ?? 0) - pivot[0]
    const dy = (p.pos?.[1] ?? 0) - pivot[1]
    return {
      ...p,
      pos: [pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c, p.pos?.[2] ?? 0] as V3,
      rot: [p.rot?.[0] ?? 0, p.rot?.[1] ?? 0, (p.rot?.[2] ?? 0) + a] as V3,
    }
  })
}

/** A point carried through a head's pose — used for the jaw hinge and the throat. */
function posedPoint(pose: CamelPose, p: V3): V3 {
  const c = Math.cos(pose.tilt)
  const s = Math.sin(pose.tilt)
  const dx = p[0] - HEAD_PIVOT[0]
  const dy = p[1] - HEAD_PIVOT[1]
  return [
    HEAD_PIVOT[0] + (dx * c - dy * s) * pose.scale,
    HEAD_PIVOT[1] + (dx * s + dy * c) * pose.scale,
    p[2] * pose.scale,
  ]
}

/**
 * The neck, as a CAPSULE chain rather than a chain of cylinders.
 *
 * `limb` alone leaves a crease at every bend, and the four-band ramp draws that crease as a hard
 * line across the neck — a seam, which on a tapered run reads as a joint in a piece of timber. A
 * bead of exactly the joint's radius fills the crease, so a bent run is one continuous soft mass
 * with no line anywhere on it. The radius runs the animal's way too, THICKENING toward the base:
 * a neck that narrows as it descends is a pole, not something that arrives in a body.
 */
function neckRun(nodes: readonly V3[], rBase: number, rTop: number): ClayPart[] {
  const out = limb(nodes, rBase, rTop, PALETTE.camelHide, 10)
  for (let i = 1; i < nodes.length - 1; i++) {
    out.push(sph(rBase + (rTop - rBase) * (i / (nodes.length - 1)), PALETTE.camelHide, nodes[i], undefined, 10))
  }
  return out
}

/**
 * The whole neck: the run, a shaded block along its outer edge, a shaggy fringe down its throat and
 * the top of the shoulder it arrives in.
 *
 * The fringe is draughtsmanship rather than detail. A smooth tapered tube has one clean edge on each
 * side whatever it is coloured, and clean parallel edges are what make a shape read as milled; the
 * broken hair line down the front is the cheapest thing that says the mass is an animal.
 */
function camelNeck(pose: CamelPose): ClayPart[] {
  const nodes: V3[] = [...pose.neck, posedPoint(pose, THROAT)]
  const parts = neckRun(nodes, pose.neckR[0], pose.neckR[1])
  // sample the run's own centreline for the trim, so both follow the curve rather than a guess
  const at = (f: number): V3 => {
    const i = Math.min(nodes.length - 2, Math.floor(f * (nodes.length - 1)))
    const t = f * (nodes.length - 1) - i
    const a = nodes[i]
    const b = nodes[i + 1]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  }
  const rAt = (f: number): number => pose.neckR[0] + (pose.neckR[1] - pose.neckR[0]) * f
  // Shade down the OUTER side, kept a hair inside the run's own radius: a block that oversteps the
  // silhouette reads as a splinter off the edge rather than as the round of the neck turning away.
  for (const f of [0.42, 0.68]) {
    const c = at(f)
    parts.push(
      sph(rAt(f) * 0.6, PALETTE.camelShade, [c[0] - rAt(f) * 0.3, c[1], c[2] + 0.025], [1, 2.2, 0.55], 8)
    )
  }
  for (let i = 0; i < pose.fringe; i++) {
    const f = 0.5 + 0.16 * i
    const c = at(f)
    parts.push(
      cone(
        rAt(f) * 0.62,
        0.1 + 0.02 * (i % 2),
        PALETTE.camelHideDeep,
        [c[0] + rAt(f) * 0.66, c[1] - 0.03, c[2] + 0.045],
        [0, 0, 3.42 + 0.12 * (i % 2)],
        [1, 1, 0.6],
        6
      )
    )
  }
  // the top of the shoulder, kept small and low: the shelf covers it, and it exists so the neck
  // ends in a body rather than in an open tube if a viewport ever crops differently
  parts.push(sph(0.1, PALETTE.camelHideDeep, [pose.neck[0][0] + 0.005, pose.neck[0][1] - 0.04, -0.19], [1.1, 0.9, 0.85], 8))
  return parts
}

/**
 * Four long lashes off the upper lid, splayed forward along the lid arc.
 *
 * These are not decoration: a camel's eye is the one feature a viewer names it by, and at 300px the
 * ink contour plus a lash fan is what carries it. Placed on the arc rather than parallel so they
 * splay the way real lashes do — four parallel spikes read as a comb.
 */
function lashes(at: V3, r: number): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < 4; i++) {
    const a = 0.35 + i * 0.34
    out.push(
      cone(
        r * 0.13,
        r * 1.0,
        PALETTE.ink,
        [at[0] + Math.cos(a) * r * 1.55, at[1] + Math.sin(a) * r * 1.55, at[2] + 0.012],
        [0, 0, a - Math.PI / 2],
        [1, 1, 0.5],
        5
      )
    )
  }
  return out
}

/**
 * One ear: a stubby lobe with a shaded inner face, rolled by `a` off the skull. A camel's ears are
 * short — anything taller reads as a donkey — so the ATTITUDE is all the character they carry.
 */
function ear(at: V3, r: number, a: number): ClayPart[] {
  const roll: V3 = [0, 0, a]
  return [
    { ...sph(r, PALETTE.camelHide, at, [0.75, 1.5, 0.55], 8), rot: roll },
    {
      ...sph(r * 0.58, PALETTE.camelShade, [at[0] + 0.008, at[1] - 0.004, at[2] + 0.03], [0.7, 1.4, 0.5], 6),
      rot: roll,
    },
  ]
}

/**
 * The head. A camel is a LONG wedge — a small cranium set well back, a straight bridge, and a
 * nose block hung off the end — so it is built as a chain of four masses rather than a ball with a
 * snout, which is the shape that made the R14 pass read as a llama.
 */
function camelHead(pose: CamelPose): ClayPart[] {
  const { bridgeX, noseX, lipX, eyeR } = pose
  const eyeAt: V3 = [0.13, 0.545, 0.155]
  const [nearEar, farEar] = pose.earAt
  return [
    sph(0.185, PALETTE.camelHide, [0.005, 0.52, 0], [1.02, 0.94, 0.94], 14),
    sph(0.165, PALETTE.camelHide, [0.11, 0.42, 0.01], [1.05, 0.92, 0.92], 12),
    sph(0.135, PALETTE.camelHide, [bridgeX, 0.345, 0.02], [1.12, 0.86, 0.9], 12),
    sph(pose.noseR, PALETTE.camelHideDeep, [noseX, 0.265, 0.02], [1.02, 0.98, 0.92], 12),
    sph(0.082, PALETTE.camelHideDeep, [lipX, 0.17, 0.03], [0.95, 1.1, 0.88], 10),
    // the split in the upper lip, which is the detail that says camel rather than horse
    cyl(0.011, 0.011, 0.085, PALETTE.ink, [lipX + 0.04, 0.16, 0.07], [0, 0, 0.16], undefined, 6),
    // slit nostril, laid at the angle the real one runs rather than punched as a round hole
    cyl(0.016, 0.016, 0.07, PALETTE.ink, [noseX + 0.05, 0.29, 0.09], [0, 0, -0.55], undefined, 6),
    // SHADE step under the jowl — volume the toon ramp no longer supplies at this size
    sph(0.115, PALETTE.camelShade, [0.11, 0.31, 0.05], [1.25, 0.62, 0.55], 10),
    sph(0.072, PALETTE.camelHideDeep, [0.11, 0.625, 0.1], [1.35, 0.5, 0.7], 8),
    // The throat, swallowing the joint where the neck arrives. Without it the skull ends in a hard
    // edge and the neck butts against it, which is the silhouette of a post carrying a head.
    sph(0.1, PALETTE.camelHide, [-0.045, 0.375, -0.01], [1, 0.92, 0.85], 10),
    ...eye(eyeAt, eyeR, {
      sclera: PALETTE.snow,
      iris: PALETTE.ink,
      lid: PALETTE.camelHideDeep,
      lidTilt: -0.22,
    }),
    ...lashes(eyeAt, eyeR),
    // The pair splays in OPPOSITE directions, so a splayed head reads as two ears going their own
    // way rather than as one pair tipped over — which is the tell of a young animal not listening.
    ...ear(nearEar, 0.052, pose.earSplay),
    ...ear(farEar, 0.05, -pose.earSplay * 0.7),
    // Forelock. It and the ears are the tallest things on the animal, so they are what the canopy
    // overhead is cleared against — hence a lock that sits low on the poll rather than plumed.
    ...tufts([0.01, 0.63, 0.06], 0.1, pose.lock[0], PALETTE.camelHideDeep, 0.2, 0.8, pose.lock[1]),
  ]
}

/**
 * The halter: a broad leather noseband PLATE lying across the muzzle, a short cheekpiece stub
 * angling back off it, and a small dark keeper at the junction. Worked stock only: the calf runs
 * bare (it wears a collar instead — see `calfCord`).
 *
 * THIS IS THE CIGARETTE FIX. The previous halter was a straight `camelSaddle` bar laid across the
 * muzzle with a `honey` bead at its outer end, and a thin cheekpiece pushed so far into +Z that the
 * skull swallowed it. What survived to the screen was therefore one warm-red horizontal stroke with
 * a bright yellow tip, sitting at the corner of a mouth: a lit cigarette, and the single loudest
 * misread left in the set. Three things change.
 *
 *  1. COLOUR. Leather is cool and low-chroma (`tackLeather`) where camelSaddle is a terracotta only
 *     a shade off the hide's own family. A cool strap on a warm animal is worked stock; a warm one
 *     is a marking. The brass is gone entirely — nothing on this animal is allowed to be a small
 *     bright spot at the end of a bar.
 *  2. AREA, NOT SHAPE. The band is a wide flat plate with a dark rim: a squashed ellipsoid rolled
 *     square to the muzzle, not a strap of any kind. See the comment on the cuff below for why the
 *     obvious fix does not work — a band that WRAPS the muzzle projects to a line from this camera,
 *     and a line laid across a mouth is a stick whatever colour it is painted.
 *  3. THE CHEEKPIECE IS SHORT, AND THAT IS THE POINT. It is thicker than the old one so it draws at
 *     all, but it runs only about 0.17 before tucking BEHIND the cheek in Z, where the skull hides
 *     it. A halter needs the second strap to exist and to leave at an angle; drawn long it lines up
 *     with the noseband in projection and the two together redraw the stick.
 *
 * TWO ATTEMPTS ARE RECORDED IN THE COMMENTS BELOW rather than deleted — the arc that reads as a
 * twig, and the pair of edge lines that spike the silhouette. Both were built, captured and thrown
 * away; without the note the first instruction this docblock gives the next author is to build them
 * again. (Same reason as the interior-fur note in `peeker-winter.tsx`.)
 */
function halter(pose: CamelPose): ClayPart[] {
  // The muzzle's run, and the perpendicular the band is authored about. Derived from the pose's own
  // muzzle chain so a re-proportioned head carries its tack with it rather than shedding it.
  const axX = pose.lipX - 0.11
  const axY = 0.17 - 0.42
  const axLen = Math.hypot(axX, axY)
  const ux = -axY / axLen
  const uy = axX / axLen
  const cx = (pose.bridgeX + pose.noseX) / 2
  const cy = 0.305

  /**
   * A point on the muzzle's own cross-section: `a` radians round it, where 0 is the top of the
   * bridge and π/2 faces the camera, at radius `r` and slid `back` along the muzzle. It survives
   * from the arc attempt (see the docblock) and now just seats two pieces on the surface — the
   * cheekpiece's root and the keeper.
   *
   * `r` has to be the muzzle's half-width at that station. Anything wider stands off the solid at
   * both ends, and a strap standing off a muzzle at both ends is a ROD passing through the animal's
   * head, which is what the first attempt at this drew.
   */
  const at = (a: number, r: number, back: number): V3 => {
    const along = r * Math.cos(a)
    return [
      cx + ux * along - (axX / axLen) * back,
      cy + uy * along - (axY / axLen) * back,
      // the muzzle is flatter than it is tall, so its section is an ellipse, not a circle
      r * Math.sin(a) * 0.82,
    ]
  }
  const roll: V3 = [0, 0, Math.atan2(axY, axX)]

  return [
    // The noseband, as a broad CUFF rather than a strap.
    //
    // This is the second thing the muzzle's geometry forces, after the radius. The band's plane is
    // square to the muzzle, and the muzzle runs across the SCREEN — so that plane is nearly edge-on
    // to the camera and a wrap of any radius projects to a line. A thin line laid across a mouth is
    // a stick whatever colour it is painted, and drawn as a thin wrap this halter read as one. A
    // camel's nosepiece is a wide flat plate of leather; drawn at its real width it projects as a
    // BAND with area, which is a thing lying on the muzzle rather than a thing crossing it.
    {
      ...sph(0.145, PALETTE.tackLeather, [cx, cy, 0], [0.4, 1, 0.9], 12),
      rot: roll,
    },
    // The band's own dark rim, set a hair behind it so it shows all round the plate rather than
    // only at its ends — the pangolin's seam disc, borrowed. Drawn as two edge lines instead, the
    // arcs ran past the plate at both poles and put a spike on the muzzle's silhouette.
    {
      ...sph(0.153, PALETTE.tackLeatherDeep, [cx, cy, -0.012], [0.46, 1, 0.88], 12),
      rot: roll,
    },
    // The cheekpiece: a SHORT stub climbing off the band's upper-rear corner and tucking in behind
    // the cheek, where the skull swallows it. Short on purpose — the previous one ran the width of
    // the face and lined up with the band in projection, so the two together drew one long straight
    // stroke from the eye to the mouth, which is the stick read this fix exists to remove. A halter
    // needs the second strap to exist and to leave at an angle; it does not need to be followed.
    ...limb(
      [at(0.5, 0.142, -0.04), [0.28, 0.44, 0.1], [0.225, 0.5, 0.02]],
      0.032,
      0.026,
      PALETTE.tackLeather,
      7
    ),
    // the keeper: dark, flat and small, on the band's near face, where the old brass ring was
    // bright, round and at the muzzle's end
    sph(0.028, PALETTE.tackLeatherDeep, at(1.35, 0.15, -0.012), [1, 1.2, 0.5], 8),
  ]
}

/**
 * The lower jaw, authored about its hinge. The rig yaws AND rolls this piece, so it swings sideways
 * as well as down — a camel grinds side to side, and a straight hinge reads as a nutcracker.
 */
function camelJaw(pose: CamelPose): ClayPart[] {
  // the jaw follows the muzzle it closes against, so the calf's is short with a round chin
  const short = pose.lipX - ADULT.lipX
  return [
    sph(0.115, PALETTE.camelHide, [0.14, -0.055, 0], [1.4, 0.78, 0.9], 12),
    sph(0.088, PALETTE.camelHideDeep, [0.3 + short, -0.135, 0.01], [1.15, 0.88, 0.9], 10),
    sph(0.062, PALETTE.camelShade, [0.36 + short, -0.145, 0.03], [1, 0.95, 0.85], 10),
    sph(0.1, PALETTE.camelShade, [0.06, -0.135, -0.01], [1.35, 0.6, 0.8], 10),
    // one lower tooth showing at the corner — the camel's own smug little underbite
    sph(0.024, PALETTE.snow, [0.33 + short, -0.07, 0.05], [1, 1.3, 0.8], 6),
    cone(0.03, 0.11, PALETTE.camelHideDeep, [0.08, -0.155, 0.03], [0, 0, 0.18], [1, 1, 0.7], 6),
    cone(0.026, 0.095, PALETTE.camelHideDeep, [0.17, -0.175, 0.03], [0, 0, 0.05], [1, 1, 0.7], 6),
    cone(0.022, 0.08, PALETTE.camelHideDeep, [0.25 + short, -0.185, 0.02], [0, 0, -0.1], [1, 1, 0.7], 6),
  ]
}

// --- the fennec fox ---------------------------------------------------------

/**
 * Task 61 — the camel calf is replaced by a FENNEC FOX. Aram: "in desert biome it can be a camel
 * and a fennec fox."
 *
 * THE EARS ARE THE SILHOUETTE. That is the brief's own phrase and it is the entire design: the ears
 * are as tall as the skull and nearly as wide, they stand clear enough that sky shows between them,
 * and everything else on the animal — a small pointed muzzle, a big dark eye, a compact seated body
 * — is drawn subordinate to them. If the outline alone does not name the animal, the figure has
 * failed, and on a fennec the outline is two enormous parabolas over a small round head.
 *
 * SCALE IS A PROPORTION, NOT A SIZE. A fennec is a tiny animal and the contrast with the camel is
 * the charm, but the figure still has to FILL its corner box — a small animal drawn small in a big
 * frame just reads as a distant one. So this is a portrait: the fox occupies the same box the calf
 * did, and the "tiny" read is carried by proportion (ears bigger than the head, eye bigger than the
 * muzzle, paws small and neat) rather than by scale against its neighbour.
 *
 * IT WEARS NOTHING. The camel is a worked animal and wears a halter; the calf wore a collar. A
 * fennec is wild. That also keeps the corner clear of the family of defects the tack has already
 * produced twice — a warm band with a bright bead on it, at the corner of a mouth or across a
 * throat, read as a lit cigarette and then as a painted stripe.
 */

/**
 * The fox sits ON the shelf. `LEDGE_TOP` is the level the whole corner is built around — the line
 * that crops the camel's neck and seats the grass and the props — so the haunch, both forefeet and
 * the tail's resting length are all placed against it rather than near it. The corner's standing
 * rule is that nothing floats, and an animal hovering a few hundredths above its own ledge is the
 * loudest version of that fault.
 */
const FOX_SEAT = LEDGE_TOP

/**
 * ONE EAR, and this is the piece of geometry the whole figure turns on.
 *
 * An ear is a thin dish, and a thin dish is exactly the shape this camera destroys. The `halter`
 * docblock above records the same lesson from the other end of the corner: the noseband's plane is
 * square to the muzzle, the muzzle runs across the screen, so a wrap of any radius PROJECTS TO A
 * LINE — and a line laid across a mouth is a stick whatever colour it is painted. An ear authored
 * as a plate standing square to the skull has the identical problem, and what you get is two
 * spikes, which is a threat display rather than a fox.
 *
 * What gives an ear AREA is that its dish faces roughly toward the CAMERA. So each ear here is
 * built flat in the XY plane (`scl` z about 0.3) and only tipped a little out of it: the reader is
 * looking almost straight into the cup. Four layers, back to front —
 *
 *  1. a `fennecCoat` cone, the ear's own back, standing widest;
 *  2. a `fennecDeep` rim inset behind its outer edge, which is what stops a flat plate from reading
 *     as a paper cut-out — an ear has a thickness and the rim is the only place to show it;
 *  3. the `fennecEar` inner dish, smaller and pushed forward in Z so it wins the depth test against
 *     its own backing (a patch level with its host simply never draws — that bug has shipped in
 *     this cast before);
 *  4. `fennecCream` fringe hairs along the inner edge, because a fennec's ear opening is furred and
 *     because the fringe breaks an otherwise perfectly smooth parabola.
 *
 * A cone rather than an ellipsoid: an ellipsoid gives a rounded oval, which is a rabbit. A fennec's
 * ear is a broad triangle that flares from a narrow base, and the flare is what the cone draws.
 *
 * THREE THINGS THE FIRST BUILD GOT WRONG, all visible at reading size and worth recording because
 * each of them turned the ear into a different object:
 *
 *  1. A ROUNDING SPHERE STANDING PROUD OF THE TIP IS A POM-POM. The cone was capped with a sphere
 *     at `len·0.96` and 0.42 of the ear's width, which put a ball on top of a triangle — the whole
 *     thing read as a party hat. A cone does need its point taken off, but the sphere has to be
 *     seated INSIDE the outline (here at 0.8 of the length and a third of the width) so it softens
 *     the tip from within instead of sitting on it.
 *  2. A SEPARATE BACKING CONE DRAWS A SECOND EDGE. The `fennecDeep` rim was a near-identical cone
 *     offset behind the first, and at this scale two nested triangles read as a brim. The back of
 *     the ear is now one narrow crescent along the outer edge only.
 *  3. FRINGE CONES ON THE INNER EDGE READ AS TICKS. Three little pale spikes at right angles to the
 *     ear looked like whiskers stuck on the wrong part of the animal. Fennec ear fur is now two
 *     soft lobes seated INSIDE the dish, which is the same distinction `shag` draws in
 *     `peeker-kit.tsx`: a rounded lobe rooted in the mass is fur, a cone standing off it is a spine.
 *
 * The ear is also WIDER than the first pass — a fennec's ear is nearly as broad as it is long, and
 * drawn narrow it becomes a jackal's.
 *
 * TASK 62 — THE EARS WERE DISPLACED, AND THE CAUSE WAS THE BASE OF THE CONE.
 *
 * Aram: "the fennec ears look a little bit odd." Two separate faults, and both are about where an
 * ear MEETS a head rather than about the ear itself:
 *
 *  1. A CONE'S BASE IS A FLAT DISC, AND IT WAS AS WIDE AS THE EAR. The blade's widest section — a
 *     disc of diameter 2·`wide` = 0.40 — sat exactly at the attachment, on a skull only 0.32
 *     across. So the base's two corners projected past the head's outline on both sides, and
 *     because the near ear is a SEPARATE inked piece (slot 'a', with its own inverted hull) each
 *     corner came with a straight ink line. Two hard chords laid across a crown is precisely the
 *     "cut paper" read: the ears looked balanced on the head, not grown out of it.
 *  2. THE FAR EAR WAS NOT ON THE SKULL AT ALL. Its root sat at 1.9x the skull's own radius from the
 *     skull's centre — behind and below the head, over the cheek ruff — so it read as an ear
 *     growing out of the neck. It is now seated at 1.0x on the upper-rear quadrant, which is where
 *     the far ear of a head turned three-quarters to the reader is.
 *
 * THE FIX FOR (1) TOOK THREE GOES, AND THE FIRST TWO ARE HERE BECAUSE EACH LOST THE ANIMAL:
 *
 *  a. A NARROW PEDICLE FRUSTUM under the cone, so the flat base would be buried. Captured, a clear
 *     regression: the frustum's own straight sides, plus the hard shoulder where the blade's wider
 *     base met its narrower top, turned each ear into a folded-paper hat and the pair into an
 *     origami crown. Burying one flat edge by adding two more is not a fix.
 *  b. A BROAD ELLIPSOID with a cone on top of it. This did answer the join — an ellipsoid has no
 *     edges, so its silhouette is a closed curve and it can emerge from a skull at any depth with a
 *     smooth tangent. But measured, the plate came out 0.384 tall by 0.380 wide with the cone adding
 *     only a quarter above it: a near-CIRCLE with a small point, which is a big ROUND ear and a
 *     different animal from a big POINTED one. The review caught it, and the paragraph four above —
 *     "an ellipsoid gives a rounded oval, which is a rabbit" — had already warned me.
 *
 * WHAT IT IS NOW: the original CONE is back, because the flare from a broad base to a point is the
 * fennec's whole outline and only a cone draws it. The base's two corners are answered instead by a
 * flat rounded LOBE centred exactly on them — semi-width `wide`, so its widest point coincides with
 * each corner and its curve rounds them off in both directions. The silhouette runs: skull, then the
 * lobe's curve out to the ear's widest point, then the cone's straight side to the tip. The corner
 * at the widest point stays, and it should: that is the turn of the conch's outer margin, which is a
 * feature of an ear rather than an artefact of a primitive.
 *
 * The lobe also flares a little past the skull's own outline at the attachment, which is true of the
 * animal — a fennec's ear conch is wider than its braincase where it joins.
 */
function fennecEar(at: V3, len: number, wide: number, lean: number, tipIn: number): ClayPart[] {
  const c = Math.cos(lean)
  const s = Math.sin(lean)
  /** A point `t` of the way up the ear's own axis, `o` across it. */
  const up = (t: number, o: number, z: number): V3 => [
    at[0] - s * t + c * o,
    at[1] + c * t + s * o,
    at[2] + z,
  ]
  return [
    // THE BASE LOBE, first and buried: a flat rounded mass whose half-width is exactly `wide`, so
    // its widest point sits ON each of the cone's base corners and its curve rounds them off. It is
    // the whole answer to the flat-disc fault, and it costs one primitive rather than a new shape
    // language. Flat (0.42 of its width in height) so it reads as the ear's own base rather than as
    // a jowl running down the side of the head.
    {
      ...sph(wide, PALETTE.fennecCoat, up(0, 0, -0.01), [1, 0.42, 0.3], 12),
      rot: [0, 0, lean] as V3,
    },
    // THE BLADE: the cone is back, because the flare from a broad base to a point is the fennec's
    // whole outline and only a cone draws it. Its base sits at the root, inside the lobe.
    cone(wide, len, PALETTE.fennecCoat, up(len * 0.5, 0, -0.01), [0, 0, lean], [1, 1, 0.3], 9),
    // THERE IS NO ROUNDING SPHERE ON THE TIP, and its absence is a result rather than an omission.
    //
    // T61 put one at 0.8 of the length at a third of the ear's width. A 5x crop shows what that
    // actually draws: the cone is only 0.2 of `wide` at that height, so the sphere stands 0.027
    // proud of it and reads as a KNOB partway down the blade — the same pom-pom the docblock above
    // warns about, smaller. Moving it up to cap the apex was worse: against a cone that is 0.008
    // wide there, any sphere is a ball on a stick, and the capture came back with two of them.
    //
    // A cone's apex is already the shape an ear tip wants, and `inflateClay` blunts it for free —
    // the ink hull pushes every vertex out along its own normal, so the drawn outline is rounded by
    // the contour width even where the clay comes to a point. That is enough, and it is the only
    // version of this tip that has ever survived a crop.
    // the back of the ear, as ONE crescent along the outer edge rather than a second full triangle
    {
      ...sph(len * 0.42, PALETTE.fennecDeep, up(len * 0.46, -wide * 0.52, -0.028), [0.2, 1, 0.16], 10),
      rot: [0, 0, lean] as V3,
    },
    // The inner dish, forward in Z so it wins the depth test against its own backing, and stopping
    // short of the tip so the coat's edge frames it. Its own base disc is interior to the lobe.
    cone(wide * 0.72, len * 0.78, PALETTE.fennecEar, up(len * 0.43, tipIn, 0.035), [0, 0, lean], [1, 1, 0.24], 9),
    // two soft ear-fur lobes, seated inside the dish
    ...[0.3, 0.52].map((t) => ({
      ...sph(len * 0.15, PALETTE.fennecCream, up(len * t, wide * 0.24, 0.055), [0.42, 1, 0.2], 8),
      rot: [0, 0, lean + 0.24] as V3,
    })),
  ]
}

/**
 * Head, body and the FAR ear.
 *
 * The far ear lives here rather than on its own hinge, and it is drawn flatter, darker and a size
 * down. Two identical ears at one depth read as a single flat cut-out with a notch in it; the pair
 * only reads as a head with ears ON it when one of them is clearly behind the other.
 *
 * THE ONE-OVAL TRAP. A small round animal drawn as a stack of spheres becomes one oval under the
 * four-band ramp — the yeti's whole history is this defect and the fixes that worked were a drawn
 * break between the masses and a limb given its own value. Here the break is the CHEEK RUFF: a
 * `fennecCream` collar standing proud of a narrower neck, so the outline runs head → pinch → chest
 * instead of one continuous egg. The second break is the shaded flank down the outward side.
 */
function fennecBody(): ClayPart[] {
  return [
    // FAR EAR first so everything else draws over its base. Its root is ON the skull's upper-rear
    // quadrant (1.0x the skull's own radius from its centre, measured against the ellipsoid's three
    // semi-axes rather than eyeballed) — the previous 1.9x put it out over the neck.
    ...fennecEar([-0.075, 0.268, -0.055], 0.46, 0.165, 0.34, -0.012),

    // Haunch and rump, seated on the shelf. The rump is the figure's outward mass and it is what
    // crops at the frame — a seated fox is widest at the hip, so that is the honest place to spend
    // the outward reach.
    sph(0.2, PALETTE.fennecCoat, [-0.27, -0.32, -0.02], [1.1, 1.0, 0.9], 14),
    sph(0.15, PALETTE.fennecDeep, [-0.33, -0.44, 0.02], [1.15, 0.72, 0.75], 12),
    // the thigh's own mass, forward of the rump so the hind leg reads as a separate limb
    sph(0.13, PALETTE.fennecCoat, [-0.17, -0.42, 0.12], [1.05, 0.92, 0.7], 12),

    // Chest and shoulders, narrowing upward. A seated fox is a triangle: heavy at the base, narrow
    // at the neck, and that taper is most of what says "sitting".
    sph(0.19, PALETTE.fennecCoat, [-0.06, -0.26, 0.04], [1.05, 1.05, 0.92], 14),
    sph(0.145, PALETTE.fennecCoat, [-0.02, -0.06, 0.06], [1.0, 0.95, 0.9], 12),
    // the shaded outward flank — the tone break that stops the body meeting the sky at full coat
    // value, and the same device the yeti's flank strip uses
    sph(0.15, PALETTE.fennecDeep, [-0.21, -0.2, 0.02], [0.62, 1.2, 0.5], 12),

    // FORELEGS: two neat columns dropping to the shelf, with the near one forward in Z. Small and
    // straight, because a fennec's legs are slight and because anything thicker turns the seated
    // triangle into a squat.
    ...limb(
      [
        [0.02, -0.14, 0.16],
        [0.045, -0.36, 0.18],
        [0.05, FOX_SEAT + 0.03, 0.18],
      ],
      0.042,
      0.034,
      PALETTE.fennecCoat
    ),
    ...limb(
      [
        [-0.09, -0.16, 0.08],
        [-0.075, -0.36, 0.09],
        [-0.07, FOX_SEAT + 0.03, 0.09],
      ],
      0.04,
      0.032,
      PALETTE.fennecDeep
    ),
    // the paws, sat ON the shelf rather than above it
    sph(0.045, PALETTE.fennecCream, [0.055, FOX_SEAT + 0.022, 0.2], [1.25, 0.72, 0.9], 10),
    sph(0.042, PALETTE.fennecCream, [-0.068, FOX_SEAT + 0.022, 0.11], [1.2, 0.7, 0.9], 10),

    // THE CHEEK RUFF — the drawn break, and the largest single piece of the cream budget. It stands
    // proud of the neck on both sides so the head is a separate mass from the chest.
    sph(0.1, PALETTE.fennecCream, [0.02, 0.09, 0.14], [1.0, 0.72, 0.55], 12),
    sph(0.085, PALETTE.fennecCream, [-0.12, 0.06, 0.08], [0.78, 1.05, 0.5], 10),

    // SKULL. Small, round and set forward — a fennec's braincase is tiny under those ears.
    sph(0.155, PALETTE.fennecCoat, [0.04, 0.21, 0.04], [1.02, 0.95, 0.94], 14),
    // The shaded socket the NEAR ear plugs into. It belongs to the body rather than to the ear
    // because the ear swivels and a join does not: drawn on the hinged piece it would slide around
    // the skull with the gesture. It is what turns "an ear touching a head" into "an ear set in
    // one" — the same job the pangolin's collar does where its neck enters the shell.
    { ...sph(0.075, PALETTE.fennecDeep, [0.025, 0.295, 0.115], [1.25, 0.42, 0.6], 10), rot: [0, 0, -0.1] as V3 },
    // the muzzle: a short wedge, not a snout. It ends in the fox's own tone with the nose seated on
    // TOP of it, which is the fix the canyon pangolin's anteater nose needed — put a dark bead at
    // the tip of a taper and the bead becomes the tip.
    ...limb(
      [
        [0.09, 0.185, 0.13],
        [0.2, 0.15, 0.16],
        [0.27, 0.13, 0.15],
      ],
      0.062,
      0.038,
      PALETTE.fennecCream
    ),
    sph(0.038, PALETTE.fennecCream, [0.285, 0.128, 0.15], [0.95, 0.9, 0.9], 10),
    sph(0.024, PALETTE.ink, [0.3, 0.148, 0.17], [0.9, 0.8, 0.8], 8),
    // the mouth, a short ink tick turning up at its rear end
    ...limb(
      [
        [0.29, 0.098, 0.16],
        [0.235, 0.086, 0.17],
        [0.185, 0.096, 0.15],
      ],
      0.009,
      0.011,
      PALETTE.ink
    ),
    // The pale brow flash over each eye, and the faint dark line from eye to nose that every small
    // desert fox carries. The line is doing structural work as well as marking: it separates the
    // muzzle's cream from the skull's coat, which otherwise meet at a value step too small to read.
    sph(0.055, PALETTE.fennecCream, [0.09, 0.315, 0.12], [1.2, 0.5, 0.6], 10),
    ...limb(
      [
        [0.115, 0.245, 0.145],
        [0.19, 0.185, 0.155],
        [0.25, 0.155, 0.155],
      ],
      0.012,
      0.008,
      PALETTE.fennecDeep
    ),
    // THE EYE: big, forward and dark-centred, in the cast's own warm-eye treatment — the camel
    // beside it, the crocodile and the snake in the delta all wear a honey ring, so the animals look
    // at the reader with one eye rather than five.
    ...eye([0.135, 0.245, 0.155], 0.058, { sclera: PALETTE.honey, iris: PALETTE.ink }),
    // whisker ticks, three short ink strokes off the muzzle's near side
    ...[0.0, 0.045, 0.088].map((dy, i) =>
      cyl(
        0.006,
        0.008,
        0.1 - 0.014 * i,
        PALETTE.ink,
        [0.265 + 0.012 * i, 0.108 + dy, 0.185],
        [0, 0, 1.28 - 0.24 * i]
      )
    ),
  ]
}

/**
 * The BRUSH TAIL, hinged at the haunch so `applyEar`'s second channel sweeps it.
 *
 * A fennec's tail is nearly as long as its body and it is carried curled forward around the feet
 * when the animal is sitting — which is useful here as well as true, because it puts a soft
 * horizontal mass along the shelf and ties the figure to the surface it is sitting on. The tip is
 * `fennecDeep`: a dark tail tip is the fox's own marking, and it is also the one thing that stops a
 * pale brush dissolving into a bright desert sky at exactly the point where it is thinnest.
 */
function fennecTail(): ClayPart[] {
  return [
    ...limb(
      [
        [0.0, 0.0, 0],
        [-0.11, -0.09, 0.04],
        [-0.16, -0.19, 0.1],
        [-0.11, -0.26, 0.16],
        [0.0, -0.28, 0.2],
      ],
      0.075,
      0.058,
      PALETTE.fennecCoat
    ),
    // the brush's own shadow along its underside, so a fat cylinder still turns
    sph(0.06, PALETTE.fennecDeep, [-0.14, -0.24, 0.06], [1.4, 0.6, 0.6], 10),
    sph(0.06, PALETTE.fennecCoat, [0.03, -0.275, 0.21], [1.1, 0.9, 0.9], 10),
    sph(0.05, PALETTE.fennecDeep, [0.1, -0.265, 0.21], [1.1, 0.95, 0.9], 10),
  ]
}

/**
 * Where the near ear hinges off the skull, and where the tail hinges off the haunch.
 *
 * The ear joint is INSIDE the skull (0.69 of the way out along the ellipsoid's own axes, measured
 * rather than judged), on the upper-front quadrant where a fox's near ear sits when its head is
 * turned three-quarters to the reader. Task 62 moved it down and slightly inboard from [0, 0.31,
 * 0.09] so the pedicle's buried end has skull around it on every side — see `fennecEar`.
 */
const FOX_EAR_AT: V3 = [0.02, 0.29, 0.1]
const FOX_TAIL_AT: V3 = [-0.28, -0.4, 0.08]

export function desertPieces(kind: 'camelAdult' | 'fennec', dir: 1 | -1): PeekerPiece[] {
  if (kind === 'fennec') {
    return [
      { slot: 'body', at: [0, 0, 0], parts: facing(dir, fennecBody()), ink: true },
      {
        slot: 'a',
        at: [FOX_EAR_AT[0] * dir, FOX_EAR_AT[1], FOX_EAR_AT[2]],
        // the near ear earns the second contour ahead of the tail: it is the silhouette, and the
        // tail is tucked against the body where an outline gains almost nothing
        // 0.48 rather than the 0.43 the T61 cone used, because the root moved DOWN into the skull
        // by 0.02 when the ear was re-seated and the ear has to earn that back before it earns
        // anything. `peeker-cast.test.ts` now holds a FLOOR on this reach, so a future shortening
        // fails instead of passing quietly — which is what happened to the first attempt at it.
        parts: facing(dir, fennecEar([0, 0, 0], 0.53, 0.19, -0.16, 0.014)),
        ink: true,
      },
      // no `ink` on the tail: only the first INK_PIECE_LIMIT pieces are ever drawn with a contour,
      // so the flag would be inert here — and an inert flag reads as a live one.
      { slot: 'b', at: [FOX_TAIL_AT[0] * dir, FOX_TAIL_AT[1], FOX_TAIL_AT[2]], parts: facing(dir, fennecTail()) },
    ]
  }
  const pose = ADULT
  const hinge = posedPoint(pose, JAW_HINGE)
  return [
    {
      slot: 'body',
      at: [0, 0, 0],
      parts: facing(dir, [
        ...camelNeck(pose),
        ...scaledAbout(HEAD_PIVOT, pose.scale, rotatedAbout(HEAD_PIVOT, pose.tilt, [...camelHead(pose), ...halter(pose)])),
      ]),
      ink: true,
    },
    {
      slot: 'a',
      at: [hinge[0] * dir, hinge[1], hinge[2]],
      // the jaw's parts are authored about the hinge, so they take the head's pose about the ORIGIN
      parts: facing(dir, scaledAbout(ORIGIN, pose.scale, rotatedAbout(ORIGIN, pose.tilt, camelJaw(pose)))),
      ink: true,
    },
  ]
}
