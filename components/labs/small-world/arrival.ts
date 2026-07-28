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
  /** Journey progress the whole experience reads (0..1). */
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
 * Unwinds the band: the journey keeps tracking the finger 1:1 AND closes the
 * remaining stretch on top of that, at an exponentially easing rate capped by
 * CATCHUP_MAX_SPEED. Tracking is the floor, so a visitor still flinging is never
 * slowed down; the cap is the ceiling, so the catch-up can never bolt ahead.
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
    if (retreated || reveal === null || reveal.t >= 1 || absorbed >= ABSORB_MAX_SECONDS) {
      mode = 'release'
    }
  } else if (
    mode === 'pass' &&
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
