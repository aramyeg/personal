import { describe, expect, it } from 'vitest'
import { computeTourCardPosition } from '@/components/labs/curator/tour-position'

const viewport = { width: 1200, height: 800 }
const cardSize = { width: 320, height: 160 }

describe('computeTourCardPosition', () => {
  it('prefers placing the card to the right of the target when there is room', () => {
    const pos = computeTourCardPosition(
      { top: 100, left: 50, width: 100, height: 40 },
      cardSize,
      viewport,
    )
    expect(pos.left).toBe(162) // targetRight (150) + default gap (12)
    expect(pos.top).toBe(40) // vertically centered on the target
  })

  it('falls back to the left when there is no room on the right', () => {
    const pos = computeTourCardPosition(
      { top: 100, left: 1000, width: 100, height: 40 },
      cardSize,
      viewport,
    )
    expect(pos.left).toBe(668) // targetLeft (1000) - gap (12) - cardWidth (320)
    expect(pos.top).toBe(40)
  })

  it('falls back to below the target when neither side has room', () => {
    const pos = computeTourCardPosition(
      { top: 300, left: 20, width: 1160, height: 40 },
      cardSize,
      viewport,
    )
    expect(pos.left).toBe(20)
    expect(pos.top).toBe(352) // targetBottom (340) + default gap (12)
  })

  it('clamps to the viewport bottom edge with padding', () => {
    const pos = computeTourCardPosition(
      { top: 780, left: 1000, width: 50, height: 15 },
      cardSize,
      viewport,
    )
    expect(pos.top).toBe(624) // 800 - 16 padding - 160 card height
  })

  it('clamps to the viewport left edge with padding', () => {
    const pos = computeTourCardPosition(
      { top: 300, left: 0, width: 2000, height: 40 },
      cardSize,
      viewport,
    )
    expect(pos.left).toBe(16)
  })

  it('respects a custom gap', () => {
    const pos = computeTourCardPosition(
      { top: 100, left: 50, width: 100, height: 40 },
      cardSize,
      viewport,
      30,
    )
    expect(pos.left).toBe(180) // targetRight (150) + gap (30)
  })
})
