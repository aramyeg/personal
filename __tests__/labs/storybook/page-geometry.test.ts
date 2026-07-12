import { describe, expect, it } from 'vitest'
import {
  INTERIOR_SHEETS,
  PAGE_H,
  PAGE_SEGMENTS,
  PAGE_W,
  SHEET_STACK_T,
  STACK_PEDESTAL,
  buildPageTemplate,
  easeTurn,
  easeTurnWeighted,
  restAngles,
} from '@/components/labs/storybook/book/page-geometry'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'

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

describe('bulge rest poses (derive-bulge.mjs theorems A16-A20)', () => {
  const FLAT_EPSILON = 0.02
  const BLOOM_MIN = 2.9

  it('INTERIOR_SHEETS stays bound to the book length', () => {
    expect(INTERIOR_SHEETS).toBe(SPREAD_COUNT - 1)
  })

  it('A20: tilts are non-negative and the fan fits the old block silhouette', () => {
    for (let s = 0; s <= INTERIOR_SHEETS; s++) {
      const r = restAngles(s)
      expect(r.aL).toBeGreaterThanOrEqual(0)
      expect(r.aR).toBeGreaterThanOrEqual(0)
      expect(r.hinge).toBeLessThanOrEqual(Math.max(r.hL, r.hR) + 1e-12)
    }
    expect(STACK_PEDESTAL + INTERIOR_SHEETS * SHEET_STACK_T).toBeCloseTo(0.11, 10)
  })

  it('A18: every open spread still blooms fully at rest', () => {
    for (let s = 1; s <= INTERIOR_SHEETS; s++) {
      const r = restAngles(s)
      expect(Math.PI - r.aL - r.aR).toBeGreaterThanOrEqual(BLOOM_MIN)
    }
  })

  it('A16/A19: every next-turn sweep is forward and stays inside both wedges', () => {
    for (let s = 1; s <= INTERIOR_SHEETS - 1; s++) {
      const cur = restAngles(s)
      const nxt = restAngles(s + 1)
      const theta0 = cur.aR
      const theta1 = Math.PI - nxt.aL
      expect(theta1).toBeGreaterThan(theta0)
      for (let i = 0; i <= 100; i++) {
        const theta = theta0 + ((theta1 - theta0) * i) / 100
        expect(Math.PI - cur.aL - theta).toBeGreaterThanOrEqual(-1e-12) // outgoing wedge
        expect(theta - nxt.aR).toBeGreaterThanOrEqual(-1e-12) // incoming wedge
      }
    }
  })

  it('A17: hand-off residuals sit strictly between 0 and FLAT_EPSILON (the bulge exists AND hides)', () => {
    for (let s = 1; s <= INTERIOR_SHEETS - 1; s++) {
      const cur = restAngles(s)
      const nxt = restAngles(s + 1)
      const lift = cur.aR - nxt.aR
      const land = nxt.aL - cur.aL
      for (const r of [lift, land]) {
        expect(r).toBeGreaterThan(0)
        expect(r).toBeLessThan(FLAT_EPSILON)
      }
    }
  })
})
