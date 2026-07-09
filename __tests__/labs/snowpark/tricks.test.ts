import { describe, expect, it } from 'vitest'
import type { Skill } from '@/types'
import {
  BASE_TRICK,
  CHAIN_STEP,
  GRAB_BONUS,
  GRIND_PER_UNIT,
  PER_180,
  PER_360,
  collectLine,
  trickName,
  trickScore,
  type TrickInput,
} from '@/components/labs/snowpark/tricks'

/** A neutral trick with no components — the plain ollie air. */
const NONE: TrickInput = { flipDeg: 0, spinDeg: 0, grab: 'none', grindLength: 0, late: false }

describe('trickName', () => {
  it('names flips off the pitch: 180 lands switch, 360 is a Backflip, 720 a Double Backflip', () => {
    expect(trickName({ ...NONE, flipDeg: 180 })).toBe('180')
    expect(trickName({ ...NONE, flipDeg: 360 })).toBe('Backflip')
    expect(trickName({ ...NONE, flipDeg: 720 })).toBe('Double Backflip')
  })

  it('names spins by their degrees: 360 and 720', () => {
    expect(trickName({ ...NONE, spinDeg: 360 })).toBe('360')
    expect(trickName({ ...NONE, spinDeg: 720 })).toBe('720')
  })

  it('names the two grabs distinctly', () => {
    expect(trickName({ ...NONE, grab: 'nose' })).toBe('Nose Grab')
    expect(trickName({ ...NONE, grab: 'tail' })).toBe('Tail Grab')
  })

  it('composes flip, then spin, then grab (the binding examples)', () => {
    // Backflip Tail Grab — a 360 flip with a tail grab.
    expect(trickName({ ...NONE, flipDeg: 360, grab: 'tail' })).toBe('Backflip Tail Grab')
    // 360 Nose Grab — a 360 spin with a nose grab.
    expect(trickName({ ...NONE, spinDeg: 360, grab: 'nose' })).toBe('360 Nose Grab')
  })

  it('composes the full flip + spin + grab + grind line', () => {
    expect(
      trickName({ flipDeg: 360, spinDeg: 360, grab: 'nose', grindLength: 80, late: false })
    ).toBe('Backflip 360 Nose Grab + Grind')
  })

  it('names a plain clean jump an Ollie', () => {
    expect(trickName(NONE)).toBe('Ollie')
  })

  it('appends grind, alone or after other components', () => {
    expect(trickName({ ...NONE, grindLength: 80 })).toBe('Grind')
    expect(trickName({ ...NONE, spinDeg: 360, grindLength: 80 })).toBe('360 + Grind')
  })
})

describe('trickScore', () => {
  it('sums base + flip (per 180) + spin (per 360) + grab + grind, per component', () => {
    const t: TrickInput = { flipDeg: 360, spinDeg: 360, grab: 'nose', grindLength: 50, late: false }
    // 360 flip = 2×PER_180; 360 spin = 1×PER_360; one grab; 50 units of grind.
    const raw = BASE_TRICK + 2 * PER_180 + 1 * PER_360 + GRAB_BONUS + 50 * GRIND_PER_UNIT
    expect(trickScore(t, 6, 0)).toBe(Math.round(raw * 6))
    expect(trickScore(t, 6, 3)).toBe(Math.round(raw * 6 * (1 + 3 * CHAIN_STEP)))
  })

  it('pays a spin per full 360 and a flip per 180', () => {
    // A lone 720 spin banks 2×PER_360 over base; a lone 180 flip banks 1×PER_180.
    expect(trickScore({ ...NONE, spinDeg: 720 }, 1, 0)).toBe(BASE_TRICK + 2 * PER_360)
    expect(trickScore({ ...NONE, flipDeg: 180 }, 1, 0)).toBe(BASE_TRICK + PER_180)
  })

  it('pays a flat bonus for either grab', () => {
    expect(trickScore({ ...NONE, grab: 'nose' }, 1, 0)).toBe(BASE_TRICK + GRAB_BONUS)
    expect(trickScore({ ...NONE, grab: 'tail' }, 1, 0)).toBe(BASE_TRICK + GRAB_BONUS)
  })

  it('scales with real years', () => {
    const t: TrickInput = { ...NONE, flipDeg: 180 }
    expect(trickScore(t, 8, 0)).toBe(4 * trickScore(t, 2, 0))
  })

  it('multiplies by the chain', () => {
    const t: TrickInput = { ...NONE, flipDeg: 180 }
    expect(trickScore(t, 4, 4)).toBe(Math.round((BASE_TRICK + PER_180) * 4 * 2)) // 1 + 0.25*4 = 2
  })

  it('pays the late bonus', () => {
    const t: TrickInput = { ...NONE, flipDeg: 360, late: true }
    const base = { ...t, late: false }
    expect(trickScore(t, 4, 0)).toBe(Math.round(trickScore(base, 4, 0) * 1.5))
  })
})

describe('collectLine', () => {
  it('matches the spec trick-card format exactly', () => {
    const ts: Skill = { name: 'TypeScript', years: 6, category: 'frontend', level: 'expert' }
    expect(collectLine('360 Nose Grab', ts)).toBe('360 Nose Grab — TypeScript · 6 yrs · expert')
  })
})
