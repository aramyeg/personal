/**
 * TAB PIECE — a page-internal strip with a VISIBLE tab at the fore edge.
 * Proven numerically in .superpowers/sdd/bench/derive-tabpiece.mjs (D1).
 *
 * The whole structure lives on ONE page: a fixed hinge on the fore side, a
 * sliding hinge on the spine side, and a strip running inside the page from
 * the sliding hinge out through a slit at the fore edge — the strip's end IS
 * the tab. Opening the book draws the strip out; the sliding hinge chases
 * the fixed one and the structure buckles up. Book sources: Birmingham
 * mech 90 "knee" (equal panel lengths make the buckle), mech 84 strip
 * grammar, mech 116 automatic drive (page opening as the actuator).
 *
 * Forms (cross-section in page-local d = gutter->fore edge, h = page
 * normal; both share the slide law s = 2w(1 - cos a)):
 *   mound — two panels of width w meeting at a ridge:
 *           inner (F - 2w + s, 0) -> ridge (F - w cos a, w sin a) -> (F, 0)
 *   table — mirrored legs w + level deck D between their tops:
 *           inner (F - 2w cos a - D, 0) -> (F - w cos a - D, h)
 *           -> (F - w cos a, h) -> (F, 0), h = w sin a; flat span 2w + D,
 *           fully coplanar at a = 0 (no stacking - opens flat for free).
 *
 * Drive: the user released tab pieces from strict gutter physics, so the
 * page-angle -> lift gearing is a designed cam:
 *   u = sin(beta/2) / sin(rest/2) clamped, a = liftRest * sin(u * pi/2).
 * Finite slope at liftoff (the naive acos-of-linear-slide drive snaps with
 * infinite lift velocity at s = 0 — bench gate T5). Early-rise character:
 * 56% of rest lift at quarter-rest, 89% at half (bench measurement).
 * tabOut = s exactly — the strip is inextensible, so the visible tab
 * emerges by precisely the slide distance (bench gate T3).
 */

import { PAGE_W } from './page-geometry'
import type { PanelQuad, TabPieceGeom, Vec3 } from './popup-mechanics'

export type { TabPieceGeom }

export type TabPieceFace = 'slopeIn' | 'slopeOut' | 'legIn' | 'deck' | 'legOut' | 'tab'

export type TabPiecePatch = {
  readonly face: TabPieceFace
  readonly quad: PanelQuad
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

/** How far the tab stays visible inside the fore edge even when flush —
 *  the grabbable lip (and the slit's cap strip). */
export const TAB_LIP = 0.02

/** Flat (closed-book) span of the structure from fixed hinge to inner
 *  hinge — the footprint the covenant checks against the page. */
export const tabPieceFlatSpan = (geom: TabPieceGeom): number =>
  2 * geom.legW + (geom.form === 'table' ? (geom.deckD ?? 0) : 0)

/** The designed cam: lift angle for a given dihedral. Exported for tests
 *  (motion-character gates) and the future interactive override (D6). */
export function tabPieceLift(geom: TabPieceGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? 176)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return rad(geom.liftDeg ?? 55) * Math.sin((u * Math.PI) / 2)
}

/** Strip slide distance = visible tab protrusion (inextensible strip). */
export function tabPieceTabOut(geom: TabPieceGeom, beta: number): number {
  return 2 * geom.legW * (1 - Math.cos(tabPieceLift(geom, beta)))
}

/** The page's own moving frame at the current dihedral — u along the page
 *  surface toward the fore edge, n the page normal into the wedge — packaged
 *  as the point-in-page-plane function P(d, lift, z). Shared by the pose
 *  solver and the fore-edge slit below: both ride the same rigid page, so
 *  they must be built from the exact same u/n. */
function pagePoint(
  geom: TabPieceGeom,
  thetaL: number,
  thetaR: number
): (d: number, lift: number, z: number) => Vec3 {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z]
}

/** The two endpoints of the SLIT the tab emerges through: the fixed cut in
 *  the fore edge itself (d = PAGE_W, h = 0), spanning the tab's width. Rides
 *  the page rigidly — recomputed from theta every frame exactly like every
 *  other patch — so it never drifts from where the tab actually exits (D3:
 *  without it the tab read as a disconnected floating quad rather than
 *  something pulled through a cut in the page). */
export function tabPieceSlit(geom: TabPieceGeom, thetaL: number, thetaR: number): readonly [Vec3, Vec3] {
  const P = pagePoint(geom, thetaL, thetaR)
  const tabW = geom.tabW ?? 0.1
  const zc = (geom.z0 + geom.z1) / 2
  const tabSign = geom.side === 'left' ? -1 : 1
  return [P(PAGE_W, 0, zc - (tabSign * tabW) / 2), P(PAGE_W, 0, zc + (tabSign * tabW) / 2)]
}

/**
 * Solves the world pose. Corner order per quad matches the platform
 * convention — [bl, br, tr, tl] as seen from outside at rest — so identity
 * uvs print upright. The piece rides its page's own frame (like the strip
 * flap): u along the page toward the fore edge, n the page normal into
 * the wedge; the tab lies IN the page plane beyond the fore edge.
 */
export function solveTabPiecePose(
  geom: TabPieceGeom,
  thetaL: number,
  thetaR: number
): readonly TabPiecePatch[] {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const a = tabPieceLift(geom, beta)
  const w = geom.legW
  const s = 2 * w * (1 - Math.cos(a))
  const h = w * Math.sin(a)
  const reach = w * Math.cos(a)

  const P = pagePoint(geom, thetaL, thetaR)

  // Winding: the outward normal of [A za, A zb, B zb, B za] is
  // (dB-dA)·n - (hB-hA)·u only when za->zb runs WITH z x u = n; the left
  // page's u flips, so its quads take the z pair reversed to keep
  // FrontSide = outside (spine-and-up for the inner faces).
  const { hingeX: F } = geom
  const [za, zb] = geom.side === 'left' ? [geom.z1, geom.z0] : [geom.z0, geom.z1]
  const panel = (face: TabPieceFace, dA: number, hA: number, dB: number, hB: number): TabPiecePatch => ({
    face,
    quad: [P(dA, hA, za), P(dA, hA, zb), P(dB, hB, zb), P(dB, hB, za)],
  })

  const patches: TabPiecePatch[] =
    geom.form === 'mound'
      ? [
          panel('slopeIn', F - 2 * w + s, 0, F - reach, h),
          panel('slopeOut', F - reach, h, F, 0),
        ]
      : [
          panel('legIn', F - 2 * reach - (geom.deckD ?? 0), 0, F - reach - (geom.deckD ?? 0), h),
          panel('deck', F - reach - (geom.deckD ?? 0), h, F - reach, h),
          panel('legOut', F - reach, h, F, 0),
        ]

  const tabW = geom.tabW ?? 0.1
  const zc = (geom.z0 + geom.z1) / 2
  const tabSign = geom.side === 'left' ? -1 : 1
  patches.push({
    face: 'tab',
    quad: [
      P(PAGE_W - TAB_LIP, 0, zc - (tabSign * tabW) / 2),
      P(PAGE_W - TAB_LIP, 0, zc + (tabSign * tabW) / 2),
      P(PAGE_W + s, 0, zc + (tabSign * tabW) / 2),
      P(PAGE_W + s, 0, zc - (tabSign * tabW) / 2),
    ],
  })
  return patches
}
