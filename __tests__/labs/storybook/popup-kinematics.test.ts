import { describe, expect, it } from 'vitest'
import {
  FOLD_END_T,
  RISE_LANDING_STAND,
  RISE_START_T,
  incomingRiseStand,
  outgoingFoldStand,
} from '@/components/labs/storybook/book/popup-kinematics'

describe('outgoingFoldStand', () => {
  it('holds the captured start value until its phase offset', () => {
    expect(outgoingFoldStand(0, 1, 0)).toBeCloseTo(1, 5)
    expect(outgoingFoldStand(0.02, 0.7, 0.05)).toBeCloseTo(0.7, 5)
  })

  it('reaches exactly flat by FOLD_END_T regardless of phase offset', () => {
    expect(outgoingFoldStand(FOLD_END_T, 1, 0)).toBeCloseTo(0, 5)
    expect(outgoingFoldStand(FOLD_END_T, 1, 0.03)).toBeCloseTo(0, 5)
    expect(outgoingFoldStand(1, 1, 0)).toBe(0)
  })

  it('folds from whatever value was captured, not always 1 (no snapping)', () => {
    const mid = outgoingFoldStand(0.2, 0.5, 0)
    expect(mid).toBeLessThan(0.5)
    expect(mid).toBeGreaterThan(0)
  })

  it('a zero or negative start stays flat throughout', () => {
    expect(outgoingFoldStand(0, 0, 0)).toBe(0)
    expect(outgoingFoldStand(0.1, 0, 0)).toBe(0)
  })

  it('is monotonically non-increasing across the fold window', () => {
    let prev = outgoingFoldStand(0, 1, 0)
    for (let t = 0.02; t <= FOLD_END_T; t += 0.02) {
      const value = outgoingFoldStand(t, 1, 0)
      expect(value).toBeLessThanOrEqual(prev + 1e-9)
      prev = value
    }
  })

  it('a later phase offset delays the start of folding', () => {
    const early = outgoingFoldStand(0.05, 1, 0)
    const late = outgoingFoldStand(0.05, 1, 0.1)
    expect(late).toBeGreaterThan(early)
  })
})

describe('incomingRiseStand', () => {
  it('stays flat before RISE_START_T', () => {
    expect(incomingRiseStand(0, 0)).toBe(0)
    expect(incomingRiseStand(0.5, 0)).toBe(0)
    expect(incomingRiseStand(RISE_START_T - 0.001, 0)).toBe(0)
  })

  it('reaches RISE_LANDING_STAND exactly at t=1', () => {
    expect(incomingRiseStand(1, 0)).toBeCloseTo(RISE_LANDING_STAND, 5)
    expect(incomingRiseStand(1, 0.05)).toBeCloseTo(RISE_LANDING_STAND, 5)
  })

  it('never exceeds RISE_LANDING_STAND within its own window', () => {
    for (let t = RISE_START_T; t <= 1; t += 0.02) {
      expect(incomingRiseStand(t, 0)).toBeLessThanOrEqual(RISE_LANDING_STAND + 1e-9)
    }
  })

  it('is monotonically non-decreasing across the rise window', () => {
    let prev = 0
    for (let t = RISE_START_T; t <= 1; t += 0.02) {
      const value = incomingRiseStand(t, 0)
      expect(value).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = value
    }
  })

  it('a phase offset delays the start of rising', () => {
    const early = incomingRiseStand(RISE_START_T + 0.02, 0)
    const late = incomingRiseStand(RISE_START_T + 0.02, 0.05)
    expect(early).toBeGreaterThan(late)
    expect(late).toBe(0)
  })
})

describe('the flat gap between fold and rise (no page/paper intersection)', () => {
  it('both an outgoing fold and an incoming rise are fully flat across [FOLD_END_T, RISE_START_T]', () => {
    for (let t = FOLD_END_T; t <= RISE_START_T; t += 0.01) {
      expect(outgoingFoldStand(t, 1, 0.03)).toBe(0)
      expect(incomingRiseStand(t, 0.03)).toBe(0)
    }
  })
})
