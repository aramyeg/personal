/**
 * THE LEADING EDGE — how anything on the info leaf is allowed to arrive.
 *
 * ============================================================================
 * ONE LAW, BECAUSE THE PAGE HAD TWO AND ONLY ONE OF THEM WAS SAFE
 * ============================================================================
 * Task 82 wrote the law for the sheet, in `cloth-drag.tsx`'s own words: the text
 * "is never clipped to the sweep — the leading edge carries a SOFT MASK that
 * fades words ahead of the paper toward `AHEAD_ALPHA`; it dims, it never
 * removes." That is guarantee 2 of three, and it holds.
 *
 * The ART was left on the other kind. `Spot` and `AnchorCrop` wiped in with
 * `clip-path: inset(0 N% 0 0)`, which does remove: at N = 93 the panel is a
 * blank white box with two pixels of photograph down its left edge. The blind
 * audit parked at y = 6600, held for eight seconds, and re-measured it
 * unchanged. Swept here across all six chapters at nine positions each, the
 * state is reachable in EVERY chapter, at local 0.25 — the first position after
 * the card comes up — and it is permanent, because the page's clock is pure
 * scroll and a reader who stops scrolling stops the clock.
 *
 * ============================================================================
 * WHY THE WINDOW CANNOT SIMPLY BE MOVED EARLIER
 * ============================================================================
 * The obvious repair is the one Task 82 already made: close the window before
 * the position a fling snaps to. That inequality HOLDS — `PAGE_SPAN_END` is
 * 0.43 and `DWELL_MID` is 0.49 — and the defect is there anyway, so the
 * inequality was never the whole law.
 *
 * What it missed is that a reader does not only rest where a fling snaps. The
 * card's entrance rides the arrival WALL CLOCK and therefore always completes;
 * the page's ink rides SCROLL and completes only if the reader keeps scrolling.
 * Between `PAGE_SPAN_START` (= `TRAVEL_END`, where the card starts arriving)
 * and `PAGE_SPAN_END` there is 0.19 of a chapter — about 450px — in which the
 * card is settled, legible and asking to be read while its own art is part
 * drawn. No inequality on the span can close that gap, because the span STARTS
 * where the card does. The two honest resolutions are to drive the art from the
 * entrance clock — forbidden at the `InfoLeaf` boundary, where `page` "may only
 * ever be a function of scroll" — or to stop hiding content. This is the
 * second, and it is the law the sheet beside it has been keeping all along.
 *
 * ============================================================================
 * WHAT A READER SEES NOW, AT THE WORST POSITION
 * ============================================================================
 * The whole picture, at `AHEAD_ALPHA` on white paper, with a hard-ish edge
 * sweeping across it as they scroll. Not a blank box with a stamp floating in
 * it. The wipe still reads as the panel being filled in — it is the same
 * gradient, travelling the same way, at the same time — it simply has a floor.
 */

/**
 * How far ahead of the edge a thing is dimmed to. IT NEVER REACHES ZERO, and
 * that single fact is the whole law.
 *
 * The value is Task 82's, carried over rather than re-picked: the sheet's words
 * have been arriving at 0.42 since then and the round captured it. Sharing it
 * is the point — an art wipe that faded to its own number would be a second law
 * that agreed with the first only until someone tuned one of them.
 */
export const AHEAD_ALPHA = 0.42

/** The feather's width, as a percentage of the band. Short: it is an edge, not a fade. */
export const FEATHER = 9

/**
 * The mask a leading-edge reveal wears at progress `p` (0→1), or `undefined`
 * once it is open.
 *
 * `undefined` at the end is not an optimisation detail, it is correctness: a
 * mask is a compositing layer, and the settled page is the one that has to be
 * crisp.
 */
export function leadingEdgeMask(p: number): string | undefined {
  if (p >= 1) return undefined
  const edge = Math.max(0, Math.min(1, p)) * 100
  const ahead = `rgba(0,0,0,${AHEAD_ALPHA})`
  return `linear-gradient(to right, #000 0%, #000 ${edge}%, ${ahead} ${Math.min(
    100,
    edge + FEATHER
  )}%, ${ahead} 100%)`
}

/**
 * The minimum share of a reveal that is VISIBLE at any progress — what a gate
 * asserts instead of eyeballing a screenshot.
 *
 * A clip returns 0 here at p = 0, which is exactly what made the blank panel
 * possible; a leading edge returns `AHEAD_ALPHA`. The e2e sweeps every parked
 * position where a card is up and asserts nothing on the leaf falls below it.
 */
export const MIN_VISIBLE_ALPHA = AHEAD_ALPHA
