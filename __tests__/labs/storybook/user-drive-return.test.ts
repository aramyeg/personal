import { describe, expect, it } from 'vitest'
import {
  GLOBAL_CAP,
  RETURN_TAU,
  STEP_CAP,
  stepUserDriveReturn,
  turnFrames,
} from '@/components/labs/storybook/book/user-drive-return'

// The release-return stepper (hand-interaction-laws H2; derive-userdrive U2/UT)
// as a PURE function: the layer measures the world step pose-to-pose, so these
// tests feed a synthetic linear world-step model and assert the timing law and
// the output clamp directly.

describe('user-drive release return (H2 stepper — pure)', () => {
  /** A linear world-step model: "arm k" means a lift step da moves the worst
   *  vertex by k*|da|. Makes the output clamp exact so the cap is assertable. */
  const linear = (k: number) => (a0: number, a1: number) => k * Math.abs(a1 - a0)

  it('is monotone toward the target and never overshoots (down and up)', () => {
    for (const [start, target] of [
      [1.4, 0.2],
      [0.1, 1.2],
    ] as const) {
      let a: number = start
      for (let i = 0; i < 800; i++) {
        const { next, settled } = stepUserDriveReturn(a, target, 1, linear(0.02))
        if (target < start) expect(next).toBeGreaterThanOrEqual(target - 1e-9)
        else expect(next).toBeLessThanOrEqual(target + 1e-9)
        // never moves away from the target
        expect(Math.abs(next - target)).toBeLessThanOrEqual(Math.abs(a - target) + 1e-12)
        a = next
        if (settled) break
      }
      expect(a).toBeCloseTo(target, 3)
    }
  })

  it('holds the worst-vertex step at STEP_CAP when the exponential would blow it', () => {
    // Arm 1: world step == |da|, so an unclamped first step (0.14 rad) far
    // exceeds STEP_CAP; the clamp must pin it exactly.
    const start = 1.5
    const { next } = stepUserDriveReturn(start, 0, 1, linear(1))
    expect(Math.abs(next - start)).toBeLessThanOrEqual(STEP_CAP + 1e-12)
    expect(Math.abs(next - start)).toBeCloseTo(STEP_CAP, 6)
  })

  it('yields its whole budget to the page (budget 0 holds the lift still)', () => {
    const { next, settled } = stepUserDriveReturn(1.2, 0, 1, linear(1), 0)
    expect(next).toBe(1.2)
    expect(settled).toBe(false)
  })

  it('caps the composed step under a partial (yielded) budget', () => {
    const budget = STEP_CAP / 2
    const { next } = stepUserDriveReturn(1.5, 0, 1, linear(1), budget)
    expect(Math.abs(next - 1.5)).toBeLessThanOrEqual(budget + 1e-12)
  })

  it('reports settled once within eps of the target (the caller then snaps to cam)', () => {
    // Already inside the default eps (1e-4): settled fires immediately and the
    // residual stays within eps — the layer clears the channel to the exact cam.
    const { next, settled } = stepUserDriveReturn(0.30005, 0.3, 5, linear(0.001))
    expect(settled).toBe(true)
    expect(Math.abs(next - 0.3)).toBeLessThanOrEqual(1e-4)
  })

  it('exposes the derived constants and the 240-station turn clock', () => {
    expect(RETURN_TAU).toBe(10)
    expect(GLOBAL_CAP).toBeCloseTo(0.0497, 6)
    expect(STEP_CAP).toBeCloseTo(0.8 * 0.0497, 9)
    // TURN_MS = 1250: one real second is 192 turn-clock frames.
    expect(turnFrames(1, 1250)).toBeCloseTo(192, 6)
  })
})
