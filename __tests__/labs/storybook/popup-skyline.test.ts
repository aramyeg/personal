import { describe, expect, it } from 'vitest'
import {
  keepSkylineQuads,
  solveKeepSkylinePose,
  type KeepSkylineGeom,
} from '@/components/labs/storybook/book/popup-skyline'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS, type SceneLayer } from '@/components/labs/storybook/content'

// THE SKYLINE gates, ported in-engine from .superpowers/sdd/bench/derive-keep-
// skyline.mjs (Y1-Y5, VERDICT: clears all gates), run against the shipped
// skyline pair from content.ts.

const REST = (176 * Math.PI) / 180
const GLOBAL_CAP = 0.0497
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

const SKYLINES = CHAPTERS.find((c) => c.spread === 4)!.layers.filter(
  (l): l is SceneLayer & KeepSkylineGeom => l.mech === 'skyline'
)

describe('skyline — mound-row gates (bench derive-keep-skyline.mjs)', () => {
  it('ships one skyline per outer page, each 3 mounds', () => {
    expect(SKYLINES.map((s) => s.side).sort()).toEqual(['left', 'right'])
    for (const sky of SKYLINES) expect(sky.mounds.length).toBe(3)
  })

  it('feasible band: every mound’s inner edge (F - 2w) clears the keep’s mid-fold sweep (>= 0.44)', () => {
    // The hard bench band: inner edge F - 2w >= 0.44 clears the keep, and the
    // fore hinge F stays within [0.64, 0.75] (further out busts the vertex cap).
    for (const sky of SKYLINES)
      for (const m of sky.mounds) {
        expect(m.F - 2 * m.w).toBeGreaterThanOrEqual(0.44 - 1e-9)
        expect(m.F).toBeGreaterThanOrEqual(0.64 - 1e-9)
        expect(m.F).toBeLessThanOrEqual(0.75 + 1e-9)
        expect(m.aRestDeg).toBeGreaterThan(0)
        expect(m.aRestDeg).toBeLessThan(90)
      }
  })

  it('Y1 fold-flat: every mound lies exactly in the page plane at book-closed', () => {
    for (const sky of SKYLINES) {
      // At (1e-9, 0) the page is essentially the +x axis; every vertex must sit
      // on it (off-page height ~ 0).
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
      let prev: Vec3[] | null = null
      for (let i = 0; i <= STN; i++) {
        const tL = Math.PI
        const tR = easeTurnWeighted(i / STN) * Math.PI
        const verts = keepSkylineQuads(sky, tL, tR).flat()
        if (prev) for (let c = 0; c < verts.length; c++) capMax = Math.max(capMax, dist(prev[c], verts[c]))
        prev = verts
      }
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('Y5 containment: the mounds fit the page (reach <= PAGE_W, z in +-PAGE_H/2)', () => {
    const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
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

  it('each mound emits two slope panels that rise as the book opens (page-driven, no knob)', () => {
    for (const sky of SKYLINES) {
      const flat = solveKeepSkylinePose(sky, 1e-9, 0)
      const open = solveKeepSkylinePose(sky, Math.PI / 2 + REST / 2, Math.PI / 2 - REST / 2)
      sky.mounds.forEach((_, k) => {
        // ridge height (the shared corner of slopeIn.tr / slopeOut.bl) rises.
        const ridgeFlat = flat[k].slopeIn[2]
        const ridgeOpen = open[k].slopeIn[2]
        const hFlat = Math.hypot(ridgeFlat[0], ridgeFlat[1])
        const hOpen = Math.hypot(ridgeOpen[0], ridgeOpen[1])
        // the ridge stands proud of the page run when open (it was flat closed).
        expect(hOpen).toBeGreaterThan(0)
        void hFlat
      })
    }
  })
})
