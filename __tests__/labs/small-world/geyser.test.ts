import { describe, expect, it } from 'vitest'
import { geyserPlume } from '@/components/labs/small-world/scene/geyser'

// Task 49 — the canyon geyser plume cycle. Aram's flicker-family veto is the hard constraint:
// the plume must GROW/SHRINK smoothly and deterministically, never shimmer. These pins prove the
// cycle is a pure, bounded, smooth (no-stepping) function of rotation, erupting once per period.

const PERIOD = 0.7 // shipped default (DIALS.geyserPeriod.default)

describe('geyserPlume — deterministic, bounded, smooth eruption cycle', () => {
  it('is a pure function of rotation (same inputs → identical output, bit-reproducible on scrub)', () => {
    for (const rot of [0, 0.31, 1.7, 3.14, 8.9, 12.0]) {
      for (const phase of [0, 0.4, 0.72]) {
        expect(geyserPlume(rot, phase, PERIOD)).toBe(geyserPlume(rot, phase, PERIOD))
      }
    }
  })

  it('stays within [0, 1] at every rotation and phase', () => {
    for (let i = 0; i <= 4000; i++) {
      const rot = (i / 4000) * (Math.PI * 4)
      for (const phase of [0, 0.4, 0.72]) {
        const v = geyserPlume(rot, phase, PERIOD)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('returns 0 for a non-positive period (a disabled geyser)', () => {
    for (const rot of [0, 1.3, 7.7]) {
      expect(geyserPlume(rot, 0, 0)).toBe(0)
      expect(geyserPlume(rot, 0, -0.5)).toBe(0)
    }
  })

  it('erupts once per cycle: reaches a full column AND fully rests within one period', () => {
    let peak = 0
    let trough = 1
    for (let i = 0; i <= 1000; i++) {
      const v = geyserPlume((i / 1000) * PERIOD, 0, PERIOD)
      peak = Math.max(peak, v)
      trough = Math.min(trough, v)
    }
    expect(peak).toBeGreaterThan(0.99) // a genuine full plume
    expect(trough).toBe(0) // and a genuine dormant rest (the base pool bubbles on its own)
  })

  it('is smooth — no stepping: adjacent rotations never jump (small Lipschitz bound)', () => {
    // over a fine rotation step the height changes only a little (the eruption is slow), so the
    // plume can never read as a flicker. Max |Δ| over dr = 1e-3 rad stays well under 0.02.
    let maxStep = 0
    const dr = 1e-3
    for (let i = 0; i < 20000; i++) {
      const rot = (i / 20000) * (Math.PI * 4)
      maxStep = Math.max(maxStep, Math.abs(geyserPlume(rot + dr, 0, PERIOD) - geyserPlume(rot, 0, PERIOD)))
    }
    expect(maxStep).toBeLessThan(0.02)
  })

  it('is continuous across the cycle wrap (value → 0 with vanishing slope at both ends)', () => {
    // just before and after a cycle boundary the plume is essentially fully dormant, so the wrap
    // introduces no jump (C1: the ramps flatten to 0 at the cycle ends).
    for (const k of [1, 2, 3]) {
      const boundary = k * PERIOD
      expect(geyserPlume(boundary - 1e-4, 0, PERIOD)).toBeLessThan(1e-3)
      expect(geyserPlume(boundary + 1e-4, 0, PERIOD)).toBeLessThan(1e-3)
    }
  })

  it('desyncs neighbouring geysers — different phases erupt at different rotations', () => {
    // at a rotation where phase 0 is at full column, phase 0.5 (half a cycle offset) is dormant.
    const rotFull = 0.47 * PERIOD // inside the [0.34, 0.60] full-plateau of phase 0
    expect(geyserPlume(rotFull, 0, PERIOD)).toBeGreaterThan(0.99)
    expect(geyserPlume(rotFull, 0.5, PERIOD)).toBe(0)
  })
})
