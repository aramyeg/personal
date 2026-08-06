/**
 * THE INFO PAGE'S CLOCK — one timeline, in milliseconds, for the whole four-beat page.
 *
 * ============================================================================
 * WHY MILLISECONDS AND NOT THE ENTRANCE CLOCK
 * ============================================================================
 * The research spec is written in time — a 200ms empty-panel pause, a ~700ms
 * count-up, marks planted one per 60ms, a 300ms burst — because those durations
 * are what the empirical results are about. The spread's `enter` clock is a 0→1
 * ramp whose real duration depends on the arrival, so mapping "700ms" onto it
 * would be a guess that changes with the scroll.
 *
 * So the page runs its own reveal clock, exactly as `manga-page.tsx` already does
 * for the printed page beside it, released once the leaf has essentially arrived.
 * Same pattern, same reason.
 *
 * ============================================================================
 * STAGING: ONE IDEA AT A TIME
 * ============================================================================
 * The windows below never overlap in a way that puts two claims in flight at
 * once. A beat is not finished until its own number has landed, and the next beat
 * does not begin inking until it has. That is the research's "staging" rule and it
 * is also just how a page is read.
 *
 * PROGRESSIVE DRAWING is the reveal everywhere on this page — borders and figures
 * stroke themselves on in reading order rather than fading up. It is the strongest
 * empirical result in the set: better retention AND lower mental load than a
 * static or fading presentation. `inkOf` is what every border consumes.
 */

/** A window in ms: [start, end]. */
export type Window = readonly [number, number]

/** 0→1 across a window, clamped. The raw ramp; easing is the caller's business. */
export function phase(t: number, [a, b]: Window): number {
  if (b <= a) return t >= b ? 1 : 0
  const v = (t - a) / (b - a)
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Ease-out cubic — the count-up's curve, and the settle of most things here. */
export const easeOut = (v: number): number => 1 - Math.pow(1 - v, 3)

/**
 * A border's ink progress. Deliberately NOT eased: a pen drawn at a constant rate
 * is what a hand does, and easing the stroke makes it read as a wipe.
 */
export const inkOf = (t: number, w: Window): number => phase(t, w)

// ── the timeline ────────────────────────────────────────────────────────────────
//
// Four beats. Each inks its frame, fills, and hands over. The whole page is done in
// a little under four seconds — long enough that the hero lands as an event, short
// enough that a reader who scrolled here on purpose is not kept waiting.

/** KI — the donated story panel. */
export const KI_INK: Window = [0, 420]
export const KI_ART: Window = [180, 760]

/** SHO — the tighter crop, and its supporting note. */
export const SHO_INK: Window = [620, 1010]
export const SHO_ART: Window = [800, 1320]
export const SHO_NOTE: Window = [1180, 1480]

/** TEN — the hero. Its frame inks, and then the panel sits EMPTY for a beat. */
export const TEN_INK: Window = [1340, 1800]
/**
 * THE PAUSE. 200ms of drawn, empty panel before anything arrives in it.
 *
 * This is the "delayed earned reveal" and it is the single most load-bearing gap on
 * the page: a number that appears at the same moment as its frame is a label, and a
 * number that arrives into a frame the eye has already accepted is an event.
 */
export const TEN_PAUSE = 200
/** The count-up: 0 → value. */
export const TEN_NUMBER: Window = [TEN_INK[1] + TEN_PAUSE, TEN_INK[1] + TEN_PAUSE + 700]
/** The unit lands after the digits have stopped — its own small beat. */
export const TEN_SUFFIX: Window = [TEN_NUMBER[1], TEN_NUMBER[1] + 150]
/** One pink radial burst at the impact, gone in 300ms. */
export const TEN_BURST: Window = [TEN_NUMBER[1] - 40, TEN_NUMBER[1] + 300]
/** Speed lines rake in just before the number does, aiming the eye at the empty frame. */
export const TEN_SPEED: Window = [TEN_INK[1], TEN_NUMBER[0] + 220]

/** How long one Isotype mark takes to plant, and the gap between them. */
export const MARK_STEP = 60
export const MARK_SPAN = 170

/** KETSU — quiet: her line, the colophon, the stack as an aside. */
export const KETSU_INK: Window = [TEN_BURST[1] - 40, TEN_BURST[1] + 380]
export const KETSU_LINE: Window = [TEN_BURST[1] + 120, TEN_BURST[1] + 900]
export const KETSU_TAIL: Window = [TEN_BURST[1] + 700, TEN_BURST[1] + 1050]

/** Past this the page is finished and the clock stops being scheduled. */
export const PAGE_DONE = KETSU_TAIL[1] + 120

/**
 * When mark `i` of `count` is fully planted.
 *
 * The whole row takes the count-up's window however many marks there are, so
 * thirteen do not run four times as long as four — but a mark is never faster than
 * `MARK_STEP`, because the point of planting them one at a time is that the eye
 * can see it happen.
 */
export function markWindow(i: number, count: number): Window {
  const total = TEN_NUMBER[1] - TEN_NUMBER[0]
  const step = count > 1 ? Math.max(MARK_STEP, total / count) : 0
  const start = TEN_NUMBER[0] + i * step
  return [start, start + MARK_SPAN]
}

/** When the last mark lands — the burst waits for it. */
export const marksEnd = (count: number): number => markWindow(count - 1, count)[1]

/**
 * How many words a caption may carry.
 *
 * The research's text guard, as a number so a test can hold it: a panel whose
 * meaning needs a sentence is the wrong panel, and the fix is to redraw it rather
 * than to write more.
 */
export const MAX_CAPTION_WORDS = 12
/** ...and a NOTE or a label is a phrase, not a caption. */
export const MAX_NOTE_WORDS = 3
