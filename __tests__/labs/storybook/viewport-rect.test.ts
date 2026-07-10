import { describe, expect, it } from 'vitest'
import { ndcToPageRect } from '@/components/labs/storybook/book/viewport-rect'

describe('ndcToPageRect', () => {
  it('maps a centered NDC square to a centered viewport rect', () => {
    const corners = [
      { x: -0.5, y: -0.5 },
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
    ]
    const rect = ndcToPageRect(corners, 1000, 800)
    expect(rect).toEqual({ left: 250, top: 200, width: 500, height: 400 })
  })

  it('fills the full viewport for full-NDC corners', () => {
    const corners = [
      { x: -1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
    ]
    const rect = ndcToPageRect(corners, 1440, 900)
    expect(rect).toEqual({ left: 0, top: 0, width: 1440, height: 900 })
  })

  it('flips y (NDC up is viewport down) and handles an off-center rect', () => {
    const corners = [
      { x: 0, y: 0.8 }, // near top of NDC → near top of viewport
      { x: 0.4, y: -0.2 },
    ]
    const rect = ndcToPageRect(corners, 1000, 1000)
    // x: [0,0.4] -> [500, 700]; y: [0.8,-0.2] -> top=(1-0.8)/2*1000=100, bottom=(1-(-0.2))/2*1000=600
    expect(rect.left).toBeCloseTo(500)
    expect(rect.top).toBeCloseTo(100)
    expect(rect.width).toBeCloseTo(200)
    expect(rect.height).toBeCloseTo(500)
  })
})
