import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PALETTE } from '@/components/labs/small-world/palette'
import { fieldDents, terrainStreak, applyFieldMottle, type Pal } from '@/components/labs/small-world/scene/field-clay'
import { DIALS, resetDials, setDial } from '@/components/labs/small-world/scene/tunables'

// fieldDents reads the LIVE DIALS.dentDepth.value, so restore defaults after each test.
afterEach(() => resetDials())

describe('fieldDents — off-lane press-dents, EXACTLY 0 on the spine band', () => {
  it('is 0 across the spine band at ANY depth (the |nx|<0.14 lane gate, at the NEW max)', () => {
    // Round-9 widened the depth dial max to 0.10. The spine contact budget must survive:
    // fieldDents must return EXACTLY 0 for |nx| < 0.14 regardless of dial depth, so it adds
    // no spine-band render term. Prove it at the slider maximum (worst case).
    setDial('dentDepth', DIALS.dentDepth.max)
    expect(DIALS.dentDepth.value).toBe(0.1)
    for (let ni = 0; ni <= 40; ni++) {
      const nx = -0.13 + (0.26 * ni) / 40 // spine band [-0.13, 0.13] ⊂ (-0.14, 0.14)
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      for (let ai = 0; ai < 128; ai++) {
        const th = (ai / 128) * Math.PI * 2
        const ny = ring * Math.cos(th)
        const nz = ring * Math.sin(th)
        // a range of local relief values (dents also fade out as bump rises)
        for (const bump of [0, 0.03, 0.08, 0.15]) {
          expect(fieldDents(nx, ny, nz, bump)).toBe(0)
        }
      }
    }
  })

  it('never adds radius (inward-only) and is bounded by the live depth off the lane', () => {
    setDial('dentDepth', DIALS.dentDepth.max)
    let maxAbs = 0
    for (let ni = 0; ni <= 60; ni++) {
      const nx = -1 + (2 * ni) / 60
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      for (let ai = 0; ai < 128; ai++) {
        const th = (ai / 128) * Math.PI * 2
        const d = fieldDents(nx, ring * Math.cos(th), ring * Math.sin(th), 0) // open ground
        expect(d).toBeLessThanOrEqual(0) // inward-only, never a positive (outward) term
        if (-d > maxAbs) maxAbs = -d
      }
    }
    // magnitude bounded by depth · (dentA + 0.6·dentB ≤ 1.6 clamped to 1) · gates ≤ depth
    expect(maxAbs).toBeLessThanOrEqual(DIALS.dentDepth.max + 1e-9)
  })
})

const flowUnit = (nx: number, ny: number, nz: number): [number, number, number] => {
  // an arbitrary surface tangent at (nx,ny,nz): normalize(n × up), x-axis fallback.
  let tx = -nz
  let tz = nx
  const l = Math.hypot(tx, tz)
  if (l < 1e-6) return [0, 0, 0]
  return [tx / l, 0, tz / l]
}

describe('terrainStreak — the flow-aligned land streak field', () => {
  it('is deterministic and bounded in [0,1]', () => {
    let mn = 1
    let mx = 0
    for (let i = 0; i < 5000; i++) {
      const a = (i * 0.7) % 6.283
      const nx = Math.cos(a) * 0.5
      const ring = Math.sqrt(1 - nx * nx)
      const ny = ring * Math.cos(a * 1.7)
      const nz = ring * Math.sin(a * 1.7)
      const f = flowUnit(nx, ny, nz)
      const s = terrainStreak(nx, ny, nz, f, 0.6)
      expect(terrainStreak(nx, ny, nz, f, 0.6)).toBe(s)
      if (s < mn) mn = s
      if (s > mx) mx = s
    }
    expect(mn).toBeGreaterThanOrEqual(0)
    expect(mx).toBeLessThanOrEqual(1)
  })

  it('a degenerate [0,0,0] flow is still valid (isotropic, no NaN)', () => {
    const s = terrainStreak(0.3, 0.6, 0.4, [0, 0, 0], 0.6)
    expect(Number.isFinite(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(1)
  })

  it('flow alignment elongates the field ALONG the flow (slower variation than across)', () => {
    const eps = 0.06
    let along = 0
    let across = 0
    let n = 0
    for (let i = 0; i < 1500; i++) {
      const a = (i / 1500) * 6.283
      const nx = Math.cos(a) * 0.4
      const ring = Math.sqrt(1 - nx * nx)
      const ny = ring * Math.cos(a * 1.7)
      const nz = ring * Math.sin(a * 1.7)
      const [fx, fy, fz] = flowUnit(nx, ny, nz)
      if (fx === 0 && fy === 0 && fz === 0) continue
      // across = f × n (the other surface tangent)
      const gx = fy * nz - fz * ny
      const gy = fz * nx - fx * nz
      const gz = fx * ny - fy * nx
      const gl = Math.hypot(gx, gy, gz) || 1
      const s0 = terrainStreak(nx, ny, nz, [fx, fy, fz], 1)
      const sA = terrainStreak(nx + eps * fx, ny + eps * fy, nz + eps * fz, [fx, fy, fz], 1)
      const sC = terrainStreak(nx + (eps * gx) / gl, ny + (eps * gy) / gl, nz + (eps * gz) / gl, [fx, fy, fz], 1)
      along += Math.abs(sA - s0)
      across += Math.abs(sC - s0)
      n++
    }
    // NOTE: the domain warp adds isotropic marbling; on the mechanism the along-flow
    // variation is still measurably slower than across-flow.
    expect(along / n).toBeLessThan(across / n)
  })
})

const buildPal = (): Pal => ({
  leaf: new THREE.Color(PALETTE.leaf), meadow: new THREE.Color(PALETTE.meadow),
  sprout: new THREE.Color(PALETTE.sprout), clay: new THREE.Color(PALETTE.clayPath),
  deep: new THREE.Color(PALETTE.riverDeep), honey: new THREE.Color(PALETTE.honey),
  snow: new THREE.Color(PALETTE.snow), earth: new THREE.Color(PALETTE.earth),
  pine: new THREE.Color(PALETTE.pine), dune: new THREE.Color(PALETTE.dune),
  blossom: new THREE.Color(PALETTE.blossom), blossomDeep: new THREE.Color(PALETTE.blossomDeep),
  springGreen: new THREE.Color(PALETTE.springGreen), petal: new THREE.Color(PALETTE.petal),
  sand: new THREE.Color(PALETTE.sand), goldSand: new THREE.Color(PALETTE.goldSand),
  earthDeep: new THREE.Color(PALETTE.earthDeep), rust: new THREE.Color(PALETTE.rust),
  ice: new THREE.Color(PALETTE.ice), tuff: new THREE.Color(PALETTE.tuff),
  foliageDeep: new THREE.Color(PALETTE.foliageDeep), pineDeep: new THREE.Color(PALETTE.pineDeep),
  meadowDry: new THREE.Color(PALETTE.meadowDry),
})

describe('applyFieldMottle flow streak — lane feathering + disable', () => {
  afterEach(() => resetDials())

  it('never streaks the girl lane band (|nx| < 0.14) even with a strong flow', () => {
    // Compare a mottle pass WITHOUT flow to one WITH a strong flow on the spine band: the
    // lane feather is exactly 0 there, so the two must agree bit-for-bit (no flow streak).
    for (let ni = 0; ni <= 20; ni++) {
      const nx = -0.13 + (0.26 * ni) / 20
      const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
      const ny = ring * Math.cos(1.1 + ni)
      const nz = ring * Math.sin(1.1 + ni)
      const flow = flowUnit(nx, ny, nz)
      const base = buildPal()
      const noFlow = new THREE.Color(PALETTE.meadow)
      const withFlow = new THREE.Color(PALETTE.meadow)
      applyFieldMottle(noFlow, base, 'meadow', nx, ny, nz, [0, 0, 0])
      applyFieldMottle(withFlow, base, 'meadow', nx, ny, nz, flow)
      expect(withFlow.r).toBeCloseTo(noFlow.r, 12)
      expect(withFlow.g).toBeCloseTo(noFlow.g, 12)
      expect(withFlow.b).toBeCloseTo(noFlow.b, 12)
    }
  })

  it('with terrainFlowAlign = 0 the flow streak is a no-op off the lane', () => {
    setDial('terrainFlowAlign', 0)
    const nx = 0.4, ny = 0.7, nz = 0.6 // off-lane
    const flow = flowUnit(nx, ny, nz)
    const off = new THREE.Color(PALETTE.meadow)
    const on = new THREE.Color(PALETTE.meadow)
    applyFieldMottle(off, buildPal(), 'meadow', nx, ny, nz, [0, 0, 0])
    applyFieldMottle(on, buildPal(), 'meadow', nx, ny, nz, flow)
    expect(on.r).toBeCloseTo(off.r, 12)
    expect(on.g).toBeCloseTo(off.g, 12)
    expect(on.b).toBeCloseTo(off.b, 12)
  })

  it('off the lane WITH flow it darkens the colour (a visible streak)', () => {
    // At default align/saturation there exist off-lane points where the streak deepens the
    // colour. Sweep for one and assert the flow pass is darker than the no-flow pass.
    let found = false
    for (let i = 0; i < 400 && !found; i++) {
      const a = (i / 400) * 6.283
      const nx = 0.45
      const ring = Math.sqrt(1 - nx * nx)
      const ny = ring * Math.cos(a)
      const nz = ring * Math.sin(a)
      const flow = flowUnit(nx, ny, nz)
      const off = new THREE.Color(PALETTE.meadow)
      const on = new THREE.Color(PALETTE.meadow)
      applyFieldMottle(off, buildPal(), 'meadow', nx, ny, nz, [0, 0, 0])
      applyFieldMottle(on, buildPal(), 'meadow', nx, ny, nz, flow)
      const lumOff = off.r + off.g + off.b
      const lumOn = on.r + on.g + on.b
      if (lumOn < lumOff - 1e-4) found = true
    }
    expect(found).toBe(true)
  })
})
