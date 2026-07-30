import { PALETTE } from '../../palette'
import type { ClayPart } from './clay-kit'
import { cone, eye, facing, leafFan, limb, shag, sph, type V3 } from './peeker-kit'
import type { PeekerPiece } from './peeker-cast'

/**
 * Task 56 — the WINTER checkpoint: snow-laden pine boughs arcing in from the frame edge with a
 * fringe of icicles under them, a drift banked across the bottom, and the cast standing IN it.
 *
 * Same corner grammar as `peeker-jungle.tsx` (the file the look-dev gate was run against): a limb
 * sweeping in from the outer edge, foliage dense enough that the character sits INSIDE it, and
 * something dropping past the bottom crop.
 *
 * Task 61 recast the pair — the two yetis are gone and a POLAR BEAR and a PENGUIN stand in the same
 * drift. The dressing below is unchanged; it was built for a figure buried to the chest in snow and
 * both new animals want exactly that. See the polar-bear section for what the value scheme has to
 * survive, which is the same wall the yetis hit and is if anything harder for an animal that has to
 * read as white.
 *
 * THE VALUE SCHEME IS INVERTED FROM THE FIRST PASS, and it is the constant this corner is built on.
 * Winter's grade is a pale lilac wash and the corner's measured backdrop sits at L* 85.6; a
 * near-white figure renders at about 66 and lands 20 points off it, which is what the original
 * yetis measured (20.7) and were rebuilt over. Every figure that stands here is therefore painted
 * MID and keeps its near-whites as small lit accents. A white animal cannot hold a silhouette
 * against a white sky, and painting it whiter makes it worse rather than better.
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

  // WHAT THE FIGURE IS SEEN AGAINST (Task 61, the white-bear ruling). A white animal cannot
  // separate itself by its own value — the separation has to be put BEHIND and BENEATH it, which is
  // exactly where it lives in life and is the one thing a median dL* of the figure cannot see.
  //
  // The dark backing is spruce massed behind the shoulder and head line, low and wide, at the depth
  // the boughs already occupy. It costs one merged blob and it turns the most valuable part of the
  // outline — the head, which is what a reader looks for — from white-on-pale-sky into
  // white-on-near-black.
  parts.push(
    sph(0.34, PALETTE.spruceDeep, [-0.16, 0.12, -0.22], [1.25, 0.72, 0.16], 10),
    sph(0.24, PALETTE.spruceDeep, [0.22, 0.3, -0.22], [1.0, 0.8, 0.14], 10),
    sph(0.2, PALETTE.pineDeep, [-0.42, 0.02, -0.21], [1.0, 0.66, 0.13], 9)
  )
  // The CAST SHADOW, thrown forward-left into the drift the way a low winter sun throws one. It is
  // deliberately the deepest value in the corner: the contact edge under a white animal is what
  // stops it floating, and a pale contact reads as a figure hovering over snow.
  parts.push(
    sph(0.3, PALETTE.bearCast, [-0.12, -0.795, 0.2], [1.3, 0.16, 0.4], 12),
    sph(0.19, PALETTE.bearCast, [-0.4, -0.83, 0.16], [1.1, 0.13, 0.36], 10)
  )

  // Two ice shards breaking out of the drift crest — the one hard edge in a composition that is
  // otherwise all round white masses, and the thing that stops the drift reading as fog.
  parts.push(
    cone(0.05, 0.24, PALETTE.ice, [-0.59, -0.8, 0.1], [0, 0, 0.22], [1, 1, 0.7], 6),
    cone(0.04, 0.18, PALETTE.iceDeep, [0.62, -0.86, 0.1], [0, 0, -0.3], [1, 1, 0.7], 6)
  )

  return parts
}

// --- the polar bear ---------------------------------------------------------

/**
 * Task 61 — both yetis leave this corner. Aram: "the snowy biome can host a white bear and a
 * penguin instead of the yeti." The yeti is not retired, it is HIDDEN: it now lives in the snowy
 * trees out on the planet as a clickable easter egg (`yeti-egg.tsx`), which is also why the
 * `yetiCoat` family stays in the palette.
 *
 * THE WHITE-ON-LILAC TRAP, AND WHY THE BEAR IS NOT PAINTED WHITE.
 *
 * This corner's backdrop was measured under the real grade at a median L\* of 85.6 — a pale lilac
 * wash, almost flat across the whole box. The toon ramp scales a figure's albedo DOWNWARD while
 * leaving that backdrop untouched, and most of a corner figure sits in the ramp's darkest band, so
 * a pixel lands at roughly `L*(0.40 · Y_albedo)`. Run the palette's whites through it:
 *
 *   snow      albedo L* 95.5 → renders 66.2 → dL* 19.4
 *   boughSnow albedo L* 99.2 → renders 68.9 → dL* 16.7
 *
 * Those are FAILING numbers, and they are not hypothetical: they are within a point of the 20.7
 * the first yeti measured, which is what it was rejected and rebuilt over. The brighter the paint,
 * the closer the figure lands to the sky. A white bear painted white is invisible.
 *
 * So the mass is `bearCoat`, a warm ivory at albedo L* 69.4 (predicted dL* 38.6), carried by
 * `bearDeep` at 55.0 (predicted 49.3) over the underside and the far flank. Together with the ink
 * notes that lands the figure where the retired yeti landed, which measured 41.3.
 *
 * IT STILL READS WHITE, and this is the argument the art is built on rather than a hope. Every
 * single thing this animal is seen against is COOLER and BRIGHTER than it is: the drift it stands
 * in is `boughSnow`, the brightest value in the palette; the icicles are pale blue; the sky is
 * lilac. A warm cream mass in a blue-white field is read as white fur in cold light — which is
 * exactly what a polar bear on sunlit snow looks like, and photographs as. The near-whites are then
 * spent as a small AREA BUDGET (`foxBelly`, a warm near-white already in the palette, reused rather
 * than added) on the surfaces that face the sky: the bridge of the muzzle, the brow, the crest of
 * the shoulder, the top of the working paw. Those few bright notes are what say "this animal is
 * white"; a field of them would say nothing at all.
 *
 * WHAT MAKES IT A POLAR BEAR AND NOT A BROWN ONE, since at this size the colour cannot do it alone:
 *
 *  - a long straight ROMAN profile — skull running into muzzle in nearly one line, where a brown
 *    bear's face is dished;
 *  - a small BLACK nose pad, which is the single strongest cue on the animal;
 *  - small black eyes set wide apart;
 *  - small round ears set LOW and FAR BACK, where a brown bear's are larger and higher;
 *  - NO SHOULDER HUMP. A grizzly's hump is its most recognisable line and drawing one here would
 *    lose the species outright, so the back runs level from the nape to the rump;
 *  - a long neck, which is the proportion that actually separates the two species at a glance.
 */

/**
 * Where the working foreleg hinges off the shoulder.
 *
 * Moved OUTBOARD onto the chest's own front edge after the first capture, and it is the same fix
 * the yeti's arm needed for the same reason: hung from the middle of the body, a limb has nothing
 * to be seen against, and the reviewer's verdict on that version was simply that they could not
 * find an arm. On the contour it is read against sky on one side and against the body on the other.
 *
 * Its Z is also what binds `PEEKER_ABS_Z` on this figure — the paw is the furthest-forward thing on
 * the bear, ahead even of the nose.
 */
const BEAR_ARM_AT: V3 = [0.05, 0.05, 0.16]

/**
 * Head, neck, body, far foreleg.
 *
 * THE ONE-MASS TRAP, which this corner has fallen into twice. A pale animal built as a stack of
 * spheres comes back from the four-band ramp as a single shapeless blob — the reviewer's words on
 * the first yeti were "at reading size you cannot find a shoulder, an arm or a chest". The three
 * devices that fixed it are all used here: a hard light/dark EDGE laid straight across the figure
 * where the shoulder is, a limb drawn in its OWN value against the mass it crosses, and a narrow
 * pinch so head and body are two shapes rather than one egg. On this animal the pinch is the neck,
 * and it is doing double duty because a long neck is also the species cue.
 */
function bearBody(): ClayPart[] {
  return [
    // FAR FORELEG first, in `deep` so it recedes behind everything the body draws over it.
    ...limb(
      [
        [-0.14, -0.1, -0.07],
        [-0.13, -0.34, -0.06],
        [-0.14, -0.56, -0.05],
      ],
      0.088,
      0.078,
      PALETTE.bearDeep
    ),
    sph(0.1, PALETTE.bearDeep, [-0.145, -0.61, -0.03], [1.25, 0.78, 0.9], 10),

    // BODY. The back line runs LEVEL from the nape out to the rump and then falls away — no hump.
    // The rump is the figure's outward mass and it is what crops at the frame edge; the retired
    // small crocodile in the delta used to be what held `MASCOT_BOX.out` honest, so a long low
    // animal reaching out toward its own edge is doing an engineering job as well as a drawn one.
    sph(0.22, PALETTE.bearCoat, [-0.25, 0.04, -0.02], [1.05, 1.0, 0.92], 14),
    // the lit back, a coat-tone cap laid over the shadowed body from nape to rump
    sph(0.2, PALETTE.bearCoat, [-0.36, -0.14, -0.03], [1.15, 0.72, 0.9], 14),
    sph(0.17, PALETTE.bearCoat, [-0.19, -0.12, 0.08], [1.0, 0.86, 0.7], 12),
    sph(0.185, PALETTE.bearCoat, [-0.43, -0.26, -0.03], [1.0, 1.0, 0.88], 14),
    sph(0.245, PALETTE.bearCoat, [-0.19, -0.22, 0.0], [1.08, 1.02, 0.94], 14),
    sph(0.23, PALETTE.bearCoat, [-0.27, -0.48, -0.02], [1.06, 0.96, 0.9], 14),

    // THE SHOULDER EDGE — the single fix for "a shapeless pale mass". A narrow band of near-white
    // riding the top of the shoulder with `deep` immediately under it puts a hard tonal step
    // straight across the figure at y ~ 0.14, which is where a shoulder is. Both sit INSIDE the
    // silhouette: a bright rim on the OUTLINE would hand the sky back the separation this whole
    // scheme exists to win.
    sph(0.22, PALETTE.bearDeep, [-0.22, 0.16, 0.02], [1.1, 0.07, 0.42], 12),
    sph(0.26, PALETTE.bearDeep, [-0.21, 0.0, 0.12], [1.02, 0.2, 0.42], 12),
    // The lit back line, riding the level spine out to the rump. It is the largest single piece of
    // the white budget and it is spent on the one surface actually pointing at the sky — but it has
    // to sit ON the top contour, not across the body. Drawn wider and lower it came back as a white
    // BELT strapped round the animal, which is the painted-stripe defect the camel's noseband and
    // the pangolin's strata both had to be redrawn out of.
    sph(0.2, PALETTE.bearDeep, [-0.37, -0.09, -0.03], [1.05, 0.06, 0.4], 12),
    // the shaded underline along the belly, and the far flank falling away
    sph(0.24, PALETTE.bearDeep, [-0.25, -0.6, 0.06], [1.15, 0.26, 0.5], 12),
    sph(0.17, PALETTE.bearDeep, [-0.47, -0.34, 0.04], [0.5, 1.1, 0.45], 12),

    // NECK: long, and deliberately the narrowest thing between the head and the shoulders.
    ...limb(
      [
        [-0.2, 0.14, 0.02],
        [-0.08, 0.3, 0.04],
        [0.04, 0.44, 0.05],
      ],
      0.135,
      0.115,
      PALETTE.bearCoat
    ),
    // a shaded throat under it, so the neck is a cylinder rather than a flat strap
    sph(0.1, PALETTE.bearDeep, [-0.03, 0.31, 0.14], [1.35, 0.7, 0.5], 10),

    // SKULL and the ROMAN MUZZLE, run as one straight chain from the brow to the nose. That
    // unbroken line is the polar bear's profile; breaking it with a dished stop would draw a
    // grizzly, and rounding it into a ball would draw the plush ape this corner used to hold.
    sph(0.155, PALETTE.bearCoat, [0.1, 0.565, 0.02], [1.05, 0.98, 0.94], 14),
    ...limb(
      [
        [0.14, 0.545, 0.1],
        [0.26, 0.52, 0.14],
        [0.35, 0.5, 0.15],
      ],
      0.105,
      0.078,
      PALETTE.bearCoat
    ),
    sph(0.08, PALETTE.bearCoat, [0.362, 0.497, 0.15], [0.92, 0.95, 0.92], 12),
    // the lit bridge — one of the four places the near-white is spent, and the one that most makes
    // the reader call the animal white, because it is the surface pointing at the sky
    sph(0.07, PALETTE.bearDeep, [0.25, 0.53, 0.16], [1.9, 0.2, 0.6], 10),
    // the jaw's shaded underside, which is what gives the muzzle a depth as well as a length
    sph(0.075, PALETTE.bearDeep, [0.245, 0.452, 0.16], [1.7, 0.44, 0.55], 10),

    // THE BLACK NOSE PAD. Small, and set on TOP of the muzzle's end rather than capping it: a
    // taper's tip becomes whatever is placed at it, which is how the canyon pangolin's snout turned
    // into an anteater's. Here the muzzle ends in the bear's own tone and the nose sits back on it.
    sph(0.048, PALETTE.ink, [0.352, 0.53, 0.19], [1.15, 0.85, 0.75], 10),
    // the mouth: one fine dark line along the jaw, dropping slightly at its rear
    ...limb(
      [
        [0.372, 0.462, 0.16],
        [0.28, 0.448, 0.185],
        [0.19, 0.462, 0.16],
      ],
      0.011,
      0.014,
      PALETTE.ink
    ),

    // EYES: small, black, set WIDE. A bear's eye is a dark bead with no visible sclera, so `bare`
    // is right here — the kit's note is that a white bead on a pale face reads as a goggle, and
    // this face is as pale as they come. The catch-light inside `eye()` is what keeps them alive.
    ...eye([0.185, 0.612, 0.13], 0.042, { bare: true, iris: PALETTE.ink }),
    ...eye([0.02, 0.63, 0.08], 0.038, { bare: true, iris: PALETTE.ink }),
    // a near-white brow over the near eye — the second lit note, and what stops the eye reading as
    // a hole punched in a flat mass
    sph(0.05, PALETTE.bearDeep, [0.185, 0.648, 0.12], [1.35, 0.24, 0.6], 10),

    // EARS: small, round, LOW and set back. Their smallness is the cue — an ear big enough to
    // notice turns the animal into a bear cub or a dog.
    sph(0.058, PALETTE.bearCoat, [-0.02, 0.655, 0.02], [1.0, 1.05, 0.75], 10),
    sph(0.052, PALETTE.bearDeep, [0.11, 0.685, -0.08], [1.0, 1.05, 0.7], 10),
    sph(0.028, PALETTE.bearDeep, [-0.026, 0.652, 0.07], [1.0, 1.0, 0.6], 8),

    // GUARD HAIR. Split between the two tones ON PURPOSE, and it is a change from how the yeti's
    // fur was handled. Its rings were all in the coat tone, which meant the outline met the sky at
    // full coat value; here the rings the reader sees against SKY at the top of the figure stay in
    // `bearCoat` (they are lit, and they carry the white read), while the flank and haunch rings —
    // which run down the frame-edge side and against the drift — go to `bearDeep`, so the
    // silhouette's longest edge is drawn at dL* ~49 instead of ~39.
    // The reaches are set by the box, not by how shaggy a bear ought to be. A ring costs
    // `root + len·0.66` outward from its centre and then a further half-lobe beyond that, so the
    // flank ring binds `MASCOT_BOX.out` and the haunch ring binds `down` — both measured over the
    // sweep rather than assumed, after a first pass that put them at 0.743 and 0.900.
    ...shag([-0.26, 0.06, -0.06], 0.24, 5, PALETTE.bearCoat, 0.36, 0.82, 0.1, 0.35),
    ...shag([-0.26, -0.24, -0.06], 0.26, 6, PALETTE.bearDeep, 0.9, 1.36, 0.075, 0.42, 0.34),
    ...shag([-0.28, -0.5, -0.04], 0.2, 4, PALETTE.bearCoat, 1.12, 1.48, 0.07, 0.3, 0.34),
  ]
}

/**
 * The working foreleg, hinged at the shoulder and planted in the drift's crest.
 *
 * Drawn in `bearDeep` over a `bearCoat` body for the reason the yeti's arm had to be: the reviewer
 * could not find the last one because it was the same tone as the chest it crosses, and two
 * overlapping masses at one value come back from the ramp as a single silhouette. The paw then
 * steps BACK up to the coat tone with a near-white top, so the eye reads shoulder → dark limb →
 * bright paw and lands on the contact.
 *
 * It ends BELOW the drift's visible crest rather than on top of it. A foot resting exactly on a
 * surface reads as a foot floating near it once the silhouettes flatten; a foot sunk a little into
 * snow reads as weight.
 */
function bearArm(): ClayPart[] {
  return [
    sph(0.14, PALETTE.bearCoat, [0, 0, 0], [1.05, 1.0, 0.88], 12),
    // the lit cap where the body's shoulder edge hands off onto the limb
    sph(0.12, PALETTE.bearDeep, [-0.005, 0.05, 0.05], [1.0, 0.16, 0.45], 10),
    ...limb(
      [
        [0, -0.04, 0.01],
        [0.01, -0.3, 0.02],
        [0.02, -0.52, 0.04],
      ],
      0.105,
      0.09,
      PALETTE.bearCoat
    ),
    // one shade edge down the limb's inboard side, so it still turns against the chest behind it
    sph(0.08, PALETTE.bearDeep, [0.06, -0.28, 0.04], [0.42, 1.5, 0.5], 10),
    // a coat-tone sliver down the limb's outer edge, so a leg drawn in one flat dark tone still turns
    sph(0.075, PALETTE.bearDeep, [-0.062, -0.24, 0.075], [0.42, 1.4, 0.5], 10),
    // THE PAW: big and blunt, which is the polar bear's own proportion, stepping back up to the
    // coat tone so the limb ends on a bright note rather than fading into the drift.
    sph(0.135, PALETTE.bearCoat, [0.03, -0.63, 0.07], [1.3, 0.72, 1.0], 12),
    sph(0.11, PALETTE.bearDeep, [0.02, -0.675, 0.03], [1.3, 0.36, 0.9], 10),
    sph(0.085, PALETTE.bearDeep, [0.03, -0.588, 0.13], [1.4, 0.16, 0.6], 10),
    // four short ink claws along its front edge — small, because a polar bear's claws are short and
    // because anything longer turns a resting paw into a raised one
    ...[-0.06, -0.005, 0.05, 0.1].map((dx, i) =>
      cone(0.016, 0.05 + 0.006 * i, PALETTE.ink, [0.03 + dx, -0.688, 0.13], [0, 0, 3.14 + dx * 1.2], undefined, 6)
    ),
    // guard hair hanging off the back of the leg — the one place a polar bear is visibly shaggy
    ...shag([-0.04, -0.3, 0.0], 0.1, 5, PALETTE.bearCoat, 0.98, 1.42, 0.1, 0.3),
  ]
}

// --- the penguin ------------------------------------------------------------

/**
 * The other half of the winter recast, and the brief's own "easy win" — because a penguin is a
 * naturally high-contrast animal, so unlike the bear it does not have to fight its own colour.
 *
 * Its back is `penguinBack`, a blue-charcoal rather than `ink`. That is deliberate: a bird painted
 * in the outline colour has no interior at all and reads as a hole cut in the sky, and it also
 * leaves the ink contour with nothing to contour. A charcoal with a value of its own measures dL*
 * ~69 against this sky, which is more separation than anything else in the cast.
 *
 * The white front is `foxBelly` and it measures dL* ~22 — a low number, and the one place in this
 * task where a pale field is allowed to be large. It is legible anyway because it is not being read
 * against the sky at all: it is bounded on every side by charcoal and by the ink contour, so it
 * reads by ADJACENCY. That is the honest distinction from the yeti's failure, where the near-white
 * was the OUTLINE and had nothing but sky beyond it.
 *
 * `penguinFlash` on the bill and feet is the corner's one warm note — the same role the red fox
 * plays in the winter set out on the planet, and it is spent nowhere else.
 */

/** Where the near flipper hinges off the shoulder. */
const FLIPPER_AT: V3 = [-0.14, 0.12, 0.1]

function penguinBody(): ClayPart[] {
  return [
    // FAR FLIPPER first, behind everything, in the back tone and a size down
    ...limb(
      [
        [0.05, 0.06, -0.14],
        [0.1, -0.14, -0.15],
        [0.11, -0.32, -0.14],
      ],
      0.06,
      0.038,
      PALETTE.penguinBack
    ),

    // BODY: one tall rounded teardrop. A penguin is a single mass and that is the whole shape —
    // trying to give it a shoulder or a waist would only make it a bird-shaped person.
    sph(0.27, PALETTE.penguinBack, [-0.08, -0.12, -0.02], [1.0, 1.38, 0.92], 16),
    sph(0.235, PALETTE.penguinBack, [-0.1, -0.46, -0.02], [1.02, 0.94, 0.88], 14),

    // THE WHITE FRONT, forward in Z so it wins the depth test against the back it sits on, and cut
    // as a clean rounded shield rather than a soft gradient. The hard boundary IS the animal: a
    // penguin blurred at the waterline between its dark and pale halves is a generic bird.
    sph(0.2, PALETTE.foxBelly, [0.0, -0.14, 0.19], [0.92, 1.5, 0.5], 14),
    sph(0.155, PALETTE.foxBelly, [-0.02, -0.44, 0.16], [1.0, 0.86, 0.45], 12),
    // a shaded edge down the front's outward side, so the shield is a curved chest and not a decal
    sph(0.11, PALETTE.hareShade, [-0.19, -0.22, 0.13], [0.55, 1.7, 0.4], 12),

    // FEET: splayed forward and out onto the drift, which is what stops an upright egg from
    // hovering. Toes forward in Z as well as down, because a penguin stands on its heels with the
    // feet pointing at the viewer.
    ...[-0.19, 0.0].map((x) =>
      sph(0.075, PALETTE.penguinFlash, [x, -0.655, 0.2], [1.35, 0.42, 1.5], 10)
    ),
    ...[-0.235, -0.15, -0.045, 0.045].map((x) =>
      cone(0.022, 0.09, PALETTE.penguinFlash, [x, -0.672, 0.3], [0, 0, 3.14], [1, 1, 0.8], 6)
    ),

    // HEAD: small and round, set straight on the body with almost no neck — the proportion that
    // makes a penguin comic rather than stately.
    sph(0.155, PALETTE.penguinBack, [0.04, 0.4, 0.0], [1.02, 1.0, 0.94], 14),
    // THE FACE PATCH, sweeping up from the throat past the eye. A dark head with a dark eye on it
    // has no face at all at reading size; this is what the eye is read against.
    sph(0.115, PALETTE.foxBelly, [0.09, 0.325, 0.11], [1.05, 0.9, 0.6], 12),
    sph(0.06, PALETTE.foxBelly, [0.12, 0.44, 0.11], [1.1, 0.85, 0.5], 10),
    // the eye, an ink bead on the pale patch with the kit's catch-light
    ...eye([0.135, 0.435, 0.14], 0.038, { bare: true, iris: PALETTE.ink }),

    // THE BILL: long, straight and slightly drooped, in the warm note. Two masses with an ink line
    // between them, because a single cone reads as a beak-shaped lump and the line is what makes it
    // a bill that opens.
    ...limb(
      [
        [0.15, 0.375, 0.11],
        [0.26, 0.355, 0.12],
        [0.35, 0.325, 0.11],
      ],
      0.042,
      0.024,
      PALETTE.penguinFlash
    ),
    sph(0.026, PALETTE.penguinFlash, [0.358, 0.322, 0.11], [0.9, 0.95, 0.9], 8),
    ...limb(
      [
        [0.345, 0.318, 0.14],
        [0.25, 0.345, 0.15],
        [0.16, 0.365, 0.14],
      ],
      0.007,
      0.01,
      PALETTE.ink
    ),
  ]
}

/**
 * The near flipper: one stiff blade, hinged at the shoulder and hanging down at rest.
 *
 * Stiff is the point — a penguin's flipper does not fold, and `applyFlipper` swings the whole thing
 * through the widest arc in the cast for exactly that reason. Drawn in `penguinBack` with a pale
 * leading edge, so that when it swings out over the sky the reader still gets an interior rather
 * than a black stroke.
 */
function penguinFlipper(): ClayPart[] {
  return [
    sph(0.085, PALETTE.penguinBack, [0, 0, 0], [1.0, 1.0, 0.7], 10),
    ...limb(
      [
        [0, -0.04, 0.01],
        [-0.035, -0.24, 0.02],
        [-0.06, -0.42, 0.02],
      ],
      0.072,
      0.04,
      PALETTE.penguinBack
    ),
    sph(0.045, PALETTE.penguinBack, [-0.065, -0.44, 0.02], [1.0, 1.0, 0.8], 10),
    // the pale leading edge, inboard of the blade's own contour
    sph(0.05, PALETTE.hareShade, [0.008, -0.2, 0.06], [0.42, 1.7, 0.5], 10),
  ]
}

export function winterPieces(kind: 'polarBear' | 'penguin', dir: 1 | -1): PeekerPiece[] {
  return kind === 'polarBear'
    ? [
        { slot: 'body', at: [0, 0, 0], parts: facing(dir, bearBody()), ink: true },
        {
          slot: 'a',
          at: [BEAR_ARM_AT[0] * dir, BEAR_ARM_AT[1], BEAR_ARM_AT[2]],
          parts: facing(dir, bearArm()),
          ink: true,
        },
      ]
    : [
        { slot: 'body', at: [0, 0, 0], parts: facing(dir, penguinBody()), ink: true },
        {
          slot: 'a',
          at: [FLIPPER_AT[0] * dir, FLIPPER_AT[1], FLIPPER_AT[2]],
          parts: facing(dir, penguinFlipper()),
          ink: true,
        },
      ]
}
