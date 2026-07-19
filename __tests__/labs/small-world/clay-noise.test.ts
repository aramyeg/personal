import { describe, expect, it } from 'vitest'
import {
  makePermutation,
  perlin3,
  fbm3,
  ridged3,
  domainWarp3,
} from '@/components/labs/small-world/scene/clay-noise'

const perm = makePermutation(1337)

// A spread of sample points (integers, fractions, negatives, large coords).
const SAMPLES: [number, number, number][] = [
  [0, 0, 0],
  [1.5, 2.5, 3.5],
  [-4.2, 7.9, -1.1],
  [12.34, -56.78, 90.12],
  [0.001, 0.002, 0.003],
  [100.5, -200.25, 300.75],
]

describe('makePermutation', () => {
  it('is a doubled 0..255 table (length 512, second half mirrors the first)', () => {
    expect(perm.length).toBe(512)
    for (let i = 0; i < 256; i++) expect(perm[i]).toBe(perm[i + 256])
    // a permutation: every value 0..255 appears exactly once in the first half
    const seen = new Set(Array.from(perm.slice(0, 256)))
    expect(seen.size).toBe(256)
  })

  it('is deterministic for a seed and differs across seeds', () => {
    const a = makePermutation(42)
    const b = makePermutation(42)
    const c = makePermutation(43)
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(a)).not.toEqual(Array.from(c))
  })
})

describe('perlin3', () => {
  it('is deterministic (same perm + coords → identical value)', () => {
    for (const [x, y, z] of SAMPLES) {
      expect(perlin3(perm, x, y, z)).toBe(perlin3(perm, x, y, z))
    }
  })

  it('stays within the coherent-noise bound |n| ≤ 1', () => {
    let mx = 0
    for (let i = 0; i < 40000; i++) {
      const x = (i * 12.9898) % 97 - 48
      const y = (i * 78.233) % 89 - 44
      const z = (i * 37.719) % 71 - 35
      const n = perlin3(perm, x, y, z)
      if (Math.abs(n) > mx) mx = Math.abs(n)
    }
    expect(mx).toBeLessThanOrEqual(1)
    expect(mx).toBeGreaterThan(0.5) // it actually varies (not a flat field)
  })

  it('is continuous — a tiny step moves the value only a little', () => {
    for (const [x, y, z] of SAMPLES) {
      const a = perlin3(perm, x, y, z)
      const b = perlin3(perm, x + 1e-4, y, z)
      expect(Math.abs(a - b)).toBeLessThan(0.01)
    }
  })
})

describe('fbm3', () => {
  it('is deterministic and normalized into ~[-1, 1]', () => {
    let mx = 0
    for (let i = 0; i < 20000; i++) {
      const x = (i * 1.37) % 50 - 25
      const y = (i * 2.11) % 44 - 22
      const z = (i * 0.73) % 66 - 33
      const n = fbm3(perm, x, y, z, 4, 2, 0.5)
      expect(fbm3(perm, x, y, z, 4, 2, 0.5)).toBe(n)
      if (Math.abs(n) > mx) mx = Math.abs(n)
    }
    expect(mx).toBeLessThanOrEqual(1)
  })

  it('treats octaves < 1 as a single octave (no NaN)', () => {
    const n = fbm3(perm, 1.2, 3.4, 5.6, 0, 2, 0.5)
    expect(Number.isFinite(n)).toBe(true)
    expect(n).toBe(perlin3(perm, 1.2, 3.4, 5.6))
  })
})

describe('ridged3', () => {
  it('is deterministic and bounded in [0, 1] with crests near 1', () => {
    let mx = 0
    let mn = 1
    for (let i = 0; i < 20000; i++) {
      const x = (i * 1.91) % 50 - 25
      const y = (i * 3.13) % 40 - 20
      const z = (i * 0.57) % 60 - 30
      const r = ridged3(perm, x, y, z, 4, 2, 0.5, 1.3)
      expect(ridged3(perm, x, y, z, 4, 2, 0.5, 1.3)).toBe(r)
      if (r > mx) mx = r
      if (r < mn) mn = r
    }
    expect(mn).toBeGreaterThanOrEqual(0)
    expect(mx).toBeLessThanOrEqual(1)
    expect(mx).toBeGreaterThan(0.7) // crests reach high
  })

  it('sharper exponent lowers the average (thinner crests)', () => {
    let soft = 0
    let hard = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const x = (i * 0.83) % 50 - 25
      const y = (i * 1.29) % 40 - 20
      const z = (i * 0.41) % 60 - 30
      soft += ridged3(perm, x, y, z, 4, 2, 0.5, 1)
      hard += ridged3(perm, x, y, z, 4, 2, 0.5, 3)
    }
    expect(hard / N).toBeLessThan(soft / N)
  })
})

describe('domainWarp3', () => {
  it('is deterministic and equals identity at k = 0', () => {
    for (const [x, y, z] of SAMPLES) {
      const [wx, wy, wz] = domainWarp3(perm, x, y, z, 0)
      expect([wx, wy, wz]).toEqual([x, y, z])
      const a = domainWarp3(perm, x, y, z, 0.7)
      const b = domainWarp3(perm, x, y, z, 0.7)
      expect(a).toEqual(b)
    }
  })

  it('displaces by at most k in each axis (perlin bound)', () => {
    for (const [x, y, z] of SAMPLES) {
      const k = 1.5
      const [wx, wy, wz] = domainWarp3(perm, x, y, z, k)
      expect(Math.abs(wx - x)).toBeLessThanOrEqual(k)
      expect(Math.abs(wy - y)).toBeLessThanOrEqual(k)
      expect(Math.abs(wz - z)).toBeLessThanOrEqual(k)
    }
  })
})
