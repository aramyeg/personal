/**
 * THE OPEN BOOK — the geometry of the two-page spread, in ONE place.
 *
 * The chapter stop is an open manga book with the little world in its gutter:
 * her story page on the left, the page about her work on the right, and the
 * clay world, the girl and the checkpoint mascots between and around them.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS AT ALL
 * ============================================================================
 * The page geometry has TWO consumers that must agree exactly:
 *
 *   1. `overlay/chapter-panels.tsx` — the CSS that lays the pages out.
 *   2. `scene/props/peeker-stage.ts` — the staging model that decides where a
 *      checkpoint mascot can stand and how big it can be, by keeping it clear
 *      of those same boxes.
 *
 * They used to agree by transcription, and they drifted. Task 73 grew the art
 * card from 300px to 420px and moved it from 34vh to 50vh; the staging model
 * was never told. Measured at the five desktop frames in the suite, the shipped
 * art card covered **47%–61% of the left mascot's own box** — the model was
 * placing a character in a band it believed was empty and the page had in fact
 * been drawn over since T73. That is exactly the defect Aram reported ("the
 * cards cover the mascot animals — defeats the whole purpose"), and it was a
 * stale constant rather than a design mistake.
 *
 * So the numbers live here, once, and both consumers import them. A drift of
 * this kind is now a compile-time impossibility rather than a review question.
 *
 * ============================================================================
 * WHY THESE NUMBERS — THE PAGE YIELDS, NEVER THE MASCOT
 * ============================================================================
 * Aram's rule for the redesign is that if a page and a mascot cannot both fit,
 * the PAGE gives way. So the size is not a taste call; it is the largest page
 * that still leaves a real character in both bottom corners at every desktop
 * frame in the suite, found by sweeping candidate geometries through
 * `peekerAnchor` itself (`bench/task75-book.mjs`, and the gate in
 * `book-staging.test.ts` re-derives the outcome rather than trusting the sweep).
 *
 * What the sweep found, and it is the whole reason the book sits high:
 *
 *   - Two pages the size of today's art card (420px) leave NO character at any
 *     desktop frame — both corners fall back to dressing-only. Truthfully
 *     modelled, today's layout has no room for the mascots it is showing.
 *   - The binding constraint is the page's HEIGHT and its CENTRE, not its
 *     width. Holding the book higher hands the whole bottom band to the
 *     mascots, which is also the better composition: an open book held up, with
 *     the creatures leaning in along the bottom edge.
 *
 * The chosen point on that front costs the page 10% of its width against T73's
 * card and buys a 0.333 half-height character — 73% of the rig's own cap, where
 * today's honest answer is "none".
 *
 * A page is 2:3 like the printed pages it is bound with, and BOTH pages are the
 * same size: they are two leaves of one book, and a spread whose leaves differ
 * reads as two cards again.
 */

/** Page width: `min(PAGE_VW · vw, PAGE_MAX_PX, PAGE_VH · vh)`. */
export const PAGE_VW = 0.28
export const PAGE_MAX_PX = 380
export const PAGE_VH = 0.42

/** A page is 2:3, the aspect of the printed pages. */
export const PAGE_ASPECT = 1.5

/**
 * The fraction of the viewport height the book's leaves are CENTRED on.
 *
 * High, and that is the load-bearing number: at 0.5 the pages reach 607px down a
 * 900px frame and the corners hold dressing only. At 0.36 the same page leaves a
 * 293px band along the bottom, which is what a 0.333hh mascot needs.
 */
export const PAGE_CENTRE_VH = 0.36

/** Horizontal inset of each leaf from its own frame edge: `min(PAGE_INSET_VW · vw, PAGE_INSET_MAX)`. */
export const PAGE_INSET_VW = 0.04
export const PAGE_INSET_MAX = 48

/**
 * The splay. Leaves of an open book do not lie square to the frame, and the two
 * tilts are deliberately unequal — a mirrored pair reads as a diagram.
 */
export const PAGE_TILT_LEFT_DEG = -3
export const PAGE_TILT_RIGHT_DEG = 2

/** Below this viewport width the spread becomes the phone's stack (see chapter-panels). */
export const BOOK_MOBILE_MAX = 900

/** A page's laid-out width in CSS pixels at a viewport. */
export function pageWidth(viewport: { width: number; height: number }): number {
  return Math.min(PAGE_VW * viewport.width, PAGE_MAX_PX, PAGE_VH * viewport.height)
}

/** The CSS `width` expression both leaves use, so the stylesheet and the model cannot disagree. */
export const PAGE_WIDTH_CSS = `min(${PAGE_VW * 100}vw, ${PAGE_MAX_PX}px, ${PAGE_VH * 100}vh)`
/** ...and the inset expression. */
export const PAGE_INSET_CSS = `min(${PAGE_INSET_VW * 100}vw, ${PAGE_INSET_MAX}px)`
