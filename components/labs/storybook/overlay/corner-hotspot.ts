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
 * positions its hotspot buttons from these very numbers) and the hit test, so
 * the two cannot drift; `__tests__/labs/storybook/corner-hotspot.test.ts` pins
 * them against the projection they were derived from.
 *
 * SP-3(b), THE CLAMP (blind re-review of spread 3): "the RIGHT corner floats
 * over black void." The old rects were anchored to the VIEWPORT's bottom
 * corners — 18vw x 22vh out of (0,vh) and (vw,vh) — but the open spread does
 * not reach either one. Projected through the reading camera (book/
 * reading-stage.ts) at the rest dihedral, the paper's own bottom-outer corner
 * lands around (0.87vw, 0.78vh); everything outside that is desk. So the
 * reader was being handed a page turn for a click on empty wood, and the
 * dog-ear that advertises it was drawn on wood too — a corner that reads as
 * nothing promising something.
 *
 * The box below is therefore the largest rect that lies ON THE PAPER at every
 * open spread (1..INTERIOR_SHEETS), pushed as far into the page's bottom-outer
 * corner as the paper allows. Two things make it smaller than the naive
 * "corner of the page": the fore edge leans inward as it climbs, so a taller
 * box must retreat from it; and the near edge swings ~50px in screen y across
 * the bulge model's spreads (page-geometry.ts `restAngles` — the stacks trade
 * thickness side to side as you read), so a static box has to clear the
 * HIGHEST of those edges. The numbers are held as constants, not recomputed at
 * runtime, because the projection needs the camera basis and the page's world
 * pose — three modules the overlay has no business importing; the test
 * re-derives them from reading-stage + page-geometry + book and fails if the
 * box ever drifts off the paper (the house "derived boxes, never eyeballed"
 * rule).
 *
 * The fractions are measured at reading-stage's REFERENCE_VIEW, like every
 * other screen-px claim in this lab, and they fail SAFE elsewhere: the camera
 * fov is vertical, so a narrower viewport spreads the same page over MORE of
 * the screen width and the box only ends up further inside the paper — never
 * back out over the desk.
 */

import type { TurnDir } from '../store'

/** Hotspot width as a percentage of the viewport width. */
export const CORNER_W_PCT = 18
/** Hotspot height as a percentage of the viewport height. */
export const CORNER_H_PCT = 8
/** Gap between the viewport's own left/right edge and the hotspot's OUTER
 *  edge, as a percentage of viewport width — the desk the page never covers. */
export const CORNER_SIDE_PCT = 18
/** Gap between the viewport's bottom edge and the hotspot's bottom edge, as a
 *  percentage of viewport height — the desk under the page's near edge. */
export const CORNER_BOTTOM_PCT = 22

/** A tap is a press that stayed still: a drag through a corner is a drag. */
export const CORNER_TAP_MAX_PX = 12
export const CORNER_TAP_MAX_MS = 700

/**
 * Which page turn the point (x, y) sits on, in a viewport of `vw` x `vh` — or
 * null anywhere else. Left corner turns back, right corner turns on, matching
 * the arrows a few pixels away. A point in the viewport's own bottom corner is
 * now null: that is desk, not paper (see the clamp note in the header).
 */
export function cornerTurnAt(x: number, y: number, vw: number, vh: number): TurnDir | null {
  const w = (CORNER_W_PCT / 100) * vw
  const h = (CORNER_H_PCT / 100) * vh
  const side = (CORNER_SIDE_PCT / 100) * vw
  const bottom = (CORNER_BOTTOM_PCT / 100) * vh
  if (y < vh - bottom - h || y > vh - bottom) return null
  if (x >= side && x <= side + w) return 'prev'
  if (x >= vw - side - w && x <= vw - side) return 'next'
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
