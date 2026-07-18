/**
 * THE CITADEL RANK (E1 showpiece, element 4b) — the flanking city-skyline rows.
 * Bench-proven in .superpowers/sdd/bench/derive-keep-cityrows.mjs (Y1-Y6, the
 * successor to derive-keep-skyline.mjs); spec docs/superpowers/specs/2026-07-16-
 * dispatch-keep-derivation.md.
 *
 * E1.5.2 RE-DERIVATION (orchestrator eye-test verdict). The v1 form was a
 * fore-hinge PRISM (two slopes over a ridge running ALONG the spine). The
 * along-spine reading camera sees any such prism END-ON — the rooftops read as
 * near-edge-on leaning shards (current) or kraft backs (flipped). Root cause is
 * orientation class: every piece that reads in this book FACES +z (toward the
 * reader). So the rank is re-derived as +z-facing STANDING ROWS — the v1
 * backdrop-row grammar (ch1's fence / ch5's stall rows), but page-driven flaps
 * rather than spine v-folds so they sit off to the FLANKS of the keep.
 *
 * THE MECHANISM (single-page cammed flap). Each row is one rigid flap rooted on
 * an OUTER page along a RADIAL hinge line (constant world-z), rotating up about
 * that hinge from flat-on-page (book closed) to a near-upright lean (book open),
 * driven by the shared fold-flat envelope E(beta) — the SAME page-driven cam
 * class as the retired mound (the ONE off-spine form proven real-time + keep-
 * clearing), only REORIENTED: the flap face spans RADIAL x UP at a fixed depth,
 * so its normal points along z and the die-cut roofline faces the reader. The
 * flap leans slightly BACK (top toward -z) so the elevated composition camera
 * reads its front face. Rows step in depth (zc) and radius (F) per side; the
 * grown+forward pass MARCHES the tiers toward the reader and outboard together
 * (deep/tall back tier at F 0.43 zc -0.52 -> a front tier jutting to zc ~ -0.16
 * out at F 0.52) so the rooftops read as a PRESENT flanking city that layers into
 * distance. The hard ceiling is the real-time cap: the per-vertex page-turn step
 * is pure page-sweep (rfar * dtheta, independent of standDeg/envelope), so
 * F+width must stay <= ~0.752 — which caps row height near ~0.11. A literal 2x is
 * infeasible: the wide strip art binds width = height*artAspect, so a 2x row would
 * reach INTO the keep, not toward the sides (frontier gain ~+29% apparent size).
 *
 * FOLD-FLAT. lift = rho * sin(a), a = standDeg * E(beta), E(0) = 0 -> a = 0 at
 * book-closed: every flap point collapses to lift 0 (flat in the page plane).
 * A10 wedge + fold-flat are exact by construction.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176
// The flap leans its top BACK toward -z as it stands (top tips away from the
// reader), so its front face angles UP toward the elevated composition camera
// (the reason the along-spine prism failed was facing the wrong way).
const LEAN_SIGN = -1

/** One city-skyline ROW: a single-page +z-facing flap. `F` is the inner radial
 *  run of its base hinge from the spine, `width` the radial extent (= the
 *  roofline width in world x, aspect-bound: width = height * artAspect), `height`
 *  the roofline height, `zc` the depth (world z) of the hinge, `standDeg` the
 *  rest lean (deg from flat; < 90 tips the top back toward -z). */
export type KeepSkylineRow = {
  F: number
  width: number
  height: number
  zc: number
  standDeg: number
}

export type KeepSkylineGeom = {
  mech: 'skyline'
  /** The outer page this rooftop line stands on. */
  side: 'left' | 'right'
  rows: readonly KeepSkylineRow[]
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (E(0)=0 exact), so
 *  every row folds dead flat at book-closed. */
export function keepSkylineEnvelope(geom: KeepSkylineGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

/** The outer page's own moving frame (u toward the fore edge, n the page normal
 *  into the wedge). */
function pageFrame(geom: KeepSkylineGeom, thetaL: number, thetaR: number): { u: Vec3; n: Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n }
}

/** One row's single flap quad at the current dihedral. Corner order
 *  [base-inner, base-outer, top-outer, top-inner] — the roofline art maps u
 *  along the radial base (0..1) and v up the flap (0 hinge -> 1 roofline crest).
 *  The flap rotates about its radial base hinge: at book-open it stands (lift =
 *  rho*sin a), at book-closed it lies flat (a -> 0). */
export function solveSkylineRow(
  geom: KeepSkylineGeom,
  row: KeepSkylineRow,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const { u, n } = pageFrame(geom, thetaL, thetaR)
  const a = rad(row.standDeg) * keepSkylineEnvelope(geom, beta)
  const sa = Math.sin(a)
  const ca = Math.cos(a)
  // point at radial d (along u) and height-parameter rho up the flap: it lifts
  // rho*sa off the page along n and shifts rho*ca*LEAN_SIGN in world z (the lean
  // about the radial hinge at world z = zc).
  const P = (d: number, rho: number): Vec3 => [
    d * u[0] + rho * sa * n[0],
    d * u[1] + rho * sa * n[1],
    row.zc + rho * ca * LEAN_SIGN,
  ]
  const d0 = row.F
  const d1 = row.F + row.width
  const h = row.height
  return [P(d0, 0), P(d1, 0), P(d1, h), P(d0, h)]
}

/** Every row's flap quad for the renderer (one flap per row). */
export function solveKeepSkylinePose(
  geom: KeepSkylineGeom,
  thetaL: number,
  thetaR: number
): readonly PanelQuad[] {
  return geom.rows.map((r) => solveSkylineRow(geom, r, thetaL, thetaR))
}

/** Every world-space quad the skyline poses — for the collision / motion /
 *  depth dispatchers (one flap per row). */
export function keepSkylineQuads(geom: KeepSkylineGeom, thetaL: number, thetaR: number): PanelQuad[] {
  return geom.rows.map((r) => solveSkylineRow(geom, r, thetaL, thetaR))
}
