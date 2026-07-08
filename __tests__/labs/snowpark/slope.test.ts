import { describe, expect, it } from 'vitest'
import {
  advanceAlongSlope,
  slopeAngle,
  slopeGradient,
  slopeY,
} from '@/components/labs/snowpark/slope'

describe('slope', () => {
  it('is deterministic', () => {
    expect(slopeY(1234)).toBe(slopeY(1234))
  })

  it('descends overall (y grows downward with x)', () => {
    expect(slopeY(10_000)).toBeGreaterThan(slopeY(0))
  })

  it('gradient matches the numeric derivative of slopeY', () => {
    const h = 0.001
    for (const x of [0, 137, 999, 5_000, 20_000]) {
      const numeric = (slopeY(x + h) - slopeY(x - h)) / (2 * h)
      expect(slopeGradient(x)).toBeCloseTo(numeric, 3)
    }
  })

  it('angle is atan of the gradient, always within (-90deg, 90deg)', () => {
    for (const x of [0, 512, 3_000, 15_000]) {
      expect(slopeAngle(x)).toBeCloseTo(Math.atan(slopeGradient(x)), 10)
      expect(Math.abs(slopeAngle(x))).toBeLessThan(Math.PI / 2)
    }
  })

  it('advanceAlongSlope always moves forward for positive ds', () => {
    for (const x of [0, 800, 9_999]) {
      expect(advanceAlongSlope(x, 5)).toBeGreaterThan(x)
    }
  })
})
