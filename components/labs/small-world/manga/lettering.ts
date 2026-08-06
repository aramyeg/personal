/**
 * How big to set a line so it fills its balloon without touching the ink.
 *
 * The manifest gives each line the blank interior it may use, as fractions of
 * the page. The card, the lightbox and the phone all show that same page at
 * different pixel sizes, so the answer has to be a RATIO, not a pixel value —
 * everything here is in `cqw`, percent of the page's own width, which is what
 * the page element establishes as its container.
 *
 * The fit is an area estimate rather than a measurement. A real measurement
 * would mean laying the text out, reading it back and re-rendering, which is a
 * layout thrash per balloon per frame of a typing animation; the estimate is
 * one multiply, is deterministic, and is testable without a browser. Its two
 * constants are the only empirical things in this file:
 *   AVG_GLYPH — mean advance width of Nunito Sans as a fraction of font size,
 *               measured over the pack's own dialogue lines.
 *   LINE_STEP — line box as a multiple of font size.
 * Solving `chars_per_line * lines >= length` for the font size that exactly
 * fills the box area gives the square root below.
 */
import type { Balloon, MangaPage, Point } from './types'

const AVG_GLYPH = 0.52
const LINE_STEP = 1.18

/** Never smaller than this SHARE of the page, or the lettering stops reading as lettering. */
export const MIN_FONT_CQW = 2.15
/** Never larger than this, or a three-word line looks shouted. */
export const MAX_FONT_CQW = 4.2

/**
 * THE FLOOR THAT IS NOT A RATIO — and the one that actually mattered.
 *
 * Everything else in this file is proportional, which is right for a page that has to serve a
 * 444px card, a 557px lightbox and a 294px phone from one set of fractions. But a ratio has no
 * opinion about eyes. On the phone stack the page is 294px wide, and 2.15cqw of that is **6.0px** —
 * measured, not estimated. The blind review's words for the result were "unreadable, still a smear
 * magnified", and it was right: proportional fidelity had quietly become the enemy of the text
 * being text.
 *
 * So CAPTIONS are `max(MIN_TEXT_PX, <ratio>)`. Below the floor a caption stops scaling and starts
 * running an extra line instead, which is the correct trade — a caption that grows downward is
 * legible, a caption at 6px is decoration. It can make that trade because the site draws its box.
 *
 * BALLOONS CANNOT, and that asymmetry is the whole reason this is a constant and not a rule.
 * A balloon's interior is PRINTED ART: type set larger than the interior was solved for does not
 * reflow, it runs onto the ink. Measured across the seven pages, the smallest fitted balloon is
 * 6.78px on the 360 stack and 7.36px on the 390 stack, and reaching 11px there would need 2.2x the
 * interior AREA the drawing provides. So the phone card cannot legibly letter these balloons at
 * any size, and no constant in this file can change that — it is a property of the art at that
 * display size. `manga-lettering.tsx` says so at the point of use, and task-73-report.md records
 * it as a wall with the panel-at-a-time reader as the way through.
 *
 * 11px is the floor the round agreed. It is not a comfortable reading size and is not meant to be;
 * it is the size below which this lettering stops being worth drawing at all.
 */
export const MIN_TEXT_PX = 11

/** `max(11px, N cqw)` — the one expression every piece of lettering sizes itself with. */
export const cqwWithFloor = (cqw: number): string => `max(${MIN_TEXT_PX}px, ${cqw}cqw)`

/**
 * Effective px size of a `cqwWithFloor` at a given page width — what the floor actually does,
 * available to tests so the gate measures the shipped expression rather than a restatement of it.
 */
export function effectiveTextPx(cqw: number, pageWidthPx: number): number {
  return Math.max(MIN_TEXT_PX, (cqw / 100) * pageWidthPx)
}

/**
 * Font size in `cqw` for `text` inside a box of `box` page-fractions, on a page
 * whose height is `aspect` times its width (so the box's height becomes a width
 * fraction and both axes are in the same unit).
 */
export function fitFontCqw(text: string, box: { w: number; h: number }, aspect: number): number {
  const widthCqw = box.w * 100
  const heightCqw = box.h * 100 * aspect
  const length = Math.max(1, text.length)
  const ideal = Math.sqrt((widthCqw * heightCqw) / (AVG_GLYPH * LINE_STEP * length))
  return Math.min(MAX_FONT_CQW, Math.max(MIN_FONT_CQW, ideal))
}

/** A page's height as a multiple of its width. */
export const pageAspect = (page: MangaPage): number => page.size.h / page.size.w

/** Font size for one manifest balloon on its own page. */
export function balloonFontCqw(balloon: Balloon, page: MangaPage): number {
  return fitFontCqw(balloon.text, balloon.box, pageAspect(page))
}

export { LINE_STEP }

/**
 * How far outside its readable box the ink of a DRAWN balloon reaches.
 *
 * An ellipse with semi-axes (rx, ry) contains a rectangle of half-extents
 * (a, b) only when (a/rx)² + (b/ry)² ≤ 1, so a balloon that has to hold its
 * whole text box needs a margin past √2 ≈ 1.414 — not the "looks like enough"
 * 1.22 this started at, which let the corners of a two-line balloon fall
 * outside the ink.
 *
 * It lives here rather than in the component because the manifest has to
 * respect it too: a drawn balloon's ELLIPSE, not just its text box, must fit
 * inside its panel. `manga-manifest.test.ts` asserts exactly that.
 */
export const DRAWN_INK_MARGIN = 1.46

/** The full inked footprint of a drawn balloon, in page fractions. */
export function drawnInkBox(balloon: { at: Point; box: { w: number; h: number } }): {
  x: number
  y: number
  w: number
  h: number
} {
  const w = balloon.box.w * DRAWN_INK_MARGIN
  const h = balloon.box.h * DRAWN_INK_MARGIN
  return { x: balloon.at.x - w / 2, y: balloon.at.y - h / 2, w, h }
}
