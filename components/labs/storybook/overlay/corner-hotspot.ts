/**
 * THE CORNER PAGE-TURN HOTSPOTS, as GEOMETRY (E3 R-4).
 *
 * THE DEFECT (blind re-review of spread 6): "The invisible 288x198 corner
 * button (x 1312-1600, y 702-900, z-30) overlaps the stall row's last cards.
 * Press-and-drag at (1330,715) and nothing at all happens: the row won't rise
 * and the page won't turn. A dead zone sitting on top of the page's best
 * mechanism." A DOM `<button>` at z-30 over a full-screen canvas eats every
 * pointer event in its rectangle — not just the press, the MOVES too, so the
 * canvas never even raycasts there and the store's `hover` stays null. The
 * paper under that corner is unreachable and unannounced.
 *
 * THE LAW: the paper wins. The corner buttons are now pointer-events:none
 * (nav.tsx) so every pointer event reaches the canvas and the scene's own hit
 * test is the first and only arbiter; the corner turn is re-armed from the
 * book's plain-DOM input layer (use-book-input.ts) as a TAP that fires only
 * when the canvas reports nothing grabbable under the press. Two consequences,
 * both wanted: a press-drag on a piece inside the corner works like anywhere
 * else, and a drag that merely ENDS in the corner no longer turns the page
 * (the old `onClick` fired for any down+up on the same button).
 *
 * The rects here are the single source of truth for both the CSS box (nav.tsx
 * renders `18vw x 22vh` in each bottom corner) and the hit test, so the two
 * cannot drift; `__tests__/labs/storybook/corner-hotspot.test.ts` pins them.
 */

import type { TurnDir } from '../store'

/** Hotspot width as a percentage of the viewport width (nav.tsx `18vw`). */
export const CORNER_W_PCT = 18
/** Hotspot height as a percentage of the viewport height (nav.tsx `22vh`). */
export const CORNER_H_PCT = 22

/** A tap is a press that stayed still: a drag through a corner is a drag. */
export const CORNER_TAP_MAX_PX = 12
export const CORNER_TAP_MAX_MS = 700

/**
 * Which page turn the point (x, y) sits on, in a viewport of `vw` x `vh` — or
 * null anywhere else. Left corner turns back, right corner turns on, matching
 * the arrows a few pixels away.
 */
export function cornerTurnAt(x: number, y: number, vw: number, vh: number): TurnDir | null {
  const w = (CORNER_W_PCT / 100) * vw
  const h = (CORNER_H_PCT / 100) * vh
  if (y < vh - h || y > vh) return null
  if (x >= 0 && x <= w) return 'prev'
  if (x >= vw - w && x <= vw) return 'next'
  return null
}

/** Whether a press at (x0,y0,t0) released at (x1,y1,t1) counts as a corner tap
 *  rather than a drag that happened to end there. */
export function isCornerTap(
  x0: number,
  y0: number,
  t0: number,
  x1: number,
  y1: number,
  t1: number
): boolean {
  return (
    Math.abs(x1 - x0) <= CORNER_TAP_MAX_PX &&
    Math.abs(y1 - y0) <= CORNER_TAP_MAX_PX &&
    t1 - t0 <= CORNER_TAP_MAX_MS
  )
}
