import { describe, expect, it } from 'vitest'
import {
  ENDING_DPR_AT,
  ENDING_DPR_FLOOR,
  ENDING_DPR_HYSTERESIS,
  endingDprFor,
} from '@/components/labs/small-world/scene/ending-dpr'
import { STUDIO_LIGHTS_FULL } from '@/components/labs/small-world/scene/desk-studio'

/**
 * THE ENDING'S PIXEL RATIO (Task 81).
 *
 * The feature is one line of arithmetic, and every way it can go wrong is a PERFORMANCE bug rather
 * than a picture bug — a floor that engages during the journey costs four times the fragments where
 * the frame budget is tightest, and a floor that flips on a threshold reallocates a 2880×1800
 * multisampled buffer on frames where nothing changed. So this gates the scoping and the latching,
 * not the number.
 */
describe('the dpr floor belongs to the ending and to nothing else', () => {
  it('leaves the whole journey exactly as the device asked', () => {
    // zoom is 0 for every progress <= 1, i.e. all six chapters and the still beat.
    for (const device of [1, 1.5, 2, 3]) {
      expect(endingDprFor(0, device, device), `device ${device}`).toBeNull()
    }
  })

  it('does not raise anything before the studio has finished arriving', () => {
    for (const zoom of [0.1, 0.4, 0.7, ENDING_DPR_AT - ENDING_DPR_HYSTERESIS]) {
      expect(endingDprFor(zoom, 1, 1), `zoom ${zoom}`).toBeNull()
    }
  })

  it('engages at the beat the studio finishes on, which is the beat the breath starts on', () => {
    // Stated as a relation in the source, so retuning the studio's ramp carries both with it.
    expect(ENDING_DPR_AT).toBe(STUDIO_LIGHTS_FULL)
    expect(endingDprFor(ENDING_DPR_AT, 1, 1)).toBe(ENDING_DPR_FLOOR)
    expect(endingDprFor(1, 1, 1)).toBe(ENDING_DPR_FLOOR)
  })

  it('is a FLOOR, so a device already above it is never lowered', () => {
    expect(endingDprFor(1, 3, 3)).toBeNull()
    expect(endingDprFor(1, 2, 2)).toBeNull()
    // ...and a 1.5x device is raised to the floor rather than to its own ratio
    expect(endingDprFor(1, 1.5, 1.5)).toBe(ENDING_DPR_FLOOR)
  })

  it('writes ONCE on the way in — a settled frame asks for nothing', () => {
    let current = 1
    let writes = 0
    for (let i = 0; i <= 40; i++) {
      const next = endingDprFor(ENDING_DPR_AT + (i / 40) * (1 - ENDING_DPR_AT), 1, current)
      if (next !== null) {
        current = next
        writes++
      }
    }
    expect(writes).toBe(1)
    expect(current).toBe(ENDING_DPR_FLOOR)
  })

  it('CANNOT thrash on a scroll resting at the threshold — the hysteresis is load-bearing', () => {
    // A damped scroll settling onto the boundary is the realistic case, and without the band it
    // would resize the drawing buffer every frame: the worst frame time in the lab, produced by
    // the feature meant to improve the picture.
    let current = 1
    let writes = 0
    for (let i = 0; i < 200; i++) {
      // an exponential settle onto ENDING_DPR_AT from just above it, plus a jitter either side
      const zoom = ENDING_DPR_AT + Math.exp(-i / 12) * 0.05 * (i % 2 === 0 ? 1 : -1)
      const next = endingDprFor(zoom, 1, current)
      if (next !== null) {
        current = next
        writes++
      }
    }
    expect(writes, 'buffer reallocations while settling on the threshold').toBeLessThanOrEqual(1)
  })

  it('releases on the way back out, so scrubbing up returns the journey to its own budget', () => {
    let current = ENDING_DPR_FLOOR
    const next = endingDprFor(0, 1, current)
    expect(next).toBe(1)
    current = next as number
    expect(endingDprFor(0, 1, current)).toBeNull()
  })

  it('never asks for more than the Canvas ceiling can give', () => {
    // `scene.tsx` mounts dpr={[1, 2]}; a floor above that ceiling would be a contradiction, and
    // T79 established that above 2 this lab renders no extra pixels at all.
    expect(ENDING_DPR_FLOOR).toBeLessThanOrEqual(2)
  })
})
