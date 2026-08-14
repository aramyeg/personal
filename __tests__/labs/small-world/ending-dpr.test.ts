import { describe, expect, it } from 'vitest'
import {
  ENDING_DPR_AT,
  ENDING_DPR_FLOOR,
  ENDING_DPR_HYSTERESIS,
  endingDprFor,
} from '@/components/labs/small-world/scene/ending-dpr'
import { STUDIO_LIGHTS_FULL } from '@/components/labs/small-world/scene/desk-studio'
import { LOOK } from '@/components/labs/small-world/scene/look-table'

/**
 * THE PIXEL RATIO (Task 81, generalised in Task 130).
 *
 * The feature is one line of arithmetic, and every way it can go wrong is a PERFORMANCE bug rather
 * than a picture bug — a floor that flips on a threshold reallocates a 2880×1800 multisampled
 * buffer on frames where nothing changed. So this gates the LATCHING and the scoping, not the
 * number.
 *
 * T130 turned the journey's floor into a look-table row (Aram: *"can we double the pixels during
 * the whole journey?"*), which means there are now two shipped configurations rather than one, and
 * BOTH have to obey the same laws. `journeyFloor = 1` is T81's behaviour exactly and is the revert
 * path; `journeyFloor = 2` is the default. Every law below is asserted against both, so neither is
 * a special case and neither can rot while the other is the one being looked at.
 */
const FLOORS = [1, 2] as const

describe('the floor is a floor, whichever section is asking', () => {
  it.each(FLOORS)('never lowers a device already above it (journeyFloor %i)', (jf) => {
    for (const zoom of [0, 0.5, 1]) {
      expect(endingDprFor(zoom, 3, 3, jf), `zoom ${zoom}`).toBeNull()
      expect(endingDprFor(zoom, 2, 2, jf), `zoom ${zoom}`).toBeNull()
    }
  })

  it.each(FLOORS)('raises a 1.5x device to the floor, not to its own ratio (journeyFloor %i)', (jf) => {
    expect(endingDprFor(1, 1.5, 1.5, jf)).toBe(ENDING_DPR_FLOOR)
    // ...and during the journey the same device is raised only if the row asks for it. `null` here
    // is not "nothing happened" — it is the function saying 1.5 IS already what this section wants.
    expect(endingDprFor(0, 1.5, 1.5, jf), `journeyFloor ${jf}`).toBe(jf === 1 ? null : ENDING_DPR_FLOOR)
  })

  it.each(FLOORS)('never asks for more than the Canvas ceiling can give (journeyFloor %i)', (jf) => {
    // `scene.tsx` mounts dpr={[1, 2]}; a floor above that ceiling would be a contradiction, and
    // T79 established that above 2 this lab renders no extra pixels at all.
    for (const zoom of [0, ENDING_DPR_AT, 1]) {
      const got = endingDprFor(zoom, 1, 1, jf)
      expect(got === null || got <= 2, `zoom ${zoom} → ${got}`).toBe(true)
    }
    expect(LOOK.journeyDpr.max).toBeLessThanOrEqual(ENDING_DPR_FLOOR)
  })
})

describe('the ending’s own floor is untouched by the generalisation', () => {
  it('engages at the beat the studio finishes on, which is the beat the breath starts on', () => {
    // Stated as a relation in the source, so retuning the studio's ramp carries both with it.
    expect(ENDING_DPR_AT).toBe(STUDIO_LIGHTS_FULL)
    for (const jf of FLOORS) {
      expect(endingDprFor(ENDING_DPR_AT, 1, 1, jf), `journeyFloor ${jf}`).toBe(ENDING_DPR_FLOOR)
      expect(endingDprFor(1, 1, 1, jf), `journeyFloor ${jf}`).toBe(ENDING_DPR_FLOOR)
    }
  })
})

describe('journeyFloor 1 is T81 exactly — the revert path stays live', () => {
  it('leaves the whole journey at whatever the device asked for', () => {
    // zoom is 0 for every progress <= 1, i.e. all six chapters and the still beat.
    for (const device of [1, 1.5, 2, 3]) {
      expect(endingDprFor(0, device, device, 1), `device ${device}`).toBeNull()
    }
  })

  it('does not raise anything before the studio has finished arriving', () => {
    for (const zoom of [0.1, 0.4, 0.7, ENDING_DPR_AT - ENDING_DPR_HYSTERESIS]) {
      expect(endingDprFor(zoom, 1, 1, 1), `zoom ${zoom}`).toBeNull()
    }
  })

  it('releases on the way back out, so scrubbing up returns the journey to its own budget', () => {
    let current = ENDING_DPR_FLOOR
    const next = endingDprFor(0, 1, current, 1)
    expect(next).toBe(1)
    current = next as number
    expect(endingDprFor(0, 1, current, 1)).toBeNull()
  })
})

describe('journeyFloor 2 is the shipped default — the whole lab at the ending’s density', () => {
  it('is what the table ships', () => {
    expect(LOOK.journeyDpr.default).toBe(ENDING_DPR_FLOOR)
  })

  it('raises a 1x device from the first frame, before any zoom exists', () => {
    expect(endingDprFor(0, 1, 1, 2)).toBe(2)
  })

  it('asks for NOTHING at the ending boundary — the buffer is allocated once for the visit', () => {
    // With both sections at the same floor the threshold has nothing to flip between. This is the
    // strongest form of T81's latching argument, not a weakening of it.
    let current = 1
    let writes = 0
    for (let i = 0; i <= 200; i++) {
      const next = endingDprFor(i / 200, 1, current, 2)
      if (next !== null) {
        current = next
        writes++
      }
    }
    expect(writes, 'buffer reallocations across a whole visit').toBe(1)
    expect(current).toBe(ENDING_DPR_FLOOR)
  })

  it('does not release on the way back up either', () => {
    expect(endingDprFor(0, 1, ENDING_DPR_FLOOR, 2)).toBeNull()
  })
})

describe('the hysteresis is load-bearing wherever the two floors differ', () => {
  it('CANNOT thrash on a scroll resting at the threshold', () => {
    // A damped scroll settling onto the boundary is the realistic case, and without the band it
    // would resize the drawing buffer every frame: the worst frame time in the lab, produced by
    // the feature meant to improve the picture. Only journeyFloor 1 can flip here at all — at 2
    // both branches want the same number — so this is the setting the band exists for.
    let current = 1
    let writes = 0
    for (let i = 0; i < 200; i++) {
      const zoom = ENDING_DPR_AT + Math.exp(-i / 12) * 0.05 * (i % 2 === 0 ? 1 : -1)
      const next = endingDprFor(zoom, 1, current, 1)
      if (next !== null) {
        current = next
        writes++
      }
    }
    expect(writes, 'buffer reallocations while settling on the threshold').toBeLessThanOrEqual(1)
  })

  it('writes ONCE on the way in — a settled frame asks for nothing', () => {
    for (const jf of FLOORS) {
      let current = 1
      let writes = 0
      for (let i = 0; i <= 40; i++) {
        const next = endingDprFor(ENDING_DPR_AT + (i / 40) * (1 - ENDING_DPR_AT), 1, current, jf)
        if (next !== null) {
          current = next
          writes++
        }
      }
      expect(writes, `journeyFloor ${jf}`).toBe(1)
      expect(current).toBe(ENDING_DPR_FLOOR)
    }
  })
})
