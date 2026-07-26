import { describe, expect, it } from 'vitest'
import {
  CAMERA_FOV,
  CAMERA_LOOKAT,
  CAMERA_POSITION,
} from '@/components/labs/storybook/book/book-scene'
import {
  liftFlapDoorQuad,
  liftFlapMax,
  liftFlapOpenAngle,
} from '@/components/labs/storybook/book/popup-liftflap'
import type { LiftFlapGeom, PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { CHAPTERS } from '@/components/labs/storybook/content'

/**
 * SPREAD 2 KEY-BOARD — the "does it read at 1x" gates (E3 wave-2, findings
 * S2-1 and S2-2).
 *
 * A blind first-time reader of this spread reported the chapter's one playable
 * as "a brown smudge with yellow dots" (~110x95 px, 10px digits) and its lifted
 * leaves as carrying numerals "rotated 180deg". Neither was a paint problem
 * and neither was a uv problem:
 *
 *   * the board was simply too small, AND its art canvas aspect did not match
 *     the aspect the quad renders at, so every glyph was stretched sideways;
 *   * a leaf at the family's default 95deg ceiling stands 9deg off EDGE-ON to
 *     this book's pinned reading camera and renders as a sliver.
 *
 * Both are measurable from constants the book already ships, so they are gated
 * from those constants rather than from a screenshot: the camera comes from
 * book-scene.tsx, the geometry from content.ts, and the art canvas sizes from
 * the bake registry mirrored below. Nothing here is eyeballed.
 */

const VIEWPORT = { w: 1600, h: 900 } // the blind-review viewport

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3): Vec3 => {
  const m = Math.hypot(a[0], a[1], a[2])
  return [a[0] / m, a[1] / m, a[2] / m]
}

/** The pinned reading camera's basis, built exactly as three's lookAt does. */
const camZ = norm(sub(CAMERA_POSITION, CAMERA_LOOKAT)) // points BACK from the target
const camX = norm(cross([0, 1, 0], camZ))
const camY = cross(camZ, camX)
/** Half-height of the frustum at unit depth -> px per unit of (offset / depth). */
const PX_PER_TAN = VIEWPORT.h / 2 / Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)

/** World point -> screen px (x right, y down), the shipped perspective. */
function project(p: Vec3): [number, number] {
  const r = sub(p, CAMERA_POSITION)
  const depth = -dot(r, camZ)
  return [(dot(r, camX) / depth) * PX_PER_TAN, (-dot(r, camY) / depth) * PX_PER_TAN]
}

/** Signed screen area of a quad, in px^2. */
function screenArea(q: PanelQuad): number {
  const p = q.map(project)
  let a = 0
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = p[i]
    const [x1, y1] = p[(i + 1) % 4]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}

const BOARD = CHAPTERS.find((c) => c.spread === 2)!.layers.find(
  (l) => l.id === 'ch1-keyboard'
) as unknown as LiftFlapGeom

// The bake registry's canvases for this piece (scripts/storybook/generate-art.mjs
// PIECES: ch1-keyboard-board 512x552, ch1-keyboard-door<N> 512x155) and the
// painter constants the door plate is laid out from (keyboardDoor: the brass
// plate is prx = 0.108w by pry = 0.41h about the centre, and the numeral's cap
// height is 1.32 * pry).
const BOARD_ART = { w: 512, h: 552 }
const DOOR_ART = { w: 512, h: 155 }
const PLATE_RY_FRAC = 0.41
const CAP_OF_PRY = 1.32

// The flat-open reading pose: both pages down, spine dihedral ~180deg.
const FLAT: [number, number] = [Math.PI, 0]

/** Screen px per world unit along the page-fore axis d and the spine axis z,
 *  measured at the board's own centre (perspective is position-dependent). */
function pageScales(): { d: number; z: number } {
  const dMid = (BOARD.boardD0 + BOARD.boardD1) / 2
  const zMid = (BOARD.boardZ0 + BOARD.boardZ1) / 2
  const e = 1e-3
  const at = (d: number, z: number): [number, number] => project([d, 0, z])
  const [x1] = at(dMid + e, zMid)
  const [x0] = at(dMid - e, zMid)
  const [, y1] = at(dMid, zMid + e)
  const [, y0] = at(dMid, zMid - e)
  return { d: Math.abs(x1 - x0) / (2 * e), z: Math.abs(y1 - y0) / (2 * e) }
}

describe('s2 key-board — the playable reads at 1x (S2-1)', () => {
  it('the camera basis is the shipped pinned reading camera', () => {
    // Guards the derivation itself: if the book's camera moves, every number
    // below moves with it and this test says so out loud rather than silently
    // measuring a stale frame.
    expect(CAMERA_POSITION).toEqual([0, 1.85, 3.05])
    expect(CAMERA_LOOKAT).toEqual([0, 0.38, 0.05])
    expect(CAMERA_FOV).toBe(34)
    const s = pageScales()
    // d runs across the page (unforeshortened); z runs away from the reader at
    // a ~27deg reading angle, so it renders about half as long per world unit.
    expect(s.d).toBeGreaterThan(400)
    expect(s.z / s.d).toBeGreaterThan(0.45)
    expect(s.z / s.d).toBeLessThan(0.65)
  })

  it('the whole board is at least 140 x 140 screen px', () => {
    // The blind reader measured 97 x 110 px and could not identify the piece
    // without a 3x zoom capture. This is the spread's ONE playable.
    const s = pageScales()
    const wPx = (BOARD.boardD1 - BOARD.boardD0) * s.d
    const hPx = (BOARD.boardZ1 - BOARD.boardZ0) * s.z
    expect(wPx, `board width ${wPx.toFixed(1)}px`).toBeGreaterThanOrEqual(140)
    expect(hPx, `board height ${hPx.toFixed(1)}px`).toBeGreaterThanOrEqual(140)
  })

  it('every door leaf is at least 100 x 30 screen px, and they never overlap in z', () => {
    const s = pageScales()
    expect(BOARD.leafLen * s.d).toBeGreaterThanOrEqual(100)
    const sorted = [...BOARD.doors].sort((a, b) => a.z0 - b.z0)
    for (const door of sorted) {
      expect(Math.abs(door.z1 - door.z0) * s.z, `door ${door.plate}`).toBeGreaterThanOrEqual(30)
    }
    for (let i = 0; i + 1 < sorted.length; i++) expect(sorted[i + 1].z0).toBeGreaterThan(sorted[i].z1)
  })

  it('the door NUMERAL clears a 16px cap height on screen', () => {
    // Derived from the painter, not from the picture: the plate is 0.41h about
    // the door's centre and the engraved cap is 1.32 * that half-height, so the
    // cap occupies CAP_OF_PRY * PLATE_RY_FRAC of the art canvas height, which
    // maps to the door's z extent.
    const s = pageScales()
    const doorH = Math.abs(BOARD.doors[0].z1 - BOARD.doors[0].z0)
    const capPx = CAP_OF_PRY * PLATE_RY_FRAC * doorH * s.z
    expect(capPx, `numeral cap height ${capPx.toFixed(1)}px`).toBeGreaterThanOrEqual(16)
  })

  it('the art canvases match the pieces SCREEN aspect, so no glyph is stretched', () => {
    // The defect nobody had named: a 512x272 door plate on a 71x21 px quad
    // stretched every glyph 2.4x sideways. A page-flat piece must be authored
    // at the aspect it RENDERS at, which is its world aspect times the camera's
    // per-axis scale — not its world aspect.
    const s = pageScales()
    const check = (label: string, dSpan: number, zSpan: number, art: { w: number; h: number }) => {
      const screenAspect = (dSpan * s.d) / (zSpan * s.z)
      const artAspect = art.w / art.h
      const ratio = artAspect / screenAspect
      expect(ratio, `${label}: art ${artAspect.toFixed(2)}:1 vs screen ${screenAspect.toFixed(2)}:1`)
        .toBeGreaterThan(0.9)
      expect(ratio).toBeLessThan(1.1)
    }
    check('board', BOARD.boardD1 - BOARD.boardD0, BOARD.boardZ1 - BOARD.boardZ0, BOARD_ART)
    check(
      'door',
      BOARD.leafLen,
      Math.abs(BOARD.doors[0].z1 - BOARD.doors[0].z0),
      DOOR_ART
    )
  })
})

describe('s2 key-board — a lifted leaf still shows the reader a door (S2-2)', () => {
  it('the door art never inverts: its up-axis projects screen-UP at every lift', () => {
    // The reader called the lifted numerals "rotated 180deg". This pins the one
    // thing that WOULD be a true inversion — the art's own vertical axis.
    // flatUvs maps image-y to +z, so the glyph's up is -z; if a future uv or
    // winding change flipped that, every number really would stand on its head.
    // (It does not depend on the lift angle, which is exactly the point: the
    // apparent rotation comes from the leaf's LONG axis swinging, not from v.)
    const max = liftFlapMax(BOARD)
    for (let k = 0; k <= 12; k++) {
      const a = (max * k) / 12
      const q = liftFlapDoorQuad(BOARD, 1, a, ...FLAT)
      // corners [bl, br, tr, tl] = (hinge,z0), (hinge,z1), (free,z1), (free,z0)
      const [pBL] = [project(q[0])]
      const pBR = project(q[1])
      const upScreenY = pBL[1] - pBR[1] // from image-bottom (z1) to image-top (z0)
      expect(upScreenY, `lift ${((a * 180) / Math.PI).toFixed(0)}deg`).toBeLessThan(0)
    }
  })

  it('at the ceiling a leaf still presents at least 55% of its shut screen area', () => {
    // THE actual S2-2 defect. At the family default of 95deg this piece scored
    // 0.17 — a ~7px-wide sliver with no face, no number and no ring, which is
    // what a reader was trying to describe.
    const shut = screenArea(liftFlapDoorQuad(BOARD, 1, 0, ...FLAT))
    const open = screenArea(liftFlapDoorQuad(BOARD, 1, liftFlapMax(BOARD), ...FLAT))
    expect(shut).toBeGreaterThan(2000)
    expect(open / shut, `open/shut screen area ${(open / shut).toFixed(3)}`).toBeGreaterThanOrEqual(
      0.55
    )
  })

  it('the ceiling still uncovers the niche art the reveal lives in', () => {
    // Capping the lift may not buy the face back by hiding the payoff: the key
    // art sits in the aperture's fore half (bench L6), so the leaf at the
    // ceiling must cover less than half the leaf length from the hinge.
    const covered = Math.cos(liftFlapMax(BOARD))
    expect(covered).toBeLessThan(0.5)
    expect(Math.cos(liftFlapOpenAngle(BOARD))).toBeLessThan(0.85)
    expect(liftFlapOpenAngle(BOARD)).toBeLessThan(liftFlapMax(BOARD))
  })

  it('a leaf grows monotonically off the page as the reader lifts it', () => {
    // No fold-back: the standing height must rise all the way to the ceiling,
    // so the ceiling is a stop the reader arrives at, not a peak they pass.
    let prev = -Infinity
    const max = liftFlapMax(BOARD)
    for (let k = 0; k <= 16; k++) {
      const q = liftFlapDoorQuad(BOARD, 1, (max * k) / 16, ...FLAT)
      const top = Math.max(...q.map((p) => p[1]))
      expect(top).toBeGreaterThan(prev)
      prev = top
    }
  })
})
