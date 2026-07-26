/**
 * THE STAGED CHAIN (E3 s4 round-3) — family #22: a page-rooted MULTI-STOREY
 * wall that unfolds in STAGES as the page opens.
 *
 * This is the family that broke the ch3/ch4 skyline height wall. That wall —
 * "a page-rooted flap's worst real-time step is its far base corner riding the
 * page, rfar x dtheta, so rfar <= 0.772 and row height caps near 0.11" — was
 * correct FOR THE SINGLE-STAGE CLASS and over-generalised. A chain of n panels
 * with parallel radial hinges, each joint carrying its OWN deployment fraction
 * q_k(beta), spends its joint arc in the eased TAILS of the turn and holds a
 * shallow pose through the fast mid-turn station, where the page sweep alone
 * already eats the speed budget. Derived in `.superpowers/sdd/bench/
 * e3-derive-stagedchain.mjs` (playbook §1); this scene's config is gated by
 * `.superpowers/sdd/bench/e3s4-cliffs.mjs`.
 *
 * KINEMATICS. In the page-local (xi, eta) plane — xi runs flat along -z from
 * the hinge line, eta off the page along its normal — panel k has length h_k
 * and absolute direction psi_k:
 *
 *   psi_0 = q_0 * rootDeg
 *   psi_k = psi_{k-1} + s_k * (PI - q_k * (PI - relDeg_k)),   s_k = (-1)^(k+1)
 *
 * so q_k = 0 folds panel k dead flat BACK onto panel k-1 (an accordion) and
 * q_k = 1 opens it to relative angle relDeg_k (0 = a straight continuation of
 * the panel below). The whole wall spans radial [F, F+w] at every node, so
 * every panel is one quad and the wall is one strip of them.
 *
 * THE FOUR FAMILY CONDITIONS (playbook §1 — the gates every config must pass,
 * asserted in `__tests__/labs/storybook/popup-stagedchain.test.ts`):
 *   1. hold-through-midturn reach <= sqrt((cap/dtheta_max)^2 - rfar^2)
 *      (0.252 at rfar 0.73) — a wall may stay ~25% deployed through the fast
 *      station for free, and no more;
 *   2. the remaining joint arc must fit the TWO eased tails (a fold-back joint
 *      costs pi x the lever above it) — `planStagedChainCam` returns
 *      `feasible: false` when it does not;
 *   3. TOP-DOWN unroll order: upper joints never lag lower ones, or a still-
 *      folded parent points its deployed child through the page;
 *   4. q_k(0) = 0 EXACTLY -> fold-flat is free (and for an ACCORDION the closed
 *      footprint superposes to the alternating prefix reach, <= h_0, instead of
 *      running to sum(h));
 *   5. WEDGE CONTAINMENT — eta <= F*tan(beta) for beta < pi/2, so the wall never
 *      pokes through the OTHER page as the book shuts. This one is NOT in the
 *      derivation; see `StagedChainStyle` below for how it was found and what it
 *      costs (it is why these cliffs are ribbons, not accordions).
 *
 * THREE ADAPTATIONS this scene had to make to the derivation:
 *   (a) CAM REST. The research bench saturated its cam at 176deg. The book's
 *       real rest dihedral is 173.72deg (page-geometry `restAngles`), so a
 *       176deg cam leaves the wall ~80% deployed at the pose the reader
 *       actually sees. `camRestDeg` defaults to 173 — strictly harder (fewer,
 *       slower stations to drain into), which is why the shipped heights sit
 *       under the research frontier's H 1.008.
 *   (b) THE LEAN-BACK LEVER. The derivation swept rootDeg 90 only. Raking the
 *       chain back trades apex height for chain LENGTH at a rate the elevated
 *       reading camera loves: the hold-through-midturn reach scales with
 *       sin(root), while a raked face reads nearly square-on instead of
 *       edge-on (the lid-dominant sightline law). It is what let the cliffs
 *       out-mass the whole retired ring while staying under the keep's crown.
 *   (c) THE WEDGE WALL and the accordion -> ribbon switch it forced. See
 *       `StagedChainStyle`.
 *
 * PAPER PEDIGREE: Birmingham mech 101 (lost-motion strap: pocket + window = an
 * engagement delay) + mech 116 (automatic strip makes any strap page-driven),
 * and the house keepwinch beta-cams — a beta window IS a cam. Reinhart:
 * "opening the page is a chain reaction... a V-fold off a V-fold... the further
 * from the base page, the later." The delay is topological in real books.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'
import { easeTurnWeighted } from './page-geometry'
import { GLOBAL_CAP } from './user-drive-return'

/** Stations of the eased turn clock the cam is planned on — the same 240 the
 *  real-time motion gates sample. */
const N_STATIONS = 240
/** Dihedral (deg) at which every joint is fully deployed. Below the book's real
 *  173.72deg rest so the wall is DONE at the pose the reader holds. */
const DEFAULT_CAM_REST_DEG = 173
/** Fraction of GLOBAL_CAP the planner is allowed to spend per station. */
const DEFAULT_SAFE = 0.92
const DEFAULT_ROOT_DEG = 90

const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** One storey: its panel length up the chain, and the relative angle its joint
 *  opens to (0 = straight continuation of the storey below; larger values
 *  terrace the wall, and cost less joint arc because travel = PI - relDeg). */
export type StagedChainStage = {
  h: number
  relDeg?: number
  /** THE TRAPEZOID CHAIN (E3 s4 round-4). Radial span of this stage's TOP node:
   *  inner edge `rTop`, width `wTop`. Anything unset inherits the node below, so
   *  a plain rectangular wall stays exactly what it was. */
  rTop?: number
  wTop?: number
}

/**
 * ACCORDION vs RIBBON — the two ways a chain can lie closed, and the reason
 * this scene ships the second one.
 *
 * ACCORDION: each storey folds dead flat BACK onto the storey below, so the
 * closed footprint superposes to the alternating prefix reach (<= h_0) rather
 * than the chain's full length. That is the derivation's budget case, and it is
 * the cheaper of the two on page depth.
 *
 * RIBBON: the storeys lie EXTENDED and collinear at close, so a joint only
 * articulates through its relDeg. The closed footprint costs the FULL chain
 * length in z, but the joint arc is far smaller (travel = relDeg, not
 * PI - relDeg).
 *
 * THE WEDGE WALL (this scene's discovery — a condition the derivation never
 * stated). A page-rooted node at radial d and off-page reach eta sits at polar
 * angle theta_own -+ atan(eta/d), and for the book to close that excursion may
 * never exceed the dihedral itself: eta <= F*tan(beta) for beta < pi/2. An
 * ACCORDION joint passes through psi ~ 90deg on its way from folded-back to
 * deployed, so it raises a TENT of nearly its own panel height — and because
 * the top-down unroll law puts the upper joints EARLIEST, those tents happen at
 * the smallest betas, where the wedge is tightest. Measured on the first
 * accordion cliffs: a 0.45 excursion past the limit at beta 10deg, caught by
 * the book-wide A10 gate. No schedule fixes it; the tent height does not depend
 * on when it happens, only on the panel length. A RIBBON never tents — its
 * joints only ever open by relDeg from collinear — so it clears the wedge with
 * the root swing safely inside the late tail. Hence: tall page-rooted chains
 * are RIBBONS; accordions stay short enough that atan(h/F) is a small angle.
 */
export type StagedChainStyle = 'accordion' | 'ribbon'

export type StagedChainGeom = {
  mech: 'stagedchain'
  /** The outer page this wall is rooted on. */
  side: 'left' | 'right'
  /** How the chain lies at book-closed. Default 'accordion'. */
  style?: StagedChainStyle
  /** Inner radial run of the root hinge line from the spine. */
  F: number
  /** Radial width of the wall (every node spans [F, F+w]). */
  w: number
  /** World z of the root hinge line. The chain runs toward -z from here. */
  zc: number
  /** Stand angle of the ROOT joint at full deployment, degrees from the page.
   *  < 90 rakes the whole wall back toward -z. Default 90. */
  rootDeg?: number
  /** Storeys, ROOT FIRST (stage 0 is the wall's foot). */
  stages: readonly StagedChainStage[]
  /** Per-station share of GLOBAL_CAP the cam planner may spend. Higher packs
   *  the arc into fewer stations (a later, snappier unroll) at the cost of
   *  real-time margin. Default 0.92. */
  safe?: number
  /** Dihedral (deg) at which the cam saturates. Default 173. */
  camRestDeg?: number
}

export type StagedChainPose = {
  /** One quad per storey, root first. Corner order
   *  [inner-base, outer-base, outer-top, inner-top]. */
  panels: readonly PanelQuad[]
}

export type StagedChainCam = {
  /** False when the joint arc does not fit the eased tails (family condition
   *  2) — the config is illegal and must be re-derived, not clamped. */
  feasible: boolean
  /** Station betas, ascending (the eased turn clock, non-uniform in beta). */
  betas: readonly number[]
  /** q[k][i] = joint k's deployment fraction at station i. */
  q: readonly Float64Array[]
}

/** A chain node in page-local coordinates: [xi (flat, toward -z), eta (off-page)]. */
export type StagedChainNode = readonly [number, number]

/**
 * THE TRAPEZOID CHAIN — per-node radial span [r_j, r_j + w_j] (E3 s4 round-4,
 * derived in `.superpowers/sdd/bench/e3s4r4-tower.mjs`).
 *
 * The r3 family gave every node the same span [F, F+w], so a stagedchain could
 * only ever be a rectangular wall — which is why two of them read as two cards.
 * Letting each node carry its own span costs NOTHING kinematically: the chain
 * solves in the page-local (xi, eta) plane and the radial coordinate is a pure
 * spanwise parameter. What it buys is the whole crooked-tower vocabulary —
 * TAPER (widths narrowing as the tower climbs) and SKEW (the inner edge
 * drifting, so the stack zig-zags in plan and reads as a thing that grew too
 * fast to stand straight).
 *
 * Node 0 is the root span (geom.F, geom.w); stage k may re-declare the span at
 * its TOP node, and anything unset inherits the node below.
 */
export function stagedChainSpans(geom: StagedChainGeom): readonly (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [[geom.F, geom.w]]
  for (const stage of geom.stages) {
    const prev = spans[spans.length - 1]
    spans.push([stage.rTop ?? prev[0], stage.wTop ?? prev[1]])
  }
  return spans
}

/** Widest node — the piece's real-time rotation-radius extreme. */
export const stagedChainRFar = (geom: StagedChainGeom): number =>
  Math.max(...stagedChainSpans(geom).map(([r, w]) => r + w))
/** Innermost node — the edge the closing wedge binds on. */
export const stagedChainRNear = (geom: StagedChainGeom): number =>
  Math.min(...stagedChainSpans(geom).map(([r]) => r))

/**
 * THE PER-NODE ROTATION RADIUS. A point on a page-rooted piece sweeps a circle
 * about the SPINE AXIS of radius hypot(radial, off-page reach). The r3 planner
 * charged every node the chain's single worst radius hypot(rfar, eta_top) —
 * exactly right when every node shares one span, and needlessly brutal once
 * they do not. On a trapezoid tower the two extremes never coincide: the base
 * is wide but sits at eta = 0, and the crown is high but narrow. Charging the
 * crown the base's width invents a radius no point on the piece ever has, and
 * on the shipped tower it would have shrunk the crown's hold-through-midturn
 * window from 0.515 to 0.136.
 */
export function stagedChainMaxRadius(
  geom: StagedChainGeom,
  nodes: readonly StagedChainNode[]
): number {
  const spans = stagedChainSpans(geom)
  let r = 0
  for (let j = 0; j < nodes.length; j++) r = Math.max(r, Math.hypot(spans[j][0] + spans[j][1], nodes[j][1]))
  return r
}

/** Depth the chain occupies up the page at book-closed. A ribbon lies extended
 *  (the full chain length); an accordion superposes to its alternating prefix
 *  reach. This is what the closed pose must fit inside the page with. */
export function stagedChainClosedDepth(geom: StagedChainGeom): number {
  return stagedChainNodesQ(
    geom,
    geom.stages.map(() => 0)
  ).reduce((a, [xi]) => Math.max(a, Math.abs(xi)), 0)
}

/** Total chain length — the wall's height only when rootDeg is 90 and every
 *  relDeg is 0; otherwise use `stagedChainApex`. */
export const stagedChainLength = (geom: StagedChainGeom): number =>
  geom.stages.reduce((a, s) => a + s.h, 0)

/**
 * Chain node positions for an explicit per-joint deployment vector. Kept
 * separate from `stagedChainNodes` because the cam planner has to evaluate
 * poses it has not yet scheduled.
 */
export function stagedChainNodesQ(
  geom: StagedChainGeom,
  qs: readonly number[]
): readonly StagedChainNode[] {
  const nodes: StagedChainNode[] = [[0, 0]]
  // psi_k = psi_{k-1} + s_k*(PI - q_k*(PI - R_k)) is split into its CONSTANT
  // pi-flip and its q-driven remainder, and the flip is applied as an exact
  // sign rather than through cos(psi +- pi). Written the naive way, a fully
  // folded chain evaluates cos/sin of accumulated multiples of pi and lands
  // ~1e-16 off the page — and fold-flat in this book is an identity, not a
  // tolerance. Splitting it makes q_k = 0 give sin = 0 EXACTLY.
  let phi = 0
  let flipped = false
  for (let k = 0; k < geom.stages.length; k++) {
    const stage = geom.stages[k]
    const q = qs[k]
    if (k === 0) {
      phi = q * rad(geom.rootDeg ?? DEFAULT_ROOT_DEG)
    } else if ((geom.style ?? 'accordion') === 'ribbon') {
      // Extended-collinear at close: the joint only articulates, never tents.
      phi += q * rad(stage.relDeg ?? 0)
    } else {
      const sign = k % 2 === 1 ? 1 : -1
      phi -= sign * q * (Math.PI - rad(stage.relDeg ?? 0))
      flipped = !flipped
    }
    const s = flipped ? -1 : 1
    const prev = nodes[nodes.length - 1]
    nodes.push([prev[0] + s * stage.h * Math.cos(phi), prev[1] + s * stage.h * Math.sin(phi)])
  }
  return nodes
}

/**
 * THE OPTIMAL LATE CAM — the schedule that makes the family possible.
 *
 * Marches BACKWARD from the cam-rest station. At each station the speed
 * headroom left over after the page-sweep transport (safe*cap minus
 * hypot(rfar, eta) * dbeta) is spent folding joints back up, LARGEST LEVER
 * FIRST. Backward-largest-first is forward TOP-DOWN (family condition 3): the
 * root's big swing lands in the slowest eased tail, and the short top joints —
 * which barely move the far corner — take the earlier, faster stations. Where
 * the headroom goes negative (the fast mid-turn stations) nothing drains at
 * all: the chain simply HOLDS its shallow pose across the fast band, which is
 * family condition 1 stated as an algorithm.
 *
 * Deterministic and pure: same geom in, same table out.
 */
export function planStagedChainCam(geom: StagedChainGeom): StagedChainCam {
  const n = geom.stages.length
  const safe = geom.safe ?? DEFAULT_SAFE
  const camRest = rad(geom.camRestDeg ?? DEFAULT_CAM_REST_DEG)

  // lever[j] = chain length above joint j; travel[j] = the arc it must cover.
  const levers = geom.stages.map((_, j) => geom.stages.slice(j).reduce((a, s) => a + s.h, 0))
  const ribbon = (geom.style ?? 'accordion') === 'ribbon'
  const travel = geom.stages.map((stage, j) =>
    j === 0
      ? rad(geom.rootDeg ?? DEFAULT_ROOT_DEG)
      : ribbon
        ? rad(stage.relDeg ?? 0)
        : Math.PI - rad(stage.relDeg ?? 0)
  )
  const budget = travel.map((t, j) => Math.max(1e-12, t * levers[j]))

  const betas = Array.from({ length: N_STATIONS + 1 }, (_, i) => easeTurnWeighted(i / N_STATIONS) * Math.PI)
  let iRest = betas.findIndex((b) => b >= camRest)
  if (iRest < 0) iRest = N_STATIONS

  const q = Array.from({ length: n }, () => new Float64Array(N_STATIONS + 1))
  for (let j = 0; j < n; j++) for (let i = iRest; i <= N_STATIONS; i++) q[j][i] = 1

  const remaining = budget.slice()
  const qNow = new Array<number>(n).fill(1)
  let joint = 0
  for (let i = iRest; i >= 1; i--) {
    const dbeta = betas[i] - betas[i - 1]
    let headroom = safe * GLOBAL_CAP - stagedChainMaxRadius(geom, stagedChainNodesQ(geom, qNow)) * dbeta
    while (headroom > 1e-12 && joint < n) {
      const arc = Math.min(remaining[joint], headroom)
      remaining[joint] -= arc
      headroom -= arc
      qNow[joint] = Math.max(0, qNow[joint] - arc / budget[joint])
      if (remaining[joint] <= 1e-12) {
        // Snap the finished joint to a HARD zero: q(0) = 0 is family condition
        // 4, and a 1e-16 residual would make fold-flat approximate.
        qNow[joint] = 0
        joint++
      } else break
    }
    for (let j = 0; j < n; j++) q[j][i - 1] = qNow[j]
  }

  return { feasible: remaining.every((r) => r <= 1e-9), betas, q }
}

// The cam is a pure function of the geom, and every geom is a frozen content
// constant, so one plan per layer for the life of the page.
const camCache = new WeakMap<StagedChainGeom, StagedChainCam>()

export function stagedChainCam(geom: StagedChainGeom): StagedChainCam {
  const hit = camCache.get(geom)
  if (hit) return hit
  const cam = planStagedChainCam(geom)
  camCache.set(geom, cam)
  return cam
}

/** Joint k's deployment fraction at dihedral `beta`, piecewise-linear over the
 *  cam's stations. q(0) = 0 exactly, so fold-flat is free. */
export function stagedChainQ(geom: StagedChainGeom, k: number, beta: number): number {
  const { betas, q } = stagedChainCam(geom)
  const table = q[k]
  if (beta <= betas[0]) return table[0]
  for (let i = 1; i < betas.length; i++) {
    if (beta <= betas[i]) {
      const span = betas[i] - betas[i - 1]
      const f = span > 0 ? (beta - betas[i - 1]) / span : 0
      return table[i - 1] + (table[i] - table[i - 1]) * f
    }
  }
  return table[table.length - 1]
}

/** Chain nodes at a dihedral. */
export function stagedChainNodes(geom: StagedChainGeom, beta: number): readonly StagedChainNode[] {
  return stagedChainNodesQ(
    geom,
    geom.stages.map((_, k) => stagedChainQ(geom, k, beta))
  )
}

/**
 * WEDGE EXCURSION: how far past the closing dihedral the worst node reaches at
 * this beta, in world units (<= 0 is contained). The inner edge binds, so the
 * limit is F*tan(beta); above beta = pi/2 nothing binds, because atan of any
 * finite ratio is already under a right angle. Positive here means the wall
 * would poke through the OTHER page as the book shuts — the wall that killed
 * the accordion cliffs.
 */
export function stagedChainWedgeExcursion(geom: StagedChainGeom, beta: number): number {
  if (beta >= Math.PI / 2) return -Infinity
  const limit = stagedChainRNear(geom) * Math.tan(beta)
  let worst = -Infinity
  for (const [, eta] of stagedChainNodes(geom, beta)) worst = Math.max(worst, eta - limit)
  return worst
}

/** Off-page reach of the highest node — the wall's true standing height. */
export function stagedChainApex(geom: StagedChainGeom, beta: number): number {
  let apex = 0
  for (const [, eta] of stagedChainNodes(geom, beta)) apex = Math.max(apex, eta)
  return apex
}

/** The rooted page's own moving frame: u toward the fore edge, n the page
 *  normal into the wedge (identical to the skyline family's frame). */
function pageFrame(geom: StagedChainGeom, thetaL: number, thetaR: number): { u: Vec3; n: Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n }
}

/**
 * Solves the whole wall: one quad per storey, root first, corner order
 * [inner-base, outer-base, outer-top, inner-top] (the skyline family's
 * convention, so u runs radially outward and v climbs the wall).
 */
export function solveStagedChainPose(
  geom: StagedChainGeom,
  thetaL: number,
  thetaR: number
): StagedChainPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const { u, n } = pageFrame(geom, thetaL, thetaR)
  const nodes = stagedChainNodes(geom, beta)
  const at = (d: number, node: StagedChainNode): Vec3 => [
    d * u[0] + node[1] * n[0],
    d * u[1] + node[1] * n[1],
    geom.zc - node[0],
  ]
  // TRAPEZOID: each storey's quad runs from its BOTTOM node's radial span to its
  // TOP node's, so a tapering, skewing chain is still one quad per storey.
  const spans = stagedChainSpans(geom)
  const panels: PanelQuad[] = []
  for (let k = 0; k + 1 < nodes.length; k++) {
    const base = nodes[k]
    const top = nodes[k + 1]
    const [r0, w0] = spans[k]
    const [r1, w1] = spans[k + 1]
    panels.push([at(r0, base), at(r0 + w0, base), at(r1 + w1, top), at(r1, top)])
  }
  return { panels }
}

/** Every world-space quad the wall poses — for the collision / motion / depth
 *  dispatchers. */
export function stagedChainQuads(
  geom: StagedChainGeom,
  thetaL: number,
  thetaR: number
): PanelQuad[] {
  return [...solveStagedChainPose(geom, thetaL, thetaR).panels]
}

// ---------------------------------------------------------------------------
// Atlas layout — ONE continuous painting per wall, at the chain's true aspect
// (w wide x sum(h) tall), sliced into per-storey v-bands. Stacking dissolves
// the old 3:1 strip-art aspect lock (playbook §1), and a single drawing across
// all storeys is also what the paper is: one printed sheet, scored into panels.
// Shared with the generate-art painter so the mapping cannot drift.

/** Storey k's v-band [vBottom, vTop] in its wall's texture. Stage 0 is the
 *  wall's foot, so it takes the BOTTOM of the image (v = 0 under three's
 *  default flipY). */
export function stagedChainBand(geom: StagedChainGeom, stage: number): readonly [number, number] {
  const total = stagedChainLength(geom)
  let below = 0
  for (let k = 0; k < stage; k++) below += geom.stages[k].h
  return [below / total, (below + geom.stages[stage].h) / total]
}

/**
 * NODE j's u-range in its wall's texture. On a trapezoid the storeys do not all
 * span the same radial band, so the painting is authored across the chain's FULL
 * radial extent [rNear, rFar] and each node samples the sub-range it actually
 * occupies. That is what lets the painter draw ONE crooked tower silhouette in
 * one image and have the mesh cut it correctly storey by storey (a plain
 * rectangular chain gets [0, 1] on every node, exactly as before).
 */
export function stagedChainNodeU(geom: StagedChainGeom, node: number): readonly [number, number] {
  const rNear = stagedChainRNear(geom)
  const extent = stagedChainRFar(geom) - rNear
  if (extent <= 0) return [0, 1]
  const [r, w] = stagedChainSpans(geom)[node]
  return [(r - rNear) / extent, (r + w - rNear) / extent]
}

/** Pixel dimensions for a wall's art at a given long edge, preserving the
 *  chain's true aspect (the "true mesh aspect" law — no stretched prints).
 *  The width is the FULL radial extent, which is the sheet the painter fills. */
export function stagedChainArtSize(geom: StagedChainGeom, longEdge = 1024): { w: number; h: number } {
  const aspect = (stagedChainRFar(geom) - stagedChainRNear(geom)) / stagedChainLength(geom)
  return { w: Math.round(longEdge * aspect), h: longEdge }
}
