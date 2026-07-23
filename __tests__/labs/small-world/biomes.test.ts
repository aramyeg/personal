import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  biomeBump,
  biomeBumpB,
  wedgeGate,
  meridianGate,
  polarLatGate,
  bandOf,
  canonicalTheta,
  meridianDist,
  seamTintWeight,
  MERIDIANS,
  tideWetness,
  tideCarve,
  TIDE_LAT_LO,
  WATER_LEVEL,
} from '@/components/labs/small-world/scene/biomes'
import {
  terrainBump,
  terrainBumpB,
  buildPal,
  paintVertex,
  PLANET_RADIUS,
} from '@/components/labs/small-world/scene/planet'
import { buildSeamTints } from '@/components/labs/small-world/scene/field-clay'
import { DIALS } from '@/components/labs/small-world/scene/tunables'

const TWO_PI = Math.PI * 2

/** Every latitude along a meridian — the seam where the four abutting scenes
 *  (band j−1 / band j, in either variant) must collapse to one shared world. */
function meridianSweep(m: number): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = []
  for (let b = -98; b <= 98; b++) {
    const nx = b / 100
    const ring = Math.sqrt(1 - nx * nx)
    pts.push([nx, ring * Math.cos(m), ring * Math.sin(m)])
  }
  return pts
}

describe('meridian seam identity (all four abutting wedges share one base)', () => {
  it('wedgeGate is EXACTLY 0 on every meridian (full latitude sweep)', () => {
    for (const m of MERIDIANS) {
      for (const [nx, ny, nz] of meridianSweep(m)) {
        expect(wedgeGate(canonicalTheta(Math.atan2(nz, ny)), nx)).toBe(0)
      }
    }
  })

  it('biomeBumpB === biomeBump EXACTLY on every meridian', () => {
    for (const m of MERIDIANS) {
      for (const [nx, ny, nz] of meridianSweep(m)) {
        expect(biomeBumpB(nx, ny, nz)).toBe(biomeBump(nx, ny, nz))
      }
    }
  })

  it('terrainBumpB === terrainBump EXACTLY on every meridian (props + girl seam)', () => {
    for (const m of MERIDIANS) {
      for (const [nx, ny, nz] of meridianSweep(m)) {
        const x = nx * PLANET_RADIUS, y = ny * PLANET_RADIUS, z = nz * PLANET_RADIUS
        expect(terrainBumpB(x, y, z)).toBe(terrainBump(x, y, z))
      }
    }
  })
})

// Round 6 + Task 25: the limbs are ASYMMETRIC — the LEFT limb (−x) is the one great
// ocean, the RIGHT limb (+x) continental coast. Task 25 makes the left-ocean
// COASTLINE evolve per lap (a different sea comes around on lap 2), but ONLY at
// mid-latitude: biomes.ts capDivGate tapers the divergence to zero by |nx| = 0.80,
// so the GRAZING limb (|nx| >= 0.8, the screen-stable silhouette) stays bit-identical
// A vs B and never pops across the flip. This exact-equality pin is therefore
// PRESERVED at the limb (0.80 is the occlusion-safe boundary L, proven by
// renewal-scan-caps.mjs) — it was NOT relaxed; the cap evolution lives below it and
// is asserted positively in the next block.
describe('the GRAZING limbs are variant-invariant (left ocean, right coast — never pop) [Task 25: coastline evolves below]', () => {
  it('biomeBumpB === biomeBump EXACTLY over both limbs (|nx| >= 0.8)', () => {
    for (let a = 0; a < 200; a++) {
      const th = (a / 200) * TWO_PI
      for (const nx of [0.82, 0.9, 0.97, -0.82, -0.9, -0.97]) {
        const ring = Math.sqrt(1 - nx * nx)
        const p: [number, number, number] = [nx, ring * Math.cos(th), ring * Math.sin(th)]
        expect(biomeBumpB(...p)).toBe(biomeBump(...p))
      }
    }
  })

  it('polarLatGate fades wedge deltas to 0 by |nx| = 0.75', () => {
    for (const nx of [-0.75, -0.63, 0, 0.63, 0.75]) {
      if (Math.abs(nx) >= 0.75) expect(polarLatGate(nx)).toBe(0)
      else expect(polarLatGate(nx)).toBeGreaterThan(0)
    }
  })
})

describe('the left-ocean coastline evolves per lap (Task 25 — caps not stone-set)', () => {
  it('biomeBumpB differs from biomeBump on the left-ocean coastline (|nx| in [0.45,0.75])', () => {
    let anyDiff = false
    let maxDiff = 0
    for (let a = 0; a < 120; a++) {
      const th = (a / 120) * TWO_PI
      for (let b = 45; b <= 75; b++) {
        const nx = -b / 100
        const ring = Math.sqrt(1 - nx * nx)
        const p: [number, number, number] = [nx, ring * Math.cos(th), ring * Math.sin(th)]
        const d = Math.abs(biomeBumpB(...p) - biomeBump(...p))
        if (d > 1e-3) anyDiff = true
        if (d > maxDiff) maxDiff = d
      }
    }
    expect(anyDiff).toBe(true)
    // a real moved coastline (headland↔bay), not float noise
    expect(maxDiff).toBeGreaterThan(0.02)
  })
})

// Round 7 (the flood arc): the grazing right limb (|nx| ≥ TIDE_LAT_LO) is wetted by a
// CONTINUOUS tide — a monotone function of unwrapped rotation ∈ [0, 4π]. It is a
// separate render/sample-time term (NOT in the A/B bakes), so the discrete-bake
// invariants above are untouched; here we pin the tide's own contract.
describe('the overflow tide (Round 7 — right limb wets continuously)', () => {
  const ROTATION_TOTAL = Math.PI * 4
  const rightCap = (nx: number, az: number): [number, number, number] => {
    const ring = Math.sqrt(1 - nx * nx)
    return [nx, ring * Math.cos(az), ring * Math.sin(az)]
  }

  it('is 0 across the whole left hemisphere and the lane (nx ≤ TIDE_LAT_LO), every rotation', () => {
    for (let ri = 0; ri <= 40; ri++) {
      const rot = (ri / 40) * ROTATION_TOTAL
      for (const nx of [-0.95, -0.85, -0.5, 0, 0.5, 0.79, TIDE_LAT_LO]) {
        for (const az of [0.3, 1.7, 3.1, 4.9]) {
          expect(tideWetness(...rightCap(nx, az), rot)).toBe(0)
          expect(Math.abs(tideCarve(...rightCap(nx, az), rot))).toBe(0)
        }
      }
    }
  })

  it('is monotone non-decreasing in rotation at every right-cap point (dry → wet once)', () => {
    for (const nx of [0.82, 0.88, 0.94]) {
      for (const az of [0.4, 2.2, 4.5]) {
        let prev = -1
        for (let ri = 0; ri <= 400; ri++) {
          const w = tideWetness(...rightCap(nx, az), (ri / 400) * ROTATION_TOTAL)
          expect(w).toBeGreaterThanOrEqual(prev - 1e-12)
          prev = w
        }
      }
    }
  })

  it('leaves the right limb dry at journey start and wet at journey end', () => {
    for (const nx of [0.82, 0.88, 0.94]) {
      for (const az of [0.4, 2.2, 4.5]) {
        expect(tideWetness(...rightCap(nx, az), 0)).toBe(0)
        // by journey's end the shoreline has swept past → carve submerges the coast
        expect(tideWetness(...rightCap(nx, az), ROTATION_TOTAL)).toBeGreaterThan(0.5)
        expect(tideCarve(...rightCap(nx, az), ROTATION_TOTAL)).toBeLessThan(-(1 - WATER_LEVEL))
      }
    }
  })
})

describe('the six wedges genuinely differ (renewal is not a no-op)', () => {
  it('each band interior morphs A -> B somewhere off the lane', () => {
    for (let band = 0 as 0 | 1 | 2; band <= 2; band = (band + 1) as 0 | 1 | 2) {
      let anyDifferent = false
      const center = MERIDIANS[band] + Math.PI / 3 // band interior
      for (let k = 0; k < 40; k++) {
        const nx = -0.55 + (1.1 * k) / 40
        const ring = Math.sqrt(1 - nx * nx)
        const ny = ring * Math.cos(center), nz = ring * Math.sin(center)
        if (biomeBumpB(nx, ny, nz) !== biomeBump(nx, ny, nz)) anyDifferent = true
      }
      expect(anyDifferent).toBe(true)
    }
  })

  it('meridianGate reaches 1 in every band interior', () => {
    for (const m of MERIDIANS) {
      expect(meridianGate(m + Math.PI / 3)).toBeCloseTo(1, 10)
      expect(meridianGate(m)).toBe(0)
    }
  })

  it('bandOf partitions the circle into 3 contiguous bands', () => {
    expect(bandOf(MERIDIANS[0] + 0.5)).toBe(0)
    expect(bandOf(MERIDIANS[1] + 0.5)).toBe(1)
    expect(bandOf(MERIDIANS[2] + 0.5)).toBe(2)
  })
})

// Task 36 — the de-greened seam tint replaces the base countryside green that showed
// through where the wedge accent collapses at a meridian. The INVIOLABLE constraint is
// the renewal identity: on each meridian the A and B variants' PAINT must be EXACTLY
// identical (the m0 wrap-identity strip flips variant while the near-side seam is on
// camera). The seam tint is a pure function of position (per-meridian fixed colour,
// never variant), so this must hold at every mix — including the fully-bridged extreme.
describe('Task 36 — seam de-green paint is EXACTLY variant-invariant', () => {
  const pal = buildPal()
  const paint = (
    nx: number, ny: number, nz: number, bump: number, isB: boolean, seams: readonly THREE.Color[]
  ): THREE.Color => {
    const c = new THREE.Color()
    paintVertex(c, pal, nx, ny, nz, bump, isB, seams)
    return c
  }

  it('paintVertex is BIT-EXACT identical for variant A and B ON every meridian (the wrap-identity strip), at all mixes', () => {
    // The inviolable pin: on the meridian itself (meridianDist = 0) the near-side seam is
    // on camera when the girl flips variant at rotation = 2π, so paint MUST be exactly
    // equal. The substrate (0), shipped default (0.4) and full bridge (1) — all exact,
    // because the seam tint (and the now seam-faded beach wedge tint) never depend on the
    // variant, and biomeBump/base green coincide on the meridian.
    for (const mix of [0, 0.4, 1]) {
      const seams = buildSeamTints(pal, mix)
      for (const m of MERIDIANS) {
        for (let bi = -90; bi <= 90; bi += 2) {
          const nx = bi / 100
          const ring = Math.sqrt(1 - nx * nx)
          const ny = ring * Math.cos(m)
          const nz = ring * Math.sin(m)
          const bumpA = terrainBump(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
          const bumpB = terrainBumpB(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
          const a = paint(nx, ny, nz, bumpA, false, seams)
          const b = paint(nx, ny, nz, bumpB, true, seams)
          expect(b.r).toBe(a.r)
          expect(b.g).toBe(a.g)
          expect(b.b).toBe(a.b)
        }
      }
    }
  })

  it('paintVertex is variant-invariant to floating point across the whole seam band (meridianDist < 0.05), at all mixes', () => {
    // Across the wider seam band the only residual A/B difference is the pre-existing
    // finite-difference crease/signature stencil grazing the wedge buffer at the extreme
    // corner (≈8.5e-7 — over 4000× below 8-bit colour quantization, and it flips inside
    // the occlusion-proven hidden window regardless). The seam tint itself is a pure
    // function of position, so it adds ZERO new variant dependence.
    const EPS = 1e-6
    for (const mix of [0, 0.4, 1]) {
      const seams = buildSeamTints(pal, mix)
      for (const m of MERIDIANS) {
        for (const off of [-0.048, -0.02, 0.02, 0.048]) {
          const th = m + off
          for (let bi = -70; bi <= 70; bi += 5) {
            const nx = bi / 100
            const ring = Math.sqrt(1 - nx * nx)
            const ny = ring * Math.cos(th)
            const nz = ring * Math.sin(th)
            expect(meridianDist(canonicalTheta(Math.atan2(nz, ny)))).toBeLessThan(0.05)
            const bumpA = terrainBump(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
            const bumpB = terrainBumpB(nx * PLANET_RADIUS, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
            const a = paint(nx, ny, nz, bumpA, false, seams)
            const b = paint(nx, ny, nz, bumpB, true, seams)
            expect(Math.abs(b.r - a.r)).toBeLessThan(EPS)
            expect(Math.abs(b.g - a.g)).toBeLessThan(EPS)
            expect(Math.abs(b.b - a.b)).toBeLessThan(EPS)
          }
        }
      }
    }
  })

  it('seamTintWeight is full on the meridian and zero in the band interior (colorGate seam shape, band not widened)', () => {
    for (const m of MERIDIANS) {
      expect(seamTintWeight(m)).toBe(1)
      expect(seamTintWeight(m + Math.PI / 3)).toBe(0)
    }
  })

  it('the shipped default de-greens the meridian lane seam to a warm clay read (green no longer dominant)', () => {
    const seams = buildSeamTints(pal, DIALS.seamBridgeMix.default)
    for (const m of MERIDIANS) {
      // nx = 0 lane point exactly on the meridian: dry meadow (crossings are >=0.25 rad
      // away, ocean is at the limbs), so the default branch + seam tint own this pixel.
      const ny = Math.cos(m)
      const nz = Math.sin(m)
      const bump = terrainBump(0, ny * PLANET_RADIUS, nz * PLANET_RADIUS)
      const c = paint(0, ny, nz, bump, false, seams)
      const greenDominant = c.g > c.r * 1.02 && c.g > c.b * 1.02
      expect(greenDominant).toBe(false)
      expect(c.r).toBeGreaterThan(c.g)
    }
  })
})
