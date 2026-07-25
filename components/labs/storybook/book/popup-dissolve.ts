/**
 * PULL-TAB DISSOLVE (E2.2 Batch B; Birmingham mech 92 WOVEN DISSOLVE / 93 PANEL
 * DISSOLVE / 119 SHUTTER SCENE family) — the book's first paper CROSSFADE: the
 * reader pulls a tab and one picture transmutes into another across a rack of
 * interleaved slats. Casting (s5, Chapter IV, The Vault-Dragon of the Golden
 * Dunes): DUNES DISSOLVE INTO GOLD — a page-flat placard shows rolling desert
 * dunes with a distant camel-train; pull the tab and the same panel wipes into
 * a heap of the dragon's glittering hoard. Proven numerically in
 * .superpowers/sdd/bench/derive-dissolve.mjs (gates D0-D11); this module ports
 * that source-of-truth VERBATIM.
 *
 * THE MECHANISM (paper truth + the evidence-based pushback). The naive framing
 * — "two flat opaque layers, translate the slide one pitch so A wipes to B" —
 * is IMPOSSIBLE (bench D0): with two rigid opaque printed layers at a fixed
 * relative depth, the composite at any pixel is set by whichever layer is
 * frontmost there; the front layer's print never changes, so a pure in-plane
 * translation can never cross-fade two DIFFERENT opaque pictures to purity at
 * both ends (one end is always a 50/50 venetian). Real paper dissolves change
 * the slats' ATTITUDE, not just a slide's position. The registration-clean,
 * fold-flat, z-fight-free realization is the VENETIAN SLAT FLIP driven by the
 * pull-strip:
 *   PLACARD — a page-flat rack of N rigid SLATS on one page (the s5 dunes->gold
 *     placard is on the LEFT page, the open sand field, mirroring the right-page
 *     goldpile tab). Each slat is a ribbon spanning the placard's full spine
 *     band [z0,z1], one pitch p wide, hinged along its spine-ward z-edge at
 *     d_k = d0 + k*p (lift BASE_LIFT = ROTOR_LIFT). It carries image-A strip k
 *     on its up-face and image-B strip k on its under-face.
 *   FLIP — one reader angle tau in [0,PI] shared by every slat (a synchronised
 *     venetian). The pull-strip is the cord: tab draw delta in [0,stroke] maps
 *     tau = PI * delta/stroke. tau=0 lies the rack flat A-face up (pure dunes);
 *     pulling rotates every slat about its hinge, up through the "blinds close"
 *     collapse (edge-on, the sand BASE showing between the tilted ribs) and over
 *     to tau=PI, flat again B-face up (pure gold).
 *   BASE — an opaque sand backing quad under the slats (lift 0), so the gaps
 *     that open between tilted slats read as desert floor, not holes (the dunes
 *     break into sand and reform as gold — the transmutation).
 *
 * Both END states (tau in {0,PI}) are COPLANAR — the rack lies in the page — so
 * exactly like the volvelle (a coplanar disc) the piece needs NO fold-flat
 * envelope: it rides the folding page and its own flat-fold carries it down at
 * book close. The release SNAP lands tau on a pure end {0,PI}, so a page turn
 * can only ever catch the piece FLAT. The slat far edge traces a semicircle in
 * the lift>=0 half-space (no host penetration); adjacent slats' d-intervals are
 * disjoint at EVERY tau (the ribs never overlap — no inter-slat z-fighting).
 * tau is a held reader value (persistence H4 — the book remembers dunes-or-gold
 * through page turns and book close), a 2-detent {A,B} dial.
 */

import { PAGE_W } from './page-geometry'
import type { DissolveGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

export type { DissolveGeom }

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** The slat rack rides one glue layer proud (the volvelle-dial coplanar class). */
export const DISSOLVE_BASE_LIFT = ROTOR_LIFT
/** Default tab pull for a full A->B flip. */
const DEFAULT_STROKE = 0.14
/** Grabbable lip left inside the fore edge even when flush (the tabpiece TAB_LIP). */
export const DISSOLVE_TAB_LIP = 0.02
/** The two pure end states the release snaps to — a 2-detent dial. */
export const DISSOLVE_ENDS = [0, Math.PI] as const

/** Slat pitch p — one slat width, the placard d-extent split N ways. */
export const dissolvePitch = (geom: DissolveGeom): number => (geom.d1 - geom.d0) / geom.slats
/** The full-flip tab stroke. */
export const dissolveStroke = (geom: DissolveGeom): number => geom.stroke ?? DEFAULT_STROKE
/** Tab protrusion for a flip angle (inextensible strip: draw == tab out). */
export const dissolveTabOut = (geom: DissolveGeom, tau: number): number =>
  (dissolveStroke(geom) * clamp(tau, 0, Math.PI)) / Math.PI
/** Flip angle for a strip draw (the inverse): tau = PI * clamp(delta/stroke). */
export const dissolveTauFromDraw = (geom: DissolveGeom, delta: number): number =>
  Math.PI * clamp(delta / dissolveStroke(geom), 0, 1)
/** Snap a held flip to the nearest pure end {0, PI} — the 2-detent dial (bench
 *  D2: idempotent, exact on ends, moves at most PI/2). */
export const dissolveSnap = (tau: number): number => clamp(Math.round(tau / Math.PI) * Math.PI, 0, Math.PI)

/** The page's own moving frame at the current dihedral, packaged for the rack:
 *  u along the page surface (gutter -> fore), n the page normal into the wedge,
 *  and P(d, lift, z) the page point. The whole assembly rides ONE page. Shared
 *  by the pose solver and the fore-edge slit + the grab handler (which projects
 *  the pointer onto u to read the tab draw). */
export function dissolvePageFrame(
  geom: DissolveGeom,
  thetaL: number,
  thetaR: number
): { u: Vec3; n: Vec3; P: (d: number, lift: number, z: number) => Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return { u, n, P: (d, lift, z) => [d * u[0] + lift * n[0], d * u[1] + lift * n[1], z] }
}

/** Side-aware z winding so identity uvs print upright (knob-tower convention). */
function zEnds(geom: DissolveGeom, z0: number, z1: number): [number, number] {
  return geom.side === 'left' ? [z1, z0] : [z0, z1]
}

/** A quad from two (d, lift) endpoints across a z-band — [bl, br, tr, tl]. */
function panel(
  P: (d: number, lift: number, z: number) => Vec3,
  dA: number,
  hA: number,
  dB: number,
  hB: number,
  za: number,
  zb: number
): PanelQuad {
  return [P(dA, hA, za), P(dA, hA, zb), P(dB, hB, zb), P(dB, hB, za)]
}

/** Slat k's spine-ward hinge distance from the gutter. */
export const dissolveSlatHingeD = (geom: DissolveGeom, k: number): number => geom.d0 + k * dissolvePitch(geom)

/** Slat k at flip `tau`: hinge (spine-ward edge) at (d_k, BASE_LIFT); far edge
 *  swung by tau to (d_k + p cos tau, BASE_LIFT + p sin tau). Corner order
 *  [bl, br, tr, tl] with the hinge as the bottom edge, so identity-ish uvs run
 *  v=0 at the hinge -> v=1 at the far edge. */
export function dissolveSlatQuad(geom: DissolveGeom, k: number, tau: number, thetaL: number, thetaR: number): PanelQuad {
  const { P } = dissolvePageFrame(geom, thetaL, thetaR)
  const w = dissolvePitch(geom)
  const dh = dissolveSlatHingeD(geom, k)
  const dFar = dh + w * Math.cos(tau)
  const hFar = DISSOLVE_BASE_LIFT + w * Math.sin(tau)
  const [za, zb] = zEnds(geom, geom.z0, geom.z1)
  return panel(P, dh, DISSOLVE_BASE_LIFT, dFar, hFar, za, zb)
}

/** The up-face (image A at tau=0) surface normal for flip `tau`, in world:
 *  e_perp = -sin(tau) u + cos(tau) n (+n at tau=0 -> -u at PI/2 -> -n at PI).
 *  The B-face normal is its negation. Exported for the registration tests. */
export function dissolveUpFaceNormal(geom: DissolveGeom, tau: number, thetaL: number, thetaR: number): Vec3 {
  const { u, n } = dissolvePageFrame(geom, thetaL, thetaR)
  const x = -Math.sin(tau) * u[0] + Math.cos(tau) * n[0]
  const y = -Math.sin(tau) * u[1] + Math.cos(tau) * n[1]
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l, 0]
}

/** The opaque sand BASE backing quad, spanning the placard at lift 0 — the
 *  desert floor the gaps between tilted slats reveal mid-flip. */
export function dissolveBaseQuad(geom: DissolveGeom, thetaL: number, thetaR: number): PanelQuad {
  const { P } = dissolvePageFrame(geom, thetaL, thetaR)
  const [za, zb] = zEnds(geom, geom.z0, geom.z1)
  return panel(P, geom.d0, 0, geom.d1, 0, za, zb)
}

/** The two endpoints of the fore-edge SLIT the tab emerges through — a fixed
 *  cut at (d = PAGE_W, lift 0) spanning the tab width; rides the page rigidly. */
export function dissolveSlit(geom: DissolveGeom, thetaL: number, thetaR: number): readonly [Vec3, Vec3] {
  const { P } = dissolvePageFrame(geom, thetaL, thetaR)
  const tabW = geom.tabW ?? 0.1
  const zc = (geom.z0 + geom.z1) / 2
  const sign = geom.side === 'left' ? -1 : 1
  return [P(PAGE_W, 0, zc - (sign * tabW) / 2), P(PAGE_W, 0, zc + (sign * tabW) / 2)]
}

/** The visible tab reveal quad at the fore edge — protrudes out the slit by
 *  exactly the strip draw (inextensible), the designed grab handle. */
export function dissolveTabQuad(geom: DissolveGeom, tau: number, thetaL: number, thetaR: number): PanelQuad {
  const { P } = dissolvePageFrame(geom, thetaL, thetaR)
  const s = dissolveTabOut(geom, tau)
  const tabW = geom.tabW ?? 0.1
  const zc = (geom.z0 + geom.z1) / 2
  const sign = geom.side === 'left' ? -1 : 1
  return [
    P(PAGE_W - DISSOLVE_TAB_LIP, 0, zc - (sign * tabW) / 2),
    P(PAGE_W - DISSOLVE_TAB_LIP, 0, zc + (sign * tabW) / 2),
    P(PAGE_W + s, 0, zc + (sign * tabW) / 2),
    P(PAGE_W + s, 0, zc - (sign * tabW) / 2),
  ]
}

export type DissolvePose = {
  /** The opaque sand base backing (under the slats). */
  base: PanelQuad
  /** One quad per slat, in slat order (0 = spine-ward). */
  slats: PanelQuad[]
  /** The fore-edge tab reveal. */
  tab: PanelQuad
}

/**
 * Solves the dissolve world pose for pages at (thetaL, thetaR) and flip `tau`.
 * The base is static coplanar; every slat is the same rigid ribbon rotated by
 * the shared tau about its own hinge; the tab protrudes by the strip draw.
 * Both end states are flat, so the whole piece folds flat with the page at
 * book close (no envelope — the volvelle rule).
 */
export function solveDissolvePose(geom: DissolveGeom, tau: number, thetaL: number, thetaR: number): DissolvePose {
  const t = clamp(tau, 0, Math.PI)
  return {
    base: dissolveBaseQuad(geom, thetaL, thetaR),
    slats: Array.from({ length: geom.slats }, (_, k) => dissolveSlatQuad(geom, k, t, thetaL, thetaR)),
    tab: dissolveTabQuad(geom, t, thetaL, thetaR),
  }
}
