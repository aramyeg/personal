/**
 * THE ONE SENTENCE ON SPREAD 6 HAS TO READ LEFT-TO-RIGHT.
 *
 * A blind reader's re-re-review: "The 'RAISE A STALL' plaque is rendered
 * rotated 180 degrees. At every stage of travel — flat, mid-raise, fully
 * raised — the label reads upside-down to the reader. The single discovery cue
 * on the page requires tilting your head to read."
 *
 * It was a QUARTER turn, not a half (bench n2-cartouche-capture.mjs measured
 * the deck band's +u axis projecting to (20,-78) px at rest and (28,-74) fully
 * raised — screen-UP — with +v projecting to (-100,-5), screen-LEFT). The lab
 * has met this failure class before on a page-flat disc; its rotation flavour
 * is what bit here, because this family's die-cut unfold puts image-x along the
 * SPINE and at the pinned reading camera the spine is screen-vertical.
 *
 * The fix lives in the painter (`bazRaiseStallFace`), which now turns the
 * signboard a quarter clockwise so its baseline runs along the page-fore axis.
 * That is a decision no screenshot can defend on its own, so this gate takes
 * the SHIPPED uvs (`tabFaceUvs`, imported, not copied), the SHIPPED pose solver
 * and the SHIPPED reading camera, and re-projects the legend's own axes at
 * every lift the reader can latch the piece in. It fails if the legend ever
 * stops running screen-rightward or ever stands on its head — including if the
 * piece is moved to the RIGHT page, where the page-fore axis reverses on screen
 * and this painting would read backwards (asserted explicitly below).
 *
 * Everything numeric comes from the painter's own contract
 * (scripts/storybook/s6-cartouche-orientation.mjs) or from the solver. Nothing
 * here is read off a screenshot.
 */

import { describe, expect, it } from 'vitest'
import {
  S6_STALL_CARTOUCHE,
  S6_STALL_TAB_ARROW,
} from '../../../scripts/storybook/s6-cartouche-orientation.mjs'
import { SPREAD_COUNT, popupContentForSpread, type SceneLayer } from '@/components/labs/storybook/content'
import {
  spreadPageAnglesTilted,
  type TabPieceGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solveTabPiecePoseAt,
  tabPieceStopLift,
  type TabPieceFace,
} from '@/components/labs/storybook/book/popup-tabpiece'
import { tabFaceUvs } from '@/components/labs/storybook/book/popup-tabpiece-layer'
import { toScreenPx } from '@/components/labs/storybook/book/reading-stage'

type Px = { x: number; y: number }

/** Screen basis at the reading camera, in reference-viewport pixels (y DOWN). */
const SCREEN_RIGHT: Px = { x: 1, y: 0 }
const SCREEN_UP: Px = { x: 0, y: -1 }

/**
 * How far the legend's BASELINE may lean off screen-right. The measured lean
 * is the page's own tilt plus perspective — 2.9 degrees at every lift — so 15
 * is a wide margin that still fails the defect (the old authoring leaned 75)
 * and fails a 180 (177) and a mirror (177).
 */
const BASELINE_TOL_DEG = 15
/**
 * How far GLYPH-UP may lean off screen-up. This one is genuinely looser,
 * and honestly so: the deck's two screen axes are not perpendicular (107
 * degrees apart at the stop), so a quad this foreshortened SHEARS the type
 * whatever you do. Worst measured across the travel is 20.6 degrees at the
 * 88-degree stop. The bar exists to catch an upside-down or mirrored plate,
 * not to police shear.
 */
const UP_TOL_DEG = 30

/** Sampled densely enough that no narrow band of the travel can slip between
 *  two samples — the latch law means EVERY one of these is a pose a reader can
 *  leave the piece sitting in. */
const STEPS = 40

const findLayer = (id: string): { layer: SceneLayer; spreadIndex: number } => {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    for (const layer of popupContentForSpread(s)?.layers ?? []) {
      if (layer.id === id) return { layer, spreadIndex: s }
    }
  }
  throw new Error(`${id} is not in the book — this gate would pass vacuously`)
}

const sub = (a: Px, b: Px): Px => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Px, b: Px): Px => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (a: Px, k: number): Px => ({ x: a.x * k, y: a.y * k })
const angleBetweenDeg = (a: Px, b: Px): number => {
  const la = Math.hypot(a.x, a.y)
  const lb = Math.hypot(b.x, b.y)
  if (la < 1e-9 || lb < 1e-9) return 180
  const c = Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / (la * lb)))
  return (Math.acos(c) * 180) / Math.PI
}

/**
 * The uv->screen derivative of one painted band, at its centre: how far a full
 * step of u, and a full step of v, move on the reader's screen.
 *
 * The quad's corners arrive in the ring order the solver builds them in and the
 * uvs arrive from the SHIPPED `tabFaceUvs`, so this pairs the two exactly as
 * three.js does — corner i carries uv (uvs[2i], uvs[2i+1]).
 */
function uvScreenAxes(quad: readonly Vec3[], uvs: Float32Array): { su: Px; sv: Px } {
  const p = quad.map((v) => toScreenPx(v))
  const du = uvs[2] - uvs[0] // corner0 -> corner1 is the u step
  const dv = uvs[7] - uvs[1] // corner0 -> corner3 is the v step
  expect(Math.abs(du), 'the u step across the band must not be degenerate').toBeGreaterThan(1e-6)
  expect(Math.abs(dv), 'the v step across the band must not be degenerate').toBeGreaterThan(1e-6)
  // Averaged over both opposite edges — the quad is a trapezoid under
  // perspective, so its centre derivative is the honest one.
  const su = scale(add(sub(p[1], p[0]), sub(p[2], p[3])), 0.5 / du)
  const sv = scale(add(sub(p[3], p[0]), sub(p[2], p[1])), 0.5 / dv)
  return { su, sv }
}

/** A uv-space direction as a screen vector. */
const uvDirToScreen = (axes: { su: Px; sv: Px }, dir: readonly number[]): Px =>
  add(scale(axes.su, dir[0]), scale(axes.sv, dir[1]))

const patchOf = (
  geom: SceneLayer & TabPieceGeom,
  face: TabPieceFace,
  lift: number,
  thetaL: number,
  thetaR: number
) => {
  const patch = solveTabPiecePoseAt(geom, lift, thetaL, thetaR).find((p) => p.face === face)
  expect(patch, `${geom.id} has no '${face}' patch`).toBeDefined()
  return patch!
}

describe('s6 — the stall\'s legend reads left-to-right at the reader\'s eye', () => {
  const { layer, spreadIndex } = findLayer(S6_STALL_CARTOUCHE.layerId)
  const geom = layer as SceneLayer & TabPieceGeom
  const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
  const stop = tabPieceStopLift(geom)

  it('the piece is still the page-flat left-page tab piece this painting was authored for', () => {
    // The painting hard-codes the LEFT page's screen mapping (page-fore d runs
    // screen-LEFT there). Moving the piece without repainting it would reverse
    // the legend, so the side is part of the contract, not a detail.
    expect(geom.side).toBe('left')
    expect(geom.mech).toBe('tabpiece')
    expect(geom.form).toBe('table')
  })

  it('baseline runs screen-right and glyph-up runs screen-up at every latchable lift', () => {
    const uvs = tabFaceUvs(S6_STALL_CARTOUCHE.face as TabPieceFace, geom)
    let worstBaseline = { deg: -1, lift: 0 }
    let worstUp = { deg: -1, lift: 0 }
    for (let i = 0; i <= STEPS; i++) {
      const lift = (stop * i) / STEPS
      const axes = uvScreenAxes(patchOf(geom, S6_STALL_CARTOUCHE.face as TabPieceFace, lift, thetaL, thetaR).quad, uvs)
      const baseline = angleBetweenDeg(uvDirToScreen(axes, S6_STALL_CARTOUCHE.baselineUV), SCREEN_RIGHT)
      const up = angleBetweenDeg(uvDirToScreen(axes, S6_STALL_CARTOUCHE.upUV), SCREEN_UP)
      if (baseline > worstBaseline.deg) worstBaseline = { deg: baseline, lift }
      if (up > worstUp.deg) worstUp = { deg: up, lift }
    }
    expect(
      worstBaseline.deg,
      `"${S6_STALL_CARTOUCHE.legend}" leans ${worstBaseline.deg.toFixed(1)} deg off screen-right at ` +
        `lift ${((worstBaseline.lift * 180) / Math.PI).toFixed(1)} deg — the reader has to tilt their head`
    ).toBeLessThan(BASELINE_TOL_DEG)
    expect(
      worstUp.deg,
      `"${S6_STALL_CARTOUCHE.legend}" stands ${worstUp.deg.toFixed(1)} deg off screen-up at ` +
        `lift ${((worstUp.lift * 180) / Math.PI).toFixed(1)} deg`
    ).toBeLessThan(UP_TOL_DEG)
  })

  it('the legend is not mirrored — baseline x glyph-up keeps the reader\'s handedness', () => {
    const uvs = tabFaceUvs(S6_STALL_CARTOUCHE.face as TabPieceFace, geom)
    for (let i = 0; i <= STEPS; i++) {
      const lift = (stop * i) / STEPS
      const axes = uvScreenAxes(patchOf(geom, S6_STALL_CARTOUCHE.face as TabPieceFace, lift, thetaL, thetaR).quad, uvs)
      const b = uvDirToScreen(axes, S6_STALL_CARTOUCHE.baselineUV)
      const u = uvDirToScreen(axes, S6_STALL_CARTOUCHE.upUV)
      // Screen y is DOWN, so upright unmirrored type has baseline x up < 0.
      expect(b.x * u.y - b.y * u.x, `mirrored at lift ${lift}`).toBeLessThan(0)
    }
  })

  it('the same painting on the RIGHT page would fail — the gate is side-aware', () => {
    // Not a hypothetical: this family already ships a right-page piece
    // (ch4-goldpile), and the next one to want a legend must repaint rather
    // than reuse. On the right page the page-fore axis runs screen-RIGHT, so
    // a baseline authored as image-DOWN comes out reversed.
    const mirrored = { ...geom, side: 'right' } as SceneLayer & TabPieceGeom
    const uvs = tabFaceUvs(S6_STALL_CARTOUCHE.face as TabPieceFace, mirrored)
    const axes = uvScreenAxes(
      patchOf(mirrored, S6_STALL_CARTOUCHE.face as TabPieceFace, stop / 2, Math.PI - thetaR, Math.PI - thetaL).quad,
      uvs
    )
    expect(
      angleBetweenDeg(uvDirToScreen(axes, S6_STALL_CARTOUCHE.baselineUV), SCREEN_RIGHT)
    ).toBeGreaterThan(180 - BASELINE_TOL_DEG)
  })
})

describe('s6 — the stall tab\'s chevrons still point where the card goes', () => {
  const { layer, spreadIndex } = findLayer(S6_STALL_TAB_ARROW.layerId)
  const geom = layer as SceneLayer & TabPieceGeom
  const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
  const stop = tabPieceStopLift(geom)

  it('the printed arrow agrees with the card\'s own screen travel', () => {
    // Deliberately NOT read off the tab quad's own v axis (that would be
    // circular): the travel direction is measured as where the card's centre
    // actually MOVES on screen between zero draw and the mechanical stop.
    const centre = (lift: number): Px => {
      const q = patchOf(geom, 'tab', lift, thetaL, thetaR).quad.map((v) => toScreenPx(v))
      return { x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 }
    }
    const travel = sub(centre(stop), centre(0))
    expect(Math.hypot(travel.x, travel.y), 'the card must actually travel').toBeGreaterThan(20)

    const uvs = tabFaceUvs('tab', geom)
    const axes = uvScreenAxes(patchOf(geom, 'tab', 0, thetaL, thetaR).quad, uvs)
    const arrow = uvDirToScreen(axes, S6_STALL_TAB_ARROW.pointUV)
    expect(
      angleBetweenDeg(arrow, travel),
      'the tab\'s printed chevrons point away from the direction the card slides'
    ).toBeLessThan(20)
  })
})
