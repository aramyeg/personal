import { describe, expect, it } from 'vitest'
import {
  solveBoxPose,
  solveLayerPose,
  solveVFoldPose,
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
import { solveTabPiecePose, tabPieceLift } from '@/components/labs/storybook/book/popup-tabpiece'
import { solveRotorPose } from '@/components/labs/storybook/book/popup-rotor'
import { solveVolvellePose } from '@/components/labs/storybook/book/popup-volvelle'
import { solveLiftFlapPose, liftFlapMax } from '@/components/labs/storybook/book/popup-liftflap'
import { solveKnobTowerPose, knobTowerThetaMax } from '@/components/labs/storybook/book/popup-knobtower'
import { keepsakeCardInPlane } from '@/components/labs/storybook/book/popup-keepsake'
import { keepStackQuads } from '@/components/labs/storybook/book/popup-keepstack'
import { keepWinchOutputQuads, keepWinchThetaMax } from '@/components/labs/storybook/book/popup-keepwinch'
import { keepSkylineQuads } from '@/components/labs/storybook/book/popup-skyline'
import { swarmArcQuads } from '@/components/labs/storybook/book/popup-swarmarc'
import { solveMFoldRangePose } from '@/components/labs/storybook/book/popup-mfoldrange'
import { stagedChainQuads } from '@/components/labs/storybook/book/popup-stagedchain'
import { solveDepthVistaPose } from '@/components/labs/storybook/book/popup-depthvista'
import { solveDissolvePose } from '@/components/labs/storybook/book/popup-dissolve'
import { easeTurnWeighted } from '@/components/labs/storybook/book/page-geometry'
import { CHAPTERS, EXTRA_SPREAD_LAYERS, type SceneLayer } from '@/components/labs/storybook/content'

// Benchmark Part D gate D-G5 (docs/superpowers/specs/2026-07-13-grand-book-
// benchmark.md), REFINED 2026-07-13 by measurement: the original single
// "3x mean" gate conflated two domains — a control experiment (a pose
// exactly linear in beta, zero kinematic character, run through the real
// render clock) measured a ~4.9x max/mean floor from easeTurnWeighted
// ALONE, so a uniform-real-time ratio just re-tests the easing curve, not
// the paper. Two gates instead:
//
// GATE 1 — MECHANISM CHARACTER (beta domain, uniform steps of the dihedral
// itself): max per-vertex step < 3x mean, with measured+10% ceilings where
// a family's character legitimately exceeds it (walls/children concentrate
// motion near flat-open GEOMETRICALLY — "late bloom is geometric"). Catches
// solver regressions and families migrating snappier than their measured
// nature.
//
// GATE 2 — PERCEPTUAL SPEED LIMIT (real time, absolute): page angles driven
// by the actual render clock (spreadDihedral + easeTurnWeighted, same
// composition popup-spread.tsx/popup-platform-layer.tsx use in useFrame),
// worst of incoming/outgoing, max per-vertex step < ONE GLOBAL CAP
// calibrated at today's worst measured + 25%. No ratios, no per-family
// carve-outs — this catches branch flips and absolute-velocity explosions,
// not the easing curve's own (intentional, shared, already-reviewed)
// velocity shape.
//
// Advisor ruling 2026-07-13: no engine re-timing of the v-fold geometry
// (glue-edge shear would make the pose wrong, and late bloom is the
// family's identity) — wall v-folds' late rush is accepted GEOMETRIC
// character, caught by Gate 1's per-family ceiling, not re-timed away.

const rad = (d: number) => (d * Math.PI) / 180
/** Symmetric bloom angles for a dihedral beta (same convention as the D1
 *  tabpiece gates in popup-mechanics.test.ts). */
const bloom = (beta: number): [number, number] => [Math.PI / 2 + beta / 2, Math.PI / 2 - beta / 2]
const REST_BETA = rad(176)
const QUARTER_REST = REST_BETA / 4

/** Every spread's layer set. */
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
 *  renderer's seat resolution in popup-anatomy-layers.tsx and the A-suite's
 *  seatQuadOf in popup-mechanics.test.ts). */
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

/** Every world-space quad a layer poses, one dispatcher for all nine
 *  shipped mechanism families (mirrors allQuads in popup-mechanics.test.ts). */
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
  // The volvelle dial + card ride the page coplanar at a FROZEN twist (the twist
  // is user-paced, cap-exempt); their only page-driven motion is the rigid page
  // sweep. Pose at a detent (0) — rotation is a rigid square, footprint-neutral.
  if (layer.mech === 'volvelle') {
    const pose = solveVolvellePose(layer, thetaL, thetaR, 0)
    return [pose.dial, pose.card]
  }
  // A lift-flap's autonomous (page-driven) motion is the envelope collapse of a
  // door held at a FROZEN reader angle (the lift itself is user-paced, cap-
  // exempt). Pose every leaf FULLY OPEN (a_user = LIFT_MAX) — the tallest leaf,
  // the worst envelope amplitude, the fastest-moving corner (bench L9).
  if (layer.mech === 'liftflap') {
    const open = layer.doors.map(() => liftFlapMax(layer))
    const pose = solveLiftFlapPose(layer, open, thetaL, thetaR)
    return [pose.board, ...pose.doors]
  }
  if (layer.mech === 'tabpiece') return solveTabPiecePose(layer, thetaL, thetaR).map((p) => p.quad)
  // The knob-tower's autonomous (page-driven) motion is the envelope collapse
  // at a FROZEN twist; the twist itself is user-paced (cap-exempt). Pose at full
  // erect (THETA_MAX) — the tallest tower, the worst envelope amplitude.
  if (layer.mech === 'knobtower')
    return solveKnobTowerPose(layer, knobTowerThetaMax(layer), thetaL, thetaR).map((p) => p.quad)
  // The keepsake's only page-driven pose is HOME (p=0), coplanar in its sleeve;
  // the pull/settle/return are the hand's own domain, not this dihedral gate.
  if (layer.mech === 'keepsake') return [keepsakeCardInPlane(layer, 0, thetaL, thetaR)]
  // The keep (stacked box chain + balcony + raven) is fully page-driven.
  if (layer.mech === 'keepstack') return keepStackQuads(layer, thetaL, thetaR)
  // The winch's autonomous (page-driven) motion is the envelope collapse at a
  // FROZEN twist; the twist is user-paced (cap-exempt). Pose at full erect
  // (THETA_MAX) — the worst envelope amplitude. Disc excluded (coplanar handle).
  if (layer.mech === 'keepwinch') return keepWinchOutputQuads(layer, keepWinchThetaMax(layer), thetaL, thetaR)
  if (layer.mech === 'skyline') return keepSkylineQuads(layer, thetaL, thetaR)
  // The swarm's page-driven motion is the wave-staggered deploy at stir 0 (the
  // stir ripple is user-paced, cap-exempt like the winch twist).
  if (layer.mech === 'swarmarc') return swarmArcQuads(layer, thetaL, thetaR)
  // The depth vista is fully page-driven: N wing configs mirrored to both pages,
  // one single cammed flap each — every world quad it poses.
  if (layer.mech === 'depthvista') {
    return solveDepthVistaPose(layer, thetaL, thetaR).wings.map((w) => w.patch.flap)
  }
  // The dissolve holds a flat end state (tau=0 dunes); no envelope (both ends are
  // coplanar), so it is purely page-driven like the depth vista — its base, N
  // coplanar slats, and flush tab all ride the folding page (bench D11).
  if (layer.mech === 'dissolve') {
    const pose = solveDissolvePose(layer, 0, thetaL, thetaR)
    return [pose.base, ...pose.slats, pose.tab]
  }
  // The range is purely page-driven: k v-fold ranks on one card + flat
  // gussets — every rank's motion is the shipped v-fold closed form.
  if (layer.mech === 'mfoldrange') {
    const pose = solveMFoldRangePose(layer, thetaL, thetaR)
    return [
      ...pose.ranks.flatMap((r) => [r.right, r.left]),
      ...pose.gussets.flatMap((g) => [g.left, g.right]),
    ]
  }
  // The staged chain is purely page-driven: every joint's q is a monotone cam
  // in beta alone, so its whole motion is the merged storey strip.
  if (layer.mech === 'stagedchain') return stagedChainQuads(layer, thetaL, thetaR)
  const pose = poseAt(layer, layers, thetaL, thetaR)
  return [pose.right, pose.left]
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

// ---------------------------------------------------------------------------
// NO-SNAP: max per-vertex frame step bounded by the mean step, per layer.
// Beta-domain table is descriptive; the real-time domain below is enforced.

const STATIONS = 240

type StepStats = { maxStep: number; meanStep: number }

/** Every corner of every quad a layer poses at a given (thetaL, thetaR),
 *  with the tabpiece TAB quad excluded — it is a clipped reveal through the
 *  fore-edge slit whose visible extent legitimately accelerates (A2/A12
 *  exempts it from rigidity for the same reason). */
const shipCorners = (layer: SceneLayer, layers: readonly SceneLayer[], thetaL: number, thetaR: number): Vec3[] => {
  const quads = allQuads(layer, layers, thetaL, thetaR)
  const shipQuads = layer.mech === 'tabpiece' ? quads.slice(0, -1) : quads
  return shipQuads.flat()
}

/** Accumulates per-corner step stats over a sequence of betas (already
 *  ordered by whatever domain — uniform beta, or an eased real-time clock). */
const stepStatsOverBetas = (layer: SceneLayer, layers: readonly SceneLayer[], betas: readonly number[]): StepStats => {
  let prev: Vec3[] | null = null
  let maxStep = 0
  let sum = 0
  let n = 0
  for (const beta of betas) {
    const [thetaL, thetaR] = bloom(beta)
    const corners = shipCorners(layer, layers, thetaL, thetaR)
    if (prev) {
      for (let k = 0; k < corners.length; k++) {
        const d = dist(prev[k], corners[k])
        if (d > maxStep) maxStep = d
        sum += d
        n++
      }
    }
    prev = corners
  }
  return { maxStep, meanStep: sum / n }
}

const uniformBetas = (max: number, stations: number): number[] =>
  Array.from({ length: stations + 1 }, (_, i) => (i / stations) * max)

type NoSnapRow = { id: string; family: string; maxStep: number; meanStep: number; ratio: number }

const toRow = (id: string, family: string, stats: StepStats): NoSnapRow => ({
  id,
  family,
  ...stats,
  ratio: stats.maxStep / stats.meanStep,
})

const worstPerFamily = (rows: readonly NoSnapRow[]) => {
  const byFamily = new Map<string, NoSnapRow[]>()
  for (const row of rows) {
    const list = byFamily.get(row.family) ?? []
    list.push(row)
    byFamily.set(row.family, list)
  }
  return [...byFamily.values()]
    .map((familyRows) => familyRows.reduce((a, b) => (b.ratio > a.ratio ? b : a)))
    .sort((a, b) => b.ratio - a.ratio)
    .map((r) => ({
      family: r.family,
      worstLayer: r.id,
      ratio: Number(r.ratio.toFixed(3)),
      maxStep: Number(r.maxStep.toFixed(5)),
      meanStep: Number(r.meanStep.toFixed(5)),
    }))
}

// A dress patch is a rigid zero-DOF silhouette riding ONE parent panel — its
// beta-domain character IS its parent's. The E3 s3 pieces made this visible:
// the clouds ride the ch2-backdrop WALL v-fold (phi 84) and the chains the
// ch2-fringe wall, so they inherit the wall's geometric late bloom (measured
// worst 10.4x — inside the vfold's own 15.5 ceiling), while box/platform-
// seated dress keeps measuring under the plain 3x floor. Key dress rows by
// parent family so each seat is judged by its parent's character.
const familyKey = (layer: SceneLayer, layers: readonly SceneLayer[]): string => {
  if (layer.mech !== 'dress') return layer.mech
  const parent = layers.find((l) => l.id === layer.parentId)
  return `dress:${parent?.mech ?? 'none'}`
}

const BETA_DOMAIN_STATS: readonly NoSnapRow[] = ALL_LAYERS.map(([id, layer, layers]) =>
  toRow(id, familyKey(layer, layers), stepStatsOverBetas(layer, layers, uniformBetas(REST_BETA, STATIONS)))
)

/** Gate 1 per-family ceiling on the beta-domain max/mean step ratio.
 *  box/platform/rider/dress/tabpiece measure under the plain 3x floor
 *  (worst: box 1.88, tabpiece 1.42, platform 2.24, rider 2.51, dress 2.59 —
 *  D-G5 measurement pass, 2026-07-13). Four families measure over 3x for
 *  two different reasons:
 *  TRUE DISCONTINUITY — stripflap (4.50x, satchel-sword): the press-and-
 *  peel graze clamp (bisection resolution ~1e-6, plus a 0.002 press gap,
 *  popup-mechanics.ts solveStripFlapPose) puts an actual slope
 *  discontinuity in the lift-vs-beta curve where the clamp disengages.
 *  SMOOTH BUT STEEP — vfold (14.05x, ch3-towers), child (14.00x,
 *  ch3-balcony), fan (4.02x, satchel-burst): all three drive through the
 *  same closed-form spherical four-bar (creaseElevation/bisectorCrease),
 *  smooth and branch-free for the symmetric case, whose derivative grows
 *  large as phi approaches 90 deg with a small rho-phi margin — the book's
 *  "wall" configs (phiDeg 84/rhoDeg 88) sit exactly there. This is the
 *  "late bloom is geometric" character the module header documents; no
 *  per-station jump exceeds A6's own angular-rate bound. Each ceiling is
 *  measured worst-case + 10%. */
const BETA_FAMILY_CEILING: Readonly<Record<string, number>> = {
  vfold: 15.5,
  child: 15.5,
  fan: 4.5,
  stripflap: 5.0,
  // RIDER joined the smooth-but-steep class with the E3 s6 crowd chains: a
  // rider is a v-fold solved in its seat's bisector frame (solveRiderPose ->
  // the same closed-form spherical four-bar as vfold/child), so a WALL-regime
  // rider (phi 84 / rho 88 — the lateral crowd-rank read) inherits exactly
  // the late bloom the vfold/child ceilings document. The old implicit 3x
  // floor had only ever measured PROP-regime riders (phi ~30, worst 2.51).
  // Measured worst now 6.69x (ch5-crowd-low) + 10%.
  rider: 7.4,
  // KINETIC arm (D4): its ARM panel rides a 45-deg v-fold ridge, so it
  // inherits the v-fold's late-bloom — the tip's per-station step grows
  // toward flat-open — while its apex corner is STATIC (on the spine, step
  // 0), which lowers the per-corner mean and raises the ratio. Measured
  // worst 3.47x (both shipped arms, D-G5 measurement 2026-07-13) + 10%.
  // Smooth and branch-free (A6 continuity passes); the real-time GLOBAL_CAP
  // still holds it ~85% clear (the late bloom parks near the slow eased tail).
  kinetic: 3.9,
  // ROTOR (D4 wave 2): a disc spinning on a moving v-fold panel. Its
  // designed cam is early-rise (steep at closed) while its v-fold SEAT is
  // late-bloom (steep at open), so the two peaks sit at opposite ends and the
  // combined per-station step is quite even — measured worst 1.74x (end-seal,
  // D-G5 measurement 2026-07-13) + ~15%. Smooth and branch-free; the real-time
  // GLOBAL_CAP holds it ~77% clear (satchel-astrolabe's real-time step 0.0114,
  // the early-rise cam parking the fast spin at the slow eased ease-in).
  rotor: 2.0,
  // KEEP-WINCH (E1 showpiece): one crank driving three staggered outputs. Its
  // per-corner MEAN is low — the iris blades and counterweight barely travel —
  // while the TALL semaphore arm (baseX 0.9, armLen 0.16, tip ~1.06 from the
  // spine) swings through the envelope's late-rise, so the max/mean ratio runs
  // high (measured 8.86x, ch3-keep-winch) the same way the kinetic arm's static
  // apex raises its ratio. Smooth, monotone, C1 — the bench (derive-keep-winch
  // N2) proves every output cam has bounded slope (no snap); its real bound is
  // Gate 2's absolute cap, which N7 holds ~88% clear. Measured 8.86x + ~10%.
  keepwinch: 9.8,
  // MULTI-FOLD RANGE (E3 s5): ONE card of k v-fold ranks + page-flat valley
  // gussets. Every rank drives through the same smooth closed form as the
  // vfold family (ceiling 15.5), but the composite MEAN is diluted by the
  // short front ranks and the near-page gusset corners (which barely move),
  // while the MAX is the tall back rank's late-blooming crest — the same
  // static-corner dilution that raises the kinetic arm's and keep-winch's
  // ratios. Measured worst 17.29x (ch4-range, beta domain) + 10%. Smooth and
  // branch-free per rank; the real-time GLOBAL_CAP tests below hold it
  // absolutely bounded at real turn speed.
  mfoldrange: 19,
  // STAGED CHAIN (E3 s4): the family's whole point is UNEVEN pacing — each
  // joint holds still through the fast mid-turn station and spends its arc in
  // the eased tails, so a high beta-domain max/mean is the mechanism working,
  // not a defect. (The research bench measured 13-54x at frontier heights;
  // playbook Gate-1 note called for a measured family ceiling.) The absolute
  // bound that matters is Gate 2's real-time GLOBAL_CAP, which the cam planner
  // targets directly and the tests below hold at 3.6-4.2% margin. Every cam is
  // monotone and piecewise-linear in beta (no snap). Measured worst 11.15x
  // (ch3-cliff-l, beta domain) + 10%. (The first, ACCORDION cliffs measured
  // 37x here; the ribbon that wedge containment forced on them is far gentler,
  // because a ribbon joint never swings a panel through vertical.)
  stagedchain: 13,
  // VOLVELLE (E2.2 Batch B): at a FROZEN twist the dial + card ride the page as a
  // rigid coplanar square, so their only page-driven motion is the pure rigid
  // page sweep — every corner's step is proportional to its distance from the
  // spine, giving a very even per-corner profile (max/mean ~ the ratio of the
  // farthest to the mean corner distance). Measured worst ~1.2x + margin; smooth
  // and branch-free (the twist itself is user-paced and cap-exempt).
  volvelle: 1.6,
  // DRESS ON A WALL V-FOLD (E3 s3): zero-DOF patches riding a wall panel
  // (ch2-backdrop clouds, ch2-fringe chains) inherit the v-fold's late-bloom
  // verbatim — measured worst 10.4x (ch2-cloud-r), bounded by the parent
  // family's own 15.5 ceiling. Box/lid-seated dress stays on the 3x default.
  'dress:vfold': 15.5,
  // SWARMARC (E3 s3): the wave-staggered deploy CONCENTRATES each strut's
  // erection into its own 0.38-wide window of E (pack §3 — that is the
  // family's signature "pour out of the hive" character), so per-corner max
  // runs over the whole-turn mean. Measured 4.56x (ch2-swarm) + ~10%; smooth
  // closed-form smoothstep windows, no discontinuity; Gate 2's absolute cap
  // still binds the real-time speed.
  swarmarc: 5.1,
  // OANAVE (E3 s7): the host IS the v-fold wall solver verbatim, so it
  // carries the same smooth-but-steep late-bloom character as the vfold
  // walls (phi 72-84 with a small rho-phi margin), and its relief strata
  // are dihedral-slaved to the host fold — no drive of their own to add a
  // discontinuity. Measured worst 9.05x (ch6-nave-a, the phi-84 apse — the
  // wall regime, exactly the vfold walls' geometry) + 10% per the house
  // measured-ceiling law (pack §4a beta-ratio note).
  oanave: 10.0,
}

describe('D-G5 Gate 1 — mechanism character (beta domain, ENFORCED)', () => {
  it('measurement table: worst layer per family (max/mean ratio, uniform beta)', () => {
    console.table(worstPerFamily(BETA_DOMAIN_STATS))
    expect(BETA_DOMAIN_STATS.length).toBeGreaterThan(0)
  })

  it.each(BETA_DOMAIN_STATS.map((r) => [r.id, r] as const))(
    '%s: max step stays under its family ceiling times the mean step (beta domain)',
    (_id, row) => {
      const ceiling = BETA_FAMILY_CEILING[row.family] ?? 3
      expect(row.maxStep).toBeLessThan(ceiling * row.meanStep)
    }
  )
})

// Real-time domain: page angles driven by the actual render clock. Every
// spread can arrive as 'incoming' (dihedral eases 0 -> PI) or depart as
// 'outgoing' (eases PI -> 0) on a 'next' turn — same composition
// popup-spread.tsx/popup-platform-layer.tsx use in useFrame. A layer's
// geometry doesn't know which spread or direction it's in, so both roles
// are checked and the gate enforces on whichever is worse.
const REALTIME_STATIONS = 240
const REALTIME_ROLES = ['incoming', 'outgoing'] as const

const realTimeBetas = (role: (typeof REALTIME_ROLES)[number], stations: number): number[] =>
  Array.from({ length: stations + 1 }, (_, i) => spreadDihedral(role, 'next', easeTurnWeighted(i / stations)))

const REAL_TIME_STATS: readonly NoSnapRow[] = ALL_LAYERS.flatMap(([id, layer, layers]) =>
  REALTIME_ROLES.map((role) =>
    toRow(id, layer.mech, stepStatsOverBetas(layer, layers, realTimeBetas(role, REALTIME_STATIONS)))
  )
)

/** Gate 2's actual metric: the single largest ABSOLUTE per-vertex step
 *  across every layer, both turn roles, real time. NOT a ratio — a control
 *  experiment (a pose exactly linear in beta, zero kinematic character, run
 *  through this identical clock) measured a ~4.9x max/mean step ratio from
 *  easeTurnWeighted's own quintic shape ALONE (peak dBeta/dt at t=0.5 is 5x
 *  the average), so any per-family ratio floor in this domain re-tests the
 *  shared easing curve, not the paper. An absolute cap sidesteps that: it
 *  only fires on a genuinely large single-frame jump (branch flip, solver
 *  blow-up), regardless of how the clock paces the rest of the sweep.
 *  Computed here only for the diagnostic print below — GLOBAL_CAP itself
 *  (next) is a calibrated LITERAL, not derived from the current run's own
 *  data, or the assertion below would be tautological (nothing can ever
 *  exceed 1.25x of its own maximum) and could never catch a regression. */
const GLOBAL_WORST_MAX_STEP = Math.max(...REAL_TIME_STATS.map((r) => r.maxStep))

/** Today's worst measured absolute per-vertex step, real time, both turn
 *  roles (D-G5 measurement pass, 2026-07-13: 0.039685, a stripflap corner)
 *  + 25%, per the spec's calibration rule — a fixed literal so a future
 *  regression that pushes any layer's step higher actually fails this
 *  test. Ratchets upward only if a future measurement legitimately exceeds
 *  it — never weakened for convenience. */
const GLOBAL_CAP = 0.0497

describe('D-G5 Gate 2 — perceptual speed limit (real time, ENFORCED, absolute cap)', () => {
  it('measurement table: worst layer per family (max/mean ratio, eased real time — diagnostic only, not the enforced metric)', () => {
    console.table(worstPerFamily(REAL_TIME_STATS))
    console.log('global worst max step (real time):', GLOBAL_WORST_MAX_STEP, 'cap:', GLOBAL_CAP)
    expect(REAL_TIME_STATS.length).toBeGreaterThan(0)
  })

  it.each(REAL_TIME_STATS.map((r, i) => [`${r.id}#${i}`, r] as const))(
    '%s: max per-vertex step stays under the global cap, at real turn speed',
    (_id, row) => {
      expect(row.maxStep).toBeLessThan(GLOBAL_CAP)
    }
  )
})

// ---------------------------------------------------------------------------
// FAMILY CHARACTER: strip-driven pieces rise early, v-folds bloom late.

/** Raw strip-pull lift (the chord law solveStripFlapPose derives its
 *  stripLift from) WITHOUT the press-and-peel graze clamp — the clamp is a
 *  paper-collision correction, not part of the family's driving law, so the
 *  character gate measures the law itself. */
const stripLiftRaw = (geom: SceneLayer & { mech: 'stripflap' }, beta: number): number => {
  const a = geom.anchor
  const b = geom.slot
  const dz = geom.anchorZ - geom.slotZ
  const strip = (bt: number) => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(bt) + dz * dz)
  const shut = strip(0)
  const erectAt = rad(geom.erectAtDeg ?? 176)
  const reach = Math.max(strip(erectAt) - shut, 1e-9)
  const pull = strip(beta) - shut
  return Math.acos(Math.min(1, Math.max(-1, 1 - pull / reach)))
}

const nOf = (q: PanelQuad): Vec3 => {
  const n = cross(sub(q[1], q[0]), sub(q[3], q[0]))
  const l = Math.hypot(n[0], n[1], n[2])
  return [n[0] / l, n[1] / l, n[2] / l]
}

/** Panel-opening angle (between the two panel normals) at a given beta —
 *  each mechanism's OWN opening variable, since raw corner height is
 *  corrupted by page steepness at small beta (D1 tabpiece gate, same
 *  reasoning). */
const panelOpenAngle = (layer: SceneLayer & { mech: 'vfold' }, beta: number): number => {
  const [tL, tR] = bloom(beta)
  const pose = solveVFoldPose(layer, tL, tR)
  const c = dot(nOf(pose.right), nOf(pose.left))
  return Math.acos(Math.max(-1, Math.min(1, c)))
}

const STRIPFLAP_LAYERS = ALL_LAYERS.filter(
  (entry): entry is readonly [string, SceneLayer & { mech: 'stripflap' }, readonly SceneLayer[]] =>
    entry[1].mech === 'stripflap'
)
const TABPIECE_LAYERS = ALL_LAYERS.filter(
  (entry): entry is readonly [string, SceneLayer & { mech: 'tabpiece' }, readonly SceneLayer[]] =>
    entry[1].mech === 'tabpiece'
)
const VFOLD_LAYERS = ALL_LAYERS.filter(
  (entry): entry is readonly [string, SceneLayer & { mech: 'vfold' }, readonly SceneLayer[]] =>
    entry[1].mech === 'vfold'
)

/** v-fold late-bloom ceiling on panel-opening fraction at quarter-rest.
 *  Measured maximum across every shipped v-fold (D-G5 measurement pass,
 *  2026-07-13) is 0.335 (ch2-hero, phiDeg 50/rhoDeg 82 — the deepest-V
 *  heroes open fastest); the phi=84/rho=88 wall/backdrop configs are the
 *  LATEST bloomers at ~0.258-0.263. Ceiling set just above the measured
 *  maximum so the gate catches future migration toward the strip family's
 *  early-rise curve (>= 0.45), not today's spread. */
const VFOLD_CEILING = 0.34

describe('D-G5 family character — strip-driven pieces rise early, v-folds bloom late', () => {
  it('measurement table: character fraction at quarter-rest, per family', () => {
    const stripRows = STRIPFLAP_LAYERS.map(([id, layer]) => ({
      id,
      frac: Number((stripLiftRaw(layer, QUARTER_REST) / stripLiftRaw(layer, REST_BETA)).toFixed(3)),
    }))
    const tabRows = TABPIECE_LAYERS.map(([id, layer]) => ({
      id,
      frac: Number((tabPieceLift(layer, QUARTER_REST) / tabPieceLift(layer, REST_BETA)).toFixed(3)),
    }))
    const vfoldRows = VFOLD_LAYERS.map(([id, layer]) => ({
      id,
      frac: Number((panelOpenAngle(layer, QUARTER_REST) / panelOpenAngle(layer, REST_BETA)).toFixed(3)),
    }))
    console.table({ stripflap: stripRows, tabpiece: tabRows, vfold: vfoldRows })
    expect(stripRows.length + tabRows.length + vfoldRows.length).toBeGreaterThan(0)
  })

  it.each(STRIPFLAP_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: strip-driven early-rise >= 45%% of rest lift by quarter-rest',
    (_id, layer) => {
      const frac = stripLiftRaw(layer, QUARTER_REST) / stripLiftRaw(layer, REST_BETA)
      expect(frac).toBeGreaterThanOrEqual(0.45)
    }
  )

  it.each(TABPIECE_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: strip-driven early-rise >= 50%% of rest lift by quarter-rest',
    (_id, layer) => {
      const frac = tabPieceLift(layer, QUARTER_REST) / tabPieceLift(layer, REST_BETA)
      expect(frac).toBeGreaterThanOrEqual(0.5)
    }
  )

  it.each(VFOLD_LAYERS.map(([id, l]) => [id, l] as const))(
    '%s: v-fold late-bloom stays <= the family ceiling at quarter-rest',
    (_id, layer) => {
      const frac = panelOpenAngle(layer, QUARTER_REST) / panelOpenAngle(layer, REST_BETA)
      expect(frac).toBeLessThanOrEqual(VFOLD_CEILING)
    }
  )
})
