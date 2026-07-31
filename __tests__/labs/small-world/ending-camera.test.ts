import { describe, expect, it } from 'vitest'
import {
  CAMERA_DISTANCE,
  CAMERA_POSITION,
  CAMERA_RAY,
  CAMERA_RIG_PRIORITY,
  ZOOM_FACTOR,
  cameraPositionAt,
  cameraZoomScale,
  endingCameraDistance,
} from '@/components/labs/small-world/scene/camera'
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
    }
  })

  it('holds through the curtain call too, up to a boundary DERIVED from the timeline', () => {
    // Not a restated number: the first progress the camera may move at is the ending's own
    // zoom-window start, and this walks the whole domain below it.
    for (let i = 0; i <= SWEEP; i++) {
      const p = (i / SWEEP) * ZOOM_FIRST_MOVE
      expect(cameraPositionAt(p)).toEqual([...CAMERA_POSITION])
    }
    expect(endingCameraDistance(endingStateAt(ZOOM_FIRST_MOVE))).toBe(CAMERA_DISTANCE)
  })

  it('leaves a whole curtain call between the last moving rotation and the first moving camera', () => {
    // rotation is a function of scroll only below 1 (`rotationAt` clamps there)...
    expect(rotationAt(1)).toBeCloseTo(ROTATION_TOTAL, 12)
    expect(rotationAt(TRACK_END)).toBe(rotationAt(1))
    // ...and the camera cannot move below ZOOM_FIRST_MOVE. The sets are disjoint, and the
    // margin between them is the curtain window, in progress units.
    expect(ZOOM_FIRST_MOVE).toBeGreaterThan(1)
    expect(ZOOM_FIRST_MOVE - 1).toBeCloseTo(ZOOM_START * ENDING_SPAN, 12)
  })

  it('DOES move just past that boundary — the invariant is a boundary, not a freeze', () => {
    const moved = cameraPositionAt(ZOOM_FIRST_MOVE + 1e-3)
    expect(moved[2]).toBeGreaterThan(CAMERA_POSITION[2])
  })

  it('rewinds through the identical function — scrub-back cannot strand the zoom', () => {
    const forward: number[][] = []
    for (let i = 0; i <= 4000; i++) forward.push(cameraPositionAt((i / 4000) * TRACK_END))
    for (let i = 4000; i >= 0; i--) {
      expect(cameraPositionAt((i / 4000) * TRACK_END)).toEqual(forward[i])
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

  it('travels along the view ray, so the aim never changes', () => {
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
    // eased midpoint.) The two differ by 3.2 world units here — far past any rounding.
    const at = (zoom: number) => endingCameraDistance({ ...endingStateAt(TRACK_END), zoom })
    const geometric = Math.sqrt(at(0) * at(1))
    const arithmetic = (at(0) + at(1)) / 2
    expect(at(0.5)).toBeCloseTo(geometric, 10)
    expect(Math.abs(arithmetic - geometric)).toBeGreaterThan(3)
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
