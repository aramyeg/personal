/**
 * DEPTH VISTA (E2.2 Batch B) — an ALL-WINGS graded tunnel-frame on spread 8 (The
 * Hero's Satchel). Proven numerically in .superpowers/sdd/bench/derive-
 * depthvista.mjs (all gates GREEN); this module ports its `moundPatches` math
 * VERBATIM. Pure math, no three.js, jsdom-testable.
 *
 * WHAT IT IS — N page-rooted parallel-fold FLAP PAIRS, each config mirrored to
 * the LEFT + RIGHT pages, graded near -> mid -> rear:
 *   near = warmest, largest, front-flank (keepsakes / tents / a waypost).
 *   mid  = cooler, roads winding back.
 *   rear = coolest, simplest, innermost VISIBLE (six-kingdoms horizon band).
 * Each wing is a +z-FACING billboard FLAP (the ch3-skyline row form): a rigid
 * die-cut painted plane whose radial BASE [F, F+width] sits at depth zc, standing
 * up by `height` and leaning its top toward -z (LEAN) so the broad front face
 * angles UP toward the reading camera — a substantial reader-facing MASS (normal
 * ~ +z), NOT the edge-on in-plane sliver a mound in-slope reads as. Rendered
 * DoubleSide alpha; NO raw-kraft riser (the bench's STRUT-SILHOUETTE gate proves
 * a mound's kraft back shows on this camera — the reason ch3's skyline was
 * re-derived from a prism to a single flap). Page-driven: the flap rises from
 * beta and folds DEAD FLAT at close (E(0) = 0). A strong near->rear scale taper +
 * the six shaped inner-top arcs imply one receding vaulted aperture over the bag.
 *
 * PAGE FRAME: a point at radial d and height rho is P = d*u + rho*sin a*n, with
 * z = zc + rho*cos a*LEAN (u = page-fore, n = page normal into the wedge, a =
 * standDeg*E(beta), LEAN = -1). The solve depends on the page angle only.
 */

import type { DepthVistaGeom, DepthVistaWing, PanelQuad, Vec3 } from './popup-mechanics'

export type { DepthVistaGeom, DepthVistaWing }

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180
/** The flap leans its top toward -z as it stands, so its broad front face angles
 *  up toward the elevated reading camera (the ch3-skyline LEAN_SIGN). */
const LEAN = -1

/** The book's rest bloom — the dihedral the fold-flat envelope normalizes to
 *  (bench REST_DEG). The shipped vista uses this; exposed so geoms may override. */
const DEFAULT_REST_DEG = 176

/** Page-openness envelope E(beta) — the shared fold-flat cam (bench `envelope`),
 *  identical to the skyline / lift-flap cam: E(0) = 0 EXACTLY, so every wing flap
 *  collapses to zero lift at book-closed regardless of its rest angle. */
export function depthVistaEnvelope(geom: DepthVistaGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

/** One wing flap posed on `side` at (thetaL, thetaR). PORTED VERBATIM from the
 *  bench `moundPatches`. Corner order [base-inner, base-outer, top-outer,
 *  top-inner] — the painted flap art maps u inner(0)->outer(1) along the radial
 *  base and v base(0)->top(1); the shaped inner-top arc sits at (u 0, v 1). */
export type MoundPatch = {
  /** The reader-facing painted flap quad. */
  flap: PanelQuad
  /** The painted (visible) surface — the flap (alias of flap, for the gates). */
  art: readonly PanelQuad[]
  /** Every quad the wing poses (just the flap — no raw-kraft riser). */
  all: readonly PanelQuad[]
  /** The top-edge lift off the page (height * sin a); 0 at book-closed. */
  hgt: number
  /** The flap's world-z extent (base line at zc, top leaning to zc - h cos a). */
  z0: number
  z1: number
  /** Radial base-inner edge (F, the hinge) and radial width. */
  inner: number
  width: number
}

export function moundPatches(
  geom: DepthVistaGeom,
  wing: DepthVistaWing,
  side: 'left' | 'right',
  thetaL: number,
  thetaR: number
): MoundPatch {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const t = side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const a = rad(wing.standDeg) * depthVistaEnvelope(geom, beta)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  // point at radial d (along u) and height rho: lifts rho*sa off the page (n) and
  // shifts rho*ca*LEAN in world z (the lean about the base hinge at z = zc).
  const P = (d: number, rho: number): Vec3 => [d * u[0] + rho * sa * n[0], d * u[1] + rho * sa * n[1], wing.zc + rho * ca * LEAN]
  const d0 = wing.F
  const d1 = wing.F + wing.width
  const h = wing.height
  const flap: PanelQuad = [P(d0, 0), P(d1, 0), P(d1, h), P(d0, h)]
  const hgt = h * sa
  const zTop = wing.zc + h * ca * LEAN
  const z0 = Math.min(wing.zc, zTop)
  const z1 = Math.max(wing.zc, zTop)
  return { flap, art: [flap], all: [flap], hgt, z0, z1, inner: wing.F, width: wing.width }
}

export type WingFlap = {
  key: string
  side: 'left' | 'right'
  patch: MoundPatch
}

export type DepthVistaPose = {
  /** One entry per wing config per side (2 * N flaps), front -> back, left then
   *  right within each config. */
  wings: readonly WingFlap[]
}

/**
 * Solves the whole depth vista's world pose for pages at (thetaL, thetaR): every
 * wing config mirrored onto both pages as a single cammed flap. Purely page-
 * driven — no user state — so a plain function of the two page angles. Every flap
 * folds dead flat at book close.
 */
export function solveDepthVistaPose(geom: DepthVistaGeom, thetaL: number, thetaR: number): DepthVistaPose {
  const wings: WingFlap[] = []
  for (const wing of geom.wings) {
    for (const side of ['left', 'right'] as const) {
      wings.push({ key: wing.key, side, patch: moundPatches(geom, wing, side, thetaL, thetaR) })
    }
  }
  return { wings }
}
