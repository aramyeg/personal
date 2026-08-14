import { STEP_MAX_SECONDS } from './arrival'
import { beatPaceOf, beatWindowAt } from './beat-windows'
import { DIALS } from './scene/tunables'

/**
 * ============================================================================
 * THE BASELINE CARRY (Task 125) — a beat that has begun finishes
 * ============================================================================
 * The pace governor (Task 109) is a CEILING on how fast the world may follow the
 * scroll. This is the FLOOR, and it is deliberately the same shape of thing: one
 * pure step function, no second timeline, nothing the scene can disagree with.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT MOVES, AND WHY THAT IS THE WHOLE DESIGN
 * ---------------------------------------------------------------------------
 * It moves THE DOCUMENT, not a private progress value. The carry's output is a
 * scroll position; the driver writes it with the lab's existing `pinScrollTo`, the
 * scroll listener reads it back, and progress follows through the identical
 * pipeline it follows for a finger. Three properties fall out of that, and each of
 * them was a wall in the brief:
 *
 *  1. THE SCROLLBAR CANNOT LIE. The reader really is further down the track,
 *     because the track is where the carry put them. The alternative — advancing
 *     progress ahead of the document inside `GOVERNOR_MAX_LAG` and reconciling
 *     later — buys the same picture at the cost of a scrollbar that reports a
 *     position the world has already left, and of a dead zone afterwards where
 *     forward scrolling has to spend the lead before anything moves.
 *  2. CANCELLING IS FREE. There is no carried value to blend back, because the
 *     carry never held one: the world was always exactly where the document was.
 *     A reader who scrolls, drags the scrollbar, or reverses simply moves the same
 *     number the carry was moving, and the carry lets go on the next frame with no
 *     pop, because there is nothing to pop from.
 *  3. `stepArrival`'s LAW SURVIVES UNTOUCHED. "The journey never outruns the
 *     finger" stays literally true — the finger is what the carry moves.
 *
 * ---------------------------------------------------------------------------
 * NEVER FIGHTING THE READER, stated as the three rules that implement it
 * ---------------------------------------------------------------------------
 *  - FORWARD INPUT OWNS THE FRAME. Any user motion at all drops the carry for that
 *    frame; the reader's own scroll is never added to. The carry re-seeds from
 *    wherever they left the document, so it tops their scrolling up rather than
 *    racing it.
 *  - REVERSE DISARMS THE BEAT. Reading backward is a right. A reader who pulls back
 *    inside a window is not carried again until they push forward, or leave and
 *    re-enter — otherwise a glance backward would be answered by the page pulling
 *    them forward, which is the exact opposite of what a floor is for.
 *  - ENTERING BACKWARD NEVER ARMS. Scrubbing up into the leap from the desk leaves
 *    a still frame of a girl in mid-air, and that is correct: a reader travelling
 *    backward has their hand on it. The carry only ever resolves a beat in the
 *    direction the reader was already going.
 *
 * ---------------------------------------------------------------------------
 * THE IDLE GRACE, and why the carry is not simply always on
 * ---------------------------------------------------------------------------
 * Wheel and trackpad input is BURSTY: a notch, forty milliseconds of nothing,
 * another notch. A carry that engaged on the first quiet frame would spend those
 * gaps adding scroll the reader did not ask for, and the reader would feel the page
 * pulling. `CARRY_IDLE_SECONDS` is longer than the gap inside a gesture and shorter
 * than the gap between gestures, so the floor fills the pauses in sporadic scrolling
 * and stays out of the way of continuous scrolling.
 *
 * ---------------------------------------------------------------------------
 * REDUCED MOTION GETS THE CUT, NOT THE RIDE
 * ---------------------------------------------------------------------------
 * The governor degrades to an infinite cap for reduced motion; the floor cannot
 * degrade to "no floor", because what it is protecting against is not an animation
 * but a BROKEN STILL — a body hanging in the air is wrong at any motion preference.
 * So reduced motion keeps the guarantee and drops the animation: when input goes
 * quiet inside a window, the document CUTS to the window's end in one frame. The
 * reader lands on a beat boundary and never rests mid-beat, which is the same
 * bargain the iris makes with them (`iris-transition.ts`: "reduced motion gets the
 * cut without the gesture"). It fires at most once per traversal, because the cut's
 * destination is outside the window it was cut out of.
 *
 * ---------------------------------------------------------------------------
 * BACKGROUND TABS
 * ---------------------------------------------------------------------------
 * A hidden tab gets no rAF, so a carry simply stops and resumes — but the frame it
 * resumes on carries the whole hidden interval in its `dt`, and an unclamped step
 * would fast-forward the beat the reader came back to watch. `STEP_MAX_SECONDS` is
 * the pace governor's own clamp and is reused here rather than restated: no single
 * frame may advance the carry by more than one bad frame's worth.
 */

/**
 * How long the reader's input must be quiet before the floor engages, in seconds.
 *
 * Measured against real input rather than chosen: a wheel gesture delivers events
 * about every 30–60 ms and a trackpad glide every frame, so anything at or above
 * ~0.1 s cannot fire inside a gesture. The upper bound is the reader's patience —
 * the freeze this exists to remove is visible almost immediately, so the grace has
 * to be short enough that the beat resumes before the picture reads as stuck.
 *
 * IT IS A DIAL SINCE TASK 129 (`paceCarryGrace`), and this const is its DEFAULT — the
 * value the measurements above were taken against, kept exported because the proofs
 * are written in it. `stepCarry` reads `carryGraceNow()` so a panel drag takes effect
 * on the next frame rather than at the next page load.
 */
export const CARRY_IDLE_SECONDS = DIALS.paceCarryGrace.default

/** The grace the shipped path actually uses — live, so the ?tune panel can move it. */
export function carryGraceNow(): number {
  return DIALS.paceCarryGrace.value
}

/**
 * How far the document may move without it counting as the reader, in CSS pixels.
 *
 * The driver re-measures the real scroll position after each of its own writes and
 * anchors on the measurement, so device-pixel rounding is already gone by the time
 * this is applied; what is left for it to absorb is asynchronous settling (scroll
 * anchoring, a browser's own sub-pixel correction). It stays small enough that a
 * deliberate reverse — the one input that must always be obeyed — is never
 * mistaken for noise.
 */
export const CARRY_INPUT_PX = 1.5

/**
 * The same threshold in progress units, for callers with no viewport (tests, benches).
 * The driver derives the exact value from the measured track instead; see
 * `carryInputEps`.
 */
export const CARRY_INPUT_EPS = 1.2e-4

/** Pixels → progress, given the track's scrollable height. Exact inverse of the driver's read. */
export function carryInputEps(trackEnd: number, total: number): number {
  return total > 0 ? (CARRY_INPUT_PX / total) * trackEnd : CARRY_INPUT_EPS
}

export type CarryState = {
  /** The window being tracked, by id, or null when the reader is not inside one. */
  beat: string | null
  /** Whether this beat may still be carried — cleared by a reverse, restored by forward input. */
  armed: boolean
  /** Seconds of quiet input accumulated inside this beat. */
  idle: number
  /**
   * Where the carry is asking the document to be, in progress — or null when the
   * carry is not driving (the reader is, or the grace has not elapsed). Null is
   * also the re-seed signal: the next engagement starts from the real scroll
   * position rather than from a stale target.
   */
  target: number | null
}

export const CARRY_IDLE: CarryState = Object.freeze({
  beat: null,
  armed: false,
  idle: 0,
  target: null,
})

/**
 * Does the carry still have work to do? The driver's frame loop sleeps whenever
 * nothing is moving on its own, and a floor with a sleeping loop is a beat that
 * never finishes — so this is the condition that keeps the loop awake, and it goes
 * false the moment a reverse disarms the beat rather than spinning inside a window
 * the reader has taken charge of.
 */
export function carryBusy(state: CarryState): boolean {
  return state.beat !== null && state.armed
}

/**
 * One frame of the floor. Pure: same inputs, same output, no clock and no DOM.
 *
 * @param progress  Governed progress — decides which beat the reader is inside.
 * @param raw       The document's own progress — what the carry drives, and what a
 *                  fresh engagement seeds from.
 * @param userInput Signed progress the READER moved this frame, with the carry's own
 *                  writes already removed by the driver. The one input this function
 *                  cannot derive for itself, and the reason it is a parameter.
 */
export function stepCarry(
  prev: CarryState,
  progress: number,
  raw: number,
  userInput: number,
  dt: number,
  reducedMotion = false,
  inputEps = CARRY_INPUT_EPS
): CarryState {
  const beat = beatWindowAt(progress)
  if (beat === null) return CARRY_IDLE

  // The reader owns any frame they moved in. Both branches return with `target`
  // null, which drops the carry AND re-seeds it: whatever it does next, it does
  // from where their hands left the document.
  if (userInput < -inputEps) return { beat: beat.id, armed: false, idle: 0, target: null }
  if (userInput > inputEps) return { beat: beat.id, armed: true, idle: 0, target: null }

  const sameBeat = prev.beat === beat.id
  // Arriving inside a window without reversing arms it — whether the frame that
  // brought the reader here was their own scroll, a teleport, or the governor's
  // unwind paying back a debt. Arriving while reversing does not, and is the branch
  // above; the disarm survives because `sameBeat` carries it forward.
  const armed = sameBeat ? prev.armed : true
  if (!armed) return { beat: beat.id, armed: false, idle: 0, target: null }

  const step = Math.min(Math.max(dt, 0), STEP_MAX_SECONDS)
  const idle = (sameBeat ? prev.idle : 0) + step
  if (idle < carryGraceNow()) return { beat: beat.id, armed: true, idle, target: null }

  // Reduced motion: the boundary in one frame, no ride. See the header.
  if (reducedMotion) return { beat: beat.id, armed: false, idle, target: beat.end }

  const from = prev.target ?? raw
  const target = Math.min(beat.end, from + beatPaceOf(beat) * step)
  // ARRIVING AT THE END DISARMS THE BEAT, and this is load-bearing rather than
  // tidy. The window is half-open, so landing on `end` normally leaves it and the
  // carry stops because there is no beat any more — but a browser rounds a scroll
  // write to device pixels, and a landing half a pixel short is still inside. Then
  // the shortfall is smaller than the input threshold (it is not the reader), the
  // target is already the end, and the carry would rewrite the same position every
  // frame forever with the driver's loop awake to do it. Finishing the beat is
  // therefore a state, not a position.
  return { beat: beat.id, armed: target < beat.end, idle, target }
}
