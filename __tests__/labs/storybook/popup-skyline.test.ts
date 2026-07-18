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
        // rows march from the deep flanks toward the reader (grown+forward pass):
        // the nearest tier juts to zc ~ -0.16, still behind the keep's +z front-cap
        // crown and laterally clear of the tower (bench Y2 keeps D-G2 at zero).
        expect(r.zc).toBeLessThan(0)
        expect(r.zc).toBeGreaterThan(-0.6)
        // width is aspect-bound and the far edge stays under the real-time radius cap.
        expect(r.F + r.width).toBeLessThanOrEqual(0.76 + 1e-9)
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
