/**
 * NO LATCHED STATE MAY LEAVE ITS OWN HANDLE UNHITTABLE (E3 R-3).
 *
 * The s6 blind re-review, finding 2: "The vendor folds flat and can never stand
 * up again. One rightward drag lays him face-down; drag left, return the pointer
 * to the exact grab origin, release, re-grab, drag to either extreme — he stays
 * down. The only reset is a page reload. An interactive piece with a one-way
 * destructive state and no undo."
 *
 * He was not gone and he was not stuck: his HANDLE had turned nearly edge-on to
 * the reading camera. Live hit map at 1600x900 (bench/hotfix-r23.mjs), sweeping
 * the pointer over the right page and reading the store's hover id:
 *
 *   drive 90 deg (standing)    drive 50 deg (his latch)
 *   ....TTTTT.......           ................
 *   ....TTTTT.......           ................
 *   ....TTTTT.......           .......TTT......
 *   ....TTTTT.......           .....TTTT.......
 *   ....TTTT........           ................
 *   24 cells                   7 cells, and 40 px away from where he was grabbed
 *
 * The release law (BW-12) lets a reader LATCH a piece anywhere in its travel, so
 * every value in that travel is a state the book can be left in — and the pad
 * that was supposed to guarantee a real target measures WORLD edge lengths,
 * which rotation never changes. This gate re-derives, from the layers' own
 * solvers and book-scene's own camera, the hit quad each family actually
 * raycasts at every latchable value, and requires it to stay a target a hand can
 * land on.
 *
 * Coverage note: the two families gated here are the ones whose handle ROTATES
 * out of the page plane (stripflap, liftflap) — the only ones whose projected
 * hit area varies with the reader's own drive value. The page-plane families
 * (tabpiece, dissolve, dispatchline, keepsake, volvelle, knobtower, keepwinch)
 * present the same foreshortening at every drive value; their liveness is gated
 * by handle-drag-regression.test.ts.
 */

import { describe, expect, it } from 'vitest'
import {
  liveSpreadRole,
  solveStripFlapPoseAt,
  spreadPageAnglesTilted,
  stripFlapTravel,
  type StripFlapGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  doorSlopFactors,
  liftFlapDoorQuad,
  liftFlapMax,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import {
  HANDLE_SLOP_STANDING,
  hitQuadFor,
} from '@/components/labs/storybook/book/handle-hit'
import {
  HANDLE_MIN_SCREEN_PX,
  toScreenPx,
} from '@/components/labs/storybook/book/reading-stage'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

/** Every layer in the book that carries a reader-turned flap, by family. */
function layersOf(mech: string): { layer: SceneLayer; spreadIndex: number }[] {
  const out: { layer: SceneLayer; spreadIndex: number }[] = []
  for (let s = 0; s < SPREAD_COUNT; s++) {
    for (const layer of popupContentForSpread(s)?.layers ?? []) {
      if (layer.mech === mech) out.push({ layer, spreadIndex: s })
    }
  }
  expect(out.length, `no ${mech} layers found — the gate would pass vacuously`).toBeGreaterThan(0)
  return out
}

function restAngles(spreadIndex: number): { thetaL: number; thetaR: number } {
  expect(liveSpreadRole(spreadIndex, spreadIndex, null)).toBe('current')
  return spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
}

/** The screen box the hit quad projects to at the pinned reading camera, and
 *  the shorter of its two projected axes — the dimension a hand runs out of. */
function screenExtent(quad: readonly Vec3[]): { w: number; h: number; shortAxisPx: number } {
  const pts = quad.map(toScreenPx)
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const axis = (a: number, b: number, c: number, d: number): number =>
    (Math.hypot(pts[b].x - pts[a].x, pts[b].y - pts[a].y) +
      Math.hypot(pts[c].x - pts[d].x, pts[c].y - pts[d].y)) /
    2
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    shortAxisPx: Math.min(axis(0, 1, 2, 3), axis(0, 3, 1, 2)),
  }
}

/** The bar, in reference-viewport px. The screen floor itself is 44 px; the
 *  0.98 slack absorbs the perspective spread across a quad that is not centred
 *  in frame (the floor is measured through the quad's centre). */
const FLOOR_PX = HANDLE_MIN_SCREEN_PX * 0.98

/** Latchable values are sampled densely enough that no narrow edge-on band can
 *  slip between two samples: 41 steps across the whole travel. */
const STEPS = 40

describe('stripflap — every latchable lift leaves a handle a hand can land on', () => {
  for (const { layer, spreadIndex } of layersOf('stripflap')) {
    const geom = layer as SceneLayer & StripFlapGeom
    it(`${layer.id} (spread ${spreadIndex})`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const travel = stripFlapTravel(geom)
      let worst = { deg: 0, px: Infinity, w: 0, h: 0 }
      for (let i = 0; i <= STEPS; i++) {
        const a = travel[0] + ((travel[1] - travel[0]) * i) / STEPS
        const pose = solveStripFlapPoseAt(geom, a, thetaL, thetaR)
        const full: Vec3[] = [pose.left[1], pose.right[1], pose.right[2], pose.left[2]]
        const e = screenExtent(hitQuadFor(full, HANDLE_SLOP_STANDING))
        if (e.shortAxisPx < worst.px) worst = { deg: (a * 180) / Math.PI, px: e.shortAxisPx, w: e.w, h: e.h }
      }
      expect(
        worst.px,
        `${layer.id}: at ${worst.deg.toFixed(1)} deg its hit surface is ${worst.px.toFixed(0)} px across (box ${worst.w.toFixed(0)}x${worst.h.toFixed(0)}) — a reader who latches it there cannot take it back`
      ).toBeGreaterThanOrEqual(FLOOR_PX)
    })
  }
})

describe('liftflap — every door angle a reader can leave behind stays grabbable', () => {
  for (const { layer, spreadIndex } of layersOf('liftflap')) {
    const geom = layer as SceneLayer & LiftFlapGeom
    it(`${layer.id} (spread ${spreadIndex})`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const max = liftFlapMax(geom)
      const slops = doorSlopFactors(geom.doors)
      for (let k = 0; k < geom.doors.length; k++) {
        let worst = { deg: 0, px: Infinity }
        for (let i = 0; i <= STEPS; i++) {
          const a = (max * i) / STEPS
          const quad = liftFlapDoorQuad(geom, k, a, thetaL, thetaR)
          const full = quad.map((c) => [c[0], c[1], c[2]] as Vec3)
          const e = screenExtent(hitQuadFor(full, slops[k]))
          if (e.shortAxisPx < worst.px) worst = { deg: (a * 180) / Math.PI, px: e.shortAxisPx }
        }
        expect(
          worst.px,
          `${layer.id} door ${k}: at ${worst.deg.toFixed(1)} deg its hit surface is ${worst.px.toFixed(0)} px across — a door left open there cannot be shut again`
        ).toBeGreaterThanOrEqual(FLOOR_PX)
      }
    })
  }
})

describe('the screen floor is a floor, not a rescale', () => {
  it('leaves a handle that already faces the reader exactly where the world pad put it', () => {
    // A page-flat square well clear of the floor: 0.5 world units is ~190 px at
    // this camera, so the screen rule must not touch it.
    const flat: Vec3[] = [
      [-0.25, 0, -0.25],
      [0.25, 0, -0.25],
      [0.25, 0, 0.25],
      [-0.25, 0, 0.25],
    ]
    const padded = hitQuadFor(flat, 1)
    for (let i = 0; i < 4; i++) {
      for (let c = 0; c < 3; c++) expect(padded[i][c]).toBeCloseTo(flat[i][c], 9)
    }
  })
})
