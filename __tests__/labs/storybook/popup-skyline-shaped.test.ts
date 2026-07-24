import { describe, expect, it } from 'vitest'
import { makeShapedGeometry, writeShapedQuad } from '@/components/labs/storybook/book/popup-skyline-layer'
import { solveSkylineRow, type KeepSkylineGeom, type KeepSkylineRow } from '@/components/labs/storybook/book/popup-skyline'
import type { Outline } from '@/components/labs/storybook/book/use-layer-outline'
import type { Vec3 } from '@/components/labs/storybook/book/popup-mechanics'

// The shaped-mesh path (E2.1). These lock the three invariants the shaped
// geometry must hold for the fold solver to drive it unchanged:
//   1. UV IDENTITY — uv attribute == the outline verbatim (u radial, v up).
//   2. TRI COUNT — a sane earcut fan (0 < tris <= n-2).
//   3. CONTAINMENT — every bilerped vertex lands inside the 4 solver corners at
//      beta in {0, mid, pi}, so fold-flat + wedge are inherited from the quad.
// (The per-slot production outlines get the same gates in
// .superpowers/sdd/bench/procart-outline-bench.mjs; this pins the runtime
// helpers themselves.)

// a small non-degenerate house-ish silhouette in the unit square, v-up
const OUTLINE: Outline = [
  [0, 0],
  [0, 0.5],
  [0.28, 0.5],
  [0.5, 0.92],
  [0.72, 0.5],
  [1, 0.5],
  [1, 0],
]

// the real ch3-skyline-l-mound0 row (content.ts) + its geom
const GEOM: KeepSkylineGeom = { mech: 'skyline', side: 'left', rows: [], restAtDeg: 176 }
const ROW: KeepSkylineRow = { F: 0.43, zc: -0.52, width: 0.3219, height: 0.1089, standDeg: 64 }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
function inTri(P: Vec3, A: Vec3, B: Vec3, C: Vec3, eps = 1e-6): boolean {
  const v0 = sub(B, A)
  const v1 = sub(C, A)
  const v2 = sub(P, A)
  const d00 = dot(v0, v0)
  const d01 = dot(v0, v1)
  const d11 = dot(v1, v1)
  const d20 = dot(v2, v0)
  const d21 = dot(v2, v1)
  const den = d00 * d11 - d01 * d01
  if (Math.abs(den) < 1e-12) return false
  const b1 = (d11 * d20 - d01 * d21) / den
  const b2 = (d00 * d21 - d01 * d20) / den
  return b1 >= -eps && b2 >= -eps && b1 + b2 <= 1 + eps
}
const inQuad = (P: Vec3, q: readonly Vec3[]): boolean =>
  inTri(P, q[0], q[1], q[2]) || inTri(P, q[0], q[2], q[3])

describe('shaped skyline geometry', () => {
  it('UV attribute is the outline verbatim (identity mapping)', () => {
    const geo = makeShapedGeometry(OUTLINE)
    const uv = geo.getAttribute('uv').array as ArrayLike<number>
    expect(uv.length).toBe(OUTLINE.length * 2)
    for (let i = 0; i < OUTLINE.length; i++) {
      // stored in a Float32Array, so identity holds to float32 precision
      expect(uv[i * 2]).toBeCloseTo(OUTLINE[i][0], 6)
      expect(uv[i * 2 + 1]).toBeCloseTo(OUTLINE[i][1], 6)
    }
  })

  it('triangulates to a sane fan (0 < tris <= n-2), position buffer sized per vertex', () => {
    const geo = makeShapedGeometry(OUTLINE)
    const index = geo.getIndex()!
    expect(index.count % 3).toBe(0)
    const tris = index.count / 3
    expect(tris).toBeGreaterThan(0)
    expect(tris).toBeLessThanOrEqual(OUTLINE.length - 2)
    expect((geo.getAttribute('position').array as ArrayLike<number>).length).toBe(OUTLINE.length * 3)
  })

  it('every bilerped vertex lands inside the solver quad at beta {0, mid, pi}', () => {
    const geo = makeShapedGeometry(OUTLINE)
    for (const beta of [0, Math.PI / 2, Math.PI]) {
      const m = Math.PI / 2
      const quad = solveSkylineRow(GEOM, ROW, m + beta / 2, m - beta / 2)
      writeShapedQuad(geo, quad, OUTLINE)
      const pos = geo.getAttribute('position').array as ArrayLike<number>
      for (let i = 0; i < OUTLINE.length; i++) {
        const P: Vec3 = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]
        expect(inQuad(P, quad), `vertex ${i} @ beta ${beta.toFixed(2)}`).toBe(true)
      }
    }
  })

  it('the four corner UVs map to the four solver corners exactly (bilerp endpoints)', () => {
    // corners of the unit square in ROW_UVS order must reproduce the quad
    const corners: Outline = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    const geo = makeShapedGeometry(corners)
    const quad = solveSkylineRow(GEOM, ROW, Math.PI * 0.75, Math.PI * 0.25)
    writeShapedQuad(geo, quad, corners)
    const pos = geo.getAttribute('position').array as ArrayLike<number>
    for (let c = 0; c < 4; c++) {
      for (let axis = 0; axis < 3; axis++) {
        // position buffer is Float32Array — endpoints match to float32 precision
        expect(pos[c * 3 + axis]).toBeCloseTo(quad[c][axis], 4)
      }
    }
  })
})
