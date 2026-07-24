import { describe, expect, it } from 'vitest'
import {
  liftFlapBoardQuad,
  liftFlapDoorQuad,
  liftFlapEnvelope,
  liftFlapHingeFrame,
  liftFlapMax,
  liftFlapOpenAngle,
  liftFlapShownLift,
  solveLiftFlapPose,
  LIFTFLAP_BOARD_LIFT,
  LIFTFLAP_FLAP_LIFT,
  type LiftFlapGeom,
} from '@/components/labs/storybook/book/popup-liftflap'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import type { PanelQuad, Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import { PAGE_H, PAGE_W, easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'

// LIFT-THE-FLAP gates, ported in-engine from the source-of-truth bench
// .superpowers/sdd/bench/derive-liftflap.mjs (L1-L9). Uses the shipped s2
// ch1-keyboard config so the in-engine gates track content.ts exactly.

const rad = (d: number): number => (d * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const REST = rad(176)
const GLOBAL_CAP = 0.0497

// The shipped s2 key-board (content.ts ch1-keyboard).
const CFG: LiftFlapGeom = {
  mech: 'liftflap',
  side: 'right',
  hingeD: 0.44,
  leafLen: 0.16,
  boardD0: 0.4,
  boardD1: 0.62,
  boardZ0: -0.03,
  boardZ1: 0.42,
  doors: [
    { z0: -0.005, z1: 0.08, reveal: 'key', plate: 1 },
    { z0: 0.1, z1: 0.185, reveal: 'key', plate: 2 },
    { z0: 0.215, z1: 0.3, reveal: 'cat', plate: 3 },
    { z0: 0.33, z1: 0.415, reveal: 'key', plate: 4 },
  ],
}
const N = CFG.doors.length
const LIFT_MAX = liftFlapMax(CFG)

const pairwise = (q: PanelQuad): number[] => {
  const ds: number[] = []
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
  return ds
}
/** Signed distance of a point off the page plane (through the spine/origin). */
const pageNormal = (thetaR: number): Vec3 => [-Math.sin(thetaR), Math.cos(thetaR), 0]
const offPage = (p: Vec3, n: Vec3): number => dot(p, n)

describe('lift-flap — key-board gates (bench derive-liftflap.mjs, page-rooted)', () => {
  it('L1 hinge rigidity: each door leaf keeps its pairwise corner distances across the arc + beta sweep', () => {
    for (let k = 0; k < N; k++) {
      const ref = liftFlapDoorQuad(CFG, k, 0, ...bloom(REST))
      const refD = pairwise(ref)
      for (const aUser of [0, LIFT_MAX * 0.5, LIFT_MAX]) {
        for (const betaDeg of [8, 60, 120, 176]) {
          const q = liftFlapDoorQuad(CFG, k, aUser, ...bloom(rad(betaDeg)))
          pairwise(q).forEach((d, i) => expect(d).toBeCloseTo(refD[i], 9))
        }
      }
    }
  })

  it('L2 arc clamp + monotone: shown lift clamps at LIFT_MAX and rises monotonically with the reader angle', () => {
    const beta = REST
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const aUser = (rad(140) * i) / 200 // push PAST the ceiling to prove the clamp
      const a = liftFlapShownLift(CFG, aUser, beta)
      expect(a).toBeLessThanOrEqual(LIFT_MAX * liftFlapEnvelope(CFG, beta) + 1e-12)
      if (aUser <= LIFT_MAX) expect(a).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = a
    }
  })

  it('L3 host non-interpenetration: every leaf corner rides at/above the board plane through the arc', () => {
    for (let k = 0; k < N; k++) {
      for (let i = 0; i <= 80; i++) {
        const [tL, tR] = bloom(REST)
        const n = pageNormal(tR)
        const q = liftFlapDoorQuad(CFG, k, (LIFT_MAX * i) / 80, tL, tR)
        for (const p of q) expect(offPage(p, n)).toBeGreaterThanOrEqual(LIFTFLAP_BOARD_LIFT - 1e-9)
      }
    }
  })

  it('L4 neighbour non-interpenetration: doors occupy disjoint z-bands and each leaf preserves its band', () => {
    const sorted = [...CFG.doors].sort((a, b) => a.z0 - b.z0)
    for (let i = 0; i + 1 < sorted.length; i++) {
      expect(sorted[i + 1].z0).toBeGreaterThan(sorted[i].z1) // disjoint
    }
    for (let k = 0; k < N; k++) {
      for (const [betaDeg, aUser] of [[176, LIFT_MAX], [90, rad(50)], [30, rad(20)]] as const) {
        const q = liftFlapDoorQuad(CFG, k, aUser, ...bloom(rad(betaDeg)))
        const zs = q.map((p) => p[2]).sort((a, b) => a - b)
        expect(zs[0]).toBeCloseTo(CFG.doors[k].z0, 9) // leaf stays in its z-band
        expect(zs[3]).toBeCloseTo(CFG.doors[k].z1, 9)
      }
    }
  })

  it('L6 recess registration: the key art band sits inside the aperture and the lift uncovers it', () => {
    const L = CFG.leafLen
    const aOpen = liftFlapOpenAngle(CFG)
    const dCoverOpen = CFG.hingeD + L * Math.cos(aOpen) // fore extent still covered at open
    const dCoverShut = CFG.hingeD + L // shut covers the whole aperture
    const keyMargin = 0.02
    const dKey0 = dCoverOpen + keyMargin
    const dKey1 = CFG.hingeD + L - keyMargin
    // the key band is a real sub-band of the aperture ...
    expect(dKey0).toBeLessThan(dKey1)
    expect(dKey0).toBeGreaterThanOrEqual(CFG.hingeD - 1e-9)
    expect(dKey1).toBeLessThanOrEqual(CFG.hingeD + L + 1e-9)
    // ... shut covers it, open exposes it (art changes on lift — the G4 evidence)
    expect(dCoverShut).toBeGreaterThan(dKey1)
    expect(dCoverOpen).toBeLessThan(dKey0)
  })

  it('L7 fold-flat: at book-closed every board + leaf corner sits within the lift class of the flat page and inside the page rectangle, for ANY held reader angle', () => {
    const n = pageNormal(0)
    for (const aUser of [0, rad(45), LIFT_MAX, rad(140)]) {
      const pose = solveLiftFlapPose(CFG, CFG.doors.map(() => aUser), 0, 0)
      for (const p of [pose.board, ...pose.doors].flat()) {
        expect(Math.abs(offPage(p, n))).toBeLessThanOrEqual(LIFTFLAP_FLAP_LIFT + 1e-9)
        expect(p[0]).toBeGreaterThanOrEqual(-1e-9)
        expect(p[0]).toBeLessThanOrEqual(PAGE_W + 1e-9)
        expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9)
      }
    }
  })

  it('L8 drag: the pointer angle about a door hinge accumulates monotonically with unit gain over a monotone sweep', () => {
    const [tL, tR] = bloom(REST)
    const fr = liftFlapHingeFrame(CFG, 0, tL, tR)
    const wrapDelta = (x: number): number => Math.atan2(Math.sin(x), Math.cos(x))
    const r = 0.6 * CFG.leafLen
    let acc = 0
    let last: number | null = null
    let prev = 0
    for (let i = 0; i <= 480; i++) {
      const ang = (rad(120) * i) / 480 // sweep the hand 0 -> 120deg about the hinge
      const rel: Vec3 = [
        fr.flat[0] * r * Math.cos(ang) + fr.n[0] * r * Math.sin(ang),
        fr.flat[1] * r * Math.cos(ang) + fr.n[1] * r * Math.sin(ang),
        fr.flat[2] * r * Math.cos(ang) + fr.n[2] * r * Math.sin(ang),
      ]
      const measured = Math.atan2(dot(rel, fr.n), dot(rel, fr.flat))
      if (last !== null) acc += wrapDelta(measured - last)
      last = measured
      expect(acc).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = acc
    }
    expect(acc).toBeCloseTo(rad(120), 6)
  })

  it('L9 speed cap: at a frozen held reader angle, the fastest leaf corner real-time step over the eased page-turn clock stays under the global cap', () => {
    let capMax = 0
    for (let k = 0; k < N; k++) {
      let prev: PanelQuad | null = null
      for (let i = 0; i <= 240; i++) {
        const beta = Math.PI * easeTurnWeighted(i / 240)
        const q = liftFlapDoorQuad(CFG, k, LIFT_MAX, ...bloom(beta))
        if (prev) for (let c = 0; c < 4; c++) capMax = Math.max(capMax, dist(prev[c], q[c]))
        prev = q
      }
    }
    expect(capMax).toBeLessThan(GLOBAL_CAP)
  })

  it('coplanar rest: board rides one glue layer proud, a shut leaf one paper thickness above it', () => {
    const [tL, tR] = bloom(REST)
    const n = pageNormal(tR)
    for (const p of liftFlapBoardQuad(CFG, tL, tR)) expect(offPage(p, n)).toBeCloseTo(LIFTFLAP_BOARD_LIFT, 9)
    for (const p of liftFlapDoorQuad(CFG, 0, 0, tL, tR)) expect(offPage(p, n)).toBeCloseTo(LIFTFLAP_FLAP_LIFT, 9)
    expect(LIFTFLAP_BOARD_LIFT).toBeCloseTo(ROTOR_LIFT, 12)
    expect(LIFTFLAP_FLAP_LIFT).toBeCloseTo(2 * ROTOR_LIFT, 12)
  })

  it('the doors are free hand-driven handles: LIFT_MAX is the anti-flip ceiling and the envelope zeroes at close', () => {
    expect(deg(liftFlapMax(CFG))).toBeCloseTo(95, 9)
    expect(liftFlapEnvelope(CFG, 0)).toBeCloseTo(0, 12) // book closed -> every leaf flat
    expect(liftFlapEnvelope(CFG, REST)).toBeGreaterThan(0.99) // book open -> full lift
  })
})
