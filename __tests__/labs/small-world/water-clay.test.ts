import { describe, expect, it } from 'vitest'
import {
  WATER_DEFAULTS,
  WATER_OUTWARD_CEIL,
  type WaterParams,
  effectiveOutward,
  waterDeepGate,
  waterFootprintClear,
  waterFlowDir,
  waterStreak,
  waterRelief,
  waterNormalTilt,
} from '@/components/labs/small-world/scene/water-clay'
import { CROSSINGS_A, CROSSINGS_B } from '@/components/labs/small-world/scene/biomes'

const WATER_LEVEL = 0.972 // mirrors biomes.WATER_LEVEL (pinned in biomes.test)
const P = WATER_DEFAULTS
const ALL_CROSSINGS = [...CROSSINGS_A, ...CROSSINGS_B]
// The worst case the bench also uses: every relief dial at its slider maximum (Round-9
// widened ranges).
const MAXP: WaterParams = {
  ...WATER_DEFAULTS,
  pathWarp: 3.5,
  pathStretch: 10,
  pathDepth: 0.06,
  pocketTint: 1,
  reliefInward: 0.1,
  reliefOutward: 0.04,
  ridgeSharp: 5,
  octaves: 6,
  normalRough: 1,
  flowStrength: 1.5,
  flowAlign: 1,
}

describe('effectiveOutward — the ≤0.4× inward hard cap', () => {
  it('caps the outward crest at 0.4× the inward budget regardless of dials', () => {
    expect(effectiveOutward({ ...P, reliefInward: 0.02, reliefOutward: 0.007 })).toBeCloseTo(0.007, 12)
    // outward dialed above the cap → clamped to 0.4× inward
    expect(effectiveOutward({ ...P, reliefInward: 0.01, reliefOutward: 0.02 })).toBeCloseTo(0.004, 12)
    // at both maxima the cap is 0.4×0.10 = 0.04 = the documented ceiling
    expect(effectiveOutward(MAXP)).toBeCloseTo(WATER_OUTWARD_CEIL, 12)
  })

  it('the shipped default outward sits under its cap', () => {
    expect(WATER_DEFAULTS.reliefOutward).toBeLessThanOrEqual(0.4 * WATER_DEFAULTS.reliefInward)
  })
})

describe('waterDeepGate — deep-only, min-depth across both variants', () => {
  it('is 0 at/above the waterline (shore) and 1 in deep water', () => {
    expect(waterDeepGate(0.0, 0.0)).toBe(0) // terrain at the waterline → shore
    expect(waterDeepGate(0.02, 0.02)).toBe(0) // just below waterline, still shallow
    expect(waterDeepGate(-0.13, -0.13)).toBe(1) // deep ocean basin
  })

  it('uses the SHALLOWER variant, so either lap having land near the surface closes it', () => {
    // A is deep but B is shallow shore → gate must close (single shared geometry must
    // not crest B's coast).
    expect(waterDeepGate(-0.13, 0.0)).toBe(0)
    expect(waterDeepGate(0.0, -0.13)).toBe(0)
  })
})

describe('waterFootprintClear — relief zeroed under deck footprints only', () => {
  it('is 0 exactly under a deck (near a crossing longitude AND in the lane)', () => {
    for (const cx of ALL_CROSSINGS) {
      expect(waterFootprintClear(0, cx, ALL_CROSSINGS)).toBe(0) // dead centre of the deck
      expect(waterFootprintClear(0.1, cx, ALL_CROSSINGS)).toBe(0) // still in the lane band
    }
  })

  it('is 1 off the lane even AT a crossing longitude (the widening channel takes relief)', () => {
    for (const cx of ALL_CROSSINGS) {
      expect(waterFootprintClear(0.5, cx, ALL_CROSSINGS)).toBe(1)
      expect(waterFootprintClear(-0.5, cx, ALL_CROSSINGS)).toBe(1)
    }
  })

  it('is 1 in the lane BETWEEN crossings (mid-face lane water now takes relief)', () => {
    // A longitude comfortably clear of every crossing (the widest inter-crossing gap
    // sits near θ≈4.5 between 3.52 and 5.3).
    expect(waterFootprintClear(0, 4.5, ALL_CROSSINGS)).toBe(1)
  })

  it('fully covers the physical deck footprint (±0.17 rad θ, |nx|≤0.12) with margin', () => {
    for (const cx of ALL_CROSSINGS) {
      for (let dth = -0.17; dth <= 0.17 + 1e-9; dth += 0.02) {
        for (let nx = -0.12; nx <= 0.12 + 1e-9; nx += 0.03) {
          expect(waterFootprintClear(nx, cx + dth, ALL_CROSSINGS)).toBe(0)
        }
      }
    }
  })
})

describe('waterFlowDir — the authored drainage flow field', () => {
  it('is a unit tangent (perpendicular to the surface normal) off the poles', () => {
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * 6.283
      const nx = Math.cos(a) * 0.5
      const ring = Math.sqrt(1 - nx * nx)
      const ny = ring * Math.cos(a * 1.3)
      const nz = ring * Math.sin(a * 1.3)
      const [fx, fy, fz] = waterFlowDir(nx, ny, nz, 0.4)
      const len = Math.hypot(fx, fy, fz)
      expect(len).toBeCloseTo(1, 6)
      // tangency: f · n ≈ 0
      expect(Math.abs(fx * nx + fy * ny + fz * nz)).toBeLessThan(1e-6)
    }
  })

  it('points toward the left-ocean pole (−x) at zero swirl (poleward drainage)', () => {
    // On the equator (nx=0) the poleward projection is exactly −x̂.
    const [fx, fy, fz] = waterFlowDir(0, 1, 0, 0)
    expect(fx).toBeCloseTo(-1, 6)
    expect(fy).toBeCloseTo(0, 6)
    expect(fz).toBeCloseTo(0, 6)
  })

  it('degenerates to [0,0,0] at the poles (no preferred flow)', () => {
    expect(waterFlowDir(1, 0, 0, 0.4)).toEqual([0, 0, 0])
    expect(waterFlowDir(-1, 0, 0, 0.4)).toEqual([0, 0, 0])
  })
})

describe('waterStreak — the path field', () => {
  it('is deterministic and bounded in [0, 1]', () => {
    let mn = 1
    let mx = 0
    for (let i = 0; i < 5000; i++) {
      const a = (i * 0.7) % 6.283
      const nx = Math.cos(a) * 0.4
      const ny = Math.sin(a) * 0.8
      const nz = Math.cos(a * 1.7) * 0.4
      const s = waterStreak(nx, ny, nz, P)
      expect(waterStreak(nx, ny, nz, P)).toBe(s)
      if (s < mn) mn = s
      if (s > mx) mx = s
    }
    expect(mn).toBeGreaterThanOrEqual(0)
    expect(mx).toBeLessThanOrEqual(1)
  })

  it('flow alignment elongates features ALONG the flow (slower variation along than across)', () => {
    // Stepping ALONG the flow direction should change the streak LESS than stepping across
    // it (features run long along the flow). The domain warp adds isotropic marbling that
    // masks the metric, so this pins the MECHANISM on the clean signal (pathWarp 0); the
    // default-warp look is judged in the render captures. flowAlign 0 must show NO bias.
    const clean = { ...P, pathWarp: 0, pathStretch: 6, flowStrength: 0.4 }
    const aligned: WaterParams = { ...clean, flowAlign: 1 }
    const iso: WaterParams = { ...clean, flowAlign: 0 }
    const eps = 0.06
    const measure = (pp: WaterParams): { along: number; across: number } => {
      let along = 0
      let across = 0
      let n = 0
      for (let i = 0; i < 1500; i++) {
        const a = (i / 1500) * 6.283
        const nx = Math.cos(a) * 0.4
        const ring = Math.sqrt(1 - nx * nx)
        const ny = ring * Math.cos(a * 1.7)
        const nz = ring * Math.sin(a * 1.7)
        const [fx, fy, fz] = waterFlowDir(nx, ny, nz, pp.flowStrength)
        if (fx === 0 && fy === 0 && fz === 0) continue
        // across = f × n (the other surface tangent)
        const gx = fy * nz - fz * ny
        const gy = fz * nx - fx * nz
        const gz = fx * ny - fy * nx
        const gl = Math.hypot(gx, gy, gz) || 1
        const s0 = waterStreak(nx, ny, nz, pp)
        const sAlong = waterStreak(nx + eps * fx, ny + eps * fy, nz + eps * fz, pp)
        const sAcross = waterStreak(nx + (eps * gx) / gl, ny + (eps * gy) / gl, nz + (eps * gz) / gl, pp)
        along += Math.abs(sAlong - s0)
        across += Math.abs(sAcross - s0)
        n++
      }
      return { along: along / n, across: across / n }
    }
    const a = measure(aligned)
    expect(a.along).toBeLessThan(a.across) // elongated along flow
    const b = measure(iso)
    // isotropic: no directional bias (along ≈ across, within a small tolerance)
    expect(Math.abs(b.along - b.across)).toBeLessThan(0.1 * b.across)
  })
})

describe('waterRelief — the shoreline + deck contract', () => {
  it('is exactly 0 when the gate is 0 (shore or lane)', () => {
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * 6.283
      const nx = Math.cos(a) * 0.5
      const ny = Math.sin(a) * 0.7
      const nz = Math.cos(a * 2.1) * 0.5
      const streak = waterStreak(nx, ny, nz, MAXP)
      expect(waterRelief(nx, ny, nz, 0, streak, MAXP)).toBe(0)
    }
  })

  it('never crests the waterline at the shore even at MAX dials (net radius ≤ WATER_LEVEL)', () => {
    // At any shore/lane point gate = 0, so the water sits at the v1 molded sheet
    // (≤ WATER_LEVEL). Emulate the worst molded push (inward can only lower it further).
    for (let i = 0; i < 500; i++) {
      const a = (i / 500) * 6.283
      const nx = Math.cos(a) * 0.6
      const ny = Math.sin(a) * 0.6
      const nz = Math.cos(a * 1.3) * 0.6
      const streak = waterStreak(nx, ny, nz, MAXP)
      const relief = waterRelief(nx, ny, nz, 0, streak, MAXP) // shore gate = 0
      const radius = WATER_LEVEL * (1 + relief)
      expect(radius).toBeLessThanOrEqual(WATER_LEVEL + 1e-12)
    }
  })

  it('in fully-open deep water the outward push never exceeds effectiveOutward', () => {
    let maxOut = -1
    for (let i = 0; i < 4000; i++) {
      const a = (i * 0.37) % 6.283
      const nx = Math.cos(a) * 0.3
      const ny = Math.sin(a) * 0.9
      const nz = Math.cos(a * 2.7) * 0.3
      const streak = waterStreak(nx, ny, nz, MAXP)
      const relief = waterRelief(nx, ny, nz, 1, streak, MAXP) // fully open
      if (relief > maxOut) maxOut = relief
    }
    expect(maxOut).toBeLessThanOrEqual(effectiveOutward(MAXP) + 1e-12)
  })

  it('is deterministic', () => {
    const s = waterStreak(0.3, 0.6, 0.4, P)
    expect(waterRelief(0.3, 0.6, 0.4, 0.7, s, P)).toBe(waterRelief(0.3, 0.6, 0.4, 0.7, s, P))
  })
})

describe('waterNormalTilt', () => {
  it('is zero at amp 0 and bounded by amp per axis', () => {
    expect(waterNormalTilt(0.3, 0.6, 0.4, 0)).toEqual([0, 0, 0])
    const [dx, dy, dz] = waterNormalTilt(0.3, 0.6, 0.4, 0.5)
    expect(Math.abs(dx)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(dy)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(dz)).toBeLessThanOrEqual(0.5)
  })
})
