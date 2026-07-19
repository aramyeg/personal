import { afterEach, describe, expect, it } from 'vitest'
import { fieldDents } from '@/components/labs/small-world/scene/field-clay'
import { DIALS, resetDials, setDial } from '@/components/labs/small-world/scene/tunables'

// fieldDents reads the LIVE DIALS.dentDepth.value, so restore defaults after each test.
afterEach(() => resetDials())

describe('fieldDents — off-lane press-dents, EXACTLY 0 on the spine band', () => {
  it('is 0 across the spine band at ANY depth (the |nx|<0.14 lane gate, at the NEW max)', () => {
    // Round-9 widened the depth dial max to 0.10. The spine contact budget must survive:
    // fieldDents must return EXACTLY 0 for |nx| < 0.14 regardless of dial depth, so it adds
    // no spine-band render term. Prove it at the slider maximum (worst case).
    setDial('dentDepth', DIALS.dentDepth.max)
    expect(DIALS.dentDepth.value).toBe(0.1)
    for (let ni = 0; ni <= 40; ni++) {
      const nx = -0.13 + (0.26 * ni) / 40 // spine band [-0.13, 0.13] ⊂ (-0.14, 0.14)
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      for (let ai = 0; ai < 128; ai++) {
        const th = (ai / 128) * Math.PI * 2
        const ny = ring * Math.cos(th)
        const nz = ring * Math.sin(th)
        // a range of local relief values (dents also fade out as bump rises)
        for (const bump of [0, 0.03, 0.08, 0.15]) {
          expect(fieldDents(nx, ny, nz, bump)).toBe(0)
        }
      }
    }
  })

  it('never adds radius (inward-only) and is bounded by the live depth off the lane', () => {
    setDial('dentDepth', DIALS.dentDepth.max)
    let maxAbs = 0
    for (let ni = 0; ni <= 60; ni++) {
      const nx = -1 + (2 * ni) / 60
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      for (let ai = 0; ai < 128; ai++) {
        const th = (ai / 128) * Math.PI * 2
        const d = fieldDents(nx, ring * Math.cos(th), ring * Math.sin(th), 0) // open ground
        expect(d).toBeLessThanOrEqual(0) // inward-only, never a positive (outward) term
        if (-d > maxAbs) maxAbs = -d
      }
    }
    // magnitude bounded by depth · (dentA + 0.6·dentB ≤ 1.6 clamped to 1) · gates ≤ depth
    expect(maxAbs).toBeLessThanOrEqual(DIALS.dentDepth.max + 1e-9)
  })
})
