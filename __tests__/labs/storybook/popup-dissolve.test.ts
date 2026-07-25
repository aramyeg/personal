import { describe, expect, it } from 'vitest'
import {
  DISSOLVE_BASE_LIFT,
  dissolvePitch,
  dissolveSlatHingeD,
  dissolveSlatQuad,
  dissolveSnap,
  dissolveStroke,
  dissolveTabOut,
  dissolveTabQuad,
  dissolveTauFromDraw,
  dissolveUpFaceNormal,
  solveDissolvePose,
} from '@/components/labs/storybook/book/popup-dissolve'
import { solveLayerPose, type DissolveGeom, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_W } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS } from '@/components/labs/storybook/content'

// The shipped s5 dunes->gold placard (mirrors content.ts EXACTLY).
const CFG: DissolveGeom = {
  mech: 'dissolve',
  side: 'left',
  d0: 0.46,
  d1: 0.98,
  z0: 0.2,
  z1: 0.6,
  slats: 6,
  stroke: 0.14,
}
const N = CFG.slats
const REST = (176 * Math.PI) / 180
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
// pinned reading camera (book-scene.tsx)
const CAM_EYE: Vec3 = [0, 1.85, 3.05]
const camDirTo = (q: readonly Vec3[]): Vec3 => {
  const c: Vec3 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2]
  return norm(sub(CAM_EYE, c))
}

describe('pull-tab dissolve — the venetian slat flip (bench derive-dissolve.mjs)', () => {
  it('D1 each slat is a rigid panel through the flip arc + beta sweep', () => {
    for (let k = 0; k < N; k++) {
      const ref = dissolveSlatQuad(CFG, k, 0, ...bloom(REST))
      const refD: number[] = []
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) refD.push(dist(ref[a], ref[b]))
      for (let i = 0; i <= 60; i++) {
        const beta = (REST * i) / 60
        const tau = (Math.PI * i) / 60
        const q = dissolveSlatQuad(CFG, k, tau, ...bloom(beta))
        let j = 0
        for (let a = 0; a < 4; a++)
          for (let b = a + 1; b < 4; b++) expect(Math.abs(dist(q[a], q[b]) - refD[j++])).toBeLessThan(1e-9)
      }
    }
  })

  it('D2 drag: tau clamps [0,PI], rises with the pull; tab draw = delta (inextensible)', () => {
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const delta = (CFG.stroke! * 1.4 * i) / 200
      const tau = dissolveTauFromDraw(CFG, delta)
      expect(tau).toBeGreaterThanOrEqual(-1e-12)
      expect(tau).toBeLessThanOrEqual(Math.PI + 1e-12)
      expect(tau).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = tau
    }
    expect(dissolveTabOut(CFG, 0)).toBeCloseTo(0, 10)
    expect(dissolveTabOut(CFG, Math.PI)).toBeCloseTo(dissolveStroke(CFG), 10)
  })

  it('D2 snap lands on a pure end {0,PI}, is idempotent, moves at most PI/2', () => {
    let maxMove = 0
    for (let i = 0; i <= 200; i++) {
      const tau = (Math.PI * i) / 200
      const s = dissolveSnap(tau)
      expect(Math.min(Math.abs(s), Math.abs(s - Math.PI))).toBeLessThan(1e-9) // a pure end
      expect(dissolveSnap(s)).toBeCloseTo(s, 12) // idempotent
      maxMove = Math.max(maxMove, Math.abs(s - tau))
    }
    expect(maxMove).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
  })

  it('D3 tau=0: every up-face is dunes (A) toward the camera, gold (B) hidden; slats tile', () => {
    const [tL, tR] = bloom(REST)
    for (let k = 0; k < N; k++) {
      const q = dissolveSlatQuad(CFG, k, 0, tL, tR)
      const up = dissolveUpFaceNormal(CFG, 0, tL, tR)
      const cd = camDirTo(q)
      expect(dot(up, cd)).toBeGreaterThan(0) // A faces camera
      expect(dot([-up[0], -up[1], -up[2]], cd)).toBeLessThan(0) // B hidden
    }
    // tile: slat k's fore extent meets slat k+1's hinge (no gaps)
    for (let k = 0; k + 1 < N; k++) {
      expect(dissolveSlatHingeD(CFG, k) + dissolvePitch(CFG)).toBeCloseTo(dissolveSlatHingeD(CFG, k + 1), 12)
    }
  })

  it('D4 tau=PI: every up-face is gold (B) toward the camera, dunes (A) hidden', () => {
    const [tL, tR] = bloom(REST)
    for (let k = 0; k < N; k++) {
      const q = dissolveSlatQuad(CFG, k, Math.PI, tL, tR)
      const up = dissolveUpFaceNormal(CFG, Math.PI, tL, tR)
      const cd = camDirTo(q)
      expect(dot([-up[0], -up[1], -up[2]], cd)).toBeGreaterThan(0) // B faces camera
      expect(dot(up, cd)).toBeLessThan(0) // A hidden
    }
  })

  it('D5 adjacent slats never overlap in d at any tau (no inter-slat z-fight)', () => {
    const p = dissolvePitch(CFG)
    for (let i = 0; i <= 180; i++) {
      const tau = (Math.PI * i) / 180
      for (let k = 0; k + 1 < N; k++) {
        const dhk = dissolveSlatHingeD(CFG, k)
        const dhk1 = dissolveSlatHingeD(CFG, k + 1)
        const kHi = Math.max(dhk, dhk + p * Math.cos(tau))
        const k1Lo = Math.min(dhk1, dhk1 + p * Math.cos(tau))
        expect(kHi - k1Lo).toBeLessThanOrEqual(1e-9) // disjoint interiors
      }
    }
  })

  it('D6 both end states are coplanar within the ROTOR_LIFT class', () => {
    for (const tau of [0, Math.PI]) {
      const [tL, tR] = bloom(REST)
      const n: Vec3 = CFG.side === 'left' ? [Math.sin(tL), -Math.cos(tL), 0] : [-Math.sin(tR), Math.cos(tR), 0]
      for (let k = 0; k < N; k++)
        for (const pt of dissolveSlatQuad(CFG, k, tau, tL, tR))
          expect(Math.abs(dot(pt, n))).toBeLessThanOrEqual(2 * DISSOLVE_BASE_LIFT + 1e-9)
    }
  })

  it('D7 the tab draws 0..stroke out the fore edge; nothing protrudes past it', () => {
    const [tL, tR] = bloom(REST)
    for (const tau of [0, Math.PI / 2, Math.PI]) {
      const tab = dissolveTabQuad(CFG, tau, tL, tR)
      const u: Vec3 = [Math.cos(tL), Math.sin(tL), 0]
      const maxD = Math.max(...tab.map((pt) => pt[0] * u[0] + pt[1] * u[1]))
      expect(maxD).toBeLessThanOrEqual(PAGE_W + dissolveStroke(CFG) + 1e-9)
    }
    expect(dissolveTabOut(CFG, Math.PI / 2)).toBeCloseTo(dissolveStroke(CFG) / 2, 10)
  })

  it('D8 both end states fold flat + stay in the page at book-closed', () => {
    const [tL, tR] = [Math.PI, Math.PI] // closed, left-page piece flat to the left
    const n: Vec3 = [Math.sin(tL), -Math.cos(tL), 0]
    for (const tau of [0, Math.PI]) {
      for (let k = 0; k < N; k++)
        for (const pt of dissolveSlatQuad(CFG, k, tau, tL, tR)) {
          expect(Math.abs(dot(pt, n))).toBeLessThanOrEqual(2 * DISSOLVE_BASE_LIFT + 1e-9)
          expect(Math.hypot(pt[0], pt[1])).toBeLessThanOrEqual(PAGE_W + 1e-9)
        }
    }
  })

  it('solveDissolvePose returns the base + N slats + the tab; solveLayerPose rejects it', () => {
    const pose = solveDissolvePose(CFG, Math.PI / 3, ...bloom(REST))
    expect(pose.slats).toHaveLength(N)
    expect(pose.base).toHaveLength(4)
    expect(pose.tab).toHaveLength(4)
    // clamps out-of-range flip
    expect(() => solveDissolvePose(CFG, 5, ...bloom(REST))).not.toThrow()
    expect(() => solveLayerPose(CFG, undefined, Math.PI, 0)).toThrow(/dissolve/)
  })
})

describe('dissolve family guards — the s5 ch4-dissolve placard', () => {
  const s5 = CHAPTERS.find((c) => c.spread === 5)!
  const layer = s5.layers.find((l) => l.id === 'ch4-dissolve')

  it('ships on spread 5, left page, as a 6-slat story piece clear of the neighbours', () => {
    expect(layer).toBeDefined()
    if (!layer || layer.mech !== 'dissolve') throw new Error('ch4-dissolve missing or wrong mech')
    expect(layer.side).toBe('left')
    expect(layer.slats).toBe(6)
    expect(layer.d0).toBeLessThan(layer.d1)
    expect(layer.z0).toBeLessThan(layer.z1)
    // clears the spine-hugging chest (d<=~0.24) and its own one-pitch B shift stays off-spine
    expect(layer.d0 - dissolvePitch(layer)).toBeGreaterThan(0.3)
    // the strip reaches the fore-edge slit from inside the page
    expect(layer.d1).toBeLessThan(PAGE_W)
  })

  it('is the only dissolve in the book (a new mechanism family for G1)', () => {
    const all = CHAPTERS.flatMap((c) => c.layers).filter((l) => l.mech === 'dissolve')
    expect(all).toHaveLength(1)
  })
})
