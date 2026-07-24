import { describe, expect, it } from 'vitest'
import {
  depthVistaEnvelope,
  moundPatches,
  solveDepthVistaPose,
  type DepthVistaGeom,
} from '@/components/labs/storybook/book/popup-depthvista'
import type { PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { EXTRA_SPREAD_LAYERS } from '@/components/labs/storybook/content'

// DEPTH VISTA gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-depthvista.mjs (all-wings +z-facing form). Uses
// the shipped s8 satchel-vista config so the in-engine gates track content.ts.

const rad = (d: number): number => (d * Math.PI) / 180
const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const REST = { tL: 3.0563, tR: 0.0244 }
const REST_BETA = REST.tL - REST.tR
const GLOBAL_CAP = 0.0497
const PAGE_HALF_H = PAGE_H / 2

// The shipped s8 depth vista (content.ts satchel-vista) — the frozen bench config.
const CFG: DepthVistaGeom = {
  mech: 'depthvista',
  wings: [
    { key: 'near', F: 0.5, width: 0.42, height: 0.26, zc: 0.34, standDeg: 58 },
    { key: 'mid', F: 0.72, width: 0.3, height: 0.32, zc: 0.2, standDeg: 60 },
    { key: 'rear', F: 0.82, width: 0.2, height: 0.4, zc: -0.2, standDeg: 62 },
  ],
}

const pairwise = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist3(q[a], q[b]))
  return ds
}
const pageNormal = (theta: number): Vec3 => [-Math.sin(theta), Math.cos(theta), 0]
const offPage = (p: Vec3, n: Vec3): number => p[0] * n[0] + p[1] * n[1] + p[2] * n[2]

// pinned reading camera (book-scene.tsx) — for the screen-Y depth ordering.
const EYE: Vec3 = [0, 1.85, 3.05]
const LOOKAT: Vec3 = [0, 0.38, 0.05]
const FOV_Y = rad(34)
const SCREEN_H = 900
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}
const fwd = unit(sub(LOOKAT, EYE))
const rightV = unit(cross(fwd, [0, 1, 0]))
const upV = cross(rightV, fwd)
const tanH = Math.tan(FOV_Y / 2)
function screenY(p: Vec3): number {
  const rel = sub(p, EYE)
  const cz = dot(rel, fwd)
  const cy = dot(rel, upV)
  const ndcy = cy / (cz * tanH)
  return (1 - (ndcy * 0.5 + 0.5)) * SCREEN_H
}
function flapCentroid(quad: PanelQuad): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (const p of quad) {
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / 4, y / 4, z / 4]
}

describe('depth vista — all-wings +z-facing gates (bench derive-depthvista.mjs)', () => {
  it('WFLAT: each wing folds dead flat at close (lift 0) and the envelope zeroes there but blooms open', () => {
    for (const wing of CFG.wings) {
      for (const side of ['left', 'right'] as const) {
        expect(moundPatches(CFG, wing, side, ...bloom(0)).hgt).toBeLessThan(1e-9)
      }
    }
    expect(depthVistaEnvelope(CFG, 0)).toBeCloseTo(0, 12)
    expect(depthVistaEnvelope(CFG, rad(176))).toBeGreaterThan(0.99)
  })

  it('WRIGID: each wing flap stays rigid (pairwise corner distances) across the beta sweep', () => {
    for (const wing of CFG.wings) {
      for (const side of ['left', 'right'] as const) {
        const ref = pairwise(moundPatches(CFG, wing, side, ...bloom(REST_BETA)).flap)
        for (let i = 0; i <= 60; i++) {
          const q = moundPatches(CFG, wing, side, ...bloom((Math.PI * i) / 60)).flap
          pairwise(q).forEach((d, k) => expect(d).toBeCloseTo(ref[k], 9))
        }
      }
    }
  })

  it('coplanar/fold-flat: the base hinge edge rides in the page plane at every beta; at close the whole flap folds flat inside the page', () => {
    for (const wing of CFG.wings) {
      for (const side of ['left', 'right'] as const) {
        for (const betaDeg of [8, 60, 120, 176]) {
          const [tL, tR] = bloom(rad(betaDeg))
          const n = pageNormal(side === 'left' ? tL : tR)
          const q = moundPatches(CFG, wing, side, tL, tR).flap
          // base hinge edge (corners 0,1) lies in the page plane
          for (const idx of [0, 1]) expect(Math.abs(offPage(q[idx], n))).toBeLessThan(1e-9)
        }
        // at book-closed every corner folds flat in the page and stays contained
        const n0 = pageNormal(0)
        const closed = moundPatches(CFG, wing, side, 0, 0).flap
        for (const p of closed) {
          expect(Math.abs(offPage(p, n0))).toBeLessThan(1e-9)
          expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(PAGE_W + 1e-9)
          expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_HALF_H + 1e-9)
        }
      }
    }
  })

  it('ZBAND: same-page wings occupy disjoint z-bands at rest (self-clear)', () => {
    const bands = CFG.wings
      .map((w) => {
        const s = moundPatches(CFG, w, 'left', REST.tL, REST.tR)
        return { key: w.key, z0: s.z0, z1: s.z1 }
      })
      .sort((a, b) => a.z0 - b.z0)
    for (let i = 0; i + 1 < bands.length; i++) {
      expect(bands[i + 1].z0).toBeGreaterThan(bands[i].z1)
    }
  })

  it('TABLE + COLUMN + containment: each wing clears the table, the bag column (F > 0.42), and the page', () => {
    for (const wing of CFG.wings) {
      // deepest -z reach is at the lowest erected beta (0.9)
      let minZ0 = Infinity
      let maxZ1 = -Infinity
      for (let i = 0; i <= 30; i++) {
        const beta = 0.9 + (i / 30) * (Math.PI - 1e-3 - 0.9)
        const s = moundPatches(CFG, wing, 'left', ...bloom(beta))
        minZ0 = Math.min(minZ0, s.z0)
        maxZ1 = Math.max(maxZ1, s.z1)
      }
      // A far-out flap (F beyond the table's radial column ~0.55) clears the map
      // table (z -0.36..-0.62) by radial separation regardless of its -z reach —
      // the bench's geometric NOCLIP-vs-table proves it. Only a flap sitting IN
      // the table's column (F <= 0.6) must keep z0 > -0.35.
      if (wing.F <= 0.6) expect(minZ0).toBeGreaterThan(-0.35)
      expect(wing.F).toBeGreaterThan(0.42)
      expect(wing.F + wing.width).toBeLessThanOrEqual(PAGE_W)
      expect(Math.max(Math.abs(minZ0), Math.abs(maxZ1))).toBeLessThanOrEqual(PAGE_HALF_H + 1e-9)
    }
  })

  it('DEPTH: the pairs recede near -> mid -> rear in screen-y (near lowest), world-z, and SCALE tapers (converging)', () => {
    const pose = solveDepthVistaPose(CFG, REST.tL, REST.tR)
    const byKey = (key: string) => pose.wings.filter((w) => w.key === key).map((w) => screenY(flapCentroid(w.patch.flap)))
    const meanY = (key: string) => byKey(key).reduce((a, b) => a + b, 0) / byKey(key).length
    const [nearY, midY, rearY] = ['near', 'mid', 'rear'].map(meanY)
    // near is lowest on screen (largest screen-y), rear highest (smallest)
    expect(nearY).toBeGreaterThan(midY + 2)
    expect(midY).toBeGreaterThan(rearY + 2)
    const [near, mid, rear] = CFG.wings
    // world-z recedes (front -> deep)
    expect(near.zc).toBeGreaterThan(mid.zc)
    expect(mid.zc).toBeGreaterThan(rear.zc)
    // scale tapers near -> mid -> rear (perspective convergence)
    expect(near.width).toBeGreaterThan(mid.width)
    expect(mid.width).toBeGreaterThan(rear.width)
  })

  it('page-driven: each flap top-edge lift tracks the fold-flat envelope — 0 at close, monotone rising with beta', () => {
    for (const wing of CFG.wings) {
      for (const side of ['left', 'right'] as const) {
        let prev = -1
        for (let i = 0; i <= 40; i++) {
          const beta = (Math.PI * i) / 40
          const s = moundPatches(CFG, wing, side, ...bloom(beta))
          const expected = wing.height * Math.sin(rad(wing.standDeg) * depthVistaEnvelope(CFG, beta))
          expect(s.hgt).toBeCloseTo(expected, 9)
          expect(s.hgt).toBeGreaterThanOrEqual(prev - 1e-12)
          prev = s.hgt
        }
      }
    }
  })

  it('SPEED: no wing snaps — the fastest flap corner real-time step over the eased page-turn clock stays under the cap', () => {
    let capMax = 0
    const members = (tL: number, tR: number): PanelQuad[] =>
      solveDepthVistaPose(CFG, tL, tR).wings.map((w) => w.patch.flap)
    let prev: PanelQuad[] | null = null
    for (let i = 0; i <= 240; i++) {
      const beta = Math.PI * easeTurnWeighted(i / 240)
      const cur = members(...bloom(beta))
      if (prev) for (let m = 0; m < cur.length; m++) for (let c = 0; c < 4; c++) capMax = Math.max(capMax, dist3(prev[m][c], cur[m][c]))
      prev = cur
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('covenant: the shipped s8 satchel-vista layer matches this frozen config', () => {
    const layer = EXTRA_SPREAD_LAYERS[8].find((l) => l.id === 'satchel-vista')
    expect(layer).toBeDefined()
    expect(layer?.mech).toBe('depthvista')
    if (layer?.mech !== 'depthvista') throw new Error('unreachable')
    expect(layer.wings).toEqual(CFG.wings)
    expect(layer.kind).toBe('backdrop')
    expect(layer.role).toBe('scenery')
    // three graded pairs => six flaps
    expect(solveDepthVistaPose(layer, REST.tL, REST.tR).wings).toHaveLength(6)
  })
})
