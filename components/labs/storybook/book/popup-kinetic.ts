/**
 * KINETIC MOVING ARM — Birmingham mechanism 73, the book's first KINETIC
 * (image-animating) fold. Proven numerically in
 * .superpowers/sdd/bench/derive-kinetic.mjs (D4).
 *
 * A double-triangle muscle is glued astride the spine with its glue creases
 * at 45deg to the spine on each page (phi = 45). It is a spherical four-bar
 * exactly like a v-fold — two glue lines gR, gL at phi from the spine (one
 * per page) meeting a central RIDGE crease that rises out of the gutter as
 * the dihedral opens. The 45deg glue angle is Birmingham's "45 fold": with
 * rho = 90 the ridge stands EXACTLY vertical at full open (openElevation =
 * arccos(cos90 / cos45) = arccos 0 = 90) — a clean quarter-turn (measured
 * 89.6deg, bench K2).
 *
 * The ARM is a rigid cutout (a raven wing / signal arm) glued to ONE
 * triangular panel and EXTENDED beyond it along the ridge crease — "links may
 * be extended beyond their joints" (Winder/Sabuda anatomy). Because the panel
 * is rigid, the arm's world direction is a pure function of the ridge crease
 * c(beta): as the book opens the crease sweeps from lying flat in the page
 * (horizontal, book closed) to standing straight up (vertical, book open) —
 * mech 73's "crease EF swings from horizontal to vertical, so the image
 * rises". The other panel is a short FLAP (the muscle's mounting triangle on
 * the opposite page).
 *
 * The pose is therefore an ordinary two-panel MechPose (ARM panel + FLAP
 * panel) built from the SAME closed form the v-fold uses (creaseElevation),
 * so it routes through the standard PopupLayer renderer with zero new
 * renderer code. It differs from a plain v-fold only in that the two panels
 * carry DIFFERENT heights along the shared ridge (a long arm, a short mount)
 * — a rigid lever, not a symmetric tent — which is what reads as a moving arm.
 *
 * Bench gates (derive-kinetic.mjs): flat at closed exact (K1), the arm stands
 * at rest with a quarter-turn sweep (K2), monotone snap-free rise (K3/K4),
 * wedge containment (K5), fold-flat containment inside the page (K6), and —
 * the binding constraint — the arm tip's real-time step stays ~85% under the
 * D-G5 GLOBAL_CAP (K7): the v-fold late-bloom concentrates the arm's motion
 * near flat-open, exactly where the eased turn clock is slowest.
 */

import { creaseElevation, parallelogram } from './popup-mechanics'
import type { KineticArmGeom, MechPose, Vec3 } from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

/** Default glue-crease angle: Birmingham's 45 fold. */
export const KINETIC_PHI_DEG = 45

/**
 * Solves the moving arm's world pose for pages at (thetaL, thetaR). The math
 * mirrors solveVFoldPose's bisector-frame construction exactly — glue lines
 * at phi from the spine, ridge crease on the bisector plane at the closed-form
 * elevation — then emits the ARM as the `right` panel (a long, narrow
 * parallelogram up the ridge) and the FLAP as the `left` panel (a short mount
 * triangle). Corner order matches PanelQuad ([apex, glue-end, far, ridge-top])
 * so the standard renderer prints identity uvs upright.
 */
export function solveKineticArmPose(geom: KineticArmGeom, thetaL: number, thetaR: number): MechPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const { apexZ, vDir, armW, armLen, flapW, flapLen } = geom
  const phi = rad(geom.phiDeg ?? KINETIC_PHI_DEG)
  const rho = rad(geom.rhoDeg)

  // Bisector-frame glue directions (pages at +-h) and the ridge crease on the
  // bisector plane — the symmetric v-fold closed form.
  const gR: Vec3 = [Math.sin(phi) * Math.cos(h), -Math.sin(phi) * Math.sin(h), vDir * Math.cos(phi)]
  const gL: Vec3 = [Math.sin(phi) * Math.cos(h), Math.sin(phi) * Math.sin(h), vDir * Math.cos(phi)]
  const lambda = creaseElevation(phi, rho, beta)
  const c: Vec3 = [Math.sin(lambda), 0, vDir * Math.cos(lambda)]

  // World = rotate by the bisector angle m about Z, then offset to the apex.
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const toWorld = (v: Vec3): Vec3 => [v[0] * cm - v[1] * sm, v[0] * sm + v[1] * cm, v[2]]
  const gRw = toWorld(gR)
  const gLw = toWorld(gL)
  const cw = toWorld(c)
  const apex: Vec3 = [0, 0, apexZ]

  return {
    right: parallelogram(apex, gRw, armW, cw, armLen), // ARM — the sweeping lever
    left: parallelogram(apex, gLw, flapW, cw, flapLen), // FLAP — the mount triangle
    split: flapW / (flapW + armW),
    apex,
    crease: cw,
    glueR: gRw,
    glueL: gLw,
  }
}

/** The arm's world DIRECTION at a dihedral (the ridge crease, unit-ish) —
 *  exported for the D4 gates and captures: it sweeps from lying in the page
 *  at closed to vertical at open. */
export function kineticArmDirection(geom: KineticArmGeom, thetaL: number, thetaR: number): Vec3 {
  return solveKineticArmPose(geom, thetaL, thetaR).crease
}

/** Flat (closed-book) footprint reach of the arm from the apex along the
 *  ridge — the fold-flat span the covenant checks against the page. */
export const kineticArmFlatReach = (geom: KineticArmGeom): number =>
  Math.max(geom.armLen, geom.flapLen)
