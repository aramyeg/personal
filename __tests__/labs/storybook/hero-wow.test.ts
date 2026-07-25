import { describe, expect, it } from 'vitest'
import {
  solveBoxPose,
  solveLayerPose,
  spreadDihedral,
  type PanelQuad,
  type Vec3,
} from '@/components/labs/storybook/book/popup-mechanics'
import {
  solveDressPose,
  solveFanPose,
  solvePlatformPose,
  solveRiderPose,
} from '@/components/labs/storybook/book/popup-anatomy'
import { solveTabPiecePose } from '@/components/labs/storybook/book/popup-tabpiece'
import { solveRotorPose } from '@/components/labs/storybook/book/popup-rotor'
import { keepStackQuads } from '@/components/labs/storybook/book/popup-keepstack'
import { keepWinchOutputQuads, keepWinchThetaMax } from '@/components/labs/storybook/book/popup-keepwinch'
import { keepSkylineQuads } from '@/components/labs/storybook/book/popup-skyline'
import { swarmArcQuads } from '@/components/labs/storybook/book/popup-swarmarc'
import { easeTurnWeighted, PAGE_H } from '@/components/labs/storybook/book/page-geometry'
import {
  heroForSpread,
  popupContentForSpread,
  SPREAD_COUNT,
  type SceneLayer,
} from '@/components/labs/storybook/content'

// Benchmark Part D gates D-G1 (hero rotation) and D-G8 (wow floor), spec
// docs/superpowers/specs/2026-07-13-grand-book-benchmark.md. Every spread
// declares one hero layer whose motion is its signature moment. The gate:
//  (a) the hero id exists in its spread's layer list;
//  (b) no two CONSECUTIVE spreads (order 1..9) share the hero's FAMILY (the
//      family taxonomy is the covenant's familyOf, mirrored below);
//  (c) >= 6 distinct hero families across the book (D-G1 book-wide);
//  (d) the hero's measured max-corner SWEEP displacement across an incoming
//      turn clears 0.35 x page height (0.525 world units), OR the piece is
//      strip-driven (tabpiece/stripflap — the future-interactive vocabulary,
//      exempt per D-G8 "or the piece is interactive").
// The sweep is measured with the same clock/pose machinery the motion gates
// use (spreadDihedral incoming + easeTurnWeighted, symmetric bloom).

const WOW_FLOOR = 0.35 * PAGE_H // 0.525 world units
// The interactive vocabulary exempt from the page-turn sweep floor (D-G8 "or
// the piece is interactive"): tabpiece/stripflap were the FUTURE-interactive
// pieces; keepwinch is the REALIZED hand-driven crank (the E-G6 composed
// machine) — its signature moment is the twist-driven interaction, not a big
// page-turn corner sweep, exactly the exemption's rationale.
const STRIP_DRIVEN: ReadonlySet<string> = new Set(['tabpiece', 'stripflap', 'keepwinch'])

/** Hero-family taxonomy — mirrors familyOf in composition-covenant.test.ts.
 *  The rotation and >= 6-families gates are stated over these families. */
const familyOf = (l: SceneLayer): string => {
  switch (l.mech) {
    case 'child':
    case 'rider':
      return 'recursion'
    case 'kinetic':
    case 'rotor':
      return 'kinetic'
    default:
      return l.mech
  }
}

const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]

const parentOf = (layer: SceneLayer, layers: readonly SceneLayer[]): SceneLayer | undefined =>
  layer.mech === 'child' ? layers.find((l) => l.id === layer.parentId) : undefined

const seatQuadOf = (
  layer: SceneLayer & { parentId: string; seat: string },
  layers: readonly SceneLayer[],
  thetaL: number,
  thetaR: number
): PanelQuad => {
  const parent = layers.find((l) => l.id === layer.parentId)
  if (!parent) throw new Error(`${layer.id}: parent ${layer.parentId} not in spread`)
  if (parent.mech === 'box') {
    const patch = solveBoxPose(parent, thetaL, thetaR).find((p) => p.face === layer.seat)
    if (!patch) throw new Error(`${layer.id}: box has no face ${layer.seat}`)
    return patch.quad
  }
  if (parent.mech === 'platform') {
    const patch = solvePlatformPose(parent, thetaL, thetaR).find(
      (p) => p.face === layer.seat && p.bay === 0
    )
    if (!patch) throw new Error(`${layer.id}: platform has no face ${layer.seat}`)
    return patch.quad
  }
  const pose = solveLayerPose(parent, parentOf(parent, layers), thetaL, thetaR)
  return layer.seat === 'left' ? pose.left : pose.right
}

/** Every world-space quad a layer poses (one dispatcher for all mechanism
 *  families — mirrors allQuads in motion-character.test.ts). */
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
    if (!parent || (parent.mech !== 'box' && parent.mech !== 'platform' && parent.mech !== 'parallel'))
      throw new Error(`rider ${layer.id}: parent must be a box/platform/tent`)
    const pose = solveRiderPose(layer, parent, thetaL, thetaR)
    return [pose.right, pose.left]
  }
  if (layer.mech === 'dress') return [solveDressPose(layer, seatQuadOf(layer, layers, thetaL, thetaR))]
  if (layer.mech === 'rotor')
    return [solveRotorPose(layer, seatQuadOf(layer, layers, thetaL, thetaR), thetaL - thetaR)]
  if (layer.mech === 'tabpiece') return solveTabPiecePose(layer, thetaL, thetaR).map((p) => p.quad)
  if (layer.mech === 'keepstack') return keepStackQuads(layer, thetaL, thetaR)
  if (layer.mech === 'keepwinch') return keepWinchOutputQuads(layer, keepWinchThetaMax(layer), thetaL, thetaR)
  if (layer.mech === 'skyline') return keepSkylineQuads(layer, thetaL, thetaR)
  if (layer.mech === 'swarmarc') return swarmArcQuads(layer, thetaL, thetaR)
  const pose = solveLayerPose(layer, parentOf(layer, layers), thetaL, thetaR)
  return [pose.right, pose.left]
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Max-corner displacement between the flat (beta = 0) and full-open
 *  (beta = PI) poses of an incoming turn — the eased clock's endpoints. The
 *  tabpiece TAB quad is excluded (it is a clipped reveal through the fore-edge
 *  slit, not a swept body — same exclusion the motion gate makes). */
const heroSweep = (layer: SceneLayer, layers: readonly SceneLayer[]): number => {
  const [tL0, tR0] = bloom(spreadDihedral('incoming', 'next', easeTurnWeighted(0)))
  const [tL1, tR1] = bloom(spreadDihedral('incoming', 'next', easeTurnWeighted(1)))
  const q0 = allQuads(layer, layers, tL0, tR0)
  const q1 = allQuads(layer, layers, tL1, tR1)
  const c0 = (layer.mech === 'tabpiece' ? q0.slice(0, -1) : q0).flat()
  const c1 = (layer.mech === 'tabpiece' ? q1.slice(0, -1) : q1).flat()
  let max = 0
  for (let k = 0; k < c0.length; k++) max = Math.max(max, dist(c0[k], c1[k]))
  return max
}

type HeroRow = {
  spread: number
  hero: string
  family: string
  sweep: number
  exempt: boolean
  clears: boolean
}

const HERO_SPREADS: readonly number[] = Array.from({ length: SPREAD_COUNT - 1 }, (_, i) => i + 1)

const HERO_ROWS: readonly HeroRow[] = HERO_SPREADS.map((spread) => {
  const content = popupContentForSpread(spread)
  if (!content) throw new Error(`spread ${spread}: no pop-up content`)
  const heroId = heroForSpread(spread)
  if (!heroId) throw new Error(`spread ${spread}: no hero declared`)
  const layer = content.layers.find((l) => l.id === heroId)
  if (!layer) throw new Error(`spread ${spread}: hero '${heroId}' not in layers`)
  const sweep = heroSweep(layer, content.layers)
  const exempt = STRIP_DRIVEN.has(layer.mech)
  return {
    spread,
    hero: heroId,
    family: familyOf(layer),
    sweep: Number(sweep.toFixed(4)),
    exempt,
    clears: exempt || sweep >= WOW_FLOOR,
  }
})

describe('D-G8 wow floor + D-G1 hero rotation', () => {
  it('measurement table: hero sweep displacement per spread', () => {
    console.table(HERO_ROWS)
    console.log('wow floor =', WOW_FLOOR, 'world units (0.35 x PAGE_H)')
    expect(HERO_ROWS.length).toBe(9)
  })

  it('(a) every spread declares a hero that exists in its layer list', () => {
    // Construction of HERO_ROWS already throws if a hero id is missing; assert
    // the count so the guarantee is explicit and every spread is covered.
    expect(HERO_ROWS.map((r) => r.spread)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('(b) no two consecutive spreads share the hero family (rotation)', () => {
    for (let i = 1; i < HERO_ROWS.length; i++) {
      const prev = HERO_ROWS[i - 1]
      const curr = HERO_ROWS[i]
      expect(
        curr.family,
        `spreads ${prev.spread} (${prev.hero}) and ${curr.spread} (${curr.hero}) share family ${curr.family}`
      ).not.toBe(prev.family)
    }
  })

  it('(c) >= 6 distinct hero families book-wide', () => {
    const families = new Set(HERO_ROWS.map((r) => r.family))
    expect(families.size, `hero families: ${[...families].join(', ')}`).toBeGreaterThanOrEqual(6)
  })

  it.each(HERO_ROWS.map((r) => [r.spread, r] as const))(
    '(d) spread %s hero clears the wow floor or is strip-driven',
    (_spread, row) => {
      expect(
        row.clears,
        `${row.hero} (${row.family}) sweeps ${row.sweep} < ${WOW_FLOOR} and is not strip-driven`
      ).toBe(true)
    }
  )
})
