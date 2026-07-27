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
  liftFlapGrabQuad,
  liftFlapHingeFrame,
  liftFlapMax,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import * as THREE from 'three'
import {
  projectHingeAngle,
  projectHingeAngleCyl,
} from '@/components/labs/storybook/book/handle-projection'
import {
  solveStripFlapPoseAt as poseStripFlapAt,
  stripFlapDetent,
  stripFlapFrame,
} from '@/components/labs/storybook/book/popup-mechanics'
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
          // The surface the LAYER raycasts, not the leaf's own quad: since
          // S7R2-3 an open door's hit footprint lags the leaf down over the
          // mouth it uncovered (liftFlapGrabQuad). Measuring the leaf here
          // while the layer offers something else is how a gate goes green on
          // a piece a reader cannot touch.
          const quad = liftFlapGrabQuad(geom, k, a, thetaL, thetaR)
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

// ============================================================================
// REVERSIBILITY — a latched piece must come back by the inverse gesture
// ============================================================================
//
// WHY THIS SECTION EXISTS (E3 s7 round-2, S7R2-3). The gates above ask whether
// a latched handle is still a TARGET. s7's coffer passed them and was still
// one-way: "once lifted it never closes — drags right, up and down from the
// card, and drags on the raised leaf itself, all leave it open. The only way
// back to the closed state is to leave the spread and come back."
//
// Hittability is necessary and not sufficient. A hand that lands on the handle
// must also DRIVE it back, and that is a question about the projector and the
// drive arithmetic, not about pixels: measured live (bench/s7r2-drag-live.mjs)
// the coffer at 95 deg answered `hover=ch6-coffer, grab=null` in all four
// directions, because the leaf had swung off the pixels the reader was looking
// at and what filled the region was the board, which carries no door index.
//
// So: from the LATCHED pose, aim at the piece's own shipped hit surface, walk a
// stroke in the closing direction through the layer's real projector and real
// drive arithmetic, and require the value to come back. Book-wide, for both
// rotating families — the two whose handles leave the page plane and so can
// hide from the hand they were opened with.
const CAMERA = new THREE.Vector3(0, 1.85, 3.05)
const LOOK_AT = new THREE.Vector3(0, 0.38, 0.05)
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const VIEW = LOOK_AT.clone().sub(CAMERA).normalize()
const SCREEN_RIGHT = VIEW.clone().cross(WORLD_UP).normalize()
const SCREEN_UP = SCREEN_RIGHT.clone().cross(VIEW).normalize()
/** Eight screen directions — a reader who wants a lid shut will try them all. */
const DIRECTIONS: readonly THREE.Vector3[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4
  return SCREEN_RIGHT.clone().multiplyScalar(Math.cos(a)).addScaledVector(SCREEN_UP, Math.sin(a))
})
/** A deliberate stroke at the piece's own depth (~110 screen px at this camera),
 *  walked in sub-steps so a projector that saturates is still followed honestly. */
const RETURN_STROKE = 0.3
const SUB_STEPS = 12

const rayTo = (p: THREE.Vector3): THREE.Ray => new THREE.Ray(CAMERA.clone(), p.clone().sub(CAMERA).normalize())
const centroidOf = (quad: readonly Vec3[]): THREE.Vector3 => {
  const v = new THREE.Vector3()
  for (const c of quad) v.add(new THREE.Vector3(c[0], c[1], c[2]))
  return v.multiplyScalar(1 / quad.length)
}
const wrapDelta = (d: number): number => Math.atan2(Math.sin(d), Math.cos(d))
const clampTo = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Walks one stroke and returns the drive value it ends at. */
function walk(
  from: number,
  grabPoint: THREE.Vector3,
  dir: THREE.Vector3,
  project: (ray: THREE.Ray) => number | null,
  driveFrom: (grabScalar: number, nowScalar: number, start: number) => number
): number {
  const g = project(rayTo(grabPoint))
  if (g === null) return from
  let value = from
  for (let i = 1; i <= SUB_STEPS; i++) {
    const p = grabPoint.clone().addScaledVector(dir, (RETURN_STROKE * i) / SUB_STEPS)
    const n = project(rayTo(p))
    if (n === null) continue
    value = driveFrom(g, n, from)
  }
  return value
}

/** Is `p` inside the convex screen quad `q` (same winding either way)? */
function inQuad(q: readonly { x: number; y: number }[], p: { x: number; y: number }): boolean {
  let pos = 0
  let neg = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross > 0) pos++
    else if (cross < 0) neg++
  }
  return pos === 0 || neg === 0
}

/** What fraction of quad `a`'s screen area is covered by quad `b`. */
function screenOverlap(a: readonly Vec3[], b: readonly Vec3[]): number {
  const pa = a.map(toScreenPx)
  const pb = b.map(toScreenPx)
  let inside = 0
  let total = 0
  const N = 12
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const u = i / N
      const v = j / N
      // Bilinear sample of the source quad [bl, br, tr, tl].
      const x = (1 - v) * ((1 - u) * pa[0].x + u * pa[1].x) + v * ((1 - u) * pa[3].x + u * pa[2].x)
      const y = (1 - v) * ((1 - u) * pa[0].y + u * pa[1].y) + v * ((1 - u) * pa[3].y + u * pa[2].y)
      total++
      if (inQuad(pb, { x, y })) inside++
    }
  }
  return total ? inside / total : 0
}

/**
 * THE GATE THE COFFER ACTUALLY NEEDED: a latched handle must still be WHERE THE
 * READER LEFT IT.
 *
 * The drive-arithmetic walk below asks whether a stroke that lands on the handle
 * drives it back. It never would have caught s7's coffer, whose arithmetic was
 * always fine: what broke was that a lid at 95 deg is no longer over the pixels
 * its own reader pressed to open it, and the piece underneath — the board, in the
 * same group, lighting the same hover glow — is not grabbable. The reader gets a
 * lit piece and a dead press.
 *
 * A reader comes back to where they last touched, so that is the region the
 * measurement is against: the SHUT leaf's own screen footprint, which is where
 * every one of these doors is opened from. At full latch, the surface the layer
 * offers must still cover a real share of it.
 */
const RETURN_COVERAGE = 0.25

describe('a latched handle stays where the reader left it', () => {
  for (const { layer, spreadIndex } of layersOf('liftflap')) {
    const geom = layer as SceneLayer & LiftFlapGeom
    it(`${layer.id} (spread ${spreadIndex})`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const max = liftFlapMax(geom)
      const slops = doorSlopFactors(geom.doors)
      for (let k = 0; k < geom.doors.length; k++) {
        const shut = liftFlapDoorQuad(geom, k, 0, thetaL, thetaR).map((c) => [c[0], c[1], c[2]] as Vec3)
        let worst = { deg: 0, cov: 1 }
        for (let i = 0; i <= STEPS; i++) {
          const a = (max * i) / STEPS
          const hit = hitQuadFor(
            liftFlapGrabQuad(geom, k, a, thetaL, thetaR).map((c) => [c[0], c[1], c[2]] as Vec3),
            slops[k]
          )
          const cov = screenOverlap(shut, hit)
          if (cov < worst.cov) worst = { deg: (a * 180) / Math.PI, cov }
        }
        expect(
          worst.cov,
          `${layer.id} door ${k}: at ${worst.deg.toFixed(0)} deg its hit surface covers only ` +
            `${(worst.cov * 100).toFixed(0)}% of the closed leaf the reader opened it from — ` +
            `they will press where they last touched and get nothing`
        ).toBeGreaterThanOrEqual(RETURN_COVERAGE)
      }
    })
  }
})

describe('reversibility — every latched piece comes back by the inverse gesture', () => {
  for (const { layer, spreadIndex } of layersOf('liftflap')) {
    const geom = layer as SceneLayer & LiftFlapGeom
    it(`${layer.id} (spread ${spreadIndex}) — an open door can be shut again`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const max = liftFlapMax(geom)
      for (let k = 0; k < geom.doors.length; k++) {
        const fr = liftFlapHingeFrame(geom, k, thetaL, thetaR)
        const project = (ray: THREE.Ray): number | null =>
          projectHingeAngle(ray, fr.center, fr.axis, fr.flat, fr.n)
        // The reader grabs whatever the layer offers at the LATCHED pose — the
        // lagging hit quad, which is the open lid plus the mouth beneath it.
        const grabPoint = centroidOf(liftFlapGrabQuad(geom, k, max, thetaL, thetaR))
        let best = max
        for (const dir of DIRECTIONS) {
          const end = walk(max, grabPoint, dir, project, (g, n, start) =>
            clampTo(start + wrapDelta(n - g), 0, max)
          )
          best = Math.min(best, end)
        }
        expect(
          (best * 180) / Math.PI,
          `${layer.id} door ${k}: opened to ${((max * 180) / Math.PI).toFixed(0)} deg, the best ` +
            `closing stroke of eight only reached ${((best * 180) / Math.PI).toFixed(0)} deg — ` +
            `a reader can open this and never shut it`
        ).toBeLessThan((max * 180) / Math.PI * 0.35)
      }
    })
  }

  for (const { layer, spreadIndex } of layersOf('stripflap')) {
    const geom = layer as SceneLayer & StripFlapGeom
    it(`${layer.id} (spread ${spreadIndex}) — a folded figure can be stood back up`, () => {
      const { thetaL, thetaR } = restAngles(spreadIndex)
      const [lo, hi] = stripFlapTravel(geom)
      const fr = stripFlapFrame(geom, thetaL, thetaR)
      const project = (ray: THREE.Ray): number | null =>
        geom.grabProjection === 'cylinder'
          ? projectHingeAngleCyl(ray, fr.center, fr.hinge, fr.flat, fr.n, geom.height)
          : projectHingeAngle(ray, fr.center, fr.hinge, fr.flat, fr.n)
      // Latched at the FAR end of its window from rest, then asked to come back.
      for (const [latched, target] of [
        [lo, hi],
        [hi, lo],
      ] as const) {
        const pose = poseStripFlapAt(geom, latched, thetaL, thetaR)
        const grabPoint = centroidOf([...pose.left, ...pose.right])
        let best = latched
        for (const dir of DIRECTIONS) {
          const end = walk(latched, grabPoint, dir, project, (g, n, start) =>
            stripFlapDetent(start + wrapDelta(n - g), lo, hi)
          )
          if (Math.abs(end - target) < Math.abs(best - target)) best = end
        }
        const travelled = Math.abs(best - latched) / Math.max(1e-9, Math.abs(target - latched))
        expect(
          travelled,
          `${layer.id}: latched at ${((latched * 180) / Math.PI).toFixed(0)} deg, the best of eight ` +
            `strokes recovered only ${(travelled * 100).toFixed(0)}% of the way back toward ` +
            `${((target * 180) / Math.PI).toFixed(0)} deg`
        ).toBeGreaterThan(0.5)
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
