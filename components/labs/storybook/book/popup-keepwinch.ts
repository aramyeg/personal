/**
 * THE TOWER-HOIST WINCH (E1 showpiece, element 4) — the E-G6 composed-
 * interaction moment. Bench-proven in .superpowers/sdd/bench/derive-keep-
 * winch.mjs (N1-N7 + H1-H8); spec docs/superpowers/specs/2026-07-16-dispatch-
 * keep-derivation.md.
 *
 * THE BOARD: "twist the tower-hoist winch (disc + hub) -> ONE crank drives
 * THREE linked parts — dispatch boards out, counterweight drop, signal flag up
 * — with an eased settle. A paper machine, not a 1-axis
 * tilt." Directly answers the D-series verdict ("a piece of paper tilting in a
 * choppy manner in 1 axis").
 *
 * THE DERIVATION reuses the shipped KNOB-TWIST TOWER laws verbatim (popup-
 * knobtower.ts): a die-cut disc hub-riveted flat into the LEFT page, the reader
 * twists it by theta; a Scotch-yoke crank converts the twist to a linear pull
 * s(theta) = crankR*(cos(phase) - cos(theta/reduction + phase)) — bounded slope
 * everywhere including liftoff, no snap; see the WAVE-2 GEARING note below for
 * why the reduction and the phase exist.
 * STAGGERED slack thresholds L_k phase the three outputs into a SEQUENCE (mech
 * 90 stagger) so one drag plays dispatch boards -> counterweight -> signal flag,
 * not three things at once — and the LAST thing to move is the flag, so the
 * reader's crank ends on a visible "dispatch open". Each output is a DESIGNED cam on its own progress
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

import { plyLift, rivetLift } from './lift-ladder'
import type { BoxGeom, PanelQuad, Vec3 } from './popup-mechanics'
import { solveBoxPose } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const rad = (d: number): number => (d * Math.PI) / 180

const DEFAULT_REST_DEG = 176

// ---------------------------------------------------------------------------
// WAVE-2 GEARING (blind-review finding S4-2). The reader's verdict on the
// original single-turn yoke was exact and damning: "nothing moves for the first
// ~23 degrees, everything completes by ~45, and past that the wheel free-spins
// forever." A bare Scotch yoke cannot be stretched past a half turn — s(theta)
// = crankR(1 - cos theta) REVERSES after pi — so the wheel could never be a
// wheel; it was a 112-degree lever wearing a capstan's clothes.
//
// The fix is the one a real winch uses: a REDUCTION between the crank the hand
// turns and the yoke pin that pulls the rope. `reduction` = crank turns per
// yoke turn, and the pin starts `phaseDeg` PAST top-dead-centre:
//
//   s(theta) = crankR * (cos(phase) - cos(theta / reduction + phase))
//
// The phase is not decoration, it is the other half of the reader's complaint.
// The original law had ds/dtheta = 0 at theta = 0 — a deliberate "no liftoff
// snap" — and gearing that down by 3 turns a graceful liftoff into a
// three-times-longer DEAD ZONE, which is precisely the "nothing moves for the
// first 23 degrees" the reader hit. Starting the pin off top-dead-centre gives a
// finite, small liftoff slope: the wheel answers the very first degree of the
// hand, and the slope is still bounded (no snap; gated by N2).
//
// Everything downstream is untouched in s: the pull keeps its exact range, so
// every cam, every fold-flat envelope and every collision proof carries over —
// only the hand's journey to each s gets longer, and every cam slope falls by
// 1/reduction, which is strictly gentler.
//
// THE END-STOP is the third part of the finding ("no resistance, no click, no
// visual that's it"). A bare clamp is invisible: the wheel stops tracking and
// the reader reads that as being ignored. So the last PAWL_BAND of the wind runs
// into a pawl — the wheel's SHOWN angle gives up PAWL_SEAT = PAWL_BAND/2 on a
// square law, so its response to the hand fades linearly to exactly zero at the
// stop. The wheel stiffens, seats, and dies under the hand instead of
// free-spinning. The outputs still reach full travel at the raw stop, so the
// click costs the machine nothing.
const PAWL_BAND = rad(24)

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
  /** Crank turns per yoke turn (default 1 = the bare Scotch yoke). >1 gears the
   *  wind DOWN so meaningful travel spans a real crank instead of a flick. */
  reduction?: number
  /** Degrees the yoke pin starts PAST top-dead-centre (default 0). Non-zero
   *  gives the wind a finite liftoff slope, so the first degree of the hand
   *  already moves paper — see the WAVE-2 GEARING note. */
  phaseDeg?: number
  /** Semaphore mast: pivot bisector-x, arm length + half-width; `range` is the
   *  sweep angle (rad). Folds flat for free — at close it lies along the fold-
   *  invariant spine axis (0.015 residual = paper thickness). `mastFootX` is the
   *  bisector-x the STATIC mast stands on (a keep lid), so the paddle is visibly
   *  carried by a post instead of hanging in the sky (S4-4). */
  semaphore: KeepWinchOutput & { baseX: number; armLen: number; armHalfW: number; mastFootX: number }
  /** RIGID roost-mouth shutters (re-derived 2026-07-16): 2 flaps per loft wall
   *  hinged on the wall's vertical edges, swinging out of the wall plane by the
   *  deploy angle `range` (rad). `bladeLen` is the flap length; off-wall reach =
   *  bladeLen*sin(deploy) -> 0 at close, so the flaps fold flat WITH the folding
   *  loft walls (the knee/lid idiom). `host` is the loft story box (wallL/wallR
   *  are the seats). */
  iris: KeepWinchOutput & { bladeLen: number; host: BoxGeom }
  /** IN-PLANE SASH-WEIGHT counterweight (re-stationed 2026-07-16 round 4): a rigid
   *  dark-iron block that descends WITHIN THE LOFT FRONT-CAP plane — down the belfry
   *  mouth face, dead-center in the reading sightline (the hall flank-wall seat was a
   *  dead sightline: invisible at rest, per check-keep-visibility.mjs). Two coplanar
   *  half-quads straddling the y=0 cap crease (split art like the raven finial).
   *  `range` is the deploy FRACTION (1 = full CW_DROP_R descent); the block
   *  position/size constants live in the solver. `host` is the LOFT story box
   *  (capFrontL/capFrontR are the seats). Off-plane reach is zero by construction
   *  (only CW_LIFT z-fight seat), so fold-flat + N8 wedge inherit the cap's proof. */
  counterweight: KeepWinchOutput & { host: BoxGeom }
  /** Dihedral (deg) the fold-flat envelope normalizes to. Default 176. */
  restAtDeg?: number
}

/** Crank turns per yoke turn (>= 1). */
export const keepWinchReduction = (geom: KeepWinchGeom): number =>
  Math.max(1, geom.reduction ?? 1)

/** Yoke start phase past top-dead-centre (radians, in [0, pi/2)). */
export const keepWinchPhase = (geom: KeepWinchGeom): number =>
  clamp(rad(geom.phaseDeg ?? 0), 0, Math.PI / 2 - 1e-6)

/** Geared, phased Scotch-yoke pull:
 *  s(theta) = crankR (cos(phase) - cos(theta/reduction + phase)).
 *  At phase 0 this is exactly the original crankR(1 - cos(theta/reduction)). */
export const keepWinchCrank = (crankR: number, theta: number, reduction = 1, phase = 0): number =>
  crankR * (Math.cos(phase) - Math.cos(theta / Math.max(1, reduction) + phase))

/** The crank inverse: the wind that reaches a given pull. */
const windFor = (geom: KeepWinchGeom, s: number): number => {
  const phase = keepWinchPhase(geom)
  return (
    keepWinchReduction(geom) *
    (Math.acos(clamp(Math.cos(phase) - s / geom.crankR, -1, 1)) - phase)
  )
}

/** Strip pull for full erection: the LAST output's slack + its sMax. The stagger
 *  now ends on the semaphore (the flag that says "dispatch open"), so the last
 *  output is the one the reader is looking at when the pawl bites. */
export const keepWinchStrokeFull = (geom: KeepWinchGeom): number =>
  Math.max(
    geom.semaphore.L + geom.semaphore.sMax,
    geom.iris.L + geom.iris.sMax,
    geom.counterweight.L + geom.counterweight.sMax
  )

/** Total knob wind for full erection — the geared, phased crank inverse of
 *  s_full (radians). */
export function keepWinchThetaMax(geom: KeepWinchGeom): number {
  return windFor(geom, keepWinchStrokeFull(geom))
}

/** The angle the WHEEL is drawn at for a raw wind theta — the pawl. Identity
 *  everywhere except the last PAWL_BAND of the wind, where the wheel gives up
 *  band/2 of travel on a square law, so its response to the hand fades linearly
 *  to zero exactly at the stop: it stiffens, seats, and goes dead rather than
 *  free-spinning. Never decreasing. The outputs ignore this and keep driving off
 *  the raw theta, so the click is free. */
export function keepWinchShownTheta(geom: KeepWinchGeom, theta: number): number {
  const max = keepWinchThetaMax(geom)
  const t = clamp(theta, 0, max)
  const band = Math.min(PAWL_BAND, max * 0.5)
  const u = clamp((t - (max - band)) / band, 0, 1)
  return t - (band / 2) * u * u
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
  keepWinchCrank(
    geom.crankR,
    clamp(theta, 0, keepWinchThetaMax(geom)),
    keepWinchReduction(geom),
    keepWinchPhase(geom)
  )

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
  windFor(geom, out.L)

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
  // The wheel shows the PAWL angle, not the raw wind: the last stretch stiffens
  // and seats. Rigid rotation either way, so the handle stays a rigid handle.
  const shown = keepWinchShownTheta(geom, theta)
  const ca = Math.cos(shown)
  const sa = Math.sin(shown)
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
// The signal mast sits BEHIND the crown ridge (negative z) so its swing arc clears
// the raven finial's front-cap plane (z ~ 0.11) by >= 0.06; at rest it still lies
// above the crest (baseX 0.9 > 0.844) so it reads, and winds up vertical behind
// the raven.
const SEMAPHORE_BASE_Z = -0.08

/** One paper ply of glue seam between the mast's foot and the lid it stands on. */
const MAST_FOOT_SEAM = plyLift(1)

/** THE SIGNAL MAST (S4-4) — a STATIC post standing on a keep lid at the arm's
 *  own z, running up the crown's back to the paddle pivot. The blind reader
 *  could not name the paddle and, once hoisted, read it as "a detached prop
 *  that escaped its parent"; a post is the whole answer. It is a rigid quad in
 *  the keep bisector frame at bisector-y ~ 0, so at book-close it lies ALONG
 *  the page (world-Y residual = armHalfW, the same paper-thickness residual the
 *  arm already rides) and its wedge term is bx*sin(beta/2) >= 0 for free. */
export function keepWinchMastQuad(
  geom: KeepWinchGeom,
  thetaL: number,
  thetaR: number
): PanelQuad {
  const W = keepFrame(thetaL, thetaR)
  const s = geom.semaphore
  const w = s.armHalfW
  const z = SEMAPHORE_BASE_Z
  // The foot sits one paper ply ABOVE the lid it stands on — the glue-seam
  // convention every seated rider in this book uses, and what keeps the A9
  // rest-separation gate an honest "nothing pierces anything".
  const foot = Math.min(s.mastFootX + MAST_FOOT_SEAM, s.baseX)
  return [W(foot, -w, z), W(foot, w, z), W(s.baseX, w, z), W(s.baseX, -w, z)]
}

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
  const baseZ = SEMAPHORE_BASE_Z
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

// Shutter hinge height band up the wall (fractions r of the loft wall).
//
// WAVE-2 (S4-3): the band was 0.461..0.639, an aspect of 0.319 chosen to match
// a delivered placeholder strip — which is how the spread's loudest interactive
// payoff ended up as four narrow planks the blind reader called "construction
// scaffolding". These are the DISPATCH BOARDS of the chapter title, so they are
// now boards: the band opens to 0.28..0.84, a hinge span of 0.56 of the loft
// wall (0.1008 world) against bladeLen 0.10 — a near-square board with room for
// pinned route slips, seals and a perched raven.
//
// bladeLen is HELD at 0.10, so the off-wall reach (bladeLen*sin deploy) and thus
// the winch N8 wedge / N4 fold-flat proofs are untouched: only the in-wall hinge
// span (along e2, up the folding wall) changes, and an in-wall span folds with
// the wall it is cut into.
const IRIS_R_LO = 0.28
const IRIS_R_HI = 0.84

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
      const h0 = seatPt(F, sHinge, IRIS_R_LO, 0)
      const h1 = seatPt(F, sHinge, IRIS_R_HI, 0)
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

// IN-PLANE SASH-WEIGHT constants (re-stationed to the LOFT FRONT CAP, round 4).
// A rigid block DESCENDING within the loft capFront planes as the winch winds —
// it never leaves the cap plane (only a negligible CW_LIFT seat off the face), so
// wedge containment inherits the cap's own proof. Two half-quads straddle the y=0
// cap crease; the seat r/s stations come from the RENDER solveBoxPose corner order
// (below), so they are winding-correct against what the layer draws.
const CW_R_TOP = 0.75 // top r-station (undeployed) — block top r+CW_BH/H stays under the cap top (r=1)
const CW_DROP_R = 0.4 // r-units of descent (world 0.4 * H_loft 0.18 = 0.072 down the belfry face)
export const CW_LIFT = rivetLift(1) // ROTOR_LIFT-scale seat off the cap face (z-fight only), rivet class
// CW_BW/CW_BH give the block's mesh aspect (2*CW_BW / 2*CW_BH = CW_BW/CW_BH = 0.632),
// matching the delivered counterweight art (a tall narrow iron weight). Off-plane
// reach is zero (only CW_LIFT), so N8/N4 inherit the cap's proof.
const CW_BW = 0.0253 // block half-width across the crease (per half, e1/z direction)
const CW_BH = 0.04 // block half-height down the cap (e2/up direction)

/** The counterweight — an IN-PLANE SASH-WEIGHT re-stationed to the LOFT FRONT CAP.
 *  TWO coplanar half-quads straddling the y=0 cap crease, descending the belfry
 *  mouth face by CW_DROP_R * drop as the crank winds (drop = outCam(s)*E(beta), a
 *  FRACTION). SEAT STATIONS from the render solveBoxPose corner order:
 *   capFrontL = [base+y·z1, base·crease·zc, top·crease·zc, top+y·z1] -> seatFrame e1
 *     runs OUTER(s0)->CREASE(s1), e2 runs BASE(r0)->TOP(r1); crease is s=1.
 *   capFrontR = [base·crease·zc, base−y·z1, top−y·z1, top·crease·zc] -> e1 runs
 *     CREASE(s0)->OUTER(s1), e2 BASE->TOP; crease is s=0.
 *  Each half hugs the crease (width CW_BW inward) so the two meet at the shared
 *  crease line. Off-plane reach zero (CW_LIFT only) -> folds flat with the cap. */
export function keepWinchCounterweightDeck(
  geom: KeepWinchGeom,
  theta: number,
  beta: number,
  thetaL: number,
  thetaR: number
): { crestL: PanelQuad; crestR: PanelQuad } {
  const drop = keepWinchOutputValue(geom, 'counterweight', theta, beta) // fraction 0..1
  const patches = solveBoxPose(geom.counterweight.host, thetaL, thetaR)
  const capL = patches.find((p) => p.face === 'capFrontL')!.quad
  const capR = patches.find((p) => p.face === 'capFrontR')!.quad
  const FL = seatFrame(capL)
  const FR = seatFrame(capR)
  const r = CW_R_TOP - CW_DROP_R * drop
  const dhL = CW_BH / vnorm(FL.e2v)
  const dhR = CW_BH / vnorm(FR.e2v)
  const swL = CW_BW / vnorm(FL.e1v)
  const swR = CW_BW / vnorm(FR.e1v)
  // order [crease-bottom, crease-top, outer-top, outer-bottom] (matches the split art).
  const crestL: PanelQuad = [
    seatPt(FL, 1, r - dhL, CW_LIFT),
    seatPt(FL, 1, r + dhL, CW_LIFT),
    seatPt(FL, 1 - swL, r + dhL, CW_LIFT),
    seatPt(FL, 1 - swL, r - dhL, CW_LIFT),
  ]
  const crestR: PanelQuad = [
    seatPt(FR, 0, r - dhR, CW_LIFT),
    seatPt(FR, 0, r + dhR, CW_LIFT),
    seatPt(FR, swR, r + dhR, CW_LIFT),
    seatPt(FR, swR, r - dhR, CW_LIFT),
  ]
  return { crestL, crestR }
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
  const cw = keepWinchCounterweightDeck(geom, theta, beta, thetaL, thetaR)
  return [
    keepWinchMastQuad(geom, thetaL, thetaR),
    keepWinchSemaphoreQuad(geom, theta, beta, thetaL, thetaR),
    ...keepWinchIrisQuads(geom, theta, beta, thetaL, thetaR),
    cw.crestL,
    cw.crestR,
  ]
}
