import { describe, expect, it } from 'vitest'
import {
  WATER_DEFAULTS,
  WATER_OUTWARD_CEIL,
  type WaterParams,
  effectiveOutward,
  waterDeepGate,
  waterLaneClear,
  waterStreak,
  waterRelief,
  waterNormalTilt,
} from '@/components/labs/small-world/scene/water-clay'

const WATER_LEVEL = 0.972 // mirrors biomes.WATER_LEVEL (pinned in biomes.test)
const P = WATER_DEFAULTS
// The worst case the bench also uses: every relief dial at its slider maximum.
const MAXP: WaterParams = {
  ...WATER_DEFAULTS,
  pathWarp: 2,
  pathStretch: 6,
  pathDepth: 0.03,
  pocketTint: 1,
  reliefInward: 0.05,
  reliefOutward: 0.02,
  ridgeSharp: 3,
  octaves: 6,
  normalRough: 0.5,
}

describe('effectiveOutward — the ≤0.4× inward hard cap', () => {
  it('caps the outward crest at 0.4× the inward budget regardless of dials', () => {
    expect(effectiveOutward({ ...P, reliefInward: 0.02, reliefOutward: 0.007 })).toBeCloseTo(0.007, 12)
    // outward dialed above the cap → clamped to 0.4× inward
    expect(effectiveOutward({ ...P, reliefInward: 0.01, reliefOutward: 0.02 })).toBeCloseTo(0.004, 12)
    // at both maxima the cap is 0.4×0.05 = 0.02 = the documented ceiling
    expect(effectiveOutward(MAXP)).toBeCloseTo(WATER_OUTWARD_CEIL, 12)
  })

  it('the shipped default outward sits under its cap', () => {
    expect(WATER_DEFAULTS.reliefOutward).toBeLessThanOrEqual(0.4 * WATER_DEFAULTS.reliefInward)
  })
})

describe('waterDeepGate — deep-only, min-depth across both variants', () => {
  it('is 0 at/above the waterline (shore) and 1 in deep water', () => {
    expect(waterDeepGate(0.0, 0.0)).toBe(0) // terrain at the waterline → shore
    expect(waterDeepGate(0.02, 0.02)).toBe(0) // just below waterline, still shallow
    expect(waterDeepGate(-0.13, -0.13)).toBe(1) // deep ocean basin
  })

  it('uses the SHALLOWER variant, so either lap having land near the surface closes it', () => {
    // A is deep but B is shallow shore → gate must close (single shared geometry must
    // not crest B's coast).
    expect(waterDeepGate(-0.13, 0.0)).toBe(0)
    expect(waterDeepGate(0.0, -0.13)).toBe(0)
  })
})

describe('waterLaneClear — relief off the girl lane only', () => {
  it('is 0 on the lane and 1 well off it', () => {
    expect(waterLaneClear(0)).toBe(0)
    expect(waterLaneClear(0.1)).toBe(0)
    expect(waterLaneClear(0.3)).toBe(1)
    expect(waterLaneClear(-0.3)).toBe(1)
  })
})

describe('waterStreak — the path field', () => {
  it('is deterministic and bounded in [0, 1]', () => {
    let mn = 1
    let mx = 0
    for (let i = 0; i < 5000; i++) {
      const a = (i * 0.7) % 6.283
      const nx = Math.cos(a) * 0.4
      const ny = Math.sin(a) * 0.8
      const nz = Math.cos(a * 1.7) * 0.4
      const s = waterStreak(nx, ny, nz, P)
      expect(waterStreak(nx, ny, nz, P)).toBe(s)
      if (s < mn) mn = s
      if (s > mx) mx = s
    }
    expect(mn).toBeGreaterThanOrEqual(0)
    expect(mx).toBeLessThanOrEqual(1)
  })
})

describe('waterRelief — the shoreline + deck contract', () => {
  it('is exactly 0 when the gate is 0 (shore or lane)', () => {
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * 6.283
      const nx = Math.cos(a) * 0.5
      const ny = Math.sin(a) * 0.7
      const nz = Math.cos(a * 2.1) * 0.5
      const streak = waterStreak(nx, ny, nz, MAXP)
      expect(waterRelief(nx, ny, nz, 0, streak, MAXP)).toBe(0)
    }
  })

  it('never crests the waterline at the shore even at MAX dials (net radius ≤ WATER_LEVEL)', () => {
    // At any shore/lane point gate = 0, so the water sits at the v1 molded sheet
    // (≤ WATER_LEVEL). Emulate the worst molded push (inward can only lower it further).
    for (let i = 0; i < 500; i++) {
      const a = (i / 500) * 6.283
      const nx = Math.cos(a) * 0.6
      const ny = Math.sin(a) * 0.6
      const nz = Math.cos(a * 1.3) * 0.6
      const streak = waterStreak(nx, ny, nz, MAXP)
      const relief = waterRelief(nx, ny, nz, 0, streak, MAXP) // shore gate = 0
      const radius = WATER_LEVEL * (1 + relief)
      expect(radius).toBeLessThanOrEqual(WATER_LEVEL + 1e-12)
    }
  })

  it('in fully-open deep water the outward push never exceeds effectiveOutward', () => {
    let maxOut = -1
    for (let i = 0; i < 4000; i++) {
      const a = (i * 0.37) % 6.283
      const nx = Math.cos(a) * 0.3
      const ny = Math.sin(a) * 0.9
      const nz = Math.cos(a * 2.7) * 0.3
      const streak = waterStreak(nx, ny, nz, MAXP)
      const relief = waterRelief(nx, ny, nz, 1, streak, MAXP) // fully open
      if (relief > maxOut) maxOut = relief
    }
    expect(maxOut).toBeLessThanOrEqual(effectiveOutward(MAXP) + 1e-12)
  })

  it('is deterministic', () => {
    const s = waterStreak(0.3, 0.6, 0.4, P)
    expect(waterRelief(0.3, 0.6, 0.4, 0.7, s, P)).toBe(waterRelief(0.3, 0.6, 0.4, 0.7, s, P))
  })
})

describe('waterNormalTilt', () => {
  it('is zero at amp 0 and bounded by amp per axis', () => {
    expect(waterNormalTilt(0.3, 0.6, 0.4, 0)).toEqual([0, 0, 0])
    const [dx, dy, dz] = waterNormalTilt(0.3, 0.6, 0.4, 0.5)
    expect(Math.abs(dx)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(dy)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(dz)).toBeLessThanOrEqual(0.5)
  })
})
