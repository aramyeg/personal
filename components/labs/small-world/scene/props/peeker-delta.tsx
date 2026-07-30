import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leaf, leafFan, limb, sph, strand, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the DELTA checkpoint: a mangrove thicket standing in still swamp water, with two
 * CROCODILES lurking in it.
 *
 * Same corner grammar as `peeker-jungle.tsx` (which the look-dev gate was run against): woody
 * limbs sweeping in from the frame's outer edge, a dense canopy of ribbed leaves, strands hanging
 * off the bough, and the characters sitting IN the dressing rather than in front of it. What is delta
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
 *
 * The band cuts the other way too, and that is the trap this corner fell into: an element authored
 * to hang from a branch at x = −0.7, or to stand on a bank at y = −1.0, keeps its own body on
 * screen while its ATTACHMENT is cropped away — and a moss chain or a reed with no visible footing
 * reads as a rendering fault, not as swamp. So every strand here hangs off bark the reader can see,
 * every reed and tuft is buried in a bank crest that clears y = −0.92, and the lotus is stemmed
 * into a pad. That is the same rule the jungle's orchids are held to.
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
    // A stilt root forking OFF the trunk and dropping past the bottom edge. Its top point is set
    // inside the trunk's own radius rather than just short of it: a prop root that starts in clear
    // sky beside the trunk is the same defect as a floating strand, only woodier.
    ...limb(
      [
        [-0.575, -0.1, -0.1],
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
    // The bough carrying the canopy, run all the way across to x = 0.3 so it ends OVER the animals
    // rather than stopping above their shoulders. Everything that hangs — the two inward moss
    // strands and the inward canopy fan — is seated on a span of this bark, so its attachment is on
    // screen; anything hung past the old end at x = 0.04 had nothing above it but sky.
    ...limb(
      [
        [-0.5, 0.24, -0.12],
        [-0.26, 0.48, -0.13],
        [0.04, 0.6, -0.13],
        [0.3, 0.56, -0.13],
      ],
      0.034,
      0.018,
      PALETTE.mangroveBark
    ),
    // wet moss collaring the joints — the tone break that stops the bark reading as one brown bar
    sph(0.074, PALETTE.deltaMoss, [-0.56, -0.66, 0.02], [1.2, 0.8, 0.5], 8),
    sph(0.06, PALETTE.mossHang, [-0.5, 0.24, -0.09], [1.1, 0.9, 0.5], 8),
    sph(0.068, PALETTE.deltaMoss, [-0.23, -0.32, 0.06], [1.3, 0.7, 0.5], 8),
  ]

  // Canopy: overlapping fans arcing over and BEHIND the crocodiles, at z ≈ −0.14. Density is the
  // point — sparse fans read as leaves on a stick. Each fan's spread stops short of π so no leaf
  // swings out past the frame edge; that is what the outward reach used to be spent on.
  //
  // Every fan origin is either on the trunk/bough or buried inside the leaves of the fan beside it,
  // so the canopy is one connected mass. The inward fan used to originate at (0.36, 0.16) — behind
  // the big crocodile's jaw, touching nothing — and read as a leaf spray hanging in the sky next to
  // the animal's head; it now hangs off the end of the bough with the rest of the canopy.
  parts.push(
    ...leafFan([-0.36, 0.6, -0.14], 5, 0.42, [0.45, 2.15], greens, PALETTE.jungleDeep, 0.34),
    ...leafFan([-0.08, 0.74, -0.15], 5, 0.42, [0.3, 2], greens, PALETTE.jungleDeep, 0.32),
    ...leafFan([0.3, 0.62, -0.14], 4, 0.36, [0.1, 1.7], greens, PALETTE.jungleDeep, 0.3),
    ...leafFan([-0.34, 0.2, -0.12], 4, 0.28, [1.7, 2.7], greens, PALETTE.jungleDeep, 0.32),
    ...leafFan([0.28, 0.5, -0.14], 4, 0.34, [-0.7, 0.7], greens, PALETTE.jungleDeep, 0.28)
  )

  // Hanging moss — the delta's answer to the jungle's vines. Each y is picked so the TOP BEAD sits
  // inside the trunk or the bough at that height, which is stricter than starting near it: below
  // the first bead the chain is free to drift and to disappear behind the animal, but the reader
  // has to be able to see where it is caught.
  //
  // A fourth strand hung in FRONT at z 0.24 is gone rather than reseated. There is nothing overhead
  // at that depth to catch it, and the lily pads already carry the front layer — they at least have
  // a pad to sit on.
  //
  // WHY THE THIRD ONE IS SHORT, and it is the rule the whole corner is now held to. This dressing
  // is MIRRORED for the right-hand corner but the two crocodiles are NOT the same build: crocGape
  // lies low with its skull topping out around y ≈ 0.49, while crocPeek sits higher and further in
  // (its brow reaches y ≈ 0.54 once the rig's root tilt is applied) and its snout crosses the bough
  // tip. So a chain authored against the big crocodile hangs past the small one's head on the other
  // side: the run it was caught on is covered, the beads that clear the snout are not, and what is
  // left is three peas in open sky. `step` is per-strand for exactly that reason — the clear gap
  // between the bark and the TALLER of the two skulls is what a strand is allowed to be, and at the
  // bough's tip that gap is about 0.15 rather than the 0.4 the outer trunk has. A strand may still
  // run out of sight behind an animal at its FREE end; what it may not do is lose its anchor, or
  // vanish and re-appear below a head.
  for (const [mx, my, mz, n, step, r, drift] of [
    [-0.47, 0.34, -0.11, 5, 0.1, 0.028, 0.01],
    [-0.14, 0.53, -0.13, 5, 0.1, 0.026, -0.01],
    [0.25, 0.552, -0.13, 3, 0.068, 0.026, 0.014],
  ] as const) {
    parts.push(...strand([mx, my, mz], n, step, r, PALETTE.mossHang, drift, 0.86))
  }

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

  // The water itself: flat silt slabs crossing the bottom edge. Without them the pads and the roots
  // float in the sky, which is the one thing a swamp corner must not do.
  //
  // The last two are RAISED crests, one per half, and they are what the whole understory is rooted
  // in. Each is set so its top edge (y ≈ −0.80 outward, −0.77 inward) clears the frame's bottom at
  // y ≈ −0.92 by a readable margin: a bank that crops away entirely still holds a reed up in the
  // geometry, but on screen the reed is standing on nothing. The outer crest is the new one — that
  // half of the corner had no visible bed at all, which is how its reeds came to float.
  parts.push(
    sph(0.4, PALETTE.deltaSilt, [-0.14, -1, -0.06], [1.15, 0.38, 0.5], 10),
    sph(0.28, PALETTE.deltaSand, [0.34, -0.98, -0.04], [1.1, 0.4, 0.5], 10),
    sph(0.26, PALETTE.deltaSand, [-0.3, -0.88, -0.09], [1.2, 0.34, 0.5], 10),
    sph(0.28, PALETTE.deltaSilt, [0.36, -0.86, -0.11], [1.2, 0.34, 0.5], 10)
  )

  // Reeds and tufts pushing up out of the shallows, and two seed heads that break their line. Reeds
  // are the only vertical in the understory, so they carry the eye from the water back up to the
  // canopy — but only if the eye can follow them DOWN to a footing. Every base here is set below
  // the crest of the bank it stands in; the outer pair used to start a third of a figure-height
  // clear of the silt, which at reading size is a green bar hanging in open water. Passing BEHIND a
  // lily pad on the way up is fine — the base stays visible below the pad's lower edge — which is
  // what the long inner reed is doing, and why it is long.
  parts.push(
    ...tufts([-0.44, -0.84, -0.06], 0.17, 6, PALETTE.reedGreen, 0.28, 0.72, 1.3),
    ...tufts([0.22, -0.84, -0.08], 0.22, 5, PALETTE.deltaMoss, 0.24, 0.78, 1.35),
    cyl(0.012, 0.016, 0.3, PALETTE.reedGreen, [-0.441, -0.712, -0.08], [0, 0, 0.14]),
    cyl(0.026, 0.022, 0.1, PALETTE.stiltRoof, [-0.47, -0.515, -0.08], [0, 0, 0.12]),
    cyl(0.014, 0.018, 0.5, PALETTE.reedGreen, [0.55, -0.645, -0.06], [0, 0, -0.2]),
    cyl(0.028, 0.024, 0.11, PALETTE.stiltRoof, [0.61, -0.352, -0.06], [0, 0, -0.18])
  )

  // A lotus, the one warm note in an olive corner. Its stem BRIDGES — lower end buried in the pad at
  // (0.06, −0.44), upper end inside the bloom — so a visible length of stem connects the flower to
  // the thing it grows out of. The stem used to hang BELOW the pad into open water, which anchors
  // nothing and reads as a stray bubble on a stick.
  parts.push(
    cyl(0.012, 0.014, 0.1, PALETTE.reedGreen, [0.205, -0.36, 0.27], [0, 0, 0.08]),
    sph(0.06, PALETTE.blossom, [0.21, -0.29, 0.28], [1, 0.9, 0.6], 8),
    cone(0.034, 0.11, PALETTE.petal, [0.15, -0.26, 0.28], [0, 0, 0.6], [1, 1, 0.5], 6),
    cone(0.032, 0.1, PALETTE.petal, [0.27, -0.26, 0.28], [0, 0, -0.6], [1, 1, 0.5], 6),
    sph(0.024, PALETTE.honey, [0.21, -0.26, 0.31], undefined, 6)
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

// --- the snake --------------------------------------------------------------

/**
 * Task 61 — the small crocodile is replaced by a SNAKE, coiled on the mangrove with its head
 * raised. Aram: "instead of 2 crocs we can show 1 crocodile and 1 snake."
 *
 * WHY IT IS AMBER AND NOT GREEN, which is the first thing anyone will ask. A green snake is the
 * obvious swamp animal, and it is the wrong call here for a reason this cast has already been
 * burned by once: the canyon's first pangolin was drawn in the same brown family as the ledge and
 * the hoodoo behind it, and the review's verdict was that the animal "camouflages into its own
 * dressing". This corner is already crowded with green — `jungleCanopy`, `jungleDeep`,
 * `jungleMoss`, `deltaMoss`, `reedGreen` in the leaves, and a crocodile in `crocHide` olive right
 * beside it. Another green animal there is a green shape on a green shape.
 *
 * So the snake is a warm amber constrictor with dark saddles. It separates from every green in the
 * corner by HUE rather than by value, it separates from the mangrove's `mangroveBark` by being four
 * times lighter, and it puts a second warm note in an olive corner next to the lotus. It is also a
 * real animal drawn plainly — a boa's saddled back is one of the most recognisable patterns there
 * is, which matters more at corner size than species accuracy to a river delta.
 *
 * CLAY-CUTE, NOT MENACING, per the brief. Everything that would make a snake threatening is
 * deliberately absent: no fangs, no slit pupil, no open strike pose, no rearing S. The head is
 * blunt rather than wedge-sharp, the eye is a big round honey bead, and the mouth line curves UP at
 * the corner. What is left is a curious animal watching the reader over its own coils.
 */

/** The body's tone at a point along its length — dark on top, amber on the side, pale beneath. */
const COIL_TOP = PALETTE.boaSaddle
const COIL_SIDE = PALETTE.boaCoil
const COIL_UNDER = PALETTE.boaBelly

/**
 * The coil, as three overlapping runs rather than one tapering limb.
 *
 * `limb` tapers linearly from end to end, which is exactly wrong for a snake: a snake is thin at
 * the tail, thickest about a third of the way up the body, and narrows again into the neck. Drawn
 * as a single taper it reads as a rope or a root — and this corner is FULL of mangrove roots, which
 * is the one thing the animal must not be mistaken for. Three runs with their own end radii give it
 * a real girth curve, and the joins are hidden inside the loops.
 *
 * The path is set by the dressing, not by taste. It enters behind the mangrove arch's outward
 * descent, crosses the crown (which `deltaDressing` describes as sitting at the animals' own
 * waistline and which the crocodile also hooks a foot over), loops OUT and down toward the trunk
 * climbing the frame edge, comes back up inside it, and rises into the neck. Every part of it is
 * either lying on bark the reader can see or passing behind a lily pad — the corner's standing rule
 * is that nothing may be caught on something off-screen.
 */
const COIL_TAIL: readonly V3[] = [
  [0.34, -0.5, -0.05],
  [0.2, -0.4, -0.02],
  [0.06, -0.34, 0.02],
]
const COIL_MID: readonly V3[] = [
  [0.06, -0.34, 0.02],
  [-0.16, -0.42, 0.06],
  [-0.4, -0.4, 0.08],
  [-0.55, -0.24, 0.07],
]
const COIL_NECK: readonly V3[] = [
  [-0.55, -0.24, 0.07],
  [-0.5, -0.02, 0.08],
  [-0.28, 0.06, 0.11],
  [-0.06, 0.06, 0.12],
  [0.03, 0.2, 0.1],
]

/**
 * One dark SADDLE straddling the body: a squashed ellipsoid rolled to the body's local direction
 * and set proud of it, so it draws over the amber rather than being swallowed by it.
 *
 * These are the pattern, and the pattern is the species. Without them an amber tube is a tube; the
 * saddles are what make the eye follow the body around its own loops and read the overlap as a
 * coil rather than as a knot of separate sausages. Each is a little wider than the body it sits on
 * for the same reason the yeti's tone patches are authored proud of their host — a patch level with
 * its surface loses the depth test and never draws at all.
 */
function saddle(at: V3, r: number, a: number, wide = 1.05): ClayPart {
  return { ...sph(r, COIL_TOP, at, [0.46, wide, 0.86], 8), rot: [0, 0, a] as V3 }
}

/**
 * The coiled body: the run, its belly bands, its saddles, and the neck rising out of the front loop.
 *
 * The OUTWARD reach is deliberate rather than incidental. The retired small crocodile was what held
 * `MASCOT_BOX.out` honest — the envelope suite fails a box left slack by more than 0.08 — so the
 * outer loop is run to the same band the crocodile's flank used to occupy. A snake is the right
 * animal to spend that reach on: a coil naturally runs out toward the frame edge and crops there,
 * where a compact animal would have had to be stretched to hold the number.
 */
function snakeBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // The three runs. Radii step 0.052 → 0.086 → 0.062 → 0.038: thin tail, heavy mid-body, neck
    // narrowing into the skull.
    ...limb(COIL_TAIL, 0.07, 0.03, COIL_SIDE, 9),
    ...limb(COIL_MID, 0.086, 0.072, COIL_SIDE, 9),
    ...limb(COIL_NECK, 0.062, 0.036, COIL_SIDE, 9),
    // The front loop's near face, pushed toward the camera so the coil OVERLAPS itself. A coil
    // drawn all at one depth is a flat spiral; the overlap is the whole illusion of a wound body,
    // and it needs a z step bigger than the body's own radius to survive the toon ramp.
    sph(0.088, COIL_SIDE, [-0.3, -0.38, 0.16], [1.5, 0.92, 0.7], 10),
    sph(0.082, COIL_SIDE, [-0.09, -0.3, 0.17], [1.4, 0.9, 0.7], 10),
    // BELLY BANDS along the underside of the near loop — a snake's ventral scutes are one wide pale
    // band per scale row, and they are the only place the pale tone is allowed to spend area. They
    // sit on the loop's lower edge, which is the surface a reader looking slightly down actually
    // sees.
    ...[
      [-0.44, -0.45, 0.13, 0.055, 0.26],
      [-0.28, -0.47, 0.17, 0.06, 0.1],
      [-0.11, -0.4, 0.18, 0.056, -0.12],
      [0.04, -0.4, 0.12, 0.05, -0.3],
      [0.19, -0.45, 0.06, 0.042, -0.5],
    ].map(([x, y, z, r, a]) => ({
      ...sph(r, COIL_UNDER, [x, y, z], [1.7, 0.44, 0.6], 8),
      rot: [0, 0, a] as V3,
    })),
    // Saddles down the back, following the loops. They crowd where the body is thick and thin out
    // toward the tail, which is what a real pattern does and what keeps the row from reading as a
    // ladder painted on a hose.
    saddle([0.29, -0.46, -0.01], 0.05, 0.6),
    saddle([0.145, -0.355, 0.04], 0.078, 0.3, 1.25),
    saddle([0.055, -0.335, 0.07], 0.045, 0.1, 0.8),
    saddle([-0.055, -0.36, 0.09], 0.086, -0.1, 1.3),
    saddle([-0.155, -0.42, 0.1], 0.048, 0.2, 0.75),
    saddle([-0.265, -0.445, 0.11], 0.09, 0.34, 1.28),
    saddle([-0.43, -0.42, 0.11], 0.082, -0.16, 1.2),
    // This one is the figure's outermost primitive and therefore what holds `MASCOT_BOX.out`
    // honest for the whole cast now that the small crocodile is gone. Its x is set from the box
    // rather than from the curve: a saddle is an ellipsoid ROLLED to the body's direction, so at
    // this angle its long axis contributes most of its reach and it costs 0.11 outward rather than
    // the 0.04 its own half-width suggests.
    saddle([-0.545, -0.28, 0.1], 0.078, 1.2),
    saddle([-0.53, -0.06, 0.11], 0.066, 1.5, 1.2),
    saddle([-0.415, 0.03, 0.13], 0.038, 0.9, 0.8),
    saddle([-0.31, 0.07, 0.14], 0.062, 0.2, 1.25),
    saddle([-0.19, 0.055, 0.15], 0.036, 0.0, 0.8),
    saddle([-0.085, 0.075, 0.15], 0.056, -0.1, 1.2),
    saddle([0.01, 0.17, 0.13], 0.05, 1.1, 1.3),
    // A shaded strip along the coil's underside where it meets the mangrove — the drawn contact
    // that stops a heavy body hovering over the bark it is supposed to be resting its weight on.
    // In the snake's OWN dark tone rather than the crocodile's `crocShade`, which is what it was
    // first drawn in: the two animals share a corner, and every tone they share is a step back
    // toward the one-species pair this recast exists to break up.
    sph(0.1, PALETTE.boaSaddle, [-0.34, -0.5, 0.02], [1.9, 0.34, 0.5], 10),
    sph(0.09, PALETTE.boaSaddle, [0.1, -0.44, -0.02], [1.6, 0.32, 0.5], 10),
  ])
}

/**
 * The raised head, hinged at the base of the SKULL rather than at the base of the neck.
 *
 * That choice is forced by the scene graph. The rig gives a figure three sibling limb groups, not a
 * chain — so the tongue (slot `b`) cannot be parented to the head (slot `a`), and every degree the
 * head swings drags the mouth out from under a tongue pinned in the figure's own frame. Hinging at
 * the skull base keeps the lever arm to about 0.18, so `applyFlick`'s widest yaw moves the lip by
 * roughly 0.03 — less than the depth the tongue's root is buried at, which is what makes the cheat
 * invisible. Hinging at the neck base would have tripled that and torn the tongue off the face.
 */
function snakeHead(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // The skull: a BLUNT wedge. A sharply tapered head is the whole difference between a viper and
    // a constrictor, and between menacing and cute — the brief asks for the second.
    sph(0.085, COIL_SIDE, [0.02, 0.0, 0.0], [1.15, 0.95, 0.92], 12),
    sph(0.075, COIL_SIDE, [0.13, -0.01, 0.01], [1.2, 0.82, 0.9], 12),
    sph(0.055, COIL_SIDE, [0.215, -0.025, 0.015], [1.15, 0.7, 0.85], 10),
    // the snout's rounded end, kept in the body tone: a cone tapers to a point, and whatever is put
    // at a cone's tip becomes the tip — the canyon's pangolin lost its snout to exactly that
    sph(0.04, COIL_SIDE, [0.255, -0.035, 0.015], [0.9, 0.72, 0.85], 10),
    // pale throat and chin, the underside tone carried up onto the head so the two rhyme
    sph(0.05, COIL_UNDER, [0.11, -0.045, 0.06], [1.7, 0.3, 0.5], 10),
    // The crown saddle and a dark temporal stripe running back from the eye. The stripe is the
    // second-strongest snake cue after the pattern itself, and it also does a job: it separates the
    // eye bead from the jaw line so the head does not read as one amber lozenge with a dot on it.
    saddle([0.03, 0.045, 0.02], 0.055, 0.1, 1.25),
    { ...sph(0.05, COIL_TOP, [0.1, 0.012, 0.06], [1.6, 0.3, 0.5], 8), rot: [0, 0, -0.12] as V3 },
    // The MOUTH: a fine dark line along the jaw, curving UP at its rear corner. The lift is the
    // entire difference between a neutral reptile and a friendly one, and it is the same device the
    // yeti's two ink ticks use at the corners of its smile.
    ...limb(
      [
        [0.255, -0.042, 0.05],
        [0.15, -0.052, 0.07],
        [0.05, -0.038, 0.06],
        [-0.02, 0.005, 0.04],
      ],
      0.01,
      0.012,
      PALETTE.ink
    ),
    // two nostril ticks on the snout's top corner
    sph(0.011, PALETTE.ink, [0.255, 0.0, 0.045], undefined, 6),
    // The eye: big, round and forward. `honey` is the cast's warm-eye tone — the crocodile beside it
    // and the retired yeti both wear it — so the two delta animals look at the reader with the same
    // eye, which is what makes them a pair rather than two unrelated props.
    ...eye([0.13, 0.035, 0.075], 0.05, { sclera: PALETTE.honey, iris: PALETTE.ink }),
    // A brow ridge over it, in the crown's dark tone. Snakes have no brow; this one has a suggestion
    // of one because without it the eye sits on a smooth curve and reads as a bead stuck on the
    // side of a tube rather than as an eye set into a skull.
    { ...sph(0.042, COIL_TOP, [0.14, 0.078, 0.05], [1.5, 0.42, 0.6], 8), rot: [0, 0, 0.16] as V3 },
  ])
}

/**
 * The forked tongue, driven by a SCALE rather than a hinge.
 *
 * A tongue has to appear from inside a closed mouth. Swung on a hinge it would sweep out THROUGH
 * the jaw, which is visible from this camera; scaled along its own axis it grows out of the lip,
 * which is what a real flick looks like. `applyFlick` holds it at 0.24 for half the idle cycle and
 * shoots it to full over the other half — retracted, the whole thing collapses to under 0.04 and
 * disappears inside the mouth it is rooted in.
 *
 * It is authored from x = −0.02 (INSIDE the lip) so that even at full extension its root is buried,
 * and so the head's own small swing cannot pull the join into the open.
 */
function snakeTongue(d: 1 | -1): ClayPart[] {
  return facing(d, [
    cyl(0.008, 0.011, 0.09, PALETTE.petal, [0.025, 0, 0], [0, 0, Math.PI / 2]),
    cone(0.008, 0.055, PALETTE.petal, [0.093, 0.016, 0], [0, 0, -1.28], [1, 1, 0.8], 6),
    cone(0.008, 0.055, PALETTE.petal, [0.093, -0.016, 0], [0, 0, -1.86], [1, 1, 0.8], 6),
  ])
}

/** Where the skull hinges off the neck, and where the tongue is pinned at the lip. */
const SNAKE_HEAD_AT: V3 = [0.03, 0.28, 0.1]
const SNAKE_TONGUE_AT: V3 = [0.28, 0.245, 0.115]

export function deltaPieces(kind: 'crocGape' | 'snake', dir: 1 | -1): PeekerPiece[] {
  return kind === 'crocGape'
    ? [
        { slot: 'body', at: [0, 0, 0], parts: crocGapeBody(dir), ink: true },
        { slot: 'a', at: [GAPE_HINGE[0] * dir, GAPE_HINGE[1], 0.02], parts: crocGapeJaw(dir), ink: true },
      ]
    : [
        { slot: 'body', at: [0, 0, 0], parts: snakeBody(dir), ink: true },
        { slot: 'a', at: [SNAKE_HEAD_AT[0] * dir, SNAKE_HEAD_AT[1], SNAKE_HEAD_AT[2]], parts: snakeHead(dir), ink: true },
        // no `ink` on the tongue: only the first INK_PIECE_LIMIT pieces are ever drawn with a
        // contour, so the flag would be inert here — and an inert flag reads as a live one. It is
        // also much too small to want one; an outlined tongue would be a black stroke.
        { slot: 'b', at: [SNAKE_TONGUE_AT[0] * dir, SNAKE_TONGUE_AT[1], SNAKE_TONGUE_AT[2]], parts: snakeTongue(dir) },
      ]
}
