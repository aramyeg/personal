import { CHAPTER_COUNT } from './chapters'
import { ENDING_SPAN } from './ending-timeline'
import { PANEL_END, TRAVEL_END } from './journey-timeline'
import { PAGE_SPAN_END } from './overlay/info-beats'
import {
  GIRL_JUMP_START,
  GIRL_TRANSFER,
  GIRL_TURN_END,
  GIRL_TURN_START,
  GIRL_WALK_END,
  JOURNEY_SURFACE_RATE,
} from './scene/girl-exit'
import { DIALS } from './scene/tunables'

/**
 * ============================================================================
 * THE PACE TABLE (Task 129) — every section's speed, in one place
 * ============================================================================
 * Aram: "the girl should move through the planet at a fixed speed, when starting
 * showing the manga and description notes it also should have a fixed pace, but we
 * should have the possibility to scroll to the end of the presentation of current
 * notes faster. the animals moving after the presentation section should also have
 * a concrete pace and most importantly when the story is over and Alwi turns around
 * to jump off the planet, this should also have a certain pace regardless of
 * scrolling speed."
 *
 * Three separate mechanisms had grown three separate pace constants, each authored
 * against its own beat and none of them able to see the others:
 *
 *   - `PACE_SECONDS` 2.2 in arrival.ts — the CEILING over a checkpoint's page draw;
 *   - `EXIT_JUMP_SECONDS` 0.9 in beat-windows.ts — the FLOOR under the leap;
 *   - and, for travel and for the mascots' beat, nothing at all: those spans were
 *     whatever speed the reader's hand happened to make them, which is the very
 *     complaint Task 109 was opened on, still true in the two places it never
 *     reached.
 *
 * This module is the answer to "I want to pick the speed of each section". It is one
 * ROW per section, each row naming its own spans, its own authored rate, and which
 * of the two mechanisms apply to it. `arrival.ts` reads the ceilings, `beat-windows`
 * projects the floors, `fast-forward.ts` reads the fast-forward flag, and the
 * ?tune panel writes the rates — all of them through this table, so a dial that
 * moves moves every mechanism that section has.
 *
 * ---------------------------------------------------------------------------
 * THE SPANS ARE DERIVED, NEVER RESTATED
 * ---------------------------------------------------------------------------
 * Not one track number is written down here. Every boundary is imported from the
 * module that owns the staging — `journey-timeline` for the chapter's shape,
 * `info-beats` for where the page finishes drawing, `girl-exit` for the ending's
 * choreography — so a retune of any of them moves the pace row with it rather than
 * leaving a governor pacing a window the scene no longer draws in. That is the
 * failure mode this lab has already paid for once (Task 56's keep-out model believed
 * a band was empty that the shipped card covered 61% of).
 *
 * ---------------------------------------------------------------------------
 * WHY A RATE IS THE CANONICAL QUANTITY, AND SECONDS THE DERIVED ONE
 * ---------------------------------------------------------------------------
 * Rows do not all have spans of one length. The TRAVEL row is the clearest case: a
 * chapter turns the planet on BOTH sides of its checkpoint, over two spans of
 * different width, and it is the same movement at the same speed — so "seconds"
 * has no single value there and "progress per second" has exactly one. Rows whose
 * authored quantity really is a duration (a page draws for so long; a leap takes so
 * long) convert at construction, and their seconds are recoverable through
 * `secondsFor`.
 *
 * TWO OF THE ROWS ARE AUTHORED IN SURFACE SPEED rather than in either, and that is
 * the strongest derivation in the table. `JOURNEY_SURFACE_RATE` is how many world
 * units of planet surface pass under her per unit of progress — 46.08, solved by
 * `journey-timeline` rather than chosen. Dividing a walking speed by it turns "she
 * never moves faster than a walk" into a scroll ceiling, which is what Aram's
 * "fixed speed" asks for in the only units the girl actually has.
 */

/** A half-open span of journey progress, `[start, end)`. */
export type PaceSpan = readonly [start: number, end: number]

export type PaceRowId =
  | 'travel'
  | 'notes'
  | 'animals'
  | 'ending-turn'
  | 'ending-walk'
  | 'ending-jump'

export type PaceRow = {
  id: PaceRowId
  /** What the reader is looking at, for the panel and for the report. */
  label: string
  /** Every span this row governs, ordered and non-overlapping. */
  spans: readonly PaceSpan[]
  /**
   * Progress per second. Read LIVE — the ?tune panel writes the dial behind it, so
   * this is a function rather than a field and callers must not cache it across
   * frames.
   */
  rate: () => number
  /** Does the governor cap forward motion here? (Task 109's mechanism.) */
  ceiling: boolean
  /**
   * Does the carry push the reader through when their input goes quiet? (Task 125's
   * mechanism.) A row with a floor is a span with no legible still frame in it.
   */
  floor: boolean
  /**
   * May a deliberate sustained push run to this row's end at the fast rate?
   * (Task 129, R2.) See `fast-forward.ts` for what "deliberate" is measured as.
   */
  fastForward: boolean
}

/**
 * HER WALKING SPEED, in world units of planet surface per second — the number three
 * rows are authored against, and the reason "fixed speed" is a derivation here
 * rather than a taste.
 *
 * Task 110 measured this lab's own gait thresholds off the shipped GLB: the walk
 * clip reads up to `WALK_MAX` 2.5 u/s with a dead band at 2.2, above which the
 * chooser starts reaching for the run. 2.2 is therefore the fastest speed at which
 * she is unambiguously WALKING, gear stable, no churn — and "the girl moves through
 * the planet at a fixed speed" is, in the end, a statement about her legs.
 *
 * It lands almost exactly on the reading speed the lab already promised to serve in
 * full: 2.2 / 46.08 = 0.0477 progress per second against Task 109's
 * `GOVERNED_MAX_SPEED` of 0.0488. That coincidence is worth stating out loud,
 * because it is what makes this ceiling safe to add to a span that never had one —
 * it sits at the speed an ordinary reader already scrolls, so it costs them nothing
 * and binds only the fling it was added for.
 */
export const TRAVEL_SURFACE_SPEED = 2.2

/** Surface speed → progress per second. The whole of the derivation, in one line. */
export const rateForSurfaceSpeed = (speed: number): number => speed / JOURNEY_SURFACE_RATE

const SEGMENT = 1 / CHAPTER_COUNT
const chapterSpan = (from: number, to: number): PaceSpan[] =>
  Array.from({ length: CHAPTER_COUNT }, (_, c) => [(c + from) * SEGMENT, (c + to) * SEGMENT] as PaceSpan)

/** The ending's own t → journey progress. The ending is (1, TRACK_END]; see ending-timeline. */
export const endingProgress = (t: number): number => 1 + t * ENDING_SPAN

const endingSpan = (from: number, to: number): PaceSpan[] => [
  [endingProgress(from), endingProgress(to)],
]

const spanLength = (span: PaceSpan): number => span[1] - span[0]

/** Seconds a row takes to cross one of its spans at its current rate. */
export function secondsFor(row: PaceRow, span: PaceSpan): number {
  return spanLength(span) / row.rate()
}

/** Seconds a row takes to cross ALL of its spans — the row's share of the authored total. */
export function totalSecondsFor(row: PaceRow): number {
  const rate = row.rate()
  return row.spans.reduce((sum, span) => sum + spanLength(span) / rate, 0)
}

/** A row authored as a duration: rate is that duration spread over the span it names. */
const secondsRate = (span: PaceSpan, seconds: () => number) => (): number =>
  spanLength(span) / Math.max(seconds(), 1e-6)

const TURN_SPAN = endingSpan(GIRL_TURN_START, GIRL_TURN_END)[0]
const JUMP_SPAN = endingSpan(GIRL_JUMP_START, GIRL_TRANSFER)[0]

/**
 * ---------------------------------------------------------------------------
 * THE ROWS
 * ---------------------------------------------------------------------------
 * Ordered as the reader meets them. Together they cover every span this lab paces;
 * what they deliberately do NOT cover is stated with each row, because an uncovered
 * span is a decision and not an oversight.
 */
export const PACE_ROWS: readonly PaceRow[] = [
  /**
   * TRAVEL (R1) — the planet turning under her, and the row that did not exist.
   *
   * It is BOTH of a chapter's turning legs, and they are one row rather than two
   * because they are one movement: `journey-timeline` solves `TRAVEL_END` so that
   * the approach carries `PARK_FRAC` of the slice and the departure carries the
   * rest at the IDENTICAL slope (0.4/0.24 = 0.6/0.36 = 1.667). A reader scrolling
   * steadily never feels the world change gear across a dwell, and a single rate
   * here is the pace-table's statement of that same fact.
   *
   * CEILING ONLY, AND THE FLOOR IS REFUSED ON PURPOSE. "Fixed speed" read strictly
   * would want both — but a floor on open travel is a ride through scenery the
   * reader is entitled to stop and look at, which is the exact defect Task 106
   * named and `beat-windows.ts` already ruled out in writing ("BIOME TRANSITIONS /
   * OPEN TRAVEL. NO. Travel is continuous scenery with a readable frame
   * everywhere"). So travel is fixed from above: she is never faster than a walk,
   * and a reader who wants to stand still in the jungle may.
   */
  {
    id: 'travel',
    label: 'travel — the planet turning under her',
    spans: [...chapterSpan(0, TRAVEL_END), ...chapterSpan(PANEL_END, 1)],
    rate: () => rateForSurfaceSpeed(DIALS.paceTravelSpeed.value),
    ceiling: true,
    floor: false,
    fastForward: false,
  },
  /**
   * NOTES (R2) — the manga page and the description leaf presenting themselves.
   *
   * `[TRAVEL_END, PAGE_SPAN_END]`, which is Task 109's `PACE_SPAN` unchanged: the
   * span the info leaf DRAWS over, not the whole dwell. The tail of a dwell is
   * where a finished page is read, and pacing it is Task 109's own definition of
   * trapped. That reasoning is untouched; only the number moved.
   *
   * THIS IS THE ROW ARAM COMPLAINED ABOUT and the only default that changed for
   * feel rather than for coverage. See `NOTES_SECONDS`.
   */
  {
    id: 'notes',
    label: 'notes — the manga + description page drawing',
    spans: chapterSpan(TRAVEL_END, PAGE_SPAN_END),
    rate: secondsRate(chapterSpan(TRAVEL_END, PAGE_SPAN_END)[0], () => DIALS.paceNotesSeconds.value),
    ceiling: true,
    floor: false,
    fastForward: true,
  },
  /**
   * ANIMALS (R3) — the checkpoint mascots' beat, `[PAGE_SPAN_END, PANEL_END]`.
   *
   * IDENTIFIED, not guessed. The "animals moving after the presentation section"
   * are the peeker mascots (`scene/props/peekers.tsx`): a per-biome pair of clay
   * creatures that lean into the frame beside the open book. Their entrance and
   * exit ride the arrival REVEAL clock — `peekerClock` reads `JourneyState.reveal`,
   * whose `t` is advanced by wall-clock `dt` in `stepReveal` — so the animation
   * itself already has a fixed duration (`REVEAL_SECONDS` 1.05 in, `RETRACT_SECONDS`
   * 0.42 out). What had no pace at all was the SPAN THEY LIVE IN: the retract only
   * begins when scroll carries progress past `PANEL_END`, and a reader who crosses
   * that span faster than the clock preempts the whole beat — `journeyStateAt`'s
   * reveal is one field, so reaching the next checkpoint inside 0.42 s replaces the
   * outgoing mascot outright and it is CUT rather than finished. Measured against
   * Task 126's fling spam, this span was crossed in a single frame.
   *
   * So the fix is a ceiling on the span rather than a clock on the creatures: hold
   * the reader in it long enough that the wall-clock beat they already have can
   * play. Authored at her travel speed — the checkpoint's tail moves at the speed
   * the world moves — which works out at ~0.73 s, comfortably over the 0.42 s
   * retraction it has to protect.
   *
   * NO FLOOR, by Task 125's own criterion: is there a readable frame everywhere in
   * here? Yes. The page is finished, the mascots are leaning in and idling, and a
   * reader who stops is looking at a composed picture of a book and two creatures —
   * the opposite of the body-suspended-in-mid-air the floor mechanism exists for.
   */
  {
    id: 'animals',
    label: 'animals — the mascots’ beat after the page',
    spans: chapterSpan(PAGE_SPAN_END, PANEL_END),
    rate: () => rateForSurfaceSpeed(DIALS.paceAnimalsSpeed.value),
    ceiling: true,
    floor: false,
    fastForward: false,
  },
  /**
   * THE ENDING, in three rows (R4) — "when Alwi turns around to jump off the
   * planet, this should also have a certain pace REGARDLESS OF SCROLLING SPEED".
   *
   * That last clause is why the ending rows are the only ones carrying BOTH
   * mechanisms. A floor alone answers a reader who stops; a ceiling alone answers a
   * reader who flings; "regardless of scrolling speed" is both, and the two set to
   * the same rate make the ending play at its authored speed whatever the hand on
   * the wheel is doing. Reversing is untouched — a ceiling is forward-only and the
   * carry disarms on a reverse — so the reader can always go back and watch it
   * again, which is the one freedom that must survive.
   *
   * Task 125 shipped only the third of these. Its own header listed the walk as
   * "BORDERLINE, same argument as the desk descent: locomotion paused still reads
   * as a person" and left it out. Aram's sentence overrules that judgement for the
   * turn and the walk specifically, and it is worth naming the disagreement rather
   * than quietly resolving it: the walk's still frame IS legible, and it is being
   * paced anyway because he asked for the whole exit to have one pace rather than
   * for each of its frames to be defensible on its own.
   */
  {
    id: 'ending-turn',
    label: 'ending — she turns her back on the world',
    spans: [TURN_SPAN],
    rate: secondsRate(TURN_SPAN, () => DIALS.paceTurnSeconds.value),
    ceiling: true,
    floor: true,
    fastForward: false,
  },
  /**
   * THE WALK TO THE BRINK, authored in her surface speed for the same reason the
   * journey is: `GIRL_WALK_SPAN` is already SOLVED in girl-exit so that her peak
   * surface speed equals `JOURNEY_SURFACE_RATE` per unit of progress. Feeding the
   * same walking speed in here means she crosses the last few metres of her world
   * at exactly the pace she crossed the rest of it — the derivation girl-exit set
   * up, finally given the seconds it was missing.
   *
   * THE BRINK IS NOT A ROW, and this is the decision Aram should look at first.
   * `[GIRL_WALK_END, GIRL_JUMP_START]` — 0.022 of the ending, about a fifth of a
   * second at pace — is left free on Task 125's staging argument: she is standing
   * on the edge of her world with her back to the reader, which girl-exit's own
   * notes call "a decision rather than a stumble", and a reader who stops there is
   * looking at the picture the leap is supposed to launch from. Pacing it would be
   * the table overruling the staging. It is a one-line change if he disagrees.
   */
  {
    id: 'ending-walk',
    label: 'ending — she walks to the brink',
    spans: endingSpan(GIRL_TURN_END, GIRL_WALK_END),
    rate: () => rateForSurfaceSpeed(DIALS.paceWalkSpeed.value),
    ceiling: true,
    floor: true,
    fastForward: false,
  },
  /**
   * THE LEAP — Task 125's window, moved here whole. `EXIT_JUMP_SECONDS` 0.9 was the
   * eye dial that task bracketed (0.6 reads as a flinch, 1.4 turns the fall into a
   * sink) and it is preserved exactly, so the beat that task shipped is unchanged
   * by this one except that it now has a ceiling as well as a floor.
   */
  {
    id: 'ending-jump',
    label: 'ending — the leap off the world',
    spans: [JUMP_SPAN],
    rate: secondsRate(JUMP_SPAN, () => DIALS.paceJumpSeconds.value),
    ceiling: true,
    floor: true,
    fastForward: false,
  },
]

const ROW_BY_ID = new Map<PaceRowId, PaceRow>(PACE_ROWS.map((row) => [row.id, row]))

export function paceRow(id: PaceRowId): PaceRow {
  const row = ROW_BY_ID.get(id)
  if (!row) throw new Error(`pace-table: no row ${id}`)
  return row
}

/**
 * Every span of every row, flattened and sorted — the structure the lookups below
 * walk, and the one the invariants are proved against. Built once: the SPANS are
 * static (they are the timelines' own numbers), and only the rates are live.
 */
const SPANS: readonly { span: PaceSpan; row: PaceRow }[] = PACE_ROWS.flatMap((row) =>
  row.spans.map((span) => ({ span, row }))
).sort((a, b) => a.span[0] - b.span[0])

/**
 * The row governing this progress, with the span it is inside — or null where the
 * table deliberately says nothing.
 *
 * The gaps are real and each is argued at its row: the checkpoint's reading tail
 * beyond `PANEL_END` is covered by travel, the brink is left free, and everything
 * past `GIRL_TRANSFER` (the desk, the pull-back) is a camera move with a legible
 * frame at every point.
 */
export function paceRowAt(progress: number): { row: PaceRow; span: PaceSpan } | null {
  for (const entry of SPANS) {
    if (progress >= entry.span[0] && progress < entry.span[1]) return entry
  }
  return null
}

/**
 * The forward speed limit at a progress position, in progress per second.
 * `Infinity` means direct — scroll is 1:1 and nothing is shaped.
 *
 * Reduced motion lifts every ceiling, exactly as Task 109's `paceCapAt` did: the
 * cap degrades to the behaviour that predates the governor. The FLOORS do not
 * degrade that way and must not — see beat-carry's header — which is why the two
 * mechanisms ask this table separate questions.
 */
export function ceilingAt(progress: number, reducedMotion = false): number {
  if (reducedMotion) return Infinity
  const found = paceRowAt(progress)
  return found === null || !found.row.ceiling ? Infinity : found.row.rate()
}

/** The end of the span the reader is inside, or null — the fast-forward's stop line. */
export function spanEndAt(progress: number): number | null {
  return paceRowAt(progress)?.span[1] ?? null
}

/** Every span boundary a forward step may not cross ungoverned. See `governedEntryBetween`. */
export const CEILING_ENTRIES: readonly number[] = SPANS.filter((e) => e.row.ceiling)
  .map((e) => e.span[0])
  .sort((a, b) => a - b)

/**
 * The whole table's authored traversal time, in seconds — the number the Task 126
 * stopwatch is measured against, and the one that CHANGES when a dial moves.
 *
 * It is the sum over every ceilinged span of the seconds that span takes at its
 * row's rate: the fastest any input pattern may carry a reader from the first frame
 * to the last. Uncapped spans contribute nothing, which is correct — they are the
 * places the reader is allowed to be quick.
 */
export function authoredTotalSeconds(): number {
  return PACE_ROWS.filter((row) => row.ceiling).reduce(
    (sum, row) => sum + totalSecondsFor(row),
    0
  )
}
