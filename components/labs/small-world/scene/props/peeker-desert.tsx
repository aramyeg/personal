import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leafFan, limb, sph, strand, tufts, type V3 } from './peeker-kit'
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
 *  3. THE LEDGE IS A SHELF, NOT A CONTAINER. A flat top line, a front face, and nothing curling
 *     back toward the viewer. As a closed box with a lip all round it read as a trough she stood in.
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
 * A flat-faced stone block: a four-sided prism running along X, rolled 45° about its own axis so it
 * presents a FLAT top and a FLAT front instead of the ridge a raw 4-segment cylinder gives. The
 * straight top line is the whole point — it is what separates a quarried shelf from one more dune,
 * and it is the line the drift and the grass are allowed to break.
 *
 * The roll couples the two cross-section axes, so `half` is the block's half-height AND half-depth.
 */
function slab(w: number, half: number, color: string, at: V3): ClayPart {
  const r = half * Math.SQRT2
  return cyl(r, r, w, color, at, [Math.PI / 4, 0, Math.PI / 2], undefined, 4)
}

/**
 * Top of the shelf. Everything that stands on the stone is placed against this one number, and so
 * is everything BEHIND it: the shelf is what crops the camel's neck, so its height sets how much
 * neck is on screen at all. Raised from −0.62 for exactly that reason.
 */
const LEDGE_TOP = -0.54

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
  // frame, shows one lit top course over one shaded face, and crumbles away at its inner end — the
  // camel stands BEHIND it, so it is also what crops her neck and hides her shoulder.
  parts.push(
    slab(1.04, 0.27, PALETTE.sinterDeep, [-0.15, LEDGE_TOP - 0.27, 0]),
    // the sunlit top course, set proud of the face so IT owns the shelf's top line
    slab(1.04, 0.08, PALETTE.sinter, [-0.15, LEDGE_TOP - 0.055, 0.22]),
    // one bedding plane across the face; a second course would start reading as masonry
    slab(1.0, 0.032, PALETTE.stone, [-0.17, LEDGE_TOP - 0.25, 0.26]),
    slab(0.2, 0.12, PALETTE.sinterDeep, [0.44, LEDGE_TOP - 0.18, 0.1]),
    slab(0.16, 0.085, PALETTE.sinter, [0.52, LEDGE_TOP - 0.32, 0.14])
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

/**
 * The calf, drawn rather than scaled. Every field below differs from her mother's on purpose:
 *
 *  - the head is TIPPED DOWN, nosing at the grass on the shelf while the adult holds hers level;
 *  - the muzzle is short and the nose block round, which is what makes a young animal's face;
 *  - the eye is barely smaller in a head that is a tenth smaller again, so it reads oversized —
 *    the one proportion that says "young" before any other detail is legible;
 *  - the ears are splayed out off the skull instead of carried upright;
 *  - the forelock is long and untidy where hers is a neat tuft;
 *  - the neck is a single forward bow rather than a long S, and thinner along its whole run.
 */
const CALF: CamelPose = {
  tilt: -0.15,
  scale: 0.96,
  bridgeX: 0.19,
  noseX: 0.25,
  lipX: 0.285,
  noseR: 0.122,
  eyeR: 0.07,
  earAt: [
    [-0.02, 0.66, 0.08],
    [-0.16, 0.63, -0.1],
  ],
  earSplay: 0.62,
  lock: [5, 1.05],
  // Her mother's line is an S that crosses over near the top. This one is a single bow held FORWARD
  // of its own chord the whole way — a young animal reaching up, not one standing easy.
  neck: [
    [-0.44, -0.68, -0.18],
    [-0.37, -0.47, -0.165],
    [-0.255, -0.25, -0.14],
    [-0.155, -0.02, -0.1],
    [-0.078, 0.19, -0.055],
  ],
  neckR: [0.076, 0.042],
  fringe: 2,
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
 * The halter: a noseband wrapping the muzzle, a cheekpiece running back off it and a brass ring at
 * the junction. The band alone reads as a painted stripe — it is the strap ANGLING away from it
 * that makes the thing tack rather than markings. Worked stock only: the calf runs bare.
 */
function halter(pose: CamelPose): ClayPart[] {
  const bandX = pose.bridgeX + 0.045
  return [
    cyl(0.026, 0.026, 0.28, PALETTE.camelSaddle, [bandX, 0.3, 0.02], [0, 0, -0.658], [1, 1, 0.8], 8),
    cyl(0.019, 0.021, 0.3, PALETTE.camelSaddle, [0.205, 0.425, 0.11], [0, 0, 1.468], [1, 1, 0.8], 6),
    sph(0.03, PALETTE.honey, [bandX + 0.065, 0.4, 0.09], [1, 1, 0.6], 8),
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

/**
 * A woven cord low on the calf's neck: the pair's terracotta note without the mother's tack. The
 * band is rolled to sit SQUARE across the neck's centreline, since a collar cut at any other angle
 * reads as a stripe painted on the hide.
 */
function calfCord(pose: CamelPose): ClayPart[] {
  // seated mid-neck, where the run is widest on screen and the band has something to wrap
  const at = pose.neck[pose.neck.length - 2]
  const below = pose.neck[pose.neck.length - 3]
  const roll = -Math.atan2(at[0] - below[0], at[1] - below[1])
  return [
    cyl(0.072, 0.074, 0.034, PALETTE.camelSaddle, at, [0, 0, roll], [1, 1, 0.86], 8),
    sph(0.026, PALETTE.honey, [at[0] + 0.045, at[1] - 0.022, at[2] + 0.062], [1, 1, 0.6], 6),
  ]
}

export function desertPieces(kind: 'camelAdult' | 'camelCalf', dir: 1 | -1): PeekerPiece[] {
  const calf = kind === 'camelCalf'
  const pose = calf ? CALF : ADULT
  const hinge = posedPoint(pose, JAW_HINGE)
  // the worked animal wears the tack; the calf runs bare
  const head = calf ? camelHead(pose) : [...camelHead(pose), ...halter(pose)]
  return [
    {
      slot: 'body',
      at: [0, 0, 0],
      parts: facing(dir, [
        ...camelNeck(pose),
        ...(calf ? calfCord(pose) : []),
        ...scaledAbout(HEAD_PIVOT, pose.scale, rotatedAbout(HEAD_PIVOT, pose.tilt, head)),
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
