import { describe, expect, it } from 'vitest'
import {
  PAGE_VERTICAL_P,
  RISE_LANDING_STAND,
  incomingRiseStand,
  outgoingFoldStand,
  rideAngle,
  sheetTheta,
} from '@/components/labs/storybook/book/popup-kinematics'

// v2 mechanics: both functions take the page's EASED sweep progress p (a
// proxy for its angle, theta = PI * p) — the paper is geared to the page.

describe('outgoingFoldStand', () => {
  it('holds the captured start value before the page moves', () => {
    expect(outgoingFoldStand(0, 1, 0)).toBeCloseTo(1, 5)
    expect(outgoingFoldStand(0.005, 0.7, 0.01)).toBeCloseTo(0.7, 5)
  })

  it('is exactly flat when the page reaches vertical, any phase offset', () => {
    expect(outgoingFoldStand(PAGE_VERTICAL_P, 1, 0)).toBeCloseTo(0, 5)
    expect(outgoingFoldStand(PAGE_VERTICAL_P, 1, 0.03)).toBeCloseTo(0, 5)
    expect(outgoingFoldStand(1, 1, 0)).toBe(0)
  })

  it('folds from the captured start, not from an assumed full stand', () => {
    const mid = outgoingFoldStand(0.25, 0.5, 0)
    expect(mid).toBeLessThan(0.5)
    expect(mid).toBeGreaterThan(0)
    expect(outgoingFoldStand(0, 0, 0)).toBe(0)
    expect(outgoingFoldStand(0.1, 0, 0)).toBe(0)
  })

  it('closes monotonically as the page rises', () => {
    let prev = outgoingFoldStand(0, 1, 0)
    for (let p = 0.02; p <= PAGE_VERTICAL_P + 0.02; p += 0.02) {
      const next = outgoingFoldStand(p, 1, 0)
      expect(next).toBeLessThanOrEqual(prev + 1e-9)
      prev = next
    }
  })
})

describe('incomingRiseStand', () => {
  it('stays flat while the page is still rising toward vertical', () => {
    expect(incomingRiseStand(0, 0)).toBe(0)
    expect(incomingRiseStand(PAGE_VERTICAL_P - 0.01, 0)).toBe(0)
  })

  it('reaches the landing stand exactly as the page lays flat', () => {
    expect(incomingRiseStand(1, 0)).toBeCloseTo(RISE_LANDING_STAND, 5)
    expect(incomingRiseStand(1, 0.03)).toBeCloseTo(RISE_LANDING_STAND, 5)
  })

  it('never reaches a full stand kinematically (the spring settles the rest)', () => {
    expect(RISE_LANDING_STAND).toBeLessThan(1)
    for (let p = 0; p <= 1; p += 0.05) {
      expect(incomingRiseStand(p, 0)).toBeLessThanOrEqual(RISE_LANDING_STAND)
    }
  })

  it('rises monotonically as the page lays down', () => {
    let prev = incomingRiseStand(PAGE_VERTICAL_P, 0)
    for (let p = PAGE_VERTICAL_P + 0.02; p <= 1; p += 0.02) {
      const next = incomingRiseStand(p, 0)
      expect(next).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = next
    }
  })
})

describe('mechanical handoff at page-vertical', () => {
  it('no frame ever has both spreads meaningfully standing', () => {
    for (let p = 0; p <= 1; p += 0.01) {
      const out = outgoingFoldStand(p, 1, 0.02)
      const inc = incomingRiseStand(p, 0.02)
      // One side is always at (or within engagement-noise of) flat.
      expect(Math.min(out, inc)).toBeLessThan(0.08)
    }
  })
})

describe('v3 attachment (rideAngle / sheetTheta)', () => {
  it('sheetTheta matches the curl convention for both directions', () => {
    expect(sheetTheta('next', 0)).toBeCloseTo(0, 5)
    expect(sheetTheta('next', 1)).toBeCloseTo(Math.PI, 5)
    expect(sheetTheta('prev', 0)).toBeCloseTo(Math.PI, 5)
    expect(sheetTheta('prev', 1)).toBeCloseTo(0, 5)
  })

  it('next: outgoing near paper rides the lifting sheet up', () => {
    expect(rideAngle('outgoing', 'next', 0.4, 0)).toBeCloseTo(0, 5)
    expect(rideAngle('outgoing', 'next', 0.4, Math.PI / 4)).toBeCloseTo(-Math.PI / 4, 5)
    // capped once the sheet passes vertical (piece is folded+hidden by then)
    expect(rideAngle('outgoing', 'next', 0.4, Math.PI * 0.8)).toBeCloseTo(-Math.PI / 2, 5)
    // far-hinged outgoing paper is glued to the stationary page: no ride
    expect(rideAngle('outgoing', 'next', -0.5, Math.PI / 4)).toBe(0)
  })

  it('next: incoming far paper rides the landing sheet down to identity', () => {
    // before vertical the sheet has not reached the far side: capped fold
    expect(rideAngle('incoming', 'next', -0.5, Math.PI * 0.25)).toBeCloseTo(Math.PI / 2, 5)
    expect(rideAngle('incoming', 'next', -0.5, Math.PI * 0.75)).toBeCloseTo(Math.PI * 0.25, 5)
    // lands at exactly zero — seamless handoff to the at-rest pose
    expect(rideAngle('incoming', 'next', -0.5, Math.PI)).toBeCloseTo(0, 5)
    // near-hinged incoming paper unfolds in place on the stationary page
    expect(rideAngle('incoming', 'next', 0.3, Math.PI * 0.75)).toBe(0)
  })

  it('prev mirrors next', () => {
    expect(rideAngle('outgoing', 'prev', -0.5, Math.PI * 0.75)).toBeCloseTo(Math.PI * 0.25, 5)
    expect(rideAngle('incoming', 'prev', 0.3, Math.PI * 0.25)).toBeCloseTo(-Math.PI * 0.25, 5)
    expect(rideAngle('incoming', 'prev', 0.3, 0)).toBeCloseTo(0, 5)
    expect(rideAngle('outgoing', 'prev', 0.3, Math.PI * 0.75)).toBe(0)
  })
})
