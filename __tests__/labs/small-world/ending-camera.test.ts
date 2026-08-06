import { describe, expect, it } from 'vitest'
import {
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_RAY,
  CAMERA_RIG_PRIORITY,
  CAMERA_TARGET,
  DESK_EDGE_POINT,
  DESK_EDGE_V,
  ENDING_AIM_DROP,
  ENDING_AIM_DROP_PORTRAIT,
  GLOBE_FRAME,
  GLOBE_FRAME_PORTRAIT,
  LANDSCAPE_ASPECT,
  PORTRAIT_ASPECT,
  STAND_GAP,
  STAND_GAP_PORTRAIT,
  WORLD_RADIUS,
  ZOOM_FACTOR,
  ZOOM_FACTOR_PORTRAIT,
  cameraPositionAt,
  cameraPositionAtFor,
  cameraTargetAt,
  cameraTargetAtFor,
  cameraZoomScale,
  cameraZoomScaleFor,
  endingAimDrop,
  endingAimDropFor,
  endingCameraDistance,
  endingCameraDistanceFor,
  endingRig,
  globeEdgesAt,
  ndcYAt,
  portraitWeight,
  zoomFactorFor,
  zoomForGlobeFrame,
  aimForZoom,
  endingAimTargetFor,
} from '@/components/labs/small-world/scene/camera'
import {
  PARALLAX_PITCH_MAX,
  orbitEyeInto,
  orbitRig,
  parallaxGainFor,
  yawMaxFor,
} from '@/components/labs/small-world/scene/camera-parallax'
import {
  ENDING_SPAN,
  TRACK_END,
  ZOOM_FIRST_MOVE,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import { ROTATION_TOTAL, rotationAt } from '@/components/labs/small-world/journey-timeline'
import { STANCE_ALPHA, epilogueGate, renewalGate } from '@/components/labs/small-world/scene/renewal'
import { PEEKER_RIG_PRIORITY } from '@/components/labs/small-world/scene/props/peeker-stage'
import {
  DESK_BACK_Z,
  DESK_HALF_W,
  DESK_MAX_ASPECT,
  DESK_NEAR_Z,
  DESK_TOP_Y,
  deskFrameHalfW,
} from '@/components/labs/small-world/scene/desk-stage'
import { PLANET_RADIUS } from '@/components/labs/small-world/scene/land-bake'
import {
  BOUNDARY_WANDER,
  EPILOGUE_END,
  epilogueRegion,
} from '@/components/labs/small-world/scene/biomes'

/**
 * THE INVARIANT (Task 63).
 *
 *   At every progress where rotation can still change, the camera pose is exactly
 *   — bit-identically — today's static pose.
 *
 * This is what lets the ending move the camera at all. The renewal proofs (the hidden
 * flip window, Task 60's epilogue periodicity in q = rotation − thetaC, the GatedProp
 * margins) hold because occlusion is exactly periodic in q, and that is only true while
 * the camera never moves. Bit-identity rather than closeness is the point: an epsilon
 * would let a later edit introduce a real, small camera drift that no test would catch,
 * and "the camera is static" would quietly become "the camera is nearly static".
 */
describe('the camera invariant', () => {
  const SWEEP = 20_000

  it('is bit-identical to the static pose across the whole journey domain', () => {
    for (let i = 0; i <= SWEEP; i++) {
      const p = i / SWEEP
      const pose = cameraPositionAt(p)
      expect(Object.is(pose[0], CAMERA_POSITION[0])).toBe(true)
      expect(Object.is(pose[1], CAMERA_POSITION[1])).toBe(true)
      expect(Object.is(pose[2], CAMERA_POSITION[2])).toBe(true)
      // A POSE IS AN EYE AND AN AIM, and Task 66 gave the ending both. Sweeping only the eye left
      // the half this round introduced ungated: a +1e-9 injected into `endingAimDrop` aims the
      // camera a nanometre below the origin for all six chapters — breaking exactly the bit-identity
      // the renewal proofs rest on — and the suite stayed green. `Object.is` rather than equality so
      // a −0 cannot pass as a 0 either.
      const aim = cameraTargetAt(p)
      expect(Object.is(aim[0], CAMERA_TARGET[0])).toBe(true)
      expect(Object.is(aim[1], CAMERA_TARGET[1])).toBe(true)
      expect(Object.is(aim[2], CAMERA_TARGET[2])).toBe(true)
    }
  })

  it('holds through the still beat too, up to a boundary DERIVED from the timeline', () => {
    // Not a restated number: the first progress the camera may move at is the ending's own
    // zoom-window start, and this walks the whole domain below it.
    for (let i = 0; i <= SWEEP; i++) {
      const p = (i / SWEEP) * ZOOM_FIRST_MOVE
      expect(cameraPositionAt(p)).toEqual([...CAMERA_POSITION])
      expect(cameraTargetAt(p)).toEqual([...CAMERA_TARGET])
    }
    expect(endingCameraDistance(endingStateAt(ZOOM_FIRST_MOVE))).toBe(CAMERA_DISTANCE)
    expect(endingAimDrop(endingStateAt(ZOOM_FIRST_MOVE))).toBe(0)
  })

  it('leaves a whole still beat between the last moving rotation and the first moving camera', () => {
    // rotation is a function of scroll only below 1 (`rotationAt` clamps there)...
    expect(rotationAt(1)).toBeCloseTo(ROTATION_TOTAL, 12)
    expect(rotationAt(TRACK_END)).toBe(rotationAt(1))
    // ...and the camera cannot move below ZOOM_FIRST_MOVE. The sets are disjoint, and the
    // margin between them is the still beat, in progress units.
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(ZOOM_FIRST_MOVE - 1).toBeCloseTo(ZOOM_START * ENDING_SPAN, 12)
  })

  it('DOES move just past that boundary — the invariant is a boundary, not a freeze', () => {
    const moved = cameraPositionAt(ZOOM_FIRST_MOVE + 1e-3)
    expect(moved[2]).toBeGreaterThan(CAMERA_POSITION[2])
    // ...and so does the aim, or the sweeps above would be satisfied by a target that never moves
    expect(cameraTargetAt(ZOOM_FIRST_MOVE + 1e-3)[1]).toBeLessThan(CAMERA_TARGET[1])
    expect(cameraTargetAt(TRACK_END)[1]).toBeCloseTo(-ENDING_AIM_DROP, 12)
  })

  it('rewinds through the identical function — scrub-back cannot strand the zoom', () => {
    const forward: number[][] = []
    for (let i = 0; i <= 4000; i++) {
      const p = (i / 4000) * TRACK_END
      forward.push([...cameraPositionAt(p), ...cameraTargetAt(p)])
    }
    for (let i = 4000; i >= 0; i--) {
      const p = (i / 4000) * TRACK_END
      expect([...cameraPositionAt(p), ...cameraTargetAt(p)]).toEqual(forward[i])
    }
  })

  it('runs after the journey ref and STRICTLY before every rig that follows the camera', () => {
    // r3f sorts subscribers ascending by priority and only hands over rendering above 0, so a
    // negative priority is purely an ordering key.
    expect(CAMERA_RIG_PRIORITY).toBeGreaterThan(-1)
    expect(CAMERA_RIG_PRIORITY).toBeLessThan(0)

    // The half that actually needed pinning. The peeker rig copies the camera's transform every
    // frame, and both rigs sat at −0.5 — r3f's sort is stable, so the tie resolved by MOUNT order
    // (CameraRig happens to be the first child of SceneContents and CheckpointPeekers the last).
    // The contract handed to T64 claimed this ordering was structural; it was sibling order.
    expect(
      CAMERA_RIG_PRIORITY,
      'a camera follower must never tie with the rig that writes the camera'
    ).toBeLessThan(PEEKER_RIG_PRIORITY)
  })
})

describe('the pull-back path', () => {
  it('measures the world with the same radius the bake builds it at', () => {
    // camera.ts restates PLANET_RADIUS rather than importing land-bake (which would drag the whole
    // bake module into every consumer of the camera, overlay included). A relation pin is what
    // stops the copy drifting — the same form T63 had to adopt after a RANGE pin let the
    // camera/peeker priority tie survive review.
    expect(WORLD_RADIUS).toBe(PLANET_RADIUS)
  })

  it('reaches exactly ZOOM_FACTOR at the bottom of the track, monotonically', () => {
    expect(endingCameraDistance(endingStateAt(TRACK_END))).toBeCloseTo(
      CAMERA_DISTANCE * ZOOM_FACTOR,
      10
    )
    let prev = -Infinity
    for (let i = 0; i <= 2000; i++) {
      const d = endingCameraDistance(endingStateAt((i / 2000) * TRACK_END))
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
  })

  it('travels along the view ray, and drops its aim on the same curve', () => {
    for (const p of [1.05, 1.15, TRACK_END]) {
      const pose = cameraPositionAt(p)
      const d = endingCameraDistance(endingStateAt(p))
      expect(pose[0]).toBeCloseTo(CAMERA_RAY[0] * d, 12)
      expect(pose[1]).toBeCloseTo(CAMERA_RAY[1] * d, 12)
      expect(pose[2]).toBeCloseTo(CAMERA_RAY[2] * d, 12)
      // The pitch is the ray's own, unchanged at every distance.
      expect(Math.atan2(pose[1], pose[2])).toBeCloseTo(Math.atan2(CAMERA_RAY[1], CAMERA_RAY[2]), 12)
    }
  })

  it('shrinks the world at a CONSTANT rate — the distance ramp is geometric, not linear', () => {
    // Apparent size goes as 1/D, so a LINEAR distance ramp shrinks the world fast and then
    // crawls. The geometric ramp's signature, stated without restating the implementation:
    // halfway through the eased pull-back the camera sits at the GEOMETRIC mean of the two end
    // distances, not the arithmetic one. (`smoothstep(0.5)` is exactly 0.5, so zoom = 0.5 is the
    // eased midpoint.) How far apart the two means are is DERIVED below rather than restated:
    // it is a pure function of ZOOM_FACTOR, so the shorter Task 66 pull-back moves it (3.20 world
    // units at 3x, 0.30 at 1.4985) without weakening what is being claimed.
    const at = (zoom: number) => endingCameraDistance({ ...endingStateAt(TRACK_END), zoom })
    const geometric = Math.sqrt(at(0) * at(1))
    const arithmetic = (at(0) + at(1)) / 2
    expect(at(0.5)).toBeCloseTo(geometric, 10)
    const meanGap = CAMERA_DISTANCE * ((1 + ZOOM_FACTOR) / 2 - Math.sqrt(ZOOM_FACTOR))
    expect(Math.abs(arithmetic - geometric)).toBeCloseTo(meanGap, 10)
    // ...and it is a real separation rather than a rounding artefact at this zoom
    expect(meanGap).toBeGreaterThan(0.2)
  })

  it('scales the sky by the same factor it moved the camera', () => {
    for (const p of [0.5, 1, 1.1, TRACK_END]) {
      const ending = endingStateAt(p)
      expect(cameraZoomScale(ending)).toBeCloseTo(
        endingCameraDistance(ending) / CAMERA_DISTANCE,
        12
      )
    }
    // A uniform scale about the projection's centre leaves the projection unchanged, which is
    // why the backdrop cannot show an edge however far the camera pulls back.
    expect(cameraZoomScale(endingStateAt(0.7))).toBe(1)
    expect(cameraZoomScale(endingStateAt(TRACK_END))).toBeCloseTo(ZOOM_FACTOR, 10)
  })

  it('still cannot show the backdrop an edge once the ending RE-AIMS as well as withdraws', () => {
    // Task 65 declined a camera re-aim partly on this ground, and it was right to name it: the sky's
    // invariance argument is `Rᵀ(k·X₀ − k·P₀) = k·v₀` with the SAME R, so scaling survives an aim
    // change but the FRAMED BAND does not — pitching down walks the frustum across the plane, and a
    // plane sized for one aim can run out. Task 66 takes the re-aim anyway (it is what spends the
    // white space), so the claim it weakens has to be re-proved rather than inherited.
    //
    // Done against the plane sky.tsx actually mounts, at the aspect nothing exceeds, by walking the
    // real corner rays to the plane's own depth.
    const SKY_POSITION = [0, -10, -20]
    const SKY_SCALE = [140, 90]
    for (let i = 0; i <= 60; i++) {
      const zoom = i / 60
      const ending = { ...endingStateAt(TRACK_END), zoom }
      const k = cameraZoomScale(ending)
      const aim = endingAimDrop(ending)
      const r = endingRig(k, aim)
      const planeZ = SKY_POSITION[2] * k
      const halfW = (SKY_SCALE[0] / 2) * k
      const midY = SKY_POSITION[1] * k
      const halfH = (SKY_SCALE[1] / 2) * k
      const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360)
      for (const vSign of [-1, 1]) {
        for (const hSign of [-1, 1]) {
          // corner ray = fwd + tanHalf·(vSign·up + hSign·aspect·right), right = +x
          const d = [
            hSign * tanHalf * DESK_MAX_ASPECT,
            r.fwd[1] + vSign * tanHalf * r.up[1],
            r.fwd[2] + vSign * tanHalf * r.up[2],
          ]
          const t = (planeZ - r.cam[2]) / d[2]
          expect(t).toBeGreaterThan(0)
          const y = r.cam[1] + t * d[1]
          const x = t * d[0]
          expect(Math.abs(x), `sky side edge at zoom ${zoom.toFixed(2)}`).toBeLessThan(halfW)
          expect(y, `sky bottom edge at zoom ${zoom.toFixed(2)}`).toBeGreaterThan(midY - halfH)
          expect(y, `sky top edge at zoom ${zoom.toFixed(2)}`).toBeLessThan(midY + halfH)
        }
      }
    }
  })
})

/**
 * ============================================================================
 * THE PORTRAIT FORK (Task 76) — a SECOND invariant, held to the first one's standard
 * ============================================================================
 * Task 63's claim was "the camera is bit-identically static across the journey". Task 76
 * makes the ending's pose a function of the ASPECT as well as the scroll, which turns
 * that one claim into two:
 *
 *   1. AT EVERY LANDSCAPE ASPECT the pose is bit-identically the pose Task 66 shipped
 *      and Aram approved. Not close: identical, because the aspect-taking function is
 *      the same arithmetic with `portraitWeight` exactly 0 feeding a `mix` that is
 *      exactly the identity there.
 *   2. AT EVERY ASPECT AT ALL the journey pose is bit-identically the static one, which
 *      is what the renewal proofs need and is strictly stronger than the sweep above.
 *
 * Everything below re-derives the portrait composition off the shipped constants rather
 * than restating solved numbers, exactly as the money-shot block does.
 */
const TAN_HALF = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** Every landscape aspect the lab can plausibly meet, plus the fork's own boundary. */
const LANDSCAPE_ASPECTS = [LANDSCAPE_ASPECT, 1.0001, 1.25, 4 / 3, 1.6, 16 / 9, 2, 2.4, 3.5556, 4]
/** The phones, where the fork is in force IN FULL — every one of them is at or below 0.5. */
const PHONE_ASPECTS = [430 / 932, 390 / 844, 393 / 852, 0.45, PORTRAIT_ASPECT, 0.3]
/** ...and the band between the two, where a blended pose is what ships. 375×667 is the one close
 *  call among real phones and lands at 96% of the fork; 768×1024 takes half of it. */
const BAND_ASPECTS = [0.55, 375 / 667, 0.62, 0.75, 0.86, 0.99]

/** Half the frame's WIDTH in world units on the desk plane at `z`, at ANY pose. */
function halfWidthAt(z: number, aspect: number, k: number, aimDrop: number): number {
  const r = endingRig(k, aimDrop)
  const depth = (DESK_TOP_Y - r.cam[1]) * r.fwd[1] + (z - r.cam[2]) * r.fwd[2]
  return depth * TAN_HALF * aspect
}

describe('the portrait fork leaves the approved frame exactly where it was', () => {
  it('weighs the two compositions with a smoothstep that is EXACTLY 0 and 1 at its ends', () => {
    for (const a of LANDSCAPE_ASPECTS) expect(Object.is(portraitWeight(a), 0)).toBe(true)
    for (const a of [PORTRAIT_ASPECT, 0.45, 0.3, 0.01]) expect(portraitWeight(a)).toBe(1)
    // ...and monotone in between, so rotating a device walks the pose rather than stepping it
    let prev = Infinity
    for (let i = 0; i <= 4000; i++) {
      const w = portraitWeight(0.2 + (i / 4000) * 1.4)
      expect(w).toBeLessThanOrEqual(prev)
      prev = w
    }
    // A viewport that has not measured itself yet reports 0, or NaN through the divide. The
    // landscape pose is the safe answer for every one of them, and it must be the EXACT zero —
    // a NaN weight would propagate straight into the camera's position.
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(Object.is(portraitWeight(bad), 0), `weight at ${bad}`).toBe(true)
    }
  })

  it('returns the LANDSCAPE targets bit for bit at every landscape aspect', () => {
    // The fork is a change of INPUT, not a second code path: this is what that means.
    for (const a of LANDSCAPE_ASPECTS) {
      expect(Object.is(zoomFactorFor(a), ZOOM_FACTOR), `zoom at aspect ${a}`).toBe(true)
    }
  })

  it('AND the aspect-taking pose is bit-identical to the existing one, over the whole track', () => {
    // The sweep the divergence has to survive. `Object.is` rather than equality so a −0 cannot
    // pass as a 0, and the whole domain rather than a handful of stops, because the failure this
    // guards against is a small drift somewhere in the middle of the pull-back.
    //
    // The comparison is done in a plain loop and asserted ONCE. 10 aspects x 4001 stops x 12
    // scalars is half a million comparisons; run through `expect` they cost seven seconds and time
    // the suite out, which buys nothing — a bit-identity sweep either finds a difference or it does
    // not, and the first one it finds is the whole report.
    const SWEEP = 4000
    let bad: string | null = null
    outer: for (const a of LANDSCAPE_ASPECTS) {
      for (let i = 0; i <= SWEEP; i++) {
        const p = (i / SWEEP) * TRACK_END
        const e = endingStateAt(p)
        const pairs: [string, number, number][] = [
          ['distance', endingCameraDistanceFor(e, a), endingCameraDistance(e)],
          ['aim drop', endingAimDropFor(e, a), endingAimDrop(e)],
          ['zoom scale', cameraZoomScaleFor(e, a), cameraZoomScale(e)],
        ]
        const pos = cameraPositionAtFor(p, a)
        const base = cameraPositionAt(p)
        const aim = cameraTargetAtFor(p, a)
        const baseAim = cameraTargetAt(p)
        for (let c = 0; c < 3; c++) {
          pairs.push([`eye[${c}]`, pos[c], base[c]], [`aim[${c}]`, aim[c], baseAim[c]])
        }
        for (const [what, got, want] of pairs) {
          if (!Object.is(got, want)) {
            bad = `${what} at aspect ${a}, progress ${p}: ${got} !== ${want}`
            break outer
          }
        }
      }
    }
    expect(bad).toBeNull()
  })

  it('and the landscape path is still the arithmetic Task 66 wrote, not a wrapper that drifted', () => {
    // Spelled here rather than imported, so that routing `endingAimDrop` through the aspect-taking
    // sibling cannot quietly change what it computes.
    const smoothstep = (t: number) => {
      const x = t < 0 ? 0 : t > 1 ? 1 : t
      return x * x * (3 - 2 * x)
    }
    for (let i = 0; i <= 4000; i++) {
      const e = endingStateAt((i / 4000) * TRACK_END)
      expect(Object.is(endingAimDrop(e), ENDING_AIM_DROP * smoothstep(e.zoom))).toBe(true)
      expect(
        Object.is(cameraZoomScale(e), Math.exp(Math.log(ZOOM_FACTOR) * smoothstep(e.zoom)))
      ).toBe(true)
    }
  })

  it('holds the journey pose bit-identically AT EVERY ASPECT, phones included', () => {
    // Stronger than the Task 63 sweep, and it has to be: the pose now has a second input, so
    // "the camera never moves while rotation can" is a claim about a surface rather than a curve.
    // Asserted once, for the reason the sweep above gives.
    const SWEEP = 2000
    let bad: string | null = null
    outer: for (const a of [...LANDSCAPE_ASPECTS, ...BAND_ASPECTS, ...PHONE_ASPECTS]) {
      for (let i = 0; i <= SWEEP; i++) {
        const p = (i / SWEEP) * ZOOM_FIRST_MOVE
        const pose = cameraPositionAtFor(p, a)
        const aim = cameraTargetAtFor(p, a)
        for (let c = 0; c < 3; c++) {
          if (!Object.is(pose[c], CAMERA_POSITION[c])) {
            bad = `eye[${c}] at aspect ${a}, progress ${p}: ${pose[c]}`
            break outer
          }
          if (!Object.is(aim[c], CAMERA_TARGET[c])) {
            bad = `aim[${c}] at aspect ${a}, progress ${p}: ${aim[c]}`
            break outer
          }
        }
      }
    }
    expect(bad).toBeNull()
  })

  it('rewinds through the identical function at portrait aspects too', () => {
    for (const a of [...PHONE_ASPECTS, ...BAND_ASPECTS]) {
      const forward: number[][] = []
      for (let i = 0; i <= 2000; i++) {
        const p = (i / 2000) * TRACK_END
        forward.push([...cameraPositionAtFor(p, a), ...cameraTargetAtFor(p, a)])
      }
      for (let i = 2000; i >= 0; i--) {
        const p = (i / 2000) * TRACK_END
        expect([...cameraPositionAtFor(p, a), ...cameraTargetAtFor(p, a)]).toEqual(forward[i])
      }
    }
  })

  it('reaches exactly the portrait zoom at the bottom of the track, monotonically', () => {
    for (const a of PHONE_ASPECTS) {
      expect(endingCameraDistanceFor(endingStateAt(TRACK_END), a)).toBeCloseTo(
        CAMERA_DISTANCE * zoomFactorFor(a),
        10
      )
    }
    for (const a of [...PHONE_ASPECTS, ...BAND_ASPECTS]) {
      let prev = -Infinity
      for (let i = 0; i <= 2000; i++) {
        const d = endingCameraDistanceFor(endingStateAt((i / 2000) * TRACK_END), a)
        expect(d).toBeGreaterThanOrEqual(prev)
        prev = d
      }
    }
    // ...and the solve that would diverge still does — see the identity block above.
    expect(CANDIDATE_ZOOM / ZOOM_FACTOR).toBeGreaterThan(1.15)
  })
})

/**
 * PHASE 1 SHIPS PORTRAIT EQUAL TO LANDSCAPE, ON PURPOSE.
 *
 * `GLOBE_FRAME_PORTRAIT = GLOBE_FRAME`: the 0.30 that was measured and captured is
 * a real trade (36% more frame width for 45% of Aram's note's lettering) and it is
 * a taste call NOBODY MADE — Aram's redirect puts a human-scale Alwina behind the
 * desk in phase 2, which changes what a portrait frame anchors to, so the call was
 * held and the branch must not carry it.
 *
 * Withdrawing the number must not withdraw the GATES on the arithmetic under it.
 * So every assertion that proves the fork actually composes now evaluates a
 * CANDIDATE pose built from the same exported solvers the shipped one uses. They
 * keep their full force, they keep the measured numbers on the record, and phase 2
 * makes them describe the shipped pose again by changing one constant.
 */
const CANDIDATE_GLOBE_FRAME = 0.3
const CANDIDATE_ZOOM = zoomForGlobeFrame(CANDIDATE_GLOBE_FRAME)
const CANDIDATE_AIM = aimForZoom(CANDIDATE_ZOOM)

describe('the portrait fork is currently an IDENTITY, deliberately', () => {
  it('ships the landscape ZOOM at every aspect, bit for bit', () => {
    // The zoom is a closed form, so equal targets give equal values exactly.
    for (const a of [...PHONE_ASPECTS, ...BAND_ASPECTS, 1.6, 16 / 9, 4]) {
      expect(Object.is(zoomFactorFor(a), ZOOM_FACTOR)).toBe(true)
    }
    expect(Object.is(ZOOM_FACTOR_PORTRAIT, ZOOM_FACTOR)).toBe(true)
  })

  it('ships the landscape AIM to the solvers` own resolution, and exactly on desktop', () => {
    // THE TWO AIMS ARE NOT THE SAME EQUATION, which is worth knowing rather than
    // hiding: the landscape aim bisects on the GLOBE's lower tangent sitting
    // STAND_GAP above the desk edge, the portrait aim bisects on the DESK EDGE
    // landing at DESK_EDGE_V. They agree in intent and to about 1e-9 in value,
    // but not in the last bits, so equal targets do not make them `Object.is`.
    //
    // What DOES have to be exact is the desktop path, and it is: `portraitWeight`
    // is exactly 0 at and above LANDSCAPE_ASPECT and `mix(a, b, 0)` is `1·a + 0·b`.
    for (const a of [1, 1.6, 16 / 9, 4]) {
      expect(Object.is(endingAimTargetFor(a), ENDING_AIM_DROP)).toBe(true)
    }
    for (const a of [...PHONE_ASPECTS, ...BAND_ASPECTS]) {
      expect(Math.abs(endingAimTargetFor(a) - ENDING_AIM_DROP)).toBeLessThan(1e-6)
    }
    expect(Math.abs(ENDING_AIM_DROP_PORTRAIT - ENDING_AIM_DROP)).toBeLessThan(1e-6)
  })

  it('still solves a DIFFERENT pose the moment a portrait target is authored', () => {
    // The machinery is live, not commented out: give it a real target and it moves.
    expect(CANDIDATE_ZOOM / ZOOM_FACTOR).toBeGreaterThan(1.15)
    expect(CANDIDATE_AIM).toBeLessThan(ENDING_AIM_DROP)
  })
})

describe('the portrait composition is SOLVED from its one authored number', () => {
  it('restates the desk`s back edge bit-identically rather than copying a solved number', () => {
    // camera.ts cannot import desk-stage.ts (that file imports THIS one), so the desk plane's
    // solve is restated. A relation pin — the WORLD_RADIUS treatment — is what stops the copy
    // drifting, and it is on `Object.is` because the two solves are the same bisection.
    expect(Object.is(DESK_EDGE_POINT[0], 0)).toBe(true)
    expect(Object.is(DESK_EDGE_POINT[1], DESK_TOP_Y)).toBe(true)
    expect(Object.is(DESK_EDGE_POINT[2], DESK_BACK_Z)).toBe(true)
  })

  it('stands the world at GLOBE_FRAME_PORTRAIT of the frame, re-derived from the pose', () => {
    // THE CLOSED FORM SOLVES THE ON-AXIS SUBTENSE, and the aim drop puts the world OFF axis, so
    // the realised silhouette runs a shade taller than the target at both poses — 0.358 against
    // 0.355 on a laptop, 0.301 against 0.300 on a phone. That is the same 0.8% at both, which is
    // the claim worth making: the two poses realise their targets to the SAME fidelity, so the
    // portrait solve is the landscape solve at a different number rather than a looser one.
    const g = globeEdgesAt(CANDIDATE_ZOOM, CANDIDATE_AIM)
    const l = globeEdgesAt(ZOOM_FACTOR, ENDING_AIM_DROP)
    expect((g.top - g.bot) / 2).toBeCloseTo(CANDIDATE_GLOBE_FRAME, 2)
    expect((l.top - l.bot) / 2).toBeCloseTo(GLOBE_FRAME, 2)
    // both overshoot, and by under a percent
    expect((g.top - g.bot) / 2 / CANDIDATE_GLOBE_FRAME).toBeLessThan(1.01)
    expect((l.top - l.bot) / 2 / GLOBE_FRAME).toBeLessThan(1.01)
    // The phone's world would be SMALLER in the frame. That is the price of the whole fork and
    // the only thing the phone spends — held, not spent, in phase 1.
    expect(CANDIDATE_GLOBE_FRAME).toBeLessThan(GLOBE_FRAME)
  })

  it('gives the desk the SAME share of a phone`s frame it owns of a laptop`s', () => {
    // DESK_FRAME is reused rather than re-authored, and this is what that buys: the desk's back
    // edge lands on the same line at both poses, so the composition's language does not change
    // with the viewport — only its width does.
    expect(ndcYAt(DESK_EDGE_POINT, ZOOM_FACTOR_PORTRAIT, ENDING_AIM_DROP_PORTRAIT)).toBeCloseTo(
      DESK_EDGE_V,
      9
    )
    expect(ndcYAt(DESK_EDGE_POINT, ZOOM_FACTOR, ENDING_AIM_DROP)).toBeCloseTo(DESK_EDGE_V, 9)
  })

  it('holds that share across the WHOLE blend band, not just at its two ends', () => {
    // The fork interpolates the two SOLVED poses, not the two authored targets, so nothing
    // guarantees a priori that an intermediate aspect composes. Measured: it does — the desk's
    // edge never leaves a 0.004-ndc band, i.e. the desk owns 40.0–40.2% of the frame at every
    // aspect from a phone to an ultrawide.
    let lo = Infinity
    let hi = -Infinity
    for (let i = 0; i <= 600; i++) {
      const a = 0.3 + (i / 600) * 3.7
      const e = endingStateAt(TRACK_END)
      const v = ndcYAt(DESK_EDGE_POINT, cameraZoomScaleFor(e, a), endingAimDropFor(e, a))
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    expect(hi - lo).toBeLessThan(0.005)
    expect(lo).toBeGreaterThan(DESK_EDGE_V - 0.005)
    expect(hi).toBeLessThan(DESK_EDGE_V + 0.005)
  })

  it('leaves the stand a real band, as a CONSEQUENCE rather than a target', () => {
    // With DESK_TOP_Y unable to fork, STAND_GAP stops being authorable on portrait: it moves by
    // less than 0.0003 across the entire usable aim range, so a bisection on it would be solving
    // a singular equation. It is reported instead — and gated positive, which is the part that
    // means "the world is seated on its stand rather than sinking behind the desk".
    const candidateGap = globeEdgesAt(CANDIDATE_ZOOM, CANDIDATE_AIM).bot - DESK_EDGE_V
    expect(candidateGap).toBeGreaterThan(0.04)
    expect(candidateGap).toBeLessThan(STAND_GAP)
    // the singularity itself, measured rather than asserted
    const gapAt = (aim: number) =>
      globeEdgesAt(CANDIDATE_ZOOM, aim).bot - ndcYAt(DESK_EDGE_POINT, CANDIDATE_ZOOM, aim)
    expect(Math.abs(gapAt(0.5) - gapAt(4))).toBeLessThan(0.0005)
  })

  it('actually widens the phone`s view of the desk — the whole point, as a number', () => {
    // The acceptance claim, in world units on the desk plane at the figurine row. Measured off
    // the shipped `desk.glb` by connected components, the nearest payoff props stand at
    // |x| = 1.376 (donut) and 1.457 (sculpting tool); the landscape pose reaches neither on a
    // phone, and the portrait pose reaches both.
    const e = endingStateAt(TRACK_END)
    for (const [w, h] of [
      [390, 844],
      [360, 800],
      [430, 932],
    ]) {
      const a = w / h
      const before = halfWidthAt(9.5, a, ZOOM_FACTOR, ENDING_AIM_DROP)
      const after = halfWidthAt(9.5, a, CANDIDATE_ZOOM, CANDIDATE_AIM)
      expect(after / before, `frame width gain at ${w}×${h}`).toBeGreaterThan(1.3)
      // the donut and the tool are in the picture, at their own depths
      expect(halfWidthAt(11.4, a, CANDIDATE_ZOOM, CANDIDATE_AIM)).toBeGreaterThan(1.46)
      // ...and Aram's note stops being cropped: it is 2.37 wide, yawed, centred at x = 0.06
      expect(halfWidthAt(10.55, a, CANDIDATE_ZOOM, CANDIDATE_AIM)).toBeGreaterThan(1.31)
    }
    // ...while the laptop's frame is exactly the one it was
    expect(
      Object.is(
        halfWidthAt(9.5, 1.6, cameraZoomScaleFor(e, 1.6), endingAimDropFor(e, 1.6)),
        deskFrameHalfW(9.5, 1.6)
      )
    ).toBe(true)
  })
})

describe('the phone`s pull-back cannot show the backdrop an edge either', () => {
  it('re-proves the sky claim at the PORTRAIT pose, which is a longer pull-back and a shallower aim', () => {
    // Task 66 re-proved this rather than inheriting it, because a re-aim walks the frustum across
    // the plane. Task 76 has to do the same for the same reason twice over: the phone's aim is
    // SHALLOWER (1.26 against 1.89) and its pull-back is LONGER, so the framed band sits
    // differently. The plane's own invariance survives only because `sky.tsx` now scales by the
    // ASPECT's factor — this walks the real corner rays at the pose the phone actually gets.
    const SKY_POSITION = [0, -10, -20]
    const SKY_SCALE = [140, 90]
    for (const aspect of [...PHONE_ASPECTS, ...BAND_ASPECTS, LANDSCAPE_ASPECT]) {
      for (let i = 0; i <= 40; i++) {
        const zoom = i / 40
        const ending = { ...endingStateAt(TRACK_END), zoom }
        const k = cameraZoomScaleFor(ending, aspect)
        const r = endingRig(k, endingAimDropFor(ending, aspect))
        const planeZ = SKY_POSITION[2] * k
        const halfW = (SKY_SCALE[0] / 2) * k
        const midY = SKY_POSITION[1] * k
        const halfH = (SKY_SCALE[1] / 2) * k
        for (const vSign of [-1, 1]) {
          for (const hSign of [-1, 1]) {
            const d = [
              hSign * TAN_HALF * aspect,
              r.fwd[1] + vSign * TAN_HALF * r.up[1],
              r.fwd[2] + vSign * TAN_HALF * r.up[2],
            ]
            const t = (planeZ - r.cam[2]) / d[2]
            expect(t).toBeGreaterThan(0)
            const y = r.cam[1] + t * d[1]
            const x = t * d[0]
            expect(Math.abs(x), `sky side at aspect ${aspect.toFixed(3)}`).toBeLessThan(halfW)
            expect(y, `sky bottom at aspect ${aspect.toFixed(3)}`).toBeGreaterThan(midY - halfH)
            expect(y, `sky top at aspect ${aspect.toFixed(3)}`).toBeLessThan(midY + halfH)
          }
        }
      }
    }
  })
})

describe('THE WALL that pins GLOBE_FRAME_PORTRAIT', () => {
  /**
   * 0.30 is not where the phone's picture stops improving; it is where the DESK RUNS OUT.
   *
   * `desk.glb`'s slab ends at `DESK_NEAR_Z`, and a bottom corner ray that reaches the desk plane
   * beyond it frames a void under the table. `camera-parallax.test.ts` already gates that for the
   * landscape pose; this is the same predicate at the pose a phone actually gets, and it is the
   * reason the authored number is where it is rather than lower. It fails at 0.29.
   */
  const CORNERS: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
    [0, 0],
  ]

  it('never opens a void under the desk at a portrait pose, at any pointer extreme', () => {
    let worstZ = -Infinity
    let worstX = 0
    let worstAt = ''
    for (let i = 0; i <= 60; i++) {
      const aspect = 0.3 + (i / 60) * 0.75
      const e = endingStateAt(TRACK_END)
      const gain = parallaxGainFor(e)
      const aim: [number, number, number] = cameraTargetAtFor(TRACK_END, aspect)
      for (const [cx, cy] of CORNERS) {
        const eye = orbitEyeInto(
          cameraPositionAtFor(TRACK_END, aspect),
          aim,
          cx * yawMaxFor(aspect) * gain,
          cy * PARALLAX_PITCH_MAX * gain,
          [0, 0, 0]
        )
        const rig = orbitRig(eye, aim)
        for (const sx of [-1, 1]) {
          const d = [
            rig.fwd[0] + rig.right[0] * TAN_HALF * aspect * sx - rig.up[0] * TAN_HALF,
            rig.fwd[1] + rig.right[1] * TAN_HALF * aspect * sx - rig.up[1] * TAN_HALF,
            rig.fwd[2] + rig.right[2] * TAN_HALF * aspect * sx - rig.up[2] * TAN_HALF,
          ]
          expect(d[1]).toBeLessThan(0)
          const t = (DESK_TOP_Y - rig.cam[1]) / d[1]
          const z = rig.cam[2] + d[2] * t
          if (z > worstZ) {
            worstZ = z
            worstAt = `aspect ${aspect.toFixed(3)}, pointer ${cx},${cy}`
          }
          worstX = Math.max(worstX, Math.abs(rig.cam[0] + d[0] * t))
        }
      }
    }
    expect(worstZ, `deepest desk-plane hit at ${worstAt}`).toBeLessThan(DESK_NEAR_Z)
    expect(worstX).toBeLessThan(DESK_HALF_W)
    // ...by a margin rather than a squeak. 0.39 world units of slab is what is left; the number is
    // recorded so a later edit that spends it has to change this line and say why.
    expect(DESK_NEAR_Z - worstZ).toBeGreaterThan(0.3)
  })

  it('and a notch further out would break it — which is why 0.30 is authored, not chosen', () => {
    // The same corner ray at the pull-backs the next two round numbers down would produce. Not
    // hypothetical: they are the obvious next tries, and this is what they cost. Judged at the
    // pose the RENDERER would use, pointer and all — the un-orbited centre ray still clears 0.29
    // by 0.46 and would call it fine. It is the breath that spends the rest.
    const headroomFor = (globeFrame: number) => {
      const u = globeFrame * TAN_HALF
      const k = (WORLD_RADIUS * Math.sqrt(1 + u * u)) / (CAMERA_DISTANCE * u)
      let lo = 0
      let hi = 12
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2
        if (ndcYAt(DESK_EDGE_POINT, k, mid) < DESK_EDGE_V) lo = mid
        else hi = mid
      }
      const aim = (lo + hi) / 2
      const target: [number, number, number] = [0, -aim, 0]
      const base = endingRig(k, aim)
      let worst = -Infinity
      for (const aspect of [430 / 932, 390 / 844, 0.45]) {
        for (const [cx, cy] of CORNERS) {
          const rig = orbitRig(
            orbitEyeInto(
              base.cam,
              target,
              cx * yawMaxFor(aspect),
              cy * PARALLAX_PITCH_MAX,
              [0, 0, 0]
            ),
            target
          )
          for (const sx of [-1, 1]) {
            const d = [
              rig.fwd[0] + rig.right[0] * TAN_HALF * aspect * sx - rig.up[0] * TAN_HALF,
              rig.fwd[1] + rig.right[1] * TAN_HALF * aspect * sx - rig.up[1] * TAN_HALF,
              rig.fwd[2] + rig.right[2] * TAN_HALF * aspect * sx - rig.up[2] * TAN_HALF,
            ]
            worst = Math.max(worst, rig.cam[2] + d[2] * ((DESK_TOP_Y - rig.cam[1]) / d[1]))
          }
        }
      }
      return DESK_NEAR_Z - worst
    }
    // The shipped number leaves a real band of slab...
    expect(headroomFor(GLOBE_FRAME_PORTRAIT)).toBeGreaterThan(0.3)
    // ...0.29 leaves a sixth of it, which is inside the pointer's own swing...
    expect(headroomFor(0.29)).toBeLessThan(0.1)
    // ...and 0.28 is off the end of the desk entirely.
    expect(headroomFor(0.28)).toBeLessThan(0)
  })
})

/**
 * The second half of why a widening frustum is safe: it cannot expose a half-finished
 * flip, because there are none left. Every renewal gate is a smoothstep that returns
 * EXACTLY 0 or 1 outside its window, and at ROTATION_TOTAL every vertex on the planet is
 * past both windows. So the extra sliver of surface the pull-back reveals is crisp
 * variant paint, everywhere, by arithmetic rather than by occlusion.
 */
describe('every renewal gate is saturated where the camera may move', () => {
  const STEPS = 20_000

  // The rotation the scene actually parks at, which is one ulp below 4π — see the note in
  // ending-timeline.test.ts. Using the rendered value rather than the ideal one keeps this a
  // statement about the shipped scene.
  const PARKED = rotationAt(1)

  it('has flipped EVERY longitude to variant B, exactly, at the parked rotation', () => {
    for (let i = 0; i < STEPS; i++) {
      const thetaC = STANCE_ALPHA + (i / STEPS) * Math.PI * 2
      expect(renewalGate(thetaC, PARKED)).toBe(1)
    }
  })

  it('has finished the epilogue flip everywhere the epilogue is actually painted', () => {
    // The epilogue gate is only ever consumed inside `epilogueRegion`, whose far edge is
    // EPILOGUE_END plus a torn wander of at most BOUNDARY_WANDER. Sweep the whole region at
    // its worst-case reach, at every latitude the tear can take.
    for (let i = 0; i <= 400; i++) {
      const nx = -1 + (2 * i) / 400
      for (let j = 0; j <= 200; j++) {
        const thetaC = STANCE_ALPHA + (j / 200) * (EPILOGUE_END + BOUNDARY_WANDER - STANCE_ALPHA)
        if (epilogueRegion(thetaC, nx) === 1) {
          expect(epilogueGate(thetaC, PARKED)).toBe(1)
        }
      }
    }
  })
})
