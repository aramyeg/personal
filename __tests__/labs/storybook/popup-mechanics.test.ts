import { describe, expect, it } from 'vitest'
import {
  coverSpreadAngles,
  creaseElevation,
  isCoverPair,
  liveSpreadRole,
  openElevation,
  sheetAngle,
  sheetAngleTilted,
  sheetSweepTilted,
  solveBoxPose,
  solveLayerPose,
  solveParallelPose,
  solveStripFlapPose,
  solveVFoldPose,
  spreadDihedral,
  spreadPageAngles,
  spreadPageAnglesTilted,
  type LayerGeom,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solveDressPose,
  solveFanPose,
  solvePlatformPose,
  solveRiderPose,
} from '@/components/labs/storybook/book/popup-anatomy'
import { CHAPTERS, EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'
import { PAGE_H, PAGE_W, restAngles } from '@/components/labs/storybook/book/page-geometry'

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

/** A dress patch's seat quad, re-solved from its parent (mirrors the
 *  renderer's seat resolution in popup-anatomy-layers.tsx). */
const seatQuadOf = (
  layer: SceneLayer & { mech: 'dress' },
  layers: readonly SceneLayer[],
  thetaL: number,
  thetaR: number
): PanelQuad => {
  const parent = layers.find((l) => l.id === layer.parentId)
  if (!parent) throw new Error(`dress ${layer.id}: parent ${layer.parentId} not in spread`)
  if (parent.mech === 'box') {
    const patch = solveBoxPose(parent, thetaL, thetaR).find((p) => p.face === layer.seat)
    if (!patch) throw new Error(`dress ${layer.id}: box has no face ${layer.seat}`)
    return patch.quad
  }
  if (parent.mech === 'platform') {
    const patch = solvePlatformPose(parent, thetaL, thetaR).find(
      (p) => p.face === layer.seat && p.bay === 0
    )
    if (!patch) throw new Error(`dress ${layer.id}: platform has no face ${layer.seat}`)
    return patch.quad
  }
  const pose = solveLayerPose(parent, parentOf(parent, layers), thetaL, thetaR)
  return layer.seat === 'left' ? pose.left : pose.right
}

/** Every world-space quad a layer poses: two panels for the two-panel
 *  mechanisms (fan members and riders included), the full patch list for
 *  boxes and platforms, the single riding quad for a dress patch. */
const allQuads = (
  layer: SceneLayer,
  layers: readonly SceneLayer[],
  thetaL: number,
  thetaR: number
): PanelQuad[] => {
  if (layer.mech === 'box') return solveBoxPose(layer, thetaL, thetaR).map((p) => p.quad)
  if (layer.mech === 'platform') return solvePlatformPose(layer, thetaL, thetaR).map((p) => p.quad)
  if (layer.mech === 'fan')
    return solveFanPose(layer, thetaL, thetaR).flatMap((pose) => [pose.right, pose.left])
  if (layer.mech === 'rider') {
    const parent = layers.find((l) => l.id === layer.parentId)
    if (!parent || (parent.mech !== 'box' && parent.mech !== 'platform' && parent.mech !== 'parallel')) {
      throw new Error(`rider ${layer.id}: parent must be a box/platform/tent in the same spread`)
    }
    const pose = solveRiderPose(layer, parent, thetaL, thetaR)
    return [pose.right, pose.left]
  }
  if (layer.mech === 'dress') return [solveDressPose(layer, seatQuadOf(layer, layers, thetaL, thetaR))]
  const pose = poseAt(layer, layers, thetaL, thetaR)
  return [pose.right, pose.left]
}

const allCorners = (
  layer: SceneLayer,
  layers: readonly SceneLayer[],
  thetaL: number,
  thetaR: number
): Vec3[] => allQuads(layer, layers, thetaL, thetaR).flat()

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
  // Platform decks — and riders SEATED on them — inherit parallelRidge's
  // float summation order (~1e-8 y at the closed tangency, sqrt-of-roundoff
  // class). boxLid riders and unskewed fan members are analytically exact;
  // skewed fan members go through the two-cone tangency like skewed v-folds.
  if (layer.mech === 'platform') return 1e-6
  if (layer.mech === 'rider') return layer.seat === 'boxLid' ? 1e-9 : 1e-6
  if (layer.mech === 'fan') return layer.members.some((m) => (m.skewDeg ?? 0) !== 0) ? 1e-5 : 1e-9
  // A dress patch is a SECOND sheet glued atop its link: it flattens to its
  // parent's plane plus the glue-layer lift (DRESS_LIFT 0.003 — well inside
  // paper thickness 0.02).
  if (layer.mech === 'dress') return 0.004
  return 1e-9 // symmetric v-folds AND boxes: analytically exact closed forms
}

describe('layer spec validity (design constraints, every shipped layer)', () => {
  it.each(ALL_LAYERS.map(([id, l, ls]) => [id, l, ls] as const))(
    '%s satisfies its mechanism laws',
    (_id, layer, layers) => {
      if (layer.mech === 'box') {
        expect(layer.a).toBeGreaterThan(0)
        expect(layer.height).toBeGreaterThan(0)
        expect(layer.z0).toBeLessThan(layer.z1)
        // at least one cap pair braces the walls (module header §4)
        expect((layer.capFront ?? true) || (layer.capBack ?? true)).toBe(true)
        if (layer.roof === 'gable') expect(layer.gableRise ?? 0).toBeGreaterThan(0)
        // closed reach along the page: wall tip a + H, plus a gable's
        // ridge panel folding past it
        const roofReach = layer.roof === 'gable' ? Math.hypot(layer.a, layer.gableRise ?? 0) : 0
        expect(layer.a + layer.height + roofReach).toBeLessThanOrEqual(PAGE_W)
        // caps fold OUT along the spine to z1 + a / z0 - a at closed
        if (layer.capFront ?? true) expect(layer.z1 + layer.a).toBeLessThanOrEqual(PAGE_H / 2)
        if (layer.capBack ?? true) expect(layer.z0 - layer.a).toBeGreaterThanOrEqual(-PAGE_H / 2)
        return
      }
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
      if (layer.mech === 'platform' || layer.mech === 'fan' || layer.mech === 'rider' || layer.mech === 'dress') {
        // Anatomy-phase mechs carry their spec-validity gates in
        // popup-anatomy.test.ts (deck flat-fold rules, fan member rules,
        // rider mount rule, dress seat existence).
        return
      }
      if (layer.mech === 'stripflap') {
        // strip pull budget exists and the figure stands upright at rest
        expect(layer.anchor).toBeGreaterThan(0)
        expect(layer.slot).toBeGreaterThan(0)
        const rest = solveStripFlapPose(layer, Math.PI, 0)
        expect(rest.crease[1]).toBeGreaterThan(0.9)
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
      // children, riders, and dress patches glue to PAPER, not pages —
      // their glue coherence is tested against their parents instead.
      if (layer.mech === 'child' || layer.mech === 'rider' || layer.mech === 'dress') continue
      for (let i = 0; i <= 72; i++) {
        const thetaR = 0
        const thetaL = (i / 72) * Math.PI
        const nR: Vec3 = [-Math.sin(thetaR), Math.cos(thetaR), 0]
        const nL: Vec3 = [-Math.sin(thetaL), Math.cos(thetaL), 0]
        if (layer.mech === 'platform') {
          // strut glue: strutL's bottom edge (corners 0,1) on the left page,
          // strutR's glue edge (corners 2,3) on the right page, every bay
          for (const patch of solvePlatformPose(layer, thetaL, thetaR)) {
            const glue =
              patch.face === 'strutL'
                ? ([patch.quad[0], patch.quad[1]] as const)
                : patch.face === 'strutR'
                  ? ([patch.quad[2], patch.quad[3]] as const)
                  : null
            if (!glue) continue
            const n = patch.face === 'strutL' ? nL : nR
            for (const p of glue) {
              expect(Math.abs(p[0] * n[0] + p[1] * n[1])).toBeLessThan(1e-9)
            }
          }
          continue
        }
        if (layer.mech === 'stripflap') {
          // one-page mechanism: BOTH panels hinge on the figure's page
          const pose = poseAt(layer, layers, thetaL, thetaR)
          const n = layer.side === 'left' ? nL : nR
          for (const p of [pose.right[0], pose.right[1], pose.left[0], pose.left[1]]) {
            expect(Math.abs(p[0] * n[0] + p[1] * n[1])).toBeLessThan(1e-9)
          }
          continue
        }
        if (layer.mech === 'fan') {
          // every member is an independent page-glued v-fold
          for (const pose of solveFanPose(layer, thetaL, thetaR)) {
            for (const p of [pose.right[0], pose.right[1]]) {
              expect(Math.abs(p[0] * nR[0] + p[1] * nR[1])).toBeLessThan(1e-9)
            }
            for (const p of [pose.left[0], pose.left[1]]) {
              expect(Math.abs(p[0] * nL[0] + p[1] * nL[1])).toBeLessThan(1e-9)
            }
          }
          continue
        }
        if (layer.mech === 'box') {
          // box glue: each wall's bottom edge (quad corners 0,1) on its page
          const patches = solveBoxPose(layer, thetaL, thetaR)
          for (const { face, quad } of patches) {
            const n = face === 'wallL' ? nL : face === 'wallR' ? nR : null
            if (!n) continue
            for (const p of [quad[0], quad[1]]) {
              expect(Math.abs(p[0] * n[0] + p[1] * n[1])).toBeLessThan(1e-9)
            }
          }
          continue
        }
        const pose = poseAt(layer, layers, thetaL, thetaR)
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

describe('A2/A12 rigidity — the paper does not stretch (multi-patch included)', () => {
  it('every patch keeps all pairwise corner distances across the sweep, all layers', () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      const refQuads = allQuads(layer, layers, Math.PI, 0)
      const refDists = refQuads.map((q) => {
        const ds: number[] = []
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
        return ds
      })
      for (let i = 0; i <= 36; i++) {
        const quads = allQuads(layer, layers, (i / 36) * Math.PI, 0)
        quads.forEach((q, qi) => {
          let k = 0
          for (let a = 0; a < 4; a++)
            for (let b = a + 1; b < 4; b++) {
              expect(dist(q[a], q[b])).toBeCloseTo(refDists[qi][k++], 9)
            }
        })
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
  // 720 samples x 8 corners x every shipped layer is the suite's heaviest
  // sweep (~2s alone, longer when the full suite's workers share the CPU) —
  // the default 5s timeout flakes under load, so it gets its own budget.
  it('corner displacement is bounded by the angle step', { timeout: 30_000 }, () => {
    for (const [, layer, layers] of ALL_LAYERS) {
      const steps = 720
      // A rigid piece of this size cannot displace any corner more than
      // reach x (angular rate) x dBeta. The wall layers' small rho - phi
      // gives a strong late bloom (measured ~5.0 world units/radian at the
      // backdrop's far corner — bounded, since rho > phi keeps the linkage
      // strictly inside its reachability margin). Children COMPOUND their
      // parent's bloom with their own (the parent's panel dihedral is
      // their driving angle), so their ceiling doubles — riders and dress
      // patches ride mechanisms the same way. A branch flip would displace
      // corners by ~0.1-1.0 in a single step.
      const compound = layer.mech === 'child' || layer.mech === 'rider' || layer.mech === 'dress'
      const bound = compound ? (16 * Math.PI) / steps : (8 * Math.PI) / steps
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
      const quads = layers.flatMap((l, idx) =>
        allQuads(l, layers, Math.PI, 0).map((q) => ({ q, piece: idx, id: l.id }))
      )
      // A child touches its parent BY DESIGN: its apex vertex sits on the
      // parent's crease edge and its glue edges lie in the panel planes —
      // vertex/edge contact the segment-triangle test reads as a hit. It
      // can never actually pierce the parent: every child point is
      // apex + s*glue + t*crease with s,t >= 0, glue directions in the
      // panel planes and the crease on their bisector, so all its material
      // stays inside the parent's convex panel wedge (same argument as
      // A10's page wedge). Child-parent pairs are therefore excluded;
      // every other pair is a real separation requirement.
      // Riders and dress patches touch their parents by design too: rider
      // glue edges lie IN the parent's lid/deck planes, a dress sits one
      // glue layer (0.003) off its link — same convexity argument.
      const glued = new Set<string>()
      layers.forEach((l, idx) => {
        if (l.mech !== 'child' && l.mech !== 'rider' && l.mech !== 'dress') return
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
            // A dress patch is a sheet stacked on another sheet: its glue-
            // layer lift (0.003) may sit inside the closing sandwich, which
            // a zero-thickness wedge reads as penetration. Allow it in
            // LINEAR terms (4mm against paper thickness 0.02); everything
            // else keeps the strict angular tolerance.
            const slackAng = layer.mech === 'dress' ? 0.004 / r : 1e-6
            // atan2 jumps to -PI for points on the flat left page whose y
            // carries -0/-1e-17 float noise; lift those into [0, 2PI) so a
            // corner exactly on a page plane isn't a false violation.
            let ang = Math.atan2(p[1], p[0])
            if (ang < thetaR - slackAng) ang += 2 * Math.PI
            expect(ang).toBeGreaterThanOrEqual(thetaR - slackAng)
            expect(ang).toBeLessThanOrEqual(thetaL + slackAng)
          }
        }
      }
    }
  })
})

describe('A13 assembly closure — box hinges stay coincident at every angle', () => {
  // Volumetric benchmark spec 2026-07-11: shared hinges between patches
  // remain coincident (<= 1e-6) — lids stay on walls, caps stay on the
  // walls' edges, cap creases meet, nothing tears. (A14 bracing is a
  // derive-time gate: .superpowers/sdd/bench/derive-boxfold.mjs.)
  const boxes = ALL_LAYERS.filter(([, l]) => l.mech === 'box')

  it('ships at least one box (the volumetric mechanism exists in content)', () => {
    expect(boxes.length).toBeGreaterThan(0)
  })

  it.each(boxes.map(([id, l]) => [id, l] as const))('%s hinges never tear', (_id, layer) => {
    if (layer.mech !== 'box') throw new Error('filtered to boxes')
    for (let i = 0; i <= 72; i++) {
      const patches = new Map(
        solveBoxPose(layer, (i / 72) * Math.PI, 0).map((p) => [p.face, p.quad] as const)
      )
      const expectCoincident = (p: Vec3 | undefined, q: Vec3 | undefined) => {
        if (!p || !q) return
        expect(dist(p, q)).toBeLessThan(1e-6)
      }
      const wallL = patches.get('wallL')!
      const wallR = patches.get('wallR')!
      const lidL = patches.get('lidL')
      const lidR = patches.get('lidR')
      const roofL = patches.get('roofL')
      const roofR = patches.get('roofR')
      const backbone = patches.get('backbone')
      // lid outer edges on the wall tops, seam on the backbone's top edge
      if (lidL && backbone) {
        expectCoincident(lidL[0], wallL[2])
        expectCoincident(lidL[3], wallL[3])
        expectCoincident(lidL[1], backbone[2])
        expectCoincident(lidL[2], backbone[3])
      }
      if (lidR && backbone) {
        expectCoincident(lidR[1], wallR[3])
        expectCoincident(lidR[2], wallR[2])
        expectCoincident(lidR[0], backbone[2])
        expectCoincident(lidR[3], backbone[3])
      }
      // gable roof: hinged on the wall tops, sharing one floating ridge
      if (roofL && roofR) {
        expectCoincident(roofL[0], wallL[2])
        expectCoincident(roofL[3], wallL[3])
        expectCoincident(roofR[1], wallR[3])
        expectCoincident(roofR[2], wallR[2])
        expectCoincident(roofL[1], roofR[0])
        expectCoincident(roofL[2], roofR[3])
      }
      // caps: hinged on the walls' vertical edges, sharing their crease
      const capFrontL = patches.get('capFrontL')
      const capFrontR = patches.get('capFrontR')
      if (capFrontL && capFrontR) {
        expectCoincident(capFrontL[0], wallL[1])
        expectCoincident(capFrontL[3], wallL[2])
        expectCoincident(capFrontR[1], wallR[0])
        expectCoincident(capFrontR[2], wallR[3])
        expectCoincident(capFrontL[1], capFrontR[0])
        expectCoincident(capFrontL[2], capFrontR[3])
      }
      const capBackL = patches.get('capBackL')
      const capBackR = patches.get('capBackR')
      if (capBackL && capBackR) {
        expectCoincident(capBackL[1], wallL[0])
        expectCoincident(capBackL[2], wallL[3])
        expectCoincident(capBackR[0], wallR[1])
        expectCoincident(capBackR[3], wallR[2])
        expectCoincident(capBackR[1], capBackL[0])
        expectCoincident(capBackR[2], capBackL[3])
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

describe('liveSpreadRole — turn roles on the driver clock (the commit-flash rule)', () => {
  it('at rest only the committed spread is current; every neighbor is hidden', () => {
    expect(liveSpreadRole(3, 3, null)).toBe('current')
    expect(liveSpreadRole(2, 3, null)).toBe('hidden')
    expect(liveSpreadRole(4, 3, null)).toBe('hidden')
  })

  it('next turn: committed spread is outgoing, spread+1 incoming, others hidden', () => {
    expect(liveSpreadRole(3, 3, 'next')).toBe('outgoing')
    expect(liveSpreadRole(4, 3, 'next')).toBe('incoming')
    expect(liveSpreadRole(2, 3, 'next')).toBe('hidden')
    expect(liveSpreadRole(5, 3, 'next')).toBe('hidden')
  })

  it('prev turn mirrors: committed outgoing, spread-1 incoming', () => {
    expect(liveSpreadRole(3, 3, 'prev')).toBe('outgoing')
    expect(liveSpreadRole(2, 3, 'prev')).toBe('incoming')
    expect(liveSpreadRole(4, 3, 'prev')).toBe('hidden')
  })

  it('commit atomicity: the instant the driver advances committedSpread and nulls the frame, the outgoing spread must land hidden and the incoming one current — no dihedral-PI pop-open', () => {
    // Before commit (mid next-turn from 3): 3 outgoing, 4 incoming.
    expect(liveSpreadRole(3, 3, 'next')).toBe('outgoing')
    expect(liveSpreadRole(4, 3, 'next')).toBe('incoming')
    // After commit (committedSpread=4, frame null) in the SAME rAF:
    expect(liveSpreadRole(3, 4, null)).toBe('hidden')
    expect(liveSpreadRole(4, 4, null)).toBe('current')
    // The React-clock failure this replaces: a stale 'outgoing' prop meeting
    // a null frame solves at dihedral PI (fully open). Prove the dihedral
    // that pairing produces is the rest pose — i.e. only a stale role could
    // ever pop the folded scene open, never the live one.
    expect(spreadDihedral('outgoing', null, 0)).toBeCloseTo(Math.PI, 12)
    expect(spreadDihedral(liveSpreadRole(4, 4, null) as 'current', null, 0)).toBeCloseTo(Math.PI, 12)
  })
})

describe('tilted gearing (bulge, derive-bulge.mjs A16/A17) — sheet sweep and page angles', () => {
  const FLAT_EPSILON = 0.02
  const N = 9 // INTERIOR_SHEETS

  it('A16: the sweep starts exactly in the lifted plane and ends exactly in the landing plane', () => {
    for (let s = 1; s <= N - 1; s++) {
      const next = sheetSweepTilted('next', s)
      expect(sheetAngleTilted('next', 0, s)).toBeCloseTo(next.from, 12)
      expect(sheetAngleTilted('next', 1, s)).toBeCloseTo(next.to, 12)
      // outgoing dihedral at e=0 equals the spread's rest dihedral exactly
      const out0 = spreadPageAnglesTilted(s, s, 'next', 0)
      const rest = spreadPageAnglesTilted(s, s, null, 0)
      expect(out0.thetaL - out0.thetaR).toBeCloseTo(rest.thetaL - rest.thetaR, 12)
      // incoming dihedral at e=1 equals the NEXT spread's rest dihedral exactly
      const in1 = spreadPageAnglesTilted(s + 1, s, 'next', 1)
      const restNext = spreadPageAnglesTilted(s + 1, s + 1, null, 0)
      expect(in1.thetaL - in1.thetaR).toBeCloseTo(restNext.thetaL - restNext.thetaR, 12)
    }
  })

  it('A17: hand-off residual dihedrals sit strictly inside (0, FLAT_EPSILON)', () => {
    for (let s = 1; s <= N - 1; s++) {
      const in0 = spreadPageAnglesTilted(s + 1, s, 'next', 0)
      const out1 = spreadPageAnglesTilted(s, s, 'next', 1)
      for (const beta of [in0.thetaL - in0.thetaR, out1.thetaL - out1.thetaR]) {
        expect(beta).toBeGreaterThan(0)
        expect(beta).toBeLessThan(FLAT_EPSILON)
      }
    }
  })

  it('prev turns mirror next turns exactly', () => {
    for (let s = 2; s <= N; s++) {
      // prev from s lands on s-1; its sweep reverses s-1's next sweep
      const prev = sheetSweepTilted('prev', s)
      const nextOfPrior = sheetSweepTilted('next', s - 1)
      expect(prev.from).toBeCloseTo(nextOfPrior.to, 12)
      expect(prev.to).toBeCloseTo(nextOfPrior.from, 12)
      // incoming (s-1) at e=1 lands on its rest dihedral
      const in1 = spreadPageAnglesTilted(s - 1, s, 'prev', 1)
      const rest = spreadPageAnglesTilted(s - 1, s - 1, null, 0)
      expect(in1.thetaL - in1.thetaR).toBeCloseTo(rest.thetaL - rest.thetaR, 12)
    }
  })

  it('rest pose never opens flat and every shipped layer solves finitely at it', () => {
    for (const [name, layers] of SPREAD_SETS) {
      void name
      for (const layer of layers) {
        // spread indices 1..9; SPREAD_SETS names don't carry them, so solve
        // at the most-tilted rest poses (spreads 1 and 9) for every layer.
        for (const s of [1, 9]) {
          const { thetaL, thetaR } = spreadPageAnglesTilted(s, s, null, 0)
          expect(thetaL - thetaR).toBeLessThan(Math.PI)
          expect(thetaL - thetaR).toBeGreaterThan(2.9)
          for (const q of allQuads(layer, layers, thetaL, thetaR)) {
            for (const p of q.flat()) expect(Number.isFinite(p)).toBe(true)
          }
        }
      }
    }
  })
})

describe('cover-turn gearing (coverSpreadAngles) — the board IS the left plane', () => {
  it('isCoverPair matches the driver rule: spread 0 next / spread 1 prev, nothing else', () => {
    expect(isCoverPair(0, 'next')).toBe(true)
    expect(isCoverPair(1, 'prev')).toBe(true)
    expect(isCoverPair(0, 'prev')).toBe(false)
    expect(isCoverPair(1, 'next')).toBe(false)
    expect(isCoverPair(2, 'prev')).toBe(false)
    expect(isCoverPair(0, null)).toBe(false)
  })

  it('opening: flat-folded shut at e=0, EXACTLY spread 1 rest pose at e=1', () => {
    const shut = coverSpreadAngles('next', 0)
    expect(shut.thetaL).toBe(0)
    expect(shut.thetaR).toBe(0) // dihedral 0: everything folded flat under the board
    const open = coverSpreadAngles('next', 1)
    const rest = restAngles(1)
    expect(open.thetaL).toBeCloseTo(Math.PI - rest.aL, 12) // aL(1) = 0
    expect(open.thetaR).toBeCloseTo(rest.aR, 12) // the asin coincidence
  })

  it('closing mirrors opening exactly', () => {
    for (const e of [0, 0.25, 0.5, 0.75, 1]) {
      const closing = coverSpreadAngles('prev', e)
      const opening = coverSpreadAngles('next', 1 - e)
      expect(closing.thetaL).toBeCloseTo(opening.thetaL, 12)
      expect(closing.thetaR).toBeCloseTo(opening.thetaR, 12)
    }
  })

  it('the bloom is monotone and always a valid dihedral', () => {
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const { thetaL, thetaR } = coverSpreadAngles('next', i / 100)
      const beta = thetaL - thetaR
      expect(beta).toBeGreaterThanOrEqual(0)
      expect(beta).toBeLessThanOrEqual(Math.PI)
      expect(beta).toBeGreaterThanOrEqual(prev)
      prev = beta
    }
  })

  it('spreadPageAnglesTilted routes spread 1 through the cover gearing and parks everyone else at rest', () => {
    for (const e of [0, 0.3, 0.7, 1]) {
      expect(spreadPageAnglesTilted(1, 0, 'next', e)).toEqual(coverSpreadAngles('next', e))
      expect(spreadPageAnglesTilted(1, 1, 'prev', e)).toEqual(coverSpreadAngles('prev', e))
    }
    // A warm-window neighbor mid-cover-turn holds its rest pose (hidden).
    const parked = spreadPageAnglesTilted(2, 0, 'next', 0.5)
    const rest2 = spreadPageAnglesTilted(2, 2, null, 0)
    expect(parked).toEqual(rest2)
  })

  it('every spread-1 layer solves finitely across the whole cover bloom', () => {
    const layers = EXTRA_SPREAD_LAYERS[1] ?? []
    expect(layers.length).toBeGreaterThan(0) // the title spread ships pop-ups
    for (let i = 0; i <= 20; i++) {
      const { thetaL, thetaR } = coverSpreadAngles('next', i / 20)
      if (thetaL - thetaR <= 0.02) continue // under FLAT_EPSILON the engine hides pieces
      for (const layer of layers) {
        for (const q of allQuads(layer, layers, thetaL, thetaR)) {
          for (const p of q.flat()) expect(Number.isFinite(p)).toBe(true)
        }
      }
    }
  })
})


// ---------------------------------------------------------------------------
// PULL-STRIP ERECTED FLAP — derive-pullstrip.mjs gates ported in-engine
// (C6 round 7c: off-center figures with no visible connector, law L5).
// ---------------------------------------------------------------------------
describe('stripflap — hidden-strip erection (P1/P2/P3/P6 gates)', () => {
  const FLAP: LayerGeom = {
    mech: 'stripflap',
    side: 'left',
    anchor: 0.22,
    anchorZ: -0.26,
    slot: 0.3,
    slotZ: -0.26,
    hingeX: 0.35,
    hingeZ: -0.26,
    width: 0.3,
    height: 0.28,
  }
  const REST_BETA = rad(176)

  it('P2: lies exactly flat at book-closed, at every bisector angle', () => {
    for (const m of [0, Math.PI / 6, Math.PI / 2, Math.PI]) {
      const pose = solveStripFlapPose(FLAP, m, m)
      for (const p of [...pose.right, ...pose.left]) {
        expect(Math.abs(p[0] * Math.sin(m) - p[1] * Math.cos(m))).toBeLessThan(1e-12)
      }
    }
  })

  it('P2: stands within a press-gap of upright at the erectAt dihedral, monotone rise', () => {
    // the 0.995 press-gap caps theta a hair under beta everywhere, so at
    // the rest dihedral the flap reads upright to within half a degree.
    const rest = solveStripFlapPose(FLAP, Math.PI / 2 + REST_BETA / 2, Math.PI / 2 - REST_BETA / 2)
    const up = Math.atan2(Math.hypot(rest.crease[0], rest.crease[2]), rest.crease[1])
    // upright relative to its page; the page itself rests ~2 deg shy of flat
    expect(Math.abs(up)).toBeLessThan(rad(3))
    let prev = -1
    for (let i = 0; i <= 60; i++) {
      const beta = (i / 60) * REST_BETA
      const pose = solveStripFlapPose(FLAP, Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2)
      const lift = Math.asin(Math.min(1, Math.max(-1, pose.crease[1])))
      expect(lift).toBeGreaterThanOrEqual(prev - 1e-6) // graze bisection resolution
      prev = lift
    }
  })

  it('P6: press-and-peel — the flap never leaves the closing wedge (theta <= beta)', () => {
    for (let i = 1; i <= 90; i++) {
      const beta = (i / 90) * Math.PI
      const pose = solveStripFlapPose(FLAP, beta, 0)
      // every corner inside the dihedral wedge: above the right page and
      // below the left page plane
      for (const p of [...pose.right, ...pose.left]) {
        expect(p[1]).toBeGreaterThanOrEqual(-1e-9)
        expect(p[0] * Math.sin(beta) - p[1] * Math.cos(beta)).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  })

  it('P3: frontal facing at rest, at any station — and the halves stay coplanar', () => {
    for (const hingeX of [0.2, 0.35, 0.6]) {
      const geom: LayerGeom = { ...FLAP, hingeX }
      const pose = solveStripFlapPose(geom, Math.PI / 2 + REST_BETA / 2, Math.PI / 2 - REST_BETA / 2)
      // face normal = hinge x crease; frontal hinge (0 deg) faces +-z
      const nx = pose.glueR[1] * pose.crease[2] - pose.glueR[2] * pose.crease[1]
      const ny = pose.glueR[2] * pose.crease[0] - pose.glueR[0] * pose.crease[2]
      const nz = pose.glueR[0] * pose.crease[1] - pose.glueR[1] * pose.crease[0]
      const len = Math.hypot(nx, ny, nz)
      expect(Math.abs(nz / len)).toBeGreaterThan(0.95)
      // coplanar halves: the left panel's outer corners lie in the right
      // panel's plane (single sheet, invisible center seam)
      const [o, r1, r2] = [pose.right[0], pose.right[1], pose.right[3]]
      const u: [number, number, number] = [r1[0] - o[0], r1[1] - o[1], r1[2] - o[2]]
      const v: [number, number, number] = [r2[0] - o[0], r2[1] - o[1], r2[2] - o[2]]
      const pn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const pl = Math.hypot(pn[0], pn[1], pn[2])
      for (const p of [pose.left[1], pose.left[2]]) {
        const d =
          ((p[0] - o[0]) * pn[0] + (p[1] - o[1]) * pn[1] + (p[2] - o[2]) * pn[2]) / pl
        expect(Math.abs(d)).toBeLessThan(1e-12)
      }
    }
  })
})
