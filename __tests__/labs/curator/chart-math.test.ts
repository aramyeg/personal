import { scalePoints, linePath, areaPath } from '@/components/labs/curator/ui/charts/chart-math'

describe('chart math', () => {
  it('scales values into the padded viewport, max at top', () => {
    const pts = scalePoints([0, 10], 100, 50, 4)
    expect(pts).toHaveLength(2)
    expect(pts[0].x).toBe(4)
    expect(pts[1].x).toBe(96)
    expect(pts[1].y).toBeLessThan(pts[0].y) // higher value → smaller y
  })
  it('builds an SVG path', () => {
    expect(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('M 0 1 L 2 3')
  })
  it('closes the area to the bottom', () => {
    const p = areaPath([{ x: 0, y: 1 }, { x: 2, y: 3 }], 50)
    expect(p.endsWith('L 2 50 L 0 50 Z')).toBe(true)
  })
  it('handles a flat series without NaN', () => {
    const pts = scalePoints([5, 5, 5], 100, 50, 4)
    expect(pts.every((p) => Number.isFinite(p.y))).toBe(true)
  })
})
