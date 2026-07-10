import { describe, expect, it } from 'vitest'
import {
  PAGE_H,
  PAGE_SEGMENTS,
  PAGE_W,
  buildPageTemplate,
  easeTurn,
  easeTurnWeighted,
} from '@/components/labs/storybook/book/page-geometry'

// The page is rigid card stock — its mid-turn motion is a pure rotation
// about the spine driven by popup-mechanics' sheetAngle (tested there).
// What lives here is the flat template geometry and the easing curves.

describe('buildPageTemplate', () => {
  const { positions, uvs, indices } = buildPageTemplate()

  it('spans the page from the spine to the free edge, flat at y=0', () => {
    expect(positions[0]).toBeCloseTo(0, 5) // first vertex at the spine
    expect(positions[1]).toBeCloseTo(0, 5)
    expect(positions[2]).toBeCloseTo(-PAGE_H / 2, 5)
    const lastBase = (positions.length / 3 - 1) * 3
    expect(positions[lastBase]).toBeCloseTo(PAGE_W, 5)
    expect(positions[lastBase + 1]).toBeCloseTo(0, 5)
    expect(positions[lastBase + 2]).toBeCloseTo(PAGE_H / 2, 5)
  })

  it('uv u runs 0 at the spine to 1 at the free edge', () => {
    expect(uvs[0]).toBeCloseTo(0, 5)
    const lastUvBase = (uvs.length / 2 - 1) * 2
    expect(uvs[lastUvBase]).toBeCloseTo(1, 5)
  })

  it('uv v puts the image top on the far page edge (camera views from +Z)', () => {
    // Row 0 sits at z=-PAGE_H/2 (far edge) and must sample the top of the
    // print (v=1 under three's default flipY); row 1 (near edge, toward the
    // reader) samples the bottom. v=row rendered every page print upside
    // down — sky at the reader's edge.
    expect(uvs[1]).toBeCloseTo(1, 5) // first vertex: row 0, far edge
    const lastUvBase = (uvs.length / 2 - 1) * 2
    expect(uvs[lastUvBase + 1]).toBeCloseTo(0, 5) // last vertex: row 1, near edge
  })

  it('emits two CCW triangles per segment', () => {
    expect(indices.length).toBe(PAGE_SEGMENTS * 6)
  })
})

describe('easing curves', () => {
  it('easeTurn is a cubic in/out fixed at the endpoints', () => {
    expect(easeTurn(0)).toBe(0)
    expect(easeTurn(1)).toBe(1)
    expect(easeTurn(0.5)).toBeCloseTo(0.5, 9)
    expect(easeTurn(0.25)).toBeCloseTo(4 * 0.25 ** 3, 9)
  })

  it('easeTurnWeighted is a quint in/out — flatter grip at both ends', () => {
    expect(easeTurnWeighted(0)).toBe(0)
    expect(easeTurnWeighted(1)).toBe(1)
    expect(easeTurnWeighted(0.5)).toBeCloseTo(0.5, 9)
    expect(easeTurnWeighted(0.1)).toBeLessThan(easeTurn(0.1))
    expect(easeTurnWeighted(0.9)).toBeGreaterThan(easeTurn(0.9))
  })

  it('both curves are monotonic', () => {
    for (const ease of [easeTurn, easeTurnWeighted]) {
      let prev = 0
      for (let t = 0.02; t <= 1.0001; t += 0.02) {
        const next = ease(Math.min(1, t))
        expect(next).toBeGreaterThanOrEqual(prev)
        prev = next
      }
    }
  })
})
