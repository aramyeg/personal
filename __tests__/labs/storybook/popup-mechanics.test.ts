import { describe, expect, it } from 'vitest'
import {
  creaseElevation,
  openElevation,
  sheetAngle,
  solveVFold,
  spreadDihedral,
  spreadPageAngles,
  type PanelQuad,
  type Vec3,
  type VFoldSpec,
} from '@/components/labs/storybook/book/popup-mechanics'
import { CHAPTERS, EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'
import { PAGE_H, PAGE_W } from '@/components/labs/storybook/book/page-geometry'

// Benchmark Part A (docs/superpowers/specs/2026-07-10-popup-physics-benchmark.md):
// geometric invariants of the dihedral-driven v-fold engine, tested against
// every layer actually shipped in content.ts.

const rad = (d: number) => (d * Math.PI) / 180

const toSpec = (layer: SceneLayer): VFoldSpec => ({
  apexZ: layer.apexZ,
  vDir: layer.vDir,
  phi: rad(layer.phiDeg),
  rho: rad(layer.rhoDeg),
  width: layer.width,
  height: layer.height,
})

const ALL_LAYERS: readonly SceneLayer[] = [
  ...CHAPTERS.flatMap((c) => c.layers),
  ...Object.values(EXTRA_SPREAD_LAYERS).flat(),
]

const CH4 = CHAPTERS.find((c) => c.spread === 5)!.layers

const corners = (q: PanelQuad): readonly Vec3[] => q
const allCorners = (spec: VFoldSpec, thetaL: number, thetaR: number): Vec3[] => {
  const pose = solveVFold(spec, thetaL, thetaR)
  return [...corners(pose.right), ...corners(pose.left)]
}
const dist = (a: Vec3, b: Vec3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe('layer spec validity (design constraints, every shipped layer)', () => {
  it.each(ALL_LAYERS.map((l) => [l.id, l] as const))('%s satisfies the v-fold laws', (_id, layer) => {
    const phi = rad(layer.phiDeg)
    const rho = rad(layer.rhoDeg)
    // stands when open
    expect(rho).toBeGreaterThan(phi)
    // linkage reachable at every beta (no jam/tear)
    expect(Math.abs(Math.cos(rho))).toBeLessThanOrEqual(Math.cos(phi) + 1e-12)
  })
})

describe('A1 glue coherence — bottom edges lie in their page planes at every angle', () => {
  it('holds across the full sweep for every CH4 layer', () => {
    for (const layer of CH4) {
      const spec = toSpec(layer)
      for (let i = 0; i <= 72; i++) {
        const thetaR = 0
        const thetaL = (i / 72) * Math.PI
        const pose = solveVFold(spec, thetaL, thetaR)
        // right page plane through the spine at angle thetaR: normal (-sin, cos, 0)
        const nR: Vec3 = [-Math.sin(thetaR), Math.cos(thetaR), 0]
        const nL: Vec3 = [-Math.sin(thetaL), Math.cos(thetaL), 0]
        for (const p of [pose.right[0], pose.right[1]]) {
          expect(Math.abs(p[0] * nR[0] + p[1] * nR[1])).toBeLessThan(1e-9)
        }
        for (const p of [pose.left[0], pose.left[1]]) {
          expect(Math.abs(p[0] * nL[0] + p[1] * nL[1])).toBeLessThan(1e-9)
        }
      }
    }
  })
})

describe('A2 rigidity — the paper does not stretch', () => {
  it('every quad edge and diagonal is constant across the sweep', () => {
    for (const layer of CH4) {
      const spec = toSpec(layer)
      const ref = solveVFold(spec, Math.PI, 0)
      const refLens = {
        rGlue: dist(ref.right[0], ref.right[1]),
        rSide: dist(ref.right[1], ref.right[2]),
        rDiag: dist(ref.right[0], ref.right[2]),
        lGlue: dist(ref.left[0], ref.left[1]),
        lDiag: dist(ref.left[0], ref.left[2]),
        crease: dist(ref.right[0], ref.right[3]),
      }
      for (let i = 0; i <= 36; i++) {
        const pose = solveVFold(spec, (i / 36) * Math.PI, 0)
        expect(dist(pose.right[0], pose.right[1])).toBeCloseTo(refLens.rGlue, 9)
        expect(dist(pose.right[1], pose.right[2])).toBeCloseTo(refLens.rSide, 9)
        expect(dist(pose.right[0], pose.right[2])).toBeCloseTo(refLens.rDiag, 9)
        expect(dist(pose.left[0], pose.left[1])).toBeCloseTo(refLens.lGlue, 9)
        expect(dist(pose.left[0], pose.left[2])).toBeCloseTo(refLens.lDiag, 9)
        expect(dist(pose.right[0], pose.right[3])).toBeCloseTo(refLens.crease, 9)
      }
    }
  })
})

describe('A3 flat fold + A4 containment at closed — nothing sticks out', () => {
  it.each(ALL_LAYERS.map((l) => [l.id, l] as const))(
    '%s folds perfectly flat inside the page',
    (_id, layer) => {
      const spec = toSpec(layer)
      // closed book evaluated with both pages flat right (rotation-invariant)
      const flat = allCorners(spec, 0, 0)
      for (const p of flat) {
        expect(Math.abs(p[1])).toBeLessThan(1e-9) // exactly flat
        expect(p[0]).toBeGreaterThanOrEqual(-1e-9) // never crosses the spine
        expect(p[0]).toBeLessThanOrEqual(PAGE_W + 1e-9) // within the page width
        expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_H / 2 + 1e-9) // within the page depth
      }
    }
  )
})

describe('A5 reachability — solve is finite everywhere', () => {
  it('no NaN across the sweep for any shipped layer', () => {
    for (const layer of ALL_LAYERS) {
      const spec = toSpec(layer)
      for (let i = 0; i <= 60; i++) {
        for (const p of allCorners(spec, (i / 60) * Math.PI, 0)) {
          expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true)
        }
      }
    }
  })
})

describe('A6 continuity — no jumps, no branch flips', () => {
  it('corner displacement is bounded by the angle step', () => {
    for (const layer of CH4) {
      const spec = toSpec(layer)
      const steps = 720
      let prev = allCorners(spec, 0, 0)
      for (let i = 1; i <= steps; i++) {
        const next = allCorners(spec, (i / steps) * Math.PI, 0)
        for (let k = 0; k < prev.length; k++) {
          // A rigid piece of this size cannot displace any corner more than
          // reach × (angular rate) × Δβ. The wall layers' small rho - phi
          // gives a strong late bloom (dLambda/dbeta ≈ 2.9 near flat-open,
          // measured ~5.0 world units/radian at the backdrop's far corner —
          // bounded, since rho > phi keeps the linkage strictly inside its
          // reachability margin). 8/radian is the smooth-motion ceiling; a
          // branch flip would displace corners by ~0.1-1.0 in a single step.
          expect(dist(prev[k], next[k])).toBeLessThan((8 * Math.PI) / steps)
        }
        prev = next
      }
    }
  })
})

describe('A7 landing continuity — the turn path ends exactly at the rest pose', () => {
  it('incoming at eased t=1 equals current at rest', () => {
    const landed = spreadPageAngles('incoming', 'next', 1)
    const rest = spreadPageAngles('current', null, 0)
    expect(landed).toEqual(rest)
    const landedPrev = spreadPageAngles('incoming', 'prev', 1)
    expect(landedPrev).toEqual(rest)
  })

  it('outgoing at eased t=0 equals rest (a turn starts without a snap)', () => {
    expect(spreadPageAngles('outgoing', 'next', 0)).toEqual(spreadPageAngles('current', null, 0))
    expect(spreadPageAngles('outgoing', 'prev', 0)).toEqual(spreadPageAngles('current', null, 0))
  })
})

describe('A8 direction symmetry', () => {
  it('outgoing dihedral closes PI->0 and incoming opens 0->PI in both directions', () => {
    for (const dir of ['next', 'prev'] as const) {
      expect(spreadDihedral('outgoing', dir, 0)).toBeCloseTo(Math.PI, 9)
      expect(spreadDihedral('outgoing', dir, 1)).toBeCloseTo(0, 9)
      expect(spreadDihedral('incoming', dir, 0)).toBeCloseTo(0, 9)
      expect(spreadDihedral('incoming', dir, 1)).toBeCloseTo(Math.PI, 9)
      let prevOut = Math.PI
      let prevIn = 0
      for (let t = 0.05; t <= 1; t += 0.05) {
        const out = spreadDihedral('outgoing', dir, t)
        const inc = spreadDihedral('incoming', dir, t)
        expect(out).toBeLessThanOrEqual(prevOut + 1e-12)
        expect(inc).toBeGreaterThanOrEqual(prevIn - 1e-12)
        prevOut = out
        prevIn = inc
      }
    }
  })

  it('sheetAngle matches the turning page convention', () => {
    expect(sheetAngle('next', 0)).toBe(0)
    expect(sheetAngle('next', 1)).toBeCloseTo(Math.PI, 12)
    expect(sheetAngle('prev', 0)).toBeCloseTo(Math.PI, 12)
    expect(sheetAngle('prev', 1)).toBe(0)
  })
})

describe('A9 rest-pose separation — nested layers clear each other', () => {
  it('no two CH4 quads intersect at full open', () => {
    const poses = CH4.map((l) => solveVFold(toSpec(l), Math.PI, 0))
    const quads = poses.flatMap((p) => [p.right, p.left])
    const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
    const cross = (a: Vec3, b: Vec3): Vec3 => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ]
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

    // segment-vs-quad (two triangles) intersection
    const segHitsTri = (p: Vec3, q: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean => {
      const n = cross(sub(b, a), sub(c, a))
      const dp = dot(n, sub(p, a))
      const dq = dot(n, sub(q, a))
      if (dp * dq > -1e-12) return false // same side or touching the plane
      const t = dp / (dp - dq)
      const x: Vec3 = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
      // inside-triangle test via same-side cross products
      const inab = dot(cross(sub(b, a), sub(x, a)), n) >= -1e-10
      const inbc = dot(cross(sub(c, b), sub(x, b)), n) >= -1e-10
      const inca = dot(cross(sub(a, c), sub(x, c)), n) >= -1e-10
      return inab && inbc && inca
    }
    const quadEdges = (q: PanelQuad): Array<[Vec3, Vec3]> => [
      [q[0], q[1]],
      [q[1], q[2]],
      [q[2], q[3]],
      [q[3], q[0]],
    ]
    const quadHitsQuad = (qa: PanelQuad, qb: PanelQuad): boolean => {
      const tris: Array<[Vec3, Vec3, Vec3]> = [
        [qb[0], qb[1], qb[2]],
        [qb[0], qb[2], qb[3]],
      ]
      return quadEdges(qa).some(([p, q]) => tris.some(([a, b, c]) => segHitsTri(p, q, a, b, c)))
    }

    for (let i = 0; i < quads.length; i++) {
      for (let j = 0; j < quads.length; j++) {
        // skip a piece against its own sibling panel (they share the crease)
        if (Math.floor(i / 2) === Math.floor(j / 2) || i === j) continue
        expect(quadHitsQuad(quads[i], quads[j])).toBe(false)
      }
    }
  })
})

describe('A10 wedge containment — paper never pokes through either bounding page', () => {
  it('every corner stays inside its spread dihedral wedge through both turn roles', () => {
    for (const layer of CH4) {
      const spec = toSpec(layer)
      for (const role of ['outgoing', 'incoming'] as const) {
        for (let i = 1; i < 24; i++) {
          const t = i / 24
          const { thetaL, thetaR } = spreadPageAngles(role, 'next', t)
          for (const p of allCorners(spec, thetaL, thetaR)) {
            const r = Math.hypot(p[0], p[1])
            if (r < 1e-9) continue // on the spine
            // atan2 jumps to -PI for points on the flat left page whose y
            // carries -0/-1e-17 float noise; lift those into [0, 2PI) so a
            // corner exactly on a page plane isn't a false violation.
            let ang = Math.atan2(p[1], p[0])
            if (ang < thetaR - 1e-6) ang += 2 * Math.PI
            expect(ang).toBeGreaterThanOrEqual(thetaR - 1e-9)
            expect(ang).toBeLessThanOrEqual(thetaL + 1e-6)
          }
        }
      }
    }
  })
})

describe('closed-form endpoints (literature checks)', () => {
  it('folds flat at closed: Lambda(0) = phi + rho', () => {
    expect(creaseElevation(rad(84), rad(88), 0)).toBeCloseTo(rad(172), 9)
    expect(creaseElevation(rad(52), rad(80), 0)).toBeCloseTo(rad(132), 9)
  })

  it('stands at open: Lambda(PI) = arccos(cos rho / cos phi)', () => {
    expect(creaseElevation(rad(52), rad(80), Math.PI)).toBeCloseTo(openElevation(rad(52), rad(80)), 9)
    expect(openElevation(rad(52), rad(80))).toBeCloseTo(Math.acos(Math.cos(rad(80)) / Math.cos(rad(52))), 12)
  })

  it('blooms late: the last sixth of the dihedral moves the crease more than the first sixth', () => {
    // rho - phi is small for the wall layers, so the geometric snap
    // concentrates near flat-open (literature doc §7).
    const phi = rad(84)
    const rho = rad(88)
    const early = Math.abs(creaseElevation(phi, rho, rad(30)) - creaseElevation(phi, rho, 0))
    const late = Math.abs(creaseElevation(phi, rho, rad(180)) - creaseElevation(phi, rho, rad(150)))
    expect(late).toBeGreaterThan(early)
  })
})
