import { describe, expect, it } from 'vitest'
import {
  PAGE_SEGMENTS,
  PAGE_W,
  buildPageTemplate,
  curlPositions,
  curlPositionsPhased,
  easeTurn,
  easeTurnWeighted,
} from '@/components/labs/storybook/book/page-geometry'

const edgeX = (pos: Float32Array) => pos[(PAGE_SEGMENTS * 2 + 1) * 3] // a last-column vertex x
// Row 0 sits at z = -PAGE_H/2, row 1 at z = +PAGE_H/2 (see buildPageTemplate).
const freeEdgeX = (pos: Float32Array, row: 0 | 1) =>
  pos[(row * (PAGE_SEGMENTS + 1) + PAGE_SEGMENTS) * 3]

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

describe('easeTurnWeighted', () => {
  it('anchors the same endpoints and midpoint as easeTurn', () => {
    expect(easeTurnWeighted(0)).toBeCloseTo(0, 5)
    expect(easeTurnWeighted(1)).toBeCloseTo(1, 5)
    expect(easeTurnWeighted(0.5)).toBeCloseTo(0.5, 5)
  })
  it('grips more gently at the start than easeTurn (flatter early ramp)', () => {
    expect(easeTurnWeighted(0.15)).toBeLessThan(easeTurn(0.15))
  })
  it('lands more softly than easeTurn (flatter late ramp)', () => {
    expect(easeTurnWeighted(0.85)).toBeGreaterThan(easeTurn(0.85))
  })
  it('is monotonically non-decreasing', () => {
    let prev = 0
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeTurnWeighted(t)
      expect(value).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = value
    }
  })
})

describe('curlPositionsPhased', () => {
  const { positions } = buildPageTemplate()
  const out = new Float32Array(positions.length)

  it('still anchors the spine and the flat start/end poses', () => {
    curlPositionsPhased(positions, out, 0, 'next', easeTurn)
    expect(out[0]).toBeCloseTo(0, 5)
    curlPositionsPhased(positions, out, 1, 'next', easeTurn)
    expect(freeEdgeX(out, 0)).toBeCloseTo(-PAGE_W, 2)
    expect(freeEdgeX(out, 1)).toBeCloseTo(-PAGE_W, 2)
  })

  it('the free corner (+z row) leads: it curls further than the -z row mid-turn', () => {
    curlPositionsPhased(positions, out, 0.2, 'next', easeTurn)
    const nearEdgeRow0 = freeEdgeX(out, 0) // z = -PAGE_H/2
    const nearEdgeRow1 = freeEdgeX(out, 1) // z = +PAGE_H/2
    // Further from PAGE_W (more curled) means a smaller x for a 'next' turn.
    expect(nearEdgeRow1).toBeLessThan(nearEdgeRow0)
  })

  it('never runs the local phase outside [0,1] (no backward/restarted curl)', () => {
    curlPositionsPhased(positions, out, 0, 'next', easeTurn)
    // The lagging row at t=0 should still read as fully flat, not negative.
    expect(freeEdgeX(out, 0)).toBeCloseTo(PAGE_W, 2)
    curlPositionsPhased(positions, out, 1, 'next', easeTurn)
    expect(freeEdgeX(out, 1)).toBeCloseTo(-PAGE_W, 2)
  })

  it('keeps every vertex at or above the desk (no clipping through the page below)', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      curlPositionsPhased(positions, out, t, 'next', easeTurn)
      for (let v = 0; v < out.length / 3; v++) {
        expect(out[v * 3 + 1]).toBeGreaterThanOrEqual(-0.01)
      }
    }
  })

  it('z coordinates are preserved (only x/y are deformed)', () => {
    curlPositionsPhased(positions, out, 0.4, 'next', easeTurn)
    for (let v = 0; v < out.length / 3; v++) {
      expect(out[v * 3 + 2]).toBeCloseTo(positions[v * 3 + 2], 6)
    }
  })
})
