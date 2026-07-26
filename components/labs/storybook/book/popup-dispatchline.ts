/**
 * THE DISPATCH LINE (E3 s4 round-4) — family #25: a working cable with
 * letter-baskets riding it, and the reader's hand on one of them.
 *
 * Derived in `.superpowers/sdd/bench/e3s4r4-cable.mjs`, whose header records
 * the three answers that had to die first. The short version:
 *
 *   A CABLE CANNOT CROSS THE GUTTER ON THIS SPREAD. A thread between two page
 *   anchors carries ~1.2 of slack at book-closed. A dress overhang reaching
 *   toward the spine dies at the backdrop-wings wedge (rnear -> 0). And a
 *   gutter-anchored die-cut v-fold — the one that should have worked, since a
 *   v-fold IS spine-anchored and the class was never near the height wall —
 *   fails on a number nobody had written down: a v-fold's crest RAKES through
 *       z = apexZ + height * vDir * cos(lambda(beta))
 *   as its crease elevation runs 174.5deg -> 104.7deg over the turn, a depth
 *   excursion of ~1.25 x height. Any span tall enough to carry a cable over the
 *   keep's crown spends most of the turn raking straight through the keep.
 *
 *   HOUSE LAW EARNED THERE: **the keep owns the gutter.** On a spread with a
 *   tall spine-anchored stack, a second gutter-class piece must be SHORT or
 *   seated ON the stack — never a tall free-standing span.
 *
 * So the line crosses the gutter the way a cut-paper book crosses anything: the
 * reader's eye does it. The cable leaves the crooked tower's own crown storey
 * (die-cut into the tower's sheet), runs over the keep's spire lantern (painted
 * on a piece already standing there), and lands on THIS piece — a page-rooted
 * die-cut panel on the right page carrying the long swooping run, the basket
 * lanterns, and the reader's basket, down into the terraced roosts.
 *
 * STRUCTURE. The panel is a STAGEDCHAIN — the tower's own family, already
 * proven — so nothing here re-derives physics. What is new is:
 *
 *   THE DIE-CUT CABLE, a polyline in panel (u, v): u runs radially inboard ->
 *   outboard across the sheet, v climbs the whole chain (so a rider crosses the
 *   storey joint without a seam). Everything off the line, its masts and its
 *   lanterns is cut away by the atlas alpha; the sheet is a wall, the
 *   silhouette is a cable.
 *
 *   THE RIDER, an IN-PLANE translation inside the panel. This is the keepwinch
 *   counterweight idiom exactly — a sash-weight descending WITHIN the hall
 *   flank-wall plane: zero off-plane reach, drive-insensitive, wedge-contained
 *   for free. A rider is a CONSTANT-WEIGHT bilinear combination of the sheet's
 *   four corners, so (a) its per-station displacement is a convex combination
 *   of theirs and can never exceed the sheet's own worst step, and (b) when the
 *   sheet folds dead flat, so does the basket — at ANY held position. The
 *   liftflap persistence law is satisfied structurally rather than by gating:
 *   the panel's cam IS the rider's envelope.
 *
 * PAPER PEDIGREE: Birmingham mech 116's automatic strip drives the panel off
 * the page; the rider is a slot-and-slider (mechs 45-48) cut along the cable —
 * the reader's thumb pushes the basket down the wire.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'
import {
  solveStagedChainPose,
  stagedChainLength,
  type StagedChainGeom,
} from './popup-stagedchain'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** A node of the die-cut cable in panel space: [u across the sheet, v up it]. */
export type CableNode = readonly [number, number]

export type DispatchLineGeom = Omit<StagedChainGeom, 'mech'> & {
  mech: 'dispatchline'
  /** The die-cut cable, inboard -> outboard. Must be monotone in u. */
  cable: readonly CableNode[]
  /** Fixed basket lanterns, as arc parameters s in [0, 1] along the cable. */
  baskets: readonly number[]
  /** Where the reader's basket sits before it is pushed. */
  riderHome: number
  /** Half-size of a basket's die-cut sprite, in panel (u, v) units. */
  basketHalfU: number
  basketHalfV: number
  /** Atlas cell rows for the basket sprites (one row per basket sprite). */
  basketSprites?: number
}

/** The panel geom underneath — the same object, read as its own family. */
export const dispatchLinePanel = (geom: DispatchLineGeom): StagedChainGeom =>
  ({ ...geom, mech: 'stagedchain' }) as StagedChainGeom

/**
 * Point on the die-cut cable at arc parameter s in [0, 1], piecewise-linear
 * over the authored nodes. s is a UNIFORM parameter over node index, not over
 * true arc length — the authored nodes are evenly spaced in u, so the two agree
 * to within the sag, and a uniform parameter is what makes the reader's drag
 * feel like pushing a basket rather than winding a variable gear.
 */
export function dispatchLineCableAt(geom: DispatchLineGeom, s: number): CableNode {
  const n = geom.cable.length
  if (n === 0) return [0, 0]
  if (n === 1) return geom.cable[0]
  const t = clamp(s, 0, 1) * (n - 1)
  const i = Math.min(n - 2, Math.floor(t))
  const f = t - i
  const a = geom.cable[i]
  const b = geom.cable[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/**
 * Panel (u, v) -> world, through the chain's own trapezoid quads. v is measured
 * over the WHOLE chain length so the cable runs across the storey joint without
 * a seam; u is the fraction across each node's radial span, which on a
 * trapezoid narrows with height exactly as the printed sheet does.
 */
export function dispatchLinePoint(
  geom: DispatchLineGeom,
  u: number,
  v: number,
  thetaL: number,
  thetaR: number
): Vec3 {
  const panel = dispatchLinePanel(geom)
  const { panels } = solveStagedChainPose(panel, thetaL, thetaR)
  const total = stagedChainLength(panel)
  const target = clamp(v, 0, 1) * total
  let below = 0
  let k = 0
  for (; k < panel.stages.length - 1; k++) {
    if (below + panel.stages[k].h >= target) break
    below += panel.stages[k].h
  }
  const local = clamp((target - below) / panel.stages[k].h, 0, 1)
  const q = panels[k] // [inner-base, outer-base, outer-top, inner-top]
  const uu = clamp(u, 0, 1)
  const out: number[] = []
  for (let c = 0; c < 3; c++) {
    const a = q[0][c] + (q[1][c] - q[0][c]) * uu
    const b = q[3][c] + (q[2][c] - q[3][c]) * uu
    out.push(a + (b - a) * local)
  }
  return [out[0], out[1], out[2]]
}

/**
 * The four world corners of a basket sitting at arc parameter s — a small
 * axis-aligned rectangle in PANEL space, so it is coplanar with the sheet by
 * construction and inherits fold-flat, wedge containment and the real-time
 * bound from it. Corner order matches the chain's own convention
 * [inner-base, outer-base, outer-top, inner-top].
 */
export function dispatchLineBasketQuad(
  geom: DispatchLineGeom,
  s: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const [u, v] = dispatchLineCableAt(geom, s)
  const u0 = clamp(u - geom.basketHalfU, 0, 1)
  const u1 = clamp(u + geom.basketHalfU, 0, 1)
  // The basket HANGS: its top edge is the cable, its body below it.
  const v1 = clamp(v, 0, 1)
  const v0 = clamp(v - 2 * geom.basketHalfV, 0, 1)
  const at = (uu: number, vv: number): Vec3 => dispatchLinePoint(geom, uu, vv, thetaL, thetaR)
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]
}

/**
 * The reader's basket position. `drive` is the raw drive-channel stroke in
 * [0, 1]; there is no separate fold-flat envelope because an in-plane rider on
 * a folding sheet already carries one — the sheet's cam. Holding the basket
 * mid-span through a page turn is therefore free, which is the whole point of
 * building the playable IN the plane instead of on top of it.
 */
export const dispatchLineRiderS = (geom: DispatchLineGeom, drive: number): number =>
  clamp(geom.riderHome + (1 - geom.riderHome) * clamp(drive, 0, 1), 0, 1)

/** Screen-space-free reach check used by the tests: the cable must lie inside
 *  the sheet and fall monotonically outboard (the scene's one-diagonal law). */
export function dispatchLineCableIsLegal(geom: DispatchLineGeom): boolean {
  return geom.cable.every(
    ([u, v], i) =>
      u >= 0 &&
      u <= 1 &&
      v >= 0 &&
      v <= 1 &&
      (i === 0 || (u > geom.cable[i - 1][0] && v <= geom.cable[i - 1][1] + 1e-9))
  )
}
