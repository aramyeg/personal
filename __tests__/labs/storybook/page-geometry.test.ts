import { describe, expect, it } from 'vitest'
import {
  PAGE_DEPTH,
  PAGE_SEGMENTS,
  PAGE_SPAN,
  buildPageTemplate,
  curlPositions,
  curlPositionsPhased,
  easeTurn,
  easeTurnWeighted,
} from '@/components/labs/storybook/book/page-geometry'

// v3 orientation: gutter along X at z=0; the page extends z ∈ [0,
// PAGE_DEPTH] toward the reader and turns about the gutter. The template's
// LAST vertex is the free-edge row's +x corner.
const lastVertexBase = ((PAGE_SEGMENTS + 1) * 2 - 1) * 3
const freeEdgeZ = (pos: Float32Array) => pos[lastVertexBase + 2]
const freeEdgeY = (pos: Float32Array) => pos[lastVertexBase + 1]

describe('buildPageTemplate (v3 axes)', () => {
  const { positions, uvs } = buildPageTemplate()

  it('spans the gutter axis fully and the depth axis from 0', () => {
    expect(positions[0]).toBeCloseTo(-PAGE_SPAN / 2, 5) // first vertex -x
    expect(positions[2]).toBeCloseTo(0, 5) // at the gutter
    expect(freeEdgeZ(positions)).toBeCloseTo(PAGE_DEPTH, 5)
    expect(positions[lastVertexBase]).toBeCloseTo(PAGE_SPAN / 2, 5)
  })

  it('uv v runs 0 at the gutter to 1 at the free edge', () => {
    expect(uvs[1]).toBeCloseTo(0, 5)
    const lastUvBase = ((PAGE_SEGMENTS + 1) * 2 - 1) * 2
    expect(uvs[lastUvBase + 1]).toBeCloseTo(1, 5)
  })
})

describe('curlPositions (v3 axes)', () => {
  const { positions } = buildPageTemplate()
  const out = new Float32Array(positions.length)

  it('t=0 next lies flat on the near side', () => {
    curlPositions(positions, out, 0, 'next', easeTurn)
    expect(freeEdgeZ(out)).toBeCloseTo(PAGE_DEPTH, 3)
  })

  it('t=1 next lands flat on the far side', () => {
    curlPositions(positions, out, 1, 'next', easeTurn)
    expect(freeEdgeZ(out)).toBeCloseTo(-PAGE_DEPTH, 2)
  })

  it('mid-turn lifts the page and lags the free edge', () => {
    curlPositions(positions, out, 0.5, 'next', easeTurn)
    // gutter row stays put
    expect(out[2]).toBeCloseTo(0, 5)
    // free edge is airborne and lagging behind theta=pi/2 (z still > 0)
    expect(freeEdgeY(out)).toBeGreaterThan(PAGE_DEPTH * 0.5)
    expect(freeEdgeZ(out)).toBeGreaterThan(0)
  })

  it('prev mirrors next (starts flat on the far side)', () => {
    curlPositions(positions, out, 0, 'prev', easeTurn)
    expect(freeEdgeZ(out)).toBeCloseTo(-PAGE_DEPTH, 3)
  })

  it('x is never disturbed by the curl', () => {
    curlPositions(positions, out, 0.37, 'next', easeTurn)
    for (let i = 0; i < positions.length; i += 3) {
      expect(out[i]).toBeCloseTo(positions[i], 6)
    }
  })
})

describe('curlPositionsPhased (v3 axes)', () => {
  const { positions } = buildPageTemplate()
  const out = new Float32Array(positions.length)

  it('matches curlPositions at rest and landing', () => {
    curlPositionsPhased(positions, out, 0, 'next', easeTurnWeighted)
    expect(freeEdgeZ(out)).toBeCloseTo(PAGE_DEPTH, 3)
    curlPositionsPhased(positions, out, 1, 'next', easeTurnWeighted)
    expect(freeEdgeZ(out)).toBeCloseTo(-PAGE_DEPTH, 2)
  })

  it('the +x corner leads the -x corner mid-turn', () => {
    curlPositionsPhased(positions, out, 0.35, 'next', easeTurnWeighted)
    const minusXCornerZ = out[PAGE_SEGMENTS * 2 * 3 + 2] // free-edge row, -x
    const plusXCornerZ = freeEdgeZ(out) // free-edge row, +x
    // Leading corner is further through the sweep (smaller z on a next turn).
    expect(plusXCornerZ).toBeLessThan(minusXCornerZ)
  })

  it('never dips below the page plane', () => {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      curlPositionsPhased(positions, out, t, 'next', easeTurnWeighted)
      for (let i = 1; i < out.length; i += 3) {
        expect(out[i]).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
