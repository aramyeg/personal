import {
  ENDING_AIM_DROP,
  CAMERA_FOV,
  ZOOM_FACTOR,
  endingRig,
  WORLD_RADIUS,
} from './camera'
import { PARALLAX_REF_ASPECT } from './camera-parallax'

/**
 * THE "LET'S CREATE" NEON (Task 99) — the sign that fills the money shot's flanks, as data.
 *
 * ============================================================================
 * WHAT THIS MODULE IS
 * ============================================================================
 * Aram asked for "a stylistically similar neon sign over the globe from left and right side to
 * fill the white space with the note 'Let's Create'". The design that won the look-dev is a
 * SPLIT SCRIPT: "Lets" on the left flank, "Create" on the right, hand-bent monoline cursive in
 * the room's own rose — the same family as the connect pill's border and the CV underlines, so
 * the sign and the connect row speak with one voice ("come say hi" / "Lets Create").
 *
 * The apostrophe is gone as of Task 103, and the letterform block below says why.
 *
 * Everything the renderer and the gates both need lives HERE, with no three.js import: the
 * stroke control points, the sampling that turns them into a polyline, the world transforms
 * solved from the money shot's own projection, and the flicker envelope. `props/neon-sign.tsx`
 * turns the polylines into tubes; `neon-sign.test.ts` projects the same polylines through the
 * same cameras. One owner, two readers — the geometry the gate proves is the geometry that ships.
 *
 * ============================================================================
 * THE LIGHT, AND WHAT THE GLOW IS NOT
 * ============================================================================
 * The ending's light is the T90 baked atlas plus the studio blend; a real light source here
 * would re-light surfaces whose lighting is already baked, which is a lie the bake cannot
 * answer. So the neon CANNOT be a light. The glow is built from things that light nothing:
 * an unlit tube material (self-bright, lighting-independent) and an additive halo billboard
 * painted at mount. No scene light is added, no baked surface is touched, and the warm pool a
 * real neon would throw on the cyc is deliberately absent — the cyc's wash is an approved
 * picture, and a pre-authored tint would be a second opinion painted over it.
 *
 * ============================================================================
 * WHY THE SIGN IS INVISIBLE FOR THE WHOLE JOURNEY (the containment argument)
 * ============================================================================
 * The sign flanks the globe at globe height, which is INSIDE the journey camera's frame — the
 * desk-stage containment theorem cannot park it below the frustum the way the desk and the
 * seated stand are parked. What it has instead is the studio lights: `flickerAt` is exactly 0
 * wherever `studioLightsFor` is exactly 0, which is every frame of the journey AND the whole
 * still beat (`studioLightsAt` starts at zoom 0.06), and the component holds `visible = false`
 * whenever the envelope is 0. A dark neon is off glass at twenty units — invisible is what it
 * would honestly be — so the sign's entrance IS the lights-up, riding the ending's one clock.
 * `neon-sign.test.ts` pins the whole journey domain at exactly 0.
 *
 * ============================================================================
 * THE PHONE'S FRAME
 * ============================================================================
 * At 390×844 the globe fills the frame's width; there is no white space to fill, and the sign
 * has nothing to do there. It does nothing gracefully: the words are world geometry solved for
 * the landscape flanks, and a portrait frame at this pull-back simply cannot see |x| > 3
 * world units at the sign's depth — including under the full parallax swing, which the hide
 * gate sweeps. No fork, no branch: the composition hides it by the same aperture arithmetic
 * that composed it.
 */

// --- the letterforms --------------------------------------------------------

/**
 * Stroke control points, authored over a Caveat template (the lab's hand — the desk note and
 * the connect row write in it) and then bent the way a tube bender would: a continuous main
 * stroke per word plus the marks a bender runs separately (a t crossbar; the a's bowl).
 * Units: x-height = 1, baseline y = 0, x grows right.
 *
 * ── TASK 103, and it is three letterform decisions rather than a nudge ─────────────────────
 *
 * THE `a` WAS UNREADABLE BECAUSE ITS LIGATURE BISECTED ITS COUNTER. T99 ran the whole word as
 * one tube, so the join out of the `e` had to climb from the baseline to the top of the bowl —
 * and since the bowl started at the same x the join left from, that climb was a CHORD straight
 * across the counter. A round letter whose hole is crossed by a line is a blob at any size.
 * The fix is topological, not cosmetic: the bowl is now ITS OWN TUBE (a bender runs it as one
 * anyway) and the main stroke arcs OVER the bowl and comes down its right side as the stem.
 * Nothing crosses the counter; `neon-sign.test.ts` gates the clear disc at `A_COUNTER`.
 *
 * THE `L` NOW READS AS A CAPITAL. Its loop was 0.32 wide against a 0.11 tube — the counter shut
 * at money-shot size and the letter read as a hook. The loop is wider, the cap is 2.34 against
 * T99's 2.04, and `ets` moved right so the `e` clears the L's bottom loop instead of sitting on
 * it. Gated by `letsCapHeight()`.
 *
 * NO APOSTROPHE, AND THAT IS A SIGN-MAKER'S CHOICE. At the money shot the mark measured about
 * ten pixels of tube in a gap between the t's ascender and the s's crest — it read as dirt on
 * the cyc rather than as punctuation, and it was the second thing competing with the L in the
 * upper band. Mocked both ways over the real capture (scratchpad/t103/sketch-b{,-apos}.png):
 * `LETS` is the cleaner sign. Neon shops drop apostrophes for exactly this reason.
 */
export type SignStroke = readonly (readonly [number, number])[]

export const LETS_STROKES: readonly SignStroke[] = [
  // main stroke: script L (big top loop, long stem, bottom loop), into e, into t, into s
  [
    [0.72, 1.86], [0.86, 2.16], [0.74, 2.34], [0.50, 2.20], [0.40, 1.80],
    [0.40, 1.20], [0.44, 0.70], [0.50, 0.28],
    [0.36, 0.06], [0.14, 0.04], [0.04, 0.26], [0.18, 0.44],
    [0.48, 0.40], [0.80, 0.20], [0.98, 0.14],
    [1.22, 0.40], [1.38, 0.78], [1.34, 0.96], [1.16, 0.86], [1.12, 0.52],
    [1.24, 0.14], [1.46, 0.04], [1.64, 0.16],
    [1.82, 0.45], [1.94, 1.00], [2.02, 1.52],
    [2.08, 1.00], [2.12, 0.45], [2.20, 0.10], [2.38, 0.05], [2.52, 0.16],
    [2.68, 0.50], [2.80, 0.95],
    [2.62, 0.78], [2.78, 0.50], [2.86, 0.26], [2.72, 0.03], [2.52, 0.12],
  ],
  // t crossbar
  [[1.80, 1.10], [2.00, 1.17], [2.22, 1.12]],
]

export const CREATE_STROKES: readonly SignStroke[] = [
  [
    // C, r, e — T99's, untouched: nobody complained about them
    [0.95, 1.60], [0.70, 1.76], [0.40, 1.55], [0.26, 1.00], [0.32, 0.42],
    [0.55, 0.08], [0.85, 0.05], [1.05, 0.22],
    [1.14, 0.16], [1.28, 0.60], [1.34, 0.98],
    [1.44, 0.80], [1.56, 0.70], [1.62, 0.40], [1.68, 0.08], [1.84, 0.12],
    [2.05, 0.38], [2.20, 0.74], [2.16, 0.95], [1.98, 0.85], [1.94, 0.50],
    [2.06, 0.12], [2.30, 0.03], [2.50, 0.16],
    // the a: the ligature arcs OVER the bowl and descends its right side as the stem
    [2.68, 0.48], [2.88, 0.94], [3.10, 1.14], [3.32, 1.04],
    [3.38, 0.62], [3.40, 0.26], [3.50, 0.08], [3.66, 0.18],
    // t, e — T99's, shifted +0.14 to make room for the wider bowl
    [3.72, 0.45], [3.84, 1.00], [3.92, 1.52],
    [3.98, 1.00], [4.02, 0.45], [4.10, 0.10], [4.28, 0.05], [4.42, 0.16],
    [4.60, 0.40], [4.74, 0.76], [4.70, 0.96], [4.52, 0.86], [4.48, 0.52],
    [4.60, 0.12], [4.82, 0.03], [5.02, 0.18],
  ],
  // the a's bowl, its own run of tube — both terminals butt UNDER the stem, so the ring reads
  // closed and no cap shows as a nub in the counter's rim
  [
    [3.34, 0.86], [3.16, 1.00], [2.92, 1.00], [2.74, 0.80], [2.70, 0.50],
    [2.80, 0.22], [3.02, 0.08], [3.24, 0.18], [3.36, 0.46], [3.38, 0.74],
  ],
  // t crossbar
  [[3.70, 1.10], [3.90, 1.17], [4.12, 1.12]],
]

/**
 * The disc the a's counter must keep clear, in letterform units — the centre of the bowl and
 * the radius inside which NOTHING may be drawn. This is Aram's complaint written as a number:
 * a round letter reads by its hole, so the hole is a gate rather than a hope.
 */
export const A_COUNTER = { x: 3.04, y: 0.54, r: 0.3 } as const

/** The L's cap height, which is what "the L is too small" was about. */
export function letsCapHeight(): number {
  let top = -Infinity
  for (const stroke of LETS_STROKES) for (const [, y] of sampleStroke(stroke)) top = Math.max(top, y)
  return top
}

// --- sampling ---------------------------------------------------------------

/**
 * Centripetal Catmull-Rom through the control points, sampled dense enough that the tube and
 * the gates read the same shape. Two-point strokes are straight (the apostrophe).
 */
export function sampleStroke(points: SignStroke, perSegment = 5): [number, number][] {
  if (points.length === 2) {
    const out: [number, number][] = []
    for (let i = 0; i <= perSegment; i++) {
      const t = i / perSegment
      out.push([
        points[0][0] + (points[1][0] - points[0][0]) * t,
        points[0][1] + (points[1][1] - points[0][1]) * t,
      ])
    }
    return out
  }
  const out: [number, number][] = []
  const n = points.length
  for (let seg = 0; seg < n - 1; seg++) {
    const p0 = points[Math.max(0, seg - 1)]
    const p1 = points[seg]
    const p2 = points[seg + 1]
    const p3 = points[Math.min(n - 1, seg + 2)]
    for (let i = 0; i < perSegment; i++) {
      out.push(centripetal(p0, p1, p2, p3, i / perSegment))
    }
  }
  out.push([points[n - 1][0], points[n - 1][1]])
  return out
}

const ALPHA = 0.5
function centripetal(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number
): [number, number] {
  const d = (a: readonly [number, number], b: readonly [number, number]) =>
    Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), ALPHA), 1e-4)
  const t0 = 0
  const t1 = t0 + d(p0, p1)
  const t2 = t1 + d(p1, p2)
  const t3 = t2 + d(p2, p3)
  const tt = t1 + (t2 - t1) * t
  const lp = (
    a: readonly [number, number],
    b: readonly [number, number],
    ta: number,
    tb: number
  ): [number, number] => [
    (a[0] * (tb - tt) + b[0] * (tt - ta)) / (tb - ta),
    (a[1] * (tb - tt) + b[1] * (tt - ta)) / (tb - ta),
  ]
  const A1 = lp(p0, p1, t0, t1)
  const A2 = lp(p1, p2, t1, t2)
  const A3 = lp(p2, p3, t2, t3)
  const B1 = lp(A1, A2, t0, t2)
  const B2 = lp(A2, A3, t1, t3)
  return lp(B1, B2, t1, t2)
}

// --- placement --------------------------------------------------------------

/** The plane the sign hangs in. Behind the globe's centre, so the words read as living against
 *  the cyc rather than floating at the desk's depth — and far enough out laterally that the
 *  tube never enters the bake's ceiling (gated below). */
export const SIGN_Z = -2

/**
 * World units per letterform unit (the script's x-height).
 *
 * TASK 103: 0.95 → 1.064, a flat +12% on Aram's "a bit bigger… just a tad bit bigger". The
 * words grow a little more than that on top of it (the L's new loop and the a's new bowl widen
 * `Lets` by 8% and `Create` by 3%), which is the point — he asked for the L specifically. The
 * composition gates below are what say whether the result still flanks the globe, and they are
 * re-swept at both viewports and every parallax corner.
 */
export const SIGN_XHEIGHT = 1.064

/** Tube radius, as a fraction of the x-height — the look-dev's 8px stroke at its 66px x-height. */
export const SIGN_TUBE_R = 0.058

/**
 * The composition, authored in the frame Aram judges (ndc at the money shot, 1440×900) and
 * SOLVED into world space once at module load — the same treatment DESK_TOP_Y gets. The world
 * anchors are constants: the sign is an object in the room, and it must not move when the
 * viewport does.
 */
export const SIGN_BASELINE_NDC_Y = 0.267
export type SignWord = {
  strokes: readonly SignStroke[]
  /** ndc x of the word's CENTRE at the money shot, reference aspect. */
  ndcX: number
  /** screen-roll about the word's centre, radians — the hand-hung tilt from the look-dev. */
  roll: number
}
/**
 * TASK 106 — both words moved 0.08 ndc FURTHER OUT, on Aram's "a little bit more displaced from
 * the centre". That is 57.6 px per word at the money shot's own 1440.
 *
 * The complaint the number answers is an ASYMMETRY rather than a distance. `Create` is the wider
 * word, so at T99's spacing its `C` stood 0.083 ndc from the globe's silhouette while `Lets` had
 * 0.178 — better than twice the air on the left. The frame read as a globe with a word stuck to
 * it and a word floating away from it. The sweep is in the report; 0.06 still crowds the C, 0.10
 * starts trapping the outer tips against the frame edge under parallax, and 0.08 lands the tightest
 * gap at 0.162 with the furthest tube point at |x| = 0.890 of the half-frame at the worst envelope
 * corner. The delta is EQUAL on both sides deliberately: the two words are hand-hung (different
 * rolls, different widths) and evening the gaps by moving one of them further would be tidying away
 * the hand.
 */
export const SIGN_WORDS: readonly SignWord[] = [
  { strokes: LETS_STROKES, ndcX: -0.63, roll: (-4 * Math.PI) / 180 },
  { strokes: CREATE_STROKES, ndcX: 0.625, roll: (3 * Math.PI) / 180 },
]

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** Invert the money shot's projection onto the sign's plane: the world point that lands at a
 *  given ndc (x, y) at the REFERENCE aspect. Closed form — the ray through the ndc direction
 *  intersected with z = SIGN_Z. */
export function signPlanePointFor(ndcX: number, ndcY: number): [number, number, number] {
  const r = endingRig(ZOOM_FACTOR, ENDING_AIM_DROP)
  const dir: [number, number, number] = [
    ndcX * TAN_HALF_FOV * PARALLAX_REF_ASPECT,
    r.fwd[1] + r.up[1] * ndcY * TAN_HALF_FOV,
    r.fwd[2] + r.up[2] * ndcY * TAN_HALF_FOV,
  ]
  const s = (SIGN_Z - r.cam[2]) / dir[2]
  return [r.cam[0] + dir[0] * s, r.cam[1] + dir[1] * s, SIGN_Z]
}

/** A word's local bounding box over its sampled polylines, in letterform units. */
export function wordBounds(strokes: readonly SignStroke[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const stroke of strokes) {
    for (const [x, y] of sampleStroke(stroke)) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Every sampled point of a word, in WORLD space: local units scaled by SIGN_XHEIGHT, rolled
 * about the word's centre, anchored so the word's centre lands on its authored ndc x and its
 * baseline on SIGN_BASELINE_NDC_Y. This is the one transform; the tube builder and every gate
 * consume its output.
 */
export function wordPointsWorld(word: SignWord): [number, number, number][][] {
  const b = wordBounds(word.strokes)
  const cx = ((b.minX + b.maxX) / 2) * SIGN_XHEIGHT
  const anchor = signPlanePointFor(word.ndcX, SIGN_BASELINE_NDC_Y)
  const cos = Math.cos(word.roll)
  const sin = Math.sin(word.roll)
  return word.strokes.map((stroke) =>
    sampleStroke(stroke).map(([lx, ly]) => {
      const x = lx * SIGN_XHEIGHT - cx
      const y = ly * SIGN_XHEIGHT
      return [anchor[0] + x * cos - y * sin, anchor[1] + x * sin + y * cos, SIGN_Z]
    })
  )
}

/** The whole sign's world polylines, both words. Deterministic: pure arithmetic over consts. */
export function signPointsWorld(): [number, number, number][][] {
  return SIGN_WORDS.flatMap((w) => wordPointsWorld(w))
}

// --- the halo's frame, and why it lives here --------------------------------

/**
 * ONE OWNER FOR THE GLOW'S REGISTRATION (Task 103).
 *
 * The halo is a painted canvas mapped onto a quad. T99 painted it from the word's LOCAL,
 * UNROLLED bbox fitted uniformly inside its atlas cell, and then mapped the WHOLE cell onto a
 * quad built from the ROLLED world bbox — two different rectangles. The canvas carries a narrow
 * near-white core pass, so the mismatch was not a soft blur being soft: at the money shot every
 * stroke showed a white ghost offset from its own tube, and the ghost is what filled the a's
 * counter and the L's loop. Measured on the shipped capture (scratchpad/t103/crop-create-before
 * .png) the stretch was 1.17× on the `Lets` cell alone.
 *
 * So the frame is solved ONCE, here, in world space, and both the painter and the quad builder
 * read it: uniform scale `s` fits the word's padded WORLD bbox into its cell, and the quad is
 * then EXPANDED to whatever the full cell covers at that scale. Full cell ↔ full quad, uniform
 * scale, roll included — the mapping is exact by construction, and the gate re-derives it.
 */
export const HALO_CANVAS_W = 1024
export const HALO_CANVAS_H = 320
/** World-unit pad around each word for the glow to breathe into. */
export const HALO_PAD = 0.55

/** The atlas cell a word owns, in canvas px. `Create` is the wider word and gets the wider cell. */
export const haloCell = (i: number): { x: number; w: number } =>
  i === 0 ? { x: 0, w: HALO_CANVAS_W * 0.4 } : { x: HALO_CANVAS_W * 0.4, w: HALO_CANVAS_W * 0.6 }

export type HaloFrame = {
  /** canvas px per world unit */
  s: number
  /** the quad's world rect — exactly what the full cell maps onto */
  x0: number
  x1: number
  y0: number
  y1: number
  /** the cell's uv range */
  u0: number
  u1: number
}

export function haloFrame(i: number): HaloFrame {
  const cell = haloCell(i)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const stroke of wordPointsWorld(SIGN_WORDS[i])) {
    for (const [x, y] of stroke) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  const wW = maxX - minX + 2 * HALO_PAD
  const wH = maxY - minY + 2 * HALO_PAD
  const s = Math.min(cell.w / wW, HALO_CANVAS_H / wH)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return {
    s,
    x0: cx - cell.w / (2 * s),
    x1: cx + cell.w / (2 * s),
    y0: cy - HALO_CANVAS_H / (2 * s),
    y1: cy + HALO_CANVAS_H / (2 * s),
    u0: cell.x / HALO_CANVAS_W,
    u1: (cell.x + cell.w) / HALO_CANVAS_W,
  }
}

/** World → canvas px, for the painter. The inverse of the quad's uv, by construction. */
export const haloPx = (f: HaloFrame, x: number): number =>
  f.u0 * HALO_CANVAS_W + (x - f.x0) * f.s
export const haloPy = (f: HaloFrame, y: number): number => (f.y1 - y) * f.s

/** The closest any tube point comes to the world's centre — gated above the bake's ceiling
 *  (1.35·R) so the sign can never be speared by terrain, exactly as the cradle is argued. */
export function signMinReachFromOrigin(): number {
  let min = Infinity
  for (const stroke of signPointsWorld()) {
    for (const [x, y, z] of stroke) {
      min = Math.min(min, Math.hypot(x, y, z) - SIGN_TUBE_R)
    }
  }
  return min
}

/** Restated rather than imported (globe-stand.ts owns the argument): the bake's ceiling. */
export const SIGN_WORLD_CEILING = 1.35 * WORLD_RADIUS

// --- the flicker ------------------------------------------------------------

/**
 * The strike envelope: how bright the neon is at a given studio-lights level.
 *
 * A neon does not fade in, it STRIKES — two false starts and then the tube holds. The envelope
 * is a pure function of `studioLightsFor` (the ending's one clock), so scrubbing replays it
 * bit-identically and the journey's exact 0 stays exact:
 *
 *   lights ≤ IGNITE:  exactly 0  (dark glass; the component unmounts its draws)
 *   strike window:    two authored pulses, then the hold ramp
 *   lights ≥ STEADY:  exactly 1  (the ignition is over; the AMBIENT below owns the parked frame)
 *
 * Reduced motion takes the monotone ramp between the same endpoints: steady-on, no flicker,
 * same exact 0 and exact 1.
 */
export const SIGN_IGNITE_AT = 0.28
export const SIGN_STEADY_AT = 0.72

const smooth = (a: number, b: number, x: number): number => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a)
  return t * t * (3 - 2 * t)
}

/** One strike pulse: exactly 1 at its centre, exactly 0 outside (a, b). */
const pulse = (u: number, a: number, b: number): number => {
  const m = (a + b) / 2
  return smooth(a, m, u) * (1 - smooth(m, b, u))
}

export function flickerAt(lights: number, reduced = false): number {
  if (lights <= SIGN_IGNITE_AT) return 0
  if (lights >= SIGN_STEADY_AT) return 1
  const u = (lights - SIGN_IGNITE_AT) / (SIGN_STEADY_AT - SIGN_IGNITE_AT)
  if (reduced) return smooth(0, 1, u)
  const strike1 = 0.42 * pulse(u, 0.06, 0.2)
  const strike2 = 0.78 * pulse(u, 0.3, 0.46)
  const hold = smooth(0.52, 0.94, u)
  return Math.max(strike1, strike2, hold)
}

// --- the ambient flicker (Task 106) -----------------------------------------

/**
 * THE SECOND HALF OF THE FLICKER, AND WHY IT NEEDED A CLOCK AT ALL.
 *
 * `flickerAt` above is the IGNITION, and it is a pure function of scroll — two false starts and
 * then the tube holds, replayed bit-identically by a scrub. That is the whole of what T99 built,
 * and against the money shot it has one honest problem: once the visitor stops scrolling, the
 * ignition is over and the sign is a decal. Aram asked for a sign that flickers, and a sign that
 * only ever flickers while you are moving the page is a sign that flickers because you moved the
 * page. Real neon dips when nobody is touching anything.
 *
 * So the ambient dip rides a WALL CLOCK, and it takes the shape of that permission from the one
 * component that already holds it — the coffee steam (`desk-steam-field.ts`). This is deliberately
 * the same three-part scoping rather than a new convention:
 *
 *  1. THE GATE IS THE STRIKE ENVELOPE. `neonClockAt` advances only while `flickerAt` is above 0,
 *     which is exactly the interval the sign is drawn at all. Through the entire journey and the
 *     whole still beat the envelope is a hard +0, so the accumulator does not merely go unused —
 *     it does not move, and a visitor who reaches the ending after ten minutes sees the sign at
 *     the same instant of its own life as one who gets there in ten seconds.
 *  2. NOTHING STRUCTURAL READS IT. Visibility stays `envelope > 0`, and the envelope is pure
 *     scroll. The clock reaches opacity and nothing else: not where the sign is, not whether it
 *     exists, not the ignition. Scrub back and forth and the strike replays exactly as before.
 *  3. REDUCED MOTION RETURNS EXACTLY 1. Not a shallow hum, not a slow one — steady on, both here
 *     and in the ignition, so the sign under the preference is a photograph of a lit sign.
 *
 * WHAT CHANGES AT THE MONEY SHOT, stated plainly because the module used to promise the opposite.
 * `flickerAt` still returns exactly 1 across the whole steady band and that promise is intact —
 * but the sign's opacity is now that envelope TIMES this, so the parked frame is no longer
 * bit-stable. It crawls, on purpose, in the same way and for the same reason the steam does. Any
 * rest-identity gate over the ending must mask the sign exactly as it already masks the plume.
 */

/**
 * ── WHAT "FLICKER" MEANS HERE (Task 106, second pass) ────────────────────────────────────────
 *
 * The first cut of this was a soft dip under a sine envelope, and Aram's verdict names exactly
 * what was wrong with it: "I need the classic bar neon flickering, where you can almost hear the
 * sound of it." A sine dip is a dimmer being turned down. A failing tube does not dim — it STOPS
 * STRIKING and then catches again, and the sound you can almost hear is the clatter of that.
 *
 * So three things changed, and each of them is what makes the difference audible:
 *
 *  1. THE EDGES ARE HARD. A gate opens or shuts across NEON_EDGE — one frame — instead of easing.
 *     Nothing about a stutter is smooth; the smoothness was the whole reason the first cut read
 *     as weather rather than as electricity.
 *  2. IT GOES NEARLY DARK. NEON_DARK, not eighty-something percent. The classic look is the word
 *     dropping out of the picture and slamming back, not the word getting tired.
 *  3. ONE TUBE AT A TIME. Every word gets its OWN schedule off its own salt, so `Lets` stutters
 *     while `Create` holds. This is the single most identifying feature of bar neon and it is also
 *     the physically honest one: a bender runs each word as its own run of glass, on its own
 *     electrodes, and it is one of them that goes bad. A sign flickering in unison is a dimmer on
 *     the whole circuit, which is a thing that does not happen to neon.
 *
 * The shape of one stutter: a train of 3–7 alternating dark/lit gates of 25–90 ms each, then a
 * final dark hold, then a re-strike ramp back to full. It always ends dark-then-back, because the
 * bit everyone actually pictures is the catch at the end.
 */

/** The gas's constant unrest — the ripple you see filming a real tube, under everything else. */
export const NEON_HUM = 0.02
/** Its rate, Hz. Fast enough to read as electrical rather than as breathing. */
export const NEON_HUM_HZ = 9.3

/** How dark a struck-out tube goes. Not 0 — the glass and the electrodes are still there. */
export const NEON_DARK = 0.1

/** One stutter opportunity per tube per cell, and most cells stay quiet. */
export const NEON_CELL = 4
/** A cell fires below this — so about one stutter per tube every nine seconds. */
export const NEON_ODDS = 0.45

/** A gate lasts between these, in seconds. This range IS the rhythm of the clatter. */
export const NEON_GATE_MIN = 0.025
export const NEON_GATE_MAX = 0.09
/** How many dark/lit flips one stutter runs. */
export const NEON_GATES_MIN = 3
export const NEON_GATES_MAX = 7
/** The beat of black before it catches again — the pause that makes the catch land. */
export const NEON_HOLD_MIN = 0.05
export const NEON_HOLD_MAX = 0.16
/** The catch itself: the tube coming back. Quick, but not a gate — this one you can see arrive. */
export const NEON_RESTRIKE = 0.055
/** A gate's own edge. One frame at 60 Hz, which is what makes it clatter instead of fade. */
export const NEON_EDGE = 0.012

/**
 * The halo's extra bite. A gas discharge losing current dims FASTER than the filament does, so
 * the glow is the ambient factor raised past 1 while the tube takes it straight. At an ambient of
 * exactly 1 this is exactly 1, which is what keeps the ignition's authored halo weights untouched.
 */
export const NEON_HALO_BITE = 1.35

const frac = (x: number): number => x - Math.floor(x)
/** Deterministic unit noise for a cell. Integer in, the same number out, forever. */
const cellNoise = (cell: number, salt: number): number =>
  frac(Math.sin(cell * 12.9898 + salt * 78.233) * 43758.5453)
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The clock the stutter runs on: a gated accumulator, exactly `steamClockAt`'s contract.
 * Closed gate returns `prev` UNCHANGED — the clock does not run outside the lit interval.
 */
export function neonClockAt(prev: number, delta: number, envelope: number, reduced: boolean): number {
  if (reduced) return 0
  if (!(envelope > 0)) return prev
  return prev + delta
}

/** How long a cell's stutter lasts, derived from its own gates rather than authored. */
function stutterLength(cell: number, salt: number): number {
  const gates = NEON_GATES_MIN + Math.floor(cellNoise(cell, 4 + salt) * (NEON_GATES_MAX - NEON_GATES_MIN + 1))
  let total = 0
  for (let i = 0; i < gates; i++) {
    total += lerp(NEON_GATE_MIN, NEON_GATE_MAX, cellNoise(cell, 40 + i + salt))
  }
  return total + lerp(NEON_HOLD_MIN, NEON_HOLD_MAX, cellNoise(cell, 5 + salt)) + NEON_RESTRIKE
}

/**
 * One TUBE's ambient multiplier at a point on the clock: 1 is the tube at full gas, NEON_DARK is
 * the tube struck out. `word` indexes `SIGN_WORDS` — each one carries its own schedule, so the
 * two of them are almost never doing the same thing.
 *
 * Pure arithmetic over the clock and a per-cell hash: the same instant always renders the same
 * value, which is what lets the tests hold it with `Object.is`.
 */
export function neonAmbientAt(clock: number, word = 0, reduced = false): number {
  if (reduced) return 1
  const salt = word * 131

  // The ripple that is always there, its phase offset per tube so they never hum in unison.
  const hum = NEON_HUM * (0.5 - 0.5 * Math.cos((clock + word * 0.37) * NEON_HUM_HZ * 2 * Math.PI))

  const cell = Math.floor(clock / NEON_CELL)
  if (cellNoise(cell, 1 + salt) >= NEON_ODDS) return 1 - hum

  // The stutter is CONTAINED in its cell: its start is drawn from the room left over after its
  // own derived length, so one cell is all this ever has to look at.
  const len = stutterLength(cell, salt)
  const start = cell * NEON_CELL + cellNoise(cell, 3 + salt) * Math.max(0, NEON_CELL - len)
  const u = clock - start
  if (u <= 0 || u >= len) return 1 - hum

  // Walk the gate train. It starts DARK — the tube drops out first and argues afterwards.
  const gates = NEON_GATES_MIN + Math.floor(cellNoise(cell, 4 + salt) * (NEON_GATES_MAX - NEON_GATES_MIN + 1))
  let t = 0
  for (let i = 0; i < gates; i++) {
    const span = lerp(NEON_GATE_MIN, NEON_GATE_MAX, cellNoise(cell, 40 + i + salt))
    if (u < t + span) {
      const dark = i % 2 === 0
      const level = dark ? NEON_DARK : 1
      const from = dark ? 1 : NEON_DARK
      const into = (u - t) / NEON_EDGE
      return (into < 1 ? lerp(from, level, into) : level) - hum
    }
    t += span
  }

  // The hold, then the catch.
  const hold = lerp(NEON_HOLD_MIN, NEON_HOLD_MAX, cellNoise(cell, 5 + salt))
  if (u < t + hold) return NEON_DARK - hum
  return lerp(NEON_DARK, 1, Math.min(1, (u - t - hold) / NEON_RESTRIKE)) - hum
}
