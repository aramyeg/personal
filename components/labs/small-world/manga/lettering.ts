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
import type { Balloon, MangaPage } from './types'

const AVG_GLYPH = 0.52
const LINE_STEP = 1.18

/** Never smaller than this, or the lettering stops reading as lettering. */
export const MIN_FONT_CQW = 2.15
/** Never larger than this, or a three-word line looks shouted. */
export const MAX_FONT_CQW = 4.2

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
