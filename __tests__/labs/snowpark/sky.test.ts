import { describe, expect, it } from 'vitest'
import { PHASES, skyColors } from '@/components/labs/snowpark/render/sky'

const HEX = /^#[0-9a-f]{6}$/

describe('skyColors', () => {
  it('returns exact phase colors at the pinned stops', () => {
    expect(skyColors(0).top).toBe('#cfe0ec')
    expect(skyColors(0.82).horizon).toBe('#2c4a62')
  })

  it('returns every pinned stop exactly at its own progress', () => {
    for (const phase of PHASES) {
      const c = skyColors(phase.at)
      expect(c.top).toBe(phase.top)
      expect(c.horizon).toBe(phase.horizon)
      expect(c.sun).toBe(phase.sun)
      expect(c.snow).toBe(phase.snow)
      expect(c.band).toBe(phase.band)
    }
  })

  it('interpolates monotonically between stops', () => {
    const a = skyColors(0.1)
    const b = skyColors(0.2)
    expect(a.top).not.toBe(b.top)
  })

  it('glow ramps only near night', () => {
    expect(skyColors(0.5).glow01).toBe(0)
    expect(skyColors(1).glow01).toBeGreaterThan(0.9)
  })

  it('glow is mid-ramp at the night stop', () => {
    const g = skyColors(0.82).glow01
    expect(g).toBeGreaterThan(0)
    expect(g).toBeLessThan(1)
  })

  it('clamps progress outside [0,1]', () => {
    expect(skyColors(-1).top).toBe(skyColors(0).top)
    expect(skyColors(2).horizon).toBe(skyColors(1).horizon)
  })

  it('emits valid #rrggbb for every channel across the run', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const c = skyColors(p)
      for (const hex of [c.top, c.horizon, c.sun, c.haze, c.snow, c.band]) {
        expect(hex).toMatch(HEX)
      }
    }
  })
})
