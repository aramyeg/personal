/**
 * THE COUNTING-WHEEL CRANK BENCH — what a hand has to do to turn s7's volvelle.
 *
 * WHY THIS FILE EXISTS. The systems patch fixed the keep winch's input and
 * filed the volvelle as still carrying the defect ("LATENT: volvelle +
 * knobtower still carry the old atan2 crank — same treatment next round"). A
 * blind re-reader then turned s7's counting wheel two full revolutions each way
 * and reported "no end-stop, no detents, no resistance change" — and a live hand
 * probe (bench/s7r2-drag-live.mjs, real Playwright mouse, drive channel read
 * back per sub-step) measured exactly the winch's four symptoms again:
 *
 *   240 px stroke across the rim   ->  2.3, 10.4, 13.2, ... 17.4 deg, asymptotic
 *   the same stroke reversed       ->  0.0 at every one of twelve samples
 *   200 px straight down           ->  3.1 deg
 *
 * Seventeen degrees for two thirds of the page, on a wheel whose whole travel is
 * 360 deg and whose detent is 45: less than half of one room, for a gesture no
 * reader would repeat.
 *
 * So this bench asks the reader's questions of the REAL pipeline (ray ->
 * projectHubAngle -> crankTangentialDelta -> volvelleCrankStep), the same shape
 * as winch-crank.test.ts, plus the two the winch does not have: are the DETENTS
 * felt, and is the wheel bounded at BOTH ends?
 *
 * The hand path is stated in the disc's own plane and the rays are aimed at it
 * from the pinned reading camera, so the projector is exercised for real; costs
 * are reported in reference-viewport px through the book's one camera
 * definition, which is the unit the complaint was in.
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
  VOLVELLE_CRANK_GEAR,
  VOLVELLE_LIFT,
  volvelleCrankStep,
  volvelleDetentCell,
  volvelleDetentGear,
  volvelleDetentStep,
  volvelleEndResist,
  volvelleHubFrame,
  volvelleSectorSeen,
  volvelleThetaMax,
  type VolvelleGeom,
} from '@/components/labs/storybook/book/popup-volvelle'
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

const { layer, spreadIndex } = locate('ch6-assay')
const GEOM = layer as SceneLayer & VolvelleGeom
const { thetaL, thetaR } = spreadPageAnglesTilted(spreadIndex, spreadIndex, null, 0)
const FR = volvelleHubFrame(GEOM, thetaL, thetaR, VOLVELLE_LIFT)
const THETA_MAX = volvelleThetaMax()
const STEP = volvelleDetentStep(GEOM)

/** A point on the dial's face at polar (a, k*radius), in world coordinates. */
function faceAt(a: number, k: number): THREE.Vector3 {
  const r = k * GEOM.radius
  return new THREE.Vector3(
    FR.center[0] + FR.e1[0] * r * Math.cos(a) + FR.e2[0] * r * Math.sin(a),
    FR.center[1] + FR.e1[1] * r * Math.cos(a) + FR.e2[1] * r * Math.sin(a),
    FR.center[2] + FR.e1[2] * r * Math.cos(a) + FR.e2[2] * r * Math.sin(a)
  )
}

/** The real projector, aimed from the reading camera at a world point. */
function hitAt(p: THREE.Vector3): HubHit {
  const ray = new THREE.Ray(CAMERA.clone(), p.clone().sub(CAMERA).normalize())
  const hub = projectHubAngle(ray, FR.center, FR.e1, FR.e2, FR.n)
  expect(hub, 'the projector missed the dial it was aimed at').not.toBeNull()
  return hub as HubHit
}

const screenPx = (p: THREE.Vector3): { x: number; y: number } => toScreenPx([p.x, p.y, p.z])

type Stroke = { theta: number; handDeg: number; handPx: number; ranOut: boolean }

/** Cranks the dial from `theta0` in `dir`, `stepDeg` of hand rotation per
 *  pointer move at radius `k`, until `stop(theta)` (or the cap). The whole
 *  shipped pipeline: aim, project, tangential crank, gear, notch, stop. */
function crank(
  theta0: number,
  dir: 1 | -1,
  { stepDeg = 3, k = 0.8, cap = 6000, stop }: { stepDeg?: number; k?: number; cap?: number; stop: (t: number) => boolean }
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
    theta = volvelleCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.radius))
    const p0 = screenPx(prevPoint)
    const p1 = screenPx(point)
    handPx += Math.hypot(p1.x - p0.x, p1.y - p0.y)
    prev = next
    prevPoint = point
  }
  return { theta, handDeg: i * stepDeg, handPx, ranOut: i >= cap }
}

describe('the counting wheel answers a hand that turns it', () => {
  it('the shipped wheel declares the tangential read (the syspatch latent item)', () => {
    expect(
      GEOM.crank,
      'ch6-assay is back on the atan2 sweep — the read the live probe measured as dead'
    ).toBe('tangential')
  })

  /** The gate the round asked for: a scripted SLOW crank must traverse the whole
   *  travel and come back. Three degrees of hand per pointer move is exactly the
   *  deliberate turn the reviewer reported as buying 17 degrees. */
  it('a slow crank traverses 0 -> full turn -> 0', () => {
    const up = crank(0, 1, { stepDeg: 3, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(
      up.ranOut,
      `slow cranking never reached the stop: got ${deg(up.theta).toFixed(1)}deg of ${deg(THETA_MAX).toFixed(1)}deg`
    ).toBe(false)
    expect(up.theta).toBeCloseTo(THETA_MAX, 6)

    const down = crank(up.theta, -1, { stepDeg: 3, stop: (t) => t <= 1e-6 })
    expect(
      down.ranOut,
      `slow cranking never brought it back: stuck at ${deg(down.theta).toFixed(1)}deg — ` +
        `the live probe's "the same stroke reversed buys zero"`
    ).toBe(false)
    expect(down.theta).toBeCloseTo(0, 6)
  })

  /** REVERSE COSTS WHAT FORWARD COST. Antisymmetry is the property the atan2
   *  read never had, and the reason a reader could wind the old wheel one way
   *  and never find the way back. */
  it('the return stroke costs within 15% of the outward one', () => {
    const up = crank(0, 1, { stepDeg: 3, stop: (t) => t >= THETA_MAX - 1e-6 })
    const down = crank(up.theta, -1, { stepDeg: 3, stop: (t) => t <= 1e-6 })
    const ratio = down.handDeg / up.handDeg
    expect(
      Math.abs(ratio - 1),
      `outward ${up.handDeg.toFixed(0)}deg of hand, return ${down.handDeg.toFixed(0)}deg`
    ).toBeLessThan(0.15)
  })

  /** THE WHEEL IS WORK. Eight strongrooms should not go past in one flick of the
   *  wrist; at the shipped gear a full revolution is about two turns of a hand
   *  at the rim, i.e. roughly a stroke per room. */
  it('one detent costs a real stroke, and the full turn costs about two hand turns', () => {
    const oneRoom = crank(0, 1, { stepDeg: 1, stop: (t) => t >= STEP - 1e-9 })
    expect(oneRoom.ranOut).toBe(false)
    expect(
      oneRoom.handDeg,
      `one 45deg room cost ${oneRoom.handDeg.toFixed(0)}deg of hand (${oneRoom.handPx.toFixed(0)} px)`
    ).toBeGreaterThan(55)
    expect(oneRoom.handDeg).toBeLessThan(200)

    const full = crank(0, 1, { stepDeg: 1, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(full.handDeg, `full travel cost ${full.handDeg.toFixed(0)}deg of hand`).toBeGreaterThan(560)
    expect(full.handDeg).toBeLessThan(1200)
  })

  /** A PATH MAPPING, NOT A VELOCITY ONE: turning slowly must cost the same total
   *  hand as turning fast, or "slow deliberate turning is ignored" comes back. */
  it('slow and fast strokes cost the same total hand', () => {
    const slow = crank(0, 1, { stepDeg: 1, stop: (t) => t >= THETA_MAX - 1e-6 })
    const fast = crank(0, 1, { stepDeg: 9, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(
      Math.abs(fast.handDeg / slow.handDeg - 1),
      `slow ${slow.handDeg.toFixed(0)}deg vs fast ${fast.handDeg.toFixed(0)}deg`
    ).toBeLessThan(0.2)
  })

  /** A STROKE ACROSS THE FACE IS NOT A TURN — the artefact that let one flick
   *  eat the winch's whole travel. Pushing a wheel across its middle slides the
   *  paper under the finger; it does not crank it. */
  it('a straight stroke through the hub turns almost nothing', () => {
    const from = faceAt(Math.PI, 0.85)
    const to = faceAt(0, 0.85)
    let theta = 0
    let prev = hitAt(from)
    const N = 24
    for (let i = 1; i <= N; i++) {
      const p = from.clone().lerp(to, i / N)
      const next = hitAt(p)
      theta = volvelleCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.radius))
      prev = next
    }
    expect(deg(theta), `a stroke across the face wound ${deg(theta).toFixed(1)}deg`).toBeLessThan(4)
  })
})

describe('the detents are felt, not just snapped to', () => {
  /** The gear must stay strictly positive everywhere: a notch that can stall the
   *  wheel (or push it backwards under a forward hand) is a jam, not a detent. */
  it('the notch gear never stalls and never reverses the wheel', () => {
    for (let i = 0; i <= 400; i++) {
      const g = volvelleDetentGear(GEOM, (THETA_MAX * i) / 400)
      expect(g).toBeGreaterThan(0.1)
      expect(g).toBeLessThan(2)
    }
  })

  /** ONE PERIOD PER ROOM: heaviest seated on a notch, lightest at the crest
   *  between two. That ordering IS the click. */
  it('the wheel is heaviest on a detent and lightest between two', () => {
    for (let d = 0; d < GEOM.sectors; d++) {
      const onNotch = volvelleDetentGear(GEOM, d * STEP)
      const atCrest = volvelleDetentGear(GEOM, (d + 0.5) * STEP)
      expect(onNotch, `detent ${d}`).toBeLessThan(atCrest * 0.6)
    }
  })

  /** A DETENT, NOT A RATCHET: leaving a notch costs the same in both
   *  directions, so nothing about the feel is one-way. */
  it('a notch is symmetric — it costs the same to leave either way', () => {
    for (let d = 0; d < GEOM.sectors; d++) {
      for (const off of [0.1, 0.25, 0.4]) {
        expect(volvelleDetentGear(GEOM, (d + off) * STEP)).toBeCloseTo(
          volvelleDetentGear(GEOM, (d - off) * STEP),
          9
        )
      }
    }
  })

  /** The click the layer plays: one per room crossed, and every room is
   *  reachable — a crank of the whole travel must pass through all of them. */
  it('a full crank clicks once per strongroom', () => {
    let theta = 0
    let a = 0
    let prevPoint = faceAt(a, 0.8)
    let prev = hitAt(prevPoint)
    let cell = volvelleDetentCell(GEOM, theta)
    const cells: number[] = [cell]
    for (let i = 0; i < 6000 && theta < THETA_MAX - 1e-6; i++) {
      a += rad(2)
      const point = faceAt(a, 0.8)
      const next = hitAt(point)
      theta = volvelleCrankStep(GEOM, theta, crankTangentialDelta(prev, next, GEOM.radius))
      const c = volvelleDetentCell(GEOM, theta)
      if (c !== cell) cells.push(c)
      cell = c
      prev = next
      prevPoint = point
    }
    expect(cells, 'the crank skipped or repeated rooms').toEqual(
      Array.from({ length: GEOM.sectors + 1 }, (_, i) => i)
    )
  })
})

describe('the wheel has two stops and they are felt', () => {
  it('stiffens into the stop it is heading for, and only that one', () => {
    // Winding forward, the far pin gets heavy; backing off from the same angle
    // is at the ordinary rate, or the stop reads as a jam.
    expect(volvelleEndResist(GEOM, THETA_MAX, 1)).toBeLessThan(0.45)
    expect(volvelleEndResist(GEOM, THETA_MAX, -1)).toBeCloseTo(1, 9)
    expect(volvelleEndResist(GEOM, 0, -1)).toBeLessThan(0.45)
    expect(volvelleEndResist(GEOM, 0, 1)).toBeCloseTo(1, 9)
    expect(volvelleEndResist(GEOM, THETA_MAX / 2, 1)).toBeCloseTo(1, 9)
  })

  it('the last room costs more hand than the first', () => {
    const first = crank(0, 1, { stepDeg: 1, stop: (t) => t >= STEP - 1e-9 })
    const last = crank(THETA_MAX - STEP, 1, { stepDeg: 1, stop: (t) => t >= THETA_MAX - 1e-6 })
    expect(
      last.handDeg / first.handDeg,
      `first room ${first.handDeg.toFixed(0)}deg, last room ${last.handDeg.toFixed(0)}deg`
    ).toBeGreaterThan(1.25)
  })

  it('the wheel cannot be wound past either pin', () => {
    expect(volvelleCrankStep(GEOM, THETA_MAX, 10)).toBeLessThanOrEqual(THETA_MAX)
    expect(volvelleCrankStep(GEOM, 0, -10)).toBeGreaterThanOrEqual(0)
  })
})

describe('what the reader is turning it FOR', () => {
  /** The point of the whole item: one room per click, three consecutive rooms in
   *  the three vitrines, and every step advances all three. This is the
   *  registration contract restated against the SHIPPED wheel rather than the
   *  s4 config the family suite uses. */
  it('one detent advances every vitrine by exactly one strongroom', () => {
    for (let d = 0; d < GEOM.sectors; d++) {
      for (const w of GEOM.windows) {
        const now = volvelleSectorSeen(GEOM, w, d * STEP)
        const next = volvelleSectorSeen(GEOM, w, (d + 1) * STEP)
        expect((now - next + GEOM.sectors) % GEOM.sectors, `window ${w.psiDeg} at detent ${d}`).toBe(1)
      }
    }
  })

  it('the three vitrines frame three CONSECUTIVE rooms at every detent', () => {
    for (let d = 0; d < GEOM.sectors; d++) {
      const seen = GEOM.windows.map((w) => volvelleSectorSeen(GEOM, w, d * STEP))
      for (let i = 1; i < seen.length; i++) {
        expect((seen[i] - seen[i - 1] + GEOM.sectors) % GEOM.sectors, `detent ${d}: ${seen.join(',')}`).toBe(1)
      }
    }
  })

  it('the gear is the one the comment claims', () => {
    expect(VOLVELLE_CRANK_GEAR).toBeGreaterThan(0)
    expect(VOLVELLE_CRANK_GEAR).toBeLessThan(1)
  })
})
