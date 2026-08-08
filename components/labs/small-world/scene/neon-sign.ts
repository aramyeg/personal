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
 * SPLIT SCRIPT: "Let's" on the left flank, "Create" on the right, hand-bent monoline cursive in
 * the room's own rose — the same family as the connect pill's border and the CV underlines, so
 * the sign and the connect row speak with one voice ("come say hi" / "Let's Create").
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
 * the connect row write in it) and then bent the way a tube bender would: each word is ONE
 * continuous main stroke plus the marks a bender adds separately (a t crossbar; the
 * apostrophe). Units: x-height = 1, baseline y = 0, x grows right.
 */
export type SignStroke = readonly (readonly [number, number])[]

export const LETS_STROKES: readonly SignStroke[] = [
  // main stroke: script L, into e, into t (narrow double-back), into s
  [
    [0.62, 1.72], [0.74, 1.95], [0.60, 2.04], [0.42, 1.86], [0.36, 1.35],
    [0.42, 0.72], [0.50, 0.30], [0.40, 0.06], [0.20, 0.03], [0.10, 0.22],
    [0.26, 0.38], [0.55, 0.32], [0.82, 0.16],
    [1.06, 0.40], [1.22, 0.78], [1.18, 0.96], [1.00, 0.86], [0.96, 0.52],
    [1.08, 0.14], [1.30, 0.04], [1.48, 0.16],
    [1.66, 0.45], [1.78, 1.00], [1.86, 1.52],
    [1.92, 1.00], [1.96, 0.45], [2.04, 0.10], [2.22, 0.05], [2.36, 0.16],
    [2.52, 0.50], [2.64, 0.95],
    [2.46, 0.78], [2.62, 0.50], [2.70, 0.26], [2.56, 0.03], [2.36, 0.12],
  ],
  // t crossbar
  [[1.64, 1.10], [1.84, 1.17], [2.06, 1.12]],
  // apostrophe
  [[2.22, 1.85], [2.16, 1.60]],
]

export const CREATE_STROKES: readonly SignStroke[] = [
  [
    [0.95, 1.60], [0.70, 1.76], [0.40, 1.55], [0.26, 1.00], [0.32, 0.42],
    [0.55, 0.08], [0.85, 0.05], [1.05, 0.22],
    [1.14, 0.16], [1.28, 0.60], [1.34, 0.98],
    [1.44, 0.80], [1.56, 0.70], [1.62, 0.40], [1.68, 0.08], [1.84, 0.12],
    [2.05, 0.38], [2.20, 0.74], [2.16, 0.95], [1.98, 0.85], [1.94, 0.50],
    [2.06, 0.12], [2.30, 0.03], [2.50, 0.16],
    [2.88, 0.90], [2.66, 0.96], [2.52, 0.62], [2.58, 0.22], [2.82, 0.04],
    [2.98, 0.35], [3.02, 0.78],
    [3.06, 0.42], [3.12, 0.10], [3.28, 0.04], [3.42, 0.16],
    [3.58, 0.45], [3.70, 1.00], [3.78, 1.52],
    [3.84, 1.00], [3.88, 0.45], [3.96, 0.10], [4.14, 0.05], [4.28, 0.16],
    [4.46, 0.40], [4.60, 0.76], [4.56, 0.96], [4.38, 0.86], [4.34, 0.52],
    [4.46, 0.12], [4.68, 0.03], [4.88, 0.18],
  ],
  // t crossbar
  [[3.56, 1.10], [3.76, 1.17], [3.98, 1.12]],
]

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

/** World units per letterform unit (the script's x-height). */
export const SIGN_XHEIGHT = 0.95

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
export const SIGN_WORDS: readonly SignWord[] = [
  { strokes: LETS_STROKES, ndcX: -0.55, roll: (-4 * Math.PI) / 180 },
  { strokes: CREATE_STROKES, ndcX: 0.545, roll: (3 * Math.PI) / 180 },
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
 *   lights ≥ STEADY:  exactly 1  (the money shot is parked — nothing may crawl there)
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
