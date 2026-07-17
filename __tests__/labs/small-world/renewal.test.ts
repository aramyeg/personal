import { describe, expect, it } from 'vitest'
import {
  STANCE_ALPHA,
  FLIP_START,
  FLIP_WIDTH,
  canonicalTheta,
  renewalGate,
  activeVariantAt,
} from '@/components/labs/small-world/scene/renewal'

const TWO_PI = Math.PI * 2

describe('canonicalTheta', () => {
  it('maps any angle into [STANCE_ALPHA, STANCE_ALPHA + 2π)', () => {
    for (let a = -20; a <= 20; a += 0.37) {
      const t = canonicalTheta(a)
      expect(t).toBeGreaterThanOrEqual(STANCE_ALPHA)
      expect(t).toBeLessThan(STANCE_ALPHA + TWO_PI)
    }
  })

  it('is 2π-consistent (invariant under ±2π shifts of the input)', () => {
    for (const a of [0, 1.2, 3.9, -0.8, 5.5, Math.PI]) {
      expect(canonicalTheta(a)).toBeCloseTo(canonicalTheta(a + TWO_PI), 10)
      expect(canonicalTheta(a)).toBeCloseTo(canonicalTheta(a - TWO_PI), 10)
    }
  })

  it('handles atan2 quadrants — a local direction round-trips to its ring angle', () => {
    // atan2(nz, ny) recovers the ring angle (mod 2π); canonicalTheta re-wraps it.
    for (const theta of [0.5, 1.9, 3.3, 4.8, 6.0]) {
      const ny = Math.cos(theta)
      const nz = Math.sin(theta)
      expect(canonicalTheta(Math.atan2(nz, ny))).toBeCloseTo(canonicalTheta(theta), 10)
    }
  })

  it('places the wrap seam exactly at the stance meridian', () => {
    expect(canonicalTheta(STANCE_ALPHA)).toBeCloseTo(STANCE_ALPHA, 10)
    // just below the seam wraps up by a full turn
    expect(canonicalTheta(STANCE_ALPHA - 1e-6)).toBeCloseTo(STANCE_ALPHA - 1e-6 + TWO_PI, 6)
  })
})

describe('renewalGate', () => {
  it('is exactly 0 before the flip window (rotation − thetaC < FLIP_START)', () => {
    expect(renewalGate(1.0, 1.0 + FLIP_START - 0.01)).toBe(0)
    expect(renewalGate(2.0, 2.0)).toBe(0)
  })

  it('is exactly 1 after the flip window (rotation − thetaC > FLIP_START + FLIP_WIDTH)', () => {
    expect(renewalGate(1.0, 1.0 + FLIP_START + FLIP_WIDTH + 0.01)).toBe(1)
    expect(renewalGate(1.0, 1.0 + 5)).toBe(1)
  })

  it('rises monotonically across the window, hitting 0.5 at its centre', () => {
    const thetaC = 1.0
    let prev = -1
    for (let r = thetaC; r <= thetaC + FLIP_START + FLIP_WIDTH + 1; r += 0.01) {
      const g = renewalGate(thetaC, r)
      expect(g).toBeGreaterThanOrEqual(prev - 1e-12)
      prev = g
    }
    const mid = thetaC + FLIP_START + FLIP_WIDTH / 2
    expect(renewalGate(thetaC, mid)).toBeCloseTo(0.5, 10)
  })

  it('flips each vertex exactly once over the two laps (monotone in unwrapped rotation)', () => {
    const thetaC = canonicalTheta(2.7)
    let crossings = 0
    let prev = renewalGate(thetaC, 0)
    for (let r = 0; r <= 2 * TWO_PI; r += 0.005) {
      const g = renewalGate(thetaC, r)
      if ((prev < 0.5 && g >= 0.5) || (prev >= 0.5 && g < 0.5)) crossings++
      prev = g
    }
    expect(crossings).toBe(1)
  })
})

describe('girl-stance A/B boundary', () => {
  // The vertex under the girl has local theta = rotation + STANCE_ALPHA.
  const girlGate = (rotation: number): number =>
    renewalGate(canonicalTheta(rotation + STANCE_ALPHA), rotation)

  it('is exactly 0 for the whole of lap 1 (spring underfoot)', () => {
    for (let r = 0; r < TWO_PI - 1e-6; r += 0.01) expect(girlGate(r)).toBe(0)
  })

  it('is exactly 1 for the whole of lap 2 (autumn underfoot)', () => {
    for (let r = TWO_PI + 1e-6; r <= 2 * TWO_PI; r += 0.01) expect(girlGate(r)).toBe(1)
  })

  it('flips at exactly the lap boundary rotation = 2π', () => {
    expect(girlGate(TWO_PI - 1e-4)).toBe(0)
    expect(girlGate(TWO_PI + 1e-4)).toBe(1)
  })
})

describe('activeVariantAt', () => {
  it('uses the single shared 0.5 threshold (0 = A, 1 = B)', () => {
    const thetaC = 1.0
    expect(activeVariantAt(thetaC, thetaC)).toBe(0) // gate 0
    expect(activeVariantAt(thetaC, thetaC + FLIP_START + FLIP_WIDTH + 1)).toBe(1) // gate 1
    // exactly at the centre the gate is 0.5 ⇒ B (≥ 0.5)
    expect(activeVariantAt(thetaC, thetaC + FLIP_START + FLIP_WIDTH / 2)).toBe(1)
  })
})
