/**
 * KNOB-TWIST TOWER — D6 "THE HAND": a user-twisted paper crank erecting a row
 * of staggered knee towers. Proven numerically in
 * .superpowers/sdd/bench/derive-knobtower.mjs (D6).
 *
 * THE MECHANISM (paper truth). A die-cut disc is HUB-RIVETED (Birmingham mech
 * 103 "THE HUB") flat INTO the page, one glue layer proud — the rotor
 * vocabulary (popup-rotor.ts: coplanar, ROTOR_LIFT, spins in the page plane).
 * Unlike the page-driven rotor it is USER-driven: the reader TWISTS the knob
 * by angle theta. A pull-strip pinned to the disc at crank radius, routed
 * toward the towers (Birmingham 59/105 Scotch yoke + mech 84 strip, mech
 * 105/108 pin-in-slot leverage), converts the twist into a linear strip pull
 *   s(theta) = crankR * (1 - cos theta)
 * — a paper crank whose slope is zero at theta = 0 (no liftoff snap). The
 * strip erects N knee tiers (mech 90 "the knee", the tab-piece slide law
 * s = 2w(1 - cos a)) with STAGGERED ENGAGEMENT: tier k carries slack L_k and
 * does nothing until s > L_k, so the towers rise tier by tier as the knob
 * turns.
 *
 * PAGE-ROOTED like the tab piece (popup-tabpiece.ts): a fixed fore hinge on
 * one page, the towers standing IN that page's own moving frame P(d, lift, z)
 * — d along the page (gutter -> fore edge), lift the page normal, z along the
 * spine. Each tier is an independent MOUND (two slope panels over a ridge
 * band) at a common fore hinge, in its own disjoint z-band, ascending in size.
 *
 * THE TIER DRIVE — a DESIGNED per-tier cam (the snap fix, consistent with the
 * shipped tab-piece / rotor "gearing released as a design choice"):
 *   p_k = clamp((s - L_k) / sMax_k, 0, 1),  a_k = aRest_k * sin(p_k * pi/2)
 * finite slope at liftoff, smooth landing — snap-free at ANY engagement theta.
 * The literal inextensible acos-of-slide drive snaps (infinite da/ds at
 * liftoff — the tab-piece T5 wall); the bench measures that snap to justify
 * the cam (K3).
 *
 * STAGGER RULE. Tier k+1 begins lifting exactly when tier k reaches fraction
 * phiE of its rest lift: a_k = phiE*aRest <=> p_k = (2/pi) asin(phiE), so the
 * extra slide tier k must eat before k+1 wakes is sMax_k * (2/pi) asin(phiE):
 *   L_1 = 0,  L_{k+1} = L_k + sMax_k * (2/pi) * asin(phiE).
 * Full erection needs s_full = L_N + sMax_N, hence knob wind
 * THETA_MAX = acos(1 - s_full/crankR) (the crank inverse), which acos caps at
 * pi so THETA_MAX <= 180deg <= the 270deg ergonomic ceiling by construction.
 *
 * FOLD-FLAT COMPOSITION (the master constraint). The book closes dead flat for
 * ANY frozen knob angle: a_shown_k(theta, beta) = a_k(theta) * E(beta),
 * E(beta) = sin(u * pi/2), u = sin(beta/2)/sin(rest/2) clamped — the SAME
 * page-openness cam tabPieceLift / rotorSpin use. E(0) = 0 flattens every tier
 * exactly at closed regardless of theta; the coplanar disc holds the twist
 * flat at any angle (the book "remembers" the knob). Stateless — a pure
 * function of theta and beta, no autonomous knob animation.
 */

import type { KnobTowerGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

export type { KnobTowerGeom }

/** Patch faces: the coplanar disc plus each tier's two mound slopes. */
export type KnobTowerFace = 'disc' | `tier${number}In` | `tier${number}Out`

export type KnobTowerPatch = {
  readonly face: KnobTowerFace
  readonly quad: PanelQuad
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_PHI_E = 0.75
const DEFAULT_REST_DEG = 176

/** Scotch-yoke crank pull: s(theta) = crankR * (1 - cos theta). */
export const knobTowerCrank = (crankR: number, theta: number): number =>
  crankR * (1 - Math.cos(theta))

/** Per-tier slide budget at rest lift: sMax_k = 2 w_k (1 - cos aRest_k). */
export function knobTowerTierSMax(geom: KnobTowerGeom): number[] {
  return geom.tiers.map((t) => 2 * t.w * (1 - Math.cos(rad(t.aRestDeg))))
}

/** Staggered slack thresholds: L_1 = 0, L_{k+1} = L_k + sMax_k (2/pi) asin(phiE). */
export function knobTowerSlack(geom: KnobTowerGeom): number[] {
  const phiE = clamp01(geom.phiE ?? DEFAULT_PHI_E)
  const sMax = knobTowerTierSMax(geom)
  const L = [0]
  for (let k = 0; k + 1 < geom.tiers.length; k++) {
    L.push(L[k] + sMax[k] * (2 / Math.PI) * Math.asin(phiE))
  }
  return L
}

/** Strip pull for full erection: s_full = L_N + sMax_N. */
export function knobTowerStrokeFull(geom: KnobTowerGeom): number {
  const n = geom.tiers.length
  return knobTowerSlack(geom)[n - 1] + knobTowerTierSMax(geom)[n - 1]
}

/** Total knob wind for full erection: THETA_MAX = acos(1 - s_full/crankR), the
 *  crank inverse (radians). acos caps at pi, so THETA_MAX <= 180deg <= the
 *  270deg ergonomic ceiling by construction. */
export function knobTowerThetaMax(geom: KnobTowerGeom): number {
  return Math.acos(clamp(1 - knobTowerStrokeFull(geom) / geom.crankR, -1, 1))
}

/** Fore-hinge clearance: the tower's near edge (foreHingeD - 2*max w) minus the
 *  disc's spin-swept far edge (hubD + discR*sqrt(2)). Positive iff the disc and
 *  the towers occupy disjoint run-bands on the page (the covenant check). */
export function knobTowerRunGap(geom: KnobTowerGeom): number {
  const maxW = Math.max(...geom.tiers.map((t) => t.w))
  return geom.foreHingeD - 2 * maxW - (geom.hubD + geom.discR * Math.SQRT2)
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (tabPieceLift /
 *  rotorSpin). E(0) = 0 exactly, so every tier flattens at book-closed. */
function envelope(geom: KnobTowerGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

/** Shown lift angle (radians) of tier k at knob angle theta and dihedral beta:
 *  a_shown = aRest_k sin(p_k pi/2) * E(beta), p_k = clamp((s-L_k)/sMax_k, 0, 1).
 *  Exported for the D6 gates (flat-fold, stagger, monotone height, no-snap). */
export function knobTowerTierLift(
  geom: KnobTowerGeom,
  k: number,
  theta: number,
  beta: number
): number {
  const s = knobTowerCrank(geom.crankR, clamp(theta, 0, knobTowerThetaMax(geom)))
  const sMax = knobTowerTierSMax(geom)[k]
  const L = knobTowerSlack(geom)[k]
  const p = sMax > 0 ? clamp01((s - L) / sMax) : 0
  return rad(geom.tiers[k].aRestDeg) * Math.sin((p * Math.PI) / 2) * envelope(geom, beta)
}

/** The page's own moving frame at the current dihedral — u along the page
 *  surface (gutter -> fore edge), n the page normal into the wedge — packaged
 *  as P(d, lift, z), exactly the tab piece's pagePoint. The whole assembly
 *  rides ONE page (side), so disc and towers are built from the same u/n. */
function pageFrame(
  geom: KnobTowerGeom,
  thetaL: number,
  thetaR: number
): { u: Vec3; P: (d: number, lift: number, z: number) => Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, P: (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z] }
}

/**
 * Solves the world pose for a frozen knob angle `thetaKnob` and pages at
 * (thetaL, thetaR). Emits the coplanar disc quad plus each tier's two mound
 * slope panels, one patch per face ('disc', 'tier0In', 'tier0Out', ...).
 * Corner order per quad matches the platform convention — [bl, br, tr, tl] as
 * seen from outside at rest — so identity uvs print upright; the tab-piece z
 * winding (za/zb flipped on the left page) keeps FrontSide = outside.
 */
export function solveKnobTowerPose(
  geom: KnobTowerGeom,
  thetaKnob: number,
  thetaL: number,
  thetaR: number
): readonly KnobTowerPatch[] {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const env = envelope(geom, beta)
  const theta = clamp(thetaKnob, 0, knobTowerThetaMax(geom))
  const s = knobTowerCrank(geom.crankR, theta)
  const sMax = knobTowerTierSMax(geom)
  const L = knobTowerSlack(geom)
  const { u, P } = pageFrame(geom, thetaL, thetaR)
  const F = geom.foreHingeD

  // DISC — the coplanar volvelle, riveted ROTOR_LIFT proud and spun by the
  // user's twist about its hub. The in-plane frame is ORTHONORMAL (e1 = the
  // page-fore direction u, e2 = the spine axis, both unit and perpendicular),
  // so the rigid disc never shears no matter how the page tilts (rotor law).
  const e2: Vec3 = [0, 0, 1]
  const ca = Math.cos(theta)
  const sa = Math.sin(theta)
  const pu: Vec3 = [u[0] * ca + e2[0] * sa, u[1] * ca + e2[1] * sa, u[2] * ca + e2[2] * sa]
  const pv: Vec3 = [-u[0] * sa + e2[0] * ca, -u[1] * sa + e2[1] * ca, -u[2] * sa + e2[2] * ca]
  const center = P(geom.hubD, ROTOR_LIFT, geom.hubZ)
  const R = geom.discR
  const at = (du: number, dv: number): Vec3 => [
    center[0] + pu[0] * du + pv[0] * dv,
    center[1] + pu[1] * du + pv[1] * dv,
    center[2] + pu[2] * du + pv[2] * dv,
  ]
  const patches: KnobTowerPatch[] = [
    { face: 'disc', quad: [at(-R, -R), at(R, -R), at(R, R), at(-R, R)] },
  ]

  // TIERS — each an independent mound at the common fore hinge F, in its own
  // z-band, driven by its OWN a_shown. Mound cross-section in (d, h): inner
  // hinge (F - 2w + s_knee, 0) = (F - 2w cos a, 0), ridge (F - w cos a, w sin a),
  // fore (F, 0), with s_knee = 2w(1 - cos a) the tab-piece slide law verbatim.
  geom.tiers.forEach((tier, k) => {
    const p = sMax[k] > 0 ? clamp01((s - L[k]) / sMax[k]) : 0
    const a = rad(tier.aRestDeg) * Math.sin((p * Math.PI) / 2) * env
    const cosA = Math.cos(a)
    const sinA = Math.sin(a)
    const inner = F - 2 * tier.w * cosA
    const ridge = F - tier.w * cosA
    const h = tier.w * sinA
    const z0 = tier.zc - tier.ridgeLen / 2
    const z1 = tier.zc + tier.ridgeLen / 2
    const [za, zb] = geom.side === 'left' ? [z1, z0] : [z0, z1]
    const panel = (face: KnobTowerFace, dA: number, hA: number, dB: number, hB: number): KnobTowerPatch => ({
      face,
      quad: [P(dA, hA, za), P(dA, hA, zb), P(dB, hB, zb), P(dB, hB, za)],
    })
    patches.push(panel(`tier${k}In`, inner, 0, ridge, h))
    patches.push(panel(`tier${k}Out`, ridge, h, F, 0))
  })

  return patches
}
