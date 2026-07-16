/**
 * THE SKYLINE (E1 showpiece, element 4b) — the flanking citadel rooftops. Bench-
 * proven in .superpowers/sdd/bench/derive-keep-skyline.mjs (Y1-Y5, VERDICT:
 * clears all gates); spec docs/superpowers/specs/2026-07-16-dispatch-keep-
 * derivation.md.
 *
 * The wings decision retired the erecting stage-set flats (a tall spine-anchored
 * wall is geometrically impossible behind the keep; off-spine flats bust real-
 * time). The canyon of towers became PAINTED aerial recession on the keep's own
 * upper back walls, PLUS this low mound skyline flanking the keep: 3 low mounds
 * per outer page, a jagged rooftop line stepping in Z (depth), page-driven by
 * the fold-flat envelope (no knob). Mounds are the ONE off-spine page-driven
 * form that passes real-time (small w; knobtower K6 proved it). The mound cross-
 * section is the tab-piece / knobtower-tier idiom verbatim — two slope panels
 * over a ridge band — driven by a = aRest * E(beta) instead of a crank.
 *
 * FEASIBLE BAND (hard, bench): fore-hinge F in [0.64, 0.75] — inner edge
 * F - 2w >= 0.44 clears the keep's mid-fold sweep; further out busts the
 * swinging-page vertex-speed cap.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176

/** One rooftop mound: fore hinge F (run from the spine), leg width w, rest lift
 *  aRest (below 90), and its z-band [zc - ridgeLen/2, zc + ridgeLen/2]. */
export type KeepSkylineMound = {
  F: number
  w: number
  aRestDeg: number
  zc: number
  ridgeLen: number
}

export type KeepSkylineGeom = {
  mech: 'skyline'
  /** The outer page this rooftop line stands on. */
  side: 'left' | 'right'
  mounds: readonly KeepSkylineMound[]
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (E(0)=0 exact), so
 *  every mound folds dead flat at book-closed. */
export function keepSkylineEnvelope(geom: KeepSkylineGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

export type KeepSkylineMoundPatch = {
  readonly slopeIn: PanelQuad
  readonly slopeOut: PanelQuad
}

/** The page's own moving frame (u toward the fore edge, n the page normal into
 *  the wedge). */
function pageFrame(geom: KeepSkylineGeom, thetaL: number, thetaR: number): (d: number, lift: number, z: number) => Vec3 {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z]
}

/** One mound's two slope quads at the current dihedral. Corner order
 *  [bl, br, tr, tl] as seen from outside at rest (the tab-piece winding: za/zb
 *  flip on the left page so FrontSide stays outside). */
export function solveSkylineMound(
  geom: KeepSkylineGeom,
  mound: KeepSkylineMound,
  thetaL: number,
  thetaR: number
): KeepSkylineMoundPatch {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const P = pageFrame(geom, thetaL, thetaR)
  const a = rad(mound.aRestDeg) * keepSkylineEnvelope(geom, beta)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const F = mound.F
  const w = mound.w
  const inner = F - 2 * w * ca
  const ridge = F - w * ca
  const h = w * sa
  const z0 = mound.zc - mound.ridgeLen / 2
  const z1 = mound.zc + mound.ridgeLen / 2
  const [za, zb] = geom.side === 'left' ? [z1, z0] : [z0, z1]
  const q = (dA: number, hA: number, dB: number, hB: number): PanelQuad => [
    P(dA, hA, za),
    P(dA, hA, zb),
    P(dB, hB, zb),
    P(dB, hB, za),
  ]
  return { slopeIn: q(inner, 0, ridge, h), slopeOut: q(ridge, h, F, 0) }
}

/** Every mound's patches for the renderer (one pair of slopes per mound). */
export function solveKeepSkylinePose(
  geom: KeepSkylineGeom,
  thetaL: number,
  thetaR: number
): readonly KeepSkylineMoundPatch[] {
  return geom.mounds.map((m) => solveSkylineMound(geom, m, thetaL, thetaR))
}

/** Every world-space quad the skyline poses — for the collision / motion /
 *  depth dispatchers. */
export function keepSkylineQuads(geom: KeepSkylineGeom, thetaL: number, thetaR: number): PanelQuad[] {
  return solveKeepSkylinePose(geom, thetaL, thetaR).flatMap((p) => [p.slopeIn, p.slopeOut])
}
