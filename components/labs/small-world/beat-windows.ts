import { ENDING_SPAN } from './ending-timeline'
import { GIRL_JUMP_START, GIRL_TRANSFER } from './scene/girl-exit'

/**
 * ============================================================================
 * AUTHORED BEAT WINDOWS (Task 125) — the spans a reader must not be left inside
 * ============================================================================
 * Aram: "even if the user sporadically scrolls we should have some sort of
 * baseline speed of scroll, so the user is still served the right content. it is
 * especially noticeable during the final parts when Alwi jumps off the world."
 *
 * The pace governor (Task 109, arrival.ts) caps how FAST content may pass. It has
 * no floor, so a reader whose scroll stops mid-beat is simply left there — and the
 * worst place to be left is the exit, where the picture on screen is a girl frozen
 * in mid-air over her own planet. That is not a paused film; it is a broken one.
 *
 * This table is the other half of the same mediation. It names the spans that are
 * a MOVEMENT rather than a state — the ones with no legible still frame in the
 * middle — and `beat-carry.ts` carries the reader through them at an authored pace
 * when their input goes quiet. Everything here is AUTHORED DATA, never inferred:
 * a window exists because somebody decided the span has no readable rest, and
 * nothing about the scene's shape can be pattern-matched into that decision.
 *
 * WHY WINDOWS ARE PROGRESS UNITS AND NOT PHASE NAMES. Every consumer downstream
 * reads progress; a window written in progress can be compared to the reader's
 * position with `<=` and nothing else, which is what makes the carry a pure
 * function of the same number the scene is a pure function of.
 *
 * ---------------------------------------------------------------------------
 * THE CANDIDATES THAT ARE **NOT** WIRED — listed, not implemented, for Aram to pick
 * ---------------------------------------------------------------------------
 * The mechanism is general (add a row, get a floor). These were considered and
 * left out of the shipped table; one line each on whether a floor would help:
 *
 *  - CHECKPOINT PAGE DRAW `[TRAVEL_END, PAGE_SPAN_END]` per chapter. WOULD HELP,
 *    and is the natural second row: it is the exact span the governor already
 *    paces from above, so a floor there would close the pair — a reader who stops
 *    mid-draw gets the finished page instead of half a sentence. Held back only
 *    because it fires six times per journey against the exit's once, so it is a
 *    feel change to the whole lab rather than a fix to a broken picture.
 *  - MANGA PAGE TURN. WOULD BUY NOTHING. T111 deleted the manga reveal clock; the
 *    page prints complete, so there is no mid-flight state to be stranded in.
 *  - DESK DESCENT `[GIRL_DESK_WALK_START, GIRL_DESK_SETTLED]`. WOULD HELP MILDLY:
 *    stopping there leaves her mid-stride crossing to her chair, which is an
 *    unlovely still but a legible one (a person walking, paused), not a body
 *    suspended in the air.
 *  - BIOME TRANSITIONS / OPEN TRAVEL. NO. Travel is continuous scenery with a
 *    readable frame everywhere; a floor would be a ride through ground the reader
 *    is entitled to stop on, which is the exact defect Task 106 named.
 *  - THE ENDING PULL-BACK `[ZOOM_START, 1]`. NO. A camera move has a legible frame
 *    at every point — stopping mid-zoom is a framing choice, not a stranded beat.
 *  - THE WALK TO THE BRINK `[GIRL_TURN_START, GIRL_WALK_END]`. BORDERLINE, same
 *    argument as the desk descent: locomotion paused still reads as a person.
 */

export type BeatWindow = {
  /** Stable id — the carry latches on this, so it must not change meaning between frames. */
  id: string
  /** Progress the beat begins at, inclusive. */
  start: number
  /** Progress the beat is COMPLETE at, exclusive — the carry lands here and lets go. */
  end: number
  /** Wall-clock seconds the whole window is authored to take at the baseline pace. */
  seconds: number
}

/** The ending's own t → journey progress. The ending is (1, TRACK_END]; see ending-timeline. */
const endingProgress = (t: number): number => 1 + t * ENDING_SPAN

/**
 * SECONDS FOR THE LEAP — the one number here tuned by eye rather than derived, and
 * the dial to turn if the exit feels hurried or laboured.
 *
 * It could not be derived, because the flight has no authored seconds anywhere: the
 * exit is written entirely in scroll and surface speed (`LEAP_PACE` is a multiple of
 * the journey's travel rate, not a duration), and the clip's own length is a runtime
 * property of the GLB rather than a constant this module could read.
 *
 * It was bracketed rather than guessed. Below ~0.6 s the leap reads as a flinch —
 * she is off the planet before the eye has found her. Above ~1.4 s the fall into the
 * ball turns into a sink, and the ending's still beat starts before the reader has
 * stopped waiting. 0.9 s sits in the middle and is what a standing leap takes.
 *
 * The resulting rate is checked against a ceiling rather than left free — see
 * `beatPaceOf`.
 */
export const EXIT_JUMP_SECONDS = 0.9

/**
 * THE EXIT JUMP — the window this task exists for, and the only one wired.
 *
 * `[GIRL_JUMP_START, GIRL_TRANSFER]` in the ending's t, imported from the module
 * that owns the staging rather than restated, so a retune of the leap moves the
 * floor with it. In progress that is roughly [1.042, 1.062]: takeoff, apex, the
 * fall into the planet's occlusion ball, and the transfer to the desk that ends her
 * time on the world. She is out of sight by ~1.059 and the window closes just after.
 *
 * WHY IT STARTS AT THE JUMP AND NOT AT THE BRINK. The brink (`GIRL_BRINK`, the beat
 * before this one) is a girl standing on the edge of her world with her back to the
 * reader — a composed still, and one the exit's own staging notes call "a decision
 * rather than a stumble". A reader who stops there is looking at a picture. Carrying
 * them out of it would be the floor overruling the staging.
 *
 * WHY IT ENDS AT `GIRL_TRANSFER` AND NOT AT `GIRL_JUMP_END`. The two are 0.005 of
 * the ending apart and she is drawn in neither place between them, but the transfer
 * is where she stops being on the planet at all. Landing the carry there means the
 * beat the reader was carried through is finished in the model, not just on screen,
 * and the rest they come to is the seated world under a still camera —
 * `ZOOM_START` is 0.38, so the pull-back has not begun.
 */
export const EXIT_JUMP_WINDOW: BeatWindow = {
  id: 'exit-jump',
  start: endingProgress(GIRL_JUMP_START),
  end: endingProgress(GIRL_TRANSFER),
  seconds: EXIT_JUMP_SECONDS,
}

/** Every window with a baseline floor. Ordered, non-overlapping, and short. */
export const BEAT_WINDOWS: readonly BeatWindow[] = [EXIT_JUMP_WINDOW]

/**
 * The baseline pace, in progress per second — what the carry advances at.
 *
 * It is bounded from above by `GOVERNED_MAX_SPEED` (the reading speed the pace
 * governor is tuned to serve in full) and the bound is a test, not a comment: the
 * carry must never move the world faster than an ordinary reader's own hands
 * already do, or the floor stops being a floor and becomes a ride.
 */
export function beatPaceOf(window: BeatWindow): number {
  return (window.end - window.start) / window.seconds
}

/**
 * The beat window containing this progress, or null.
 *
 * Half-open `[start, end)` on purpose: the carry's own destination is `end`, so
 * arriving there leaves the window by construction and no latch is needed to stop it
 * running twice.
 */
export function beatWindowAt(progress: number): BeatWindow | null {
  for (const window of BEAT_WINDOWS) {
    if (progress >= window.start && progress < window.end) return window
  }
  return null
}
