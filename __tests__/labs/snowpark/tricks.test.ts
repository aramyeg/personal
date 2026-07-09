import { describe, expect, it } from 'vitest'
import type { Skill } from '@/types'
import {
  BASE_TRICK,
  CHAIN_STEP,
  GRAB_BONUS,
  GRIND_PER_UNIT,
  PER_180,
  collectLine,
  trickName,
  trickScore,
} from '@/components/labs/snowpark/tricks'

describe('trickName', () => {
  it('composes rotation and grab', () => {
    expect(trickName({ rotationDeg: 360, grab: true, grindLength: 0, late: false })).toBe(
      '360 Nose Grab'
    )
    expect(trickName({ rotationDeg: 180, grab: false, grindLength: 0, late: false })).toBe('180')
    expect(trickName({ rotationDeg: 0, grab: true, grindLength: 0, late: false })).toBe(
      'Nose Grab'
    )
  })

  it('names a plain clean jump an Ollie', () => {
    expect(trickName({ rotationDeg: 0, grab: false, grindLength: 0, late: false })).toBe('Ollie')
  })

  it('appends grind', () => {
    expect(trickName({ rotationDeg: 0, grab: false, grindLength: 80, late: false })).toBe('Grind')
    expect(trickName({ rotationDeg: 360, grab: true, grindLength: 80, late: false })).toBe(
      '360 Nose Grab + Grind'
    )
  })
})

describe('trickScore', () => {
  it('is base + rotation + grab + grind, times years, times chain multiplier', () => {
    const t = { rotationDeg: 360, grab: true, grindLength: 50, late: false }
    const raw = BASE_TRICK + 2 * PER_180 + GRAB_BONUS + 50 * GRIND_PER_UNIT
    expect(trickScore(t, 6, 0)).toBe(Math.round(raw * 6))
    expect(trickScore(t, 6, 3)).toBe(Math.round(raw * 6 * (1 + 3 * CHAIN_STEP)))
  })

  it('scales with real years', () => {
    const t = { rotationDeg: 180, grab: false, grindLength: 0, late: false }
    expect(trickScore(t, 8, 0)).toBe(4 * trickScore(t, 2, 0))
  })

  it('multiplies by the chain', () => {
    const t = { rotationDeg: 180, grab: false, grindLength: 0, late: false }
    expect(trickScore(t, 4, 4)).toBe(Math.round(250 * 4 * 2)) // 1 + 0.25*4 = 2
  })

  it('pays the late bonus', () => {
    const t = { rotationDeg: 360, grab: false, grindLength: 0, late: true }
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
