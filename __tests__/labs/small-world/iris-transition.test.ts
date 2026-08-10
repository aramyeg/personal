import { describe, expect, it } from 'vitest'
import {
  COVER_MS,
  DESK_HOLD_MS,
  HOLD_MS,
  IRIS_DESK,
  IRIS_START,
  VEIL_MS,
  VEIL_OPEN,
  holdMsFor,
  veilMs,
  veilStateAt,
} from '@/components/labs/small-world/overlay/iris-transition'
import { RETRACT_SECONDS } from '@/components/labs/small-world/arrival'
import { TRACK_END } from '@/components/labs/small-world/ending-timeline'

/**
 * THE IRIS'S ONE LAW: the document may not move until the visitor cannot see it move.
 *
 * Everything else about the gesture is taste and lives in the module's own header. This is the
 * part that would be a defect rather than a preference — a jump issued while the iris is still
 * open is the old clank with an extra animation on top of it.
 *
 * Task 108 gave the gesture a second destination and a per-destination hold, so every sweep below
 * runs over BOTH holds. A law that only holds for the length someone happened to pass is not a law.
 */
const HOLDS = [HOLD_MS, DESK_HOLD_MS]

describe('the iris', () => {
  it('never asks for the jump while any of the frame is still visible', () => {
    for (const hold of HOLDS) {
      for (let ms = 0; ms <= veilMs(hold) + 200; ms += 1) {
        const s = veilStateAt(ms, hold)
        if (s.jump) expect(ms).toBeGreaterThanOrEqual(COVER_MS)
        if (s.radius > 0) expect(ms < COVER_MS || ms >= COVER_MS + hold).toBe(true)
      }
      // and the cover really does reach zero rather than approaching it
      expect(veilStateAt(COVER_MS, hold).radius).toBe(0)
    }
  })

  it('starts open, ends open, and holds the world covered for the whole jump window', () => {
    for (const hold of HOLDS) {
      const total = veilMs(hold)
      expect(veilStateAt(0, hold).radius).toBe(VEIL_OPEN)
      expect(veilStateAt(0, hold).jump).toBe(false)
      for (let ms = COVER_MS; ms < COVER_MS + hold; ms++) expect(veilStateAt(ms, hold).radius).toBe(0)
      expect(veilStateAt(total, hold).radius).toBe(VEIL_OPEN)
      expect(veilStateAt(total, hold).done).toBe(true)
      expect(veilStateAt(total + 5000, hold).done).toBe(true)
    }
  })

  it('closes monotonically and opens monotonically — the iris never doubles back', () => {
    for (const hold of HOLDS) {
      let prev = Infinity
      for (let ms = 0; ms <= COVER_MS; ms += 2) {
        const r = veilStateAt(ms, hold).radius
        expect(r).toBeLessThanOrEqual(prev)
        prev = r
      }
      prev = -Infinity
      for (let ms = COVER_MS + hold; ms <= veilMs(hold); ms += 2) {
        const r = veilStateAt(ms, hold).radius
        expect(r).toBeGreaterThanOrEqual(prev)
        prev = r
      }
    }
  })

  it('the covered hold outlasts three animation frames — the scene has to redraw under it', () => {
    for (const hold of HOLDS) expect(hold).toBeGreaterThan(3 * (1000 / 60))
  })

  it('defaults to the restart’s hold, so the gesture Task 106 measured is unchanged', () => {
    expect(veilMs(HOLD_MS)).toBe(VEIL_MS)
    for (let ms = 0; ms <= VEIL_MS + 200; ms += 7) {
      expect(veilStateAt(ms)).toEqual(veilStateAt(ms, HOLD_MS))
    }
  })

  /**
   * THE SECOND DESTINATION'S OWN CONSTRAINT (Task 108).
   *
   * The skip is pressed from wherever the visitor is, and the natural place to press it is parked
   * at a checkpoint with a spread up. The dwell ends the instant the jump lands, and the arrival
   * machine then walks that spread out on a WALL CLOCK — so the cover has to outlast the walk-out
   * or the iris opens on a chapter spread whipping itself off the desk. Derived from
   * `RETRACT_SECONDS` rather than compared against a number typed twice.
   */
  it('holds the desk covered for longer than a checkpoint spread takes to walk out', () => {
    // ...and by more than the driver's own start latency, measured at ~2 frames: a margin thin
    // enough to lose that race is what a three-frame margin turned out to be
    expect(DESK_HOLD_MS - RETRACT_SECONDS * 1000).toBeGreaterThanOrEqual(4 * (1000 / 60))
    expect(holdMsFor(IRIS_DESK)).toBe(DESK_HOLD_MS)
    expect(holdMsFor(IRIS_START)).toBe(HOLD_MS)
  })

  it('aims at the two ends of the track, in journey-progress units', () => {
    expect(IRIS_START).toBe(0)
    expect(IRIS_DESK).toBe(TRACK_END)
    // every journey position takes the short hold; only the ending segment needs the long one
    expect(holdMsFor(1)).toBe(HOLD_MS)
    expect(holdMsFor(0.5)).toBe(HOLD_MS)
  })
})
