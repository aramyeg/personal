import { describe, expect, it } from 'vitest'
import {
  beginGrab,
  createMotion,
  endGrab,
  moveGrab,
  nudge,
  stepMotion,
} from '@/lib/labs/cloth-pull/motion'
import { CFG } from '@/lib/labs/cloth-pull/config'

const W = 1440
const X_REST = W * 0.76

function run(
  m: ReturnType<typeof createMotion>,
  seconds: number,
  stretch = 0.005
) {
  const steps = Math.round(seconds * 60)
  for (let i = 0; i < steps; i++) {
    stepMotion(m, 1 / 60, { stretch, viewportW: W })
  }
}

describe('intro walk-in', () => {
  it('walks her from off-left to the rest x, then hands over to cruise', () => {
    const m = createMotion(W, X_REST)
    expect(m.mode).toBe('intro')
    expect(m.x).toBeLessThan(0)
    run(m, 5)
    expect(m.mode).toBe('toy')
    expect(m.x).toBe(X_REST)
    expect(m.speed).toBeGreaterThan(CFG.motion.cruise * 0.8)
  })

  it('x only ever advances during the intro', () => {
    const m = createMotion(W, X_REST)
    let prev = m.x
    for (let i = 0; i < 300; i++) {
      stepMotion(m, 1 / 60, { stretch: 0.01, viewportW: W })
      expect(m.x).toBeGreaterThanOrEqual(prev)
      prev = m.x
    }
  })

  it('reduced motion starts settled at rest with zero speed', () => {
    const m = createMotion(W, X_REST, true)
    expect(m.mode).toBe('toy')
    expect(m.x).toBe(X_REST)
    run(m, 2)
    expect(m.speed).toBeLessThan(1)
  })
})

describe('cruise and braking', () => {
  it('settles to cruise speed unloaded', () => {
    const m = createMotion(W, X_REST)
    run(m, 8, 0.002)
    expect(Math.abs(m.speed - CFG.motion.cruise)).toBeLessThan(CFG.motion.cruise * 0.15)
  })

  it('a hard cloth pull (big stretch) brakes her toward a stop', () => {
    const m = createMotion(W, X_REST)
    run(m, 6)
    run(m, 2, 0.09)
    expect(m.speed).toBeLessThan(CFG.motion.cruise * 0.35)
  })

  it('keyboard boost raises speed then decays back to cruise', () => {
    const m = createMotion(W, X_REST)
    run(m, 6)
    nudge(m, 1)
    run(m, 0.5)
    const boosted = m.speed
    expect(boosted).toBeGreaterThan(CFG.motion.cruise * 1.1)
    run(m, 5)
    expect(Math.abs(m.speed - CFG.motion.cruise)).toBeLessThan(CFG.motion.cruise * 0.2)
  })
})

describe('effort', () => {
  it('rises with chain stretch and decays when the pull ends', () => {
    const m = createMotion(W, X_REST)
    run(m, 6)
    const calm = m.effort
    run(m, 2, 0.1)
    const strained = m.effort
    expect(strained).toBeGreaterThan(calm + 0.3)
    run(m, 8, 0.002)
    expect(m.effort).toBeLessThan(strained * 0.4)
  })

  it('stays within [0, 1.2]', () => {
    const m = createMotion(W, X_REST)
    run(m, 4, 0.5)
    expect(m.effort).toBeLessThanOrEqual(1.2)
    expect(m.effort).toBeGreaterThanOrEqual(0)
  })
})

describe('grab bookkeeping', () => {
  it('tracks pointer through begin/move/end', () => {
    const m = createMotion(W, X_REST, true)
    beginGrab(m, 500, 400)
    expect(m.grabbing).toBe(true)
    moveGrab(m, 300, 460)
    expect(m.grabX).toBe(300)
    expect(m.grabY).toBe(460)
    endGrab(m)
    expect(m.grabbing).toBe(false)
    moveGrab(m, 100, 100)
    expect(m.grabX).toBe(300)
  })

  it('never NaNs across a long unattended run', () => {
    const m = createMotion(W, X_REST)
    run(m, 60)
    expect(Number.isFinite(m.speed)).toBe(true)
    expect(Number.isFinite(m.effort)).toBe(true)
    expect(Number.isFinite(m.x)).toBe(true)
  })
})
