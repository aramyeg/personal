import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leaf, leafFan, limb, sph, strand, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the JUNGLE checkpoint: big leafy branches with hanging vines, and a macaw and a
 * cockatoo perched IN them.
 *
 * This is the biome the look-dev gate was run against ("branches with green leaves on the forest
 * biomes" was Aram's own brief), so the pattern every other biome follows is set here: a woody
 * limb sweeping in from the frame's outer edge, a canopy of ribbed leaves in three greens, a
 * couple of vines dropping off-frame, and the character perched on the limb with its feet
 * actually gripping it.
 */

/**
 * The branch a jungle bird stands on — the spine of the whole corner composition.
 *
 * VISIBLE BAND, and every biome's dressing is authored against it: the frame's outer edge sits at
 * local x = −PEEKER_INSET_X (−0.64) and its bottom edge at local y ≈ −0.92, so foliage authored
 * further out than that is simply thrown away. The dressing therefore wraps INWARD and UNDER the
 * character rather than spraying off-screen — the first look-dev pass put the whole canopy off
 * the left edge and the corner read as a bare bird on a stick.
 */
const BRANCH: readonly V3[] = [
  [-0.6, -0.84, -0.04],
  [-0.42, -0.66, -0.02],
  [-0.1, -0.52, 0],
  [0.26, -0.44, 0.02],
  [0.46, -0.42, 0.02],
]

export function jungleDressing(): ClayPart[] {
  const greens = [PALETTE.jungleCanopy, PALETTE.jungleDeep, PALETTE.jungleMoss, PALETTE.jungleLeaf]
  const parts: ClayPart[] = [
    // the main limb, thick where it crops off-frame and tapering to the perch
    ...limb(BRANCH, 0.072, 0.034, PALETTE.jungleBark),
    // a second limb climbing the outer edge, so the corner reads as a thicket rather than a stick
    ...limb(
      [
        [-0.54, -0.74, -0.12],
        [-0.5, -0.3, -0.14],
        [-0.42, 0.16, -0.14],
        [-0.32, 0.56, -0.12],
      ],
      0.052,
      0.024,
      PALETTE.jungleBark
    ),
    // bark tone break — a mossy patch where the two limbs meet
    sph(0.085, PALETTE.jungleMoss, [-0.54, -0.72, 0.02], [1.2, 0.8, 0.5], 8),
  ]

  // Canopy: overlapping fans arcing over and behind the bird. Density is the point — the first
  // look-dev pass used four sparse fans and the corner read as scattered leaves on a stick rather
  // than as foliage the bird is sitting IN.
  parts.push(
    ...leafFan([-0.22, 0.44, -0.13], 6, 0.5, [0.4, 2.15], greens, PALETTE.jungleDeep, 0.34),
    ...leafFan([-0.16, 0.66, -0.16], 5, 0.48, [0.5, 2.1], greens, PALETTE.jungleDeep, 0.32),
    ...leafFan([0.1, 0.72, -0.14], 5, 0.44, [0.1, 1.6], greens, PALETTE.jungleDeep, 0.3),
    ...leafFan([-0.22, 0.1, -0.12], 5, 0.4, [1.7, 2.8], greens, PALETTE.jungleDeep, 0.34),
    ...leafFan([-0.26, -0.34, -0.14], 4, 0.38, [2.4, 3.3], greens, PALETTE.jungleDeep, 0.3),
    // understory leaves catching the light under the perch
    ...leafFan([-0.22, -0.72, 0.05], 5, 0.38, [2.9, 4.1], greens, PALETTE.jungleDeep, 0.3),
    ...leafFan([0.24, -0.64, -0.05], 4, 0.36, [3.3, 4.9], greens, PALETTE.jungleDeep, 0.28),
    ...leafFan([0.26, -0.06, -0.13], 4, 0.34, [0.05, 1.2], greens, PALETTE.jungleDeep, 0.28),
    ...leafFan([0.24, 0.38, -0.15], 4, 0.34, [0.3, 1.7], greens, PALETTE.jungleDeep, 0.28)
  )

  // hanging vines, dropping past the frame's bottom edge, with leaf pairs along them
  for (const [vx, vy, n, drift] of [
    [-0.36, -0.72, 5, 0.012],
    [0.2, -0.52, 5, -0.01],
    [0.38, -0.5, 4, 0.014],
  ] as const) {
    parts.push(...strand([vx, vy, 0.06], n, 0.09, 0.026, PALETTE.jungleVine, drift))
    for (let i = 1; i < n - 1; i += 2) {
      const lx = vx + drift * i
      const ly = vy - 0.09 * i
      parts.push(
        ...leaf([lx - 0.07, ly, 0.07], 0.17, 0.42, 2.9, PALETTE.jungleMoss),
        ...leaf([lx + 0.07, ly - 0.03, 0.07], 0.15, 0.42, 0.3, PALETTE.jungleCanopy)
      )
    }
  }

  // Two orchid blooms — the one warm note in a green corner. Both sit ON a limb: an unattached
  // bloom floats in mid-air beside the bird's beak and reads as a stray bubble.
  parts.push(
    sph(0.055, PALETTE.petal, [-0.46, -0.34, 0.06], [1, 0.9, 0.6], 8),
    sph(0.026, PALETTE.honey, [-0.44, -0.32, 0.1], undefined, 6),
    sph(0.048, PALETTE.blossom, [0.34, -0.34, 0.06], [1, 0.9, 0.6], 8),
    sph(0.022, PALETTE.honey, [0.35, -0.32, 0.1], undefined, 6),
    cyl(0.012, 0.014, 0.1, PALETTE.jungleVine, [0.34, -0.4, 0.05], [0, 0, 0.2])
  )

  return parts
}

/** Feet gripping the perch — the detail that stops a bird hovering over its own branch. */
function claws(d: 1 | -1, x: number, y: number, color: string): ClayPart[] {
  return facing(d, [
    cyl(0.028, 0.034, 0.1, color, [x, y + 0.05, 0.02], [0, 0, 0.12]),
    sph(0.036, color, [x, y, 0.03], [1.3, 0.7, 1], 8),
    cone(0.018, 0.075, color, [x + 0.06, y - 0.01, 0.04], [0, 0, -1.9], undefined, 6),
    cone(0.018, 0.07, color, [x - 0.05, y - 0.01, 0.04], [0, 0, 1.9], undefined, 6),
  ])
}

/**
 * Scarlet macaw. The read at 270px is: ink-outlined scarlet mass, bare white face, huge dark
 * hooked beak, and the yellow-and-teal wing shoulder breaking the red block — the marking the
 * real bird has and the one that stopped the R14 version collapsing into a red blob.
 */
function macawBody(d: 1 | -1): ClayPart[] {
  return facing(d, [
    // Body as a teardrop rather than an egg: narrow chest over a heavy belly. A single sphere
    // read as a red blob with a head stuck on it; the shoulder notch is what makes it a bird.
    sph(0.25, PALETTE.parrotBody, [-0.05, -0.02, -0.01], [1, 1.02, 0.92], 14),
    sph(0.275, PALETTE.parrotBody, [-0.13, -0.24, -0.02], [1.02, 1.06, 0.94], 14),
    sph(0.2, PALETTE.parrotShade, [-0.08, -0.4, 0.05], [1.15, 0.72, 0.6], 12),
    // Tail: three feathers of three lengths on three angles, rooted together under the rump and
    // splaying down and out of frame. Two things matter here and both were wrong before. First
    // the cones are turned POINT-DOWN, so the frame's bottom-left crop cuts a narrowing tip
    // rather than a cone's wide base — a base-down cone crops to a rectangle and the tail read as
    // a stack of flat colour bars. Second the fan is deliberately uneven: 0.36 / 0.40 / 0.48 long
    // at 169° / 129° / 150°, so the tips land far apart across the corner and the feathers read as
    // overlapping rather than as a bar chart. Tone carries the depth order — the shaded scarlet
    // sits furthest back, the teal in front of it, the bright scarlet outermost.
    cone(0.044, 0.36, PALETTE.parrotShade, [-0.094, -0.617, -0.11], [0, 0, 2.95], [1, 1, 0.3]),
    cone(0.062, 0.48, PALETTE.parrotWing, [-0.239, -0.608, -0.07], [0, 0, 2.62], [1, 1, 0.38]),
    cone(0.05, 0.4, PALETTE.parrotBody, [-0.326, -0.506, 0.0], [0, 0, 2.25], [1, 1, 0.34]),
    // head, set forward of the shoulders on a short neck
    sph(0.245, PALETTE.parrotBody, [0.07, 0.36, 0], [1, 1.03, 0.98], 14),
    // bare white face patch: the macaw's signature, kept to the FRONT of the head so the scarlet
    // crown still reads. Its fine feather lines are the real bird's.
    sph(0.145, PALETTE.snow, [0.21, 0.3, 0.12], [0.8, 1.0, 0.44], 12),
    // A yellow iris ring around the pupil — what the real bird has, and the one device that keeps
    // the eye from reading as a googly black bead on a white patch.
    ...eye([0.2, 0.38, 0.19], 0.05, { sclera: PALETTE.honey, iris: PALETTE.ink }),
    // Heavy hooked bill, built as a real macaw's is: a deep ink upper mandible hooking down over a
    // shorter pale lower one. At this size a single dark cone reads as a blob, and the hook is the
    // whole reason the bird is legible as a parrot.
    sph(0.128, PALETTE.ink, [0.27, 0.23, 0.06], [1.1, 1.1, 0.9], 12),
    cone(0.1, 0.31, PALETTE.ink, [0.33, 0.12, 0.05], [0, 0, -2.5], [1, 1, 0.84]),
    cone(0.06, 0.16, PALETTE.stone, [0.29, 0.04, 0.02], [0, 0, -2.15], [1, 1, 0.85]),
    sph(0.022, PALETTE.snow, [0.29, 0.28, 0.11], undefined, 6),
    // two crest feathers off the crown — a silhouette break, not a crown of spikes
    cone(0.045, 0.19, PALETTE.honey, [-0.01, 0.5, 0.02], [0, 0, 0.42]),
    cone(0.04, 0.22, PALETTE.parrotWing, [-0.12, 0.45, -0.01], [0, 0, 0.75]),
    ...claws(1, 0.02, -0.46, PALETTE.stone),
    ...claws(1, -0.16, -0.45, PALETTE.stone),
  ])
}

/**
 * The near wing, FOLDED along the flank and hinged at the shoulder so the rig's idle lifts and
 * settles it — a perched parrot stretching a wing, not a bird flapping in place. The scarlet
 * macaw's yellow covert bar over teal primaries is doing the real work here: an unbroken red mass
 * is what the R14 bird collapsed into at reading size.
 */
function macawWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.185, PALETTE.parrotBody, [-0.06, -0.06, 0.02], [0.92, 1.15, 0.62], 12),
    sph(0.13, PALETTE.honey, [-0.04, 0.0, 0.09], [1.0, 0.72, 0.5], 12),
    sph(0.15, PALETTE.parrotWing, [-0.1, -0.24, 0.06], [0.95, 1.15, 0.5], 12),
    cone(0.075, 0.34, PALETTE.parrotWing, [-0.16, -0.46, 0.02], [0, 0, 0.3], [1, 1, 0.45]),
    cone(0.052, 0.26, PALETTE.honey, [-0.05, -0.44, 0.06], [0, 0, 0.14], [1, 1, 0.45]),
  ])
}

/** Cockatoo: cream plumage, a sulphur crest swept back off the crown, and a blushing cheek. */
function cockatooBody(d: 1 | -1): ClayPart[] {
  // The crest sweeps BACK over the skull rather than standing up as a ring of spikes — a fan of
  // upright cones read as a crown, which is the one shape a cockatoo must not have.
  const crest: ClayPart[] = []
  for (let i = 0; i < 5; i++) {
    const f = i / 4
    crest.push(
      cone(
        0.042 - f * 0.01,
        0.36 - f * 0.1,
        i % 2 === 0 ? PALETTE.honey : PALETTE.sky,
        [0.06 - f * 0.26, 0.52 - f * 0.08, 0.02 - f * 0.03],
        [0, 0, 0.5 + f * 0.55]
      )
    )
  }
  return facing(d, [
    sph(0.24, PALETTE.sky, [-0.05, -0.02, -0.01], [1, 1.02, 0.92], 14),
    sph(0.265, PALETTE.sky, [-0.12, -0.24, -0.02], [1.02, 1.06, 0.94], 14),
    sph(0.2, PALETTE.plumeShade, [-0.07, -0.4, 0.05], [1.15, 0.72, 0.6], 12),
    cone(0.062, 0.48, PALETTE.sky, [-0.28, -0.56, -0.04], [0, 0, 0.46], [1, 1, 0.44]),
    cone(0.05, 0.4, PALETTE.honey, [-0.39, -0.48, 0.02], [0, 0, 0.64], [1, 1, 0.44]),
    sph(0.24, PALETTE.sky, [0.07, 0.36, 0], [1, 1.02, 0.98], 14),
    // Blushing cheek, set HIGH and BACK — under and behind the eye, a clear head's-width off the
    // bill. Sat low and forward it landed level with the beak's opening and read as a tongue
    // lolling out; the softer blossom pink over the cream keeps it a blush rather than a marking.
    sph(0.052, PALETTE.blossom, [0.03, 0.29, 0.213], [1, 0.86, 0.2], 10),
    ...eye([0.19, 0.38, 0.2], 0.05, { sclera: PALETTE.snow, iris: PALETTE.ink }),
    // stubby hooked bill, dark grey over a paler chin
    sph(0.11, PALETTE.stone, [0.26, 0.22, 0.04], [1, 1.05, 0.88], 12),
    cone(0.082, 0.21, PALETTE.stone, [0.3, 0.14, 0.03], [0, 0, -2.46], [1, 1, 0.84]),
    cone(0.055, 0.13, PALETTE.hareShade, [0.27, 0.06, 0.02], [0, 0, -2.1], [1, 1, 0.85]),
    sph(0.02, PALETTE.ink, [0.29, 0.28, 0.11], undefined, 6),
    ...crest,
    ...claws(1, 0.0, -0.44, PALETTE.stone),
    ...claws(1, -0.17, -0.43, PALETTE.stone),
  ])
}

/** The cockatoo's folded near wing — same construction as the macaw's, in cream and sulphur. */
function cockatooWing(d: 1 | -1): ClayPart[] {
  return facing(d, [
    sph(0.185, PALETTE.sky, [-0.06, -0.06, 0.02], [0.92, 1.15, 0.62], 12),
    sph(0.15, PALETTE.plumeShade, [-0.1, -0.24, 0.06], [0.95, 1.15, 0.5], 12),
    cone(0.072, 0.32, PALETTE.plumeShade, [-0.16, -0.44, 0.02], [0, 0, 0.3], [1, 1, 0.45]),
    cone(0.05, 0.24, PALETTE.honey, [-0.05, -0.42, 0.06], [0, 0, 0.14], [1, 1, 0.45]),
  ])
}

export function junglePieces(kind: 'macaw' | 'cockatoo', dir: 1 | -1): PeekerPiece[] {
  return kind === 'macaw'
    ? [
        { slot: 'body', at: [0, 0, 0], parts: macawBody(dir), ink: true },
        { slot: 'a', at: [-0.12 * dir, 0.04, 0.16], parts: macawWing(dir), ink: true },
      ]
    : [
        { slot: 'body', at: [0, 0, 0], parts: cockatooBody(dir), ink: true },
        { slot: 'a', at: [-0.11 * dir, 0.04, 0.16], parts: cockatooWing(dir), ink: true },
      ]
}
