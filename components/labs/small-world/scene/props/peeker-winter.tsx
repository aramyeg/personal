import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, eye, facing, leafFan, limb, sph, tufts, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the WINTER checkpoint: snow-laden pine boughs arcing in from the frame edge with a
 * fringe of icicles under them, a drift banked across the bottom, and two yetis standing IN it.
 *
 * Same corner grammar as `peeker-jungle.tsx` (the file the look-dev gate was run against): a limb
 * sweeping in from the outer edge, foliage dense enough that the character sits INSIDE it, and
 * something dropping past the bottom crop.
 *
 * THE VALUE SCHEME IS INVERTED FROM THE FIRST PASS, and that is the whole point of this revision.
 * Winter's grade is a pale lilac wash (`gradeWinterGlow`, L* ≈ 90); the near-white shag the yetis
 * used to be built from sits at L* ≈ 95, so figure and sky were the same value and the corner
 * measured a median dL* of 20.7 where every other biome measures 40–52. A white animal cannot hold
 * a silhouette against a white sky. So the MASS is now `yetiCoat` (a mid blue-grey, L* ≈ 68)
 * shading to `yetiCoatDeep` (L* ≈ 55), and the near-whites are demoted to ACCENTS — the lit band on
 * the shoulders, the face mask, the chest bib, snow caught on the crown. That is better than a stop
 * of albedo separation, spent where it draws a shape rather than smeared over the whole animal.
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

/**
 * One icicle: a cone hung POINT-DOWN off the bough, with a brighter core running inside it and a
 * shaded fillet where it grips.
 *
 * The first pass hung these as `strand` bead chains, which is what the helper is for — vines and
 * moss. A column of beads has no point and no taper, so at reading size the fringe read as blue
 * jewellery. Ice is a single tapering spike; the core is what sells it as translucent rather than
 * as a painted spike, because the one thing a reader knows about an icicle is that light runs down
 * the inside of it.
 */
function icicle(at: V3, r: number, len: number, tone: string): ClayPart[] {
  return [
    cone(r, len, tone, [at[0], at[1] - len / 2, at[2]], [0, 0, Math.PI], [1, 1, 0.72], 7),
    cone(
      r * 0.42,
      len * 0.82,
      PALETTE.boughSnow,
      [at[0], at[1] - len * 0.42, at[2] + r * 0.55],
      [0, 0, Math.PI],
      [1, 1, 0.55],
      6
    ),
    sph(r * 1.15, PALETTE.frostShadow, [at[0], at[1] + r * 0.2, at[2] - 0.01], [1.15, 0.55, 0.7], 8),
  ]
}

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

  // Icicle fringe under the low bough, hung forward of it (z = 0.08) so the spikes cross the dark
  // needles rather than disappearing into them. Lengths alternate long/short: an even row reads as
  // a comb, and the irregular one is what reads as ice.
  for (const [x, y, r, len, tone] of [
    [-0.545, -0.6, 0.03, 0.2, PALETTE.ice],
    [-0.44, -0.56, 0.022, 0.13, PALETTE.iceDeep],
    [-0.3, -0.5, 0.032, 0.24, PALETTE.ice],
    [-0.185, -0.48, 0.024, 0.15, PALETTE.iceDeep],
    [-0.055, -0.47, 0.028, 0.19, PALETTE.ice],
    [0.1, -0.46, 0.021, 0.12, PALETTE.iceDeep],
    [0.245, -0.46, 0.03, 0.22, PALETTE.ice],
    [0.4, -0.47, 0.023, 0.14, PALETTE.iceDeep],
    [0.545, -0.49, 0.026, 0.17, PALETTE.ice],
  ] as const) {
    parts.push(...icicle([x, y, 0.08], r, len, tone))
  }

  // The drift. It is authored FORWARD of the figure (z ≈ 0.12–0.22) rather than behind it, because
  // the point of a drift is that the yeti is standing in it up to the chest — banked behind, it
  // would just be a white band under a floating character.
  //
  // VALUE, and this is the fix for "the yeti shares its value with the boulder it sits on". The
  // crests used to be `snow` with `frostShadow` hollows, and `frostShadow` sits about nine points of
  // lightness from `yetiCoat` in nearly the same hue. Shaded by the ramp, the whole bank landed on
  // the animal's own value — so it stopped reading as SNOW at all and became a grey boulder with a
  // yeti of the same tone in front of it. The crests are now the palette's brightest whites and the
  // hollows go to `driftShade`, a genuinely deep blue snow shadow. Snow that carries its own full
  // range reads as snow, and it hands the figure a bright edge exactly where the two meet.
  parts.push(
    sph(0.26, PALETTE.boughSnow, [-0.33, -0.87, 0.14], [1.34, 0.46, 0.7], 12),
    sph(0.28, PALETTE.boughSnow, [0.06, -0.83, 0.18], [1.42, 0.48, 0.7], 12),
    sph(0.26, PALETTE.boughSnow, [0.41, -0.89, 0.14], [1.28, 0.46, 0.7], 12),
    sph(0.22, PALETTE.snow, [-0.42, -0.99, 0.06], [1.18, 0.6, 0.7], 10),
    // the wind hollows between the crests
    sph(0.2, PALETTE.driftShade, [-0.14, -1.0, 0.08], [1.3, 0.5, 0.7], 10),
    sph(0.18, PALETTE.driftShade, [0.28, -1.02, 0.08], [1.3, 0.5, 0.7], 10),
    sph(0.18, PALETTE.frostShadow, [-0.48, -0.98, 0.06], [1.0, 0.5, 0.7], 10),
    // The CORNICE line: a thin shaded band riding just under each crest's top edge, forward of it.
    // It does two jobs at once — it turns a soft dome into wind-cut snow, and it is exactly the
    // edge the figure is seen against, so the animal's waterline gets a drawn contact instead of
    // fading into the bank.
    sph(0.26, PALETTE.driftShade, [-0.33, -0.815, 0.26], [1.34, 0.09, 0.34], 10),
    sph(0.28, PALETTE.driftShade, [0.06, -0.775, 0.3], [1.4, 0.09, 0.34], 10),
    sph(0.26, PALETTE.driftShade, [0.41, -0.835, 0.26], [1.28, 0.09, 0.34], 10),
    sph(0.13, PALETTE.snow, [-0.32, -0.78, 0.2], [1.4, 0.45, 0.6], 10),
    sph(0.14, PALETTE.snow, [0.08, -0.73, 0.24], [1.4, 0.42, 0.6], 10),
    sph(0.12, PALETTE.snow, [0.46, -0.8, 0.2], [1.3, 0.45, 0.6], 10)
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

/**
 * A yeti's four tones, in the order the reader meets them.
 *
 * `coat` is the dominant mass and the whole silhouette; `deep` is its shadow; `lit` and `mask` are
 * the two near-white accents — one for the surfaces that face the light, one for the bare face.
 * NOTHING that touches the sky may be a near-white: see the header.
 */
type Coat = { coat: string; deep: string; lit: string; mask: string }

const BIG_COAT: Coat = {
  coat: PALETTE.yetiCoat,
  deep: PALETTE.yetiCoatDeep,
  lit: PALETTE.yetiFur,
  mask: PALETTE.yetiMuzzle,
}
/**
 * The cub shares the adult's coat, because they are one animal at two ages and a recoloured mass
 * would just read as a second species standing in the same drift. What separates them is the pair
 * of accents: the colder, greyer hare tones against the adult's brighter yeti ones.
 *
 * They are also the better-measuring pair, and the reason is worth recording because it inverts
 * the obvious guess. The toon ramp scales a figure's albedo; the sky behind it is a flat backdrop
 * that the ramp never touches. So contrast against the grade tracks albedo DOWNWARD — the brighter
 * the accent, the closer it lands to the sky once it is lit. `boughSnow`, the brightest white in
 * the palette, is the worst mask a figure can wear here.
 */
const SMALL_COAT: Coat = {
  coat: PALETTE.yetiCoat,
  deep: PALETTE.yetiCoatDeep,
  lit: PALETTE.hareFur,
  mask: PALETTE.hareShade,
}

/** The head's own x centre. Every face feature is placed symmetrically about it — see `yetiBody`. */
const HEAD_X = 0.08

/**
 * A ring of FUR CLUMPS around a mass — the shag, and the thing that makes this animal a yeti.
 *
 * The first pass carried the kit's `tufts`, whose cones are wider at the base than they are long at
 * the lengths that are safe to use here (past about 0.3 they project from the outline as SPINES,
 * which is the threat read the ear tufts were removed for). Clumps that wide overlap at the root
 * and merge into the mass, so the outline came back as a faint wobble: the review's "a smooth
 * faceted surface with no shag anywhere", and with round ears and a plush muzzle above it the
 * corner read as a bear or a koala.
 *
 * What separates fur from spikes is not length, it is the NOTCH. Each clump here is a rounded lobe
 * — never a point — rooted well INSIDE the mass at `root` and running out to `root + len`, so
 * neighbours converge where they are buried and diverge where they are seen. The gap between two
 * tips is the fur; the lobes themselves only have to be long enough to open it.
 *
 * `lay` rakes the clumps off the radial direction. A ring of purely radial lobes is a sunburst;
 * hair lies along the body and hangs, so every ring below is raked and the rake is what reads as
 * weight. `thick` is the lobe's width as a fraction of its length — every ring wants the same 0.5,
 * so it is a default rather than seven repeated literals.
 *
 * Every ring is a SILHOUETTE device. The ink hull is inflated from the merged geometry, so a lobe
 * standing proud of the body draws its own outline — at the edge that is exactly the point, and
 * anywhere else it is a disaster (see the note in `yetiBody` about the interior rows this replaced).
 */
function shag(
  center: V3,
  root: number,
  n: number,
  color: string,
  from: number,
  to: number,
  len: number,
  lay = 0,
  thick = 0.5
): ClayPart[] {
  const out: ClayPart[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (from + (to - from) * (i / Math.max(1, n - 1)))
    // a ring of equal clumps reads as a scalloped border, which is a decorative edge rather than fur
    const l = len * (0.82 + 0.3 * Math.sin(i * 2.3))
    const d = root + l * 0.5
    out.push({
      ...sph(
        l * 0.5,
        color,
        [center[0] + Math.cos(a) * d, center[1] + Math.sin(a) * d, center[2]],
        [1, thick, 0.62],
        8
      ),
      rot: [0, 0, a + lay] as V3,
    })
  }
  return out
}

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
      [x + s * 0.095, y - 0.04, z],
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
 * THE FACE IS A PLUSH APE, NOT A MONSTER. The first pass gave it a flat disc snout with a pair of
 * round nostrils, tusks at the corners of the mouth and spiked ear tufts, and it read as a boar or
 * a gargoyle. All three are gone. What replaces them is the toy vocabulary: a rounded muzzle BALL
 * that catches its own light, one small dark nose, an open smile with a tongue in it, big amber
 * eyes and round ears. None of that is decoration — a friendly read is the requirement, and every
 * one of those three removed features was reading as a threat display.
 *
 * SYMMETRY. The R14 yeti "read as a grey rock" because its features were nudged toward the frame's
 * middle, which put one eye almost on the head's centre line where it vanished round the side of
 * the skull. The mask here is strictly SYMMETRIC about HEAD_X and pushed forward in +Z; the turning
 * is left entirely to the rig, which yaws the whole figure inward by PEEKER_FACE_IN.
 *
 * DEPTH IS THE TONE BUDGET. Every accent below is a painted patch that has to WIN the depth test
 * against the mass it sits on, so each one is authored proud of the surface underneath it at the
 * point where they meet. A patch placed level with its host simply never draws.
 */
function yetiBody(c: Coat): ClayPart[] {
  const eyeOpts = { sclera: PALETTE.honey, iris: PALETTE.ink }
  return [
    // FAR side first, all in `deep` so it recedes: the off shoulder and the arm hanging past the
    // body's inward edge. It is a static counterweight to the near arm the rig rocks, and its
    // diagonal is what stops the belly reading as a slab.
    sph(0.16, c.deep, [0.21, -0.04, -0.02], [1.0, 1.05, 0.85], 12),
    ...limb(
      [
        [0.235, -0.1, 0.02],
        [0.225, -0.28, 0.03],
        [0.19, -0.44, 0.04],
      ],
      0.09,
      0.078,
      c.deep
    ),

    // TORSO, built as a shoulder line rather than a stack of eggs: a shallow yoke with a flat top,
    // a round cap at its outer end, the near shoulder ball carried forward OVER THE ARM HINGE, a
    // chest barrel and a narrower belly. What the ink contour has to draw is head (0.56 wide) →
    // neck pinch (0.29) → yoke (0.85), because a continuous head-into-body oval is exactly the
    // boulder-with-a-face the R14 render was.
    //
    // The yoke's width is set by the ARM, not by how broad a yeti ought to be. The first pass gave
    // it a 0.96 span with the shoulder joint at x = −0.10, which put the whole limb down the middle
    // of the belly where it had nothing to be seen against; the reviewer could not find it. The
    // joint now sits at −0.24, out where the body's own edge is, so the arm hangs along the outer
    // contour with the lit chest behind it.
    sph(0.3, c.coat, [-0.1, 0.02, -0.04], [1.42, 0.54, 0.95], 14),
    sph(0.165, c.coat, [-0.38, -0.01, -0.02], [1.0, 1.0, 0.9], 12),
    sph(0.185, c.coat, [-0.24, 0.05, 0.15], [1.05, 1.0, 0.9], 12),
    sph(0.3, c.coat, [-0.15, -0.28, -0.04], [1.12, 1.0, 0.92], 14),
    sph(0.245, c.deep, [-0.21, -0.58, -0.03], [1.08, 0.74, 0.82], 12),

    // THE SHOULDER LINE — the single fix for "a shapeless pale mass". A narrow band of `lit` riding
    // the top of the yoke with a band of `deep` immediately under it puts a hard light/dark edge
    // straight across the figure at y ≈ 0.05, which is where a shoulder is. Both are set INSIDE the
    // silhouette (the tufts below are wider): a near-white rim on the OUTLINE would hand the sky
    // back the contrast this whole revision exists to win.
    sph(0.3, c.lit, [-0.14, 0.12, 0.06], [1.12, 0.13, 0.5], 12),
    sph(0.16, c.lit, [-0.24, 0.19, 0.2], [1.05, 0.11, 0.5], 10),
    sph(0.3, c.deep, [-0.14, -0.02, 0.14], [0.98, 0.21, 0.42], 12),
    // a strip down the outer flank, so the body does not meet the sky at full coat value
    sph(0.22, c.deep, [-0.36, -0.3, 0.06], [0.62, 1.2, 0.45], 12),
    // Chest bib, hung directly off the shaded band above it so it reads as the chest catching the
    // same light as the shoulders rather than as a lozenge floating on a belly. Kept INBOARD of the
    // swinging arm so the arm never buries it, and NARROW: every near-white pixel is spent against
    // a near-white sky, so the accents are budgeted by area rather than drawn to taste.
    sph(0.2, c.lit, [0.03, -0.19, 0.21], [0.62, 0.78, 0.34], 12),

    // The neck, deliberately the narrowest thing on the figure: it is what turns the head and the
    // shoulders into two masses instead of one.
    sph(0.145, c.deep, [0.03, 0.2, 0.02], [1.0, 0.62, 0.85], 12),
    sph(0.28, c.coat, [HEAD_X, 0.47, -0.02], [1.0, 1.0, 0.94], 14),

    // Round ears with a pale inner cup — the plush note, and still the asymmetry-proof silhouette
    // break the removed spikes were there for: they read even when the yaw turns the far side of
    // the head away. SMALLER and set back than the first pass, because a big round ear standing off
    // a smooth dome is the loudest single bear cue on the animal; here they sit down in the ruff
    // (see the face ring below), which is where a shaggy creature's ears are.
    sph(0.068, c.coat, [HEAD_X - 0.25, 0.55, -0.05], [1.0, 1.1, 0.7], 10),
    sph(0.068, c.coat, [HEAD_X + 0.25, 0.55, -0.05], [1.0, 1.1, 0.7], 10),
    sph(0.036, c.mask, [HEAD_X - 0.258, 0.542, 0.01], [1.0, 1.05, 0.6], 8),
    sph(0.036, c.mask, [HEAD_X + 0.258, 0.542, 0.01], [1.0, 1.05, 0.6], 8),

    // The MASK, as a peanut rather than a disc: a rounded muzzle ball with a second lobe rising
    // between the eyes. The ball is what the removed snout was not — it has a top that catches
    // light and an underside that falls away, which is the whole difference between a muzzle and a
    // plate stuck on a face. Its upper lobe is narrower than the eye spacing, so the eyes sit proud
    // at its corners instead of being swallowed by it.
    sph(0.155, c.mask, [HEAD_X, 0.335, 0.17], [1.05, 0.84, 0.86], 14),
    sph(0.105, c.mask, [HEAD_X, 0.435, 0.215], [1.2, 0.62, 0.55], 12),

    // one small dark nose, high on the muzzle ball
    sph(0.042, PALETTE.ink, [HEAD_X, 0.385, 0.3], [1.25, 0.85, 0.7], 8),
    // The OPEN smile: a wide dark lens with a tongue in it, and two ink ticks lifting the corners
    // past its ends. The corners are the smile — a dark lens on its own is just an open mouth, and
    // the lift is what makes it a warm one.
    sph(0.072, PALETTE.ink, [HEAD_X, 0.252, 0.275], [1.5, 0.6, 0.42], 10),
    sph(0.036, PALETTE.petal, [HEAD_X, 0.222, 0.298], [1.2, 0.72, 0.4], 8),
    ...limb(
      [
        [HEAD_X - 0.1, 0.262, 0.28],
        [HEAD_X - 0.145, 0.297, 0.255],
      ],
      0.014,
      0.012,
      PALETTE.ink
    ),
    ...limb(
      [
        [HEAD_X + 0.1, 0.262, 0.28],
        [HEAD_X + 0.145, 0.297, 0.255],
      ],
      0.014,
      0.012,
      PALETTE.ink
    ),

    // Big amber eyes. The mid-tone coat is what buys these back: on the old near-white head a pale
    // sclera was invisible, and the ring had to carry the colour by itself. Here the honey ring
    // reads against both the coat and the mask, and it is still the only warm note in the corner.
    ...eye([HEAD_X - 0.115, 0.505, 0.215], 0.078, eyeOpts),
    ...eye([HEAD_X + 0.115, 0.505, 0.215], 0.078, eyeOpts),
    // Brows in INK and high, with a clear gap over each eye — that gap is what makes the pair read
    // as raised rather than as a frown, and ink puts them in the same drawn language as the nose.
    ...brow(-1, HEAD_X - 0.115, 0.615, 0.19),
    ...brow(1, HEAD_X + 0.115, 0.615, 0.19),

    // SHAG, on every edge that meets sky. The ink contour traces whatever the outermost primitive
    // is, so these are not surface texture — they ARE the silhouette, and a shaggy animal must
    // never be drawn with a smooth outline. All in `coat`: see the shoulder-line note above.
    //
    // THE FACE RUFF is the one that buys the species. A bare face inside a collar of fur is the
    // read every drawn yeti has and no bear or koala has, and it costs nothing in envelope because
    // it hangs UNDER a head that already has room below it. It stops at 1.78π rather than closing
    // the circle: past that the inward clumps run out of MASCOT_BOX.in, and the inward side is the
    // far side under the rig's yaw, so it is the cheapest arc to give up.
    ...shag([HEAD_X, 0.47, -0.03], 0.245, 11, c.coat, 0.92, 1.78, 0.115, 0.22),
    // The crown, shortest of all: anything standing off the top of a head reads as horns whatever
    // it is made of. Enough to break the dome, not enough to spike it.
    ...shag([HEAD_X, 0.47, -0.06], 0.245, 7, c.coat, 0.2, 0.95, 0.085, 0.16),
    // The shoulder ring starts past 0.62π rather than at the vertical: a clump standing on the
    // crest of a shoulder is a spike wherever it is on the animal, and the lit band is what that
    // edge is supposed to be carrying.
    ...shag([-0.24, 0.0, -0.08], 0.25, 6, c.coat, 0.62, 1.16, 0.11, 0.2),
    // The SHOULDER CREST. Everything else on this figure is fringed on the outward side, which is
    // the side the frame crops: at the parked pose the reader sees the inward contour and the tops
    // of the shoulders, and the inward one has almost no envelope left (MASCOT_BOX.in). So the top
    // of the yoke carries its own ruff, raked hard so it lies along the back instead of standing on
    // the crest, and that is the fur the composition actually shows.
    ...shag([-0.14, 0.05, -0.05], 0.28, 5, c.coat, 0.35, 0.8, 0.1, 0.35),
    ...tufts([0.18, -0.04, 0.02], 0.2, 3, c.coat, 0.05, 0.5, 0.24),
    // the flank ring is the widest thing on the figure, so its reach is set by MASCOT_BOX.out
    // rather than by taste
    ...shag([-0.14, -0.16, -0.07], 0.33, 8, c.coat, 0.86, 1.42, 0.15, 0.25),
    // the haunch ring is what MASCOT_BOX.down binds: the cub is the adult scaled 0.82 and dropped
    // 0.17, so every unit of fur hung off the adult's underside costs the cub 0.82 of it
    ...shag([-0.24, -0.43, -0.04], 0.21, 6, c.coat, 1.12, 1.52, 0.1, 0.15),
    // INTERIOR fur was tried here and REMOVED, which is worth recording so it is not tried again.
    // Rows of clumps laid over the chest read as petals or scales stuck onto the animal at every
    // depth I could seat them: proud, each one takes its own ink outline; flat and buried, the ones
    // that still draw are lit patches with an outline anyway. The renderer has no way to draw
    // texture INSIDE a silhouette here — what it has is tone bands, which the shoulder line, the
    // flank strip and the bib already spend. So the shag is a silhouette device only.

    // Snow knocked off the bough and caught on him — the detail that puts him IN the tree. It is
    // the brightest value on the figure and it is deliberately tiny: a crest on the crown and one
    // dab on the outer shoulder, both sitting on surfaces that face the sky.
    sph(0.075, PALETTE.boughSnow, [HEAD_X + 0.02, 0.71, 0.06], [1.5, 0.42, 0.9], 8),
    sph(0.07, PALETTE.boughSnow, [-0.38, 0.105, 0.04], [1.4, 0.4, 0.85], 8),
  ]
}

/**
 * The near arm, hooked over the low bough — authored about the SHOULDER so the rig's slow rock
 * swings the whole limb where it grips.
 *
 * The reviewer could not find an arm on the last pass, and the reason it went missing is that it
 * was the same tone as the chest it crosses. So the arm is now its OWN value: `deep` from the
 * shoulder down, over a `coat` body — the device the spring bluebird's folded wing uses, and the
 * one thing that survives the toon ramp flattening two overlapping masses into one silhouette. The
 * `lit` cap at the top is where the body's shoulder line hands off onto the limb, so the eye reads
 * bright shoulder → dark arm → pale palm and lands on the grip.
 *
 * The paw straddles the bough (knuckles above it, fingers curling below and forward) rather than
 * resting on top of it: a hand laid flat on a branch reads as a hand floating near a branch once
 * the silhouettes flatten. The fingers step back UP to `coat` so they separate from the dark paw
 * they hang off.
 */
function yetiArm(c: Coat): ClayPart[] {
  return [
    sph(0.15, c.deep, [0, 0, 0], [1.02, 1.0, 0.86], 12),
    sph(0.13, c.lit, [-0.01, 0.06, 0.06], [1.0, 0.3, 0.5], 10),
    ...limb(
      [
        [0, -0.03, 0],
        [-0.03, -0.2, 0.01],
        [-0.055, -0.31, 0.02],
      ],
      0.115,
      0.092,
      c.deep
    ),
    ...limb(
      [
        [-0.055, -0.31, 0.02],
        [-0.075, -0.4, 0.04],
        [-0.09, -0.48, 0.05],
      ],
      0.098,
      0.082,
      c.deep
    ),
    sph(0.115, c.deep, [-0.1, -0.515, 0.06], [1.05, 0.94, 0.9], 12),
    // a `coat` sliver down the arm's OUTER edge, so a limb drawn in one flat dark tone still turns
    sph(0.085, c.coat, [-0.075, -0.24, 0.08], [0.5, 1.5, 0.55], 10),
    // bare palm, the same mask tone as the face so the two bare notes rhyme
    sph(0.062, c.mask, [-0.09, -0.555, 0.13], [1.15, 0.9, 0.5], 10),
    cone(0.032, 0.15, c.coat, [-0.175, -0.57, 0.09], [0, 0, 2.75], [1, 1, 0.85], 6),
    cone(0.032, 0.15, c.coat, [-0.105, -0.6, 0.11], [0, 0, 3.05], [1, 1, 0.85], 6),
    cone(0.03, 0.14, c.coat, [-0.035, -0.585, 0.1], [0, 0, 3.42], [1, 1, 0.85], 6),
    // thumb hooked back over the top of the bough — the piece that closes the grip
    cone(0.03, 0.13, c.coat, [-0.005, -0.445, 0.12], [0, 0, -1.35], [1, 1, 0.85], 6),
    // Elbow feathering, hanging off the arm's outer edge — the longest fur on the animal, because a
    // forearm is where a shaggy creature's coat actually hangs. In `coat` over a `deep` limb: the
    // first pass drew this fringe in the arm's own tone, so it was texture nobody could see.
    ...shag([-0.03, -0.24, 0.02], 0.13, 6, c.coat, 0.95, 1.46, 0.12, 0.3),
    sph(0.055, PALETTE.boughSnow, [-0.05, -0.38, 0.115], [1.5, 0.42, 0.7], 8),
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
 * The cub is not a shrunk copy parked at the same address: it sits further OUT toward the frame
 * edge, further FORWARD toward the camera and lower in the drift, so the two outlines separate and
 * the near figure OVERLAPS the far one rather than abutting it.
 *
 * The step is capped by the staging, not by taste: every part of the cub lands at `scale × the
 * adult's position + this offset`, so the offset walks its FACE toward the frame edge as well as
 * its body. The OUTWARD step is the one that runs out first — the outer end of the outer eyebrow
 * hits FACE_BOX at x = −0.19, well before the body reaches MASCOT_BOX.out — so most of the
 * separation is bought DOWNWARD and FORWARD instead, which is also where it does more good: the two
 * heads have to clear each other, and a cub in front of its parent overlaps rather than abuts. The
 * forward step is capped in turn by the paw, which reaches PEEKER_ABS_Z a hair before the nose does.
 */
const SMALL_OFFSET: V3 = [-0.115, -0.17, 0.11]

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
      at: [(-0.24 * s + off[0]) * dir, 0.05 * s + off[1], 0.18 * s + off[2]],
      parts: facing(dir, placed(s, [0, 0, 0], yetiArm(coat))),
      ink: true,
    },
  ]
}
