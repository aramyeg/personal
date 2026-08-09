import { describe, expect, it } from 'vitest'
import {
  COVER_MS,
  HOLD_MS,
  VEIL_MS,
  VEIL_OPEN,
  veilStateAt,
} from '@/components/labs/small-world/overlay/restart-transition'

/**
 * THE RESTART'S ONE LAW: the document may not move until the visitor cannot see it move.
 *
 * Everything else about the gesture is taste and lives in the module's own header. This is the
 * part that would be a defect rather than a preference — a jump issued while the iris is still
 * open is the old clank with an extra animation on top of it.
 */
describe('the restart iris', () => {
  it('never asks for the jump while any of the frame is still visible', () => {
    for (let ms = 0; ms <= VEIL_MS + 200; ms += 1) {
      const s = veilStateAt(ms)
      if (s.jump) expect(ms).toBeGreaterThanOrEqual(COVER_MS)
      if (s.radius > 0) expect(ms < COVER_MS || ms >= COVER_MS + HOLD_MS).toBe(true)
    }
    // and the cover really does reach zero rather than approaching it
    expect(veilStateAt(COVER_MS).radius).toBe(0)
  })

  it('starts open, ends open, and holds the world covered for the whole jump window', () => {
    expect(veilStateAt(0).radius).toBe(VEIL_OPEN)
    expect(veilStateAt(0).jump).toBe(false)
    for (let ms = COVER_MS; ms < COVER_MS + HOLD_MS; ms++) expect(veilStateAt(ms).radius).toBe(0)
    expect(veilStateAt(VEIL_MS).radius).toBe(VEIL_OPEN)
    expect(veilStateAt(VEIL_MS).done).toBe(true)
    expect(veilStateAt(VEIL_MS + 5000).done).toBe(true)
  })

  it('closes monotonically and opens monotonically — the iris never doubles back', () => {
    let prev = Infinity
    for (let ms = 0; ms <= COVER_MS; ms += 2) {
      const r = veilStateAt(ms).radius
      expect(r).toBeLessThanOrEqual(prev)
      prev = r
    }
    prev = -Infinity
    for (let ms = COVER_MS + HOLD_MS; ms <= VEIL_MS; ms += 2) {
      const r = veilStateAt(ms).radius
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })

  it('the covered hold outlasts three animation frames — the scene has to redraw under it', () => {
    expect(HOLD_MS).toBeGreaterThan(3 * (1000 / 60))
  })
})
