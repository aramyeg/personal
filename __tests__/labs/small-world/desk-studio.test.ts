import { describe, expect, it } from 'vitest'
import {
  STUDIO_ENV_FLOOR,
  STUDIO_LIGHTS_FULL,
  STUDIO_LIGHTS_START,
  gradeHoldFor,
  studioEnvIntensity,
  studioLightsAt,
  studioLightsFor,
} from '@/components/labs/small-world/scene/desk-studio'
import {
  AMBIENT_INTENSITY,
  KEY_INTENSITY,
  STUDIO_AMBIENT_INTENSITY,
  STUDIO_KEY_INTENSITY,
  releasedLightMix,
  studioLitIntensity,
} from '@/components/labs/small-world/scene/biome-atmosphere'
import { BIOME_MOODS, LIGHT_MIX_MAX } from '@/components/labs/small-world/overlay/grade-mood'
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


describe("the winter tint's release rides the same number, inverted (Task 71)", () => {
  it('is EXACTLY 1 for the whole journey and the whole still beat', () => {
    // The graded world has to be bit-for-bit what it was before this existed, everywhere the
    // journey owns. `Object.is` rather than a tolerance, for the same reason the camera gate uses
    // it: "close to unchanged" is not unchanged.
    for (let i = 0; i <= 4000; i++) {
      const p = (i / 4000) * ZOOM_FIRST_MOVE
      expect(Object.is(gradeHoldFor(endingStateAt(p)), 1)).toBe(true)
    }
    expect(Object.is(gradeHoldFor(ENDING_IDLE), 1)).toBe(true)
  })

  it('is EXACTLY 0 at the money shot, so the last frame is a settled one', () => {
    expect(Object.is(gradeHoldFor(endingStateAt(TRACK_END)), 0)).toBe(true)
  })

  it('is the studio lights and nothing else — one clock, not a second curve', () => {
    for (let i = 0; i <= 2000; i++) {
      const e = endingStateAt((i / 2000) * TRACK_END)
      expect(gradeHoldFor(e)).toBe(1 - studioLightsFor(e))
    }
  })

  it('lets go monotonically and retraces itself exactly backwards', () => {
    const down: number[] = []
    let prev = 2
    for (let i = 0; i <= 3000; i++) {
      const v = gradeHoldFor(endingStateAt((i / 3000) * TRACK_END))
      expect(v).toBeLessThanOrEqual(prev)
      prev = v
      down.push(v)
    }
    for (let i = 3000; i >= 0; i--) {
      expect(Object.is(gradeHoldFor(endingStateAt((i / 3000) * TRACK_END)), down[i])).toBe(true)
    }
  })

  it('relaxes the MIX and can never push it past the grade rail', () => {
    // The release scales how far the lights travel toward a pale cast. It cannot raise that mix,
    // and it cannot touch the intensities — so nothing about the ending can make the scene darker
    // or push a mood past LIGHT_MIX_MAX, which is what keeps the clay reading as its own clay.
    for (const mood of BIOME_MOODS) {
      for (let i = 0; i <= 200; i++) {
        const hold = gradeHoldFor(endingStateAt((i / 200) * TRACK_END))
        const mix = releasedLightMix(mood.lightMix, hold)
        expect(mix).toBeLessThanOrEqual(mood.lightMix)
        expect(mix).toBeLessThanOrEqual(LIGHT_MIX_MAX)
        expect(mix).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('ends on the UNGRADED light, not on a new one nobody has judged', () => {
    // At the money shot the mix is exactly 0, so the key and the ambient are GRADE_BASE — the
    // colours the lab opens on — rather than some studio-specific light invented for the ending.
    for (const mood of BIOME_MOODS) {
      expect(Object.is(releasedLightMix(mood.lightMix, gradeHoldFor(endingStateAt(TRACK_END))), 0)).toBe(true)
    }
  })
})

/**
 * THE STUDIO REACHES THE CLAY (Task 76) — the revised law, gated.
 *
 * Task 68's law was "the studio never touches clay". Task 76 replaces it with "the
 * studio reaches clay ONLY through the scroll-gated ending grade", which is a
 * narrower promise and therefore one that has to be kept precisely: the whole
 * journey must render through the numbers it always did, not through numbers that
 * happen to be very close to them.
 *
 * The pixel half of this gate is a capture-diff against tip 74a3f50: outside a box
 * around the girl herself (whose AnimationMixer has run on a wall clock since she
 * was first mounted, and which differs between two loads of the SAME build), the
 * journey frame is 100.0000% bit-identical, 0 pixels differing, max channel delta 0.
 * The control — the same build captured twice — differs inside that box by the same
 * order. Numbers in task-76-ending-report.md.
 */
describe('the studio lift reaches the clay and nothing before it', () => {
  it('holds both intensities at EXACTLY their journey values for the whole journey', () => {
    for (let i = 0; i <= 4000; i++) {
      const lights = studioLightsFor(endingStateAt((i / 4000) * ZOOM_FIRST_MOVE))
      expect(
        Object.is(studioLitIntensity(KEY_INTENSITY, STUDIO_KEY_INTENSITY, lights), KEY_INTENSITY)
      ).toBe(true)
      expect(
        Object.is(
          studioLitIntensity(AMBIENT_INTENSITY, STUDIO_AMBIENT_INTENSITY, lights),
          AMBIENT_INTENSITY
        )
      ).toBe(true)
    }
  })

  it('lands on EXACTLY the studio values at the money shot', () => {
    const lights = studioLightsFor(endingStateAt(TRACK_END))
    expect(Object.is(lights, 1)).toBe(true)
    expect(
      Object.is(studioLitIntensity(AMBIENT_INTENSITY, STUDIO_AMBIENT_INTENSITY, lights), STUDIO_AMBIENT_INTENSITY)
    ).toBe(true)
  })

  it('only ever brightens: the ending cannot make the clay darker than the journey', () => {
    // The grade's standing rail, inherited. A fill that could dip below the
    // journey's would be a mood change wearing a studio's clothes.
    expect(STUDIO_AMBIENT_INTENSITY).toBeGreaterThan(AMBIENT_INTENSITY)
    expect(STUDIO_KEY_INTENSITY).toBeGreaterThanOrEqual(KEY_INTENSITY)
    for (let i = 0; i <= 2000; i++) {
      const lights = studioLightsFor(endingStateAt((i / 2000) * TRACK_END))
      expect(studioLitIntensity(AMBIENT_INTENSITY, STUDIO_AMBIENT_INTENSITY, lights)).toBeGreaterThanOrEqual(
        AMBIENT_INTENSITY
      )
    }
  })

  it('is monotone, so the lights never dip on their way up', () => {
    let prev = -Infinity
    for (let i = 0; i <= 4000; i++) {
      const v = studioLitIntensity(
        AMBIENT_INTENSITY,
        STUDIO_AMBIENT_INTENSITY,
        studioLightsFor(endingStateAt((i / 4000) * TRACK_END))
      )
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('retraces bit-identically when the reader scrubs back', () => {
    const forward: number[] = []
    for (let i = 0; i <= 3000; i++) {
      forward.push(
        studioLitIntensity(
          AMBIENT_INTENSITY,
          STUDIO_AMBIENT_INTENSITY,
          studioLightsFor(endingStateAt((i / 3000) * TRACK_END))
        )
      )
    }
    for (let i = 3000; i >= 0; i--) {
      const back = studioLitIntensity(
        AMBIENT_INTENSITY,
        STUDIO_AMBIENT_INTENSITY,
        studioLightsFor(endingStateAt((i / 3000) * TRACK_END))
      )
      expect(Object.is(back, forward[i])).toBe(true)
    }
  })

  it('rides studioLightsAt itself rather than a second curve', () => {
    // Four consumers already read that number. A fifth clock in this ending is how
    // two of them end up disagreeing about how lit it is.
    for (let i = 0; i <= 500; i++) {
      const ending = endingStateAt(1 + (i / 500) * (TRACK_END - 1))
      const lights = studioLightsFor(ending)
      const want = AMBIENT_INTENSITY + (STUDIO_AMBIENT_INTENSITY - AMBIENT_INTENSITY) * lights
      expect(studioLitIntensity(AMBIENT_INTENSITY, STUDIO_AMBIENT_INTENSITY, lights)).toBeCloseTo(want, 12)
    }
  })
})
