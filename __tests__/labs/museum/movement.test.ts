import { describe, expect, it } from 'vitest'
import {
  FOV_BASE,
  FOV_SPRINT,
  GRAVITY,
  GROUNDED,
  JUMP_V0,
  SPRINT_MULT,
  fovTarget,
  speedFor,
  stepJump,
  tryJump,
} from '@/components/labs/museum/movement'

describe('speedFor', () => {
  it('returns the base speed when not sprinting', () => {
    expect(speedFor(3, false)).toBe(3)
  })

  it('scales by SPRINT_MULT when sprinting', () => {
    expect(speedFor(3, true)).toBeCloseTo(3 * SPRINT_MULT)
  })
})

describe('jump', () => {
  it('takes off from the ground with JUMP_V0', () => {
    expect(tryJump(GROUNDED)).toEqual({ offset: 0, velocity: JUMP_V0, airborne: true })
  })

  it('ignores jump input while airborne (no double jump)', () => {
    const midair = stepJump(tryJump(GROUNDED), 0.1)
    expect(tryJump(midair)).toBe(midair)
  })

  it('rises under its initial velocity and decelerates under gravity', () => {
    const s1 = stepJump(tryJump(GROUNDED), 0.05)
    expect(s1.offset).toBeGreaterThan(0)
    expect(s1.velocity).toBeLessThan(JUMP_V0)
    expect(s1.velocity).toBeCloseTo(JUMP_V0 - GRAVITY * 0.05)
  })

  it('comes back down and lands exactly on GROUNDED', () => {
    let s = tryJump(GROUNDED)
    for (let i = 0; i < 200; i++) s = stepJump(s, 0.016)
    expect(s).toEqual(GROUNDED)
    expect(s.offset).toBe(0)
  })

  it('is a no-op on the ground and never mutates inputs', () => {
    expect(stepJump(GROUNDED, 0.016)).toBe(GROUNDED)
    const air = tryJump(GROUNDED)
    stepJump(air, 0.016)
    expect(air).toEqual({ offset: 0, velocity: JUMP_V0, airborne: true })
    expect(GROUNDED).toEqual({ offset: 0, velocity: 0, airborne: false })
  })
})

describe('fovTarget', () => {
  it('widens only while sprint-moving', () => {
    expect(fovTarget(true, true)).toBe(FOV_SPRINT)
    expect(fovTarget(true, false)).toBe(FOV_BASE)
    expect(fovTarget(false, true)).toBe(FOV_BASE)
    expect(fovTarget(false, false)).toBe(FOV_BASE)
  })
})
