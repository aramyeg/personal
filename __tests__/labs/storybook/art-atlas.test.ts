import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyUvRect, insetUvRect, type UvRect } from '@/components/labs/storybook/art-atlas'

// INFRA-1 atlas addressing. The uv maths are pure, so they are tested directly;
// the sidecar parse goes through a mocked fetch with a fresh module registry
// (art-atlas caches its fetch in a module-level promise, exactly like
// art-manifest.ts, so only the first mock would ever be consulted otherwise).

const freshArtAtlas = async () => {
  vi.resetModules()
  const mod = await import('@/components/labs/storybook/art-atlas')
  return mod.artAtlas
}

function mockAtlasFetch(body: unknown, ok = true): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })))
}

describe('applyUvRect — remapping a static uv table into an atlas region', () => {
  it('is the identity (a copy) when there is no rect', () => {
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    const out = applyUvRect(uvs, null)
    expect(Array.from(out)).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
    expect(out).not.toBe(uvs) // never hands back the caller's shared constant
  })

  it('never mutates the caller\'s table — layer uv tables are module constants shared by every instance', () => {
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    applyUvRect(uvs, [0.25, 0.5, 0.75, 1])
    expect(Array.from(uvs)).toEqual([0, 0, 1, 0, 1, 1, 0, 1])
  })

  it('maps the unit square onto the region corners', () => {
    const rect: UvRect = [0.25, 0.5, 0.75, 1]
    const out = applyUvRect(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), rect)
    expect(Array.from(out)).toEqual([0.25, 0.5, 0.75, 0.5, 0.75, 1, 0.25, 1])
  })

  it('maps a HALF-SPLIT table (the box faces\' u 0..0.5 / 0.5..1 pairs) into halves of the region', () => {
    const rect: UvRect = [0.2, 0, 0.6, 0.4]
    const left = applyUvRect(new Float32Array([0, 0, 0.5, 0, 0.5, 1, 0, 1]), rect)
    const right = applyUvRect(new Float32Array([0.5, 0, 1, 0, 1, 1, 0.5, 1]), rect)
    expect(left[0]).toBeCloseTo(0.2, 6)
    expect(left[2]).toBeCloseTo(0.4, 6) // the split lands mid-region
    expect(right[0]).toBeCloseTo(0.4, 6)
    expect(right[2]).toBeCloseTo(0.6, 6)
  })

  it('carries a FLIPPED table through as a flip inside the region (the side-aware volvelle v-flip)', () => {
    // discUvs('right') — v runs 1 -> 0 up the quad.
    const flipped = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
    const out = applyUvRect(flipped, [0, 0.5, 1, 1])
    // v=1 must land on the region's TOP edge and v=0 on its bottom: the flip
    // survives the remap rather than being silently normalised away.
    expect(out[1]).toBeCloseTo(1, 6)
    expect(out[5]).toBeCloseTo(0.5, 6)
  })
})

describe('insetUvRect — the anti-bleed half-texel shrink', () => {
  it('shrinks by exactly half a texel on each side', () => {
    const [u0, v0, u1, v1] = insetUvRect([0, 0, 0.5, 0.5], 1024)
    const e = 0.5 / 1024
    expect(u0).toBeCloseTo(e, 9)
    expect(v0).toBeCloseTo(e, 9)
    expect(u1).toBeCloseTo(0.5 - e, 9)
    expect(v1).toBeCloseTo(0.5 - e, 9)
  })

  it('always shrinks — an inset region is strictly inside the region it addresses', () => {
    const rect: UvRect = [0.1, 0.2, 0.9, 0.8]
    const [u0, v0, u1, v1] = insetUvRect(rect, 1024)
    expect(u0).toBeGreaterThan(rect[0])
    expect(v0).toBeGreaterThan(rect[1])
    expect(u1).toBeLessThan(rect[2])
    expect(v1).toBeLessThan(rect[3])
  })

  it('cannot invert a region thinner than a texel (clamped to a quarter of the span)', () => {
    const [u0, , u1] = insetUvRect([0.5, 0.5, 0.5004, 0.5004], 1024)
    expect(u1).toBeGreaterThan(u0)
  })
})

describe('artAtlas — the committed sidecar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads sprites and resolves each one\'s page size', async () => {
    mockAtlasFetch({
      pages: { 'keep-atlas-s4': 1024 },
      sprites: { 'ch3-keep-hall-front': { atlas: 'keep-atlas-s4', rect: [0, 0.8, 0.875, 1] } },
    })
    const artAtlas = await freshArtAtlas()
    const map = await artAtlas()
    expect(map.get('ch3-keep-hall-front')).toEqual({
      atlas: 'keep-atlas-s4',
      rect: [0, 0.8, 0.875, 1],
      page: 1024,
    })
  })

  it('resolves to an EMPTY map when the sidecar is missing — a book with no atlas behaves exactly as before', async () => {
    mockAtlasFetch({}, false)
    const artAtlas = await freshArtAtlas()
    expect((await artAtlas()).size).toBe(0)
  })

  it('resolves to an EMPTY map when the fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    const artAtlas = await freshArtAtlas()
    expect((await artAtlas()).size).toBe(0)
  })

  it('SKIPS a malformed entry rather than throwing — that id then falls back to its own loose webp', async () => {
    mockAtlasFetch({
      pages: { atlasA: 512 },
      sprites: {
        good: { atlas: 'atlasA', rect: [0, 0, 1, 1] },
        noAtlas: { rect: [0, 0, 1, 1] },
        shortRect: { atlas: 'atlasA', rect: [0, 0, 1] },
        nanRect: { atlas: 'atlasA', rect: [0, 0, 1, Number.NaN] },
      },
    })
    const artAtlas = await freshArtAtlas()
    const map = await artAtlas()
    expect([...map.keys()]).toEqual(['good'])
  })

  it('fetches ONCE per session however many consumers ask', async () => {
    mockAtlasFetch({ pages: {}, sprites: {} })
    const artAtlas = await freshArtAtlas()
    await Promise.all([artAtlas(), artAtlas(), artAtlas()])
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })
})
