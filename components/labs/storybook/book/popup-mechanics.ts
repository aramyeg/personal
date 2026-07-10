/**
 * Pop-up mechanism kinematics — pure math, no three.js, jsdom-testable.
 *
 * Physical model (see docs/superpowers/research/2026-07-10-popup-kinematics-
 * literature.md and the benchmark spec): every pop-up piece is a symmetric
 * V-FOLD — a spherical four-bar whose four creases (gutter, two glue lines,
 * central crease) meet at an apex ON the spine. The piece is glued to BOTH
 * pages of its spread, so its pose is a pure function of the spread's
 * dihedral angle beta = thetaL - thetaR. No timers, no springs: when the
 * turning page moves, the paper glued to it is stretched open or folded
 * flat by the page's own motion, exactly like the real book.
 *
 * Closed form (Winder 2009 spherical four-bar / Glassner 2002, derived in
 * the literature doc §3.1): with glue-line angle phi (from the gutter) and
 * rigid panel corner angle rho (glue crease <-> central crease, an invariant
 * of the die-cut), the central crease rides the dihedral-bisector plane at
 * elevation
 *
 *   Lambda(beta) = Phi(beta) + arccos( cos(rho) / R(beta) )
 *   R(beta)      = sqrt( cos^2(phi) + sin^2(phi) * cos^2(beta/2) )
 *   Phi(beta)    = atan2( sin(phi) * cos(beta/2), cos(phi) )
 *
 * Total on [0, PI] — no singularities: Lambda(0) = phi + rho (folds flat
 * into the closed page plane, automatically), Lambda(PI) = the open stand.
 * Standing-when-open requires rho > phi; |cos(rho)| <= cos(phi) keeps the
 * linkage reachable at every beta. The characteristic late "bloom" of a
 * real pop-up is geometric: dLambda/dbeta grows as R(beta) approaches
 * |cos(rho)|, which happens at beta = PI — no hand animation.
 *
 * World convention (v2 orientation): spine along Z at x = 0, +Y up, +Z
 * toward the camera. A page at angle theta occupies direction
 * (cos theta, sin theta, 0): right page flat = 0, left page flat = PI.
 * The math runs in the dihedral-bisector frame (pages symmetric about its
 * X axis) and is rotated into the world by the bisector angle
 * m = (thetaL + thetaR) / 2 about Z.
 */

export type Vec3 = readonly [number, number, number]

export type VFoldSpec = {
  /** Apex position along the spine (world z). */
  apexZ: number
  /** Which way along the spine the V opens: +1 toward the camera (near
   *  edge), -1 away. Also the direction the piece sweeps when folding
   *  flat is the OPPOSITE of vDir — pick vDir so the folded piece stays
   *  on the page (benchmark A4). */
  vDir: 1 | -1
  /** Glue-line angle from the gutter, radians. Near PI/2 = wall regime
   *  (glue lines nearly perpendicular to the spine, face toward the
   *  reader); mid values = deeper V centerpieces. */
  phi: number
  /** Panel corner angle between glue crease and central crease, radians.
   *  Must satisfy rho > phi (stands when open) and
   *  |cos rho| <= cos phi (reachable at every beta). */
  rho: number
  /** Full art width across both halves (world units). */
  width: number
  /** Art height along the central crease (world units). */
  height: number
}

/** One panel's world-space quad corners, ordered for uv mapping:
 *  [bottom-inner (apex), bottom-outer, top-outer, top-inner]. The bottom
 *  edge lies exactly on the panel's page (along the glue line); the inner
 *  edge (apex -> top-inner) is the shared central crease. */
export type PanelQuad = readonly [Vec3, Vec3, Vec3, Vec3]

export type VFoldPose = {
  right: PanelQuad
  left: PanelQuad
  /** Central crease elevation Lambda (radians, from the gutter direction
   *  in the bisector plane). Lambda(0) = phi + rho. */
  lambda: number
  /** Unit central-crease direction in world space. */
  crease: Vec3
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Central-crease elevation for dihedral beta — the closed form above. */
export function creaseElevation(phi: number, rho: number, beta: number): number {
  const cb2 = Math.cos(beta / 2)
  const r = Math.sqrt(Math.cos(phi) ** 2 + Math.sin(phi) ** 2 * cb2 * cb2)
  const bigPhi = Math.atan2(Math.sin(phi) * cb2, Math.cos(phi))
  return bigPhi + Math.acos(clamp(Math.cos(rho) / r, -1, 1))
}

/** Crease elevation at fully open (beta = PI): arccos(cos rho / cos phi). */
export const openElevation = (phi: number, rho: number): number =>
  Math.acos(clamp(Math.cos(rho) / Math.cos(phi), -1, 1))

/**
 * Solves the v-fold's world pose for pages at (thetaL, thetaR).
 *
 * The art maps onto each panel as a parallelogram whose bottom edge runs
 * along the glue line (length width/2 / sin rho, so the art's perpendicular
 * half-width is exactly width/2) and whose side edges run along the central
 * crease — the same shear a real die-cut v-fold piece carries (its base is
 * cut at rho to the center crease). The whole bottom edge therefore lies IN
 * the page plane at every beta: the glue is visible truth, not an epsilon.
 */
export function solveVFold(spec: VFoldSpec, thetaL: number, thetaR: number): VFoldPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const { phi, rho, vDir, apexZ } = spec

  const lambda = creaseElevation(phi, rho, beta)

  // Bisector-frame unit vectors (pages symmetric about the frame's X axis;
  // z mirrored by vDir so the V opens the requested way along the spine).
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const gR: Vec3 = [sinPhi * Math.cos(h), -sinPhi * Math.sin(h), vDir * cosPhi]
  const gL: Vec3 = [sinPhi * Math.cos(h), sinPhi * Math.sin(h), vDir * cosPhi]
  const c: Vec3 = [Math.sin(lambda), 0, vDir * Math.cos(lambda)]

  // World = rotate by the bisector angle m about Z, then offset to the apex.
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const toWorld = (v: Vec3): Vec3 => [v[0] * cm - v[1] * sm, v[0] * sm + v[1] * cm, v[2]]
  const gRw = toWorld(gR)
  const gLw = toWorld(gL)
  const cw = toWorld(c)

  const glueLen = spec.width / 2 / Math.sin(rho)
  const hgt = spec.height
  const apex: Vec3 = [0, 0, apexZ]
  const at = (a: Vec3, u: Vec3, s: number, v: Vec3, t: number): Vec3 => [
    a[0] + u[0] * s + v[0] * t,
    a[1] + u[1] * s + v[1] * t,
    a[2] + u[2] * s + v[2] * t,
  ]

  const quad = (g: Vec3): PanelQuad => [
    apex,
    at(apex, g, glueLen, cw, 0),
    at(apex, g, glueLen, cw, hgt),
    at(apex, g, 0, cw, hgt),
  ]

  return { right: quad(gRw), left: quad(gLw), lambda, crease: cw }
}

// ---------------------------------------------------------------------------
// Turn plumbing: which page angles a spread sees, given a turn in flight.

export type SpreadRole = 'current' | 'outgoing' | 'incoming'
export type TurnDir = 'next' | 'prev'

/** The moving sheet's angle over the right side, radians 0..PI — matches
 *  the turning page's own rigid rotation exactly (same eased t). */
export const sheetAngle = (dir: TurnDir, easedT: number): number =>
  dir === 'next' ? Math.PI * clamp(easedT, 0, 1) : Math.PI * (1 - clamp(easedT, 0, 1))

/**
 * Page angles (thetaL, thetaR) for a spread, by its relationship to the
 * turn in flight. The sheet IS one page of both spreads at once:
 * the outgoing spread's dihedral closes PI -> 0 while the incoming one's
 * opens 0 -> PI, both driven by the single sheet angle — so the paper
 * moves exactly when, and as fast as, the page does.
 */
export function spreadPageAngles(
  role: SpreadRole,
  dir: TurnDir | null,
  easedT: number
): { thetaL: number; thetaR: number } {
  if (role === 'current' || dir === null) return { thetaL: Math.PI, thetaR: 0 }
  const theta = sheetAngle(dir, easedT)
  if (dir === 'next') {
    // Sheet lifts off the right stack (outgoing right page), lands as the
    // incoming spread's left page.
    return role === 'outgoing' ? { thetaL: Math.PI, thetaR: theta } : { thetaL: theta, thetaR: 0 }
  }
  // 'prev': sheet lifts off the left stack, lands as the incoming right page.
  return role === 'outgoing' ? { thetaL: theta, thetaR: 0 } : { thetaL: Math.PI, thetaR: theta }
}

/** Dihedral angle a spread sees for its role — the single driving value. */
export function spreadDihedral(role: SpreadRole, dir: TurnDir | null, easedT: number): number {
  const { thetaL, thetaR } = spreadPageAngles(role, dir, easedT)
  return clamp(thetaL - thetaR, 0, Math.PI)
}
