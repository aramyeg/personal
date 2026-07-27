/**
 * THE CRANK BENCH — what a hand has to do to hoist the tower.
 *
 * WHY THIS FILE EXISTS. A blind reviewer with no knowledge of the code cranked
 * ch3-keep-winch and filed four separate complaints:
 *   "slow, deliberate turning is simply ignored — only fast flicks engage it";
 *   "one flick consumes the whole 302 degrees in about a second";
 *   "the hard stop cannot be felt at all";
 *   "eight reverse flicks left it hoisted — I could not get it back down".
 * A per-move trace of the live page (bench/syspatch-winch-trace.mjs) showed all
 * four were one defect: the disc accumulated the RAW atan2 SWEEP about its hub,
 * whose gain is unbounded at the centre and vanishing at the rim. The trace of a
 * hand circling the disc reads: wind climbs to 95.6deg, then FALLS to 81 while
 * the hand keeps turning the same way, freezes for four moves, drops to 0, and
 * climbs again — 540 degrees of honest cranking producing 87 degrees of noise.
 *
 * Every existing winch suite passed throughout, because they all feed theta by
 * hand. handle-drag-regression.test.ts passed too — and was measuring the wrong
 * thing entirely: it called keepWinchDiscQuad(geom, thetaL, thetaR, spin) when
 * the signature is (geom, theta, thetaL, thetaR), so its "drive" was landing in
 * the page-angle slot (fixed there).
 *
 * So this bench asks the questions a reader's hand asks, of the real pipeline
 * (ray -> projectHubAngle -> crankTangentialDelta -> keepWinchCrankStep):
 *   - can a SLOW crank traverse 0 -> max -> 0?
 *   - is the whole travel WORK, i.e. several strokes of a real hand?
 *   - does turning slowly cost the same as turning fast (a path mapping, not a
 *     velocity one)?
 *   - does a stroke straight ACROSS the face turn it, as a flick used to?
 *   - does cranking near the centre turn it as much as cranking at the rim?
 *   - is the stop reachable, and does it stiffen on the way in?
 *
 * The hand path is stated in the disc's OWN plane and the rays are aimed at it
 * from the pinned reading camera, so the projector is exercised for real; the
 * hand's cost is reported in reference-viewport pixels through the book's one
 * camera definition (reading-stage.ts), which is the unit the reviewer's
 * complaint was in.
 */

import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  crankTangentialDelta,
  projectHubAngle,
  type HubHit,
} from '@/components/labs/storybook/book/handle-projection'
import { spreadPageAnglesTilted, type Vec3 } from '@/components/labs/storybook/book/popup-mechanics'
import {
  KEEP_WINCH_CRANK_GEAR,
  keepWinchAtPawl,
  keepWinchCrankResist,
  keepWinchCrankStep,
  keepWinchShownTheta,
  keepWinchThetaMax,
  type KeepWinchGeom,
} from '@/components/labs/storybook/book/popup-keepwinch'
import { ROTOR_LIFT } from '@/components/labs/storybook/book/popup-rotor'
import { toScreenPx } from '@/components/labs/storybook/book/reading-stage'
import {
  SPREAD_COUNT,
  popupContentForSpread,
  type SceneLayer,
} from '@/components/labs/storybook/content'

const CAMERA = new THREE.Vector3(0, 1.85, 3.05)
const deg = (r: number): number => (r * 180) / Math.PI
const rad = (d: number): number => (d * Math.PI) / 180

function locate(id: string): { layer: SceneLayer; spreadIndex: number } {
  for (let s = 0; s < SPREAD_COUNT; s++) {
    const layer = popupContentForSpread(s)?.layers.find((l) => l.id === id)
    if (layer) return { layer, spreadIndex: s }
  }
  throw new Error(`no layer ${id} in the book`)
}

/** The winch disc's own frame, exactly as the layer builds it. */
function discFrame(geom: KeepWinchGeom, thetaL: number, thetaR: number) {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 =
    geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const center: Vec3 = [
    geom.hubD * u[0] + ROTOR_LIFT * n[0],
    geom.hubD * u[1] + ROTOR_LIFT * n[1],
    geom.hubZ,
  ]
  return { u, n, center, ez: [0, 0, 1] as Vec3 }
}

const { layer, spreadIndex } = locate('ch3-keep-winch')
const GEOM = layer as SceneLayer & KeepWinchGeom
const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
const FR = discFrame(GEOM, thetaL, thetaR)
const THETA_MAX = keepWinchThetaMax(GEOM)

/** A point on the disc's face at polar (a, k*discR), in world coordinates. */
function faceAt(a: number, k: number): THREE.Vector3 {
  const r = k * GEOM.discR
  return new THREE.Vector3(
    FR.center[0] + FR.u[0] * r * Math.cos(a) + FR.ez[0] * r * Math.sin(a),
    FR.center[1] + FR.u[1] * r * Math.cos(a) + FR.ez[1] * r * Math.sin(a),
    FR.center[2] + FR.u[2] * r * Math.cos(a) + FR.ez[2] * r * Math.sin(a)
  )
}

/** The real projector, aimed from the reading camera at a world point. */
function hitAt(p: THREE.Vector3): HubHit {
  const ray = new THREE.Ray(CAMERA.clone(), p.clone().sub(CAMERA).normalize())
  const hub = projectHubAngle(ray, FR.center, FR.u, FR.ez, FR.n)
  expect(hub, 'the projector missed the disc it was aimed at').not.toBeNull()
  return hub as HubHit
}

const screenPx = (p: THREE.Vector3): { x: number; y: number } => toScreenPx([p.x, p.y, p.z])

type Stroke = {
  /** Wind (rad) the crank ended at. */
  theta: number
  /** Hand rotation about the hub, in degrees, that it cost. */
  handDeg: number
  /** Hand path length on screen, in reference-viewport px, that it cost. */
  handPx: number
  /** Whether the loop hit its iteration cap without reaching the target. */
  ranOut: boolean
}

/**
 * Cranks the disc from `theta0` in `dir`, `stepDeg` of hand rotation per
 * pointer move at radius `k`, until `stop(theta)` says so (or the cap). This is
 * the whole shipped pipeline: aim a ray, project, take the tangential crank,
 * gear it, stiffen it.
 */
function crank(
  theta0: number,
  dir: 1 | -1,
  { stepDeg = 3, k = 0.8, cap = 4000, stop }: { stepDeg?: number; k?: number; cap?: number; stop: (t: number) => boolean }
): Stroke {
  let theta = theta0
  let a = 0
  let prevPoint = faceAt(a, k)
  let prev = hitAt(prevPoint)
  let handPx = 0
  let i = 0
  for (; i < cap && !stop(theta); i++) {
    a += dir * rad(stepDeg)
    const point = faceAt(a, k)
    const next = hitAt(point)
    theta = keepWinchCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.discR))
    const p0 = screenPx(prevPoint)
    const p1 = screenPx(point)
    handPx += Math.hypot(p1.x - p0.x, p1.y - p0.y)
    prev = next
    prevPoint = point
  }
  return { theta, handDeg: i * stepDeg, handPx, ranOut: i >= cap }
}

describe('the tower hoist answers a hand that turns it', () => {
  /**
   * THE GATE THE ROUND ASKED FOR, in one sentence: a scripted SLOW crank must
   * traverse 0 -> max -> 0. Nothing about this stroke is fast — three degrees of
   * hand rotation per pointer move is a deliberate, unhurried turn, and it is
   * exactly the gesture the reviewer reported as "simply ignored".
   */
  it('a slow crank traverses 0 -> max -> 0', () => {
    const up = crank(0, 1, { stepDeg: 3, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(
      up.ranOut,
      `slow cranking never reached the stop: got ${deg(up.theta).toFixed(1)}deg of ${deg(THETA_MAX).toFixed(1)}deg`
    ).toBe(false)
    expect(up.theta).toBeCloseTo(THETA_MAX, 6)

    const down = crank(up.theta, -1, { stepDeg: 3, stop: (t) => t <= 1e-6 })
    expect(
      down.ranOut,
      `slow cranking never brought it back down: stuck at ${deg(down.theta).toFixed(1)}deg ` +
        `(the reviewer's "eight reverse flicks left it hoisted")`
    ).toBe(false)
    expect(down.theta).toBeCloseTo(0, 6)
  })

  /**
   * A HOIST IS WORK. The user's note on this machine was that its wheel should
   * move bigger structures; the round's bar was that the full travel should take
   * three or more half-turns of real hand motion rather than the single flick it
   * shipped as. The upper bound is here so a future gear change cannot quietly
   * make the crank interminable instead.
   */
  it('the full travel costs several strokes of a real hand', () => {
    const up = crank(0, 1, { stepDeg: 3, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(
      up.handDeg,
      `full hoist costs only ${up.handDeg}deg of hand (${Math.round(up.handPx)}px) — a flick`
    ).toBeGreaterThanOrEqual(540)
    expect(up.handDeg, `full hoist costs ${up.handDeg}deg of hand — nobody will finish it`).toBeLessThanOrEqual(1440)
    // And it is a real journey on the desk, not a twitch: the reviewer measured
    // the old crank in ~1s of pointer motion.
    expect(up.handPx).toBeGreaterThan(300)
  })

  /**
   * SLOW MUST COST WHAT FAST COSTS. The reviewer's headline complaint was a
   * velocity dependence. There is no velocity in this mapping at all — it reads
   * the PATH the hand took — and this is the assertion that keeps it that way:
   * the same hand journey sampled at 1deg and at 20deg per move must land in the
   * same place.
   */
  it('turning slowly costs exactly what turning fast costs', () => {
    const stop = (t: number) => t >= THETA_MAX - 1e-6
    const fine = crank(0, 1, { stepDeg: 1, stop })
    const coarse = crank(0, 1, { stepDeg: 20, stop })
    expect(fine.ranOut).toBe(false)
    expect(coarse.ranOut).toBe(false)
    const ratio = coarse.handDeg / fine.handDeg
    expect(
      ratio,
      `a coarse (fast) hand paid ${coarse.handDeg}deg where a fine (slow) hand paid ${fine.handDeg}deg`
    ).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1.25)
  })

  /**
   * A STROKE ACROSS THE FACE IS NOT A TURN. This is the gesture that used to eat
   * the whole window in one flick: a straight drag through the middle of the
   * disc, which the old atan2 mapping read as ~180deg of instant sweep. Pushing
   * straight across a knob does not turn it — the paper slides under the finger.
   */
  it('a flick straight across the hub barely turns it', () => {
    let theta = 0
    const steps = 24
    let prev = hitAt(faceAt(0, 1.0))
    for (let i = 1; i <= steps; i++) {
      // From one rim, straight through the hub, out the other side.
      const s = -1 + (2 * i) / steps
      const p = new THREE.Vector3(
        FR.center[0] + FR.u[0] * s * GEOM.discR,
        FR.center[1] + FR.u[1] * s * GEOM.discR,
        FR.center[2] + FR.u[2] * s * GEOM.discR
      )
      const next = hitAt(p)
      theta = keepWinchCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.discR))
      prev = next
    }
    expect(
      deg(theta),
      `one straight flick across the face wound ${deg(theta).toFixed(1)}deg of ${deg(THETA_MAX).toFixed(1)}deg`
    ).toBeLessThan(deg(THETA_MAX) * 0.05)
  })

  /**
   * PAPER TRUTH FOR A KNOB: the further out you grip, the more you turn. A hand
   * sweeping the same ANGLE at half the radius does half the work — and a hand
   * at the very centre does none, which is why no deadzone gate is needed to
   * hide a singularity that no longer exists.
   */
  it('gripping nearer the centre turns it less', () => {
    const sweep = (k: number): number => {
      let theta = 0
      let prev = hitAt(faceAt(0, k))
      for (let i = 1; i <= 30; i++) {
        const next = hitAt(faceAt(rad(3 * i), k))
        theta = keepWinchCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.discR))
        prev = next
      }
      return theta
    }
    const rim = sweep(1.0)
    const half = sweep(0.5)
    const middle = sweep(0.08)
    expect(half / rim).toBeGreaterThan(0.35)
    expect(half / rim).toBeLessThan(0.65)
    expect(middle).toBeLessThan(rim * 0.15)
  })

  /**
   * THE GEAR, stated once so a change to it is a deliberate act. Outside the
   * end-stop ramp, a hand sweeping the rim turns the wind by its own sweep times
   * KEEP_WINCH_CRANK_GEAR — which is what makes the whole hoist several turns of
   * work rather than one.
   */
  it('a rim sweep is geared down by exactly the crank gear', () => {
    let theta = 0
    let prev = hitAt(faceAt(0, 1.0))
    const handDeg = 60
    for (let i = 1; i <= handDeg; i++) {
      const next = hitAt(faceAt(rad(i), 1.0))
      theta = keepWinchCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.discR))
      prev = next
    }
    expect(deg(theta) / handDeg).toBeCloseTo(KEEP_WINCH_CRANK_GEAR, 1)
  })

  /**
   * THE STOP IS FELT, AND IT IS STILL REACHABLE. The resistance ramp is the
   * hand's half of the end-stop (the wheel's half is keepWinchShownTheta, which
   * gives up travel and seats). A floor of zero would be a wall the reader can
   * never touch, which is a bug rather than a feel.
   */
  it('the crank stiffens into its stop without ever jamming', () => {
    expect(keepWinchCrankResist(GEOM, 0)).toBeCloseTo(1, 6)
    expect(keepWinchCrankResist(GEOM, THETA_MAX * 0.5)).toBeCloseTo(1, 6)
    const atStop = keepWinchCrankResist(GEOM, THETA_MAX)
    expect(atStop, 'the stop is a wall the hand can never cross').toBeGreaterThan(0.1)
    expect(atStop, 'the stop is not felt at all').toBeLessThan(0.6)
    // Monotone: never easier further in.
    let prev = 1
    for (let i = 0; i <= 40; i++) {
      const r = keepWinchCrankResist(GEOM, (THETA_MAX * i) / 40)
      expect(r).toBeLessThanOrEqual(prev + 1e-9)
      prev = r
    }
    // And the wheel seats: at the stop it shows LESS than the wind it holds.
    expect(keepWinchAtPawl(GEOM, 0)).toBe(false)
    expect(keepWinchAtPawl(GEOM, THETA_MAX)).toBe(true)
    expect(keepWinchShownTheta(GEOM, THETA_MAX)).toBeLessThan(THETA_MAX)
  })

  /**
   * COMING BACK DOWN IS NOT A DIFFERENT SKILL. The reviewer could not reverse
   * this machine at all. The return may cost a little less than the climb —
   * winding pays the end-stop ramp and unwinding does not — but not a different
   * order of effort, or the reader will conclude it is a ratchet.
   */
  it('the return costs about what the climb cost', () => {
    const up = crank(0, 1, { stepDeg: 3, stop: (t) => t >= THETA_MAX - 1e-6 })
    const down = crank(up.theta, -1, { stepDeg: 3, stop: (t) => t <= 1e-6 })
    const ratio = down.handDeg / up.handDeg
    expect(ratio, `climb ${up.handDeg}deg vs return ${down.handDeg}deg`).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(1.1)
  })
})

describe('crankTangentialDelta — the shared crank read', () => {
  const hit = (angleDeg: number, r: number): HubHit => ({ angle: rad(angleDeg), r })

  it('is 1:1 with a hand sweeping at the reference radius', () => {
    expect(crankTangentialDelta(hit(0, 1), hit(10, 1), 1)).toBeCloseTo(rad(10), 3)
    expect(crankTangentialDelta(hit(90, 1), hit(95, 1), 1)).toBeCloseTo(rad(5), 3)
  })

  it('is exactly antisymmetric, so reverse costs what forward cost', () => {
    const f = crankTangentialDelta(hit(20, 0.7), hit(50, 0.7), 1)
    const b = crankTangentialDelta(hit(50, 0.7), hit(20, 0.7), 1)
    expect(f).toBeCloseTo(-b, 12)
  })

  it('scales with the radius the hand grips at', () => {
    const rim = crankTangentialDelta(hit(0, 1), hit(20, 1), 1)
    const half = crankTangentialDelta(hit(0, 0.5), hit(20, 0.5), 1)
    expect(half / rim).toBeCloseTo(0.5, 6)
  })

  it('returns nothing for a step straight across the hub', () => {
    expect(crankTangentialDelta(hit(0, 1), hit(180, 1), 1)).toBeCloseTo(0, 9)
  })

  it('returns nothing at the hub itself, rather than a singularity', () => {
    expect(crankTangentialDelta(hit(0, 0), hit(90, 1), 1)).toBe(0)
    expect(Number.isFinite(crankTangentialDelta(hit(0, 1e-7), hit(90, 1e-7), 1))).toBe(true)
  })
})
