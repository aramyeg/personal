import { describe, expect, it } from 'vitest'
import {
  STUDIO_ENV_FLOOR,
  STUDIO_LIGHTS_FULL,
  STUDIO_LIGHTS_START,
  studioEnvIntensity,
  studioLightsAt,
  studioLightsFor,
} from '@/components/labs/small-world/scene/desk-studio'
import {
  ENDING_IDLE,
  TRACK_END,
  ZOOM_FIRST_MOVE,
  endingStateAt,
} from '@/components/labs/small-world/ending-timeline'

/**
 * THE STUDIO LIGHTS COMING UP (Task 68) — the same standard the camera's pull-back is held to.
 *
 * This is the only new thing in the ending that ANIMATES, so it inherits the lab's two standing
 * obligations: it must be exactly nothing until the ending has begun (the journey's proofs all rest
 * on nothing changing while rotation can), and it must be bit-identical scrubbed backwards. Neither
 * is asserted approximately — `Object.is` throughout, because "close to zero" is what a value that
 * has quietly started moving looks like.
 */

describe('the lights are exactly off until the ending is under way', () => {
  it('is a hard +0 across the whole journey and the whole still beat', () => {
    for (let i = 0; i <= 4000; i++) {
      const progress = (i / 4000) * ZOOM_FIRST_MOVE
      expect(Object.is(studioLightsFor(endingStateAt(progress)), 0)).toBe(true)
    }
  })

  it('is +0 for the shared idle state every journey frame reads', () => {
    expect(Object.is(studioLightsFor(ENDING_IDLE), 0)).toBe(true)
  })

  it('stays off through the lead-in, so the first sliver of desk arrives dark', () => {
    // The desk enters the frame as the camera withdraws. A ramp that started with the camera would
    // already be a few percent up by the time there was anything to see it on.
    expect(Object.is(studioLightsAt(0), 0)).toBe(true)
    expect(Object.is(studioLightsAt(STUDIO_LIGHTS_START), 0)).toBe(true)
    expect(studioLightsAt(STUDIO_LIGHTS_START + 1e-6)).toBeGreaterThan(0)
  })
})

describe('the lights are exactly full before the money shot lands', () => {
  it('reaches 1 at STUDIO_LIGHTS_FULL and holds it to the bottom of the track', () => {
    expect(studioLightsAt(STUDIO_LIGHTS_FULL)).toBe(1)
    expect(studioLightsAt(1)).toBe(1)
    expect(studioLightsFor(endingStateAt(TRACK_END))).toBe(1)
  })

  it('leaves the closing fifth of the pull-back settled', () => {
    // The approved render is the LAST frame of the track. A transition still moving when it arrives
    // would make that picture a frame the ending passes through rather than one it lands on.
    expect(STUDIO_LIGHTS_FULL).toBeLessThan(0.9)
    for (let i = 0; i <= 200; i++) {
      const zoom = STUDIO_LIGHTS_FULL + (i / 200) * (1 - STUDIO_LIGHTS_FULL)
      expect(studioLightsAt(zoom)).toBe(1)
    }
  })
})

describe('it is a pure function of scroll, forwards and backwards', () => {
  it('gives bit-identical values scrubbing back through the same positions', () => {
    const up: number[] = []
    for (let i = 0; i <= 3000; i++) up.push(studioLightsFor(endingStateAt((i / 3000) * TRACK_END)))
    for (let i = 3000; i >= 0; i--) {
      expect(Object.is(studioLightsFor(endingStateAt((i / 3000) * TRACK_END)), up[i])).toBe(true)
    }
  })

  it('never goes backwards on the way up', () => {
    let prev = -1
    for (let i = 0; i <= 3000; i++) {
      const v = studioLightsAt(i / 3000)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('has no catchable end — zero slope at both ends of the ramp', () => {
    // smootherstep, the same easing the stand's rise uses: this is a reveal, not a transition, so
    // neither end may be a moment the eye can pick out.
    const h = 1e-4
    const slopeAt = (z: number) => (studioLightsAt(z + h) - studioLightsAt(z - h)) / (2 * h)
    const span = STUDIO_LIGHTS_FULL - STUDIO_LIGHTS_START
    const mid = slopeAt((STUDIO_LIGHTS_START + STUDIO_LIGHTS_FULL) / 2)
    expect(Math.abs(slopeAt(STUDIO_LIGHTS_START + 0.01 * span))).toBeLessThan(mid * 0.05)
    expect(Math.abs(slopeAt(STUDIO_LIGHTS_FULL - 0.01 * span))).toBeLessThan(mid * 0.05)
  })
})

describe("the metal's environment follows the same number", () => {
  it('never goes fully dark, and lands at exactly 1', () => {
    // A metal that reflects nothing is not a dim metal, it is a hole in the frame.
    expect(studioEnvIntensity(0)).toBe(STUDIO_ENV_FLOOR)
    expect(studioEnvIntensity(1)).toBe(1)
    expect(STUDIO_ENV_FLOOR).toBeGreaterThan(0)
  })

  it('rises with the lights rather than on its own schedule', () => {
    for (let i = 0; i <= 100; i++) {
      const u = i / 100
      expect(studioEnvIntensity(u)).toBeCloseTo(STUDIO_ENV_FLOOR + (1 - STUDIO_ENV_FLOOR) * u, 12)
    }
  })
})
