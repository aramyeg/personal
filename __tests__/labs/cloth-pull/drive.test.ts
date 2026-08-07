import { describe, expect, it } from 'vitest'
import {
  beginDrag,
  createDrive,
  driveTension,
  endDrag,
  moveDrag,
  nudge,
  stepDrive,
} from '@/lib/labs/cloth-pull/drive'
import { CFG } from '@/lib/labs/cloth-pull/config'

const W = 1440

function run(d: ReturnType<typeof createDrive>, seconds: number) {
  const steps = Math.round(seconds * 60)
  for (let i = 0; i < steps; i++) stepDrive(d, 1 / 60)
}

describe('intro', () => {
  it('hauls from zero to the rest distance in the configured duration', () => {
    const d = createDrive(W)
    expect(d.mode).toBe('intro')
    expect(d.h).toBe(0)
    run(d, CFG.drive.introDuration + 1.5)
    expect(d.mode).toBe('toy')
    expect(Math.abs(d.h - d.hRest)).toBeLessThan(W * 0.02)
  })

  it('moves with visible stroke pulses, never backwards', () => {
    const d = createDrive(W)
    let prev = 0
    const vels: number[] = []
    for (let i = 0; i < CFG.drive.introDuration * 60; i++) {
      stepDrive(d, 1 / 60)
      vels.push(d.h - prev)
      expect(d.h).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = d.h
    }
    const mid = vels.slice(30, vels.length - 30)
    expect(Math.max(...mid)).toBeGreaterThan(Math.min(...mid) * 1.5)
  })

  it('reduced-motion drive starts already settled at rest', () => {
    const d = createDrive(W, true)
    expect(d.mode).toBe('toy')
    expect(d.h).toBe(d.hRest)
    run(d, 1)
    expect(Math.abs(d.h - d.hRest)).toBeLessThan(1)
  })
})

describe('drag', () => {
  it('tracks the pointer 1:1 while held (drag left hauls in)', () => {
    const d = createDrive(W, true)
    beginDrag(d, 800)
    moveDrag(d, 680, 1 / 60)
    expect(d.h).toBeCloseTo(d.hRest + 120, 5)
    moveDrag(d, 900, 1 / 60)
    expect(d.h).toBeCloseTo(d.hRest - 100, 5)
  })

  it('clamps inside the soft range even on an absurd drag', () => {
    const d = createDrive(W, true)
    beginDrag(d, 0)
    moveDrag(d, 100000, 1 / 60)
    expect(d.h).toBeGreaterThanOrEqual(d.hMin)
    moveDrag(d, -100000, 1 / 60)
    expect(d.h).toBeLessThanOrEqual(d.hMax)
  })

  it('release springs back to rest and settles without residual motion', () => {
    const d = createDrive(W, true)
    beginDrag(d, 500)
    moveDrag(d, 260, 1 / 60)
    endDrag(d)
    run(d, 4)
    expect(Math.abs(d.h - d.hRest)).toBeLessThan(7)
    expect(Math.abs(d.v)).toBeLessThan(15)
  })

  it('a fast flick keeps its momentum, a slow release does not', () => {
    const flick = createDrive(W, true)
    beginDrag(flick, 500)
    for (let i = 0; i < 6; i++) moveDrag(flick, 500 - (i + 1) * 30, 1 / 60)
    endDrag(flick)
    const slow = createDrive(W, true)
    beginDrag(slow, 500)
    for (let i = 0; i < 6; i++) moveDrag(slow, 500 - (i + 1) * 2, 1 / 60)
    endDrag(slow)
    expect(Math.abs(flick.v)).toBeGreaterThan(CFG.drive.flickVel)
    expect(Math.abs(slow.v)).toBeLessThan(CFG.drive.flickVel * 0.5)
  })
})

describe('effort and tension', () => {
  it('effort rises under fast hauling and decays at rest', () => {
    const d = createDrive(W, true)
    beginDrag(d, 1000)
    // fast zigzag stays inside the haul range; |v| is what effort tracks
    let x = 1000
    for (let i = 0; i < 30; i++) {
      x += (Math.floor(i / 5) % 2 === 0 ? -1 : 1) * 20
      moveDrag(d, x, 1 / 60)
      stepDrive(d, 1 / 60)
    }
    const busy = d.effort
    expect(busy).toBeGreaterThan(0.4)
    endDrag(d)
    run(d, 6)
    expect(d.effort).toBeLessThan(0.15)
    expect(driveTension(d)).toBeLessThan(0.3)
  })

  it('holding a drag adds grip tension', () => {
    const d = createDrive(W, true)
    const restT = driveTension(d)
    beginDrag(d, 500)
    expect(driveTension(d)).toBeGreaterThan(restT + 0.2)
  })
})

describe('idle behaviors', () => {
  it('fires an inviting tug on cadence once settled, and it decays', () => {
    const d = createDrive(W)
    run(d, CFG.drive.introDuration + 2)
    let tugs = 0
    for (let i = 0; i < 60 * CFG.drive.tugPeriod * 3.2; i++) {
      if (stepDrive(d, 1 / 60).tugged) tugs++
    }
    expect(tugs).toBeGreaterThanOrEqual(2)
    expect(Math.abs(d.h - d.hRest)).toBeLessThan(40)
  })

  it('a reduced-motion drive never tugs on its own', () => {
    const d = createDrive(W, true)
    let tugs = 0
    for (let i = 0; i < 60 * CFG.drive.tugPeriod * 4; i++) {
      if (stepDrive(d, 1 / 60).tugged) tugs++
    }
    expect(tugs).toBe(0)
  })

  it('keyboard nudges kick velocity in the right direction', () => {
    const d = createDrive(W, true)
    nudge(d, 1)
    expect(d.v).toBeGreaterThan(0)
    stepDrive(d, 1 / 60)
    const dPay = createDrive(W, true)
    nudge(dPay, -1)
    expect(dPay.v).toBeLessThan(0)
  })

  it('never NaNs across a long unattended run', () => {
    const d = createDrive(W)
    run(d, 60)
    expect(Number.isFinite(d.h)).toBe(true)
    expect(Number.isFinite(d.v)).toBe(true)
    expect(Number.isFinite(d.effort)).toBe(true)
  })
})
