import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, cyl, eye, facing, leafFan, limb, sph, strand, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the WINTER checkpoint: snow-laden pine boughs arcing in from the frame edge with a
 * fringe of icicles under them, a drift banked across the bottom, and two yetis standing IN it.
 *
 * Same corner grammar as `peeker-jungle.tsx` (the file the look-dev gate was run against): a limb
 * sweeping in from the outer edge, foliage dense enough that the character sits INSIDE it, and
 * something dropping past the bottom crop. What winter changes is the contrast problem — a white
 * animal against a pale sky has almost no natural separation, so every mass here carries a
 * deliberate tone step (`yetiShade`/`hareShade` under the fur, `frostShadow` under the snow) and
 * the ink contour does the rest.
 */

/**
 * VISIBLE BAND, the constraint the whole composition is drawn against: the frame's outer edge sits
 * at local x = −PEEKER_INSET_X (−0.64) and its bottom edge at local y ≈ −0.92, so dressing pushed
 * further out than that is simply thrown away. Each bough therefore starts just barely off-frame
 * and spends the rest of its length sweeping INWARD across the panel.
 */
const LOW_BOUGH: readonly V3[] = [
  [-0.635, -0.62, 0.02],
  [-0.42, -0.5, 0.04],
  [-0.1, -0.43, 0.04],
  [0.24, -0.41, 0.03],
  [0.6, -0.44, 0.02],
]

/** The high bough arcs over the yeti's head; it lives behind the figure in z so it never masks a face. */
const HIGH_BOUGH: readonly V3[] = [
  [-0.64, 0.3, -0.16],
  [-0.3, 0.5, -0.18],
  [0.1, 0.62, -0.17],
  [0.52, 0.58, -0.16],
]

/** A short third bough climbing the outer edge, so the corner reads as a tree rather than two sticks. */
const MID_BOUGH: readonly V3[] = [
  [-0.64, -0.16, -0.1],
  [-0.5, 0.06, -0.12],
  [-0.34, 0.26, -0.12],
]

const NEEDLES = [PALETTE.spruceDeep, PALETTE.pine, PALETTE.pineDeep, PALETTE.spruceDeep] as const

export function winterDressing(): ClayPart[] {
  const parts: ClayPart[] = [
    ...limb(LOW_BOUGH, 0.055, 0.028, PALETTE.earth),
    ...limb(HIGH_BOUGH, 0.046, 0.02, PALETTE.earth),
    ...limb(MID_BOUGH, 0.042, 0.02, PALETTE.earth),
  ]

  // Needle sprays. `wide` is pulled far below the jungle's broadleaf default so each blade reads as
  // a cluster of needles rather than a leaf, and every spray on the LOW bough points down-and-out —
  // a bough carrying snow droops, and a horizontal spray under a snow cap reads as a shelf.
  parts.push(
    ...leafFan([-0.38, -0.52, -0.1], 4, 0.28, [3.4, 4.6], NEEDLES, undefined, 0.18),
    ...leafFan([-0.06, -0.46, -0.1], 4, 0.3, [3.3, 4.7], NEEDLES, undefined, 0.18),
    ...leafFan([0.34, -0.44, -0.1], 4, 0.28, [3.6, 5.0], NEEDLES, undefined, 0.18),
    ...leafFan([-0.345, 0.06, -0.14], 4, 0.28, [2.2, 3.9], NEEDLES, undefined, 0.16),
    ...leafFan([-0.34, 0.52, -0.18], 4, 0.28, [0.7, 2.7], NEEDLES, undefined, 0.16),
    ...leafFan([0.06, 0.7, -0.18], 4, 0.26, [0.3, 2.4], NEEDLES, undefined, 0.16),
    ...leafFan([0.44, 0.62, -0.17], 4, 0.26, [0.0, 1.9], NEEDLES, undefined, 0.16)
  )

  // Snow LOAD, riding each bough as a flattened cap in the brightest white the palette has. This is
  // what makes the boughs winter rather than a green branch in a cold scene — the needles below are
  // almost black at reading size, and the cap is the whole silhouette.
  for (const [x, y, z, r, w] of [
    [-0.535, -0.55, 0.04, 0.09, 1.4],
    [-0.26, -0.44, 0.05, 0.1, 1.6],
    [0.08, -0.38, 0.05, 0.1, 1.6],
    [0.42, -0.36, 0.04, 0.09, 1.5],
    [-0.44, 0.4, -0.16, 0.09, 1.5],
    [-0.06, 0.58, -0.17, 0.1, 1.6],
    [0.34, 0.62, -0.16, 0.09, 1.5],
    [-0.5, 0.1, -0.11, 0.08, 1.4],
  ] as const) {
    parts.push(sph(r, PALETTE.boughSnow, [x, y, z], [w, 0.44, 0.75], 10))
  }
  // two shaded undersides, so the caps read as volumes sitting ON something
  parts.push(
    sph(0.08, PALETTE.frostShadow, [-0.3, -0.5, 0.02], [1.6, 0.34, 0.7], 8),
    sph(0.08, PALETTE.frostShadow, [0.1, 0.52, -0.18], [1.5, 0.34, 0.7], 8)
  )

  // Icicle fringe under the low bough, hung slightly forward of it so the chain crosses the dark
  // needles rather than disappearing into them. Strong taper: a chain of equal beads reads as a
  // vine, and the point at the bottom is the whole difference.
  for (const [x, y, n, step, r, tone, drift] of [
    [-0.5, -0.58, 4, 0.055, 0.03, PALETTE.ice, 0.005],
    [-0.2, -0.5, 5, 0.052, 0.028, PALETTE.ice, -0.004],
    [0.16, -0.44, 4, 0.05, 0.028, PALETTE.ice, 0.004],
    [0.46, -0.44, 3, 0.048, 0.024, PALETTE.iceDeep, 0.004],
  ] as const) {
    parts.push(...strand([x, y, 0.08], n, step, r, tone, drift, 0.74))
  }
  parts.push(
    cone(0.018, 0.09, PALETTE.iceDeep, [-0.485, -0.79, 0.08], [0, 0, Math.PI], undefined, 6),
    cone(0.016, 0.08, PALETTE.iceDeep, [-0.216, -0.745, 0.08], [0, 0, Math.PI], undefined, 6)
  )

  // The drift. It is authored FORWARD of the figure (z ≈ 0.12–0.22) rather than behind it, because
  // the point of a drift is that the yeti is standing in it up to the chest — banked behind, it
  // would just be a white band under a floating character. Crests are `boughSnow` and the hollows
  // between them `frostShadow`: on a pale sky the snow only has shape if it carries both.
  parts.push(
    sph(0.26, PALETTE.snow, [-0.33, -0.88, 0.12], [1.26, 0.6, 0.7], 12),
    sph(0.28, PALETTE.snow, [0.06, -0.84, 0.16], [1.35, 0.62, 0.7], 12),
    sph(0.26, PALETTE.snow, [0.41, -0.9, 0.12], [1.2, 0.6, 0.7], 12),
    sph(0.22, PALETTE.snow, [-0.42, -1.0, 0.06], [1.15, 0.6, 0.7], 10),
    sph(0.2, PALETTE.frostShadow, [-0.14, -1.0, 0.08], [1.3, 0.5, 0.7], 10),
    sph(0.18, PALETTE.frostShadow, [0.28, -1.02, 0.08], [1.3, 0.5, 0.7], 10),
    sph(0.18, PALETTE.frostShadow, [-0.48, -0.98, 0.06], [1.0, 0.5, 0.7], 10),
    sph(0.13, PALETTE.boughSnow, [-0.32, -0.8, 0.18], [1.4, 0.45, 0.6], 10),
    sph(0.14, PALETTE.boughSnow, [0.08, -0.75, 0.22], [1.4, 0.42, 0.6], 10),
    sph(0.12, PALETTE.boughSnow, [0.46, -0.82, 0.18], [1.3, 0.45, 0.6], 10)
  )

  // Two ice shards breaking out of the drift crest — the one hard edge in a composition that is
  // otherwise all round white masses, and the thing that stops the drift reading as fog.
  parts.push(
    cone(0.05, 0.24, PALETTE.ice, [-0.59, -0.8, 0.1], [0, 0, 0.22], [1, 1, 0.7], 6),
    cone(0.04, 0.18, PALETTE.iceDeep, [0.62, -0.86, 0.1], [0, 0, -0.3], [1, 1, 0.7], 6)
  )

  return parts
}

// --- the yetis --------------------------------------------------------------

/** One yeti's three tones: the coat, its shadow step, and the bare skin of the face mask. */
type Coat = { fur: string; shade: string; skin: string }

const BIG_COAT: Coat = { fur: PALETTE.yetiFur, shade: PALETTE.yetiShade, skin: PALETTE.yetiMuzzle }
/** The small one is a colder, greyer animal rather than a recoloured copy — hare tones read as a
 *  different creature at a glance, where a tint of the same blue-white would just read as haze. */
const SMALL_COAT: Coat = { fur: PALETTE.hareFur, shade: PALETTE.hareShade, skin: PALETTE.snow }

/** The head's own x centre. Every face feature is placed symmetrically about it — see `yetiBody`. */
const HEAD_X = 0.08

/**
 * One EYEBROW, as an arch whose high point sits over the pupil rather than as a tilted bar.
 *
 * A straight bar can only slant, and both slants carry a mood this cast is not allowed to have:
 * dropping toward the nose is a scowl, rising toward the nose is a plea. Only an arch — ends low,
 * apex over the eye — reads as the raised, delighted brow, and it keeps reading that way under the
 * rig's inward yaw, where a slant would foreshorten into whichever mood the near end suggests.
 *
 * `s` is +1 for the brow on the +X (inward) eye and −1 for the other, so the pair is symmetric
 * about HEAD_X and the outer end of each arch is the lower one.
 */
function brow(s: 1 | -1, x: number, y: number, z: number): ClayPart[] {
  return limb(
    [
      [x + s * 0.1, y - 0.04, z],
      [x + s * 0.02, y + 0.022, z + 0.012],
      [x - s * 0.07, y - 0.008, z + 0.006],
    ],
    0.026,
    0.02,
    PALETTE.ink
  )
}

/**
 * Head, shoulder mass and the face.
 *
 * R14 LESSON, and the reason the face is built the way it is: the first yeti "read as a grey rock"
 * because its features were nudged toward the frame's middle, which put one eye almost on the
 * head's centre line where it vanished round the side of the skull. So the mask here is strictly
 * SYMMETRIC about HEAD_X and pushed forward in +Z, and the turning is left entirely to the rig,
 * which yaws the whole figure inward by PEEKER_FACE_IN. A symmetric mask under a 20° yaw reads as a
 * face looking into the panel; an asymmetric one reads as a lump.
 *
 * DEPTH IS THE TONE BUDGET. The four-band ramp gives a white animal on a pale sky almost no
 * interior shading, so every `shade` mass here is a painted patch that has to WIN the depth test
 * against the fur it darkens. The fur sits at z ≈ −0.05 and the shade patches at z ≥ +0.09; the
 * previous pass placed them within 0.003 of each other and the tone step simply never drew.
 */
function yetiBody(c: Coat): ClayPart[] {
  const eyeOpts = { sclera: PALETTE.honey, iris: PALETTE.ink }
  return [
    // TORSO, built as a shoulder line rather than a stack of eggs: a WIDE, shallow yoke with a flat
    // top, a round cap at each end of it, a deep chest barrel and a narrower belly. What the ink
    // contour has to draw is head (0.56 wide) → neck pinch (0.30) → yoke (0.97), because a
    // continuous head-into-body oval is exactly the boulder-with-a-face the last render was.
    sph(0.3, c.fur, [-0.09, 0.03, -0.06], [1.62, 0.5, 0.92], 14),
    sph(0.165, c.fur, [-0.41, 0.0, -0.02], [1.0, 1.0, 0.9], 12),
    sph(0.3, c.fur, [-0.15, -0.28, -0.05], [1.2, 0.95, 0.9], 14),
    sph(0.245, c.fur, [-0.2, -0.58, -0.04], [1.14, 0.72, 0.8], 12),
    // The FAR shoulder, carried a clear 0.2 forward of the chest. Depth is the only thing that
    // separates two white volumes under a flat ramp, and the shade band below crosses BEHIND it,
    // so the deltoid reads as a lit near mass over a dark one.
    sph(0.17, c.fur, [0.22, -0.05, 0.16], [1.0, 0.98, 0.85], 12),

    sph(0.28, c.fur, [HEAD_X, 0.46, -0.02], [1.0, 1.02, 0.94], 14),
    // The neck, deliberately the narrowest thing on the figure: it is what turns the head and the
    // shoulders into two masses instead of one, and it is shaded because on a white-on-white animal
    // the under-jaw shadow is the join a reader actually sees.
    sph(0.15, c.shade, [0.04, 0.2, 0.0], [1.0, 0.6, 0.85], 12),

    // TONE: lit on top, shaded underneath. A hard band under the yoke's front edge where the chest
    // recedes out of the light, a broad shaded belly under it, and a strip down the outer flank so
    // the body does not meet the sky at full fur value. Each is narrower than the fur it sits on,
    // so it paints tone without ever becoming the silhouette.
    sph(0.3, c.shade, [-0.1, -0.12, 0.12], [0.95, 0.22, 0.5], 12),
    sph(0.3, c.shade, [-0.19, -0.52, 0.11], [0.8, 0.62, 0.55], 12),
    sph(0.22, c.shade, [-0.38, -0.28, 0.09], [0.62, 1.2, 0.5], 12),

    // The face MASK: a broad bare plate proud of the fur, so the features sit on skin rather than
    // on shag. Without it every feature below would be a dark speck floating on white.
    sph(0.22, c.skin, [HEAD_X, 0.41, 0.14], [0.96, 1.08, 0.62], 14),
    // Brows in INK, and high: the muzzle tone is darker than the shag, so a `shade` brow on it read
    // as a highlight rather than a line. Ink puts them in the same drawn language as the nostrils
    // and the mouth, and the clear gap over the eye is what makes the pair read as raised.
    ...brow(-1, HEAD_X - 0.095, 0.655, 0.2),
    ...brow(1, HEAD_X + 0.095, 0.655, 0.2),
    // Amber eyes: a snow sclera on a snow face is invisible, so the ring itself carries the colour.
    // It is also the only warm note anywhere in the corner, which is what draws the eye to the face.
    ...eye([HEAD_X - 0.095, 0.478, 0.25], 0.068, eyeOpts),
    ...eye([HEAD_X + 0.095, 0.478, 0.25], 0.068, eyeOpts),
    // Lids authored HERE rather than through eye(), which sits its lid low on the bead. These CAP
    // each eye at its crown instead of cutting into it and are all but level, so the whole amber
    // ring stays open — a lid that eats the top of the iris is the mournful face of the last round.
    // Ink, because in `shade` the lid was lighter than the skin it lay on and read as a highlight.
    cyl(0.01, 0.01, 0.115, PALETTE.ink, [HEAD_X - 0.095, 0.559, 0.262], [0, 0, Math.PI / 2 - 0.08]),
    cyl(0.01, 0.01, 0.115, PALETTE.ink, [HEAD_X + 0.095, 0.559, 0.262], [0, 0, Math.PI / 2 + 0.08]),

    sph(0.115, c.skin, [HEAD_X, 0.335, 0.23], [1.15, 0.8, 0.72], 12),
    sph(0.024, PALETTE.ink, [HEAD_X - 0.045, 0.355, 0.3], undefined, 6),
    sph(0.024, PALETTE.ink, [HEAD_X + 0.045, 0.355, 0.3], undefined, 6),
    // The mouth is a flat-bottomed curve with both corners turned up — three segments, because a
    // two-bar smile is a V, and a V under a raised brow reads as a grimace.
    ...limb(
      [
        [HEAD_X - 0.115, 0.297, 0.255],
        [HEAD_X - 0.05, 0.243, 0.27],
        [HEAD_X + 0.05, 0.243, 0.27],
        [HEAD_X + 0.115, 0.297, 0.255],
      ],
      0.016,
      0.016,
      PALETTE.ink
    ),
    // Tusks at the corners of the smile and forward of the snout, so they break the mouth line
    // instead of hiding behind it.
    cone(0.028, 0.16, PALETTE.snow, [HEAD_X - 0.098, 0.275, 0.29], [0, 0, 0.22], [1, 1, 0.8], 6),
    cone(0.028, 0.16, PALETTE.snow, [HEAD_X + 0.098, 0.275, 0.29], [0, 0, -0.22], [1, 1, 0.8], 6),
    // Ear tufts, the one asymmetry-proof silhouette break: they read even when the yaw turns the
    // far side of the head away.
    cone(0.052, 0.22, c.fur, [HEAD_X - 0.245, 0.615, -0.04], [0, 0, 0.62]),
    cone(0.052, 0.22, c.fur, [HEAD_X + 0.245, 0.615, -0.04], [0, 0, -0.62]),

    // SHAG, on every edge that meets sky: crown, the whole top of the near shoulder, a crest on the
    // far one, the long outer flank and a hem where the body sinks into the drift. The ink contour
    // traces whatever the outermost primitive is, so these are not surface texture — they ARE the
    // silhouette, and a shaggy animal must never be drawn with a smooth outline. The old ruff that
    // filled the neck notch is gone: it welded the head back onto the shoulders.
    ...tufts([HEAD_X, 0.46, -0.06], 0.28, 5, c.fur, 0.12, 1.02, 0.5),
    ...tufts([-0.2, 0.02, -0.08], 0.3, 5, c.fur, 0.45, 1.15, 0.5),
    ...tufts([0.17, -0.03, 0.07], 0.2, 3, c.fur, 0.05, 0.52, 0.5),
    ...tufts([-0.14, -0.12, -0.07], 0.4, 6, c.fur, 0.82, 1.44, 0.5),
    ...tufts([-0.22, -0.44, -0.04], 0.28, 4, c.fur, 1.1, 1.55, 0.5),

    // The far forearm, laid across the chest and down onto the bough. It is a static counterweight
    // to the near arm the rig rocks, and its diagonal is what stops the belly reading as a slab.
    ...limb(
      [
        [0.2, -0.14, 0.18],
        [0.16, -0.28, 0.2],
        [0.1, -0.42, 0.21],
      ],
      0.085,
      0.075,
      c.fur
    ),
    sph(0.095, c.fur, [0.08, -0.46, 0.21], [1.05, 0.9, 0.9], 10),
    sph(0.05, c.skin, [0.06, -0.49, 0.26], [1.1, 0.85, 0.5], 8),

    // snow knocked off the bough and caught on him — the detail that puts him IN the tree, and the
    // brightest value on the figure, sitting on the two surfaces that face the sky
    sph(0.075, PALETTE.boughSnow, [-0.2, 0.175, 0.02], [1.8, 0.4, 0.9], 8),
    sph(0.07, PALETTE.boughSnow, [HEAD_X + 0.02, 0.7, -0.02], [1.5, 0.45, 0.9], 8),
  ]
}

/**
 * The near arm, hooked over the low bough — authored about the SHOULDER so the rig's slow rock
 * swings the whole limb where it grips. The paw straddles the bough (knuckles above it, fingers
 * curling below and forward) rather than resting on top of it: a hand laid flat on a branch reads
 * as a hand floating near a branch once the silhouettes flatten.
 */
function yetiArm(c: Coat): ClayPart[] {
  return [
    sph(0.14, c.fur, [0, 0, 0], [1, 1, 0.85], 12),
    ...limb(
      [
        [0, -0.02, 0],
        [-0.06, -0.2, 0.0],
        [-0.11, -0.33, -0.01],
      ],
      0.115,
      0.092,
      c.fur
    ),
    sph(0.1, c.shade, [-0.11, -0.33, 0.0], [1, 1, 0.85], 10),
    ...limb(
      [
        [-0.11, -0.33, 0],
        [-0.14, -0.42, 0.02],
        [-0.16, -0.5, 0.04],
      ],
      0.095,
      0.082,
      c.fur
    ),
    sph(0.11, c.fur, [-0.17, -0.53, 0.05], [1.05, 0.92, 0.9], 12),
    // bare palm, the same skin as the face mask so the two bare notes rhyme
    sph(0.062, c.skin, [-0.16, -0.57, 0.12], [1.15, 0.9, 0.5], 10),
    cone(0.03, 0.15, c.fur, [-0.245, -0.585, 0.07], [0, 0, 2.75], [1, 1, 0.85], 6),
    cone(0.03, 0.15, c.fur, [-0.175, -0.615, 0.09], [0, 0, 3.05], [1, 1, 0.85], 6),
    cone(0.028, 0.14, c.fur, [-0.105, -0.6, 0.08], [0, 0, 3.42], [1, 1, 0.85], 6),
    // thumb hooked back over the top of the bough — the piece that closes the grip
    cone(0.028, 0.13, c.fur, [-0.075, -0.46, 0.11], [0, 0, -1.35], [1, 1, 0.85], 6),
    ...tufts([-0.08, -0.22, -0.03], 0.19, 4, c.fur, 0.9, 1.5, 0.52),
  ]
}

/**
 * Scale a part list uniformly and offset it. A primitive's radius is baked into its geometry, so
 * the only way to shrink a whole figure in place is to scale its positions AND fold the factor into
 * each part's own `scl` — safe because a uniform scale commutes with the part's rotation. The
 * offset is applied AFTER the scale, so it reads in final figure units.
 */
function placed(s: number, off: V3, parts: ClayPart[]): ClayPart[] {
  return parts.map((p) => ({
    ...p,
    pos: [
      (p.pos?.[0] ?? 0) * s + off[0],
      (p.pos?.[1] ?? 0) * s + off[1],
      (p.pos?.[2] ?? 0) * s + off[2],
    ] as V3,
    scl: [(p.scl?.[0] ?? 1) * s, (p.scl?.[1] ?? 1) * s, (p.scl?.[2] ?? 1) * s] as V3,
  }))
}

/**
 * The small yeti is not just a shrunk copy parked at the same address: it sits further OUT toward
 * the frame edge, further FORWARD toward the camera and lower in the drift. The last render still
 * had it tucked behind the big one's silhouette, where the two pale masses fused into one, so both
 * the outward and the forward step are roughly doubled here — the outward one is what separates the
 * two OUTLINES, and the forward one is what lets the near figure overlap rather than abut.
 *
 * The step is capped by the staging, not by taste: every part of the small figure lands at `scale ×
 * the big one's position + this offset`, so the offset walks its FACE toward the frame edge as well
 * as its body. The outer end of the outer eyebrow hits FACE_BOX first, at about x = −0.13, well
 * before the body reaches MASCOT_BOX.out; forward, the tusks hit PEEKER_ABS_Z at about z = +0.13.
 * Shrinking the figure slightly buys back a little of both, which is the other reason it is 0.82.
 */
const SMALL_OFFSET: V3 = [-0.11, -0.06, 0.12]

export function winterPieces(kind: 'yetiBig' | 'yetiSmall', dir: 1 | -1): PeekerPiece[] {
  const big = kind === 'yetiBig'
  const coat = big ? BIG_COAT : SMALL_COAT
  const s = big ? 1 : 0.82
  const off: V3 = big ? [0, 0, 0] : SMALL_OFFSET
  return [
    { slot: 'body', at: [0, 0, 0], parts: facing(dir, placed(s, off, yetiBody(coat))), ink: true },
    {
      slot: 'a',
      // the shoulder joint moves with the figure, so the arm hinges where the shoulder actually is
      at: [(-0.1 * s + off[0]) * dir, 0.06 * s + off[1], 0.16 * s + off[2]],
      parts: facing(dir, placed(s, [0, 0, 0], yetiArm(coat))),
      ink: true,
    },
  ]
}
