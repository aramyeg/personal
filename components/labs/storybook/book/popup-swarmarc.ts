/**
 * THE CARRIER SWARM (E3 s3, new family 'swarmarc') — a horseshoe vortex of
 * graded hairline struts, each carrying one tiny courier (bee / envelope /
 * parcel), wheeling around the ch2 hero. Bench-proven in
 * .superpowers/sdd/bench/e3s3-swarmarc.mjs (S1–S7); spec
 * .superpowers/sdd/scenes/s3-scene-pack.md.
 *
 * FAMILY MODEL (per strut, single rigid hinge, page-riding). Each strut is ONE
 * rigid die-cut: hairline strut (width 0.010, length L) + rider silhouette of
 * radius r beyond the tip (L_eff = L + r), glued to ONE page at radial anchor
 * distance F from the spine at depth z0, hinge line RADIAL (along the page's
 * fore-edge direction). Flat pose lies along +z (downstage); deploy angle a
 * about the hinge lifts the run off the page along the page normal:
 *   point(d, rho) = d·u + rho·sin(a)·n + (z0 + rho·cos(a))·ẑ.
 *
 * WHY FULL DEPLOY IS LEGAL THROUGH THE TURN (the family's load-bearing fact):
 * the per-vertex page-turn step is pure page sweep = R·dθ (ch3 skyline law),
 * R = max vertex distance from the spine axis. For a +z-flat radial-hinge
 * strut R(a) = √(F² + (L_eff·sin a)²), monotone in a, and R(0) = F — the flat
 * pose adds only z, which the spine axis ignores. R(aRest) ≤ 0.75 for every
 * strut in the table ⇒ no staged envelope; q(0)=0 free via the house E(beta).
 * Corollary: tall struts anchor near the gutter, tips never pass |x| ≈ 0.75 —
 * the radius wall itself shapes the vortex (high crown at the spine, low wide
 * limbs). Grammar and kinematics are the same statement.
 *
 * WAVE-STAGGERED DEPLOY (M1-lawful): strut i erects inside its own eased
 * window a_i(E) = aRest_i · smoothstep(b0_i, b0_i + 0.38, E) with
 * b0_i = 0.18 + 0.42·w_i, wave key w_i = (150 − |θ_i|)/140 (outriders slightly
 * before the front ends; crown last; all full by E = 0.98; monotone; a(0)=0
 * exactly since E(0)=0). Opening the page pours the swarm out of the hive.
 *
 * STIR THE SWARM (user tab, drive channel `ch2-swarm~stir`): stroke
 * s ∈ [0, stroke] rocks the 5 right-arm STIR struts by
 * Δa_k(s) = deg° · sin(π · clamp(s/stroke − phaseStep·k, 0, 1)), k = rank from
 * the tab inward — a ripple that runs up the arm and dies at the side. The
 * SHOWN angle is (aRest·W_i(E) + Δa_k(s)) · gated by E via the liftflap
 * persistence law (user state × envelope): both terms carry the envelope, so
 * fold-flat survives any held stir state.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176

/** One swarm strut: a single rigid die-cut (hairline strut + rider) hinged on
 *  ONE page along a radial line. `F` = radial anchor distance from the spine
 *  (≥ 0.10, the glue-lane keep-out), `z0` the hinge depth, `L` the strut
 *  length to the rider center, `r` the rider silhouette radius beyond the tip
 *  (reach L_eff = L + r), `aRestDeg` the rest deploy angle, `wave` the stagger
 *  key w (b0 = 0.18 + 0.42·w), `stir` the ripple rank from the tab inward
 *  (−1 = not a stir member), `sprite` the atlas cell its rider samples,
 *  `flip` a u-mirror so no two neighbors share sprite+flip. */
export type SwarmStrut = {
  side: 'left' | 'right'
  F: number
  z0: number
  L: number
  r: number
  aRestDeg: number
  wave: number
  stir: number
  sprite: number
  flip: boolean
}

export type SwarmStirSpec = {
  side: 'left' | 'right'
  /** Full tab stroke in world units (drive domain [0, stroke]). */
  stroke: number
  /** Peak ripple amplitude in degrees. */
  deg: number
  /** Phase lag per rank (fraction of the normalized stroke). */
  phaseStep: number
}

export type SwarmArcGeom = {
  mech: 'swarmarc'
  struts: readonly SwarmStrut[]
  /** Hairline strut die-cut width (world units, 0.010). */
  strutW: number
  stir: SwarmStirSpec
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (E(0)=0 exact). */
export function swarmArcEnvelope(geom: SwarmArcGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Wave-window deploy fraction for wave key `w` at envelope `E` (§3 formula):
 *  smoothstep over [b0, b0 + 0.38], b0 = 0.18 + 0.42·w. All windows close by
 *  E = 0.98 for w ≤ 1; the window floor never goes below 0 (outriders w < 0). */
export function swarmWaveWindow(w: number, E: number): number {
  const b0 = Math.max(0, 0.18 + 0.42 * w)
  return smoothstep(b0, b0 + 0.38, E)
}

/** Stir ripple delta (deg) for rank `k` at tab stroke `s` (§3 formula). */
export function swarmStirDelta(spec: SwarmStirSpec, k: number, s: number): number {
  if (k < 0) return 0
  return spec.deg * Math.sin(Math.PI * clamp(s / spec.stroke - spec.phaseStep * k, 0, 1))
}

/** The strut's SHOWN deploy angle (radians) at envelope E and tab stroke s —
 *  the liftflap persistence composition: both the wave-windowed rest term and
 *  the user ripple are inside the envelope, so a(E=0) = 0 exactly for ANY
 *  held stir state (fold-flat law). */
export function swarmDeployAngle(geom: SwarmArcGeom, strut: SwarmStrut, E: number, stirS: number): number {
  const restTerm = rad(strut.aRestDeg) * swarmWaveWindow(strut.wave, E)
  const stirTerm = rad(swarmStirDelta(geom.stir, strut.stir, stirS)) * E
  return restTerm + stirTerm
}

/** Spine-axis radius R(a) = √(F² + (L_eff·sin a)²) — the page-turn step is
 *  R·dθ (pure page sweep). Monotone in a; R(0) = F. */
export function swarmStrutRadius(strut: SwarmStrut, aDeg: number): number {
  const reach = (strut.L + strut.r) * Math.sin(rad(clamp(aDeg, 0, 90)))
  return Math.hypot(strut.F, reach)
}

/** The carrying page's own moving frame (u toward the fore edge, n the page
 *  normal into the wedge) — identical to the skyline's pageFrame. */
function pageFrame(side: 'left' | 'right', thetaL: number, thetaR: number): { u: Vec3; n: Vec3 } {
  const t = side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n }
}

export type SwarmStrutPose = {
  /** Hairline strut quad [foot-in, foot-out, tip-out, tip-in] (u across width, v foot→tip). */
  strut: PanelQuad
  /** Rider quad (2r × 2r about the strut tip), same corner/uv order. */
  rider: PanelQuad
  /** Shown deploy angle (radians). */
  a: number
}

/** One strut's posed quads at the current dihedral, optional tab stroke. */
export function solveSwarmStrut(
  geom: SwarmArcGeom,
  strut: SwarmStrut,
  thetaL: number,
  thetaR: number,
  stirS = 0
): SwarmStrutPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const E = swarmArcEnvelope(geom, beta)
  const a = swarmDeployAngle(geom, strut, E, stirS)
  const { u, n } = pageFrame(strut.side, thetaL, thetaR)
  const sa = Math.sin(a)
  const ca = Math.cos(a)
  const P = (d: number, rho: number): Vec3 => [
    d * u[0] + rho * sa * n[0],
    d * u[1] + rho * sa * n[1],
    strut.z0 + rho * ca,
  ]
  const hw = geom.strutW / 2
  const L = strut.L
  const r = strut.r
  const strutQuad: PanelQuad = [P(strut.F - hw, 0), P(strut.F + hw, 0), P(strut.F + hw, L), P(strut.F - hw, L)]
  const rider: PanelQuad = [
    P(strut.F - r, L - r),
    P(strut.F + r, L - r),
    P(strut.F + r, L + r),
    P(strut.F - r, L + r),
  ]
  return { strut: strutQuad, rider, a }
}

/** Every strut's posed quads for the renderer. */
export function solveSwarmArcPose(
  geom: SwarmArcGeom,
  thetaL: number,
  thetaR: number,
  stirS = 0
): readonly SwarmStrutPose[] {
  return geom.struts.map((s) => solveSwarmStrut(geom, s, thetaL, thetaR, stirS))
}

/** Every world-space quad the swarm poses (strut + rider per member) — for
 *  the collision / motion / depth dispatchers. */
export function swarmArcQuads(geom: SwarmArcGeom, thetaL: number, thetaR: number): PanelQuad[] {
  const out: PanelQuad[] = []
  for (const pose of solveSwarmArcPose(geom, thetaL, thetaR)) {
    out.push(pose.strut, pose.rider)
  }
  return out
}

// ---------------------------------------------------------------------------
// RING GENERATION — the bench constants verbatim (e3s3-swarmarc.mjs). The
// content entry regenerates the 28-strut table from these rather than pasting
// 28 rows; the unit suite gates the output against the pack's spot values.
// ---------------------------------------------------------------------------

const RX = 0.66
const ZC = 0.05
const RZ = 0.35
const Y0 = 0.12
const YA = 0.49
const YEXP = 2.1
const YSKEW = 0.04
const A0 = 57
const A1 = 21
const R0 = 0.052
const R1 = 0.016
const N_SIDE = 12
const TH_MIN = 10
const TH_MAX = 150
/** Ring thetas that the stir tab rocks (right page, |θ| ≥ 99°). */
const STIR_MIN_THETA = 98
/** Outriders erect just before the front ends (wave floor clamps b0 at 0). */
const OUTRIDER_WAVE = -0.05
const SPRITE_COUNT = 16
const SPRITE_STRIDE = 7 // coprime with 16 → consecutive struts never share a cell

function ringStrut(thetaDeg: number, side: 'left' | 'right', index: number): SwarmStrut {
  const sideSign = side === 'left' ? -1 : 1
  const th = rad(thetaDeg)
  const c = 0.5 + 0.5 * Math.cos(th)
  const x = RX * Math.sin(th)
  const z = ZC - RZ * Math.cos(th)
  const y = Y0 + YA * Math.pow(c, YEXP) + YSKEW * sideSign * Math.sin(th)
  const aRest = A0 + A1 * c
  const r = R0 - R1 * c
  const L = y / Math.sin(rad(aRest))
  const z0 = z - L * Math.cos(rad(aRest))
  const stirred = side === 'right' && thetaDeg >= STIR_MIN_THETA
  // Ripple rank counts from the TAB (fore edge, θ = 150°) inward.
  const stir = stirred ? Math.round(((TH_MAX - thetaDeg) * (N_SIDE - 1)) / (TH_MAX - TH_MIN)) : -1
  return {
    side,
    F: x,
    z0,
    L,
    r,
    aRestDeg: aRest,
    wave: (TH_MAX - thetaDeg) / 140,
    stir,
    sprite: (index * SPRITE_STRIDE) % SPRITE_COUNT,
    flip: index % 2 === 1,
  }
}

function outriderStrut(
  x: number,
  y: number,
  z: number,
  aRestDeg: number,
  r: number,
  index: number
): SwarmStrut {
  const L = y / Math.sin(rad(aRestDeg))
  const z0 = z - L * Math.cos(rad(aRestDeg))
  return {
    side: x < 0 ? 'left' : 'right',
    F: Math.abs(x),
    z0,
    L,
    r,
    aRestDeg,
    wave: OUTRIDER_WAVE,
    stir: -1,
    sprite: (index * SPRITE_STRIDE) % SPRITE_COUNT,
    flip: index % 2 === 1,
  }
}

/** The full 28-member swarm: 24 ring struts ordered θ −150° → +150° (left arm
 *  front→crown, right arm crown→front), then the 4 outrider strays. Matches
 *  the bench table e3s3-swarmarc.mjs row for row. */
export function buildSwarmStruts(): readonly SwarmStrut[] {
  const thetas = Array.from({ length: N_SIDE }, (_, i) => TH_MIN + (i * (TH_MAX - TH_MIN)) / (N_SIDE - 1))
  const leftArm = [...thetas].reverse().map((t, i) => ringStrut(t, 'left', i))
  const rightArm = thetas.map((t, i) => ringStrut(t, 'right', N_SIDE + i))
  const outriders = [
    outriderStrut(-0.73, 0.1, 0.42, 56, 0.05, 24),
    outriderStrut(-0.7, 0.14, 0.16, 58, 0.048, 25),
    outriderStrut(0.73, 0.09, 0.44, 56, 0.05, 26),
    outriderStrut(0.71, 0.13, 0.2, 58, 0.048, 27),
  ]
  return [...leftArm, ...rightArm, ...outriders]
}
