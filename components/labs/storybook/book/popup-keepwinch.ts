/**
 * THE TOWER-HOIST WINCH (E1 showpiece, element 4) — the E-G6 composed-
 * interaction moment. Bench-proven in .superpowers/sdd/bench/derive-keep-
 * winch.mjs (N1-N7 + H1-H8); spec docs/superpowers/specs/2026-07-16-dispatch-
 * keep-derivation.md.
 *
 * THE BOARD: "twist the tower-hoist winch (disc + hub) -> ONE crank drives
 * THREE linked parts — semaphore paddle up, raven-shutter ring iris,
 * counterweight drop — with an eased settle. A paper machine, not a 1-axis
 * tilt." Directly answers the D-series verdict ("a piece of paper tilting in a
 * choppy manner in 1 axis").
 *
 * THE DERIVATION reuses the shipped KNOB-TWIST TOWER laws verbatim (popup-
 * knobtower.ts): a die-cut disc hub-riveted flat into the LEFT page, the reader
 * twists it by theta; a Scotch-yoke crank converts the twist to a linear pull
 * s(theta) = crankR*(1 - cos theta) (slope 0 at theta=0, no liftoff snap).
 * STAGGERED slack thresholds L_k phase the three outputs into a SEQUENCE (mech
 * 90 stagger) so one drag plays semaphore -> iris -> counterweight, not three
 * things at once. Each output is a DESIGNED cam on its own progress
 *   p_k = clamp((s - L_k)/sMax_k, 0, 1),  out_k = range_k * sin(p_k * pi/2)
 * (finite slope at liftoff, smooth landing — the snap-free tab/rotor idiom).
 * FOLD-FLAT composition: out_shown = out(theta) * E(beta), E(0)=0 => every
 * output collapses at book-close for ANY frozen theta; the coplanar disc holds
 * the twist through page turns (the book remembers the knob — law H4, no
 * return: release HOLDS theta permanently).
 *
 * TWO FRAMES. The disc is PAGE-ROOTED (rides the left page coplanar, spun by
 * the reader — the rotor/knobtower grammar). The three output BODIES are posed
 * in the KEEP's OWN bisector frame (bisector-x -> world up when open) so they
 * TILT WITH the keep under parallax — no false desync collision. All output
 * constants are absolute keep-bisector coordinates (already above the stacked
 * stories), so the winch is self-contained given (thetaL, thetaR).
 */

import type { BoxGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { solveBoxPose } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176

/** One staggered output: the crank slack `L` it waits through, the pull `sMax`
 *  it consumes to reach full travel, and `range` (radians for the angular
 *  outputs, world units for the counterweight drop). */
export type KeepWinchOutput = {
  L: number
  sMax: number
  range: number
}

export type KeepWinchGeom = {
  mech: 'keepwinch'
  /** The page the disc is riveted into (and whose frame it spins in). */
  side: 'left' | 'right'
  /** Disc hub distance from the spine along the page run, its z, and radii.
   *  crankR is the pin radius (rides the disc rim: crankR = discR). */
  hubD: number
  hubZ: number
  discR: number
  crankR: number
  /** Semaphore mast: pivot bisector-x, arm length + half-width; `range` is the
   *  sweep angle (rad). Folds flat for free — at close it lies along the fold-
   *  invariant spine axis (0.015 residual = paper thickness). */
  semaphore: KeepWinchOutput & { baseX: number; armLen: number; armHalfW: number }
  /** RIGID roost-mouth shutters (re-derived 2026-07-16): 2 flaps per loft wall
   *  hinged on the wall's vertical edges, swinging out of the wall plane by the
   *  deploy angle `range` (rad). `bladeLen` is the flap length; off-wall reach =
   *  bladeLen*sin(deploy) -> 0 at close, so the flaps fold flat WITH the folding
   *  loft walls (the knee/lid idiom). `host` is the loft story box (wallL/wallR
   *  are the seats). */
  iris: KeepWinchOutput & { bladeLen: number; host: BoxGeom }
  /** IN-PLANE SASH-WEIGHT counterweight (FINAL, 2026-07-16): a rigid block that
   *  descends within the hall flank-wall plane. `range` is the deploy FRACTION
   *  (1 = full CW_DROP_R descent — the block position/size constants live in the
   *  solver). `host` is the hall story box (wallR is the seat). Off-wall reach is
   *  zero by construction, so it is winding-insensitive and always wedge-contained. */
  counterweight: KeepWinchOutput & { host: BoxGeom }
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Scotch-yoke crank pull: s(theta) = crankR (1 - cos theta). */
export const keepWinchCrank = (crankR: number, theta: number): number =>
  crankR * (1 - Math.cos(theta))

/** Strip pull for full erection: the last output's slack + its sMax. */
export const keepWinchStrokeFull = (geom: KeepWinchGeom): number =>
  geom.counterweight.L + geom.counterweight.sMax

/** Total knob wind for full erection: THETA_MAX = acos(1 - s_full/crankR), the
 *  crank inverse (radians). acos caps at pi <= the 270deg ergonomic ceiling. */
export function keepWinchThetaMax(geom: KeepWinchGeom): number {
  return Math.acos(clamp(1 - keepWinchStrokeFull(geom) / geom.crankR, -1, 1))
}

/** Page-openness envelope E(beta) — the shared fold-flat cam (E(0)=0 exact). */
export function keepWinchEnvelope(geom: KeepWinchGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? DEFAULT_REST_DEG)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  return Math.sin((u * Math.PI) / 2)
}

/** The designed per-output cam: progress -> [0, 1], snap-free (finite slope at
 *  liftoff, smooth landing). */
const outCam = (s: number, out: KeepWinchOutput): number =>
  Math.sin((clamp01((s - out.L) / out.sMax) * Math.PI) / 2)

/** The crank pull at a frozen (clamped) knob angle. */
const strokeAt = (geom: KeepWinchGeom, theta: number): number =>
  keepWinchCrank(geom.crankR, clamp(theta, 0, keepWinchThetaMax(geom)))

/** Shown output value at (theta, beta) with the fold-flat envelope: the
 *  semaphore sweep angle / iris open angle (radians) or the counterweight drop
 *  (world units). Exported for the winch gates (stagger, C1, fold-flat). */
export function keepWinchOutputValue(
  geom: KeepWinchGeom,
  which: 'semaphore' | 'iris' | 'counterweight',
  theta: number,
  beta: number
): number {
  const out = geom[which]
  return out.range * outCam(strokeAt(geom, theta), out) * keepWinchEnvelope(geom, beta)
}

/** The knob angle at which an output ENGAGES (its slack is consumed): the crank
 *  inverse of L. Ordered sem <= iris <= cw is the stagger sequence (gate N3). */
export const keepWinchEngageTheta = (geom: KeepWinchGeom, out: KeepWinchOutput): number =>
  Math.acos(clamp(1 - out.L / geom.crankR, -1, 1))

// ---------------------------------------------------------------------------
// Poses. The disc rides the PAGE frame; the outputs ride the KEEP bisector.

/** The keep-bisector -> world map at the current pages (bisector-x = up when
 *  open, bisector-y = lateral, z = spine). Identical to the story-box W. */
function keepFrame(thetaL: number, thetaR: number): (bx: number, by: number, z: number) => Vec3 {
  const m = (thetaL + thetaR) / 2
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  return (bx, by, z) => [bx * cm - by * sm, bx * sm + by * cm, z]
}

/** The page's own frame at the current dihedral (u toward the fore edge, n the
 *  page normal into the wedge) — the disc rides this like the knobtower disc. */
function pageFrame(
  geom: KeepWinchGeom,
  thetaL: number,
  thetaR: number
): { u: Vec3; n: Vec3; center: Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const center: Vec3 = [
    geom.hubD * u[0] + ROTOR_LIFT * n[0],
    geom.hubD * u[1] + ROTOR_LIFT * n[1],
    geom.hubZ,
  ]
  return { u, n, center }
}

/** The coplanar knob disc as a square quad of side 2*discR, riveted ROTOR_LIFT
 *  proud and spun about its hub by the reader's twist theta (the rotor law:
 *  orthonormal in-plane frame e1 = page-fore u, e2 = spine axis). */
export function keepWinchDiscQuad(
  geom: KeepWinchGeom,
  theta: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const { u, center } = pageFrame(geom, thetaL, thetaR)
  const e2: Vec3 = [0, 0, 1]
  const ca = Math.cos(theta)
  const sa = Math.sin(theta)
  const pu: Vec3 = [u[0] * ca + e2[0] * sa, u[1] * ca + e2[1] * sa, u[2] * ca + e2[2] * sa]
  const pv: Vec3 = [-u[0] * sa + e2[0] * ca, -u[1] * sa + e2[1] * ca, -u[2] * sa + e2[2] * ca]
  const R = geom.discR
  const at = (du: number, dv: number): Vec3 => [
    center[0] + pu[0] * du + pv[0] * dv,
    center[1] + pu[1] * du + pv[1] * dv,
    center[2] + pu[2] * du + pv[2] * dv,
  ]
  return [at(-R, -R), at(R, -R), at(R, R), at(-R, R)]
}

/** The semaphore arm — a thin quad at the crown mast top, swinging from lying
 *  over the yard (+z, horizontal) to vertical (+bisector-x = up). */
export function keepWinchSemaphoreQuad(
  geom: KeepWinchGeom,
  theta: number,
  beta: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const W = keepFrame(thetaL, thetaR)
  const s = geom.semaphore
  const psi = keepWinchOutputValue(geom, 'semaphore', theta, beta)
  const baseX = s.baseX
  const baseZ = 0.02
  const tipX = baseX + Math.sin(psi) * s.armLen
  const tipZ = baseZ + Math.cos(psi) * s.armLen
  const w = s.armHalfW
  return [W(baseX, -w, baseZ), W(baseX, w, baseZ), W(tipX, w, tipZ), W(tipX, -w, tipZ)]
}

// A SEAT FRAME on a keep surface quad [bl, br, tr, tl]: fractional edge params
// (s along br-bl, r along tl-bl) put a point ON the folding surface, plus a
// `lift` along the surface NORMAL. Because the seat quad folds flat with the
// keep (its lateral extent vanishes at close) and the only out-of-surface term
// is lift, a rigid body whose lift ~ sin(deploy) -> 0 at close folds flat FOR
// FREE — the mechanism that lets the shutters and the counterweight collapse.
const vsub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const vcross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const vnorm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
const vunit = (v: Vec3): Vec3 => {
  const l = vnorm(v)
  return l < 1e-12 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l]
}

type SeatFrame = { O: Vec3; e1v: Vec3; e2v: Vec3; e1: Vec3; e2: Vec3; n: Vec3 }
function seatFrame(q: PanelQuad): SeatFrame {
  const e1v = vsub(q[1], q[0])
  const e2v = vsub(q[3], q[0])
  return { O: q[0], e1v, e2v, e1: vunit(e1v), e2: vunit(e2v), n: vunit(vcross(e1v, e2v)) }
}
const seatPt = (F: SeatFrame, s: number, r: number, lift: number): Vec3 => [
  F.O[0] + s * F.e1v[0] + r * F.e2v[0] + lift * F.n[0],
  F.O[1] + s * F.e1v[1] + r * F.e2v[1] + lift * F.n[1],
  F.O[2] + s * F.e1v[2] + r * F.e2v[2] + lift * F.n[2],
]

/** Number of roost-mouth shutters the iris renders (2 per loft wall x 2 walls). */
export const KEEP_WINCH_IRIS_SHUTTERS = 4

/** The roost-mouth shutters — 2 rigid flaps hinged on the VERTICAL edges of
 *  each loft wall (wallL, wallR), covering the mouths when closed and swinging
 *  AJAR outward by the deploy angle when the crank winds. The flap's off-wall
 *  reach is bladeLen*sin(deploy) -> 0 at close, and it rides a wall that itself
 *  folds flat (S1) — so the whole shutter folds into the page. */
export function keepWinchIrisQuads(
  geom: KeepWinchGeom,
  theta: number,
  beta: number,
  thetaL: number,
  thetaR: number
): PanelQuad[] {
  const psi = keepWinchOutputValue(geom, 'iris', theta, beta)
  const co = Math.cos(psi)
  const si = Math.sin(psi)
  const bl = geom.iris.bladeLen
  const walls = solveBoxPose(geom.iris.host, thetaL, thetaR)
    .filter((p) => p.face === 'wallL' || p.face === 'wallR')
    .map((p) => p.quad)
  const blades: PanelQuad[] = []
  for (const wall of walls) {
    const F = seatFrame(wall) // e1 = along z (spine), e2 = up the wall, n = outward
    for (let k = 0; k < 2; k++) {
      const sHinge = 0.25 + 0.5 * k // two shutters along the wall
      const h0 = seatPt(F, sHinge, 0.25, 0)
      const h1 = seatPt(F, sHinge, 0.85, 0)
      // free edge swings from along +z (in the wall, closed) to +n (outward, open)
      const free = (base: Vec3): Vec3 => [
        base[0] + bl * (co * F.e1[0] + si * F.n[0]),
        base[1] + bl * (co * F.e1[1] + si * F.n[1]),
        base[2] + bl * (co * F.e1[2] + si * F.n[2]),
      ]
      blades.push([h0, h1, free(h1), free(h0)])
    }
  }
  return blades
}

// IN-PLANE SASH-WEIGHT constants (the FINAL counterweight, bench derive-keep-
// winch.mjs). A rigid block that DESCENDS within the hall flank-wall plane as
// the winch winds — it never leaves the wall plane (only a negligible seat lift
// off the face), so its wedge containment inherits the wall's own proof and it
// is WINDING-INSENSITIVE (symmetric in e1; the wall's up-axis e2 is identical
// in either winding) — no render-vs-bench winding reconciliation needed.
const CW_R_TOP = 0.6 // top r-station (undeployed weight) — clear of the hall lid at r=1
const CW_DROP_R = 0.4 // r-units of descent (world 0.4 * H_hall 0.26 = 0.10 down the flank)
const CW_LIFT = 0.003 // ROTOR_LIFT-scale seat off the wall face (z-fight only)
const CW_BW = 0.045 // weight half-width along the wall (z)
const CW_BH = 0.04 // weight half-height up the wall (block stays within r in [0.05, 0.85])

/** The counterweight — an IN-PLANE SASH-WEIGHT (FINAL). A rigid block seated at
 *  the hall flank (wallR) z-centre that slides DOWN the wall's up-axis by
 *  CW_DROP_R * drop as the crank winds, drop = outCam(s) * E(beta) (a FRACTION,
 *  not an angle). Off-wall reach is ZERO by construction — only CW_LIFT off the
 *  face — so it can never dip below the swinging page (bench N8, counterweight-
 *  only min wedge -0.003 = the seat lift), and at close E->0 returns it to the
 *  top and it rides the folded wall flat. A literal weight descending the flank. */
export function keepWinchCounterweightQuad(
  geom: KeepWinchGeom,
  theta: number,
  beta: number,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const drop = keepWinchOutputValue(geom, 'counterweight', theta, beta) // fraction 0..1
  const wall = solveBoxPose(geom.counterweight.host, thetaL, thetaR).find((p) => p.face === 'wallR')!.quad
  const F = seatFrame(wall)
  const r = CW_R_TOP - CW_DROP_R * drop
  const dw = CW_BW / vnorm(F.e1v) // half-width in e1 fraction
  const dh = CW_BH / vnorm(F.e2v) // half-height in e2 fraction
  return [
    seatPt(F, 0.5 - dw, r - dh, CW_LIFT),
    seatPt(F, 0.5 + dw, r - dh, CW_LIFT),
    seatPt(F, 0.5 + dw, r + dh, CW_LIFT),
    seatPt(F, 0.5 - dw, r + dh, CW_LIFT),
  ]
}

/** Every world-space output quad the winch poses at a frozen twist — semaphore
 *  + iris blades + counterweight (the disc is a coplanar handle, excluded here
 *  as the knob-tower disc is from the depth gates). For the collision / motion
 *  / depth dispatchers. */
export function keepWinchOutputQuads(
  geom: KeepWinchGeom,
  theta: number,
  thetaL: number,
  thetaR: number
): PanelQuad[] {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  return [
    keepWinchSemaphoreQuad(geom, theta, beta, thetaL, thetaR),
    ...keepWinchIrisQuads(geom, theta, beta, thetaL, thetaR),
    keepWinchCounterweightQuad(geom, theta, beta, thetaL, thetaR),
  ]
}
