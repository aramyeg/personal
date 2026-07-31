import { CHAPTER_COUNT } from './chapters'
import { PANEL_END, TRAVEL_END, type RevealState } from './journey-timeline'

/**
 * CHECKPOINT ARRIVAL: the reveal clock + the scroll absorption that protects it.
 * Round 15, Task 54 — Aram: "when reaching a checkpoint between biomes the cards
 * and the accent mascots should roll out without the need to scroll more […] we
 * need some debounce possibly on the scroll while we roll out the animations".
 *
 * Two jobs, both pure and both here so the whole feel is one file of numbers:
 *
 * 1. THE CLOCK. Entering a checkpoint's dwell window starts a wall-clock reveal
 *    (see RevealState in journey-timeline for the published contract). Leaving it
 *    walks the reveal back out. Re-entering RESUMES the same reveal instead of
 *    restarting it, which is what makes scrubbing across the window edge safe: a
 *    reveal has one life, and it only ends after a full retraction.
 *
 * 2. THE ABSORPTION. While that reveal is rolling out, forward scroll must not
 *    blow through the moment. Absorption is a RUBBER BAND, not a freeze: the
 *    journey's progress holds at the arrival anchor while the document keeps
 *    scrolling normally underneath (nothing is preventDefault-ed, no event is
 *    dropped, the page never feels stuck to the OS), and the band has a fixed
 *    maximum stretch — scroll past ABSORB_MAX_LAG and it bottoms out and tracks
 *    the finger 1:1 again, so a determined push always breaks through. When the
 *    reveal lands, the band unwinds at a capped speed. Backward scroll is never
 *    absorbed at all: it tracks 1:1 from the first frame and cancels the hold.
 *
 * Why this is safe for the renewal/tide proofs (they are functions of ROTATION):
 * absorption only ever engages inside a dwell, where `journeyStateAt` clamps
 * rotation to the chapter's stop — rotation is CONSTANT across the entire held
 * interval, so holding cannot change a single rotation value, only when the clock
 * reaches the ones that follow. The unwind is speed-capped below a fast hand
 * scroll, so no frame-to-frame rotation step is larger than one the existing
 * benches already cover.
 */

/** Wall-clock seconds for a full roll-out (0 → 1). Tuned by eye: long enough to read, short enough to never feel gated. */
export const REVEAL_SECONDS = 1.05
/** Faster than the roll-out — leaving should feel like a whip-out, not a rewind. */
export const RETRACT_SECONDS = 0.42
/**
 * Hard ceiling on one arrival's absorption, whatever happens to the frame clock.
 * A single stuttering frame can carry it past by that frame's own length, which is
 * why it sits well under the 1.5s rail rather than on it.
 */
export const ABSORB_MAX_SECONDS = 1.1
/** Maximum rubber-band stretch, in chapter segments. Past this the band bottoms out and scroll passes 1:1. */
export const ABSORB_LAG_SEGMENTS = 0.3
export const ABSORB_MAX_LAG = ABSORB_LAG_SEGMENTS / CHAPTER_COUNT
/** A reveal can only arm a hold this early in its life — a hold is an ARRIVAL beat, never a mid-reveal grab. */
export const HOLD_ARM_T = 0.15
/**
 * The hold ends here rather than at t = 1. `easeOutBack` passes 1 at x ~= 0.37, so with
 * the card window [CARD_PHASE_START, 1] the spread is visually SEATED by t ~= 0.55 —
 * measured 14px from its final position at 0.57 and indistinguishable at 1. Holding to 1
 * spent the back half of the beat motionless with the moment already landed, which is
 * what "it stops too long" feels like. The clock still runs to 1; only the absorption
 * lets go early. Dial: raise toward 1 for a longer stick, lower for a lighter touch.
 */
export const HOLD_UNTIL_T = 0.65
/**
 * A hold may also arm out of a nearly-converged `release`. Without this the machine can
 * sit in `release` on the fixed point described in `unwind` — where the finger keeps
 * out-running the closing rate, so the stretch never reaches CATCHUP_SNAP — and every
 * later checkpoint would silently lose its absorption. Small enough (a tenth of the
 * band) that a genuine catch-up, which runs at many times this, still blocks arming.
 */
export const ARM_FROM_RELEASE_LAG = ABSORB_MAX_LAG / 10
/**
 * A teleport (scrollbar drag, End key, in-page anchor) is told from a scroll by how
 * far the document moved in one frame, measured against ~7 chapters a second —
 * speed, not a fixed delta, so a long frame full of coalesced wheel events is not
 * mistaken for a jump. That allowance is then held between a floor and a ceiling:
 * BELOW the floor, one chunky wheel notch delivered inside a single 16ms frame
 * would read as a jump (measured: it does — 320px in one frame is 19,000px/s);
 * ABOVE the ceiling, a stuttering frame would wave a real scrollbar drag through.
 * Half a chapter in a frame is past any wheel or trackpad; a whole one is past any
 * input at all.
 */
export const JUMP_SPEED = 1.2
export const JUMP_MIN = 0.5 / CHAPTER_COUNT
export const JUMP_MAX = 1 / CHAPTER_COUNT
/** Exponential rate the band closes its remaining stretch at — it eases out instead of stopping dead. */
export const CATCHUP_LAMBDA = 12
/**
 * Ceiling on how much faster than the finger the unwind may run, progress/second
 * (~1 chapter/s). The journey's speed is therefore always max(finger, this) and
 * never more: no frame can step further than a fast hand scroll already does.
 */
export const CATCHUP_MAX_SPEED = 0.18
/** Remaining stretch below this is finished — the journey is back on the finger exactly (~7px of track). */
export const CATCHUP_SNAP = 5e-4
/** Frame steps are clamped so a backgrounded tab cannot resume with one giant step. */
export const STEP_MAX_SECONDS = 0.05

/**
 * 'pass'    — journey progress IS scroll progress (the normal, scroll-pure state).
 * 'hold'    — a reveal is rolling out; forward scroll stretches the band instead of advancing.
 * 'release' — the band unwinds back onto the finger.
 */
export type ArrivalMode = 'pass' | 'hold' | 'release'

export type ArrivalState = {
  mode: ArrivalMode
  /** Journey progress the whole experience reads. Domain [0, TRACK_END] since Task 63 — the
   *  journey is [0, 1] and the ending segment owns the rest (see ending-timeline.ts). Nothing in
   *  this file changes for it: every threshold here is in progress units, and the ending sits
   *  outside every dwell, so no hold can arm there. */
  progress: number
  /** Raw scroll progress from the last step, kept to measure teleports. */
  raw: number
  /** Progress the band is anchored to while holding. */
  anchor: number
  /** Seconds this reveal has spent absorbing. */
  absorbed: number
  /** This reveal already spent its one hold — the anti-thrash latch, cleared only when the reveal ends. */
  held: boolean
  reveal: RevealState | null
}

const SEGMENT = 1 / CHAPTER_COUNT

export function initialArrival(progress = 0): ArrivalState {
  return {
    mode: 'pass',
    progress,
    raw: progress,
    anchor: progress,
    absorbed: 0,
    held: false,
    reveal: null,
  }
}

/**
 * The checkpoint whose dwell contains this progress, or null while travelling.
 * The window opens where rotation freezes (the girl's stop) and closes at the
 * dwell's release, so the roll-out covers the whole time she stands still.
 */
export function dwellChapterAt(progress: number): number | null {
  const p = Math.min(1, Math.max(0, progress))
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / SEGMENT))
  const local = (p - chapter * SEGMENT) / SEGMENT
  return local >= TRAVEL_END && local < PANEL_END ? chapter : null
}

/** One step of the reveal clock: rise inside the window, retract outside it. */
export function stepReveal(
  prev: RevealState | null,
  windowChapter: number | null,
  dt: number,
  reducedMotion: boolean
): RevealState | null {
  if (windowChapter !== null) {
    if (prev === null || prev.chapter !== windowChapter) {
      return { chapter: windowChapter, t: reducedMotion ? 1 : 0, phase: 'in' }
    }
    if (reducedMotion) return { chapter: prev.chapter, t: 1, phase: 'in' }
    const t = Math.min(1, prev.t + dt / REVEAL_SECONDS)
    if (t === prev.t && prev.phase === 'in') return prev
    return { chapter: prev.chapter, t, phase: 'in' }
  }
  if (prev === null) return null
  if (reducedMotion) return null
  const t = prev.t - dt / RETRACT_SECONDS
  return t <= 0 ? null : { chapter: prev.chapter, t, phase: 'out' }
}

/**
 * Unwinds the band. The journey advances by whichever is LARGER — the finger's own
 * step, or an exponentially easing closing step capped at CATCHUP_MAX_SPEED — so its
 * speed is always max(finger, closing) and never their sum. A visitor still flinging
 * is never slowed, and the catch-up can never bolt ahead of what a fast hand scroll
 * already does (which is what keeps the renewal frame-step argument intact).
 *
 * The cost of `max`, stated plainly because it has consequences: while the finger
 * out-runs the closing rate the stretch does not close AT ALL. Two of them —
 *  - the release tail outlasts the scroll that caused it, so with checkpoints closer
 *    together than hold + release a visitor scrolling steadily can get absorption at
 *    every other checkpoint rather than every one (holds arm only out of `pass`, or
 *    out of a release already inside ARM_FROM_RELEASE_LAG);
 *  - in the limit where `raw` grows on literally every tick, the stretch settles at a
 *    fixed point of v / CATCHUP_LAMBDA and never reaches CATCHUP_SNAP. Real input
 *    always supplies enough zero-delta ticks to drain it, so this is latent rather
 *    than observed; ARM_FROM_RELEASE_LAG is what stops it costing later checkpoints
 *    their absorption if it ever does happen.
 */
function unwind(progress: number, prevRaw: number, raw: number, dt: number): number {
  const track = raw - prevRaw
  const closing = Math.min(CATCHUP_MAX_SPEED, Math.max(0, raw - progress) * CATCHUP_LAMBDA) * dt
  return Math.min(raw, progress + Math.max(track, closing))
}

/**
 * Advances the arrival state one frame. `raw` is unfiltered scroll progress;
 * the returned `progress` is what the journey should render. Pure: same inputs,
 * same output, no clock read inside.
 */
export function stepArrival(
  prev: ArrivalState,
  raw: number,
  dt: number,
  reducedMotion = false
): ArrivalState {
  const step = Math.min(Math.max(dt, 0), STEP_MAX_SECONDS)
  const allowance = Math.min(JUMP_MAX, Math.max(JUMP_MIN, JUMP_SPEED * step))
  const teleported = Math.abs(raw - prev.raw) > allowance

  let mode = prev.mode
  let anchor = prev.anchor
  let absorbed = prev.absorbed
  let held = prev.held
  let progress: number

  if (teleported) {
    // The visitor jumped (scrollbar drag, End key, in-page anchor). Honour it
    // exactly as before Task 54 — smoothing a teleport would fight the input and
    // would be the one case that turns a scroll into a long automatic ride.
    mode = 'pass'
    progress = raw
  } else if (mode === 'hold') {
    // Band: absorb forward motion up to ABSORB_MAX_LAG, then track 1:1 again.
    // Backward motion (raw below the anchor) passes through untouched.
    const overrun = Math.max(0, raw - anchor - ABSORB_MAX_LAG)
    progress = Math.min(raw, anchor + overrun)
    // TRUE elapsed time, not the clamped step: the absorption rail is a promise to
    // the visitor in wall-clock seconds. On a device running the reveal at half
    // speed — or a tab coming back from the background — the hold still ends on
    // time, and the reveal simply finishes rolling out unabsorbed.
    absorbed += Math.max(dt, 0)
  } else if (mode === 'release') {
    // Backward input ends the unwind on the spot: the moment the finger comes back
    // to where the journey already is, it takes over 1:1. Damping a retreat would
    // be the one place absorption could read as lag.
    if (raw <= prev.progress) {
      mode = 'pass'
      progress = raw
    } else {
      progress = unwind(prev.progress, prev.raw, raw, step)
    }
  } else {
    progress = raw
  }

  const reveal = stepReveal(prev.reveal, dwellChapterAt(progress), step, reducedMotion)

  // One hold per reveal life: the latch clears only when the reveal ends outright
  // or hands over to another chapter, so thrashing the window edge re-arms nothing.
  if (reveal === null || reveal.chapter !== prev.reveal?.chapter) held = false

  if (mode === 'hold') {
    const retreated = progress < anchor
    if (retreated || reveal === null || reveal.t >= HOLD_UNTIL_T || absorbed >= ABSORB_MAX_SECONDS) {
      mode = 'release'
    }
  } else if (
    (mode === 'pass' || (mode === 'release' && raw - progress <= ARM_FROM_RELEASE_LAG)) &&
    !reducedMotion &&
    !teleported &&
    !held &&
    reveal !== null &&
    reveal.phase === 'in' &&
    reveal.t < HOLD_ARM_T &&
    progress > prev.progress
  ) {
    mode = 'hold'
    anchor = progress
    absorbed = 0
    held = true
  }

  if (mode === 'release' && Math.abs(raw - progress) <= CATCHUP_SNAP) {
    progress = raw
    mode = 'pass'
  }

  return { mode, progress, raw, anchor, absorbed, held, reveal }
}

/**
 * Wall-clock seconds the "!" takes to play once it is let go. Matches the span the
 * reveal clock used to give it, so the beat is unchanged in length — only its start
 * moved onto the damped timeline.
 */
const BURST_SECONDS = 0.44

/** Which checkpoint's "!" is playing on the damped timeline, and how long it has run. */
export type BurstLatch = { chapter: number; elapsed: number } | null

/**
 * Holds the "!" until the DAMPED timeline reaches the dwell — the frame rotation clamps
 * and the girl plants — then runs it on the wall clock from there. Pure so the edge can
 * be pinned by tests without a canvas: same inputs, same latch.
 *
 * `dampedProgress` must be the same value the returned JourneyState is built from, or
 * the edge lands on a frame where she is still moving and the celebrate is reclaimed.
 */
export function stepBurstLatch(
  prev: BurstLatch,
  reveal: RevealState | null,
  dampedProgress: number,
  delta: number
): BurstLatch {
  const armed =
    reveal !== null && reveal.phase === 'in' && dwellChapterAt(dampedProgress) === reveal.chapter
  if (!armed) return null
  if (prev === null || prev.chapter !== reveal.chapter) return { chapter: reveal.chapter, elapsed: 0 }
  return { chapter: prev.chapter, elapsed: prev.elapsed + Math.max(delta, 0) }
}

/** The burst value a latch publishes: 0→1 across BURST_SECONDS, then null (one pop, no repeat). */
export function burstFromLatch(latch: BurstLatch): number | null {
  if (latch === null || latch.elapsed >= BURST_SECONDS) return null
  return latch.elapsed / BURST_SECONDS
}
