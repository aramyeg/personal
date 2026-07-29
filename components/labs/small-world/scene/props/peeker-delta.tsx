import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leaf, leafFan, limb, sph, strand, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the DELTA checkpoint: a mangrove thicket standing in still swamp water, with two
 * CROCODILES lurking in it.
 *
 * Same corner grammar as `peeker-jungle.tsx` (which the look-dev gate was run against): woody
 * limbs sweeping in from the frame's outer edge, a dense canopy of ribbed leaves, strands dropping
 * off-frame, and the characters sitting IN the dressing rather than in front of it. What is delta
 * rather than jungle is the vocabulary: the limbs are mangrove ROOTS that arch out of the water on
 * both feet, the vines are hanging moss, and the understory is lily pads and reeds on a silt bank.
 * Aram asked for "jungle/amazon aesthetics to the swamp", so the greens are borrowed straight from
 * the jungle canopy and only the wet notes (mangroveBark, mossHang, deltaSilt) are delta's own.
 */

/**
 * VISIBLE BAND, the constraint that decides every number below: the frame's outer edge sits at
 * local x = −PEEKER_INSET_X (−0.64) and its bottom edge at y ≈ −0.92. Dressing is SUPPOSED to
 * cross those two edges — that is what makes it read as a thicket the frame is cutting through
 * rather than a potted plant — but its mass has to stay inside `DRESS_REACH`. Nothing past
 * x = −0.64 is on screen at all, so every fan that used to spray out there was paying an envelope
 * cost for pixels nobody ever saw; the canopy now arcs INWARD over the animals instead.
 *
 * The arch also sits far higher than it did: the crocodiles lie along y ≈ −0.3…+0.4 now rather
 * than rearing up the middle of the frame, so the waterline has to cross their bodies to read.
 */
const ARCH_IN: readonly V3[] = [
  [-0.58, -1, -0.02],
  [-0.5, -0.66, -0.02],
  [-0.38, -0.4, 0],
  [-0.22, -0.3, 0.02],
]
const ARCH_OUT: readonly V3[] = [
  [-0.22, -0.3, 0.02],
  [0, -0.32, 0.02],
  [0.2, -0.52, 0],
  [0.32, -0.94, -0.02],
]

export function deltaDressing(): ClayPart[] {
  const greens = [PALETTE.deltaMoss, PALETTE.jungleCanopy, PALETTE.jungleDeep, PALETTE.jungleMoss]
  const parts: ClayPart[] = [
    // The signature mangrove arch, built as two limbs meeting at the crown: a single tapering limb
    // can only be thick at one end, and a prop root is thick where it enters the water at BOTH
    // feet. Its crown is deliberately at the animals' own waistline — it is what both crocodiles
    // hook a forefoot over, so the pair is anchored to the set rather than floating beside it.
    ...limb(ARCH_IN, 0.076, 0.046, PALETTE.mangroveBark),
    ...limb(ARCH_OUT, 0.046, 0.07, PALETTE.mangroveBark),
    // a second arch further in and further back, so the corner reads as a stand of mangrove
    ...limb(
      [
        [0.42, -1, -0.1],
        [0.52, -0.72, -0.1],
        [0.62, -0.58, -0.08],
      ],
      0.054,
      0.03,
      PALETTE.mangroveBark
    ),
    // the stilt root dropping across the outer edge, cropping at both ends
    ...limb(
      [
        [-0.6, -0.08, -0.06],
        [-0.54, -0.36, -0.04],
        [-0.44, -0.6, -0.02],
        [-0.38, -0.96, 0],
      ],
      0.028,
      0.05,
      PALETTE.mangroveBark
    ),
    // the trunk climbing the outer edge — the spine the canopy and the hanging moss hang off
    ...limb(
      [
        [-0.58, -0.62, -0.12],
        [-0.55, -0.2, -0.13],
        [-0.5, 0.24, -0.13],
        [-0.42, 0.64, -0.12],
      ],
      0.058,
      0.026,
      PALETTE.mangroveBark
    ),
    ...limb(
      [
        [-0.5, 0.24, -0.12],
        [-0.26, 0.48, -0.13],
        [0.04, 0.6, -0.13],
      ],
      0.034,
      0.02,
      PALETTE.mangroveBark
    ),
    // wet moss collaring the joints — the tone break that stops the bark reading as one brown bar
    sph(0.074, PALETTE.deltaMoss, [-0.56, -0.66, 0.02], [1.2, 0.8, 0.5], 8),
    sph(0.06, PALETTE.mossHang, [-0.5, 0.24, 0], [1.1, 0.9, 0.5], 8),
    sph(0.068, PALETTE.deltaMoss, [-0.23, -0.32, 0.06], [1.3, 0.7, 0.5], 8),
  ]

  // Canopy: overlapping fans arcing over and BEHIND the crocodiles, at z ≈ −0.14. Density is the
  // point — sparse fans read as leaves on a stick. Each fan's spread stops short of π so no leaf
  // swings out past the frame edge; that is what the outward reach used to be spent on.
  parts.push(
    ...leafFan([-0.36, 0.6, -0.14], 5, 0.42, [0.45, 2.15], greens, PALETTE.jungleDeep, 0.34),
    ...leafFan([-0.08, 0.74, -0.15], 5, 0.42, [0.3, 2], greens, PALETTE.jungleDeep, 0.32),
    ...leafFan([0.3, 0.62, -0.14], 4, 0.36, [0.1, 1.7], greens, PALETTE.jungleDeep, 0.3),
    ...leafFan([-0.34, 0.2, -0.12], 4, 0.28, [1.7, 2.7], greens, PALETTE.jungleDeep, 0.32),
    ...leafFan([0.36, 0.16, -0.13], 4, 0.3, [0.05, 1.2], greens, PALETTE.jungleDeep, 0.28)
  )

  // Hanging moss — the delta's answer to the jungle's vines. Three fall BEHIND the animals out of
  // the canopy; the fourth hangs in FRONT at z 0.24, just inward of the big crocodile's snout, so
  // there is one piece of set between the viewer and the character.
  for (const [mx, my, mz, n, r, drift] of [
    [-0.46, 0.36, -0.08, 6, 0.028, 0.01],
    [-0.14, 0.62, -0.1, 5, 0.026, -0.01],
    [0.3, 0.56, -0.1, 5, 0.024, 0.012],
  ] as const) {
    parts.push(...strand([mx, my, mz], n, 0.1, r, PALETTE.mossHang, drift, 0.86))
  }
  parts.push(...strand([0.5, 0.3, 0.24], 4, 0.09, 0.022, PALETTE.jungleVine, -0.014, 0.9))

  // LILY PADS, squashed hard in Y rather than drawn as circles: the water plane is being read at a
  // grazing angle, so a round pad reads as a floating ball and a flat ellipse reads as a pad lying
  // ON something. The rib is the pad's radial vein, and the one thing keeping it off "green pebble".
  //
  // The first three sit at z ≈ 0.26, IN FRONT of the crocodile's flank rather than beside it. A
  // horizontal animal has no waterline of its own — the line has to be drawn across its body by
  // something nearer the camera, or it reads as a log hovering over a pond.
  for (const [px, py, pz, len, wide, tilt, color] of [
    [-0.3, -0.34, 0.28, 0.4, 0.38, 0.05, PALETTE.deltaMoss],
    [0.06, -0.44, 0.26, 0.42, 0.36, -0.06, PALETTE.jungleMoss],
    [-0.46, -0.62, 0.24, 0.32, 0.42, -0.08, PALETTE.turtleShell],
    [0.34, -0.78, 0.1, 0.36, 0.4, 0.1, PALETTE.deltaMoss],
    [-0.18, -0.86, 0.08, 0.36, 0.42, -0.05, PALETTE.jungleCanopy],
    [0.5, -0.5, 0.06, 0.26, 0.4, 0.12, PALETTE.jungleCanopy],
  ] as const) {
    parts.push(...leaf([px, py, pz], len, wide, tilt, color, PALETTE.jungleDeep))
  }

  // Reeds pushing up out of the shallows, and two seed heads that break their line. Reeds are the
  // only vertical in the understory, so they carry the eye from the water back up to the canopy.
  parts.push(
    ...tufts([-0.3, -0.56, -0.06], 0.2, 6, PALETTE.reedGreen, 0.22, 0.78, 1.4),
    ...tufts([0.22, -0.84, -0.08], 0.22, 5, PALETTE.deltaMoss, 0.24, 0.78, 1.35),
    cyl(0.014, 0.018, 0.26, PALETTE.reedGreen, [0.46, -0.28, -0.06], [0, 0, -0.16]),
    cyl(0.028, 0.024, 0.11, PALETTE.stiltRoof, [0.48, -0.14, -0.06], [0, 0, -0.14]),
    cyl(0.012, 0.016, 0.22, PALETTE.reedGreen, [-0.5, -0.5, -0.08], [0, 0, 0.14]),
    cyl(0.026, 0.022, 0.1, PALETTE.stiltRoof, [-0.52, -0.37, -0.08], [0, 0, 0.12])
  )

  // The water itself: flat silt slabs crossing the bottom edge. Without them the pads and the roots
  // float in the sky, which is the one thing a swamp corner must not do.
  parts.push(
    sph(0.4, PALETTE.deltaSilt, [-0.14, -1, -0.06], [1.15, 0.38, 0.5], 10),
    sph(0.28, PALETTE.deltaSand, [0.34, -0.98, -0.04], [1.1, 0.4, 0.5], 10),
    sph(0.28, PALETTE.deltaSilt, [0.36, -0.86, -0.11], [1.2, 0.34, 0.5], 10)
  )

  // A lotus, the one warm note in an olive corner. It sits ON a pad and on its own stem: an
  // unattached bloom floats beside the crocodile's jaw and reads as a stray bubble.
  parts.push(
    cyl(0.012, 0.014, 0.12, PALETTE.reedGreen, [0.2, -0.56, 0.27], [0, 0, 0.1]),
    sph(0.06, PALETTE.blossom, [0.21, -0.48, 0.28], [1, 0.9, 0.6], 8),
    cone(0.034, 0.11, PALETTE.petal, [0.15, -0.45, 0.28], [0, 0, 0.6], [1, 1, 0.5], 6),
    cone(0.032, 0.1, PALETTE.petal, [0.27, -0.45, 0.28], [0, 0, -0.6], [1, 1, 0.5], 6),
    sph(0.024, PALETTE.honey, [0.21, -0.45, 0.31], undefined, 6)
  )

  return parts
}

// --- crocodiles -------------------------------------------------------------

/**
 * HOW A CROCODILE IS POSED HERE, and it is the whole shape of these two files.
 *
 * Both animals LIE DOWN. A long rostrum runs into the frame just off level, eye turrets and brow
 * ride proud on top of the skull, scutes run back along the spine, and the body mass trails low
 * and outward until it crops at the frame's edge. That is the pose a lurking crocodile actually
 * holds, it is the one that reads as a crocodile in silhouette, and — because it is wide rather
 * than tall — it is also the one that suits a corner composition.
 *
 * The rig's jaw channel is what makes it possible: `applyJaw`/`applyChomp` drive a NEGATIVE z
 * rotation, which drops a mandible away from a snout that points into the frame. (An earlier pass
 * ran the hinge the other way, which only opens a mouth on an animal reared up toward vertical —
 * and a vertical crocodile reads as a green tube.) So the gape here opens DOWNWARD and forward,
 * and the teeth line the jaw instead of crowning it.
 */

/** Where a jaw's axis and its two flanks live, so teeth and gums stay parallel to the jaw they sit on. */
function jawPoint(base: V3, axis: number, t: number, off: number, z = 0): V3 {
  const o = axis + Math.PI / 2
  return [
    base[0] + Math.cos(axis) * t + Math.cos(o) * off,
    base[1] + Math.sin(axis) * t + Math.sin(o) * off,
    base[2] + z,
  ]
}

/**
 * One row of teeth along a jaw. Generated rather than placed by hand because the gape is authored
 * as an ANGLE between two straight rows: a tooth nudged off its jaw's axis reads as a broken jaw the
 * moment the hinge swings. The row bulges in the middle, as a real crocodile's does, which also
 * keeps the short teeth near the hinge — where the two jaws still overlap — out of the way.
 *
 * `z` is the reason the two rows never turn into a white smear. A crocodile's mandible is narrower
 * than its rostrum and its teeth pass OUTSIDE the upper jaw, which is what makes the famous grin
 * legible even on a closed mouth; putting the lower row nearer the camera than the upper one
 * reproduces that, and keeps the rows from intersecting when the gape is nearly shut.
 */
function toothRow(
  base: V3,
  axis: number,
  side: 1 | -1,
  n: number,
  from: number,
  to: number,
  off: number,
  len: number,
  r: number,
  z: number
): ClayPart[] {
  const out = axis + side * (Math.PI / 2)
  const parts: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const p = jawPoint(base, axis, from + (to - from) * f, side * off, z - 0.012 * (i % 2))
    parts.push(
      cone(r, len * (0.62 + 0.5 * Math.sin(Math.PI * f)), PALETTE.snow, p, [0, 0, out - Math.PI / 2], [1, 1, 0.7], 6)
    )
  }
  return parts
}

/** The raised scutes down a crocodile's spine — the marking that makes an olive mass a crocodile. */
function scutes(rows: readonly (readonly [number, number, number, number])[]): ClayPart[] {
  return rows.map(([x, y, a, s]) =>
    cone(s, s * 1.45, PALETTE.crocRidge, [x, y, -0.02], [0, 0, a - Math.PI / 2], [1, 1, 0.66], 6)
  )
}

/** A clawed forefoot hooked over a root — what stops a crocodile hovering beside its own mangrove. */
function foot(x: number, y: number, spread: number): ClayPart[] {
  return [
    sph(0.068, PALETTE.crocHide, [x, y, 0.04], [1.25, 0.85, 0.95], 10),
    cone(0.021, 0.098, PALETTE.crocBelly, [x - 0.068, y - 0.05, 0.06], [0, 0, 2.5 + spread], undefined, 6),
    cone(0.021, 0.108, PALETTE.crocBelly, [x - 0.008, y - 0.07, 0.07], [0, 0, 3.05], undefined, 6),
    cone(0.019, 0.088, PALETTE.crocBelly, [x + 0.05, y - 0.05, 0.06], [0, 0, 3.5 - spread], undefined, 6),
  ]
}

/**
 * The skull's fixed half: brow, eye turrets, rostrum, nostril and the upper tooth line. Everything
 * above the tooth line belongs to the BODY piece so it stays rigid — only the mandible hinges. A
 * single open-mouth mass cannot animate at all, and hinging the whole head instead swings the eye,
 * which is the one feature a viewer tracks.
 *
 * `s` scales the whole head so the two crocodiles share one construction at two sizes; everything
 * else about them differs (pose, tilt, body length, what they are doing with their feet).
 */
function crocSkull(H: V3, A: number, s: number, eyeAt: V3): ClayPart[] {
  return [
    // the braincase, set BEHIND and above the hinge so the mandible swings off the back of it
    sph(0.15 * s, PALETTE.crocHide, jawPoint(H, A, -0.05 * s, 0.02 * s), [1.08, 1, 0.95], 12),
    sph(0.075 * s, PALETTE.crocShade, jawPoint(H, A, -0.16 * s, -0.02 * s, 0.08 * s), [1.2, 0.75, 0.4], 8),
    // Rostrum: a tapering bar rather than a chain of balls. A crocodile's snout is a long boxy
    // wedge, and at this size a smooth taper is the difference between a snout and a sausage.
    ...limb(
      [
        jawPoint(H, A, -0.02 * s, -0.02 * s),
        jawPoint(H, A, 0.16 * s, -0.008 * s),
        jawPoint(H, A, 0.33 * s, 0),
      ],
      0.105 * s,
      0.062 * s,
      PALETTE.crocHide
    ),
    sph(0.062 * s, PALETTE.crocHide, jawPoint(H, A, 0.345 * s, 0), [1, 0.95, 0.95], 10),
    sph(0.036 * s, PALETTE.crocRidge, jawPoint(H, A, 0.35 * s, 0.05 * s, 0.03 * s), [1.1, 0.85, 0.7], 8),
    // the gum ridge the upper teeth grow out of, laid along the tooth line
    cyl(
      0.026 * s,
      0.026 * s,
      0.34 * s,
      PALETTE.crocBelly,
      jawPoint(H, A, 0.18 * s, -0.062 * s, 0.04 * s),
      [0, 0, A - Math.PI / 2],
      [1, 1, 0.6]
    ),
    // the dark back of the mouth, so the gape never shows sky through it
    sph(0.115 * s, PALETTE.crocRidge, jawPoint(H, A, 0.05 * s, -0.05 * s), [1, 1, 0.75], 10),
    // Brow and eye turrets. A crocodile's eyes ride ON the skull rather than in it, and there are
    // two of them on a head this near to level — the far turret is what stops the near eye reading
    // as a cyclops bump. Only the near one gets an iris; the honey ring is what keeps it off
    // "googly black bead".
    sph(0.05 * s, PALETTE.crocRidge, [eyeAt[0] - 0.065 * s, eyeAt[1] - 0.01 * s, -0.1 * s], [1.25, 1, 0.85], 8),
    sph(0.062 * s, PALETTE.crocRidge, [eyeAt[0] - 0.01 * s, eyeAt[1] - 0.02 * s, 0.05 * s], [1.3, 1, 0.85], 8),
    ...eye(eyeAt, 0.055 * s, { sclera: PALETTE.honey, iris: PALETTE.ink }),
  ]
}

const GAPE_HINGE: V3 = [0.02, 0.27, 0]
/** 8° — the rostrum lies just off level, the way a crocodile holds its head watching the bank. */
const GAPE_UPPER = 0.14
/** −17°, which the rig's −0.01…−0.31 rad hinge works into a 25°…43° gape. */
const GAPE_LOWER = -0.3

/**
 * The big crocodile: a full body lying along the waterline, snout into the frame, gape wide, and
 * the hindquarters and tail trailing outward until they crop at the frame's edge.
 */
function crocGapeBody(d: 1 | -1): ClayPart[] {
  const H = GAPE_HINGE
  const A = GAPE_UPPER
  return facing(d, [
    // The spine, running down and out from the nape. A horizontal animal needs the back to DROP as
    // it goes: a level barrel reads as a pipe, whereas a body sinking away toward the tail reads as
    // half of it being under water.
    sph(0.155, PALETTE.crocHide, [-0.09, 0.15, 0], [1.05, 1, 0.95], 12),
    sph(0.195, PALETTE.crocHide, [-0.26, 0.01, -0.01], [1.05, 1, 0.95], 14),
    sph(0.18, PALETTE.crocHide, [-0.42, -0.12, -0.01], [1.05, 1, 0.95], 14),
    sph(0.145, PALETTE.crocHide, [-0.5, -0.24, -0.01], [1.02, 1, 0.95], 12),
    ...limb(
      [
        [-0.48, -0.26, -0.01],
        [-0.56, -0.36, -0.02],
        [-0.6, -0.52, -0.03],
      ],
      0.115,
      0.042,
      PALETTE.crocHide
    ),
    // Painted volume, because the four-band toon ramp leaves an interior this size almost flat: a
    // shadowed flank along the whole underside and a pale throat under the jaw.
    sph(0.185, PALETTE.crocShade, [-0.3, -0.1, 0.06], [1.3, 0.62, 0.55], 12),
    sph(0.14, PALETTE.crocShade, [-0.46, -0.24, 0.05], [1.25, 0.6, 0.55], 12),
    sph(0.12, PALETTE.crocBelly, [-0.1, 0.02, 0.11], [1.3, 0.66, 0.5], 12),
    sph(0.088, PALETTE.crocBelly, [0.03, 0.13, 0.1], [1.15, 0.7, 0.5], 10),
    ...scutes([
      [-0.1, 0.3, 1.72, 0.05],
      [-0.26, 0.2, 1.86, 0.058],
      [-0.42, 0.05, 1.98, 0.055],
      [-0.51, -0.1, 2.1, 0.046],
      [-0.57, -0.28, 2.22, 0.038],
      [-0.6, -0.46, 2.3, 0.03],
    ]),
    // the foreleg reaching down out of the water onto the mangrove crown
    cyl(0.052, 0.066, 0.2, PALETTE.crocHide, [-0.31, -0.16, 0.07], [0, 0, 0.24]),
    ...foot(-0.35, -0.28, 0.35),
    ...crocSkull(H, A, 1, [0.085, 0.425, 0.13]),
    ...toothRow(H, A, -1, 6, 0.06, 0.32, 0.078, 0.075, 0.023, 0.03),
  ])
}

/** The hinged mandible: the shorter half of the gape, with its own teeth, gum and tongue. */
function crocGapeJaw(d: 1 | -1): ClayPart[] {
  const O: V3 = [0, 0, 0]
  const A = GAPE_LOWER
  return facing(d, [
    ...limb(
      [jawPoint(O, A, -0.02, 0), jawPoint(O, A, 0.15, 0.004), jawPoint(O, A, 0.29, 0.008)],
      0.092,
      0.052,
      PALETTE.crocHide
    ),
    sph(0.052, PALETTE.crocHide, jawPoint(O, A, 0.3, 0.008), [1, 0.95, 0.95], 10),
    // The pale under-jaw, the crocodile's brightest note and the shape that reads the gape open.
    // Stretched along X because the jaw is near level now — a Y-stretched blob would cut across it.
    sph(0.07, PALETTE.crocBelly, jawPoint(O, A, 0.09, -0.05, 0.02), [1.4, 0.8, 0.5], 10),
    sph(0.056, PALETTE.crocBelly, jawPoint(O, A, 0.22, -0.04, 0.02), [1.35, 0.75, 0.5], 10),
    cyl(
      0.026,
      0.026,
      0.28,
      PALETTE.crocBelly,
      jawPoint(O, A, 0.15, 0.055, 0.04),
      [0, 0, A - Math.PI / 2],
      [1, 1, 0.6]
    ),
    // a tongue on the mouth floor, riding WITH the jaw — the one warm colour inside the head
    sph(0.05, PALETTE.petal, jawPoint(O, A, 0.12, 0.03, 0.02), [1.5, 0.6, 0.5], 8),
    ...toothRow(O, A, 1, 5, 0.06, 0.27, 0.065, 0.062, 0.021, 0.095),
  ])
}

const PEEK_HINGE: V3 = [-0.02, 0.36, 0]
/** 15°, which the rig's −0.2 rad root tilt lays back down to about 3° on screen. */
const PEEK_UPPER = 0.26
/** 3°: this one only works its jaw, so the gape stays between 12° and 19°. */
const PEEK_LOWER = 0.05

/**
 * The smaller crocodile: mostly skull, with just enough shoulder behind it to crop at the frame.
 * It is authored HIGHER and further into the frame than its partner, and the rig's −0.2 rad root
 * tilt cocks the whole animal, so a pair built from one construction reads as two creatures doing
 * two different things rather than as the same animal at two scales.
 */
function crocPeekBody(d: 1 | -1): ClayPart[] {
  const H = PEEK_HINGE
  const A = PEEK_UPPER
  return facing(d, [
    sph(0.145, PALETTE.crocHide, [-0.2, 0.26, -0.01], [1.05, 1, 0.95], 12),
    sph(0.165, PALETTE.crocHide, [-0.36, 0.1, -0.01], [1.05, 1, 0.95], 12),
    sph(0.145, PALETTE.crocHide, [-0.5, -0.06, -0.01], [1.02, 1, 0.95], 12),
    ...limb(
      [
        [-0.48, -0.08, -0.01],
        [-0.54, -0.18, -0.02],
        [-0.56, -0.28, -0.03],
      ],
      0.1,
      0.042,
      PALETTE.crocHide
    ),
    sph(0.155, PALETTE.crocShade, [-0.4, 0.02, 0.06], [1.3, 0.62, 0.55], 12),
    sph(0.1, PALETTE.crocBelly, [-0.22, 0.14, 0.1], [1.3, 0.66, 0.5], 10),
    ...scutes([
      [-0.14, 0.4, 1.9, 0.05],
      [-0.28, 0.28, 2, 0.055],
      [-0.42, 0.13, 2.1, 0.05],
      [-0.52, -0.03, 2.2, 0.04],
      [-0.57, -0.2, 2.3, 0.032],
    ]),
    ...crocSkull(H, A, 0.86, [0.03, 0.5, 0.13]),
    ...toothRow(H, A, -1, 5, 0.05, 0.27, 0.066, 0.062, 0.02, 0.026),
  ])
}

/** Its mandible, barely parted: the rig only works this one through a few degrees. */
function crocPeekJaw(d: 1 | -1): ClayPart[] {
  const O: V3 = [0, 0, 0]
  const A = PEEK_LOWER
  return facing(d, [
    ...limb(
      [jawPoint(O, A, -0.02, 0), jawPoint(O, A, 0.13, 0.004), jawPoint(O, A, 0.25, 0.008)],
      0.082,
      0.046,
      PALETTE.crocHide
    ),
    sph(0.046, PALETTE.crocHide, jawPoint(O, A, 0.26, 0.008), [1, 0.95, 0.95], 10),
    sph(0.062, PALETTE.crocBelly, jawPoint(O, A, 0.12, -0.045, 0.02), [1.5, 0.7, 0.5], 10),
    ...toothRow(O, A, 1, 4, 0.05, 0.22, 0.05, 0.048, 0.019, 0.085),
  ])
}

/**
 * The forefoot hooked over the mangrove crown. Hinged separately so the rig's second channel can
 * rock it — a crocodile shifting its grip is the whole read of "waiting", and it is also what ties
 * the character to the dressing instead of leaving it floating beside it.
 */
function crocPeekFoot(d: 1 | -1): ClayPart[] {
  return facing(d, [
    cyl(0.048, 0.06, 0.18, PALETTE.crocHide, [-0.03, -0.06, 0.02], [0, 0, 0.5]),
    sph(0.056, PALETTE.crocShade, [-0.06, -0.11, 0.05], [1.2, 0.8, 0.8], 8),
    ...foot(-0.1, -0.16, 0.3),
  ])
}

export function deltaPieces(kind: 'crocGape' | 'crocPeek', dir: 1 | -1): PeekerPiece[] {
  return kind === 'crocGape'
    ? [
        { slot: 'body', at: [0, 0, 0], parts: crocGapeBody(dir), ink: true },
        { slot: 'a', at: [GAPE_HINGE[0] * dir, GAPE_HINGE[1], 0.02], parts: crocGapeJaw(dir), ink: true },
      ]
    : [
        { slot: 'body', at: [0, 0, 0], parts: crocPeekBody(dir), ink: true },
        { slot: 'a', at: [PEEK_HINGE[0] * dir, PEEK_HINGE[1], 0.02], parts: crocPeekJaw(dir), ink: true },
        { slot: 'b', at: [-0.16 * dir, -0.2, 0.14], parts: crocPeekFoot(dir), ink: true },
      ]
}
