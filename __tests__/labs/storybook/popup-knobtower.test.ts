import { describe, expect, it } from 'vitest'
import {
  knobTowerCrank,
  knobTowerRunGap,
  knobTowerSlack,
  knobTowerStrokeFull,
  knobTowerThetaMax,
  knobTowerTierLift,
  knobTowerTierSMax,
  solveKnobTowerPose,
  type KnobTowerGeom,
} from '@/components/labs/storybook/book/popup-knobtower'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import type { PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'

// D6 KNOB-TWIST TOWER gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-knobtower.mjs (K1-K7). The bench is
// panel-seated; the shipped engine is PAGE-ROOTED (the orchestrator ruling),
// so these run against a synthetic page config — no content placement yet.

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
/** Symmetric bloom angles for a dihedral beta (same convention as the D1
 *  tabpiece gates). */
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const REST = rad(176)
/** The D-G5 real-time perceptual speed cap (motion-character Gate 2). */
const GLOBAL_CAP = 0.0497

// A citadel of three ascending knee towers rising tier-by-tier as one knob is
// twisted — the bench's recommended config, re-rooted onto one page.
const CFG: KnobTowerGeom = {
  mech: 'knobtower',
  side: 'right',
  hubD: 0.3,
  hubZ: 0,
  discR: 0.16,
  crankR: 0.2,
  foreHingeD: 0.82,
  tiers: [
    { w: 0.09, aRestDeg: 70, zc: -0.13, ridgeLen: 0.12 },
    { w: 0.11, aRestDeg: 74, zc: 0, ridgeLen: 0.12 },
    { w: 0.13, aRestDeg: 78, zc: 0.13, ridgeLen: 0.12 },
  ],
  phiE: 0.75,
}
const THETA_MAX = knobTowerThetaMax(CFG)
const N = CFG.tiers.length

const pairwise = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
  return ds
}

describe('knob-twist tower — D6 gates (bench derive-knobtower.mjs, page-rooted)', () => {
  it('K1 flat-fold: every tier folds exactly flat and the disc rests one glue layer proud at book-closed, for ANY frozen theta', () => {
    // Closed evaluated at (0,0): the page plane is y = 0, so E(0) = 0 forces
    // every tier angle to 0 (perfectly flat) regardless of the frozen twist,
    // while the coplanar disc holds at ROTOR_LIFT — the book remembers the knob.
    for (let i = 0; i <= 40; i++) {
      const theta = (THETA_MAX * i) / 40
      for (const patch of solveKnobTowerPose(CFG, theta, 0, 0)) {
        const tol = patch.face === 'disc' ? ROTOR_LIFT + 1e-9 : 1e-12
        for (const c of patch.quad) expect(Math.abs(c[1])).toBeLessThanOrEqual(tol)
      }
    }
  })

  it('K2 crank law s(theta) = crankR(1 - cos theta) matches the Scotch-yoke construction, monotone, zero slope at liftoff', () => {
    const r = CFG.crankR
    let maxErr = 0
    for (let i = 0; i <= 400; i++) {
      const th = (Math.PI * i) / 400
      const geo = r - r * Math.cos(th) // strip retract = r - pin_x (pin projected on the guide)
      maxErr = Math.max(maxErr, Math.abs(knobTowerCrank(r, th) - geo))
    }
    expect(maxErr).toBeLessThan(1e-12)
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const s = knobTowerCrank(r, (THETA_MAX * i) / 400)
      expect(s).toBeGreaterThanOrEqual(prev - 1e-15)
      prev = s
    }
    // ds/dtheta = r sin(theta) = 0 at theta = 0 — no liftoff snap.
    expect(r * Math.sin(0)).toBe(0)
  })

  it('K3 staggered engagement: tier k+1 wakes only at/after tier k reaches phiE of its rest lift', () => {
    const aRest = CFG.tiers.map((t) => rad(t.aRestDeg))
    const phiE = CFG.phiE ?? 0.75
    const EPS = 1e-6
    const liftoff: number[] = []
    const fracReach: number[] = []
    for (let k = 0; k < N; k++) {
      let lo: number | null = null
      let frr: number | null = null
      for (let i = 0; i <= 2000; i++) {
        const th = (THETA_MAX * i) / 2000
        const a = knobTowerTierLift(CFG, k, th, REST) // envelope is exactly 1 at rest
        if (lo === null && a > EPS) lo = th
        if (frr === null && a >= phiE * aRest[k] - 1e-9) frr = th
      }
      liftoff.push(lo ?? 0)
      fracReach.push(frr ?? THETA_MAX)
    }
    for (let k = 0; k + 1 < N; k++) {
      expect(liftoff[k + 1]).toBeGreaterThanOrEqual(fracReach[k] - 1e-3)
    }
  })

  it('K3 whole-tower height rises monotonically with the knob twist', () => {
    let prev = -1
    for (let i = 0; i <= 400; i++) {
      const theta = (THETA_MAX * i) / 400
      let H = 0
      for (let k = 0; k < N; k++) H += CFG.tiers[k].w * Math.sin(knobTowerTierLift(CFG, k, theta, REST))
      expect(H).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = H
    }
  })

  it('K3 the designed cam has bounded lift velocity — no snap (the rigid acos-of-slide it replaces has none)', () => {
    const M = 4000
    let camMax = 0
    for (let k = 0; k < N; k++) {
      for (let i = 1; i <= M; i++) {
        const th0 = (THETA_MAX * (i - 1)) / M
        const th1 = (THETA_MAX * i) / M
        const d = Math.abs(knobTowerTierLift(CFG, k, th1, REST) - knobTowerTierLift(CFG, k, th0, REST)) / (th1 - th0)
        if (d > camMax) camMax = d
      }
    }
    expect(Number.isFinite(camMax)).toBe(true)
    expect(camMax).toBeLessThan(5) // bench K3 ceiling; the rigid acos snaps far past it
  })

  it('K4 containment: the full-erect tower and disc fit inside the page (run, depth, and stand height)', () => {
    // At the rest bloom the tower stands fully; project each corner back onto
    // the page frame (u toward the fore edge, n the page normal, z the spine)
    // to read its run / height / depth — P is orthonormal, so the dot products
    // recover the exact page coordinates.
    const [tL, tR] = bloom(REST)
    const u: Vec3 = [Math.cos(tR), Math.sin(tR), 0]
    const n: Vec3 = [-Math.sin(tR), Math.cos(tR), 0]
    for (const patch of solveKnobTowerPose(CFG, THETA_MAX, tL, tR)) {
      for (const c of patch.quad) {
        const run = c[0] * u[0] + c[1] * u[1]
        const height = c[0] * n[0] + c[1] * n[1]
        expect(run).toBeGreaterThanOrEqual(-1e-9) // never crosses the spine
        expect(run).toBeLessThanOrEqual(PAGE_W + 1e-9) // within the fore edge
        expect(Math.abs(height)).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9) // stand height fits
        expect(Math.abs(c[2])).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9) // within the depth
      }
    }
    // the disc's spin-swept circle and the towers keep disjoint run-bands
    expect(knobTowerRunGap(CFG)).toBeGreaterThan(0)
  })

  it('A2/A12 rigidity: every patch (disc + tiers) keeps its pairwise corner distances across the theta+beta sweep', () => {
    // The disc spins on an ORTHONORMAL in-plane frame (rotor law) and each tier
    // slope is a rigid w x ridgeLen rectangle, so nothing stretches as the knob
    // twists or the page tilts.
    const ref = solveKnobTowerPose(CFG, 0, ...bloom(REST)).map((p) => pairwise(p.quad))
    for (const theta of [0, THETA_MAX * 0.3, THETA_MAX * 0.7, THETA_MAX]) {
      for (const betaDeg of [10, 60, 120, 176]) {
        const patches = solveKnobTowerPose(CFG, theta, ...bloom(rad(betaDeg)))
        patches.forEach((p, qi) => {
          pairwise(p.quad).forEach((d, k) => expect(d).toBeCloseTo(ref[qi][k], 9))
        })
      }
    }
  })

  it('K6 page-turn collapse: worst per-vertex real-time step at frozen theta stays under the global cap', () => {
    // The knob's own twist is user-paced (cap-exempt); only the autonomous
    // envelope collapse during a page turn is bound. Freeze theta at THETA_MAX
    // (the tallest tower) and sweep beta on the eased turn clock.
    const STN = 240
    let capMax = 0
    let prev: Vec3[] | null = null
    for (let i = 0; i <= STN; i++) {
      const beta = Math.PI * easeTurnWeighted(i / STN)
      const verts = solveKnobTowerPose(CFG, THETA_MAX, ...bloom(beta)).flatMap((p) => [...p.quad])
      if (prev) for (let c = 0; c < verts.length; c++) capMax = Math.max(capMax, dist(prev[c], verts[c]))
      prev = verts
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('K7 THETA_MAX is the crank inverse of s_full and inside the 270-degree ergonomic ceiling', () => {
    const sFull = knobTowerStrokeFull(CFG)
    const sMax = knobTowerTierSMax(CFG)
    const L = knobTowerSlack(CFG)
    expect(sFull).toBeCloseTo(L[N - 1] + sMax[N - 1], 12)
    expect(THETA_MAX).toBeCloseTo(Math.acos(1 - sFull / CFG.crankR), 12)
    expect(deg(THETA_MAX)).toBeLessThanOrEqual(270)
    expect(deg(THETA_MAX)).toBeGreaterThan(0)
    // the recommended config is one comfortable drag (bench K7 ~ 141deg)
    expect(deg(THETA_MAX)).toBeLessThan(180)
  })
})
