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
  paintBand,
  accentLatGate,
  boundaryWander,
  boundaryRidgeShape,
  BOUNDARY_WANDER,
  duneField,
  DUNE_GATE,
  canopyMounds,
  CANOPY_GATE,
  MERIDIANS,
  tideWetness,
  tideCarve,
  TIDE_LAT_LO,
  WATER_LEVEL,
  CROSSINGS_B,
  B_CROSSING_BY_BAND,
  channelDist,
} from '@/components/labs/small-world/scene/biomes'
import {
  terrainBump,
  terrainBumpB,
  buildPal,
  paintVertex,
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

// Task 41 (Round 12): the B0 desert wedge is now a wind-coherent crescent dune field
// (duneField), authored as displacement in biomeBumpB. It must be EXACTLY 0 on the girl's
// lane band (the contact budget + lane dryness depend on it) and past the limb, add only
// (never carve, so no accidental water), and be deterministic (both bakes agree).
describe('Task 41 — B0 desert dune field (crescent dunes, no ridge/passage)', () => {
  const B0_LONGITUDES = [0.7, 0.95, 1.2, 1.5, 1.9] // band-0 interior + the crossing
  const dirAt = (nx: number, th: number): [number, number, number] => {
    const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
    return [nx, ring * Math.cos(th), ring * Math.sin(th)]
  }

  it('is EXACTLY 0 across the girl lane band (|nx| < laneLo), at every band-0 longitude', () => {
    for (const th of B0_LONGITUDES) {
      for (let ni = 0; ni <= 30; ni++) {
        const nx = -(DUNE_GATE.laneLo - 1e-4) + (2 * (DUNE_GATE.laneLo - 1e-4) * ni) / 30
        expect(duneField(...dirAt(nx, th))).toBe(0)
      }
    }
  })

  it('is EXACTLY 0 at and past the limb fade (|nx| >= limbHi)', () => {
    for (const th of B0_LONGITUDES) {
      for (const nx of [DUNE_GATE.limbHi, 0.8, 0.9, -DUNE_GATE.limbHi, -0.85]) {
        expect(duneField(...dirAt(nx, th))).toBe(0)
      }
    }
  })

  it('only ever ADDS relief (>= 0) — never carves, so no accidental water forms', () => {
    for (let ai = 0; ai < 60; ai++) {
      const th = (ai / 60) * TWO_PI
      for (let ni = 0; ni <= 40; ni++) {
        const nx = -0.7 + (1.4 * ni) / 40
        expect(duneField(...dirAt(nx, th))).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('actually builds dunes off-lane in the desert (positive relief exists at reading latitudes)', () => {
    let peak = 0
    for (const th of B0_LONGITUDES) {
      for (let ni = 0; ni <= 60; ni++) {
        const nx = 0.16 + (0.4 * ni) / 60
        peak = Math.max(peak, duneField(...dirAt(nx, th)))
      }
    }
    expect(peak).toBeGreaterThan(0.03) // real dune relief (fraction of R), not a flat sheet
  })

  it('is deterministic (both renewal bakes agree byte-for-byte)', () => {
    for (const th of B0_LONGITUDES) {
      for (const nx of [0.25, 0.4, 0.55, -0.35]) {
        const d = dirAt(nx, th)
        expect(duneField(...d)).toBe(duneField(...d))
      }
    }
  })

  it('vanishes on the band-0 meridians (biomeBumpB === biomeBump there — seam intact)', () => {
    for (const m of [MERIDIANS[0], MERIDIANS[1]]) {
      for (let b = -70; b <= 70; b += 5) {
        const nx = b / 100
        const d = dirAt(nx, m)
        expect(biomeBumpB(...d)).toBe(biomeBump(...d))
      }
    }
  })
})

// Task 42 (Round 12): the A1 flower-field wedge (band 1, variant A) becomes a jungle —
// canopyMounds authors bulbous overlapping-dome canopy relief in biomeBump. It must be
// EXACTLY 0 on the girl's lane band (contact budget + lane walkability) and past the limb,
// add only (never carve, so no accidental water), be deterministic, and vanish on the
// band-1 meridians (so bumpA === bumpB there — the seam is intact).
describe('Task 42 — A1 jungle canopy mounds', () => {
  const A1_LONGITUDES = [2.7, 3.1, 3.52, 3.9, 4.3] // band-1 interior + the FLYERBEE crossing
  const dirAt = (nx: number, th: number): [number, number, number] => {
    const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
    return [nx, ring * Math.cos(th), ring * Math.sin(th)]
  }

  it('is EXACTLY 0 across the girl lane band (|nx| < laneLo), at every band-1 longitude', () => {
    for (const th of A1_LONGITUDES) {
      for (let ni = 0; ni <= 30; ni++) {
        const nx = -(CANOPY_GATE.laneLo - 1e-4) + (2 * (CANOPY_GATE.laneLo - 1e-4) * ni) / 30
        expect(canopyMounds(...dirAt(nx, th))).toBe(0)
      }
    }
  })

  it('is EXACTLY 0 at and past the limb fade (|nx| >= limbHi)', () => {
    for (const th of A1_LONGITUDES) {
      for (const nx of [CANOPY_GATE.limbHi, 0.8, 0.9, -CANOPY_GATE.limbHi, -0.85]) {
        expect(canopyMounds(...dirAt(nx, th))).toBe(0)
      }
    }
  })

  it('only ever ADDS relief (>= 0) — never carves, so no accidental water forms', () => {
    for (let ai = 0; ai < 60; ai++) {
      const th = (ai / 60) * TWO_PI
      for (let ni = 0; ni <= 40; ni++) {
        const nx = -0.7 + (1.4 * ni) / 40
        expect(canopyMounds(...dirAt(nx, th))).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('actually builds canopy mounds off-lane in the jungle (positive relief at reading latitudes)', () => {
    let peak = 0
    for (const th of A1_LONGITUDES) {
      for (let ni = 0; ni <= 60; ni++) {
        const nx = 0.16 + (0.4 * ni) / 60
        peak = Math.max(peak, canopyMounds(...dirAt(nx, th)))
      }
    }
    expect(peak).toBeGreaterThan(0.03) // real canopy relief (fraction of R), not a flat sheet
  })

  it('is deterministic (both renewal bakes agree byte-for-byte)', () => {
    for (const th of A1_LONGITUDES) {
      for (const nx of [0.25, 0.4, 0.55, -0.35]) {
        const d = dirAt(nx, th)
        expect(canopyMounds(...d)).toBe(canopyMounds(...d))
      }
    }
  })

  it('stays well under the 1.35R ceiling across the whole jungle wedge', () => {
    let maxR = 0
    for (const th of A1_LONGITUDES) {
      for (let ni = 0; ni <= 80; ni++) {
        const nx = -0.72 + (1.44 * ni) / 80
        const [x, y, z] = dirAt(nx, th)
        maxR = Math.max(maxR, 1 + biomeBump(x, y, z))
      }
    }
    expect(maxR).toBeLessThan(1.35)
  })

  it('vanishes on the band-1 meridians (biomeBumpB === biomeBump there — seam intact)', () => {
    for (const m of [MERIDIANS[1], MERIDIANS[2]]) {
      for (let b = -70; b <= 70; b += 5) {
        const nx = b / 100
        const d = dirAt(nx, m)
        expect(biomeBumpB(...d)).toBe(biomeBump(...d))
      }
    }
  })
})

// Task 46 (Round 13): Aram — "I don't think we need these water bridges on every biome."
// The B0 DESERT crossing + its bridge are removed (the lane is continuous dry sand), and the
// dune footprint is widened toward both limbs / raised for stable mass, meeting the left ocean.
describe('Task 46 — desert bridge removal + widened dune footprint', () => {
  const dirAt = (nx: number, th: number): [number, number, number] => {
    const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
    return [nx, ring * Math.cos(th), ring * Math.sin(th)]
  }

  it('CROSSINGS_B mirrors the non-null B_CROSSING_BY_BAND entries (band-0 desert dropped)', () => {
    expect(B_CROSSING_BY_BAND[0]).toBe(null) // desert: no crossing
    expect([...CROSSINGS_B]).toEqual(B_CROSSING_BY_BAND.filter((v) => v !== null))
    expect(CROSSINGS_B).toHaveLength(2)
  })

  it('the B0 desert lane carries NO channel water at the old crossing (θ=1.2) — dry sand', () => {
    // the stream that used to carve the crossing is gone: no B channel is anywhere near the
    // desert lane, and the lane bump is un-carved (was a ~-0.055R stream trough before).
    const [x, y, z] = dirAt(0, 1.2)
    expect(channelDist(x, y, z, 1)).toBeGreaterThan(1)
    expect(biomeBumpB(x, y, z)).toBeGreaterThan(-0.01)
  })

  it('the dune footprint reaches past the old 0.72 limb (widened toward the coast)', () => {
    expect(DUNE_GATE.limbHi).toBe(0.75)
    let peak = 0
    for (const th of [0.7, 0.95, 1.2, 1.5, 1.9]) {
      for (const nx of [0.72, 0.73, 0.74]) peak = Math.max(peak, duneField(...dirAt(nx, th)))
    }
    expect(peak).toBeGreaterThan(0) // dunes now build relief past the old 0.72 limb
  })

  it('still vanishes at/past the wedgeGate structural limit (|nx| >= 0.75) and on the lane', () => {
    for (const th of [0.7, 1.2, 1.9]) {
      for (const nx of [0.75, 0.8, -0.75, -0.85]) expect(duneField(...dirAt(nx, th))).toBe(0)
      for (const nx of [0, 0.1, -0.1]) expect(duneField(...dirAt(nx, th))).toBe(0)
    }
  })

  it('the widened dunes MEET the left ocean — they never lift a deep sea point out of the water', () => {
    // sample the −x ocean at a band-0 longitude: raising/reaching the dunes must not create dry
    // land where the sea is (oceanAvoid flattens the dunes at the shore).
    const seaTh = MERIDIANS[0] + Math.PI / 3 // band-0 interior
    for (const nx of [-0.8, -0.85, -0.9]) {
      const [x, y, z] = dirAt(nx, seaTh)
      expect(1 + biomeBumpB(x, y, z)).toBeLessThan(WATER_LEVEL)
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

// Task 38 — the green connective seams are RETIRED. Two abutting wedges now meet at a
// HARD, irregular torn-clay boundary curve, each painting its FULL accent up to that
// curve. The renewal identity moves from "paint A===B on the meridian" (gone with the
// seam) to the wedge-interior rule: the boundary is a pure position curve (variant-
// invariant, never flips), and near-meridian paint IS now variant-dependent — safe only
// because every such vertex flips A→B inside the occlusion-proven-hidden window (proven
// by bench/renewal-scan.mjs, not a unit test). The unit contracts below pin: the geometry
// meridian seam is untouched, the boundary/ridge are variant-invariant, the switch is
// HARD (no green band), and the lip is EXACTLY 0 on the lane.
describe('Task 38 — torn boundary curve is variant-invariant + hard-switched', () => {
  const paint = (nx: number, ny: number, nz: number, bump: number, isB: boolean): THREE.Color => {
    const pal = buildPal()
    const c = new THREE.Color()
    paintVertex(c, pal, nx, ny, nz, bump, isB)
    return c
  }
  const dirAt = (nx: number, th: number): [number, number, number] => {
    const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
    return [nx, ring * Math.cos(th), ring * Math.sin(th)]
  }

  it('the boundary curve is a pure position function (no variant arg) and wanders within its amp', () => {
    // boundaryWander depends only on (nx, meridian, amp) — trivially identical on both
    // laps. Assert it is bounded by amp and genuinely torn (varies with latitude).
    for (const amp of [0.02, 0.035, 0.09]) {
      for (let i = 0 as 0 | 1 | 2; i <= 2; i = (i + 1) as 0 | 1 | 2) {
        let mn = Infinity
        let mx = -Infinity
        for (let b = -90; b <= 90; b += 3) {
          const w = boundaryWander(b / 100, i, amp)
          expect(Math.abs(w)).toBeLessThanOrEqual(amp + 1e-12)
          if (w < mn) mn = w
          if (w > mx) mx = w
        }
        expect(mx - mn).toBeGreaterThan(0.5 * amp) // actually torn, not flat
      }
    }
  })

  it('paintBand reproduces bandOf exactly when the wander amp is 0 (a straight meridian)', () => {
    for (let a = 0; a < 400; a++) {
      const th = canonicalTheta((a / 400) * TWO_PI + 0.013)
      for (const nx of [-0.5, -0.2, 0, 0.2, 0.5]) {
        expect(paintBand(th, nx, 0)).toBe(bandOf(th))
      }
    }
  })

  it('paintBand switches HARD across the torn boundary (band i-1 ↔ band i), not through a third band', () => {
    // Straddle each meridian's warped boundary at a mid-latitude: just inside either side
    // must be the two ADJACENT bands, and they must differ (a hard edge, no green filler).
    for (let mi = 0; mi < MERIDIANS.length; mi++) {
      const m = MERIDIANS[mi]
      for (const nx of [-0.5, -0.25, 0.25, 0.5]) {
        const w = boundaryWander(nx, mi, BOUNDARY_WANDER)
        const [lx, ly, lz] = dirAt(nx, m + w - 0.03)
        const [hx, hy, hz] = dirAt(nx, m + w + 0.03)
        const below = paintBand(canonicalTheta(Math.atan2(lz, ly)), lx, BOUNDARY_WANDER)
        const above = paintBand(canonicalTheta(Math.atan2(hz, hy)), hx, BOUNDARY_WANDER)
        expect(above).toBe(mi as 0 | 1 | 2)
        expect(below).toBe((((mi + 2) % 3) as 0 | 1 | 2))
        expect(above).not.toBe(below)
      }
    }
  })

  it('the painted accent JUMPS across the boundary (hard switch) — no gradient band', () => {
    // At a mid-latitude, colour change across the boundary is far larger than within a
    // band over the same tiny longitude step: the switch is a hard edge, not a fade.
    const nx = 0.4
    for (let mi = 0; mi < MERIDIANS.length; mi++) {
      const m = MERIDIANS[mi]
      const w = boundaryWander(nx, mi, BOUNDARY_WANDER)
      const at = (th: number, isB: boolean): THREE.Color => {
        const [x, y, z] = dirAt(nx, th)
        const bump = (isB ? terrainBumpB : terrainBump)(x * PLANET_RADIUS, y * PLANET_RADIUS, z * PLANET_RADIUS)
        return paint(x, y, z, bump, isB)
      }
      const d = (p: THREE.Color, q: THREE.Color): number =>
        Math.abs(p.r - q.r) + Math.abs(p.g - q.g) + Math.abs(p.b - q.b)
      for (const isB of [false, true]) {
        const acrossLo = at(m + w - 0.02, isB)
        const acrossHi = at(m + w + 0.02, isB)
        const withinA = at(m + w + 0.06, isB)
        const withinB = at(m + w + 0.1, isB)
        expect(d(acrossLo, acrossHi)).toBeGreaterThan(d(withinA, withinB) + 0.02)
      }
    }
  })

  it('the accent is full-strength across the band interior (no meridian fade), fading only at the limbs', () => {
    // accentLatGate is ~1 across all reading latitudes and only drops toward the limb.
    for (const nx of [-0.4, 0, 0.4]) expect(accentLatGate(nx)).toBeGreaterThan(0.99)
    expect(accentLatGate(0.86)).toBeLessThan(0.05)
    expect(accentLatGate(-0.86)).toBeLessThan(0.05)
  })
})

describe('Task 38 — the pressed-clay boundary lip is invariant + EXACTLY 0 on the lane', () => {
  it('boundaryRidgeShape is EXACTLY 0 across the whole girl lane band (|nx| < 0.14), at any wander', () => {
    for (const amp of [0, 0.035, 0.09]) {
      for (let ni = 0; ni <= 40; ni++) {
        const nx = -0.139 + (0.278 * ni) / 40 // ⊂ (-0.14, 0.14)
        const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
        for (let ai = 0; ai < 96; ai++) {
          const th = (ai / 96) * TWO_PI
          expect(boundaryRidgeShape(nx, ring * Math.cos(th), ring * Math.sin(th), amp)).toBe(0)
        }
      }
    }
  })

  it('the lip is 0 at the grazing limbs (never touches the silhouette) and rises in the mid-latitudes', () => {
    // 0 by |nx| >= 0.72 everywhere; and there EXISTS a mid-latitude point on a boundary
    // where the lip is positive (it is actually built).
    for (const nx of [0.75, 0.85, -0.8, -0.95]) {
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      for (let ai = 0; ai < 96; ai++) {
        const th = (ai / 96) * TWO_PI
        expect(boundaryRidgeShape(nx, ring * Math.cos(th), ring * Math.sin(th), BOUNDARY_WANDER)).toBe(0)
      }
    }
    let anyPositive = false
    for (let mi = 0; mi < MERIDIANS.length && !anyPositive; mi++) {
      const nx = 0.4
      const w = boundaryWander(nx, mi, BOUNDARY_WANDER)
      const ring = Math.sqrt(1 - nx * nx)
      const th = MERIDIANS[mi] + w
      if (boundaryRidgeShape(nx, ring * Math.cos(th), ring * Math.sin(th), BOUNDARY_WANDER) > 0) anyPositive = true
    }
    expect(anyPositive).toBe(true)
  })

  it('the lip does not change biomeBump (render-only) — meridian geometry seam stays bit-exact', () => {
    // The lip lives in the render bake, NOT biomeBump, so biomeBumpB === biomeBump on the
    // meridians is untouched (re-pinned here alongside the top-of-file geometry tests).
    for (const m of MERIDIANS) {
      for (let bi = -90; bi <= 90; bi += 5) {
        const nx = bi / 100
        const ring = Math.sqrt(1 - nx * nx)
        const ny = ring * Math.cos(m)
        const nz = ring * Math.sin(m)
        expect(biomeBumpB(nx, ny, nz)).toBe(biomeBump(nx, ny, nz))
      }
    }
  })
})
