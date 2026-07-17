import { describe, expect, it } from 'vitest'
import {
  biomeBump,
  biomeBumpB,
  spineGate,
  SNOW,
  SNOW_B,
} from '@/components/labs/small-world/scene/biomes'
import {
  terrainBump,
  terrainBumpB,
  PLANET_RADIUS,
} from '@/components/labs/small-world/scene/planet'

/** A dense grid over the spine band (|nx| < 0.45) × full azimuth. Chapter props
 *  and the girl's lane all live here, so this is the region that must be
 *  bit-identical across laps. */
function spineGrid(): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = []
  for (let a = 0; a < 40; a++) {
    const theta = (a / 40) * Math.PI * 2
    // nx from -0.44 to 0.44 (strictly inside the 0.45 gate)
    for (let b = 0; b <= 22; b++) {
      const nx = -0.44 + (0.88 * b) / 22
      const ring = Math.sqrt(1 - nx * nx)
      pts.push([nx, ring * Math.cos(theta), ring * Math.sin(theta)])
    }
  }
  return pts
}

describe('spine-identity gate (the world never morphs on the lane)', () => {
  it('spineGate is exactly 0 for |nx| <= 0.45 and positive beyond', () => {
    for (const nx of [-0.45, -0.3, 0, 0.2, 0.44, 0.45]) {
      expect(spineGate(nx)).toBe(0)
    }
    expect(spineGate(0.5)).toBeGreaterThan(0)
    expect(spineGate(0.55)).toBeCloseTo(1, 10)
    expect(spineGate(0.9)).toBe(1)
  })

  it('biomeBumpB === biomeBump EXACTLY across the spine band', () => {
    for (const [nx, ny, nz] of spineGrid()) {
      expect(biomeBumpB(nx, ny, nz)).toBe(biomeBump(nx, ny, nz))
    }
  })

  it('terrainBumpB === terrainBump EXACTLY across the spine band', () => {
    for (const [nx, ny, nz] of spineGrid()) {
      const x = nx * PLANET_RADIUS
      const y = ny * PLANET_RADIUS
      const z = nz * PLANET_RADIUS
      expect(terrainBumpB(x, y, z)).toBe(terrainBump(x, y, z))
    }
  })

  it('DOES morph the flanks (proves the delta is real, not a no-op)', () => {
    // sample the mountain range longitude on the flank (|nx| well past the gate)
    let anyDifferent = false
    for (let a = 0; a < 60; a++) {
      const theta = (a / 60) * Math.PI * 2
      const nx = -0.68
      const ring = Math.sqrt(1 - nx * nx)
      const ny = ring * Math.cos(theta)
      const nz = ring * Math.sin(theta)
      if (biomeBumpB(nx, ny, nz) !== biomeBump(nx, ny, nz)) anyDifferent = true
    }
    expect(anyDifferent).toBe(true)
  })
})

describe('lap-2 snow cap', () => {
  it('SNOW_B is the SNOW cap grown ~0.15 rad, same centre', () => {
    expect(SNOW_B.dir).toBe(SNOW.dir)
    expect(SNOW_B.radius).toBeCloseTo(SNOW.radius + 0.15, 10)
  })
})
