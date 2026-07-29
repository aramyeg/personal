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
 * THREE THINGS THE PREVIOUS PASS GOT WRONG, and they are all composition rather than craft:
 *
 *  1. The crown sat directly behind the skull, so the fronds fanned around the camel's ears and she
 *     read as wearing a leafy headdress. The crown is now pushed OUT and DOWN — outboard of the
 *     neck and well below the eye line — and the fronds ARC rather than radiate, so they climb
 *     nearly vertically out of the crown and only turn inward once they are clear over the head.
 *     The clear band of sky between the head's silhouette and the nearest blade is the fix.
 *  2. The ledge was a closed rounded box with a lip all the way round, which with drift and grass
 *     inside it read as a trough the camel was standing in. It is now a SHELF: a flat top line, a
 *     front face, nothing curling back toward the viewer, and far less detail. It is a plinth.
 *  3. The neck outweighed the head. It is roughly half its old width, it narrows as it falls away
 *     instead of flaring into a shoulder, and the shelf crops it — so the face reads first.
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

/** Top of the shelf. Everything that stands on the stone is placed against this one number. */
const LEDGE_TOP = -0.62

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

  // Two date bunches on their own straw stalks, hung on the INNER face of the crown so they fall in
  // the open sky between the bole and the camel's throat instead of dangling in front of it.
  parts.push(
    cyl(0.012, 0.018, 0.16, PALETTE.dune, [-0.475, 0.245, -0.05], [0, 0, 0.42], [1, 1, 0.9], 6),
    ...strand([-0.45, 0.16, -0.03], 5, 0.058, 0.032, PALETTE.rust, 0.012, 0.9),
    cyl(0.01, 0.015, 0.13, PALETTE.dune, [-0.425, 0.2, 0.06], [0, 0, 0.55], [1, 1, 0.9], 6),
    ...strand([-0.405, 0.13, 0.08], 4, 0.052, 0.027, PALETTE.clayPath, -0.01, 0.9)
  )

  // The ledge: a shelf, not a container. It runs off the outer edge, crops past the bottom of the
  // frame, shows one lit top course over one shaded face, and crumbles away at its inner end — the
  // camel stands BEHIND it, so it is also what crops her neck and hides her shoulder.
  parts.push(
    slab(1.04, 0.27, PALETTE.sinterDeep, [-0.15, LEDGE_TOP - 0.27, 0]),
    // the sunlit top course, set proud of the face so IT owns the shelf's top line
    slab(1.04, 0.08, PALETTE.sinter, [-0.15, LEDGE_TOP - 0.055, 0.22]),
    // one bedding plane across the face; a second course would start reading as masonry
    slab(1.0, 0.032, PALETTE.stone, [-0.17, -0.87, 0.26]),
    slab(0.2, 0.12, PALETTE.sinterDeep, [0.44, -0.8, 0.1]),
    slab(0.16, 0.085, PALETTE.sinter, [0.52, -0.94, 0.14])
  )

  // Sand drifted ONTO the shelf and spilling over its front lip — the one thing allowed to break
  // the straight top line, and what stops the stone reading as a bare pedestal.
  parts.push(
    sph(0.24, PALETTE.goldSand, [-0.3, LEDGE_TOP - 0.005, 0.22], [1.3, 0.22, 0.5], 10),
    sph(0.18, PALETTE.sand, [0.06, LEDGE_TOP + 0.005, 0.24], [1.4, 0.2, 0.45], 10),
    sph(0.13, PALETTE.goldSand, [-0.24, -0.74, 0.3], [1.1, 0.9, 0.28], 8)
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

/** The calf is the same build shrunk about the muzzle — see `scaledAbout`. */
const CALF_SCALE = 0.86
/**
 * A small bump on both heads, taken because the face has to out-weigh the neck and the neck alone
 * could not carry all of that. Bounded by the inward wall of MASCOT_BOX, which the muzzle already
 * sits close to.
 */
const HEAD_SCALE = 1.05
/**
 * Everything in the head cluster scales about this point — the base of the muzzle. Scaling about
 * the muzzle rather than the eyeline is what lets the head grow UP and BACK, away from the frame's
 * inner wall, instead of driving the lip further into the middle of the screen.
 */
const HEAD_PIVOT: V3 = [0.3, 0.3, 0]
/** The jaw hinge, at the back of the skull; the jaw's own parts are authored about it. */
const JAW_HINGE: V3 = [-0.02, 0.4, 0]

const ORIGIN: V3 = [0, 0, 0]

/**
 * Uniformly scale a part list about a pivot. The calf is not a separate sculpt — it is the adult's
 * head at 0.86 about the muzzle, which is why its face lands in the same on-frame band instead of
 * sliding toward the origin the way a scale about [0,0,0] would drag it.
 */
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
 * The neck, running from the head down out of frame.
 *
 * SIGN NOTE, because R14 got it wrong and the result was a detached tan bar beside the head: the
 * neck must fall AWAY from the frame (−x) as it descends, so it reads as a neck continuing into a
 * body off-screen. `limb` derives each segment's rotation from the points themselves, so the
 * direction lives in this list and nowhere else — there is no hand-written rotation to get backwards.
 *
 * WIDTH NOTE, which is the whole point of this pass: it is roughly half its previous thickness and
 * it NARROWS as it descends rather than flaring into a shoulder. It also runs back in z as it
 * falls, so the narrowing reads as recession rather than as a tapered pole — and the ledge crops
 * the last of it, which is why there is no shoulder mass to draw at all.
 */
function camelNeck(s: number): ClayPart[] {
  const top: V3 = [
    HEAD_PIVOT[0] + (-0.06 - HEAD_PIVOT[0]) * s,
    HEAD_PIVOT[1] + (0.34 - HEAD_PIVOT[1]) * s,
    -0.03 * s,
  ]
  return [
    ...limb(
      [
        [-0.4, -0.78, -0.17],
        [-0.34, -0.48, -0.13],
        [-0.24, -0.14, -0.08],
        top,
      ],
      0.078,
      0.088 * s,
      PALETTE.camelHide
    ),
    // Painted throat shading. The four-band ramp leaves a cylinder this size almost flat, so the
    // curve of the neck has to be a colour block sitting slightly proud of the front surface.
    ...limb([[-0.34, -0.5, -0.06], [-0.26, -0.24, -0.03]], 0.048, 0.042, PALETTE.camelShade, 6),
    ...limb([[-0.24, -0.2, -0.02], [-0.13, 0.06, 0.02]], 0.042, 0.036, PALETTE.camelShade, 6),
    // the shoulder the neck runs into, kept small and low: the shelf covers it, and it exists so
    // the neck ends in a body rather than in an open tube if a viewport ever crops differently
    sph(0.1, PALETTE.camelHideDeep, [-0.4, -0.72, -0.2], [1.1, 0.9, 0.85], 8),
  ]
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
 * The head. A camel is a LONG wedge — a small cranium set well back, a straight bridge, and a
 * nose block hung off the end — so it is built as a chain of four masses rather than a ball with a
 * snout, which is the shape that made the R14 pass read as a llama.
 */
function camelHead(calf: boolean): ClayPart[] {
  const bridgeX = calf ? 0.2 : 0.22
  const noseX = calf ? 0.285 : 0.31
  const lipX = calf ? 0.325 : 0.35
  const bandX = bridgeX + 0.045
  return [
    sph(0.185, PALETTE.camelHide, [0.005, 0.52, 0], [1.02, 0.94, 0.94], 14),
    sph(0.165, PALETTE.camelHide, [0.11, 0.42, 0.01], [1.05, 0.92, 0.92], 12),
    sph(0.135, PALETTE.camelHide, [bridgeX, 0.345, 0.02], [1.12, 0.86, 0.9], 12),
    // the calf's muzzle is rounder and pulled back toward the skull — a foal-proportioned head is
    // the cheapest way to read "young" once both animals share one build
    sph(calf ? 0.122 : 0.112, PALETTE.camelHideDeep, [noseX, 0.265, 0.02], calf ? [1, 1.02, 0.94] : [1.02, 0.95, 0.9], 12),
    sph(0.082, PALETTE.camelHideDeep, [lipX, 0.17, 0.03], [0.95, 1.1, 0.88], 10),
    // the split in the upper lip, which is the detail that says camel rather than horse
    cyl(0.011, 0.011, 0.085, PALETTE.ink, [lipX + 0.04, 0.16, 0.07], [0, 0, 0.16], undefined, 6),
    // slit nostril, laid at the angle the real one runs rather than punched as a round hole
    cyl(0.016, 0.016, 0.07, PALETTE.ink, [noseX + 0.05, 0.29, 0.09], [0, 0, -0.55], undefined, 6),
    // SHADE step under the jowl — volume the toon ramp no longer supplies at this size
    sph(0.115, PALETTE.camelShade, [0.11, 0.31, 0.05], [1.25, 0.62, 0.55], 10),
    sph(0.072, PALETTE.camelHideDeep, [0.11, 0.625, 0.1], [1.35, 0.5, 0.7], 8),
    ...eye([0.13, 0.545, 0.155], 0.062, {
      sclera: PALETTE.snow,
      iris: PALETTE.ink,
      lid: PALETTE.camelHideDeep,
      lidTilt: -0.22,
    }),
    ...lashes([0.13, 0.545, 0.155], 0.062),
    // small ears, one near and one far, set BACK of the eye. A camel's ears are stubby; anything
    // taller starts reading as a donkey.
    sph(0.052, PALETTE.camelHide, [-0.05, 0.68, 0.07], [0.75, 1.5, 0.55], 8),
    sph(0.03, PALETTE.camelShade, [-0.042, 0.676, 0.1], [0.7, 1.4, 0.5], 6),
    sph(0.05, PALETTE.camelHide, [-0.13, 0.655, -0.1], [0.75, 1.5, 0.55], 8),
    sph(0.028, PALETTE.camelShade, [-0.122, 0.651, -0.07], [0.7, 1.4, 0.5], 6),
    // Forelock: a neat tuft on the adult, a longer scruffier one on the calf. It is the tallest
    // thing on the animal, so it — not the ears — is what the canopy is cleared against.
    ...tufts([0.01, 0.66, 0.06], 0.1, calf ? 4 : 3, PALETTE.camelHideDeep, 0.2, 0.8, calf ? 1.1 : 0.7),
    // The halter: a noseband wrapping the muzzle, a cheekpiece running back off it and a brass
    // ring at the junction. The band alone reads as a painted stripe — it is the strap ANGLING
    // away from it that makes the thing tack rather than markings.
    cyl(0.026, 0.026, 0.28, PALETTE.camelSaddle, [bandX, 0.3, 0.02], [0, 0, -0.658], [1, 1, 0.8], 8),
    cyl(0.019, 0.021, 0.3, PALETTE.camelSaddle, [0.205, 0.425, 0.11], [0, 0, 1.468], [1, 1, 0.8], 6),
    sph(0.03, PALETTE.honey, [bandX + 0.065, 0.4, 0.09], [1, 1, 0.6], 8),
  ]
}

/**
 * The lower jaw, authored about its hinge. The rig yaws AND rolls this piece, so it swings sideways
 * as well as down — a camel grinds side to side, and a straight hinge reads as a nutcracker.
 *
 * The straw is the point of the whole gesture: without something in the mouth the chew is a jaw
 * twitching on an empty face, and the straw ties the animal to the dry grass in its own dressing.
 */
function camelJaw(calf: boolean): ClayPart[] {
  return [
    sph(0.115, PALETTE.camelHide, [0.14, -0.055, 0], [1.4, 0.78, 0.9], 12),
    sph(0.088, PALETTE.camelHideDeep, [0.3, -0.135, 0.01], [1.15, 0.88, 0.9], 10),
    sph(0.062, PALETTE.camelShade, [0.36, -0.145, 0.03], [1, 0.95, 0.85], 10),
    sph(0.1, PALETTE.camelShade, [0.06, -0.135, -0.01], [1.35, 0.6, 0.8], 10),
    // one lower tooth showing at the corner — the camel's own smug little underbite
    sph(0.024, PALETTE.snow, [0.33, -0.07, 0.05], [1, 1.3, 0.8], 6),
    cone(0.03, 0.11, PALETTE.camelHideDeep, [0.08, -0.155, 0.03], [0, 0, 0.18], [1, 1, 0.7], 6),
    cone(0.026, 0.095, PALETTE.camelHideDeep, [0.17, -0.175, 0.03], [0, 0, 0.05], [1, 1, 0.7], 6),
    cone(0.022, 0.08, PALETTE.camelHideDeep, [0.25, -0.185, 0.02], [0, 0, -0.1], [1, 1, 0.7], 6),
    cyl(0.008, 0.01, 0.2, PALETTE.goldSand, [0.34, -0.05, 0.07], [0, 0, -1.15], undefined, 5),
    cyl(0.007, 0.009, 0.16, calf ? PALETTE.goldSand : PALETTE.reedGreen, [0.33, -0.1, 0.05], [0, 0, -1.55], undefined, 5),
  ]
}

/** The lead rope, on the adult only — a calf follows its mother untethered. */
function leadRope(): ClayPart[] {
  return [
    ...strand([0.19, 0.17, 0.13], 4, 0.1, 0.03, PALETTE.rust, -0.03, 0.94),
    cone(0.022, 0.075, PALETTE.dune, [0.09, -0.2, 0.13], [0, 0, Math.PI], undefined, 6),
  ]
}

export function desertPieces(kind: 'camelAdult' | 'camelCalf', dir: 1 | -1): PeekerPiece[] {
  const calf = kind === 'camelCalf'
  const s = HEAD_SCALE * (calf ? CALF_SCALE : 1)
  const hinge: V3 = [
    HEAD_PIVOT[0] + (JAW_HINGE[0] - HEAD_PIVOT[0]) * s,
    HEAD_PIVOT[1] + (JAW_HINGE[1] - HEAD_PIVOT[1]) * s,
    JAW_HINGE[2] * s,
  ]
  return [
    {
      slot: 'body',
      at: [0, 0, 0],
      parts: facing(dir, [
        ...camelNeck(s),
        ...scaledAbout(HEAD_PIVOT, s, [...camelHead(calf), ...(calf ? [] : leadRope())]),
      ]),
      ink: true,
    },
    {
      slot: 'a',
      at: [hinge[0] * dir, hinge[1], hinge[2]],
      // the jaw's parts are authored about the hinge, so they scale about the ORIGIN of that group
      parts: facing(dir, scaledAbout(ORIGIN, s, camelJaw(calf))),
      ink: true,
    },
  ]
}
