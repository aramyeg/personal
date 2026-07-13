/**
 * PANEL ROTOR — Birmingham mechanism 76 ("A TURNING DISC") + mechanism 103
 * ("THE HUB", the paper rivet). Proven numerically in
 * .superpowers/sdd/bench/derive-rotor.mjs (D4 wave 2).
 *
 * A die-cut disc is HUB-RIVETED flat onto ONE parent panel, one glue layer
 * proud (mirror DRESS_LIFT), and ROTATES in the plane of that panel as the
 * book opens — windmill sails, a compass rose, a clock/astronomical dial. It
 * is the KINETIC sibling of the dress patch (popup-anatomy.ts solveDressPose):
 * the SAME seat resolution (the parent panel's own frame — origin at the
 * bottom-left corner, u along the bottom edge, v up the left edge, lifted
 * along the outward normal), but the quad SPINS about its center as a designed
 * function of the page dihedral.
 *
 * COPLANARITY (the virtue). Both of the disc's in-plane axes are built from
 * the seat plane, so every corner stays within ROTOR_LIFT of the (moving)
 * parent panel at EVERY angle — the rigid rivet. The rotor therefore adds NO
 * collision footprint beyond the panel it lies on: it dodges the D-G2 mid-fold
 * sweep wall the kinetic arm (D4 wave 1) hit. A riveted disc is a RIGID square,
 * so it spins on an ORTHONORMAL in-plane frame (e1 along the panel's bottom
 * edge, e2 = n x e1), NOT the seat's own edge directions — a v-fold panel is a
 * sheared parallelogram, and rotating on its sheared axes would stretch the
 * disc (bench gate W6). On a rectangular seat (a box wall) e2 === the panel's
 * v edge exactly.
 *
 * THE DRIVE (a DESIGNED CAM, like the tabpiece — the hidden mech-76 strip
 * gearing is released as a design choice):
 *   u    = sin(beta/2) / sin(rest/2)   clamped,
 *   spin = spinDeg * sin(u * PI/2).
 * Zero at closed (the print aligns flat with the seat), exactly spinDeg at
 * rest, monotone, finite slope everywhere (no snap). Its steepest slope is at
 * book-CLOSED, where the eased turn clock is slowest, so the disc rim stays
 * far under the real-time speed cap even at big radius (bench W8: 0.019 worst,
 * 61% clear of the 0.0497 GLOBAL_CAP, at radius 0.2 / spin 150). |spinDeg| is
 * capped at 150 (mech 76: rotation = 2xE, practical E <= 75).
 *
 * The disc renders as a SQUARE quad of side 2*radius carrying circular die-cut
 * art (the alpha cutout makes it a disc); its corners at radius*sqrt(2) from
 * the center are the fastest points, which the gates measure.
 */

import type { PanelQuad, RotorGeom, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

/** Lift off the seat plane so the riveted disc never z-fights its panel —
 *  one glue layer, exactly a dress patch's (DRESS_LIFT). */
export const ROTOR_LIFT = 0.003

/** Rotation ceiling: mechanism 76 turns the disc through 2xE, and a practical
 *  parallelogram angle E stays <= 75deg, so |spin| <= 150deg. */
export const ROTOR_SPIN_CAP = 150

/** Radius of the disc's swept circumcircle — the rotating square's corners
 *  reach radius*sqrt(2) from the hub, so a placement must keep THIS inside its
 *  parent panel at the anchor (the spin-swept bound the covenant checks). */
export const rotorSweptRadius = (geom: RotorGeom): number => geom.radius * Math.SQRT2

/** The designed cam: spin angle (radians) for a given dihedral. Exported for
 *  the tests (motion-character / anatomy gates). */
export function rotorSpin(geom: RotorGeom, beta: number): number {
  const rest = rad(geom.restAtDeg ?? 176)
  const u = clamp(Math.sin(beta / 2) / Math.sin(rest / 2), 0, 1)
  const spin = rad(clamp(geom.spinDeg, -ROTOR_SPIN_CAP, ROTOR_SPIN_CAP))
  return spin * Math.sin((u * Math.PI) / 2)
}

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/**
 * Solves the rotor's world quad from its seat quad and the dihedral. The seat
 * frame is the panel's own (like solveDressPose): origin bl, u along the
 * bottom edge, v along the left edge, outward normal n; the hub sits at the
 * (u, v) anchor, lifted ROTOR_LIFT along n. The disc is a square of side
 * 2*radius CENTERED on the hub, spun by rotorSpin(beta) about the hub within
 * the seat plane, on the orthonormal frame (e1 = uHat, e2 = n x e1) so it
 * stays rigid on a sheared v-fold panel. Corner order [bl, br, tr, tl] matches
 * PanelQuad, so identity uvs print the disc art upright at spin 0.
 */
export function solveRotorPose(geom: RotorGeom, seat: PanelQuad, beta: number): PanelQuad {
  const [bl, br, , tl] = seat
  const uLen = Math.hypot(br[0] - bl[0], br[1] - bl[1], br[2] - bl[2])
  const vLen = Math.hypot(tl[0] - bl[0], tl[1] - bl[1], tl[2] - bl[2])
  const uHat: Vec3 = [(br[0] - bl[0]) / uLen, (br[1] - bl[1]) / uLen, (br[2] - bl[2]) / uLen]
  const vHat: Vec3 = [(tl[0] - bl[0]) / vLen, (tl[1] - bl[1]) / vLen, (tl[2] - bl[2]) / vLen]
  const n = unit(cross(uHat, vHat))

  // Orthonormal in-plane frame — a rigid disc cannot inherit the panel's
  // shear (bench W6). e2 = n x e1 points to the vHat side, keeping the disc's
  // top corners on the panel's up edge.
  const e1 = uHat
  const e2 = unit(cross(n, e1))

  const a = rotorSpin(geom, beta)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const pu: Vec3 = [e1[0] * ca + e2[0] * sa, e1[1] * ca + e2[1] * sa, e1[2] * ca + e2[2] * sa]
  const pv: Vec3 = [-e1[0] * sa + e2[0] * ca, -e1[1] * sa + e2[1] * ca, -e1[2] * sa + e2[2] * ca]

  const center: Vec3 = [
    bl[0] + uHat[0] * geom.u + vHat[0] * geom.v + n[0] * ROTOR_LIFT,
    bl[1] + uHat[1] * geom.u + vHat[1] * geom.v + n[1] * ROTOR_LIFT,
    bl[2] + uHat[2] * geom.u + vHat[2] * geom.v + n[2] * ROTOR_LIFT,
  ]
  const r = geom.radius
  const at = (du: number, dv: number): Vec3 => [
    center[0] + pu[0] * du + pv[0] * dv,
    center[1] + pu[1] * du + pv[1] * dv,
    center[2] + pu[2] * du + pv[2] * dv,
  ]
  return [at(-r, -r), at(r, -r), at(r, r), at(-r, r)]
}
