/**
 * The page's own reveal clock: panels ink one at a time, and each line of
 * lettering types itself a beat after the panel it is spoken in has landed.
 *
 * WHY THIS IS NOT THE ARRIVAL CLOCK. The spread's entrance rides `enter`, which
 * comes from the reveal clock in `arrival.ts` — and that clock is 1.05s long,
 * of which the cards own 0.78 (`CARD_PHASE_START`→1), about 820ms. A page draws
 * four panels and then types up to three lines; asking 820ms to carry that
 * would put the panels 200ms apart and leave the words no room at all. So the
 * card SLIDES IN on the arrival clock, and the page INKS on this one, which
 * starts when the card mounts and runs about 2.6s.
 *
 * Adding a second wall clock is a real cost, so the bounds are worth stating:
 * it drives screen-space opacity, a clip-path and a substring length — no
 * geometry, no scroll coupling, nothing baked. It is reset by unmount, which is
 * also how a departing checkpoint disposes of it. Under prefers-reduced-motion
 * the whole thing is skipped and the page renders finished (`FINISHED`).
 *
 * Everything here is a pure function of elapsed milliseconds so the staging can
 * be asserted in a unit test without a browser or a timer.
 */

/** Gap between one panel starting to ink and the next. */
export const PANEL_STAGGER_MS = 300
/** How long a single panel takes to ink in. */
export const PANEL_INK_MS = 420
/** The beat between a panel landing and its first word appearing. */
export const TEXT_BEAT_MS = 170
/** Typing speed, and a floor so a two-word line still reads as typed. */
export const MS_PER_CHAR = 26
export const MIN_TYPE_MS = 380

/** An elapsed value that is past the end of any page's reveal. */
export const FINISHED = 1e6

/** 0→1 ink progress for panel `index`. */
export function panelInk(index: number, elapsedMs: number): number {
  const start = index * PANEL_STAGGER_MS
  return clamp01((elapsedMs - start) / PANEL_INK_MS)
}

/** When the lettering inside panel `index` starts appearing. */
export function textStartMs(panelIndex: number): number {
  return panelIndex * PANEL_STAGGER_MS + PANEL_INK_MS + TEXT_BEAT_MS
}

/**
 * How many characters of `text` are visible.
 *
 * Rounded DOWN so a line never shows a partial glyph, and driven by length
 * rather than a fixed duration so a long line does not sprint.
 */
export function typedLength(text: string, panelIndex: number, elapsedMs: number): number {
  const duration = Math.max(MIN_TYPE_MS, text.length * MS_PER_CHAR)
  const t = clamp01((elapsedMs - textStartMs(panelIndex)) / duration)
  return Math.floor(t * text.length)
}

/** Total time from mount to the last character of a page with `panelCount` panels. */
export function pageRevealMs(panelCount: number, longestLine: number): number {
  return textStartMs(panelCount - 1) + Math.max(MIN_TYPE_MS, longestLine * MS_PER_CHAR)
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
