import { GOVERNOR_MAX_LAG, STEP_MAX_SECONDS } from './arrival'
import { paceRowAt } from './pace-table'
import { DIALS } from './scene/tunables'

/**
 * ============================================================================
 * DECLINING WHAT YOU ARE READING (Task 129, R2)
 * ============================================================================
 * Aram: "we should have the possibility to scroll to the end of the presentation of
 * current notes faster."
 *
 * Task 126's law is that no input pattern traverses the story faster than authored,
 * and this is a SCOPED AMENDMENT to it rather than a hole in it. The amendment is
 * scoped by the pace table: only a row with `fastForward` set may be run through,
 * only ever to THAT ROW'S OWN SPAN END, and the row on the other side of that end
 * governs the reader normally from the next frame. So what a reader may decline is
 * the note in front of them. What they still may not do is blast past a note they
 * have not been shown, because the fast-forward cannot start in a span they have
 * not entered and cannot finish in one they have.
 *
 * ---------------------------------------------------------------------------
 * WHAT "DELIBERATE AND SUSTAINED" IS MEASURED AS, AND WHY IT IS NOT AN INPUT COUNT
 * ---------------------------------------------------------------------------
 * The obvious threshold — N milliseconds of continuous wheel or touch input — is
 * the wrong instrument, and Task 109's own measurements say why: a reader scrolling
 * STEADILY through the story delivers continuous input too. A rule that fired on
 * sustained input alone would fast-forward every note for every steady reader, and
 * the governor would be a no-op for exactly the reader it was built to serve.
 *
 * The distinguishing fact is not that the reader is scrolling. It is that they are
 * scrolling AGAINST THE CAP: pushing the document further forward than the world
 * has been allowed to follow. Task 126 already measures that gap and already has a
 * number for how much of it an ordinary reader ever produces — `GOVERNOR_MAX_LAG`
 * is a full screen of free travel, sized so "no ordinary scroll ever meets it". So
 * the arming condition is the reader's own lead, and the threshold is a fraction of
 * a quantity that was measured rather than chosen:
 *
 *   the document is more than `ffLead()` ahead of the world, the reader's motion
 *   EPISODE is still travel, and both have been true for `FF_ARM_SECONDS`.
 *
 * A steady reader never reaches `ffLead()` at all. A reader leaning on the wheel to
 * get past a note reaches it in a few frames and holds it, which is precisely the
 * gesture "I have seen enough of this one" is made of. A hard fling inside a note
 * also arms it, and that is intended rather than tolerated — a fling inside a note
 * is the same sentence said louder, and it still stops at the note's end.
 *
 * ---------------------------------------------------------------------------
 * WHY "STILL PUSHING" IS THE EPISODE AND NOT THE FRAME'S OWN MOVEMENT
 * ---------------------------------------------------------------------------
 * The first cut asked whether the READER moved the document forward this frame —
 * `readerMoved > eps`, the same quantity the carry uses — and it was measured to be
 * incapable of ever arming: 0 armed frames in 379 under a hard fling, 0 in 429 under
 * a firm drag, 0 in 694 under relentless back-to-back flings, with the lead sitting
 * at a median 0.080 against a 0.0378 threshold the whole time.
 *
 * The two conditions were MUTUALLY EXCLUSIVE under exactly the input the feature
 * exists for, and the reason is structural rather than a matter of degree. The only
 * state in which the lead grows large is the reader hard against the leash — and the
 * leash is enforced by writing the document back with `pinScrollTo`, after which the
 * driver re-anchors. So the frame after a pin measures no reader movement at all,
 * because the pin consumed it. Measured: 40 of 84 in-span frames reported zero
 * reader movement, and the arming clock reset on every one of them, topping out at
 * 0.117 s against the 0.25 s it needed.
 *
 * The fix is to ask the question the classifier already answers. `scroll-provenance`
 * runs a motion EPISODE — a run of movement with no real rest in it, judged once and
 * inherited — and "the reader is still pushing" is precisely "the travel episode is
 * still open". It survives a pinned frame, it survives the eventless momentum after
 * a flick (which has no input to measure and is the other half of a fling), and it
 * ends when the document actually rests. A reverse still disarms on the spot, and
 * that stays a frame-level test because a retreat must always be obeyed immediately.
 *
 * ---------------------------------------------------------------------------
 * A GLIDE, NOT A TELEPORT
 * ---------------------------------------------------------------------------
 * The fast rate is the row's own rate times `FAST_FORWARD_FACTOR`, so the page keeps
 * drawing — quickly, visibly, and in the same order — instead of snapping to its
 * finished state. Expressing it as a MULTIPLE of the row's rate rather than as its
 * own seconds is what keeps the panel honest: retuning a section retunes its
 * fast-forward with it, and the invariant "the fast path is never slower than the
 * normal one" is `factor >= 1` rather than a comparison between two dials that can
 * drift past each other.
 */

export type FastForwardState = {
  /** The row being run through, by id, or null when nothing is armed. */
  row: string | null
  /** Seconds the arming condition has held. */
  held: number
  /** Is the fast rate in effect this frame? */
  active: boolean
}

export const FAST_FORWARD_IDLE: FastForwardState = Object.freeze({
  row: null,
  held: 0,
  active: false,
})

/**
 * How far ahead of the world the document must be pushed before the reader counts
 * as declining rather than reading, in progress.
 *
 * HALF the leash. The full slack is what Task 126 sized as "about one phone screen,
 * so no ordinary scroll ever meets it"; half of it is comfortably past anything a
 * steady read produces and comfortably short of the ceiling, so the fast-forward
 * engages while the reader is still moving rather than only once they have been
 * pinned. Derived rather than dialled, for the same reason the leash is.
 *
 * A FUNCTION RATHER THAN A CONST, and not for style: `arrival.ts` imports
 * `fastForwardFactor` from here and this module imports `GOVERNOR_MAX_LAG` from there,
 * so the two are a cycle. A cycle is harmless as long as nothing is read at MODULE
 * INIT — and a top-level `const FF_LEAD = GOVERNOR_MAX_LAG / 2` is exactly that read,
 * which throws on the TDZ whenever arrival is the module the graph is entered
 * through (which it is, on the shipped page). Deferring the read to call time costs
 * nothing, keeps the derivation single-sourced, and cannot be broken by import order.
 */
export const ffLead = (): number => GOVERNOR_MAX_LAG / 2

/**
 * How long that lead must be held, in seconds.
 *
 * `INPUT_GRACE`'s own value, and for its own reason: below the lag between an input
 * event and the scroll it produces, a held push cannot be told apart from the tail
 * of a single one. Above it, the reader is still pushing.
 */
export const FF_ARM_SECONDS = 0.25

/** The fast rate, as a multiple of the row's authored rate. Live — the panel writes it. */
export const fastForwardFactor = (): number => Math.max(1, DIALS.paceFastForward.value)

/**
 * One frame of the arming clock. Pure: same inputs, same output, no clock and no DOM.
 *
 * @param progress   Governed progress — decides which row the reader is inside.
 * @param lead       `raw - progress`: how far the document has been pushed past the
 *                   world. The driver's own subtraction, passed in rather than
 *                   recomputed, so this function has no opinion about the DOM.
 * @param pushing    Is the reader's own travel episode still open, and not a retreat?
 *                   The driver builds it from `scroll-provenance`'s episode and its
 *                   own reader delta — see the header for why the frame's movement
 *                   alone provably cannot answer this.
 */
export function stepFastForward(
  prev: FastForwardState,
  progress: number,
  lead: number,
  pushing: boolean,
  dt: number,
  reducedMotion = false
): FastForwardState {
  const found = paceRowAt(progress)
  // Leaving the span disarms outright — including the frame the fast-forward's own
  // glide lands on the end. That is what makes "it cannot leak past the span" a
  // property of the state machine rather than a clamp somebody has to remember.
  if (reducedMotion || found === null || !found.row.fastForward) return FAST_FORWARD_IDLE

  const sameRow = prev.row === found.row.id
  if (!pushing || lead <= ffLead()) {
    // A reverse, a pause, or a reader who has stopped pushing ahead of the world.
    // The hold is dropped rather than decayed: declining is a continuous gesture,
    // and one that has been let go of has ended.
    return { row: found.row.id, held: 0, active: false }
  }

  const step = Math.min(Math.max(dt, 0), STEP_MAX_SECONDS)
  const held = (sameRow ? prev.held : 0) + step
  return { row: found.row.id, held, active: held >= FF_ARM_SECONDS }
}

/** Does the fast-forward need the driver's frame loop awake? */
export function fastForwardBusy(state: FastForwardState): boolean {
  return state.active
}
