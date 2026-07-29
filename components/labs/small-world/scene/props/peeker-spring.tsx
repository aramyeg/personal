import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leafFan, limb, sph, strand, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the SPRING checkpoint (ch0): blossom boughs arcing in from the frame's corner, with a
 * bluebird and a robin perched in them.
 *
 * Built to the pattern the jungle set at the look-dev gate — a woody limb sweeping in from the
 * outer edge, a second limb climbing it, foliage wrapping INWARD and UNDER the character, and the
 * bird's feet actually gripping the perch. What differs is the mix: a cherry bough carries its
 * blossom before its leaves, so here the clusters are the dense element and the greens are the
 * sparse one, which is the reverse of the jungle canopy and is what stops chapter 0 reading as the
 * jungle recoloured pink.
 */

/**
 * The perch. Its height under the feet is the one number the birds depend on: the bough surface
 * sits at y ≈ −0.47 across x ∈ [−0.16, +0.02], which is where both characters' claws close.
 *
 * VISIBLE BAND: the frame's outer edge is at local x = −0.64 and its bottom at y ≈ −0.92, so the
 * bough is thick where it crops off-frame at the lower left and everything worth looking at is
 * authored inboard of that. The failure this guards against is the one the first look-dev pass hit
 * — dressing authored past the edge is simply thrown away and the corner reads as a bird on a stick.
 */
const BOUGH: readonly V3[] = [
  [-0.63, -0.83, -0.05],
  [-0.4, -0.62, -0.03],
  [-0.1, -0.52, 0],
  [0.28, -0.45, 0.02],
  [0.66, -0.42, 0.02],
]

/** The limb climbing the outer edge behind the birds — the corner's vertical, and what most of the
 *  upper blossom hangs off. Kept at z ≈ −0.14 so it passes BEHIND a character's head. */
const RISER: readonly V3[] = [
  [-0.62, -0.78, -0.13],
  [-0.58, -0.34, -0.15],
  [-0.5, 0.12, -0.15],
  [-0.34, 0.54, -0.12],
  [-0.14, 0.82, -0.1],
]

/**
 * One blossom: a ring of flattened petals around a honey centre, deliberately authored as a
 * cluster rather than a disc so the toon ramp still finds edges between the petals at reading size.
 *
 * `at` is always a point ON a limb. The jungle file's orchids record the lesson and it applies
 * doubly here, where a bloom is small and pale: a cluster floating clear of any twig does not read
 * as a flower, it reads as a stray bubble beside the bird's beak.
 */
function bloom(at: V3, r: number, petal: string, n: number, phase: number): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const a = phase + (Math.PI * 2 * i) / n
    out.push(
      sph(
        r * 0.6,
        petal,
        [at[0] + Math.cos(a) * r * 0.68, at[1] + Math.sin(a) * r * 0.68, at[2] - 0.005 * i],
        [1, 1, 0.4],
        8
      )
    )
  }
  out.push(sph(r * 0.28, PALETTE.honey, [at[0], at[1], at[2] + r * 0.34], undefined, 6))
  return out
}

export function springDressing(): ClayPart[] {
  const greens = [PALETTE.springGreen, PALETTE.meadow, PALETTE.leaf, PALETTE.sprout]
  const parts: ClayPart[] = [
    ...limb(BOUGH, 0.068, 0.032, PALETTE.earth),
    ...limb(RISER, 0.05, 0.02, PALETTE.earth),
    // Twigs, each one carrying a cluster. They fan out at z ≈ −0.13 (behind the birds) except the
    // drooping one, which is the only piece allowed in FRONT of a character and is kept below the
    // perch so it never crosses a face.
    ...limb(
      [
        [-0.56, -0.2, -0.14],
        [-0.4, 0.02, -0.13],
        [-0.22, 0.16, -0.12],
      ],
      0.024,
      0.01,
      PALETTE.earth
    ),
    ...limb(
      [
        [-0.44, 0.36, -0.14],
        [-0.16, 0.52, -0.13],
        [0.14, 0.6, -0.12],
      ],
      0.026,
      0.011,
      PALETTE.earth
    ),
    ...limb(
      [
        [0.52, -0.44, 0],
        [0.58, -0.12, -0.04],
        [0.56, 0.22, -0.08],
      ],
      0.028,
      0.012,
      PALETTE.earth
    ),
    ...limb(
      [
        [-0.02, -0.58, 0.06],
        [0.06, -0.86, 0.07],
        [0.02, -1.1, 0.06],
      ],
      0.022,
      0.01,
      PALETTE.earth
    ),
    // a stub crossing the outer/bottom corner, so the bough reads as cropped rather than as ending
    ...limb(
      [
        [-0.56, -0.58, -0.1],
        [-0.63, -0.86, -0.08],
      ],
      0.024,
      0.013,
      PALETTE.earth
    ),
    // lichen patch at the fork — the one tone break on an otherwise uniform bark mass
    sph(0.08, PALETTE.sprout, [-0.57, -0.7, 0.02], [1.2, 0.75, 0.5], 8),
  ]

  // Foliage: sparse by design (see the header), and placed to frame the birds rather than bury
  // them — an arc behind the riser, a cap over the top twig, and two clumps under the perch.
  parts.push(
    ...leafFan([-0.42, 0.06, -0.16], 4, 0.3, [1.8, 3.1], greens, PALETTE.foliageDeep, 0.32),
    ...leafFan([-0.3, 0.48, -0.17], 4, 0.32, [0.6, 2.3], greens, undefined, 0.32),
    ...leafFan([0.14, 0.6, -0.16], 3, 0.28, [0.3, 1.5], greens, undefined, 0.3),
    ...leafFan([0.48, 0.06, -0.14], 3, 0.28, [0.15, 1.5], greens, undefined, 0.3),
    ...leafFan([-0.28, -0.78, 0.05], 4, 0.3, [2.9, 4.5], greens, undefined, 0.3),
    ...leafFan([0.36, -0.66, 0.04], 3, 0.28, [3.4, 4.9], greens, undefined, 0.28)
  )

  // Blossom. Every centre below lies on one of the limbs above; the phases are hand-set so no two
  // neighbouring clusters land their petals in the same rosette, which is what would make a row of
  // them read as one repeated stamp.
  parts.push(
    ...bloom([-0.55, -0.72, 0.03], 0.1, PALETTE.blossom, 5, 0.3),
    ...bloom([0.48, -0.38, 0.05], 0.095, PALETTE.snow, 5, 1.1),
    ...bloom([-0.54, -0.08, -0.08], 0.085, PALETTE.blossomRose, 4, 0.5),
    ...bloom([-0.4, 0.4, -0.06], 0.1, PALETTE.blossom, 5, 1.9),
    ...bloom([-0.18, 0.76, -0.08], 0.085, PALETTE.snow, 4, 0.9),
    ...bloom([0.57, -0.04, 0.01], 0.085, PALETTE.petal, 4, 0.2),
    // the one cluster in front of the composition, riding the drooping twig past the bottom edge
    ...bloom([0.05, -0.82, 0.11], 0.09, PALETTE.blossom, 4, 1.4)
  )

  // Unopened buds — single beads on a twig. Cheap, and they are what makes the blossom read as a
  // living branch at several stages rather than a set of identical rosettes.
  parts.push(
    sph(0.036, PALETTE.blossomDeep, [-0.31, 0.55, -0.09], [1, 1.25, 0.7], 8),
    sph(0.032, PALETTE.petal, [0.56, 0.22, -0.03], [1, 1.25, 0.7], 8),
    sph(0.034, PALETTE.blossomDeep, [-0.45, -0.6, -0.06], [1, 1.25, 0.7], 8),
    sph(0.03, PALETTE.blossom, [0.24, -0.47, 0.06], [1, 1.25, 0.7], 8)
  )

  // A seed catkin swinging off the perch and out of frame — the only moving-looking thing in a
  // composition that is otherwise all held branches.
  parts.push(...strand([-0.22, -0.6, 0.06], 5, 0.088, 0.026, PALETTE.sprout, 0.014))

  return parts
}

/**
 * Songbird feet: three toes closing on the bough, finer than the jungle parrots' grip because a
 * bluebird's foot is a wire next to a macaw's. Without the toes wrapping the limb the bird hovers
 * over its own perch, which is the single most obvious tell at this size.
 */
function claws(x: number, y: number, color: string): ClayPart[] {
  return [
    cyl(0.022, 0.028, 0.11, color, [x, y + 0.06, 0.02], [0, 0, 0.1]),
    sph(0.03, color, [x, y, 0.03], [1.35, 0.66, 1], 8),
    cone(0.014, 0.08, color, [x + 0.055, y - 0.012, 0.045], [0, 0, -1.95], undefined, 6),
    cone(0.014, 0.075, color, [x - 0.05, y - 0.012, 0.04], [0, 0, 1.95], undefined, 6),
    cone(0.012, 0.062, color, [x + 0.02, y - 0.022, 0.075], [0, 0, -2.5], undefined, 6),
  ]
}

/**
 * Bluebird. The read at 300px is: ink-outlined periwinkle mass, a clean white belly cutting it in
 * half, a short dark wedge of a bill and a head cocked UP.
 *
 * The white belly is doing the same job the macaw's face patch does — an all-blue bird collapses
 * into one silhouette under the four-band ramp, and the horizontal colour break is what gives it a
 * front and a back. `iceDeep` is the shade step: `bluebell` is a light periwinkle with nothing
 * below it in the palette, and `hareShade` (the other cool grey) is *lighter* than it, so the only
 * existing tone that darkens this bird is the ice blue.
 */
function bluebirdBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // far wing, a sliver behind the body — it stops the near wing reading as the bird's whole side
    sph(0.15, PALETTE.iceDeep, [-0.16, -0.08, -0.15], [0.85, 1.2, 0.5], 10),
    // Body in three masses rather than one egg: blue mantle behind, white breast in front, and a
    // shaded vent beneath. A songbird is chest-forward, which the offsets carry.
    sph(0.24, PALETTE.bluebell, [-0.17, -0.18, -0.08], [0.95, 1.06, 0.84], 12),
    sph(0.235, PALETTE.bluebell, [-0.03, -0.01, -0.01], [1, 1, 0.94], 14),
    sph(0.265, PALETTE.snow, [-0.09, -0.22, 0.04], [1, 1.04, 0.9], 14),
    sph(0.19, PALETTE.hareShade, [-0.06, -0.38, 0.06], [1.15, 0.7, 0.58], 12),
    sph(0.15, PALETTE.iceDeep, [-0.25, -0.34, -0.02], [1, 0.9, 0.7], 10),
    // flank scallops: three beads along the seam where blue meets white, so the two masses read as
    // feathering into each other instead of as two balls stuck together
    sph(0.05, PALETTE.bluebell, [-0.2, -0.02, 0.06], [1.1, 0.7, 0.5], 8),
    sph(0.045, PALETTE.bluebell, [-0.23, -0.14, 0.05], [1.1, 0.7, 0.5], 8),
    sph(0.04, PALETTE.bluebell, [-0.24, -0.25, 0.04], [1.1, 0.7, 0.5], 8),
    // Tail: SHORT and swept down-back. The macaw's streamers were the jungle's silhouette; a
    // bluebird's stub is this one's, and it is half the reason the two spring birds don't twin.
    cone(0.08, 0.46, PALETTE.bluebell, [-0.35, -0.57, -0.04], [0, 0, 2.74], [1, 1, 0.38]),
    cone(0.055, 0.4, PALETTE.iceDeep, [-0.3, -0.56, 0.01], [0, 0, 2.6], [1, 1, 0.38]),
    sph(0.09, PALETTE.bluebell, [-0.28, -0.42, -0.02], [1.1, 0.9, 0.7], 10),
    // head, set forward and tipped up on a short neck
    sph(0.14, PALETTE.bluebell, [0.01, 0.19, -0.03], [1, 0.95, 0.9], 10),
    sph(0.235, PALETTE.bluebell, [0.08, 0.36, 0], [1, 1, 0.98], 14),
    // darker crown cap — the head is otherwise the same blue as the body and floats off it
    sph(0.13, PALETTE.iceDeep, [-0.01, 0.46, -0.05], [1.3, 0.6, 0.7], 10),
    // pale throat, carried up under the chin so the white front runs the whole height of the bird
    sph(0.125, PALETTE.snow, [0.16, 0.23, 0.13], [0.9, 0.86, 0.42], 12),
    ...eye([0.2, 0.4, 0.185], 0.052, { sclera: PALETTE.snow, iris: PALETTE.ink }),
    // Short STRAIGHT bill — an insect-eater's wedge, and the deliberate opposite of the robin's
    // fine yellow one. Two cones: dark upper over a paler lower, barely tipped down.
    cone(0.058, 0.24, PALETTE.ink, [0.3, 0.335, 0.06], [0, 0, -1.81], [1, 1, 0.82]),
    cone(0.04, 0.17, PALETTE.stone, [0.29, 0.3, 0.04], [0, 0, -1.72], [1, 1, 0.82]),
    sph(0.016, PALETTE.ink, [0.26, 0.36, 0.1], undefined, 6),
    ...claws(0.02, -0.45, PALETTE.stone),
    ...claws(-0.16, -0.47, PALETTE.stone),
  ])
}

/**
 * The near wing, FOLDED along the flank and hinged at the shoulder so the rig's idle lifts and
 * settles it — a perched bird stretching a wing, not one flapping in place. Same construction as
 * the jungle macaw's, with the pale shoulder bar taking the place of its yellow covert.
 */
function bluebirdWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.175, PALETTE.bluebell, [-0.05, -0.06, 0.02], [0.9, 1.16, 0.6], 12),
    sph(0.1, PALETTE.snow, [-0.02, 0.02, 0.08], [0.9, 0.6, 0.45], 10),
    sph(0.14, PALETTE.iceDeep, [-0.09, -0.24, 0.06], [0.92, 1.15, 0.5], 12),
    cone(0.07, 0.34, PALETTE.iceDeep, [-0.15, -0.45, 0.02], [0, 0, 0.3], [1, 1, 0.42]),
    cone(0.048, 0.24, PALETTE.bluebell, [-0.04, -0.42, 0.06], [0, 0, 0.12], [1, 1, 0.42]),
  ])
}

/**
 * Robin: warm brown above, a rust breast wrapping up over the throat, a dark cap and a fine yellow
 * bill. Plumper and lower-slung than the bluebird, with the tail COCKED UP instead of swept down —
 * silhouette, posture and bill all differ, which is what keeps a pair sharing one rig from reading
 * as the same bird twice.
 */
function robinBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.15, PALETTE.foxDark, [-0.17, -0.09, -0.15], [0.85, 1.2, 0.5], 10),
    sph(0.22, PALETTE.earth, [-0.2, -0.19, -0.07], [0.95, 1.05, 0.85], 12),
    sph(0.25, PALETTE.earth, [-0.05, -0.02, -0.03], [1, 1, 0.92], 14),
    // The breast is pushed forward and out of the brown, not painted onto it: at corner scale the
    // orange has to break the silhouette's front edge or it reads as a stripe rather than a chest.
    sph(0.26, PALETTE.foxFur, [0.02, -0.14, 0.06], [0.94, 1.06, 0.86], 14),
    sph(0.2, PALETTE.foxDark, [0.0, -0.36, 0.06], [1.1, 0.7, 0.62], 12),
    sph(0.2, PALETTE.plumeShade, [-0.11, -0.44, 0.03], [1.15, 0.6, 0.6], 12),
    // Tail cocked UP and back. It also lifts the whole rear silhouette clear of the perch, so the
    // plump body doesn't sit on the bough like a loaf.
    cone(0.075, 0.34, PALETTE.earth, [-0.39, -0.2, -0.05], [0, 0, 0.91], [1, 1, 0.4]),
    cone(0.05, 0.3, PALETTE.foxDark, [-0.36, -0.27, 0.02], [0, 0, 1.02], [1, 1, 0.4]),
    sph(0.09, PALETTE.earth, [-0.27, -0.24, -0.03], [1.1, 0.95, 0.75], 10),
    // head, carried low and forward — a robin listening at the ground, against the bluebird's lift
    sph(0.135, PALETTE.earth, [0.0, 0.16, -0.02], [1, 0.95, 0.9], 10),
    sph(0.235, PALETTE.earth, [0.06, 0.33, -0.01], [1, 1, 0.98], 14),
    // blackish cap and cheek, kept off the crown's front so the brow still reads brown
    sph(0.125, PALETTE.ink, [-0.03, 0.43, -0.05], [1.3, 0.58, 0.68], 10),
    // rust throat wrapping under the chin, tying the breast to the face
    sph(0.135, PALETTE.foxFur, [0.15, 0.2, 0.11], [0.9, 0.9, 0.44], 12),
    // the pale crescent under a robin's eye — small, and the thing that keeps a dark cap from
    // swallowing the eye entirely
    sph(0.055, PALETTE.plumeShade, [0.19, 0.29, 0.17], [1.2, 0.6, 0.35], 8),
    ...eye([0.19, 0.37, 0.185], 0.05, { sclera: PALETTE.snow, iris: PALETTE.ink }),
    // Fine yellow bill: longer, thinner and more sharply tapered than the bluebird's wedge.
    cone(0.042, 0.28, PALETTE.honey, [0.3, 0.29, 0.06], [0, 0, -1.86], [1, 1, 0.8]),
    cone(0.028, 0.19, PALETTE.plumeShade, [0.28, 0.255, 0.04], [0, 0, -1.76], [1, 1, 0.8]),
    sph(0.014, PALETTE.ink, [0.25, 0.31, 0.09], undefined, 6),
    ...claws(0.03, -0.45, PALETTE.earth),
    ...claws(-0.15, -0.47, PALETTE.earth),
  ])
}

/** The robin's folded near wing — the bluebird's construction in brown and rust. */
function robinWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.175, PALETTE.earth, [-0.05, -0.06, 0.02], [0.9, 1.16, 0.6], 12),
    sph(0.09, PALETTE.plumeShade, [-0.02, 0.0, 0.08], [0.95, 0.55, 0.42], 10),
    sph(0.14, PALETTE.earth, [-0.09, -0.24, 0.06], [0.92, 1.15, 0.5], 12),
    cone(0.068, 0.34, PALETTE.foxDark, [-0.15, -0.45, 0.02], [0, 0, 0.3], [1, 1, 0.42]),
    cone(0.046, 0.24, PALETTE.earth, [-0.04, -0.42, 0.06], [0, 0, 0.12], [1, 1, 0.42]),
  ])
}

export function springPieces(kind: 'bluebird' | 'robin', dir: 1 | -1): PeekerPiece[] {
  return kind === 'bluebird'
    ? [
        { slot: 'body', at: [0, 0, 0], parts: bluebirdBody(dir), ink: true },
        { slot: 'a', at: [-0.11 * dir, 0.04, 0.16], parts: bluebirdWing(dir), ink: true },
      ]
    : [
        { slot: 'body', at: [0, 0, 0], parts: robinBody(dir), ink: true },
        { slot: 'a', at: [-0.1 * dir, 0.03, 0.16], parts: robinWing(dir), ink: true },
      ]
}
