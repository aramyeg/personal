/**
 * TAP ANSWERS (E3 BW-18) — "click on any grabbable gives a small physical
 * nudge of that piece."
 *
 * WHY. Every one of the five context-quarantined blind readers clicked before
 * they dragged, got absolutely nothing, and concluded the spread was a static
 * illustration. Their words: "Click does nothing. Anywhere. The vault flap
 * ignores a click and only answers press-and-drag. Most readers click first,
 * get zero feedback, and conclude the spread is a static picture. This is the
 * single highest-cost defect on the page." Two of them then found the real
 * mechanism only by scripting drags across a grid.
 *
 * THE LAW. A press that does not drag is a TAP, and a tap gets a small
 * physical excursion of the piece the reader touched: a few degrees (or a
 * fraction of a millimetre of strip draw) out and an overdamped return. It is
 * not a UI animation and it is not a state change — it is the paper answering
 * the finger, the way a real pop-up rocks when you touch it. It says "I am
 * loose, pull me" in the only language a paper book has.
 *
 * THREE PROPERTIES THE HOUSE LAWS FORCE:
 *  - IT MOVES INTO THE RANGE. Several pieces rest exactly AT a stop (the s2
 *    figure group rests at its 90deg anti-flip ceiling), so a fixed-sign nudge
 *    would be swallowed whole by the clamp and the tap would answer nothing
 *    again. `nudgeOffset` always pushes toward the roomier end of the piece's
 *    own drive range.
 *  - IT IS TRANSIENT, NEVER STATE. The offset is applied at RENDER time only
 *    and never written to the scrub channel, so it cannot survive a page turn,
 *    cannot compose with a held reader angle, and cannot leak into the release
 *    return. Fold-flat containment is untouched: the layer still clamps the
 *    sum into its own [lo, hi] and still multiplies by its E(beta) envelope.
 *  - IT IS OVERDAMPED AND ENDS AT EXACTLY ZERO. The shape rises fast, settles
 *    slow, and is 0 at both ends of its window (no residue to unwind).
 *
 * No react, no three.js — a module-scope map keyed by handle id, exactly like
 * user-drive.ts's scrub channel and for the same reason: the frame loop reads
 * it every frame and a zustand dispatch per frame would fight the renderer.
 */

/** Pulse window (ms). Long enough to read as a physical rock, short enough
 *  that a reader who taps twice gets two answers rather than one smear. */
export const NUDGE_MS = 560

/** Fraction of the window at which the excursion peaks. */
const PEAK_AT = 0.22
/** Reciprocal of the windowed shape's true maximum, so `nudgeShape` peaks at
 *  exactly 1 and `span` therefore MEANS "the peak excursion" at every call
 *  site. Without it the (1 - t)^2 landing window quietly ate a third of every
 *  amplitude, which is how a 6deg nudge became 4 screen px. */
const PEAK_NORM = 1 / 0.6775

/** Below this drive-domain movement a press counts as a TAP, not a drag. Set
 *  per family by the caller (its drive domain is radians, or strip draw in
 *  world units), so this is only the fallback for a caller with no opinion. */
export const TAP_EPS = 1e-3

/** A few degrees of rock for an ANGLE-domain handle (door leaves, strip flaps,
 *  tab-piece lifts, dials). Big enough to read at the reading camera, small
 *  enough that it can never be mistaken for the mechanism working. */
export const NUDGE_SPAN_ANGLE = (6 * Math.PI) / 180
/** Fraction of a SLIDE-domain handle's own stroke (pull strips, cards): the
 *  strip creeps out and slides back. */
export const NUDGE_SPAN_STROKE_FRAC = 0.18

const pulses = new Map<string, number>()

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

/**
 * The excursion shape over t in [0, 1]: an alpha function (rise to 1 at
 * PEAK_AT, exponential settle) windowed by (1 - t)^2 so it reaches EXACTLY 0
 * at t = 1 and leaves nothing to unwind. Outside [0, 1] it is 0.
 */
export function nudgeShape(t: number): number {
  if (!(t > 0) || t >= 1) return 0
  const u = t / PEAK_AT
  const tail = 1 - t
  return Math.min(1, u * Math.exp(1 - u) * tail * tail * PEAK_NORM)
}

/** Start (or restart) the pulse for `id`. */
export function pulseHandle(id: string, at: number = nowMs()): void {
  pulses.set(id, at)
}

export function clearNudgePulse(id: string): void {
  pulses.delete(id)
}

/** The raw pulse shape for `id` right now, in [0, 1]; 0 when idle. Retires the
 *  entry once the window has passed so the map never grows. */
export function readNudgePulse(id: string, at: number = nowMs()): number {
  const start = pulses.get(id)
  if (start === undefined) return 0
  const t = (at - start) / NUDGE_MS
  if (t >= 1) {
    pulses.delete(id)
    return 0
  }
  return nudgeShape(t)
}

/**
 * The tap's signed offset for `id` in the piece's OWN drive domain, given
 * where the piece currently rests and the range it may move through.
 *
 * `span` is the excursion size in that same domain (a few degrees in radians
 * for a flap, a fraction of the stroke for a strip). The result is capped so
 * `rest + offset` can never leave [lo, hi] — a piece sitting on a stop is
 * nudged off it, not through it.
 */
export function nudgeOffset(
  id: string,
  rest: number,
  lo: number,
  hi: number,
  span: number,
  at: number = nowMs()
): number {
  const pulse = readNudgePulse(id, at)
  if (pulse === 0) return 0
  // Toward the roomier end: a piece resting at its ceiling rocks downward.
  const room = hi - rest >= rest - lo ? hi - rest : -(rest - lo)
  const dir = room >= 0 ? 1 : -1
  return dir * Math.min(span, Math.abs(room)) * pulse
}
