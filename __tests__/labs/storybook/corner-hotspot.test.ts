import { describe, expect, it } from 'vitest'
import {
  CORNER_BOTTOM_PCT,
  CORNER_H_PCT,
  CORNER_SIDE_PCT,
  CORNER_W_PCT,
  cornerTurnAt,
  isCornerTap,
  CORNER_TAP_MAX_MS,
  CORNER_TAP_MAX_PX,
} from '@/components/labs/storybook/overlay/corner-hotspot'
import { REFERENCE_VIEW, toScreenPx } from '@/components/labs/storybook/book/reading-stage'
import {
  INTERIOR_SHEETS,
  PAGE_H,
  PAGE_W,
  restAngles,
} from '@/components/labs/storybook/book/page-geometry'
import { PAGE_SURFACE_Y } from '@/components/labs/storybook/book/book'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

// ============================================================================
// SP-3(b) — THE HOTSPOT LIVES ON THE PAPER. "On s3 the RIGHT corner floats over
// black void": the rects were anchored to the VIEWPORT's bottom corners, which
// the open spread never reaches, so a click on bare desk turned the page and
// the dog-ear advertising it was drawn on desk too.
//
// This is the drift gate for the fix. The box in corner-hotspot.ts is a set of
// constants (the overlay cannot import the camera basis and the page's world
// pose without dragging three.js into the HTML layer), so the derivation lives
// here instead: the page's rest pose from page-geometry's `restAngles`, its
// hinge height from book.tsx, and the ONE projection every screen-px gate in
// this lab shares from reading-stage. Move the camera, the page size, the
// stack thickness or the box, and these fail.
// ============================================================================

type Pt = { x: number; y: number }

/** The static page's own plane at its rest tilt: the sheet hinges on the
 *  spine (x=0) at PAGE_SURFACE_Y and climbs to its fore edge (book.tsx sets
 *  exactly this pose per frame — the mirrored left group takes -aL, which is
 *  the same lift on the -x side). */
const pagePoint = (side: 1 | -1, tilt: number, x: number, z: number): Vec3 => [
  side * x * Math.cos(tilt),
  PAGE_SURFACE_Y + x * Math.sin(tilt),
  z,
]

/** The page's four corners in ring order, in reference-viewport px:
 *  near-spine, near-fore, far-fore, far-spine. */
const pageQuad = (side: 1 | -1, tilt: number): Pt[] =>
  [
    pagePoint(side, tilt, 0, PAGE_H / 2),
    pagePoint(side, tilt, PAGE_W, PAGE_H / 2),
    pagePoint(side, tilt, PAGE_W, -PAGE_H / 2),
    pagePoint(side, tilt, 0, -PAGE_H / 2),
  ].map(toScreenPx)

/** Signed distance of `p` into the convex quad `q` (px; negative = outside). */
function insideBy(q: Pt[], p: Pt): number {
  let twiceArea = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    twiceArea += a.x * b.y - b.x * a.y
  }
  const winding = Math.sign(twiceArea)
  let worst = Infinity
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const edge = ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * winding
    worst = Math.min(worst, edge / Math.hypot(b.x - a.x, b.y - a.y))
  }
  return worst
}

/** Every open spread's left and right page, projected once. */
const SPREAD_PAGES = Array.from({ length: INTERIOR_SHEETS }, (_, i) => {
  const spread = i + 1
  const { aL, aR } = restAngles(spread)
  return { spread, left: pageQuad(-1, aL), right: pageQuad(1, aR) }
})

/** The two hotspot rects in reference-viewport px, from the shipped constants
 *  and nothing else — the same arithmetic `cornerTurnAt` and nav.tsx's inline
 *  style both run. */
function hotspotRects(sidePct = CORNER_SIDE_PCT, bottomPct = CORNER_BOTTOM_PCT) {
  const w = (CORNER_W_PCT / 100) * REFERENCE_VIEW.w
  const h = (CORNER_H_PCT / 100) * REFERENCE_VIEW.h
  const side = (sidePct / 100) * REFERENCE_VIEW.w
  const bottom = (bottomPct / 100) * REFERENCE_VIEW.h
  const y1 = REFERENCE_VIEW.h - bottom
  const y0 = y1 - h
  return {
    left: { x0: side, x1: side + w, y0, y1 },
    right: { x0: REFERENCE_VIEW.w - side - w, x1: REFERENCE_VIEW.w - side, y0, y1 },
  }
}

const cornersOf = (r: { x0: number; x1: number; y0: number; y1: number }): Pt[] => [
  { x: r.x0, y: r.y0 },
  { x: r.x1, y: r.y0 },
  { x: r.x1, y: r.y1 },
  { x: r.x0, y: r.y1 },
]

/** How far the worst corner of either rect sits inside the paper, across every
 *  open spread. Positive = the whole box is on paper in every state. */
function worstMargin(sidePct = CORNER_SIDE_PCT, bottomPct = CORNER_BOTTOM_PCT): number {
  const rects = hotspotRects(sidePct, bottomPct)
  let worst = Infinity
  for (const page of SPREAD_PAGES) {
    for (const corner of cornersOf(rects.left)) worst = Math.min(worst, insideBy(page.left, corner))
    for (const corner of cornersOf(rects.right)) {
      worst = Math.min(worst, insideBy(page.right, corner))
    }
  }
  return worst
}

describe('corner hotspots sit on the paper (SP-3 b)', () => {
  it('keeps every corner of both boxes on the page at every open spread', () => {
    expect(worstMargin()).toBeGreaterThan(0)
  })

  it('is pushed as far into the page corner as the paper allows', () => {
    // The two edges that bind it: the fore edge leans inward as it climbs (so
    // the box cannot go further out), and the near edge swings up ~50px across
    // the bulge model's spreads (so it cannot go further down). If either
    // slack ever grew, the box stopped being derived from the paper.
    expect(worstMargin(CORNER_SIDE_PCT - 1, CORNER_BOTTOM_PCT)).toBeLessThan(0)
    expect(worstMargin(CORNER_SIDE_PCT, CORNER_BOTTOM_PCT - 2)).toBeLessThan(0)
  })

  it('the box the reviewer found — the viewport corner itself — is off the paper', () => {
    // The old rect ran to (vw, vh). Nothing of the book is there.
    const screenCorner = { x: REFERENCE_VIEW.w - 1, y: REFERENCE_VIEW.h - 1 }
    for (const page of SPREAD_PAGES) {
      expect(insideBy(page.right, screenCorner)).toBeLessThan(0)
      expect(insideBy(page.left, { x: 1, y: REFERENCE_VIEW.h - 1 })).toBeLessThan(0)
    }
  })

  it('offers no turn in the viewport corners, and both turns on the paper', () => {
    const { w, h } = REFERENCE_VIEW
    // Off-paper: the desk under and beside the spread — where the old hotspot
    // handed out a page turn for free.
    expect(cornerTurnAt(w * 0.97, h * 0.97, w, h)).toBeNull()
    expect(cornerTurnAt(w * 0.03, h * 0.97, w, h)).toBeNull()
    expect(cornerTurnAt(w * 0.5, h * 0.97, w, h)).toBeNull()

    // On-paper: the middle of each derived box.
    const rects = hotspotRects()
    const mid = (r: { x0: number; x1: number; y0: number; y1: number }) => ({
      x: (r.x0 + r.x1) / 2,
      y: (r.y0 + r.y1) / 2,
    })
    expect(cornerTurnAt(mid(rects.right).x, mid(rects.right).y, w, h)).toBe('next')
    expect(cornerTurnAt(mid(rects.left).x, mid(rects.left).y, w, h)).toBe('prev')
    // …and nothing between them: the gutter is a page, not a corner.
    expect(cornerTurnAt(w / 2, mid(rects.right).y, w, h)).toBeNull()
  })

  it('still calls a still press a tap and a travelled press a drag', () => {
    expect(isCornerTap(100, 100, 0, 100 + CORNER_TAP_MAX_PX, 100, CORNER_TAP_MAX_MS)).toBe(true)
    expect(isCornerTap(100, 100, 0, 100 + CORNER_TAP_MAX_PX + 1, 100, 10)).toBe(false)
    expect(isCornerTap(100, 100, 0, 100, 100, CORNER_TAP_MAX_MS + 1)).toBe(false)
  })
})
