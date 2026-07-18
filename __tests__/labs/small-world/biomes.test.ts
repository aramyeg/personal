import { describe, expect, it } from 'vitest'
import {
  biomeBump,
  biomeBumpB,
  wedgeGate,
  meridianGate,
  polarLatGate,
  bandOf,
  canonicalTheta,
  MERIDIANS,
} from '@/components/labs/small-world/scene/biomes'
import {
  terrainBump,
  terrainBumpB,
  PLANET_RADIUS,
} from '@/components/labs/small-world/scene/planet'

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
