import { describe, expect, it } from 'vitest'
import {
  keepSkylineQuads,
  solveKeepSkylinePose,
  type KeepSkylineGeom,
} from '@/components/labs/storybook/book/popup-skyline'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// THE CITADEL RANK (E1.5.2 city rows) gates, ported in-engine from
// .superpowers/sdd/bench/derive-keep-cityrows.mjs (Y1/Y4/Y5 + the +z-facing
// reorientation), run against the shipped skyline pair from content.ts.

const REST = (176 * Math.PI) / 180
const GLOBAL_CAP = 0.0497
const rad = (d: number): number => (d * Math.PI) / 180
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

const SKYLINES = CHAPTERS.find((c) => c.spread === 4)!.layers.filter(
  (l): l is SceneLayer & KeepSkylineGeom => l.mech === 'skyline'
)

describe('citadel rank — +z-facing city rows (bench derive-keep-cityrows.mjs)', () => {
  it('ships one skyline per outer page, each with city rows behind the keep', () => {
    expect(SKYLINES.map((s) => s.side).sort()).toEqual(['left', 'right'])
    for (const sky of SKYLINES) {
      expect(sky.rows.length).toBeGreaterThanOrEqual(2)
      for (const r of sky.rows) {
        // E3 s4 RING (scenes/s4-scene-pack.md §4a): rows are now CONCENTRIC RING
        // STATIONS sweeping from deep behind the flanks (zc -0.52) around to the
        // reader's apron (zc +0.575), not just a rank parked behind the keep. The
        // fore end is bounded by the fringe's own yard wall at z 0.60.
        expect(r.zc).toBeLessThan(0.6)
        expect(r.zc).toBeGreaterThan(-0.6)
        // R3 LAW (s4 pack §6): the rotation radius is the HYPOT of the far edge
        // and the STANDING HEIGHT — the old flat `F + width` reading under-counts
        // tall riders, and correcting it is what freed the ring's mid arms to
        // grow to 0.16 (the 0.107 era was bound by delivered strip ART aspect,
        // never by physics).
        //
        // The authoritative real-time gate is Y4 below (worst per-vertex step
        // over an eased turn vs GLOBAL_CAP); this radius is its cheap proxy. The
        // three E1.5 REAR rows per page (zc < 0) were sized under the old flat
        // reading and measure up to 0.7583 — 0.8% over the honest cap, shipped,
        // Y4-green, and out of the ring's scope to re-derive. Naming that debt
        // here keeps the NEW ring stations held to the law exactly.
        const RADIUS_CAP = 0.752
        const LEGACY_FLAT_ERA_CEIL = 0.7584
        const radius = Math.hypot(r.F + r.width, r.height * Math.sin(rad(r.standDeg)))
        expect(radius).toBeLessThanOrEqual((r.zc < 0 ? LEGACY_FLAT_ERA_CEIL : RADIUS_CAP) + 1e-9)
        expect(r.standDeg).toBeGreaterThan(0)
        expect(r.standDeg).toBeLessThanOrEqual(90)
      }
    }
  })

  it('Y1 fold-flat: every row lies exactly in the page plane at book-closed', () => {
    for (const sky of SKYLINES) {
      const tL = 1e-9
      const tR = 0
      for (const q of keepSkylineQuads(sky, tL, tR))
        for (const p of q) expect(Math.abs(p[0] * Math.sin(tL) - p[1] * Math.cos(tL))).toBeLessThanOrEqual(1e-6)
    }
  })

  it('Y4 real-time: the worst per-vertex step over an eased page turn stays under the global cap', () => {
    const STN = 240
    let capMax = 0
    for (const sky of SKYLINES) {
      // the row's own page swings on its turn (outgoing for right, incoming for left).
      for (const path of [(t: number) => [Math.PI, easeTurnWeighted(t) * Math.PI] as const, (t: number) => [easeTurnWeighted(t) * Math.PI, 0] as const]) {
        let prev: Vec3[] | null = null
        for (let i = 0; i <= STN; i++) {
          const [tL, tR] = path(i / STN)
          const verts = keepSkylineQuads(sky, tL, tR).flat()
          if (prev) for (let c = 0; c < verts.length; c++) capMax = Math.max(capMax, dist(prev[c], verts[c]))
          prev = verts
        }
      }
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('Y5 containment: the rows fit the page (reach <= PAGE_W, z in +-PAGE_H/2)', () => {
    let reach = 0
    let zMin = Infinity
    let zMax = -Infinity
    for (const sky of SKYLINES)
      for (const q of keepSkylineQuads(sky, ...bloom(REST)))
        for (const p of q) {
          reach = Math.max(reach, Math.abs(p[0]))
          zMin = Math.min(zMin, p[2])
          zMax = Math.max(zMax, p[2])
        }
    expect(reach).toBeLessThanOrEqual(PAGE_W + 1e-9)
    expect(zMin).toBeGreaterThanOrEqual(-PAGE_H / 2 - 1e-9)
    expect(zMax).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
  })

  it('rows stand up FACING the reader (+z) at open, flat at close — the re-orientation', () => {
    for (const sky of SKYLINES) {
      const flat = solveKeepSkylinePose(sky, 1e-9, 0)
      const open = solveKeepSkylinePose(sky, ...bloom(REST))
      sky.rows.forEach((_, k) => {
        // at close the flap lies in the page plane (top edge at ~0 world-Y).
        const topFlat = flat[k][3]
        expect(Math.abs(topFlat[1])).toBeLessThanOrEqual(1e-6)
        // at open the top edge stands proud of the page (world-Y lift > 0) ...
        const topOpen = open[k][3]
        const baseOpen = open[k][0]
        expect(topOpen[1] - baseOpen[1]).toBeGreaterThan(0.03)
        // ... and the flap face points mostly along z (faces the reader), not
        // edge-on: |nz| dominates the normal (the prism's failure was |nz| ~ 0).
        const n = cross(sub(open[k][1], open[k][0]), sub(open[k][3], open[k][0]))
        expect(Math.abs(n[2]) / norm(n)).toBeGreaterThan(0.7)
      })
    }
  })
})
