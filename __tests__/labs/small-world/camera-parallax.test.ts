import { describe, expect, it } from 'vitest'
import {
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_TARGET,
  ZOOM_FACTOR,
  cameraPositionAt,
  cameraTargetAt,
} from '@/components/labs/small-world/scene/camera'
import {
  DRIFT_SCALE,
  PARALLAX_IN_AT,
  PARALLAX_LAMBDA,
  PARALLAX_PITCH_DEG,
  PARALLAX_PITCH_MAX,
  PARALLAX_REF_ASPECT,
  PARALLAX_SNAP,
  PARALLAX_YAW_DEG,
  PARALLAX_YAW_MAX,
  dampAngle,
  driftAnglesInto,
  orbitEyeInto,
  orbitRig,
  parallaxGainAt,
  parallaxGainFor,
  pointerAnglesInto,
  yawMaxFor,
} from '@/components/labs/small-world/scene/camera-parallax'
import { STUDIO_LIGHTS_FULL } from '@/components/labs/small-world/scene/desk-studio'
import {
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  DESK_BACK_Z,
  DESK_HALF_W,
  DESK_NEAR_Z,
  DESK_TOP_Y,
} from '@/components/labs/small-world/scene/desk-stage'
import { STAND_FOOT_Y } from '@/components/labs/small-world/scene/globe-stand'

/**
 * THE BREATH, AND THE INVARIANT IT IS NOT ALLOWED TO COST (Task 72).
 *
 * `ending-camera.test.ts` proves the SCROLL camera is bit-identical to the static pose everywhere
 * rotation can still change, and it keeps proving exactly that — Task 72 did not touch a line of
 * `camera.ts`. What this file adds is the same claim about the COMPOSED rig: the pose the renderer
 * actually receives, pointer layer and all.
 *
 * Bit-identity rather than closeness, for the reason that file gives: an epsilon would let a later
 * edit introduce a real, small camera drift that no test would catch, and "the camera is static"
 * would quietly become "the camera is nearly static".
 */

const TAN_HALF = Math.tan((CAMERA_FOV * Math.PI) / 360)
const SKY_K = ZOOM_FACTOR

/** The backdrop plane, restated from `sky.tsx`'s own constants — it is scaled about the origin by
 *  the zoom, which is why every bound here carries the same factor. */
const SKY_HALF_W = 70 * SKY_K
const SKY_TOP = (-10 + 45) * SKY_K
const SKY_BOTTOM = (-10 - 45) * SKY_K
const SKY_Z = -20 * SKY_K

type V3 = [number, number, number]
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The composed pose at a scroll position and a pointer deflection — THE SHIPPED PATH, in the
 * shipped order: scroll solves the eye and the aim, the pointer's angles are scaled by the
 * envelope, the eye is orbited about the aim, and `lookAt` builds the basis.
 *
 * The gain is applied HERE, as a multiplier on the angle, exactly as `scene.tsx` applies it —
 * because that ordering is the load-bearing half of the invariant. A test that fed the raw angles
 * in would be testing a rig nobody ships, and it would fail, which is how this helper was found to
 * be wrong the first time it ran.
 *
 * `cx`/`cy` are a fully deflected pointer at ±1. The damper is not in the loop: it converges on
 * the pointer's angle, so the extremes it can reach are exactly these.
 */
function composed(p: number, cx: number, cy: number, aspect: number) {
  const gain = parallaxGainFor(endingStateAt(p))
  const aim = cameraTargetAt(p)
  const eye = orbitEyeInto(
    cameraPositionAt(p),
    aim,
    cx * yawMaxFor(aspect) * gain,
    cy * PARALLAX_PITCH_MAX * gain,
    [0, 0, 0]
  )
  return { rig: orbitRig(eye, aim), eye, aim }
}

function ndc(pt: V3, rig: ReturnType<typeof orbitRig>, aspect: number) {
  const v: V3 = [pt[0] - rig.cam[0], pt[1] - rig.cam[1], pt[2] - rig.cam[2]]
  const depth = dot(v, rig.fwd)
  return {
    x: dot(v, rig.right) / (depth * TAN_HALF * aspect),
    y: dot(v, rig.up) / (depth * TAN_HALF),
  }
}

/** The four frustum corner rays as world directions, in the same basis `lookAt` builds. */
function cornerRays(rig: ReturnType<typeof orbitRig>, aspect: number): V3[] {
  const out: V3[] = []
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      out.push([
        rig.fwd[0] + rig.right[0] * TAN_HALF * aspect * sx + rig.up[0] * TAN_HALF * sy,
        rig.fwd[1] + rig.right[1] * TAN_HALF * aspect * sx + rig.up[1] * TAN_HALF * sy,
        rig.fwd[2] + rig.right[2] * TAN_HALF * aspect * sx + rig.up[2] * TAN_HALF * sy,
      ])
    }
  }
  return out
}

/** Centre plus all four extremes — the poses the containment claim is made at. */
const CORNERS: [number, number][] = [
  [0, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

/**
 * Every viewport the gate runs at, INCLUDING the declared floor.
 *
 * 360 is not one of the viewports anything is tested at; it is the narrowest frame the lab claims
 * to support, and Task 66 shipped figurines sliced at 360×800 because the gate ran only at the
 * sizes the captures used. A bound that holds at the two viewports and not at the floor is a bound
 * that holds by coincidence.
 */
const VIEWPORTS: [string, number][] = [
  ['1440x900', 1440 / 900],
  ['390x844', 390 / 844],
  ['360x844 (declared floor)', 360 / 844],
  ['5120x1440 (ultrawide)', 5120 / 1440],
]

describe('the composed rig is bit-identical wherever the scroll camera is', () => {
  const SWEEP = 20_000

  it('holds across the whole journey domain at every pointer deflection', () => {
    // The pointer is pinned at a CORNER for this sweep, not at rest. That is the whole point: the
    // invariant may not depend on the visitor holding still, because a visitor who has their
    // cursor in a corner and flings the scroll back into the journey is an ordinary visitor.
    //
    // Scanned and reported once rather than asserted per sample: this is 20,000 positions at four
    // aspects and five deflections, and `expect` is far more expensive than the arithmetic it is
    // checking. The claim is unchanged — every sample is compared — and a failure names itself.
    const bad: string[] = []
    for (const [vlabel, aspect] of VIEWPORTS) {
      for (const [cx, cy] of CORNERS) {
        for (let i = 0; i <= SWEEP; i++) {
          const p = i / SWEEP
          const { eye, aim } = composed(p, cx, cy, aspect)
          const ok =
            Object.is(eye[0], CAMERA_POSITION[0]) &&
            Object.is(eye[1], CAMERA_POSITION[1]) &&
            Object.is(eye[2], CAMERA_POSITION[2]) &&
            Object.is(aim[0], CAMERA_TARGET[0]) &&
            Object.is(aim[1], CAMERA_TARGET[1]) &&
            Object.is(aim[2], CAMERA_TARGET[2])
          if (!ok && bad.length < 5) bad.push(`${vlabel} corner(${cx},${cy}) p=${p}`)
        }
      }
    }
    expect(bad, `composed pose drifted from the static pose`).toEqual([])
  })

  it('holds through the still beat, past the first progress the camera may move at', () => {
    // The scroll camera is allowed to move from ZOOM_FIRST_MOVE. The parallax is not — its window
    // opens four fifths of the way through the pull-back — so this covers strictly more of the
    // track than `ending-camera.test.ts` can.
    for (let i = 0; i <= 4000; i++) {
      const p = 1 + (i / 4000) * (ZOOM_FIRST_MOVE - 1)
      const { eye } = composed(p, 1, 1, 1440 / 900)
      const base = cameraPositionAt(p)
      expect(Object.is(eye[0], base[0])).toBe(true)
      expect(Object.is(eye[1], base[1])).toBe(true)
      expect(Object.is(eye[2], base[2])).toBe(true)
    }
  })

  it('holds for the whole first four fifths of the pull-back too', () => {
    // Where the parallax's own envelope is exactly zero, the composed eye must be exactly the
    // scroll eye — which is a MOVING pose here, not the static one. Same claim, different baseline.
    const zoomOf = (p: number) => endingStateAt(p).zoom
    let checked = 0
    for (let i = 0; i <= 4000; i++) {
      const p = 1 + (i / 4000) * (TRACK_END - 1)
      if (zoomOf(p) > PARALLAX_IN_AT) continue
      checked++
      const base = cameraPositionAt(p)
      const { eye } = composed(p, -1, 1, 1440 / 900)
      expect(Object.is(eye[0], base[0])).toBe(true)
      expect(Object.is(eye[1], base[1])).toBe(true)
      expect(Object.is(eye[2], base[2])).toBe(true)
    }
    expect(checked).toBeGreaterThan(3000)
  })

  it('is bit-identical retracing the same positions backwards', () => {
    // No state anywhere in the pure layer, so this can only fail if something grew some.
    const forward: number[] = []
    for (let i = 0; i <= 3000; i++) {
      forward.push(composed(1 + (i / 3000) * (TRACK_END - 1), 1, -1, 1440 / 900).eye[0])
    }
    for (let i = 3000; i >= 0; i--) {
      const back = composed(1 + (i / 3000) * (TRACK_END - 1), 1, -1, 1440 / 900).eye[0]
      expect(Object.is(back, forward[i])).toBe(true)
    }
  })

  it('DOES move at the money shot — the gate has to be able to fail', () => {
    // A bit-identity suite that passed because the parallax did nothing would prove nothing.
    const base = cameraPositionAt(TRACK_END)
    const { eye } = composed(TRACK_END, 1, 1, 1440 / 900)
    expect(eye[0]).not.toBe(base[0])
    expect(Math.abs(eye[0] - base[0])).toBeGreaterThan(0.5)
  })
})

describe('the envelope', () => {
  it('opens exactly where the studio finishes arriving', () => {
    // A relation pin, not a restated number: retuning the studio's ramp moves the breath with it.
    expect(PARALLAX_IN_AT).toBe(STUDIO_LIGHTS_FULL)
  })

  it('is exactly +0 at and below its own start, and exactly 1 at the end', () => {
    expect(Object.is(parallaxGainAt(PARALLAX_IN_AT), 0)).toBe(true)
    expect(Object.is(parallaxGainAt(0), 0)).toBe(true)
    expect(Object.is(parallaxGainAt(-1), 0)).toBe(true)
    expect(parallaxGainAt(1)).toBe(1)
    for (let i = 0; i <= 2000; i++) {
      const z = (i / 2000) * PARALLAX_IN_AT
      expect(Object.is(parallaxGainAt(z), 0)).toBe(true)
    }
  })

  it('is exactly +0 for the whole journey and the whole still beat, read as the scene reads it', () => {
    for (let i = 0; i <= 4000; i++) {
      const p = (i / 4000) * ZOOM_FIRST_MOVE
      expect(Object.is(parallaxGainFor(endingStateAt(p)), 0)).toBe(true)
    }
  })

  it('is monotone and never leaves [0, 1]', () => {
    let prev = -1
    for (let i = 0; i <= 4000; i++) {
      const g = parallaxGainAt(i / 4000)
      expect(g).toBeGreaterThanOrEqual(prev)
      expect(g).toBeGreaterThanOrEqual(0)
      expect(g).toBeLessThanOrEqual(1)
      prev = g
    }
  })
})

describe('the orbit', () => {
  it('copies rather than rotating when both angles are exactly zero', () => {
    // `(E − T) + T` is not guaranteed to be `E` in IEEE-754, so the guard is what makes the
    // identity a property of the code rather than of the numbers that happen to be in it.
    const eye: V3 = [0.1, 6.20154321, 17.03812345]
    const aim: V3 = [0, -1.885739, 0]
    const out = orbitEyeInto(eye, aim, 0, 0, [0, 0, 0])
    expect(Object.is(out[0], eye[0])).toBe(true)
    expect(Object.is(out[1], eye[1])).toBe(true)
    expect(Object.is(out[2], eye[2])).toBe(true)
  })

  it('takes the same branch for negative zero', () => {
    // The angles reach the rig as `pointer · gain`, and a negative pointer times +0 is −0.
    const eye: V3 = [0.1, 6.2, 17.03]
    const aim: V3 = [0, -1.88, 0]
    const out = orbitEyeInto(eye, aim, -0, -0, [0, 0, 0])
    expect(Object.is(out[1], eye[1])).toBe(true)
  })

  it('keeps the eye on a sphere about the aim — it orbits, it does not pan', () => {
    const aim: V3 = cameraTargetAt(TRACK_END)
    const base = cameraPositionAt(TRACK_END)
    const r0 = Math.hypot(base[0] - aim[0], base[1] - aim[1], base[2] - aim[2])
    for (const [cx, cy] of CORNERS) {
      const e = orbitEyeInto(base, aim, cx * PARALLAX_YAW_MAX, cy * PARALLAX_PITCH_MAX, [0, 0, 0])
      const r = Math.hypot(e[0] - aim[0], e[1] - aim[1], e[2] - aim[2])
      expect(Math.abs(r - r0)).toBeLessThan(1e-12)
    }
  })

  it('leaves the aim alone entirely — there is no second path for it to take', () => {
    // Stated as a test because it is the whole of the Task 66 aim invariant's survival: the orbit
    // is ABOUT the aim, so `cameraTargetInto` is never composed with anything.
    for (let i = 0; i <= 1000; i++) {
      const p = (i / 1000) * TRACK_END
      const a = cameraTargetAt(p)
      const b = composed(p, 1, -1, 1440 / 900).aim
      expect(Object.is(a[0], b[0])).toBe(true)
      expect(Object.is(a[1], b[1])).toBe(true)
      expect(Object.is(a[2], b[2])).toBe(true)
    }
  })

  it('carries the eye toward the pointer, not away from it', () => {
    const aim: V3 = cameraTargetAt(TRACK_END)
    const base = cameraPositionAt(TRACK_END)
    expect(orbitEyeInto(base, aim, PARALLAX_YAW_MAX, 0, [0, 0, 0])[0]).toBeGreaterThan(0)
    // ...and a pointer at the BOTTOM of the window lowers the eye toward the desk's own plane
    expect(orbitEyeInto(base, aim, 0, PARALLAX_PITCH_MAX, [0, 0, 0])[1]).toBeLessThan(base[1])
  })

  it('never rolls: the rig`s right vector stays level at every extreme', () => {
    for (const [cx, cy] of CORNERS) {
      const { rig } = composed(TRACK_END, cx, cy, 1440 / 900)
      expect(Math.abs(rig.right[1])).toBeLessThan(1e-12)
    }
  })
})

describe('the yaw budget is spent in frame units, not in degrees', () => {
  it('is the authored angle at and above the reference aspect, and capped there', () => {
    expect(yawMaxFor(PARALLAX_REF_ASPECT)).toBeCloseTo(PARALLAX_YAW_MAX, 12)
    expect(yawMaxFor(PARALLAX_REF_ASPECT * 4)).toBeCloseTo(PARALLAX_YAW_MAX, 12)
    expect(yawMaxFor(PARALLAX_REF_ASPECT / 2)).toBeCloseTo(PARALLAX_YAW_MAX / 2, 12)
  })

  it('costs every viewport the SAME share of its own frame', () => {
    // The claim the scaling exists to make, measured on a real point at the desk's own depth
    // rather than argued. ndc x divides by the aspect, so an unscaled angle would cost a phone
    // 3.5x what it costs a laptop — and the note has no side margin left to pay with.
    const probe: V3 = [0, DESK_TOP_Y, 10.55]
    const shifts = VIEWPORTS.map(([, aspect]) => {
      const rest = ndc(probe, composed(TRACK_END, 0, 0, aspect).rig, aspect).x
      const swung = ndc(probe, composed(TRACK_END, 1, 0, aspect).rig, aspect).x
      return Math.abs(swung - rest)
    })
    // ultrawide is capped rather than scaled, so it is compared only among the frames at or below
    // the reference
    const scaled = shifts.slice(0, 3)
    for (const s of scaled) expect(s).toBeCloseTo(scaled[0], 3)
  })

  it('survives a degenerate aspect rather than producing NaN', () => {
    expect(yawMaxFor(0)).toBe(PARALLAX_YAW_MAX)
    expect(yawMaxFor(Number.NaN)).toBe(PARALLAX_YAW_MAX)
  })

  it('stays inside "a few degrees"', () => {
    expect(PARALLAX_YAW_DEG).toBeLessThanOrEqual(3)
    expect(PARALLAX_PITCH_DEG).toBeLessThanOrEqual(PARALLAX_YAW_DEG)
  })
})

describe('CONTAINMENT UNDER ORBIT', () => {
  it('never lets the backdrop`s edge into frame, at any corner or viewport', () => {
    // The studio cyc is drawn in ndc ON this plane (sky.tsx), so the plane running out IS the room
    // running out. The plane scales about the origin with the zoom, which keeps its projection
    // exactly invariant for a camera ON the view ray — the parallax takes the camera OFF that ray,
    // which is precisely why this has to be re-checked rather than inherited.
    let worstX = 0
    let worstTop = -Infinity
    let worstBottom = Infinity
    for (const [, aspect] of VIEWPORTS) {
      for (const [cx, cy] of CORNERS) {
        const { rig } = composed(TRACK_END, cx, cy, aspect)
        for (const d of cornerRays(rig, aspect)) {
          // every corner ray still travels away from the plane's side of the world
          expect(d[2]).toBeLessThan(0)
          const t = (SKY_Z - rig.cam[2]) / d[2]
          const hx = rig.cam[0] + d[0] * t
          const hy = rig.cam[1] + d[1] * t
          worstX = Math.max(worstX, Math.abs(hx))
          worstTop = Math.max(worstTop, hy)
          worstBottom = Math.min(worstBottom, hy)
        }
      }
    }
    expect(worstX).toBeLessThan(SKY_HALF_W)
    expect(worstTop).toBeLessThan(SKY_TOP)
    expect(worstBottom).toBeGreaterThan(SKY_BOTTOM)
    // ...and by a real margin rather than a squeak
    expect(worstX / SKY_HALF_W).toBeLessThan(0.9)
  })

  it('never opens a void under the desk: the slab still runs past both bottom corners', () => {
    // The desk is the floor of this composition. If a bottom corner ray reaches the desk plane
    // beyond the slab's own extent, the frame shows nothing there — which is the "off-room gap"
    // the brief forbids.
    let worstX = 0
    let worstZ = -Infinity
    for (const [, aspect] of VIEWPORTS) {
      for (const [cx, cy] of CORNERS) {
        const { rig } = composed(TRACK_END, cx, cy, aspect)
        for (const d of cornerRays(rig, aspect).slice(0, 2)) {
          expect(d[1]).toBeLessThan(0)
          const t = (DESK_TOP_Y - rig.cam[1]) / d[1]
          worstX = Math.max(worstX, Math.abs(rig.cam[0] + d[0] * t))
          worstZ = Math.max(worstZ, rig.cam[2] + d[2] * t)
        }
      }
    }
    expect(worstX).toBeLessThan(DESK_HALF_W)
    expect(worstZ).toBeLessThan(DESK_NEAR_Z)
  })

  it('never shows sky under the stand, swept over the whole pull-back at every extreme', () => {
    // The same predicate `globe-stand.test.ts` makes at the un-orbited poses, re-made at the four
    // corners. The stand's lowest visible point is the foot, checked at its centre (its near rim
    // projects lower, so a centre that clears the line means the whole disc does), against
    // whichever of the frame's bottom edge or the desk's back edge is currently holding it.
    let worst = -Infinity
    let worstAt = ''
    for (const [vlabel, aspect] of VIEWPORTS) {
      for (const [cx, cy] of CORNERS) {
        for (let i = 0; i <= 400; i++) {
          const p = 1 + (i / 400) * (TRACK_END - 1)
          const { rig } = composed(p, cx, cy, aspect)
          const foot = ndc([0, STAND_FOOT_Y, 0], rig, aspect).y
          const desk = ndc([0, DESK_TOP_Y, DESK_BACK_Z], rig, aspect).y
          const v = foot - Math.max(-1, desk)
          if (v > worst) {
            worst = v
            worstAt = `${vlabel} corner(${cx},${cy}) p=${p.toFixed(4)}`
          }
        }
      }
    }
    expect(worst, `sky under the stand at ${worstAt}`).toBeLessThan(0)
    // the un-orbited sweep clears by 0.2848; the orbit may spend some of that, not most of it
    expect(worst).toBeLessThan(-0.15)
  })

  it('would FAIL the stand sweep if the pitch budget were opened up', () => {
    // Mutation: the gate has to be the thing that rejects a bigger swing, not decoration round it.
    // Pitching the eye DOWN drops the desk's back edge on screen and lifts the foot toward it, so
    // this is the direction the margin is actually spent in.
    let worst = -Infinity
    for (let i = 0; i <= 400; i++) {
      const p = 1 + (i / 400) * (TRACK_END - 1)
      const a = cameraTargetAt(p)
      const eye = orbitEyeInto(cameraPositionAt(p), a, 0, -12 * (Math.PI / 180), [0, 0, 0])
      const rig = orbitRig(eye, a)
      const foot = ndc([0, STAND_FOOT_Y, 0], rig, 1440 / 900).y
      const desk = ndc([0, DESK_TOP_Y, DESK_BACK_Z], rig, 1440 / 900).y
      worst = Math.max(worst, foot - Math.max(-1, desk))
    }
    expect(worst).toBeGreaterThan(0)
  })
})

describe('the damper', () => {
  it('returns the target EXACTLY once inside the snap, so a rested camera goes quiet', () => {
    expect(Object.is(dampAngle(0, 0, PARALLAX_LAMBDA, 1 / 60), 0)).toBe(true)
    expect(Object.is(dampAngle(PARALLAX_SNAP / 2, 0, PARALLAX_LAMBDA, 1 / 60), 0)).toBe(true)
  })

  it('approaches without overshooting at any plausible frame time', () => {
    // Run for eight WALL-CLOCK seconds at each frame time rather than for a fixed number of
    // frames: the damper is a rate, so a fixed frame count is a different amount of time at every
    // dt and the first version of this test failed itself for that reason rather than for a real
    // one. Eight seconds is ~18 time constants at lambda 2.2, well past the snap.
    for (const dt of [1 / 240, 1 / 120, 1 / 60, 1 / 30, 1 / 10, 0.5]) {
      let cur = 0
      for (let t = 0; t < 8; t += dt) {
        cur = dampAngle(cur, PARALLAX_YAW_MAX, PARALLAX_LAMBDA, dt)
        expect(cur).toBeLessThanOrEqual(PARALLAX_YAW_MAX)
      }
      expect(Object.is(cur, PARALLAX_YAW_MAX)).toBe(true)
    }
  })

  it('is frame-rate independent: the same wall-clock second lands in the same place', () => {
    const run = (dt: number) => {
      let cur = 0
      for (let t = 0; t < 1 - 1e-9; t += dt) cur = dampAngle(cur, 1, PARALLAX_LAMBDA, dt)
      return cur
    }
    expect(run(1 / 120)).toBeCloseTo(run(1 / 30), 2)
  })
})

describe('the inputs', () => {
  it('clamps a pointer reported outside the viewport', () => {
    const out: [number, number] = [0, 0]
    pointerAnglesInto(4, -9, PARALLAX_REF_ASPECT, out)
    expect(out[0]).toBeCloseTo(PARALLAX_YAW_MAX, 12)
    expect(out[1]).toBeCloseTo(-PARALLAX_PITCH_MAX, 12)
  })

  it('gives a centred pointer exactly zero', () => {
    const out: [number, number] = [1, 1]
    pointerAnglesInto(0, 0, PARALLAX_REF_ASPECT, out)
    expect(Object.is(out[0], 0)).toBe(true)
    expect(Object.is(out[1], 0)).toBe(true)
  })

  it('keeps the touch drift inside the pointer`s own budget, and long-period', () => {
    const out: [number, number] = [0, 0]
    let peakYaw = 0
    let peakPitch = 0
    for (let s = 0; s < 600; s += 0.05) {
      driftAnglesInto(s, PARALLAX_REF_ASPECT, out)
      peakYaw = Math.max(peakYaw, Math.abs(out[0]))
      peakPitch = Math.max(peakPitch, Math.abs(out[1]))
    }
    expect(peakYaw).toBeLessThanOrEqual(PARALLAX_YAW_MAX * DRIFT_SCALE + 1e-12)
    expect(peakPitch).toBeLessThanOrEqual(PARALLAX_PITCH_MAX * DRIFT_SCALE + 1e-12)
    expect(peakYaw).toBeGreaterThan(PARALLAX_YAW_MAX * DRIFT_SCALE * 0.99)
  })

  it('starts the drift at exactly zero, so nothing jumps on the frame it arrives', () => {
    const out: [number, number] = [1, 1]
    driftAnglesInto(0, PARALLAX_REF_ASPECT, out)
    expect(Object.is(out[0], 0)).toBe(true)
    expect(Object.is(out[1], 0)).toBe(true)
  })

  it('shrinks the drift on a narrow frame exactly as it shrinks the pointer`s', () => {
    const wide: [number, number] = [0, 0]
    const narrow: [number, number] = [0, 0]
    driftAnglesInto(4.75, PARALLAX_REF_ASPECT, wide)
    driftAnglesInto(4.75, 390 / 844, narrow)
    expect(narrow[0] / wide[0]).toBeCloseTo(390 / 844 / PARALLAX_REF_ASPECT, 9)
    // ...and leaves the pitch alone, because ndc y does not depend on the aspect
    expect(narrow[1]).toBeCloseTo(wide[1], 12)
  })
})
