/**
 * VOLVELLE — Birmingham mech 103 "THE HUB" + mech 104 "THE ROTATING WINDOW".
 * The book's first reader-spun paper DIAL with windowed reveals (the raven
 * DISPATCH DIAL, s4). Proven numerically in
 * .superpowers/sdd/bench/derive-volvelle.mjs (E2.2 Batch B).
 *
 * PAGE-ROOTED like the knob tower (popup-knobtower.ts / popup-tabpiece.ts:
 * side + page coordinates, riding the page's own moving frame P(d, lift, z) —
 * d along the page gutter->fore, lift the page normal, z along the spine). It
 * mirrors the s4 winch: the winch crank on the LEFT page, this dial on the
 * RIGHT. TWO die-cut discs are HUB-RIVETED coplanar into the page (the rotor
 * vocabulary: ROTOR_LIFT proud, spun on the ORTHONORMAL page frame e1 = the
 * page-fore direction u, e2 = the spine axis z — both unit and perpendicular,
 * so the rigid disc never shears however the page tilts):
 *   DIAL — beneath, VOLVELLE_LIFT proud, S sectors of dispatch art. Spun by the
 *     reader's twist theta (the knob/winch H4 idiom, popup-knobtower-layer /
 *     popup-keepwinch-layer: pointer angle about the hub, wrapped-delta
 *     accumulation into the user-drive channel, release HOLDS theta — persistence,
 *     "the book remembers the knob"). A coplanar disc lies flat at ANY rotation,
 *     so — unlike the knob tower — the dial needs NO fold-flat envelope: it rides
 *     the folding page, whose own flat-fold carries it down at book close (V9).
 *   CARD — over, VOLVELLE_CARD_LIFT proud (one more paper thickness), STATIC, W
 *     die-cut WINDOWS. Each detent-worth of spin frames a fresh sector.
 *
 * REGISTRATION (bench V3-V6). With the window centres psi_j all congruent to
 * sector centres mod Delta (Delta = 2pi/S), EVERY detent theta_d = d*Delta lands
 * all W windows on sector centres simultaneously; each window frames exactly one
 * sector (half-width < Delta/2 - margin), the W windows read W distinct sectors,
 * and one detent step advances every window by one sector (the art visibly
 * changes — the G4 evidence). On release, theta snaps to the nearest detent.
 */

import type { PanelQuad, VolvelleGeom, VolvelleWindow, Vec3 } from './popup-mechanics'
import { ROTOR_LIFT } from './popup-rotor'

export type { VolvelleGeom, VolvelleWindow }

const TAU = Math.PI * 2
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** The dial rides one glue layer proud (the rotor/dress lift); the static card
 *  rides a second glue layer above it — one paper thickness apart (bench V1). */
export const VOLVELLE_LIFT = ROTOR_LIFT
export const VOLVELLE_CARD_LIFT = 2 * ROTOR_LIFT

/** A dial is free-spinning: the reader may wind it through a full revolution,
 *  cycling every sector past every window. Hand-driven, so it is exempt from the
 *  page-turn sweep floor like the rest of the H4 vocabulary. */
export const volvelleThetaMax = (): number => TAU

/** Detent step Delta = 2pi/S — the angle the dial clicks between sectors. */
export const volvelleDetentStep = (geom: VolvelleGeom): number => TAU / geom.sectors

/** Nearest-detent snap (bench V8): idempotent + exact on detents, moves theta by
 *  at most Delta/2. The layer eases the released twist to this. */
export function volvelleSnap(geom: VolvelleGeom, theta: number): number {
  const step = volvelleDetentStep(geom)
  return clamp(Math.round(theta / step) * step, 0, volvelleThetaMax())
}

// ---------------------------------------------------------------------------
// THE CRANK — how a hand's stroke becomes disc rotation (E3 s7 round-2, S7R2-1a)
//
// The systems patch replaced the winch's raw atan2 hub sweep with the hand's own
// TANGENTIAL drag (handle-projection.ts crankTangentialDelta) and flagged the
// volvelle as still carrying the old read. A live probe of s7's counting wheel
// (bench/s7r2-drag-live.mjs) reproduced every symptom the winch had:
//
//   240 px stroke across the rim  ->   2.3, 10.4, 13.2, ... 17.4 deg (asymptotic)
//   the same stroke reversed      ->   0.0 at every sample
//   200 px straight down          ->   3.1 deg
//
// A wheel of eight strongrooms whose whole travel is 360 deg answered a
// deliberate two-thirds-of-the-page stroke with less than half of ONE detent,
// and answered the return stroke with nothing. That is the atan2 defect exactly
// — gain that vanishes at the rim, where a hand actually grips a wheel.
//
// Everything below is a pure function of (geom, theta, sweep) so the bench can
// walk the mapping end to end (volvelle-crank.test.ts), and every piece of it is
// OPT-IN behind `geom.crank === 'tangential'`: s4's dispatch dial keeps the
// sweep read byte-for-byte until its own lane ports it.
// ---------------------------------------------------------------------------

/**
 * THE GEAR — how much hand one turn of the wheel costs.
 *
 * Ungeared, a hand circling the rim turns the disc 1:1, so the whole 360 deg of
 * travel is one turn of the wrist and eight strongrooms go past in a flick.
 * At 0.5 the full revolution costs 720 deg of hand at the rim — two turns, i.e.
 * 90 deg of hand per detent, which is a deliberate stroke per room. (The winch
 * chose 0.42 for a 302 deg wind; this is the same bar restated for a 360 deg one.)
 */
export const VOLVELLE_CRANK_GEAR = 0.5

/**
 * THE DETENT, FELT IN THE HAND.
 *
 * `volvelleSnap` is what a detent LOOKS like after the reader lets go. This is
 * what it feels like while they are still turning: a sprung ball riding a
 * notched rim. The gear is modulated by where the wheel sits inside its current
 * notch cell — heaviest ON a notch (the ball is seated and resists being lifted
 * out), lightest at the crest halfway between two (the ball is over the top and
 * falls into the next one). One period per detent step, so the reader feels
 * exactly `sectors` clicks per revolution.
 *
 * Properties that matter and are gated:
 *   - strictly positive everywhere (0 < 1-DEPTH <= g <= 1+DEPTH), so the wheel
 *     never stalls and never runs backwards under a forward hand,
 *   - even in theta about every notch, so a step costs the same to leave in
 *     either direction — a detent, not a ratchet,
 *   - independent of sweep sign, so reverse costs exactly what forward cost.
 */
const DETENT_DEPTH = 0.55

export function volvelleDetentGear(geom: VolvelleGeom, theta: number): number {
  const step = volvelleDetentStep(geom)
  if (!(step > 0)) return 1
  return 1 - DETENT_DEPTH * Math.cos((TAU * theta) / step)
}

/** Fraction of the travel over which the wheel stiffens into each end stop. */
const END_BAND_FRAC = 0.09
/** The gear left AT a stop — heavy enough to be unmistakable, never zero: a stop
 *  a reader cannot reach is a bug, not a feel (the winch's RESIST_FLOOR rule). */
const END_FLOOR = 0.3

/**
 * THE TWO END STOPS ("no end-stop, no detent, no resistance" — the blind
 * reader). A riveted volvelle turns between stop pins: the wheel gets heavy over
 * the last END_BAND_FRAC of travel, seats, and goes dead rather than spinning on
 * forever. Applied to the direction that RUNS INTO the stop only (the layer
 * passes the sweep's sign), so a reader who has wound the wheel to its pin can
 * always back it off at the ordinary rate.
 */
export function volvelleEndResist(geom: VolvelleGeom, theta: number, sweep: number): number {
  const max = volvelleThetaMax()
  const band = Math.max(1e-6, max * END_BAND_FRAC)
  const t = clamp(theta, 0, max)
  // Distance into the band the hand is heading FOR — the far pin when winding
  // forward, the near one when backing off. A sweep of exactly zero is not
  // heading anywhere.
  const u = sweep > 0 ? clamp((t - (max - band)) / band, 0, 1) : sweep < 0 ? clamp((band - t) / band, 0, 1) : 0
  return 1 - (1 - END_FLOOR) * u * u
}

/**
 * One pointer move's worth of wheel: the hand's own tangential crank
 * (crankTangentialDelta), geared down, notched, and stiffened into whichever
 * stop it is heading for. `sweep` is the UNGEARED disc rotation the hand just
 * applied; `theta` the twist it is applied from.
 */
export function volvelleCrankStep(geom: VolvelleGeom, theta: number, sweep: number): number {
  const gear = VOLVELLE_CRANK_GEAR * volvelleDetentGear(geom, theta) * volvelleEndResist(geom, theta, sweep)
  return clamp(theta + sweep * gear, 0, volvelleThetaMax())
}

/** Which notch cell `theta` currently sits in — the layer clicks once per change
 *  so the reader HEARS the ball drop into each room. */
export function volvelleDetentCell(geom: VolvelleGeom, theta: number): number {
  const step = volvelleDetentStep(geom)
  if (!(step > 0)) return 0
  return Math.round(clamp(theta, 0, volvelleThetaMax()) / step)
}

/** Which dial sector index a window at psi frames when the dial is at theta —
 *  exported for the registration tests (the reveal gate). */
export function volvelleSectorSeen(geom: VolvelleGeom, window: VolvelleWindow, theta: number): number {
  const step = volvelleDetentStep(geom)
  const psi = (window.psiDeg * Math.PI) / 180
  const k = Math.round((psi - theta) / step)
  return ((k % geom.sectors) + geom.sectors) % geom.sectors
}

/** The page's own moving frame at the current dihedral, packaged for the disc:
 *  u along the page surface (gutter -> fore edge), n the page normal into the
 *  wedge, and the ORTHONORMAL spin basis e1 = u, e2 = the spine axis z. The hub
 *  centre sits at P(hubD, VOLVELLE_LIFT, hubZ). Shared by the pose (below) and
 *  the D6 grab handler in the layer, which measures the pointer's angle about
 *  the hub on e1/e2 — exactly the knob-tower/winch disc idiom. */
export function volvelleHubFrame(
  geom: VolvelleGeom,
  thetaL: number,
  thetaR: number,
  lift: number
): { center: Vec3; e1: Vec3; e2: Vec3; n: Vec3 } {
  const t = geom.side === 'left' ? thetaL : thetaR
  const u: Vec3 = [Math.cos(t), Math.sin(t), 0]
  const n: Vec3 = geom.side === 'left' ? [Math.sin(t), -Math.cos(t), 0] : [-Math.sin(t), Math.cos(t), 0]
  const e2: Vec3 = [0, 0, 1]
  const center: Vec3 = [geom.hubD * u[0] + lift * n[0], geom.hubD * u[1] + lift * n[1], geom.hubZ]
  return { center, e1: u, e2, n }
}

/** One disc square (side 2*radius) centred on the hub, spun by `spin` about the
 *  hub within the page plane on the orthonormal frame (the rotor rule — a rigid
 *  square never inherits any tilt shear). Corner order [bl, br, tr, tl] matches
 *  PanelQuad so identity uvs print the disc art upright at spin 0. */
function discQuad(geom: VolvelleGeom, thetaL: number, thetaR: number, spin: number, lift: number): PanelQuad {
  const { center, e1, e2 } = volvelleHubFrame(geom, thetaL, thetaR, lift)
  const ca = Math.cos(spin)
  const sa = Math.sin(spin)
  const pu: Vec3 = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa]
  const pv: Vec3 = [-e1[0] * sa + e2[0] * ca, -e1[1] * sa + e2[1] * ca, -e1[2] * sa + e2[2] * ca]
  const r = geom.radius
  const at = (du: number, dv: number): Vec3 => [
    center[0] + pu[0] * du + pv[0] * dv,
    center[1] + pu[1] * du + pv[1] * dv,
    center[2] + pu[2] * du + pv[2] * dv,
  ]
  return [at(-r, -r), at(r, -r), at(r, r), at(-r, r)]
}

export type VolvellePose = {
  /** The spun dispatch dial (beneath) — the reader's twist. */
  dial: PanelQuad
  /** The static window card (over) — die-cut windows in its art. */
  card: PanelQuad
}

/**
 * Solves the volvelle's world pose for pages at (thetaL, thetaR) and a frozen
 * reader twist `theta`. The dial spins by theta at VOLVELLE_LIFT; the card is
 * static (spin 0) at VOLVELLE_CARD_LIFT, one paper thickness above. Both ride
 * the page coplanar, so the whole piece folds flat with the page at book close.
 */
export function solveVolvellePose(geom: VolvelleGeom, thetaL: number, thetaR: number, theta: number): VolvellePose {
  const t = clamp(theta, 0, volvelleThetaMax())
  return {
    dial: discQuad(geom, thetaL, thetaR, t, VOLVELLE_LIFT),
    card: discQuad(geom, thetaL, thetaR, 0, VOLVELLE_CARD_LIFT),
  }
}
