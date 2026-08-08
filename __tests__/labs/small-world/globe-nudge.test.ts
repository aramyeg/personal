import { describe, expect, it } from 'vitest'
import {
  GLOBE_ROCK,
  GLOBE_UNIFORM,
  globeRayHit,
  triggerGlobeRock,
} from '@/components/labs/small-world/scene/globe-nudge'
import {
  AMP_CAP,
  restingSpring,
  sampleRock,
} from '@/components/labs/small-world/scene/props/desk-nudge'
import { WORLD_RADIUS } from '@/components/labs/small-world/scene/camera'

/**
 * The ending's globe answers the pointer (T97 fix S1). The module reuses the T89 rocker closed
 * forms, so what is pinned here is the globe's OWN clauses: the analytic sphere pick, the exact
 * +0 rest, the T90 bake-constraint amplitude ceiling, determinism, and the cradle precession.
 */

describe('the sphere pick: analytic ray vs the world ball', () => {
  it('a ray aimed at the centre hits at |origin| − R, on the sphere, at the NEAR root', () => {
    const o: [number, number, number] = [0, 2, 12]
    const len = Math.hypot(o[0], o[1], o[2])
    const d: [number, number, number] = [-o[0] / len, -o[1] / len, -o[2] / len]
    const hit = globeRayHit(o[0], o[1], o[2], d[0], d[1], d[2])
    expect(hit).not.toBeNull()
    expect(hit!.t).toBeCloseTo(len - WORLD_RADIUS, 10)
    expect(hit!.t).toBeLessThan(len)
    const [px, py, pz] = hit!.point
    expect(Math.abs(Math.hypot(px, py, pz) - WORLD_RADIUS)).toBeLessThan(1e-6)
  })

  it('a ray aimed well wide misses', () => {
    expect(globeRayHit(0, 2, 12, 1, 0, 0)).toBeNull()
    expect(globeRayHit(5, 2, 12, 0, 0, -1)).toBeNull()
  })

  it('an origin inside the ball still gets a hit — the exit point, t ≥ 0', () => {
    const hit = globeRayHit(0, 0.5, 0, 0, 0, -1)
    expect(hit).not.toBeNull()
    expect(hit!.t).toBeGreaterThanOrEqual(0)
    const [px, py, pz] = hit!.point
    expect(Math.abs(Math.hypot(px, py, pz) - WORLD_RADIUS)).toBeLessThan(1e-6)
  })
})

describe('the rock: heavy, capped, exact, deterministic', () => {
  it('a full-strength rock decays to EXACT +0 and stays resting without touching the array', () => {
    const s = restingSpring()
    triggerGlobeRock(s, 0, 1, 0, 1)
    const out = new Float32Array([9, 9, 9, 9])
    let live = true
    let t = 0
    while (live && t < 30) {
      t += 1 / 60
      live = sampleRock(s, GLOBE_ROCK, t, out)
    }
    expect(live).toBe(false)
    expect(s.active).toBe(false)
    for (let i = 0; i < 4; i++) expect(Object.is(out[i], 0)).toBe(true)
    // once resting, further samples cost nothing and write nothing
    out[3] = 123
    expect(sampleRock(s, GLOBE_ROCK, t + 5, out)).toBe(false)
    expect(out[3]).toBe(123)
  })

  it('the T90 bake constraint holds: the capped envelope stays under the documented 6° ceiling', () => {
    // the documented worst case: peakDeg · AMP_CAP = 5.25°, under the 6° bake ceiling
    expect(GLOBE_ROCK.peakDeg * AMP_CAP).toBeLessThanOrEqual(6)
    // ...and re-poke spam cannot push the ANGLE past it: the lit side visibly stays put
    const s = restingSpring()
    const out = new Float32Array(4)
    const cap = ((GLOBE_ROCK.peakDeg * Math.PI) / 180) * AMP_CAP + 1e-9
    let peak = 0
    for (let i = 0; i < 6; i++) {
      triggerGlobeRock(s, i * 0.05, 1, 0, 1)
      for (let t = i * 0.05; t < i * 0.05 + 0.05; t += 0.002) {
        sampleRock(s, GLOBE_ROCK, t, out)
        if (out[3] > peak) peak = out[3]
      }
    }
    for (let t = 0.3; t < 5; t += 0.002) {
      sampleRock(s, GLOBE_ROCK, t, out)
      if (out[3] > peak) peak = out[3]
    }
    expect(peak).toBeLessThanOrEqual(cap)
  })

  it('the impulse is deterministic arithmetic — same inputs, bit-identical frames', () => {
    const a = restingSpring()
    const b = restingSpring()
    triggerGlobeRock(a, 0.5, 0.3, -0.7, 1)
    triggerGlobeRock(b, 0.5, 0.3, -0.7, 1)
    triggerGlobeRock(a, 0.9, -0.6, 0.8, 0.35)
    triggerGlobeRock(b, 0.9, -0.6, 0.8, 0.35)
    const oa = new Float32Array(4)
    const ob = new Float32Array(4)
    for (let t = 0.5; t < 3; t += 0.013) {
      sampleRock(a, GLOBE_ROCK, t, oa)
      sampleRock(b, GLOBE_ROCK, t, ob)
      expect(oa).toEqual(ob)
    }
  })

  it("PRECESSES in its cradle: detuned axes + quadrature turn the wobble's axis as it settles", () => {
    const s = restingSpring()
    triggerGlobeRock(s, 0, 1, 0, 1)
    const out = new Float32Array(4)
    // the DOMINANT axis inside a window (the axis at the biggest crest) — sampling at zero
    // crossings would read noise, so each window votes with its largest excursion
    const dominantAxis = (t0: number, t1: number): [number, number] => {
      let bestM = -1
      let ax = 1
      let az = 0
      for (let t = t0; t < t1; t += 0.004) {
        sampleRock(s, GLOBE_ROCK, t, out)
        if (out[3] > bestM) {
          bestM = out[3]
          ax = out[0]
          az = out[2]
        }
      }
      return [ax, az]
    }
    const [x0, z0] = dominantAxis(0, 0.6)
    const [x1, z1] = dominantAxis(1.5, 2.1)
    // |dot| is sign-agnostic (an axis is a line, not an arrow) and stricter than the raw dot
    const dot = Math.abs(x0 * x1 + z0 * z1)
    expect(dot).toBeLessThan(0.99)
  })

  it('the uniform starts at rest: all-zero, so the reader takes the untouched path from frame one', () => {
    for (let i = 0; i < 4; i++) expect(Object.is(GLOBE_UNIFORM.value[i], 0)).toBe(true)
  })
})
