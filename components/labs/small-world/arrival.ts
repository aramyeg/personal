import { CHAPTER_COUNT } from './chapters'
import { PANEL_END, TRAVEL_END, type RevealState } from './journey-timeline'
import { PAGE_SPAN_END } from './overlay/info-beats'

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
 * ============================================================================
 * THE PACE GOVERNOR (Task 109) — a checkpoint beat unfolds in seconds, not pixels
 * ============================================================================
 * Aram: "when we reach a checkpoint of the story, the progression of the story
 * and the UX is heavily dependent on the scroll and scroll pattern; this
 * shouldn't be the case […] the scrolling should always have some certain speed
 * or effect."
 *
 * WHAT WAS MEASURED (chapter 3's stop, shipped build, headed browser, real CDP
 * input; the control row is a reader who arrives and stops). The beat's own
 * authored content — the manga page inking its panels and typing its lettering —
 * needs about 2.45 s of screen time and ends with 62 characters of her words on
 * the page. What the three input styles actually delivered:
 *
 *   1440x900   readable   lettering        390x844   readable   lettering
 *   control      5611 ms    62 chars        control    5677 ms    62 chars
 *   fling         496 ms     0 chars        fling        691 ms     2 chars
 *   steady       1011 ms    14 chars        steady      4871 ms    62 chars
 *   hesitant     2136 ms    53 chars        hesitant    6614 ms    62 chars
 *
 * A 4.3x spread on desktop and 9.6x on the phone, and the number that matters is
 * the last column: a reader scrolling steadily through the story was shown 14 of
 * the 62 characters it is written in, and a reader who flung was shown none. The
 * beat was not paced badly — it was not paced at all. Its length in seconds was
 * whatever the reader's wheel happened to make it.
 *
 * THE FIX IS INPUT SHAPING, NOT A SECOND CLOCK. The scene stays a pure function
 * of `progress`; what changes is how fast `progress` is allowed to follow the
 * scroll. Inside a checkpoint's window progress advances toward the scroll-implied
 * target at an authored maximum rate, so the beat takes BEAT_SECONDS however hard
 * the reader scrolls. Outside it the cap is lifted entirely and scroll is direct,
 * which is the whole of open-biome travel.
 *
 * WHY A RATE CAP AND NOT A STEP/CHECKPOINT MODE (the runner-up). Arming the next
 * beat on a gesture and playing it out was the other candidate and it loses on
 * one property: a rate cap NEVER STOPS FOLLOWING THE INPUT. `progress` can only
 * move toward `raw` and can never pass it, so pushing forward always moves the
 * world forward and pulling back always moves it back — the cap slows the
 * unfolding, it does not seize the scroll. A step mode has to decide when a beat
 * "owns" the input, and every such decision is a moment the reader is not driving.
 * It would also have needed its own reduced-motion branch; this one degrades by
 * setting the cap to infinity, which is the pre-Task-109 behaviour exactly.
 *
 * THE DEBT, AND WHY IT IS NOT A RIDE. Capping the rate means the world falls
 * behind the document, and a debt paid back with the reader's hands off the wheel
 * is exactly what Task 106 called a defect. It is not one here, and the reason is
 * structural rather than a matter of degree: the governed span lies wholly inside
 * the dwell, where `rotationAt` CLAMPS rotation to the chapter's stop. Nothing the
 * debt buys back turns the planet. What plays out is the page drawing itself over
 * a world that is standing still — which is the beat the reader scrolled to, not a
 * ride through scenery they have already been shown. The part of the debt that
 * survives past the span is given back by the existing unwind, speed-capped, and
 * GOVERNOR_MAX_LAG is sized so that takes less than one retraction.
 *
 * THE ESCAPE HATCH is that ceiling. Past it the band bottoms out and progress
 * tracks the finger 1:1 again, offset — so a determined push always moves the
 * world, and a hard multi-chapter fling still leaves a checkpoint behind with the
 * page half drawn. That is deliberate: a reader who flings three chapters is
 * asking to be somewhere else, and the cap's job is to pace the reader who is
 * simply scrolling, not to hold one who is leaving.
 */

/**
 * WHERE THE CAP APPLIES, and why it is the page's own span rather than the whole
 * checkpoint window.
 *
 * The first cut paced the entire dwell, `dwellChapterAt`'s window, which is the
 * prettier rule — the paced span and the revealed span would have been the same
 * span by construction. It is wrong for one reason and the tests said so: the tail
 * of a dwell is where the reader READS a page that is already drawn, and pacing it
 * meant leaving a finished checkpoint took up to the whole beat. Nothing is
 * unfolding there, so there is nothing to pace, and slowing it is the exact
 * definition of trapped.
 *
 * So the governed span is `[TRAVEL_END, PAGE_SPAN_END]` — the span the info leaf
 * draws itself over, imported from the timeline that owns it rather than restated,
 * so a retune of the page's staging moves the cap with it. It reaches down into
 * `overlay/` from the core, which is the wrong direction on the face of it; the
 * alternative was a second copy of the number, and a governor pacing a window the
 * page no longer draws in would fail silently. `info-beats` is a pure table of
 * constants with no DOM and no React, and there is no cycle: it imports the
 * timeline, and so do we.
 */
export const PACE_SPAN = (PAGE_SPAN_END - TRAVEL_END) / CHAPTER_COUNT
/**
 * Seconds that span takes at the cap — the authored pace, and the one number here
 * tuned by eye rather than derived. It is bracketed by the content on both sides:
 * the manga page's own reveal runs ~2.45 s and the info page's staging is written
 * in 3.87 s of research milliseconds, while anything under ~1.5 s leaves the
 * count-up and its burst reading as a single event. 2.2 s draws both leaves
 * together and lands the last character with the spread still up.
 */
export const PACE_SECONDS = 2.2
/** Progress per second inside the governed span. Outside it the cap is lifted. */
export const PACE_RATE = PACE_SPAN / PACE_SECONDS
/**
 * How far the governed world may fall behind the document before the band bottoms
 * out. DERIVED, and from the one thing that bounds what the reader can see: the
 * debt is given back at CATCHUP_MAX_SPEED once the cap lifts, and it must be gone
 * before the spread has finished walking off, or the world would still be moving
 * after the beat that caused it had left the screen. So it is exactly one
 * retraction's worth of catch-up.
 *
 * It also has to stay under JUMP_MAX, and does by better than a factor of two: the
 * largest debt the governor can build is smaller than the one-frame jump a teleport
 * is defined by, so no catch-up of its own can ever be mistaken for a scrollbar drag
 * by `stepArrival` here or by the damper downstream.
 */
export const GOVERNOR_MAX_LAG = CATCHUP_MAX_SPEED * RETRACT_SECONDS

/**
 * THE SHIPPED GUARANTEE, stated as a number rather than left implicit: a reader
 * scrolling at or below this — progress per second — is given the full authored
 * pace, because the debt they build over PACE_SECONDS still fits under the ceiling.
 * Above it the band bottoms out part-way and the page draws faster than authored,
 * approaching the ungoverned behaviour as the input approaches a fling.
 *
 * It works out at roughly 590 px/s on a 900px-tall desktop and 555 px/s on a phone,
 * which covers reading and browsing speeds and does not pretend to cover a flick.
 * Raising it means raising the ceiling, and the ceiling is what keeps the debt
 * repayable inside the dwell — so this is the trade, made once, in the open.
 */
export const GOVERNED_MAX_SPEED = PACE_RATE + GOVERNOR_MAX_LAG / PACE_SECONDS

/** The chapter whose page is drawing itself at this progress, or null. */
export function pacedChapterAt(progress: number): number | null {
  const p = Math.min(1, Math.max(0, progress))
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / SEGMENT))
  const local = (p - chapter * SEGMENT) / SEGMENT
  return local >= TRAVEL_END && local < PAGE_SPAN_END ? chapter : null
}

/**
 * The forward speed limit at a progress position, in progress per second.
 * `Infinity` means direct — scroll is 1:1 and nothing is shaped.
 */
export function paceCapAt(progress: number, reducedMotion = false): number {
  if (reducedMotion) return Infinity
  return pacedChapterAt(progress) === null ? Infinity : PACE_RATE
}

/**
 * Is progress somewhere the governor shapes it? Consumers that shortcut the
 * driver (see `use-arrival-journey`'s scroll handler) must ask this before
 * assigning raw scroll straight through.
 */
export function isGoverned(progress: number, reducedMotion = false): boolean {
  return paceCapAt(progress, reducedMotion) !== Infinity
}

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

  // THE GOVERNOR, applied after every mode has had its say and before the reveal
  // is stepped, so one clamp covers 'pass', the band's own bottoming-out and the
  // release's catch-up alike — the release is the one that most needed it, since
  // `unwind` closes at CATCHUP_MAX_SPEED, eight times a beat's authored rate, and
  // would have blown through the moment the hold let go of.
  //
  // FORWARD ONLY. A retreat is never shaped: pulling back moves the world back 1:1
  // from the first frame, which is the reader's fastest way out of a beat and the
  // one thing that must never feel governed.
  //
  // The cap is read at PREV progress, not at the step's own destination, and that
  // is load-bearing twice over. It makes the rule causal — you are governed
  // because of where the world IS, not where an uncapped step would have put it —
  // and it leaves the frame that ENTERS a checkpoint uncapped, so the hold still
  // arms out of 'pass' exactly as it did before this existed.
  if (!teleported && progress > prev.progress) {
    const cap = paceCapAt(prev.progress, reducedMotion)
    if (cap !== Infinity) {
      const paced = Math.max(
        Math.min(progress, prev.progress + cap * step),
        // The escape hatch. Past the ceiling the band bottoms out and the world
        // tracks the document again, one beat behind it — still visibly responding
        // to every scroll, which is what "never trapped" has to mean when the cap
        // itself is the point.
        raw - GOVERNOR_MAX_LAG
      )
      if (paced < progress) {
        progress = paced
        // The debt now belongs to the unwind, which is the one piece that already
        // knows how to give it back: eased, speed-capped, and cancelled outright by
        // a retreat. Without this the machine would sit in 'pass' holding a lag the
        // driver has no reason to keep ticking for, and the frame the cap lifted on
        // would close the whole gap at once.
        if (mode === 'pass') mode = 'release'
      }
    }
  }

  // THE JOURNEY NEVER OUTRUNS THE FINGER — now enforced here rather than only
  // asserted downstream. Every branch above except the hold's builds progress
  // INCREMENTALLY, and the hold's builds it from `raw` (anchor + overrun); that was
  // safe while nothing else could hold progress back, and stopped being safe the
  // moment the governor could. Measured: a hard fling into chapter 0's stop stepped
  // 0.0306 in one frame — six times the input — on the frame the governed span
  // ended, because the band's formula handed back the governor's whole debt at once.
  //
  // The bound is the renewal proofs' own: no frame moves further than the finger
  // did, or than the capped unwind, whichever is larger. Stating it as code makes
  // every future branch inherit it instead of having to remember it.
  if (!teleported) {
    const track = Math.max(0, raw - prev.raw)
    progress = Math.min(progress, prev.progress + Math.max(track, CATCHUP_MAX_SPEED * step))
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
