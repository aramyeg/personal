import { describe, expect, it } from 'vitest'
import {
  PAGE_SEGMENTS,
  PAGE_W,
  buildPageTemplate,
  curlPositions,
  easeTurn,
} from '@/components/labs/storybook/book/page-geometry'

const edgeX = (pos: Float32Array) => pos[(PAGE_SEGMENTS * 2 + 1) * 3] // a last-column vertex x

describe('page curl', () => {
  const { positions } = buildPageTemplate()
  const out = new Float32Array(positions.length)

  it('t=0 is flat on the right', () => {
    curlPositions(positions, out, 0, 'next', easeTurn)
    expect(edgeX(out)).toBeCloseTo(PAGE_W, 3)
  })
  it('t=1 lands flat on the left', () => {
    curlPositions(positions, out, 1, 'next', easeTurn)
    expect(edgeX(out)).toBeCloseTo(-PAGE_W, 2)
  })
  it('mid-turn lifts the page and lags the free edge', () => {
    curlPositions(positions, out, 0.5, 'next', easeTurn)
    // spine column stays put
    expect(out[0]).toBeCloseTo(0, 5)
    // free edge is above the desk and lags behind theta=π/2 (x > 0 means lag)
    const i = (PAGE_SEGMENTS * 2 + 1) * 3
    expect(out[i + 1]).toBeGreaterThan(0.5)
    expect(out[i]).toBeGreaterThan(0)
  })
  it('prev mirrors next', () => {
    curlPositions(positions, out, 0, 'prev', easeTurn)
    expect(edgeX(out)).toBeCloseTo(-PAGE_W, 3)
  })
})
