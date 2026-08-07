/**
 * THE INFO PAGE'S CLOCK — one timeline for the whole four-beat page, and it is
 * THE SCROLL.
 *
 * ============================================================================
 * IT USED TO BE A WALL CLOCK, AND THAT WAS THE BUG UNDER THE BUG
 * ============================================================================
 * The numbers below are still written in milliseconds because the research spec
 * is written in time — a 200ms empty-panel pause, a ~700ms count-up, marks
 * planted one per 60ms, a 300ms burst — and those durations are what the
 * empirical results are about. What changed is what feeds them: `t` is no longer
 * elapsed real time. It is `pageProgressAt(scroll) * PAGE_DONE`, so the ms are
 * now PROPORTIONS of the page's scroll span and every ratio the research fixed
 * survives untouched.
 *
 * Why it had to change. The old `useInkClock` was a `requestAnimationFrame`
 * timer started when the leaf arrived, and it broke the lab's own scroll-purity
 * law ("scroll position fully determines every visual"). It also broke something
 * concrete: a wall clock can still be mid-count while the reader has already
 * stopped and is reading, so a settled card could be caught mid-draw. The blind
 * audit blamed text-on-a-reveal for that and inverted the page; the cause was
 * the clock. With the clock scroll-pure, "the page is drawn" and "the reader has
 * arrived at this page" stop being two facts that can disagree, which is what
 * lets the words go back onto the cloth in `cloth-drag.tsx` without re-opening
 * the hole.
 *
 * Three properties fall out by construction rather than by care:
 *  - SCRUB BACK IS EXACT. `t` is a pure function evaluated at a smaller argument.
 *  - A FLICK CANNOT STRAND IT. The span closes before the story stop a fling
 *    snaps to (asserted below), so a landing is always a landing on a finished
 *    page.
 *  - REDUCED MOTION IS ONE BRANCH. `p = 1`, nothing scheduled, no frames.
 *
 * The facts themselves still do not ride this clock at all — see the inversion
 * note in `info-page.tsx`. Colophon, stack, hero value and her line render at
 * full strength from the first frame, and `t` drives only the border ink, the
 * art wipe, the stamp punch, the burst, the sheet and the runner.
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

import { CHAPTER_COUNT } from '../chapters'
import { BURST_END, DWELL_MID, DWELL_SPAN, TRAVEL_END } from '../journey-timeline'

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
// THREE beats now, not four. Each inks its frame, fills, and hands over.
//
// SHO IS GONE (Task 82). It was the "zoom-in triad": beat 1 wide, beat 2 the SAME
// art at ZOOM into its own centre, and the argument for it was that a close-up
// fuses the fact to the story with no new asset. Measured against the reading, it
// bought a duplicate: two panels of one picture, stacked, in a leaf 378px wide.
// T77's finding is the one that binds — what a reader needs stopped is the MEDIUM,
// not the camera, and a second crop of the same drawing stops neither. The unfurl
// at the story stop IS the medium-stop, so the fact surface is the sheet in
// `cloth-drag.tsx` and the picture is shown once. Beat 2's supporting NOTE was a
// real fact and it survives — it is a caption on beat 1's panel, which is what it
// always was.
//
// The windows below close the gap rather than leaving a hole where SHO used to be:
// every beat gets more of the scroll span, not the same amount with a pause in it.

/** KI — the chapter's anchor panel, and its supporting note. */
export const KI_INK: Window = [0, 420]
export const KI_ART: Window = [180, 760]
/** The note is a caption ON the picture, so it lands after the art it annotates. */
export const KI_NOTE: Window = [760, 1000]

/** TEN — the hero. Its frame inks, and then the panel sits EMPTY for a beat. */
export const TEN_INK: Window = [1040, 1500]
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
/**
 * The unit's own small beat — RETIRED BY THE INVERSION, kept as the timeline's
 * record of where it sat.
 *
 * The blind audit's law is that a fact may not be gated on watching, and a "%"
 * that arrives late is a fact arriving late: a card caught early read "+30"
 * rather than "+30%". The suffix is printed with its digits now. The window
 * stays here because `TEN_BURST` and `KETSU_TAIL` are expressed against the
 * numbers around it, and deleting it would silently move them.
 */
export const TEN_SUFFIX: Window = [TEN_NUMBER[1], TEN_NUMBER[1] + 150]
/** One pink radial burst at the impact, gone in 300ms. */
export const TEN_BURST: Window = [TEN_NUMBER[1] - 40, TEN_NUMBER[1] + 300]
/** Speed lines rake in just before the number does, aiming the eye at the empty frame. */
export const TEN_SPEED: Window = [TEN_INK[1], TEN_NUMBER[0] + 220]

/** How long one Isotype mark takes to plant, and the gap between them. */
export const MARK_STEP = 60
export const MARK_SPAN = 170

/**
 * KETSU — the sheet.
 *
 * There is no `KETSU_INK` any more: the sheet stopped being an `InkedPanel` when
 * a capture showed its own outline nested inside a drawn panel border, which is
 * two boxes and no sheet. Its unfurl IS its ink.
 */
export const KETSU_LINE: Window = [TEN_BURST[1] + 120, TEN_BURST[1] + 900]
/**
 * Where the colophon used to fade in — RETIRED BY THE INVERSION for the same
 * reason as `TEN_SUFFIX`. It is what `PAGE_DONE` is measured from, so it stays.
 */
export const KETSU_TAIL: Window = [TEN_BURST[1] + 700, TEN_BURST[1] + 1050]

/** Past this the page is finished. `pageProgressAt` maps 1 onto it. */
export const PAGE_DONE = KETSU_TAIL[1] + 120

// ── the scroll span the whole timeline above is stretched across ────────────────

/**
 * WHERE IN A CHAPTER THE PAGE DRAWS ITSELF, in the same local-chapter units
 * `journey-timeline.ts` states its own segment shape in.
 *
 * It OPENS at `TRAVEL_END` — the instant she stops and the "!" pops, which is
 * also when the leaf begins to arrive — so the page inks itself ON THE WAY IN
 * rather than starting blank once the card has landed. It CLOSES inside the
 * dwell and deliberately early: `PAGE_SPAN_END < DWELL_MID`, and `DWELL_MID` is
 * where `story-stops.ts` snaps a fling. That inequality is the whole safety
 * argument and `info-page.test.tsx` asserts it, because it is the one number
 * that could be tuned into a page a reader can land on half-drawn.
 *
 * The span is 0.19 of a chapter — about 400px of scroll at the shipped track
 * length, four wheel notches — which is long enough for four beats to read as
 * choreography and short enough that a reader who is scrolling to read is not
 * made to work for the page.
 */
export const PAGE_SPAN_START = TRAVEL_END
export const PAGE_SPAN_END = BURST_END + 0.3 * DWELL_SPAN

/**
 * The page's own progress, 0→1, at a journey position. Pure: no clock, no state,
 * no frame. This is the function the whole file exists to be driven by.
 *
 * Chapter-local, so every chapter's page draws itself over its own approach and
 * the answer does not depend on which chapter you are in.
 */
export function pageProgressAt(progress: number): number {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress
  const segLen = 1 / CHAPTER_COUNT
  const chapter = Math.min(CHAPTER_COUNT - 1, Math.floor(p / segLen))
  const local = (p - chapter * segLen) / segLen
  return phase(local, [PAGE_SPAN_START, PAGE_SPAN_END])
}

/** Guards the one inequality the page's correctness rests on. */
export const PAGE_CLOSES_BEFORE_STOP = PAGE_SPAN_END < DWELL_MID

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
/** ...and a NOTE printed on the art is a phrase, not a caption. */
export const MAX_NOTE_WORDS = 3

/**
 * A hero's LABEL gets one more word than a note does, and the difference is real
 * rather than a fudge to admit a string: a note is set small ON a picture and
 * competes with it, while a label sits directly under type four times its size
 * and has the whole width of the panel. The approved pack's "eight months of it"
 * is four short words that read as one phrase, and shortening approved copy to
 * satisfy a proxy for "phrase, not caption" would be the tail wagging the dog.
 */
export const MAX_LABEL_WORDS = 4
