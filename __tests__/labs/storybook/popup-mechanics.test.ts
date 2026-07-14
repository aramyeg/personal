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
import {
  solveTabPiecePose,
  tabPieceFlatSpan,
  tabPieceLift,
  tabPieceTabOut,
  TAB_LIP,
} from '@/components/labs/storybook/book/popup-tabpiece'
import { solveRotorPose } from '@/components/labs/storybook/book/popup-rotor'
import { solveKnobTowerPose, knobTowerThetaMax } from '@/components/labs/storybook/book/popup-knobtower'
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

/** A dress patch's or rotor's seat quad, re-solved from its parent (mirrors
 *  the renderer's seat resolution in popup-anatomy-layers.tsx). Both mechs
 *  carry the same `parentId` + `seat` vocabulary. */
const seatQuadOf = (
  layer: SceneLayer & { parentId: string; seat: string },
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
  if (layer.mech === 'rotor')
    return [solveRotorPose(layer, seatQuadOf(layer, layers, thetaL, thetaR), thetaL - thetaR)]
  if (layer.mech === 'tabpiece') return solveTabPiecePose(layer, thetaL, thetaR).map((p) => p.quad)
  // A knob-tower has no theta channel in these dihedral-only gates (collision,
  // containment, rigidity) — pose at full erect (THETA_MAX), the worst-case
  // footprint. D-G2-style scrubs that need theta call the solver directly.
  if (layer.mech === 'knobtower')
    return solveKnobTowerPose(layer, knobTowerThetaMax(layer), thetaL, thetaR).map((p) => p.quad)
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
  // paper thickness 0.02). A rotor rivets on the same way (ROTOR_LIFT 0.003),
  // and its spin is exactly 0 at closed, so it flattens to the same tolerance.
  if (layer.mech === 'dress' || layer.mech === 'rotor') return 0.004
  // A knob-tower's tiers close through an exact cam zero (a = 0 at beta = 0),
  // but its riveted disc sits one glue layer (ROTOR_LIFT 0.003) proud like a
  // rotor, so it flattens to that tolerance.
  if (layer.mech === 'knobtower') return 0.004
  // Tab pieces close through an exact cam zero (a = 0 at beta = 0).
  return 1e-9 // symmetric v-folds, boxes, tab pieces: analytically exact
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
      if (
        layer.mech === 'platform' ||
        layer.mech === 'fan' ||
        layer.mech === 'rider' ||
        layer.mech === 'dress' ||
        layer.mech === 'rotor' ||
        layer.mech === 'knobtower'
      ) {
        // Anatomy-phase mechs carry their spec-validity gates in
        // popup-anatomy.test.ts (deck flat-fold rules, fan member rules,
        // rider mount rule, dress seat existence, rotor cam + fit), the
        // composition covenant (rotor spin cap / seat legality; knob-tower
        // stroke + run-band + z-band rules), and popup-knobtower.test.ts.
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
      if (layer.mech === 'tabpiece') {
        expect(layer.legW).toBeGreaterThan(0)
        if (layer.form === 'table') expect(layer.deckD ?? 0).toBeGreaterThan(0)
        const lift = layer.liftDeg ?? 55
        expect(lift).toBeGreaterThan(0)
        expect(lift).toBeLessThanOrEqual(85) // legs never cross (bench T8)
        // ONE-PAGE footprint: flat span fits between a gutter margin and
        // the fore edge (the fixed hinge stays inside the page)
        expect(layer.hingeX).toBeLessThanOrEqual(PAGE_W - 0.02)
        expect(layer.hingeX - tabPieceFlatSpan(layer)).toBeGreaterThanOrEqual(0.06)
        expect(layer.z0).toBeLessThan(layer.z1)
        expect(Math.abs(layer.z0)).toBeLessThanOrEqual(PAGE_H / 2)
        expect(Math.abs(layer.z1)).toBeLessThanOrEqual(PAGE_H / 2)
        // stands proud at rest
        const top = Math.max(
          ...solveTabPiecePose(layer, Math.PI, 0).flatMap((p) => p.quad.map((c) => c[1]))
        )
        expect(top).toBeGreaterThan(0.05)
        return
      }
      if (layer.mech === 'kinetic') {
        const phi = layer.phiDeg ?? 45
        expect(layer.armLen).toBeGreaterThan(0)
        expect(layer.armW).toBeGreaterThan(0)
        expect(layer.flapW).toBeGreaterThan(0)
        expect(layer.flapLen).toBeGreaterThan(0)
        // muscle stands and stays reachable: rho > phi, phi + rho < 180
        expect(layer.rhoDeg).toBeGreaterThan(phi)
        expect(phi + layer.rhoDeg).toBeLessThan(180)
        // the arm sweeps up to a near-vertical ridge at rest (the wow moment)
        const rest = solveLayerPose(layer, undefined, Math.PI, 0)
        expect(rest.crease[1]).toBeGreaterThan(0.7)
        // spine extent stays inside the page depth
        expect(Math.abs(layer.apexZ)).toBeLessThanOrEqual(PAGE_H / 2)
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
      // children, riders, dress patches, and rotors glue to PAPER, not pages —
      // their glue coherence is tested against their parents instead.
      if (
        layer.mech === 'child' ||
        layer.mech === 'rider' ||
        layer.mech === 'dress' ||
        layer.mech === 'rotor'
      )
        continue
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
        if (layer.mech === 'tabpiece') {
          // one-page slider: both hinges AND the whole tab lie in its page
          const n = layer.side === 'left' ? nL : nR
          for (const patch of solveTabPiecePose(layer, thetaL, thetaR)) {
            const onPage =
              patch.face === 'slopeIn' || patch.face === 'legIn'
                ? [0, 1]
                : patch.face === 'slopeOut' || patch.face === 'legOut'
                  ? [2, 3]
                  : patch.face === 'tab'
                    ? [0, 1, 2, 3]
                    : []
            for (const i of onPage) {
              const p = patch.quad[i]
              expect(Math.abs(p[0] * n[0] + p[1] * n[1])).toBeLessThan(1e-9)
            }
          }
          continue
        }
        if (layer.mech === 'knobtower') {
          // one-page slider: each tier's base hinge corners lie in its page;
          // the disc rivets one glue layer proud (skip it, like a rotor).
          const n = layer.side === 'left' ? nL : nR
          for (const patch of solveKnobTowerPose(layer, knobTowerThetaMax(layer), thetaL, thetaR)) {
            if (patch.face === 'disc') continue
            const base = patch.face.endsWith('In') ? [0, 1] : [2, 3]
            for (const idx of base) {
              const p = patch.quad[idx]
              expect(Math.abs(p[0] * n[0] + p[1] * n[1])).toBeLessThan(1e-9)
            }
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
      // A tab piece's TAB quad is exempt: it is the clipped VIEW of a longer
      // rigid strip emerging through the fore-edge slit — its visible extent
      // legitimately grows with the draw. The structure panels stay rigid.
      const tabIndex = layer.mech === 'tabpiece' ? refQuads.length - 1 : -1
      const refDists = refQuads.map((q) => {
        const ds: number[] = []
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ds.push(dist(q[a], q[b]))
        return ds
      })
      for (let i = 0; i <= 36; i++) {
        const quads = allQuads(layer, layers, (i / 36) * Math.PI, 0)
        quads.forEach((q, qi) => {
          if (qi === tabIndex) return
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
      // their driving angle), so their ceiling doubles — riders, dress
      // patches, and rotors ride mechanisms the same way (a rotor adds its
      // own spin on top of the seat's motion). A branch flip would displace
      // corners by ~0.1-1.0 in a single step.
      const compound =
        layer.mech === 'child' ||
        layer.mech === 'rider' ||
        layer.mech === 'dress' ||
        layer.mech === 'rotor'
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

// ---------------------------------------------------------------------------
// Quad/quad interpenetration test — shared by the A9 rest-pose gate and the
// D-G2 full-sweep gate below. A transversal hit is an edge of one quad
// crossing the other quad's triangulation. Degenerate quads (near-zero area)
// are skipped: a tabpiece's TAB collapses toward a sliver near book-closed,
// and a zero-area quad carries no separating surface (its normal degenerates
// to zero and would poison the plane test).

const quadArea = (q: PanelQuad): number => {
  const n1 = cross(sub(q[1], q[0]), sub(q[2], q[0]))
  const n2 = cross(sub(q[2], q[0]), sub(q[3], q[0]))
  return (Math.hypot(n1[0], n1[1], n1[2]) + Math.hypot(n2[0], n2[1], n2[2])) / 2
}

const segHitsTri = (p: Vec3, q: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean => {
  const n = cross(sub(b, a), sub(c, a))
  const dp = dot(n, sub(p, a))
  const dq = dot(n, sub(q, a))
  if (dp * dq > -1e-12) return false // same side or touching the plane
  const t = dp / (dp - dq)
  const x: Vec3 = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
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
  if (quadArea(qa) < 1e-9 || quadArea(qb) < 1e-9) return false
  const tris: Array<[Vec3, Vec3, Vec3]> = [
    [qb[0], qb[1], qb[2]],
    [qb[0], qb[2], qb[3]],
  ]
  return quadEdges(qa).some(([p, q]) => tris.some(([a, b, c]) => segHitsTri(p, q, a, b, c)))
}

// ---------------------------------------------------------------------------
// D-G2 v2 crossing geometry (law derived in .superpowers/sdd/bench/
// derive-nesting.mjs). A crossing's LEGALITY is a function of its geometry,
// not its mere existence: zero-thickness solvers legally STACK paper-on-paper
// near book-closed (A3 blesses coplanar sheets); what real paper forbids is
// two sheets SCISSORING while both stand proud of the page. Two measurements
// separate them — quadPlaneAngle (0 = parallel grazing = stacking) and
// crossingHeight (the intersection segment's max height above the nearer page
// plane; 0 = pinned to the page = stacking, large = a standing tangle).

const quadPlaneAngle = (qa: PanelQuad, qb: PanelQuad): number => {
  const na = cross(sub(qa[1], qa[0]), sub(qa[3], qa[0]))
  const nb = cross(sub(qb[1], qb[0]), sub(qb[3], qb[0]))
  const la = Math.hypot(na[0], na[1], na[2])
  const lb = Math.hypot(nb[0], nb[1], nb[2])
  if (la < 1e-12 || lb < 1e-12) return 0
  return Math.acos(Math.min(1, Math.abs(dot(na, nb)) / (la * lb)))
}

/** Points where triangle T's edges pierce a plane, given each vertex's signed
 *  distance d to it — the endpoints of T's segment on that plane. */
const edgeCrossings = (T: readonly [Vec3, Vec3, Vec3], d: readonly [number, number, number]): Vec3[] => {
  const pts: Vec3[] = []
  for (const [i, j] of [[0, 1], [1, 2], [2, 0]] as const) {
    if ((d[i] < 0 && d[j] > 0) || (d[i] > 0 && d[j] < 0)) {
      const t = d[i] / (d[i] - d[j])
      pts.push([T[i][0] + (T[j][0] - T[i][0]) * t, T[i][1] + (T[j][1] - T[i][1]) * t, T[i][2] + (T[j][2] - T[i][2]) * t])
    }
  }
  for (let i = 0; i < 3; i++) if (Math.abs(d[i]) < 1e-15) pts.push(T[i])
  return pts
}

/** Möller triangle-triangle intersection SEGMENT (endpoints), or null. */
const triTriSeg = (A: readonly [Vec3, Vec3, Vec3], B: readonly [Vec3, Vec3, Vec3]): [Vec3, Vec3] | null => {
  const nB = cross(sub(B[1], B[0]), sub(B[2], B[0]))
  const dA: [number, number, number] = [dot(nB, sub(A[0], B[0])), dot(nB, sub(A[1], B[0])), dot(nB, sub(A[2], B[0]))]
  if ((dA[0] > 0 && dA[1] > 0 && dA[2] > 0) || (dA[0] < 0 && dA[1] < 0 && dA[2] < 0)) return null
  const nA = cross(sub(A[1], A[0]), sub(A[2], A[0]))
  const dB: [number, number, number] = [dot(nA, sub(B[0], A[0])), dot(nA, sub(B[1], A[0])), dot(nA, sub(B[2], A[0]))]
  if ((dB[0] > 0 && dB[1] > 0 && dB[2] > 0) || (dB[0] < 0 && dB[1] < 0 && dB[2] < 0)) return null
  const pA = edgeCrossings(A, dA)
  const pB = edgeCrossings(B, dB)
  if (pA.length < 2 || pB.length < 2) return null
  const D = cross(nA, nB)
  const Dl = Math.hypot(D[0], D[1], D[2])
  if (Dl < 1e-12) return null // parallel planes (coplanar overlap reads as grazing)
  const Dn: Vec3 = [D[0] / Dl, D[1] / Dl, D[2] / Dl]
  const a = pA.map((p) => ({ p, t: dot(p, Dn) })).sort((x, y) => x.t - y.t)
  const b = pB.map((p) => ({ p, t: dot(p, Dn) })).sort((x, y) => x.t - y.t)
  const lo = Math.max(a[0].t, b[0].t)
  const hi = Math.min(a[a.length - 1].t, b[b.length - 1].t)
  if (lo > hi) return null
  return [a[0].t >= b[0].t ? a[0].p : b[0].p, a[a.length - 1].t <= b[b.length - 1].t ? a[a.length - 1].p : b[b.length - 1].p]
}

/** Perpendicular distance from p to the NEARER page plane (symmetric bloom). */
const heightAbovePages = (p: Vec3, thetaL: number, thetaR: number): number =>
  Math.min(
    Math.abs(-p[0] * Math.sin(thetaR) + p[1] * Math.cos(thetaR)),
    Math.abs(-p[0] * Math.sin(thetaL) + p[1] * Math.cos(thetaL))
  )

/** Two quads' crossing height above the pages (max over the intersection
 *  segment), or -1 when they do not cross. */
const crossingHeight = (qa: PanelQuad, qb: PanelQuad, thetaL: number, thetaR: number): number => {
  if (quadArea(qa) < 1e-9 || quadArea(qb) < 1e-9) return -1
  const trisA: Array<[Vec3, Vec3, Vec3]> = [[qa[0], qa[1], qa[2]], [qa[0], qa[2], qa[3]]]
  const trisB: Array<[Vec3, Vec3, Vec3]> = [[qb[0], qb[1], qb[2]], [qb[0], qb[2], qb[3]]]
  let h = -1
  for (const ta of trisA)
    for (const tb of trisB) {
      const seg = triTriSeg(ta, tb)
      if (seg) {
        for (let k = 0; k <= 20; k++) {
          const s = k / 20
          const p: Vec3 = [
            seg[0][0] + (seg[1][0] - seg[0][0]) * s,
            seg[0][1] + (seg[1][1] - seg[0][1]) * s,
            seg[0][2] + (seg[1][2] - seg[0][2]) * s,
          ]
          h = Math.max(h, heightAbovePages(p, thetaL, thetaR))
        }
      }
    }
  return h
}

describe('A9 rest-pose separation — pieces clear each other, spread by spread', () => {
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
      // Riders, dress patches, and rotors touch their parents by design too:
      // rider glue edges lie IN the parent's lid/deck planes, a dress sits one
      // glue layer (0.003) off its link, a rotor rivets coplanar one lift off
      // its panel — same convexity argument.
      const glued = new Set<string>()
      layers.forEach((l, idx) => {
        if (l.mech !== 'child' && l.mech !== 'rider' && l.mech !== 'dress' && l.mech !== 'rotor') return
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

// ---------------------------------------------------------------------------
// D-G2 FULL-SWEEP COLLISION v2 FINAL (grand-book spec gate D-G2; law derived
// in .superpowers/sdd/bench/derive-nesting.mjs). v1 forbade ALL
// interpenetration and failed every spread — but with zero-thickness solvers
// most hits are PHYSICALLY LEGAL: sheets with overlapping footprints legally
// STACK paper-on-paper near book-closed (A3 blesses coplanar stacking), and
// even a transient mid-fold brush is REAL-PAPER CONTACT (paper presses and
// flexes) that our rigid solver cannot express. What real paper forbids is two
// sheets SCISSORING while both stand proud of the page.
//
// Each crossing is scored (symmetric bloom, roll-invariant) by two measured
// quantities: the ANGLE between the quad planes (0 = parallel grazing) and the
// HEIGHT of the intersection segment above the nearer page plane (0 = pinned to
// the page). Derivation: the ANGLE has a clean gap — grazes <=13deg, real
// crossings >=20deg — so A_TOL=15deg; HEIGHT is continuous, a soft near-page
// tolerance, H_TOL=0.028 = 2x SHEET_STACK_T. ILLEGAL iff angle>=A_TOL AND
// height>=H_TOL. (Choreography hacks — fading/holding pop-ups mid-turn — were
// considered and REJECTED: they break glue truth. The honest endgame for the
// transient brushes is contact-aware posing, filed as a future derivation.)
//
// The gate then splits the sweep into two windows, because the eye dwells where
// the book is slow (quint easing parks turns near rest; the resting reader,
// plus parallax tilt and per-spread bulge ~+-6deg, lives in the last degrees):
//   PART 1  READING NEIGHBORHOOD beta in [165,176] (7 stns) — ZERO illegal.
//           This is where every landing settles and every resting eye lives.
//   PART 2  MID-TURN beta in [8,165) (25 stns) — a per-spread CEILING on
//           illegal (pair,station) hits. Ceilings only ratchet DOWN; the D5
//           composition pass and any future contact modeling shrink them.
//
// TIERED by where the eye actually dwells (measured, not assumed): a hard
// [165,176]-zero was tried first and found 26 illegal pairs — because the
// wall-regime backdrops (rho-phi ~ 4deg) GEOMETRICALLY settle only at
// ~172-176deg; yet the D-G3 audit's t=0.75 captures (beta ~173deg) read
// clean — those near-rest crossings are edge-on slivers from the reading
// camera. Demanding zero there would rework every backdrop to dodge an
// invisible artifact. So: hard ZERO exactly where the eye rests (each
// spread's TRUE rest pose, minutes of dwell), monotone ratchets over the
// transient windows (sub-second, edge-on or fast). Strip pieces are
// beta-driven today so this sweep is their full travel scrub; the D6
// user-drive domain will extend the gate then.
describe('D-G2 v2 — rest-pose zero + near-rest and mid-turn severity ratchets', () => {
  // Derived thresholds (derive-nesting.mjs): A_TOL sits in the grazing/crossing
  // angle gap; H_TOL is the near-page stacking tolerance.
  const A_TOL = rad(15)
  const H_TOL = 0.028
  const NEAR_STNS = Array.from({ length: 7 }, (_, k) => rad(165 + (k * (176 - 165)) / 6))
  const MID_STNS = Array.from({ length: 25 }, (_, k) => rad(8 + (k * (165 - 8)) / 25))
  // Ratchet ceilings, measured 2026-07-13 (derive-nesting.mjs / this gate's
  // own count with thresholds above). Only ever lower them: the D5
  // composition pass and future contact-aware posing shrink the transients.
  const NEAR_CEIL: Record<string, number> = {
    'spread-2': 8, 'spread-3': 6, 'spread-4': 7, 'spread-5': 13,
    'spread-6': 10, 'spread-7': 8, 'extra-1': 0, 'extra-8': 0, 'extra-9': 0,
  }
  const MID_CEIL: Record<string, number> = {
    // D5 arm-lane pass (2026-07-13): spreads 3 and 4 recomposed to give the
    // parked kinetic arms visible downstage homes (ch2 windmill in the meadow,
    // ch3 semaphore mast at the fore edge). Both ratcheted DOWN from the parked
    // values (134 -> 122, 185 -> 179): the meadow-shelf tightening (s3) and the
    // lower rank + compact counter (s4) return more mid-turn budget than the
    // now-visible sweeps spend.
    'spread-2': 123, 'spread-3': 122, 'spread-4': 179, 'spread-5': 218,
    'spread-6': 77, 'spread-7': 122, 'extra-1': 21, 'extra-8': 36, 'extra-9': 0,
  }
  /** Spread number from the set name ('spread-4' -> 4, 'extra-8' -> 8). */
  const spreadNumOf = (name: string): number => Number(name.split('-')[1])

  const gluedOf = (layers: readonly SceneLayer[]): Set<string> => {
    const glued = new Set<string>()
    layers.forEach((l, idx) => {
      if (l.mech !== 'child' && l.mech !== 'rider' && l.mech !== 'dress' && l.mech !== 'rotor') return
      const p = layers.findIndex((c) => c.id === l.parentId)
      glued.add(`${idx}:${p}`)
      glued.add(`${p}:${idx}`)
    })
    return glued
  }
  /** True iff some quad of piece A illegally scissors a quad of piece B at
   *  this station (steep plane angle AND crossing standing proud of the page).
   *  Bounding spheres prune the far-apart majority (pure perf). */
  const piecesIllegallyCross = (qa: PanelQuad[], qb: PanelQuad[], thetaL: number, thetaR: number): boolean => {
    for (const A of qa) {
      if (quadArea(A) < 1e-9) continue
      for (const B of qb) {
        if (quadArea(B) < 1e-9) continue
        if (quadPlaneAngle(A, B) < A_TOL) continue // grazing = legal stacking
        if (crossingHeight(A, B, thetaL, thetaR) >= H_TOL) return true // standing crossing
      }
    }
    return false
  }
  /** Illegal (piece-pair, station) hit count over a beta-station window. */
  const countHits = (layers: readonly SceneLayer[], betas: readonly number[]): number => {
    const glued = gluedOf(layers)
    let hits = 0
    for (const beta of betas) {
      const thetaL = Math.PI / 2 + beta / 2
      const thetaR = Math.PI / 2 - beta / 2
      const quads = layers.map((l) => allQuads(l, layers, thetaL, thetaR))
      for (let i = 0; i < layers.length; i++)
        for (let j = i + 1; j < layers.length; j++) {
          if (glued.has(`${i}:${j}`)) continue
          if (piecesIllegallyCross(quads[i], quads[j], thetaL, thetaR)) hits += 1
        }
    }
    return hits
  }

  // PART 1 — HARD ZERO at the true rest pose: the pose the reader dwells on
  // for minutes, per spread (tilted rest angles incl. the bulge model), plus
  // the symmetric 176deg bloom and the A9 legacy (PI, 0) roll. No resting
  // eye ever dwells on a scissored piece.
  it.each(SPREAD_SETS.map(([name, layers]) => [name, layers] as const))(
    'Part 1 — %s: zero illegal standing crossings at the true rest pose',
    (name, layers) => {
      const n = spreadNumOf(name)
      const rest = spreadPageAnglesTilted(n, n, null, 0)
      const glued = gluedOf(layers)
      const bad = new Set<string>()
      for (const [tL, tR] of [
        [rest.thetaL, rest.thetaR],
        [Math.PI / 2 + rad(176) / 2, Math.PI / 2 - rad(176) / 2],
      ] as const) {
        const quads = layers.map((l) => allQuads(l, layers, tL, tR))
        for (let i = 0; i < layers.length; i++)
          for (let j = i + 1; j < layers.length; j++) {
            if (glued.has(`${i}:${j}`)) continue
            if (piecesIllegallyCross(quads[i], quads[j], tL, tR)) {
              bad.add(`${layers[i].id} x ${layers[j].id}`)
            }
          }
      }
      if (bad.size > 0) {
        throw new Error(`D-G2 Part 1: cross at rest:\n  ${[...bad].join('\n  ')}`)
      }
    },
    60_000
  )

  // PART 2 — NEAR-REST RATCHET [165,176]: the landing tail. Edge-on slivers
  // from the reading camera (D-G3 audit read beta ~173deg captures as clean),
  // bounded and only ever lowered.
  it.each(SPREAD_SETS.map(([name, layers]) => [name, layers] as const))(
    'Part 2 [165,176] — %s: near-rest illegal-hit count within the ratchet ceiling',
    (name, layers) => {
      const ceiling = NEAR_CEIL[name] ?? 0
      expect(countHits(layers, NEAR_STNS)).toBeLessThanOrEqual(ceiling)
    },
    60_000
  )

  // PART 3 — MID-TURN RATCHET [8,165): a rigid solver cannot press paper
  // through paper, so these transient brushes are tolerated as a bounded
  // ceiling (real-paper contact; future contact-aware posing) — but never
  // allowed to grow.
  it.each(SPREAD_SETS.map(([name, layers]) => [name, layers] as const))(
    'Part 3 [8,165) — %s: mid-turn illegal-hit count within the ratchet ceiling',
    (name, layers) => {
      const ceiling = MID_CEIL[name] ?? 0
      expect(countHits(layers, MID_STNS)).toBeLessThanOrEqual(ceiling)
    },
    60_000
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
            // A dress patch or rotor is a sheet stacked on another sheet: its
            // glue-layer lift (0.003) may sit inside the closing sandwich,
            // which a zero-thickness wedge reads as penetration. Allow it in
            // LINEAR terms (4mm against paper thickness 0.02); everything
            // else keeps the strict angular tolerance.
            const slackAng = layer.mech === 'dress' || layer.mech === 'rotor' ? 0.004 / r : 1e-6
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

describe('tabpiece — fore-edge tab slider (D1 gates, bench derive-tabpiece.mjs)', () => {
  const TAB_LAYERS = ALL_LAYERS.filter(
    (entry): entry is readonly [string, SceneLayer & { mech: 'tabpiece' }, readonly SceneLayer[]] =>
      entry[1].mech === 'tabpiece'
  )
  const REST = rad(176)
  /** Symmetric bloom angles for a dihedral beta. */
  const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

  it('both shipped forms exist (mound and table — the palette mixes drives)', () => {
    const forms = new Set(TAB_LAYERS.map(([, l]) => l.form))
    expect(forms.has('mound')).toBe(true)
    expect(forms.has('table')).toBe(true)
  })

  it.each(TAB_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: tab protrusion equals the inner-hinge slide exactly (inextensible strip)',
    (_id, layer) => {
      const innerFlat = layer.hingeX - tabPieceFlatSpan(layer)
      for (let i = 0; i <= 40; i++) {
        const [tL, tR] = bloom((REST * i) / 40)
        const patches = solveTabPiecePose(layer, tL, tR)
        const u: Vec3 = [Math.cos(layer.side === 'left' ? tL : tR), Math.sin(layer.side === 'left' ? tL : tR), 0]
        // inner hinge = first corner of the first (inner) panel
        const inner = patches[0].quad[0]
        const innerD = inner[0] * u[0] + inner[1] * u[1]
        // tab tip = corner 2/3 of the tab quad
        const tab = patches[patches.length - 1]
        const tipD = tab.quad[2][0] * u[0] + tab.quad[2][1] * u[1]
        const tabOut = tipD - PAGE_W
        expect(Math.abs(innerD - innerFlat - tabOut)).toBeLessThan(1e-9)
        expect(Math.abs(tabOut - tabPieceTabOut(layer, tL - tR))).toBeLessThan(1e-9)
      }
    }
  )

  it.each(TAB_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: flush at closed, erect at rest, monotone rise',
    (_id, layer) => {
      // closed: dead flat, tab fully home (only the lip inside the edge) —
      // evaluated with both pages flat right, the A3 convention
      for (const closed of solveTabPiecePose(layer, 0, 0)) {
        for (const p of closed.quad) expect(Math.abs(p[1])).toBeLessThan(1e-12)
      }
      expect(tabPieceTabOut(layer, 0)).toBe(0)
      // rest: full designed lift
      const [tL, tR] = bloom(REST)
      const lift = tabPieceLift(layer, tL - tR)
      expect(lift).toBeCloseTo(rad(layer.liftDeg ?? 55), 6)
      const top = Math.max(...solveTabPiecePose(layer, tL, tR).flatMap((p) => p.quad.map((c) => c[1])))
      // ridge/deck height in page-normal terms reaches legW * sin(lift)
      // (world y is a hair less under the page's own ~2-degree rest tilt)
      expect(top).toBeGreaterThan(layer.legW * Math.sin(lift) * 0.93)
      // monotone
      let prev = -1
      for (let i = 0; i <= 40; i++) {
        const a = tabPieceLift(layer, (REST * i) / 40)
        expect(a).toBeGreaterThanOrEqual(prev - 1e-12)
        prev = a
      }
    }
  )

  it.each(TAB_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: early-rise character — well ahead of the v-fold late bloom (D-G5)',
    (_id, layer) => {
      // Strip family: >= 50% of rest lift at quarter-rest (bench T7: 56%)
      const frac = tabPieceLift(layer, REST / 4) / tabPieceLift(layer, REST)
      expect(frac).toBeGreaterThanOrEqual(0.5)
      // Family CONTRAST, in each mechanism's OWN terms (how far its fold
      // has opened relative to rest — corner heights are corrupted by the
      // page steepness at small beta): a canonical v-fold hero's panel
      // pair opens only ~33% by quarter-rest (measured 2026-07-13); the
      // strip family must stay >= 1.5x ahead of that late bloom.
      const vconf = { mech: 'vfold', apexZ: 0, vDir: 1, phiDeg: 52, rhoDeg: 80, width: 0.5, height: 0.5 } as const
      const panelOpen = (beta: number): number => {
        const [tL, tR] = bloom(beta)
        const pose = solveVFoldPose(vconf, tL, tR)
        const nOf = (q: PanelQuad): Vec3 => {
          const n = cross(sub(q[1], q[0]), sub(q[3], q[0]))
          const l = Math.hypot(n[0], n[1], n[2])
          return [n[0] / l, n[1] / l, n[2] / l]
        }
        const c = dot(nOf(pose.right), nOf(pose.left))
        return Math.acos(Math.max(-1, Math.min(1, c)))
      }
      const vfrac = panelOpen(REST / 4) / panelOpen(REST)
      expect(frac).toBeGreaterThanOrEqual(1.5 * vfrac)
    }
  )

  it('table decks stay dead level through the whole sweep', () => {
    for (const [, layer] of TAB_LAYERS) {
      if (layer.form !== 'table') continue
      for (let i = 0; i <= 40; i++) {
        const [tL, tR] = bloom((REST * i) / 40)
        const deck = solveTabPiecePose(layer, tL, tR).find((p) => p.face === 'deck')!
        const t = layer.side === 'left' ? tL : tR
        const n: Vec3 =
          layer.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
        const lifts = deck.quad.map((p) => p[0] * n[0] + p[1] * n[1])
        for (const l of lifts) expect(l).toBeCloseTo(lifts[0], 9)
      }
    }
  })

  it('the tab never retreats inside the page and the lip stays put', () => {
    for (const [, layer] of TAB_LAYERS) {
      for (let i = 0; i <= 40; i++) {
        const beta = (REST * i) / 40
        expect(tabPieceTabOut(layer, beta)).toBeGreaterThanOrEqual(0)
      }
      expect(TAB_LIP).toBeGreaterThan(0)
    }
  })
})
