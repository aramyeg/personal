import { describe, expect, it } from 'vitest'
import {
  KEEPSAKE_SLIT_TOL,
  KEEPSAKE_SLEEVE_TOL,
  keepsakeCardInPlane,
  keepsakeCardW,
  keepsakeForeLead,
  keepsakePExit,
  keepsakeReturnStats,
  keepsakeSeatCorners,
  keepsakeTrailHome,
  keepsakeTwoLegPose,
} from '@/components/labs/storybook/book/popup-keepsake'
import {
  spreadPageAnglesTilted,
  type KeepsakeGeom,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import { EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'
import { PAGE_H, PAGE_W } from '@/components/labs/storybook/book/page-geometry'

// D6 REMOVABLE KEEPSAKE gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-keepsake.mjs (S1-S6). The subject is the
// SHIPPED card (spread 9 END endpaper) at its true tilted rest — grabs are
// legal only at settled rest (law H2), so a 1D pull scrub is the whole domain.

/** The D-G5 real-time perceptual speed cap (motion-character Gate 2). */
const GLOBAL_CAP = 0.0497

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const edgeLens = (q: readonly Vec3[]): number[] => [
  dist(q[0], q[1]),
  dist(q[1], q[2]),
  dist(q[2], q[3]),
  dist(q[3], q[0]),
]
const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

// The shipped card and its settled rest pose.
const KEEP = (EXTRA_SPREAD_LAYERS[9] as readonly SceneLayer[]).find(
  (l) => l.mech === 'keepsake'
) as SceneLayer & KeepsakeGeom
const { thetaL, thetaR } = spreadPageAnglesTilted(9, 9, null, 0)
const P_EXIT = keepsakePExit(KEEP)

describe('removable keepsake — D6 gates (bench derive-keepsake.mjs, shipped card)', () => {
  it('the END endpaper ships exactly one keepsake with the bench placement', () => {
    expect(KEEP.id).toBe('end-keepsake')
    expect(KEEP.side).toBe('right')
    expect(KEEP.z0).toBe(0.245)
    expect(KEEP.z1).toBe(0.395)
    expect(KEEP.cardL).toBe(0.34)
    expect(keepsakeCardW(KEEP)).toBeCloseTo(0.15, 12)
    // p_exit = cardL + tabLip; foreLead / trailHome the bench values
    expect(P_EXIT).toBeCloseTo(0.36, 12)
    expect(keepsakeForeLead(KEEP)).toBeCloseTo(1.13, 12)
    expect(keepsakeTrailHome(KEEP)).toBeCloseTo(0.79, 12)
  })

  it('S1 sleeve containment: through-slit + sleeve fit the page, gutter margin, 4:3 canon', () => {
    const cardW = keepsakeCardW(KEEP)
    const zc = (KEEP.z0 + KEEP.z1) / 2
    const zEdge = Math.abs(zc) + (cardW + KEEPSAKE_SLIT_TOL) / 2
    expect(zEdge).toBeLessThanOrEqual(PAGE_H / 2)
    expect(zEdge).toBeLessThanOrEqual(0.75) // bench S1 z-edge bound
    expect(keepsakeForeLead(KEEP)).toBeLessThanOrEqual(PAGE_W - 0.02)
    expect(keepsakeTrailHome(KEEP)).toBeGreaterThanOrEqual(0.06) // gutter margin (tabpiece T6)
    expect(Math.abs(KEEPSAKE_SLIT_TOL / KEEPSAKE_SLEEVE_TOL - 4 / 3)).toBeLessThan(0.05)
  })

  it('I1 coplanar slide: the in-sleeve card lies flat IN the page plane at every pull', () => {
    // Page normal for the card's page; a coplanar corner has zero normal height.
    const t = KEEP.side === 'left' ? thetaL : thetaR
    const n: Vec3 = KEEP.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
    for (let i = 0; i <= 240; i++) {
      const p = (P_EXIT * i) / 240
      for (const c of keepsakeCardInPlane(KEEP, p, thetaL, thetaR)) {
        expect(Math.abs(c[0] * n[0] + c[1] * n[1])).toBeLessThan(1e-12)
      }
    }
  })

  it('S2 extraction continuity: monotone lead, rigid card, C0-exact detach hand-off', () => {
    const refLen = edgeLens(keepsakeCardInPlane(KEEP, 0, thetaL, thetaR))
    let prevLeadX = -Infinity
    for (let i = 0; i <= 240; i++) {
      const p = (P_EXIT * i) / 240
      const card = keepsakeCardInPlane(KEEP, p, thetaL, thetaR)
      // the leading edge advances monotonically along the page run
      const leadX = Math.hypot(card[2][0], card[2][1])
      expect(leadX).toBeGreaterThanOrEqual(prevLeadX - 1e-12)
      prevLeadX = leadX
      // rigid: edge lengths constant across the whole slide
      edgeLens(card).forEach((len, k) => expect(len).toBeCloseTo(refLen[k], 9))
    }
    // C0 hand-off: the in-sleeve pose at p_exit IS the settle's first pose
    // (keepsakeTwoLegPose at progress 0 with start = the exit card).
    const exit = keepsakeCardInPlane(KEEP, P_EXIT, thetaL, thetaR)
    const seat = keepsakeSeatCorners(KEEP)
    const settleStart = keepsakeTwoLegPose(exit, seat, seat, 0)
    for (let k = 0; k < 4; k++) expect(dist(settleStart[k], exit[k])).toBeLessThan(1e-12)
  })

  it('S5 auto-return: monotone, and the worst per-station step stays under the global cap', () => {
    const stats = keepsakeReturnStats(KEEP, thetaL, thetaR)
    expect(stats.monotone).toBe(true)
    expect(stats.worstStep).toBeLessThan(GLOBAL_CAP)
    expect(stats.worstStep).toBeCloseTo(0.0328, 3) // the bench-measured worst step
  })

  it('the settle (exit -> seat) also holds under the cap and is C0 at the seat', () => {
    const exit = keepsakeCardInPlane(KEEP, P_EXIT, thetaL, thetaR)
    const seat = keepsakeSeatCorners(KEEP)
    let worst = 0
    let prev: readonly Vec3[] | null = null
    for (let i = 0; i <= 240; i++) {
      const eased = easeTurnWeighted(i / 240)
      const pose = keepsakeTwoLegPose(exit, seat, seat, eased)
      if (prev) for (let k = 0; k < 4; k++) worst = Math.max(worst, dist(prev[k], pose[k]))
      prev = pose
    }
    expect(worst).toBeLessThan(GLOBAL_CAP)
    // at full progress the settle lands EXACTLY on the seat
    const landed = keepsakeTwoLegPose(exit, seat, seat, 1)
    for (let k = 0; k < 4; k++) expect(dist(landed[k], seat[k])).toBeLessThan(1e-12)
  })

  it('the auto-return lands home exactly (reverse polyline seat -> exit -> home)', () => {
    const seat = keepsakeSeatCorners(KEEP)
    const exit = keepsakeCardInPlane(KEEP, P_EXIT, thetaL, thetaR)
    const home = keepsakeCardInPlane(KEEP, 0, thetaL, thetaR)
    const landed = keepsakeTwoLegPose(seat, exit, home, 1)
    for (let k = 0; k < 4; k++) expect(dist(landed[k], home[k])).toBeLessThan(1e-12)
  })

  it('seat pose: a rigid flat card downstage-center, tilted far-edge-up toward the camera', () => {
    const seat = keepsakeSeatCorners(KEEP)
    // rigid: the seated card keeps the card's length and width
    const lens = edgeLens(seat)
    expect(lens[0]).toBeCloseTo(keepsakeCardW(KEEP), 12) // trail edge (z span)
    expect(lens[1]).toBeCloseTo(KEEP.cardL, 12) // side edge (x span)
    // centroid sits at the authored seat (bench S4 placement)
    const cx = seat.reduce((s, c) => s + c[0], 0) / 4
    const cy = seat.reduce((s, c) => s + c[1], 0) / 4
    const cz = seat.reduce((s, c) => s + c[2], 0) / 4
    expect(cx).toBeCloseTo(0.33, 6)
    expect(cy).toBeCloseTo(0.055, 6)
    expect(cz).toBeCloseTo(1.06, 6)
    // tilted far-edge-up: the far (-z) edge stands higher than the near (+z) one
    const farY = (seat[0][1] + seat[3][1]) / 2 // corners at -W/2 (far edge)
    const nearY = (seat[1][1] + seat[2][1]) / 2 // corners at +W/2 (near edge)
    expect(farY).toBeGreaterThan(nearY)
  })

  it('S6 flat-fold: the card home folds EXACTLY flat inside the closed page', () => {
    // closed book: both pages flat (thetaR = 0 for the right page), card home.
    const home = keepsakeCardInPlane(KEEP, 0, 0, 0)
    for (const c of home) {
      expect(Math.abs(c[1])).toBeLessThan(1e-12) // dead flat, y = 0
      expect(c[0]).toBeGreaterThanOrEqual(-1e-12) // never crosses the spine
      expect(c[0]).toBeLessThanOrEqual(PAGE_W + 1e-12) // within the fore edge
      expect(Math.abs(c[2])).toBeLessThanOrEqual(PAGE_H / 2 + 1e-12) // within the depth
    }
  })
})
