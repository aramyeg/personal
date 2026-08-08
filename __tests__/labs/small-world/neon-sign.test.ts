import { describe, expect, it } from 'vitest'
import {
  ENDING_SPAN,
  TRACK_END,
  ZOOM_START,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'
import {
  CAMERA_FOV,
  WORLD_RADIUS,
  cameraPositionAtFor,
  cameraTargetAtFor,
} from '@/components/labs/small-world/scene/camera'
import {
  PARALLAX_PITCH_MAX,
  orbitEyeInto,
  orbitRig,
  yawMaxFor,
} from '@/components/labs/small-world/scene/camera-parallax'
import { studioLightsFor } from '@/components/labs/small-world/scene/desk-studio'
import {
  SIGN_IGNITE_AT,
  SIGN_STEADY_AT,
  SIGN_WORDS,
  SIGN_WORLD_CEILING,
  flickerAt,
  signMinReachFromOrigin,
  signPointsWorld,
  wordPointsWorld,
} from '@/components/labs/small-world/scene/neon-sign'

/**
 * THE NEON'S GATES (Task 99). The sign lives at globe height, INSIDE the journey camera's
 * frame, so it cannot be parked out of the frustum the way the desk is — its containment is the
 * strike envelope being exactly 0 wherever the studio lights are 0, and its composition is a set
 * of projection gates swept across the full parallax envelope at both reference viewports.
 */

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360)
const REF_ASPECT = 1440 / 900
const PHONE_ASPECT = 390 / 844

/** Project a world point through the ending camera at an aspect, orbited by (yaw, pitch). */
function project(
  p: readonly [number, number, number],
  aspect: number,
  yaw: number,
  pitch: number
): { x: number; y: number } {
  const eye = cameraPositionAtFor(TRACK_END, aspect)
  const aim = cameraTargetAtFor(TRACK_END, aspect)
  const orb: [number, number, number] = [0, 0, 0]
  orbitEyeInto(eye, aim, yaw, pitch, orb)
  const r = orbitRig(orb, aim)
  const v = [p[0] - r.cam[0], p[1] - r.cam[1], p[2] - r.cam[2]]
  const depth = v[0] * r.fwd[0] + v[1] * r.fwd[1] + v[2] * r.fwd[2]
  return {
    x: (v[0] * r.right[0] + v[1] * r.right[1] + v[2] * r.right[2]) / (depth * TAN_HALF_FOV * aspect),
    y: (v[0] * r.up[0] + v[1] * r.up[1] + v[2] * r.up[2]) / (depth * TAN_HALF_FOV),
  }
}

/** The globe's silhouette half-width in ndc x at the orbited pose (angular radius at depth). */
function globeHalfWidthNdc(aspect: number, yaw: number, pitch: number): number {
  const eye = cameraPositionAtFor(TRACK_END, aspect)
  const aim = cameraTargetAtFor(TRACK_END, aspect)
  const orb: [number, number, number] = [0, 0, 0]
  orbitEyeInto(eye, aim, yaw, pitch, orb)
  const d = Math.hypot(orb[0], orb[1], orb[2])
  return Math.tan(Math.asin(WORLD_RADIUS / d)) / (TAN_HALF_FOV * aspect)
}

const ENVELOPE = (aspect: number): [number, number][] => {
  const yaw = yawMaxFor(aspect)
  const corners: [number, number][] = []
  for (const sy of [-1, 0, 1]) {
    for (const sp of [-1, 0, 1]) {
      corners.push([sy * yaw, sp * PARALLAX_PITCH_MAX])
    }
  }
  return corners
}

describe('the strike envelope (containment by light)', () => {
  it('is exactly 0 for the whole journey and the whole still beat', () => {
    for (let i = 0; i <= 400; i++) {
      const progress = (i / 400) * (1 + ZOOM_START * ENDING_SPAN)
      const lights = studioLightsFor(endingStateAt(progress))
      expect(flickerAt(lights)).toBe(0)
      expect(flickerAt(lights, true)).toBe(0)
    }
  })

  it('is exactly 1 at the money shot — parked, nothing may crawl', () => {
    const lights = studioLightsFor(endingStateAt(TRACK_END))
    expect(lights).toBe(1)
    expect(flickerAt(1)).toBe(1)
    expect(flickerAt(1, true)).toBe(1)
    // the whole steady band, not just the endpoint
    for (let i = 0; i <= 50; i++) {
      const l = SIGN_STEADY_AT + (i / 50) * (1 - SIGN_STEADY_AT)
      expect(flickerAt(l)).toBe(1)
    }
  })

  it('strikes inside (IGNITE, STEADY) and never leaves [0, 1]', () => {
    let sawDark = false
    let sawLit = false
    for (let i = 0; i <= 500; i++) {
      const l = SIGN_IGNITE_AT + (i / 500) * (SIGN_STEADY_AT - SIGN_IGNITE_AT)
      const v = flickerAt(l)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      if (l > SIGN_IGNITE_AT + 0.02 && v < 0.01) sawDark = true
      if (v > 0.5) sawLit = true
    }
    expect(sawDark).toBe(true) // the strike really does drop dark between pulses
    expect(sawLit).toBe(true)
  })

  it('reduced motion takes the monotone ramp — steady on, no flicker', () => {
    let prev = -1
    for (let i = 0; i <= 200; i++) {
      const l = (i / 200) * 1
      const v = flickerAt(l, true)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('is deterministic — the same input replays bit-identically (scrub safety)', () => {
    for (let i = 0; i <= 100; i++) {
      const l = i / 100
      expect(flickerAt(l)).toBe(flickerAt(l))
      expect(Object.is(flickerAt(l), flickerAt(l))).toBe(true)
    }
  })
})

describe('the composition gates at the money shot (1440×900 reference)', () => {
  const [lets, create] = SIGN_WORDS
  const letsPts = wordPointsWorld(lets).flat()
  const createPts = wordPointsWorld(create).flat()

  it('flanks the globe with clear air on both sides, across the whole parallax envelope', () => {
    for (const [yaw, pitch] of ENVELOPE(REF_ASPECT)) {
      const halfW = globeHalfWidthNdc(REF_ASPECT, yaw, pitch)
      const centre = project([0, 0, 0], REF_ASPECT, yaw, pitch)
      const letsMax = Math.max(...letsPts.map((p) => project(p, REF_ASPECT, yaw, pitch).x))
      const createMin = Math.min(...createPts.map((p) => project(p, REF_ASPECT, yaw, pitch).x))
      // the words never enter the globe's silhouette band, with margin
      expect(letsMax).toBeLessThan(centre.x - halfW - 0.02)
      expect(createMin).toBeGreaterThan(centre.x + halfW + 0.02)
    }
  })

  it('stays inside the frame and above the desk band at every envelope corner', () => {
    for (const [yaw, pitch] of ENVELOPE(REF_ASPECT)) {
      for (const p of [...letsPts, ...createPts]) {
        const s = project(p, REF_ASPECT, yaw, pitch)
        expect(Math.abs(s.x)).toBeLessThan(0.98) // in frame horizontally
        expect(s.y).toBeLessThan(0.97) // in frame vertically
        expect(s.y).toBeGreaterThan(0.02) // far above the desk edge and the connect row
      }
    }
  })

  it('never reaches the bake ceiling — terrain cannot spear the tube', () => {
    expect(signMinReachFromOrigin()).toBeGreaterThan(SIGN_WORLD_CEILING + 0.1)
  })

  it('the geometry is deterministic', () => {
    const a = signPointsWorld()
    const b = signPointsWorld()
    expect(a).toEqual(b)
  })
})

describe('the phone frame (390×844): the sign hides by aperture, not by branch', () => {
  it('every tube point is off frame at every parallax corner', () => {
    for (const [yaw, pitch] of ENVELOPE(PHONE_ASPECT)) {
      for (const p of signPointsWorld().flat()) {
        const s = project(p, PHONE_ASPECT, yaw, pitch)
        expect(Math.abs(s.x)).toBeGreaterThan(1.02)
      }
    }
  })
})
