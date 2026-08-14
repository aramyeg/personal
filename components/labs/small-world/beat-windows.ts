import { PACE_ROWS, paceRow, secondsFor, type PaceRow, type PaceSpan } from './pace-table'

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
 * THIS TABLE IS A PROJECTION NOW (Task 129) — the rows live in `pace-table.ts`
 * ---------------------------------------------------------------------------
 * A window is a pace row with `floor` set, and its seconds are that row's own rate
 * read live. Nothing about the mechanism changed: the carry still reads windows in
 * progress units, still latches on `id`, still lands on `end`. What changed is where
 * the decision is written — one row per section, so a section's floor and its ceiling
 * can no longer be retuned apart from each other, and the ?tune panel moves both with
 * one dial.
 *
 * BECAUSE THE SECONDS ARE LIVE, `beatWindows()` IS A FUNCTION. A frozen array built
 * at module init would be the dial's value at page load, and a panel drag would move
 * the ceiling while leaving the floor on the old number — the exact drift this task
 * exists to end. `EXIT_JUMP_WINDOW` below is the one snapshot kept, and it is kept
 * for the proofs written against it rather than for the shipped path.
 *
 * ---------------------------------------------------------------------------
 * THE CANDIDATES THAT ARE **NOT** WIRED — listed, not implemented, for Aram to pick
 * ---------------------------------------------------------------------------
 * The mechanism is general (add a row, get a floor). These were considered and left
 * out; one line each on whether a floor would help. TWO OF THEM MOVED IN TASK 129 and
 * are marked, because the reason they moved was Aram overruling the judgement below
 * rather than new evidence:
 *
 *  - THE ENDING TURN and THE WALK TO THE BRINK. **NOW WIRED.** Task 125 called the
 *    walk "BORDERLINE, same argument as the desk descent: locomotion paused still
 *    reads as a person", and left both out. Aram's Task 129 sentence — "when Alwi
 *    turns around to jump off the planet, this should also have a certain pace
 *    REGARDLESS OF SCROLLING SPEED" — overrules that, and it is worth naming the
 *    disagreement rather than quietly resolving it: the walk's still frame IS
 *    legible, and it is paced anyway because he asked for the whole exit to have one
 *    pace, not for each of its frames to be defensible on its own. The brink between
 *    them stays free; see the `ending-walk` row for why.
 *  - CHECKPOINT PAGE DRAW `[TRAVEL_END, PAGE_SPAN_END]` per chapter. **NOW HAS THE
 *    CEILING, STILL NO FLOOR.** Task 129 gave the notes row a `ceiling` and a
 *    fast-forward, so half the pair this entry asked for is closed. The floor is
 *    still held back for the reason given here originally: it fires six times per
 *    journey against the exit's once, so it is a feel change to the whole lab rather
 *    than a fix to a broken picture — and a reader stopped mid-draw is looking at a
 *    half-drawn page, which is unfinished but not broken.
 *  - MANGA PAGE TURN. WOULD BUY NOTHING. T111 deleted the manga reveal clock; the
 *    page prints complete, so there is no mid-flight state to be stranded in.
 *  - DESK DESCENT `[GIRL_DESK_WALK_START, GIRL_DESK_SETTLED]`. WOULD HELP MILDLY:
 *    stopping there leaves her mid-stride crossing to her chair, which is an
 *    unlovely still but a legible one (a person walking, paused), not a body
 *    suspended in the air.
 *  - BIOME TRANSITIONS / OPEN TRAVEL. NO, AND THE CEILING DID NOT CHANGE THAT.
 *    Travel is continuous scenery with a readable frame everywhere; a floor would be
 *    a ride through ground the reader is entitled to stop on, which is the exact
 *    defect Task 106 named. Task 129 caps travel from ABOVE — she is never faster
 *    than a walk — and deliberately refuses the floor, so a reader may still stand in
 *    the jungle for as long as they like. Same for the mascots' beat.
 *  - THE ENDING PULL-BACK `[ZOOM_START, 1]`. NO. A camera move has a legible frame
 *    at every point — stopping mid-zoom is a framing choice, not a stranded beat.
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

/** Every pace row that carries a floor, in the order the reader meets them. */
const FLOOR_ROWS: readonly PaceRow[] = PACE_ROWS.filter((row) => row.floor)

/**
 * One row's span, as a window. Built fresh on every read because `seconds` is LIVE —
 * see the header. The `id` is the ROW's id, which is what makes the carry's latch
 * stable across the rebuild: two windows describing the same beat compare equal on the
 * one field the carry actually holds on to.
 */
const windowOf = (row: PaceRow, span: PaceSpan): BeatWindow => ({
  id: row.id,
  start: span[0],
  end: span[1],
  seconds: secondsFor(row, span),
})

/**
 * SECONDS FOR THE LEAP — the one number here tuned by eye rather than derived, and
 * the dial to turn if the exit feels hurried or laboured. It is `paceJumpSeconds`
 * now, read at module init, so this is the DEFAULT-time value; the live one reaches
 * the carry through `beatWindowAt`.
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
const JUMP_ROW = paceRow('ending-jump')
const JUMP_SPAN = JUMP_ROW.spans[0]

export const EXIT_JUMP_SECONDS = secondsFor(JUMP_ROW, JUMP_SPAN)

/**
 * THE EXIT JUMP — the window Task 125 was opened on, and the first one wired.
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
 *
 * A SNAPSHOT AT THE DEFAULT DIAL (Task 129), kept for the proofs and benches written
 * against it. The shipped path reads `beatWindowAt`, which is live.
 */
export const EXIT_JUMP_WINDOW: BeatWindow = windowOf(JUMP_ROW, JUMP_SPAN)

/**
 * Every window with a baseline floor, in reader order. Ordered, non-overlapping, and
 * still short — three rows since Task 129, all of them the ending's.
 *
 * A FUNCTION, not an array: the seconds are the pace table's live rates, so a window
 * built at module init would go stale the first time the panel moved a dial.
 */
export function beatWindows(): readonly BeatWindow[] {
  return FLOOR_ROWS.flatMap((row) => row.spans.map((span) => windowOf(row, span)))
}

/**
 * The baseline pace, in progress per second — what the carry advances at.
 *
 * It is bounded from above by `GOVERNED_MAX_SPEED` (the reading speed the pace
 * governor is tuned to serve in full) and the bound is a test, not a comment: the
 * carry must never move the world faster than an ordinary reader's own hands
 * already do, or the floor stops being a floor and becomes a ride.
 *
 * Since Task 129 it is the row's own `rate()` recovered — `seconds` is the span
 * divided by the rate, so this divides it straight back — which is the arithmetic
 * that makes a floor and a ceiling on the same row impossible to set apart.
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
 *
 * IT BUILDS THE WINDOW FRESH (Task 129) rather than returning one from a table, so
 * the `seconds` a caller reads are the dial's value THIS frame. Callers must compare
 * windows by `id` and never by identity — the carry already did, which is why nothing
 * downstream had to change for this.
 */
export function beatWindowAt(progress: number): BeatWindow | null {
  for (const row of FLOOR_ROWS) {
    for (const span of row.spans) {
      if (progress >= span[0] && progress < span[1]) return windowOf(row, span)
    }
  }
  return null
}
