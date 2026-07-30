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
  iceFootprint,
  iceRim,
  iceCrack,
} from '@/components/labs/small-world/scene/water-clay'
import { CROSSINGS_A, CROSSINGS_B, waterMask } from '@/components/labs/small-world/scene/biomes'

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

// --- Task 40: icy winter lake ------------------------------------------------
// The two B2 winter water caps the ice covers: B2_FROZEN place(0.34,5.55) and the
// larger, visible B2_SHELF place(0.6,5.72) ("the frozen sea", floes on it).
const place = (nx: number, theta: number): [number, number, number] => {
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return [nx, ring * Math.cos(theta), ring * Math.sin(theta)]
}
const FROZEN = place(0.34, 5.55)
const SHELF = place(0.6, 5.72)
const ALL_X = [...CROSSINGS_A, ...CROSSINGS_B]
const TIDE_LAT_LO = 0.8 // mirrors biomes.TIDE_LAT_LO — the ice must end before the flood limb

describe('iceFootprint — the hard winter-pond mask (union of both B2 caps)', () => {
  it('is high at BOTH B2 pond centres and pins to the live biomes B2 water', () => {
    expect(iceFootprint(...FROZEN)).toBeGreaterThan(0.9)
    expect(iceFootprint(...SHELF)).toBeGreaterThan(0.9)
    // the biomes B2 (variant 1) water really is at both — so the footprint sits on the
    // ponds, not hand-guessed spots (guards against the duplicated caps drifting).
    expect(waterMask(FROZEN[0], FROZEN[1], FROZEN[2], 1)).toBeGreaterThan(0.9)
    expect(waterMask(SHELF[0], SHELF[1], SHELF[2], 1)).toBeGreaterThan(0.9)
  })

  it('agrees with the live biomes water ACROSS THE RAMP, not just at the centre', () => {
    // Task 61. The test above says both masks are high at a hardcoded pond centre, and its comment
    // claims that guards the duplicated caps against drifting. It nearly does not: both sides sample
    // the same hand-written point, so a pond that MOVES a little leaves that point deep inside
    // itself and both masks stay above 0.9. Measured — shifting B2_SHELF from place(0.6, 5.72) to
    // place(0.62, 5.72) in biomes.ts moves the centre 0.0252 rad against a 0.28 radius, and the
    // whole of this file still passes.
    //
    // A centre sample cannot see drift because the centre is the least sensitive point of the mask.
    // The RAMP is the sensitive part: between radius − feather and radius the value swings 1 → 0, so
    // any disagreement between the two copies shows up there as a difference in value at the same
    // point. Walking along the cap's own latitude keeps nx fixed, which keeps the lane, tide-limb and
    // bridge exclusions constant across the sweep, so the only thing that can differ is the pond.
    //
    // The two agree EXACTLY today (measured: max |difference| 0.000 across the sweep), so the
    // tolerance is tight on purpose rather than generous. This covers radius and feather drift as
    // well as centre drift, and unlike a source-text match it cannot false-alarm on a reflow.
    for (const [name, nx, theta] of [
      ['B2_FROZEN', 0.34, 5.55],
      ['B2_SHELF', 0.6, 5.72],
    ] as const) {
      for (let d = -0.55; d <= 0.55 + 1e-9; d += 0.025) {
        const [px, py, pz] = place(nx, theta + d)
        expect(
          iceFootprint(px, py, pz),
          `${name}: water-clay ICE_CAPS and biomes ${name} disagree at ${d.toFixed(3)} rad along the cap`
        ).toBeCloseTo(waterMask(px, py, pz, 1), 6)
      }
    }
  })

  it('is EXACTLY 0 at every bridge deck (centre + the full deck footprint band)', () => {
    for (const cx of ALL_X) {
      for (let dth = -0.17; dth <= 0.17 + 1e-9; dth += 0.02) {
        for (let nx = -0.12; nx <= 0.12 + 1e-9; nx += 0.03) {
          const [px, py, pz] = place(nx, cx + dth)
          expect(iceFootprint(px, py, pz)).toBe(0)
        }
      }
    }
  })

  it('is EXACTLY 0 along the girl\'s lane (nx=0) all the way round', () => {
    for (let i = 0; i < 360; i++) {
      const [px, py, pz] = place(0, (i / 360) * 2 * Math.PI)
      expect(iceFootprint(px, py, pz)).toBe(0)
    }
  })

  it('is EXACTLY 0 at and past the tide limb (|nx| ≥ TIDE_LAT_LO — the flood ring never freezes)', () => {
    for (let ni = 0; ni <= 40; ni++) {
      const nx = TIDE_LAT_LO + (0.199 * ni) / 40 // [0.80, 0.999]
      for (let ai = 0; ai < 180; ai++) {
        const [px, py, pz] = place(nx, (ai / 180) * 2 * Math.PI)
        expect(iceFootprint(px, py, pz)).toBe(0)
      }
    }
  })

  it('is EXACTLY 0 outside the winter ponds (left ocean + other-band water)', () => {
    expect(iceFootprint(-1, 0, 0)).toBe(0) // left ocean pole
    expect(iceFootprint(...place(-0.5, 5.6))).toBe(0) // winter longitude but the −x ocean side
    expect(iceFootprint(...place(0.36, 1.3))).toBe(0) // A0 spring pond region
    expect(iceFootprint(...place(0.54, 3.5))).toBe(0) // B1 shelf sea (different band)
  })

  it('is deterministic and bounded in [0,1]', () => {
    for (let i = 0; i < 500; i++) {
      const a = (i / 500) * 2 * Math.PI
      const nx = Math.cos(a) * 0.5
      const [px, py, pz] = place(nx, a * 1.7)
      const v = iceFootprint(px, py, pz)
      expect(v).toBe(iceFootprint(px, py, pz))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('iceRim — the snow-dust bank ring', () => {
  it('is 0 at a pond core and 0 outside the footprint, positive in the outer ring', () => {
    expect(iceRim(...SHELF)).toBe(0) // dead centre of the shelf
    expect(iceRim(...place(0.6 + 0.4, 5.72))).toBe(0) // outside the footprint
    // somewhere in the shelf's feathered edge the rim is positive
    let mx = 0
    for (let i = 0; i <= 40; i++) {
      const [px, py, pz] = place(0.6 - 0.02 - (0.26 * i) / 40, 5.72) // sweep out toward the rim
      mx = Math.max(mx, iceRim(px, py, pz))
    }
    expect(mx).toBeGreaterThan(0.2)
  })
})

describe('iceCrack — sparse pressed veins', () => {
  it('is deterministic, bounded [0,1] and SPARSE (most of the ice is uncracked)', () => {
    let sum = 0
    let n = 0
    let mx = 0
    for (let i = 0; i < 4000; i++) {
      const a = (i * 0.37) % (2 * Math.PI)
      const nx = Math.cos(a) * 0.5
      const [px, py, pz] = place(nx, a * 1.3)
      const v = iceCrack(px, py, pz)
      expect(v).toBe(iceCrack(px, py, pz))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      sum += v
      if (v > mx) mx = v
      n++
    }
    expect(mx).toBeGreaterThan(0) // cracks DO appear somewhere
    expect(sum / n).toBeLessThan(0.15) // but they are sparse veins, not a wash
  })
})
