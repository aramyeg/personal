/**
 * REMOVABLE KEEPSAKE — D6 "THE HAND": a flat die-cut card that lives in a
 * page-internal SLEEVE and can be pulled clear of the book. Proven numerically
 * in .superpowers/sdd/bench/derive-keepsake.mjs (D6; gates S1-S6). This module
 * is the faithful in-engine port of that bench — pure math, no three.js, so it
 * runs in jsdom tests.
 *
 * THE MECHANISM (paper truth, the FOLDED-KEEPSAKE WALL resolved). A removable
 * piece that must fold dead flat inside the closed book but STAND when seated
 * outside is infeasible: fold-flat is the closed book's master constraint, and
 * a removed piece has no spread dihedral left to drive it erect. A FLAT card
 * dodges the wall entirely — flat paper in a flat sleeve is flat whether home
 * or seated, and the DESK holds it up, not a fold. So the honest removable
 * keepsake is a flat card, seated tilted on the desk (law H8).
 *
 * TWO INVARIANTS carry the collision proof (bench S3):
 *   (I1) COPLANAR SLIDE — while any part of the card is over the page it lies
 *        IN the page plane (h = 0, like the tab piece's tab). Its D-G2 crossing
 *        height is 0, so every crossing it makes is legal stacking.
 *   (I2) CONTAINMENT — the card only lifts off the page AFTER its trailing edge
 *        has cleared the fore edge, into the paper-free downstage air.
 *
 * EXTRACTION. Pull travel p in [0, p_exit]; the card is a rigid flat quad
 * x in [lead - cardL, lead], z in [z0, z1], h = 0, with lead(p) = foreLead + p.
 * At p_exit the trailing edge clears the slit and the card DETACHES (C0-exact
 * hand-off), then autonomously SETTLES onto the desk seat. Grabbing the seated
 * card, or any book-state change with the card out, plays the auto-return: the
 * reverse 2-leg polyline seat -> exit -> home, eased over returnMs (the same
 * eased 240-station discipline the page turn uses — worst step under GLOBAL_CAP
 * by construction, bench S5).
 *
 * PAGE-ROOTED like the tab piece (popup-tabpiece.ts): the sleeve rides ONE
 * page's own moving frame P(d, h, z); the seat is WORLD-fixed on the desk.
 */

import { PAGE_W, STACK_PEDESTAL } from './page-geometry'
import { TAB_LIP } from './popup-tabpiece'
import type { KeepsakeGeom, PanelQuad, Vec3 } from './popup-mechanics'

export type { KeepsakeGeom }

const rad = (d: number): number => (d * Math.PI) / 180
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Birmingham law 9 slit/sleeve tolerances in world units (bench SCALE MAPPING,
 *  4 mm : 3 mm canon preserved): a through-slit is the card width + SLIT_TOL, a
 *  sleeve the card + SLEEVE_TOL, the page itself the backing sheet. */
export const KEEPSAKE_SLIT_TOL = 0.031
export const KEEPSAKE_SLEEVE_TOL = 0.023
/** Default grip lip at the fore edge, shared with the tab piece. */
export const KEEPSAKE_TAB_LIP = TAB_LIP
/** Default auto-return duration — one page turn (mirrors use-turn-driver's
 *  TURN_MS; kept a literal so this stays a pure, three-free module). The cap
 *  allows down to ~830 ms if the pre-roll feels slow in the eye-test (H8). */
export const KEEPSAKE_RETURN_MS = 1250

/**
 * The pop-up container's world lift: popupsRef.y at settled rest (book.tsx
 * POPUP_Y = pedestal + pageLift + eps). Solver-frame y + this = world y; the
 * desk is world y = 0. The seat is authored in WORLD (on the desk), so the
 * renderer subtracts this to place it in the popup group's local frame. Only
 * an approximation of the group's live y (the group tracks the page hinge),
 * but the card is only ever seated while the spread is at settled REST, where
 * the hinge sits here — an eye-test tuning point, not a solved invariant.
 */
export const KEEPSAKE_POPUP_WORLD_Y = STACK_PEDESTAL + 0.005 + 0.0015

// ---- derived placement scalars --------------------------------------------

/** Leading-edge home position along the page run (x): a grip lip inside the
 *  fore edge. */
export const keepsakeForeLead = (geom: KeepsakeGeom): number => PAGE_W - (geom.tabLip ?? KEEPSAKE_TAB_LIP)
/** Trailing-edge home position — the sleeve mouth on the spine side. */
export const keepsakeTrailHome = (geom: KeepsakeGeom): number => keepsakeForeLead(geom) - geom.cardL
/** Pull travel at which the trailing edge clears the slit and the card
 *  detaches: p_exit = cardL + tabLip. */
export const keepsakePExit = (geom: KeepsakeGeom): number => geom.cardL + (geom.tabLip ?? KEEPSAKE_TAB_LIP)
/** Card width along the spine (the through-slit dimension). */
export const keepsakeCardW = (geom: KeepsakeGeom): number => geom.z1 - geom.z0

// ---- the page's own moving frame (mirrors popup-tabpiece pagePoint) --------

/** P(d, h, z) in the SOLVER frame — u along the page toward the fore edge, n
 *  the page normal into the wedge; the card lies IN the page plane at h = 0. */
export function keepsakePageFrame(
  geom: KeepsakeGeom,
  thetaL: number,
  thetaR: number
): (d: number, h: number, z: number) => Vec3 {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  return (d, h, z) => [d * u[0] + h * n[0], d * u[1] + h * n[1], z]
}

/**
 * The in-sleeve / emerging card as a rigid flat quad at pull `p`, COPLANAR with
 * the page (invariant I1). Corner order [trail@z0, trail@z1, lead@z1, lead@z0]
 * matches the bench. SOLVER frame — same convention the tab piece renders in.
 */
export function keepsakeCardInPlane(geom: KeepsakeGeom, p: number, thetaL: number, thetaR: number): PanelQuad {
  const P = keepsakePageFrame(geom, thetaL, thetaR)
  const lead = keepsakeForeLead(geom) + p
  const trail = lead - geom.cardL
  return [P(trail, 0, geom.z0), P(trail, 0, geom.z1), P(lead, 0, geom.z1), P(lead, 0, geom.z0)]
}

const toWorldY = (p: Vec3): Vec3 => [p[0], p[1] + KEEPSAKE_POPUP_WORLD_Y, p[2]]

/** The in-sleeve card in WORLD (solver frame + container lift) — the frame the
 *  seat and the auto-return trajectory live in. */
export const keepsakeCardInPlaneW = (geom: KeepsakeGeom, p: number, thetaL: number, thetaR: number): PanelQuad =>
  keepsakeCardInPlane(geom, p, thetaL, thetaR).map(toWorldY) as unknown as PanelQuad

// ---- the SEAT pose (world): flat on the desk, tilted far-edge-up -----------

/**
 * The seated card in WORLD coordinates: long axis along world x, width along
 * world z, tilted `tiltDeg` about world x so the far (-z) edge lifts toward the
 * camera; an optional `yawDeg` swivels the footprint in the desk plane first.
 * Corner order matches keepsakeCardInPlane ([trail-ish, ..., lead-ish]).
 */
export function keepsakeSeatCorners(geom: KeepsakeGeom): PanelQuad {
  const { x, z, tiltDeg } = geom.seat
  const y = geom.seat.y ?? 0
  const t = rad(tiltDeg)
  const ya = rad(geom.seat.yawDeg ?? 0)
  const L = geom.cardL
  const W = keepsakeCardW(geom)
  const corner = ([ex0, ez0]: readonly [number, number]): Vec3 => {
    // Yaw swivels length/width in the desk plane before the tilt lifts the far edge.
    const ex = ex0 * Math.cos(ya) - ez0 * Math.sin(ya)
    const ez = ex0 * Math.sin(ya) + ez0 * Math.cos(ya)
    return [x + ex, y - ez * Math.sin(t), z + ez * Math.cos(t)]
  }
  return [
    corner([-L / 2, -W / 2]),
    corner([-L / 2, W / 2]),
    corner([L / 2, W / 2]),
    corner([L / 2, -W / 2]),
  ]
}

// ---- the printed EX-LIBRIS POCKET (law H7) ----------------------------------

/** Page-normal lift of the pocket panel, a hair PROUD of the coplanar (h = 0)
 *  card so the opaque panel occludes the tucked-in card body while leaving the
 *  peeking corner clear. Tiny (~0.26 mm at this scale): it only breaks the
 *  z-tie, never reads as a float. The card itself stays at h = 0 (invariant
 *  I1); the pocket is a SECOND sheet glued on top, like a dress patch's lift. */
export const KEEPSAKE_POCKET_LIFT = 0.002
/** How far spine-ward of the trailing-home station the pocket's closed end
 *  sits (it tucks the card's trailing edge fully under). */
export const KEEPSAKE_POCKET_BACK = 0.03
/** Card length left proud of the pocket MOUTH at home — exactly the dog-eared
 *  leading corner (the H7 grab affordance: proud, dog-eared, visibly loose). */
export const KEEPSAKE_POCKET_PEEK = 0.08
/** Pocket overhang past the card's z-band each side, so the card's side
 *  cut-edges are tucked under too. */
export const KEEPSAKE_POCKET_ZMARGIN = 0.012

/** The printed pocket as an OPAQUE page-stock panel glued over the card's home
 *  span (law H7 — "the SLEEVE read as a printed pocket"): its fore edge is the
 *  MOUTH the card is drawn through, its closed end sits spine-ward of the
 *  trailing edge. Rides the page rigidly (the tabPieceSlit precedent), lifted
 *  KEEPSAKE_POCKET_LIFT proud of the coplanar card so it occludes the tucked
 *  body while the dog-eared leading corner peeks past the mouth. Corner order
 *  [back@z0, back@z1, mouth@z1, mouth@z0]; drawn DoubleSide, so winding is
 *  free. */
export function keepsakePocketPanel(geom: KeepsakeGeom, thetaL: number, thetaR: number): PanelQuad {
  const P = keepsakePageFrame(geom, thetaL, thetaR)
  const h = KEEPSAKE_POCKET_LIFT
  const back = keepsakeTrailHome(geom) - KEEPSAKE_POCKET_BACK
  const mouth = keepsakeForeLead(geom) - KEEPSAKE_POCKET_PEEK
  const zLo = geom.z0 - KEEPSAKE_POCKET_ZMARGIN
  const zHi = geom.z1 + KEEPSAKE_POCKET_ZMARGIN
  return [P(back, h, zLo), P(back, h, zHi), P(mouth, h, zHi), P(mouth, h, zLo)]
}

// ---- auto-return / settle trajectory (bench returnPathStats) ----------------

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]

/**
 * One vertex's position along the 2-leg polyline start -> via -> end at
 * arc-length `sArc`, exactly the bench's posAt. A degenerate second leg
 * (via === end) collapses this to a single start -> via lerp — how the SETTLE
 * (exit -> seat) reuses the same primitive.
 */
function polylineVertex(start: Vec3, via: Vec3, end: Vec3, sArc: number): Vec3 {
  const l0 = dist(start, via)
  if (sArc <= l0) {
    const t = l0 > 0 ? sArc / l0 : 0
    return add(start, mul(sub(via, start), t))
  }
  const l1 = dist(via, end)
  const t = l1 > 0 ? (sArc - l0) / l1 : 0
  return add(via, mul(sub(end, via), t))
}

/**
 * The card pose at eased progress `easedProgress` in [0, 1] along the per-vertex
 * 2-leg polyline start -> via -> end (each vertex eased by ARC LENGTH — a long
 * corner and a short corner arrive together, the bench discipline). Pure over
 * corner arrays, so the renderer feeds it either the seated pose (canonical
 * return) or the card's live pose (an interrupted settle) as `start`.
 */
export function keepsakeTwoLegPose(
  start: readonly Vec3[],
  via: readonly Vec3[],
  end: readonly Vec3[],
  easedProgress: number
): PanelQuad {
  const at = (i: number): Vec3 => {
    const total = dist(start[i], via[i]) + dist(via[i], end[i])
    return polylineVertex(start[i], via[i], end[i], clamp(easedProgress, 0, 1) * total)
  }
  return [at(0), at(1), at(2), at(3)]
}

const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

/**
 * The auto-return metrics (bench S5): worst per-station per-vertex world step
 * and the longest per-vertex path, over the eased 240-station clock of the
 * canonical return seat -> exit -> home. worstStep < GLOBAL_CAP is the cap
 * discipline; `monotone` proves the eased arc never backtracks.
 */
export function keepsakeReturnStats(
  geom: KeepsakeGeom,
  thetaL: number,
  thetaR: number,
  stations = 240
): { worstStep: number; worstTotal: number; monotone: boolean } {
  const seat = keepsakeSeatCorners(geom)
  const exit = keepsakeCardInPlaneW(geom, keepsakePExit(geom), thetaL, thetaR)
  const home = keepsakeCardInPlaneW(geom, 0, thetaL, thetaR)
  let worstStep = 0
  let worstTotal = 0
  let monotone = true
  for (let i = 0; i < 4; i++) {
    const total = dist(seat[i], exit[i]) + dist(exit[i], home[i])
    worstTotal = Math.max(worstTotal, total)
    let prev: Vec3 | null = null
    let prevArc = -1
    for (let k = 0; k <= stations; k++) {
      const tau = easeTurnWeighted(k / stations)
      const sArc = tau * total
      if (sArc < prevArc - 1e-12) monotone = false
      prevArc = sArc
      const p = polylineVertex(seat[i], exit[i], home[i], sArc)
      if (prev) worstStep = Math.max(worstStep, dist(prev, p))
      prev = p
    }
  }
  return { worstStep, worstTotal, monotone }
}
