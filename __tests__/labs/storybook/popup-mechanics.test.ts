import { describe, expect, it } from 'vitest'
import {
  creaseElevation,
  openElevation,
  sheetAngle,
  solveLayerPose,
  solveParallelPose,
  solveVFoldPose,
  spreadDihedral,
  spreadPageAngles,
  type LayerGeom,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import { CHAPTERS, EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'
import { PAGE_H, PAGE_W } from '@/components/labs/storybook/book/page-geometry'

// Benchmark Part A (docs/superpowers/specs/2026-07-10-popup-physics-benchmark.md):
// geometric invariants of the dihedral-driven engine, tested against every
// layer actually shipped in content.ts — now across all three mechanism
// families (v-fold incl. asymmetric, parallel fold, cascaded child).

const rad = (d: number) => (d * Math.PI) / 180

/** Every spread's layer set, with a name for test output. */
const SPREAD_SETS: ReadonlyArray<readonly [string, readonly SceneLayer[]]> = [
  ...CHAPTERS.map((c) => [`spread-${c.spread}`, c.layers] as const),
  ...Object.entries(EXTRA_SPREAD_LAYERS).map(([s, layers]) => [`extra-${s}`, layers] as const),
]

/** [id, layer, its spread's layers] for parent resolution. */
const ALL_LAYERS: ReadonlyArray<readonly [string, SceneLayer, readonly SceneLayer[]]> =
  SPREAD_SETS.flatMap(([, layers]) => layers.map((l) => [l.id, l, layers] as const))

const parentOf = (layer: SceneLayer, layers: readonly SceneLayer[]): SceneLayer | undefined =>
  layer.mech === 'child' ? layers.find((l) => l.id === layer.parentId) : undefined

const poseAt = (layer: SceneLayer, layers: readonly SceneLayer[], thetaL: number, thetaR: number) =>
  solveLayerPose(layer, parentOf(layer, layers), thetaL, thetaR)

const allCorners = (
  layer: SceneLayer,
  layers: readonly SceneLayer[],
  thetaL: number,
  thetaR: number
): Vec3[] => {
  const pose = poseAt(layer, layers, thetaL, thetaR)
  return [...pose.right, ...pose.left]
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Flat-fold tolerance per mechanism: the symmetric v-fold closed form is
 *  analytically exact (1e-9); skewed pieces and children go through the
 *  two-cone tangency at beta = 0, whose ~1e-11 float residue is
 *  sqrt-amplified to ~1e-6 world units — sub-micron against paper
 *  thickness 0.02, but not bitwise flat. */
const flatTol = (layer: SceneLayer): number => {
  if (layer.mech === 'child') return 1e-5
  if (layer.mech === 'vfold' && (layer.skewDeg ?? 0) !== 0) return 1e-5
  if (layer.mech === 'parallel') return 1e-6
  return 1e-9
}

describe('layer spec validity (design constraints, every shipped layer)', () => {
  it.each(ALL_LAYERS.map(([id, l, ls]) => [id, l, ls] as const))(
    '%s satisfies its mechanism laws',
    (_id, layer, layers) => {
      if (layer.mech === 'parallel') {
        expect(layer.rise).toBeGreaterThan(0)
        // closed it reaches glueL + glueR + rise from the spine
        expect(layer.glueL + layer.glueR + layer.rise).toBeLessThanOrEqual(PAGE_W)
        expect(layer.z0).toBeLessThan(layer.z1)
        expect(Math.abs(layer.z0)).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(layer.z1)).toBeLessThanOrEqual(PAGE_H / 2)
        // stands proud when open
        const rest = solveParallelPose(layer, Math.PI, 0)
        expect(rest.apex[1]).toBeGreaterThan(0.05)
        return
      }
      const skew = layer.mech === 'vfold' ? (layer.skewDeg ?? 0) : 0
      const phiR = rad(layer.phiDeg)
      const rhoR = rad(layer.rhoDeg)
      const phiL = rad(layer.phiDeg + skew)
      const rhoL = rad(layer.rhoDeg - skew)
      // both panels stand when open and fold inside the flat page
      expect(rhoR).toBeGreaterThan(phiR)
      expect(rhoL).toBeGreaterThan(phiL)
      expect(phiR + rhoR).toBeLessThan(Math.PI)
      // linkage reachable at every beta (no jam/tear), per side
      expect(Math.abs(Math.cos(rhoR))).toBeLessThanOrEqual(Math.cos(phiR) + 1e-12)
      expect(Math.abs(Math.cos(rhoL))).toBeLessThanOrEqual(Math.cos(phiL) + 1e-12)
      if (layer.mech === 'child') {
        const parent = parentOf(layer, layers)
        expect(parent?.mech).toBe('vfold')
        if (parent?.mech === 'vfold') {
          expect(layer.mount).toBeGreaterThan(0)
          expect(layer.mount).toBeLessThan(parent.height)
        }
      } else {
        // a leaning piece must still read as standing at full open
        const rest = solveVFoldPose(layer, Math.PI, 0)
        expect(rest.crease[1]).toBeGreaterThan(0.25)
      }
    }
  )
})

describe('A1 glue coherence — glue edges lie in their host surface at every angle', () => {
  it('page-glued pieces keep their bottom edges in the page planes', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      if (layer.mech === 'child') continue
      for (let i = 0; i <= 72; i++) {
        const thetaR = 0
        const thetaL = (i / 72) * Math.PI
        const pose = poseAt(layer, layers, thetaL, thetaR)
        const nR: Vec3 = [-Math.sin(thetaR), Math.cos(thetaR), 0]
        const nL: Vec3 = [-Math.sin(thetaL), Math.cos(thetaL), 0]
        // v-fold right glue: [apex, bottom-outer] (corners 0,1); parallel
        // right glue: [glue@z1, glue@z0] (corners 2,3). Left glue is
        // corners 0,1 for both mechanisms.
        const rightGlue =
          layer.mech === 'parallel' ? [pose.right[2], pose.right[3]] : [pose.right[0], pose.right[1]]
        const leftGlue = [pose.left[0], pose.left[1]]
        for (const p of rightGlue) {
          expect(Math.abs(p[0] * nR[0] + p[1] * nR[1])).toBeLessThan(1e-9)
        }
        for (const p of leftGlue) {
          expect(Math.abs(p[0] * nL[0] + p[1] * nL[1])).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('children keep their glue edges in the parent panel planes (A11: and on the paper)', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      if (layer.mech !== 'child') continue
      const parent = parentOf(layer, layers)!
      if (parent.mech !== 'vfold') throw new Error('child parent must be vfold')
      const split = parent.creaseU ?? 0.5
      const skew = parent.skewDeg ?? 0
      const glueLen = {
        right: (parent.width * (1 - split)) / Math.sin(rad(parent.rhoDeg)),
        left: (parent.width * split) / Math.sin(rad(parent.rhoDeg - skew)),
      }
      for (const beta of [0.01, 0.4, Math.PI / 2, 2.4, Math.PI]) {
        const parentPose = poseAt(parent, layers, beta, 0)
        const childPose = poseAt(layer, layers, beta, 0)
        for (const side of ['right', 'left'] as const) {
          const g = side === 'right' ? parentPose.glueR : parentPose.glueL
          const c = parentPose.crease
          const gc = dot(g, c)
          const den = 1 - gc * gc
          for (const p of [childPose[side][0], childPose[side][1]]) {
            const v = sub(p, parentPose.apex)
            const d1 = dot(v, g)
            const d2 = dot(v, c)
            const s = (d1 - gc * d2) / den
            const t = (d2 - gc * d1) / den
            // residual off the panel plane — the glue is ON the paper
            const res: Vec3 = [
              v[0] - s * g[0] - t * c[0],
              v[1] - s * g[1] - t * c[1],
              v[2] - s * g[2] - t * c[2],
            ]
            expect(Math.hypot(res[0], res[1], res[2])).toBeLessThan(1e-6)
            // and inside the parent panel's cut (A11 — nothing glued to air)
            expect(s).toBeGreaterThanOrEqual(-1e-6)
            expect(s).toBeLessThanOrEqual(glueLen[side] + 1e-6)
            expect(t).toBeGreaterThanOrEqual(-1e-6)
            expect(t).toBeLessThanOrEqual(parent.height + 1e-6)
          }
        }
      }
    }
  })
})

describe('A2 rigidity — the paper does not stretch', () => {
  it('every quad edge and diagonal is constant across the sweep, all layers', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      const ref = poseAt(layer, layers, Math.PI, 0)
      const refLens = {
        rGlue: dist(ref.right[0], ref.right[1]),
        rSide: dist(ref.right[1], ref.right[2]),
        rDiag: dist(ref.right[0], ref.right[2]),
        lGlue: dist(ref.left[0], ref.left[1]),
        lDiag: dist(ref.left[0], ref.left[2]),
        crease: dist(ref.right[0], ref.right[3]),
      }
      for (let i = 0; i <= 36; i++) {
        const pose = poseAt(layer, layers, (i / 36) * Math.PI, 0)
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
  it.each(ALL_LAYERS.map(([id, l, ls]) => [id, l, ls] as const))(
    '%s folds flat inside the page',
    (_id, layer, layers) => {
      const tol = flatTol(layer)
      // closed book evaluated with both pages flat right (rotation-invariant)
      const flat = allCorners(layer, layers, 0, 0)
      for (const p of flat) {
        expect(Math.abs(p[1])).toBeLessThan(tol) // flat to sub-paper precision
        expect(p[0]).toBeGreaterThanOrEqual(-tol) // never crosses the spine
        expect(p[0]).toBeLessThanOrEqual(PAGE_W + tol) // within the page width
        expect(Math.abs(p[2])).toBeLessThanOrEqual(PAGE_H / 2 + tol) // within the page depth
      }
    }
  )
})

describe('A5 reachability — solve is finite everywhere', () => {
  it('no NaN across the sweep for any shipped layer', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      for (let i = 0; i <= 60; i++) {
        for (const p of allCorners(layer, layers, (i / 60) * Math.PI, 0)) {
          expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true)
        }
      }
    }
  })
})

describe('A6 continuity — no jumps, no branch flips', () => {
  it('corner displacement is bounded by the angle step', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      const steps = 720
      // A rigid piece of this size cannot displace any corner more than
      // reach x (angular rate) x dBeta. The wall layers' small rho - phi
      // gives a strong late bloom (measured ~5.0 world units/radian at the
      // backdrop's far corner — bounded, since rho > phi keeps the linkage
      // strictly inside its reachability margin). Children COMPOUND their
      // parent's bloom with their own (the parent's panel dihedral is
      // their driving angle), so their ceiling doubles. A branch flip
      // would displace corners by ~0.1-1.0 in a single step.
      const bound = layer.mech === 'child' ? (16 * Math.PI) / steps : (8 * Math.PI) / steps
      let prev = allCorners(layer, layers, 0, 0)
      for (let i = 1; i <= steps; i++) {
        const next = allCorners(layer, layers, (i / steps) * Math.PI, 0)
        for (let k = 0; k < prev.length; k++) {
          expect(dist(prev[k], next[k])).toBeLessThan(bound)
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

describe('A9 rest-pose separation — pieces clear each other, spread by spread', () => {
  const subv = sub
  const segHitsTri = (p: Vec3, q: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean => {
    const n = cross(subv(b, a), subv(c, a))
    const dp = dot(n, subv(p, a))
    const dq = dot(n, subv(q, a))
    if (dp * dq > -1e-12) return false // same side or touching the plane
    const t = dp / (dp - dq)
    const x: Vec3 = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
    const inab = dot(cross(subv(b, a), subv(x, a)), n) >= -1e-10
    const inbc = dot(cross(subv(c, b), subv(x, b)), n) >= -1e-10
    const inca = dot(cross(subv(a, c), subv(x, c)), n) >= -1e-10
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

  it.each(SPREAD_SETS.map(([name, layers]) => [name, layers] as const))(
    '%s: no two quads intersect at full open',
    (_name, layers) => {
      const quads = layers.flatMap((l, idx) => {
        const pose = poseAt(l, layers, Math.PI, 0)
        return [
          { q: pose.right, piece: idx, id: l.id },
          { q: pose.left, piece: idx, id: l.id },
        ]
      })
      // A child touches its parent BY DESIGN: its apex vertex sits on the
      // parent's crease edge and its glue edges lie in the panel planes —
      // vertex/edge contact the segment-triangle test reads as a hit. It
      // can never actually pierce the parent: every child point is
      // apex + s*glue + t*crease with s,t >= 0, glue directions in the
      // panel planes and the crease on their bisector, so all its material
      // stays inside the parent's convex panel wedge (same argument as
      // A10's page wedge). Child-parent pairs are therefore excluded;
      // every other pair is a real separation requirement.
      const glued = new Set<string>()
      layers.forEach((l, idx) => {
        if (l.mech !== 'child') return
        const p = layers.findIndex((c) => c.id === l.parentId)
        glued.add(`${idx}:${p}`)
        glued.add(`${p}:${idx}`)
      })
      for (let i = 0; i < quads.length; i++) {
        for (let j = 0; j < quads.length; j++) {
          // skip a piece against its own sibling panel (they share the crease)
          if (quads[i].piece === quads[j].piece || i === j) continue
          if (glued.has(`${quads[i].piece}:${quads[j].piece}`)) continue
          if (quadHitsQuad(quads[i].q, quads[j].q)) {
            throw new Error(`A9: ${quads[i].id} intersects ${quads[j].id} at rest`)
          }
        }
      }
    }
  )
})

describe('A10 wedge containment — paper never pokes through either bounding page', () => {
  it('every corner stays inside its spread dihedral wedge through both turn roles', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      for (const role of ['outgoing', 'incoming'] as const) {
        for (let i = 1; i < 24; i++) {
          const t = i / 24
          const { thetaL, thetaR } = spreadPageAngles(role, 'next', t)
          for (const p of allCorners(layer, layers, thetaL, thetaR)) {
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

  it('parallel fold: strip folds flat up the collapsed page at closed', () => {
    const geom: LayerGeom = { mech: 'parallel', glueL: 0.34, glueR: 0.42, rise: 0.1, z0: 0.3, z1: 0.62 }
    const closed = solveParallelPose(geom, 0, 0)
    // ridge collinear with the collapsed page (y=0), at glueL + wA from the spine
    expect(Math.abs(closed.apex[1])).toBeLessThan(1e-6)
    expect(closed.apex[0]).toBeCloseTo(geom.glueL + geom.glueR + geom.rise, 6)
  })

  it('child of a flat parent lies flat with it', () => {
    const parent: LayerGeom = {
      mech: 'vfold',
      apexZ: 0,
      vDir: 1,
      phiDeg: 52,
      rhoDeg: 80,
      width: 0.8,
      height: 0.6,
    }
    const child: LayerGeom = {
      mech: 'child',
      parentId: 'p',
      mount: 0.2,
      vDir: 1,
      phiDeg: 60,
      rhoDeg: 83,
      width: 0.2,
      height: 0.15,
    }
    const pose = solveLayerPose(child, parent, 0, 0)
    for (const p of [...pose.right, ...pose.left]) {
      expect(Math.abs(p[1])).toBeLessThan(1e-6)
    }
  })
})
