import { describe, expect, it } from 'vitest'
import {
  GUTTER_SHADE_U,
  INTERIOR_SHEETS,
  PAGE_H,
  PAGE_SEGMENTS,
  PAGE_W,
  SHEET_STACK_T,
  STACK_PEDESTAL,
  STACK_TOTAL_H,
  buildPageTemplate,
  buildStackBlock,
  easeTurn,
  easeTurnWeighted,
  easeTurnWeightedInv,
  gutterShade,
  restAngles,
  updateStackBlock,
} from '@/components/labs/storybook/book/page-geometry'
import { SPREAD_COUNT } from '@/components/labs/storybook/content'

// The page is rigid card stock — its mid-turn motion is a pure rotation
// about the spine driven by popup-mechanics' sheetAngle (tested there).
// What lives here is the flat template geometry and the easing curves.

describe('buildPageTemplate', () => {
  const { positions, uvs, colors, indices } = buildPageTemplate()

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

  it('packs grid columns toward the spine (the gutter-shade ramp needs the resolution there)', () => {
    const firstSegment = positions[3] - positions[0] // col 1 x - col 0 x
    const uniform = PAGE_W / PAGE_SEGMENTS
    expect(firstSegment).toBeGreaterThan(0)
    expect(firstSegment).toBeLessThan(uniform / 2)
    // uv must stay u = x/PAGE_W under the warp.
    for (let col = 0; col <= PAGE_SEGMENTS; col++) {
      expect(uvs[col * 2]).toBeCloseTo(positions[col * 3] / PAGE_W, 5)
    }
  })

  it('bakes the gutter-shade AO ramp: dark at the spine, clean past the falloff, monotonic', () => {
    expect(colors.length).toBe(positions.length)
    // Spine vertex wears the dark stop; every channel below clean paper.
    for (let ch = 0; ch < 3; ch++) {
      expect(colors[ch]).toBeLessThan(0.5)
      expect(colors[ch]).toBeGreaterThan(0)
    }
    for (let col = 0; col <= PAGE_SEGMENTS; col++) {
      const u = uvs[col * 2]
      for (let ch = 0; ch < 3; ch++) {
        const value = colors[col * 3 + ch]
        // Clean paper (exactly 1) everywhere past the falloff — the print
        // must be untouched outside the fold shadow.
        if (u >= GUTTER_SHADE_U) expect(value).toBe(1)
        // Monotonic non-decreasing out from the spine.
        if (col > 0) expect(value).toBeGreaterThanOrEqual(colors[(col - 1) * 3 + ch])
        // Both rows carry the identical ramp (shade depends only on u).
        expect(colors[(PAGE_SEGMENTS + 1 + col) * 3 + ch]).toBe(value)
      }
    }
  })

  it('gutterShade is warm (r >= g >= b) so the fold shadow reads brown, not gray', () => {
    for (const u of [0, 0.02, 0.05]) {
      const [r, g, b] = gutterShade(u)
      expect(r).toBeGreaterThanOrEqual(g)
      expect(g).toBeGreaterThanOrEqual(b)
    }
    expect(gutterShade(GUTTER_SHADE_U)).toEqual([1, 1, 1])
    expect(gutterShade(1)).toEqual([1, 1, 1])
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

  it('easeTurnWeightedInv inverts easeTurnWeighted exactly', () => {
    // The landing settle publishes easeTurnWeightedInv(E) and relies on every
    // consumer's own easeTurnWeighted(t) recovering E to the last bit. That
    // is the direction that must be exact.
    let worst = 0
    for (let i = 0; i <= 1000; i++) {
      const e = i / 1000
      worst = Math.max(worst, Math.abs(easeTurnWeighted(easeTurnWeightedInv(e)) - e))
    }
    expect(worst).toBeLessThan(1e-12)

    // The other direction is only as good as float can hold it: the quint is
    // so flat at the ends that ease(t) near 1 cancels away the information
    // needed to come back (~1e-7 at t=0.999). Away from the endpoints it is
    // exact, and nothing in the driver depends on the ill-conditioned end.
    let worstBack = 0
    for (let i = 50; i <= 950; i++) {
      const t = i / 1000
      worstBack = Math.max(worstBack, Math.abs(easeTurnWeightedInv(easeTurnWeighted(t)) - t))
    }
    expect(worstBack).toBeLessThan(1e-12)
    expect(easeTurnWeightedInv(0)).toBe(0)
    expect(easeTurnWeightedInv(1)).toBe(1)
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
    expect(STACK_PEDESTAL + INTERIOR_SHEETS * SHEET_STACK_T).toBeCloseTo(STACK_TOTAL_H, 10)
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

describe('buildStackBlock / updateStackBlock (the closed-slab <-> open-wedge morph)', () => {
  const W = 1.2
  const build = () => buildStackBlock(W, 1.5)

  it('is a 6-face flat-shaded prism born as the unit shut slab', () => {
    const { positions, uvs, indices } = build()
    expect(positions.length).toBe(24 * 3)
    expect(uvs.length).toBe(24 * 2)
    expect(indices.length).toBe(36)
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i + 1] === 0 || positions[i + 1] === 1).toBe(true)
    }
  })

  it('spineH = 0 reproduces the open wedge: valley floor at the spine, height only at the fore-edge', () => {
    const { positions, uvs } = build()
    updateStackBlock(positions, uvs, 0, 0.126)
    for (let i = 0; i < positions.length / 3; i++) {
      const [x, y] = [positions[i * 3], positions[i * 3 + 1]]
      if (x === 0) expect(y).toBe(0)
      if (y !== 0) {
        expect(x).toBeCloseTo(W, 6)
        expect(y).toBeCloseTo(0.126, 6)
        expect(uvs[i * 2 + 1]).toBe(1) // stack top samples the stripe run's top
      }
    }
  })

  it('spineH = foreH reproduces the shut slab with level, uncompressed stripes', () => {
    const { positions, uvs } = build()
    updateStackBlock(positions, uvs, 0.126, 0.126)
    const tops: number[] = []
    for (let i = 0; i < positions.length / 3; i++) {
      const y = positions[i * 3 + 1]
      expect(y === 0 || Math.abs(y - 0.126) < 1e-7).toBe(true)
      if (y !== 0) tops.push(uvs[i * 2 + 1])
    }
    // Every top corner (spine and fore alike) sits at v = 1: stripes run
    // level across the whole shut block.
    for (const v of tops) expect(v).toBe(1)
  })

  it('mid-relaxation: spine side sinks while the fore-edge holds, stripes converging toward the binding', () => {
    const { positions, uvs } = build()
    updateStackBlock(positions, uvs, 0.063, 0.126)
    const spineTopVs: number[] = []
    for (let i = 0; i < positions.length / 3; i++) {
      const [x, y] = [positions[i * 3], positions[i * 3 + 1]]
      if (x === 0 && y !== 0) {
        expect(y).toBeCloseTo(0.063, 6) // spine-top corners at spineH
        spineTopVs.push(uvs[i * 2 + 1])
      }
      if (Math.abs(x - W) < 1e-7 && y !== 0) expect(y).toBeCloseTo(0.126, 6)
    }
    // The side faces' spine-top corners carry v = spineH/foreH — half the
    // stripe run left at the binding (the top-slope face's corners stay
    // pinned to the top stripe row, v = 1, by design).
    expect(spineTopVs.filter((v) => Math.abs(v - 0.5) < 1e-7).length).toBe(4)
    for (const v of spineTopVs) expect(v === 1 || Math.abs(v - 0.5) < 1e-7).toBe(true)
  })
})
