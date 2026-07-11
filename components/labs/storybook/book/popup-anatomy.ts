/**
 * Anatomy-phase mechanism solvers — pure math, no three.js, jsdom-testable.
 * Companion to popup-mechanics.ts (which owns the author-facing geometry
 * types and the shared closed forms). Every solver here was proven
 * numerically first in .superpowers/sdd/bench/:
 *
 * 1. FLOATING PLATFORM (derive-platform.mjs) — strut ranks are the shipped
 *    parallel-fold tents (one ridge line per rank, shared by every bay);
 *    the two-panel DECK hinges on the two ridge lines and meets at a
 *    center crease C solved by circle-circle intersection:
 *      |C - ridgeA| = qA, |C - ridgeB| = qB  ->  discrete, 0-DOF.
 *    The center crease is authentic pop-up anatomy, not a concession: a
 *    rigid uncreased plate spanning two ridges would need their separation
 *    constant across the fold, which fails for every non-identical pair.
 *
 * 2. ANGLE-FOLD FAN (derive-fan.mjs) — k INDEPENDENT v-folds sharing one
 *    spine apex; each member is the shipped spherical four-bar, so the fan
 *    is pure composition. Member rules live with the covenant tests.
 *
 * 3. RIDER (derive-recursion.mjs) — a symmetric v-fold whose "pages" are a
 *    parent's hinged patch pair. Both valid seats reduce to the SAME solve
 *    with an overridden half-angle and an apex offset in the bisector
 *    frame:
 *      boxLid     — local frame IS the bisector frame lifted to the seam
 *                   (H, 0): hEff = h exactly (|wallTop - seam| = a).
 *      deckCrease — bridge platforms only: crease sits ON the bisector
 *                   plane, so the local frame is the bisector frame at
 *                   (Cx, 0); hEff = atan2(|ridgeY|, ridgeX - Cx), running
 *                   PI (book closed, flat) down as the book opens. The
 *                   shipped creaseElevation closed form is exact in that
 *                   regime (checked analytically at hEff = PI and swept
 *                   numerically in the derive).
 *    MOUNT RULE: seats must stack parallel at book-closed — the terrace
 *    crease (straight at closed) is rejected, riders there would stand
 *    erect inside the closed book.
 *
 * 4. DRESS PATCH — zero kinematics: a rigid decorative quad riding one
 *    parent panel's frame, allowed to overhang (the Sabuda silhouette
 *    recipe). Solved from the seat quad alone.
 */

import {
  creaseElevation,
  parallelRidge,
  parallelogram,
  solveVFoldPose,
  type BoxGeom,
  type DressGeom,
  type FanGeom,
  type MechPose,
  type PanelQuad,
  type PlatformGeom,
  type RiderGeom,
  type Vec3,
} from './popup-mechanics'

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))
const rad = (d: number): number => (d * Math.PI) / 180

// ---------------------------------------------------------------------------
// Floating platform.

export type PlatformFace = 'strutL' | 'strutR' | 'deckA' | 'deckB'

export type PlatformPatch = {
  readonly face: PlatformFace
  /** Which strut rank a strut panel belongs to; the deck spans both. */
  readonly rank: 'A' | 'B'
  /** Bay index within the rank (deck patches are bay 0). */
  readonly bay: number
  readonly quad: PanelQuad
}

/** Closed reach of a strut rank up the collapsed page — the flat-fold
 *  position of its ridge, used by the covenant's deck flat-fold rules. */
export const strutClosedReach = (s: PlatformGeom['strutA']): number => s.glueL + s.glueR + s.rise

/** Deck crease point off the two ridge lines (bisector-frame cross-section).
 *  Branch: away from the pages (larger x); when the ridges are vertically
 *  stacked (terrace) the branches split in y instead — +y, deterministic.
 *  Tangency snapped to 0 exactly (sqrt of roundoff injects ~1e-8 jitter). */
export function deckCreasePoint(
  ra: readonly [number, number],
  qA: number,
  rb: readonly [number, number],
  qB: number
): readonly [number, number] {
  const dx = rb[0] - ra[0]
  const dy = rb[1] - ra[1]
  const d = Math.hypot(dx, dy)
  if (d < 1e-12) return [ra[0] + qA, ra[1]] // bridge at closed: panels fold together
  const t = (qA * qA - qB * qB + d * d) / (2 * d)
  const s2 = qA * qA - t * t
  const s = s2 < 1e-12 ? 0 : Math.sqrt(s2)
  const fx = ra[0] + (t * dx) / d
  const fy = ra[1] + (t * dy) / d
  const px = (-dy / d) * s
  const py = (dx / d) * s
  const plus: readonly [number, number] = [fx + px, fy + py]
  const minus: readonly [number, number] = [fx - px, fy - py]
  if (Math.abs(plus[0] - minus[0]) >= Math.abs(plus[1] - minus[1])) {
    return plus[0] >= minus[0] ? plus : minus
  }
  return plus[1] >= minus[1] ? plus : minus
}

/**
 * Solves a floating platform's world pose. Corner order per quad matches
 * the box convention — [bl, br, tr, tl] as seen from outside (deck: from
 * above) at rest — so identity uvs print upright and [0,1,2, 0,2,3] winds
 * outward. Deck art spans ridge A -> crease -> ridge B; the crease's
 * texture split is qA / (qA + qB).
 */
export function solvePlatformPose(geom: PlatformGeom, thetaL: number, thetaR: number): readonly PlatformPatch[] {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2
  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const W = (x: number, y: number, z: number): Vec3 => [x * cm - y * sm, x * sm + y * cm, z]

  const ra = parallelRidge(geom.strutA.glueL, geom.strutA.glueR, geom.strutA.rise, h)
  const rb = parallelRidge(geom.strutB.glueL, geom.strutB.glueR, geom.strutB.rise, h)
  const c = deckCreasePoint(ra, geom.qA, rb, geom.qB)

  const patches: PlatformPatch[] = []
  for (const [rank, strut, ridge] of [
    ['A', geom.strutA, ra],
    ['B', geom.strutB, rb],
  ] as const) {
    const glueLx = strut.glueL * Math.cos(h)
    const glueLy = strut.glueL * Math.sin(h)
    const glueRx = strut.glueR * Math.cos(h)
    const glueRy = -strut.glueR * Math.sin(h)
    strut.spans.forEach(([z0, z1], bay) => {
      patches.push(
        {
          face: 'strutL',
          rank,
          bay,
          quad: [W(glueLx, glueLy, z0), W(glueLx, glueLy, z1), W(ridge[0], ridge[1], z1), W(ridge[0], ridge[1], z0)],
        },
        {
          face: 'strutR',
          rank,
          bay,
          quad: [W(ridge[0], ridge[1], z0), W(ridge[0], ridge[1], z1), W(glueRx, glueRy, z1), W(glueRx, glueRy, z0)],
        }
      )
    })
  }

  const { deckZ0: dz0, deckZ1: dz1 } = geom
  patches.push(
    {
      face: 'deckA',
      rank: 'A',
      bay: 0,
      quad: [W(ra[0], ra[1], dz1), W(c[0], c[1], dz1), W(c[0], c[1], dz0), W(ra[0], ra[1], dz0)],
    },
    {
      face: 'deckB',
      rank: 'B',
      bay: 0,
      quad: [W(c[0], c[1], dz1), W(rb[0], rb[1], dz1), W(rb[0], rb[1], dz0), W(c[0], c[1], dz0)],
    }
  )
  return patches
}

// ---------------------------------------------------------------------------
// Angle-fold fan: pure composition over the shipped v-fold solver.

/** One pose per member, in member order. Art assets per member follow the
 *  `${id}-m${index}` convention. */
export function solveFanPose(geom: FanGeom, thetaL: number, thetaR: number): readonly MechPose[] {
  return geom.members.map((member) =>
    solveVFoldPose(
      {
        mech: 'vfold',
        apexZ: geom.apexZ,
        vDir: geom.vDir,
        phiDeg: member.phiDeg,
        rhoDeg: member.rhoDeg,
        skewDeg: member.skewDeg,
        creaseU: member.creaseU,
        width: member.width,
        height: member.height,
      },
      thetaL,
      thetaR
    )
  )
}

// ---------------------------------------------------------------------------
// Rider: recursion via local page pairs.

/**
 * Solves a rider's world pose off its parent geometry. Throws on invalid
 * seats — the mount rule is a covenant, not a soft warning: a rider on a
 * terrace crease or a non-flat roof would stand erect inside the closed
 * book.
 */
export function solveRiderPose(
  geom: RiderGeom,
  parent: BoxGeom | PlatformGeom,
  thetaL: number,
  thetaR: number
): MechPose {
  const beta = clamp(thetaL - thetaR, 0, Math.PI)
  const m = (thetaL + thetaR) / 2
  const h = beta / 2

  let apexX: number
  let hEff: number
  if (geom.seat === 'boxLid') {
    if (parent.mech !== 'box' || parent.roof !== 'flat') {
      throw new Error('storybook: boxLid riders need a flat-roofed box parent')
    }
    apexX = parent.height
    hEff = h
  } else {
    if (parent.mech !== 'platform') {
      throw new Error('storybook: deckCrease riders need a platform parent')
    }
    if (Math.abs(strutClosedReach(parent.strutA) - strutClosedReach(parent.strutB)) > 1e-9) {
      throw new Error('storybook: deckCrease riders need a BRIDGE platform (terrace creases fail the mount rule)')
    }
    const ra = parallelRidge(parent.strutA.glueL, parent.strutA.glueR, parent.strutA.rise, h)
    const c = deckCreasePoint(ra, parent.qA, [ra[0], -ra[1]], parent.qB)
    apexX = c[0]
    // Local half-angle of the deck pair about the crease: PI at book-closed
    // (panels folded together), easing down as the deck peaks.
    hEff = Math.atan2(Math.abs(ra[1]), ra[0] - c[0])
  }

  const phi = rad(geom.phiDeg)
  const rho = rad(geom.rhoDeg)
  const { vDir } = geom
  const gR: Vec3 = [Math.sin(phi) * Math.cos(hEff), -Math.sin(phi) * Math.sin(hEff), vDir * Math.cos(phi)]
  const gL: Vec3 = [Math.sin(phi) * Math.cos(hEff), Math.sin(phi) * Math.sin(hEff), vDir * Math.cos(phi)]
  const lambda = creaseElevation(phi, rho, 2 * hEff)
  const c: Vec3 = [Math.sin(lambda), 0, vDir * Math.cos(lambda)]

  const cm = Math.cos(m)
  const sm = Math.sin(m)
  const toWorld = (v: Vec3): Vec3 => [v[0] * cm - v[1] * sm, v[0] * sm + v[1] * cm, v[2]]
  const gRw = toWorld(gR)
  const gLw = toWorld(gL)
  const cw = toWorld(c)
  const apex: Vec3 = [apexX * cm, apexX * sm, geom.mountZ]

  const split = geom.creaseU ?? 0.5
  const glueLenR = (geom.width * (1 - split)) / Math.sin(rho)
  const glueLenL = (geom.width * split) / Math.sin(rho)

  return {
    right: parallelogram(apex, gRw, glueLenR, cw, geom.height),
    left: parallelogram(apex, gLw, glueLenL, cw, geom.height),
    split,
    apex,
    crease: cw,
    glueR: gRw,
    glueL: gLw,
  }
}

// ---------------------------------------------------------------------------
// Dress patch: a rigid quad riding one parent panel's frame.

/** Lift off the seat plane so coplanar art never z-fights its link. */
const DRESS_LIFT = 0.003

/**
 * Solves a dress patch's quad from its seat quad. The seat frame is the
 * panel's own: origin at bl, u along the bottom edge, v along the left
 * edge, lifted along the outward normal. The patch may overhang — real
 * dressed links extend past their joints.
 */
export function solveDressPose(geom: DressGeom, seat: PanelQuad): PanelQuad {
  const [bl, br, , tl] = seat
  const uLen = Math.hypot(br[0] - bl[0], br[1] - bl[1], br[2] - bl[2])
  const vLen = Math.hypot(tl[0] - bl[0], tl[1] - bl[1], tl[2] - bl[2])
  const uHat: Vec3 = [(br[0] - bl[0]) / uLen, (br[1] - bl[1]) / uLen, (br[2] - bl[2]) / uLen]
  const vHat: Vec3 = [(tl[0] - bl[0]) / vLen, (tl[1] - bl[1]) / vLen, (tl[2] - bl[2]) / vLen]
  const n: Vec3 = [
    uHat[1] * vHat[2] - uHat[2] * vHat[1],
    uHat[2] * vHat[0] - uHat[0] * vHat[2],
    uHat[0] * vHat[1] - uHat[1] * vHat[0],
  ]
  const nLen = Math.hypot(n[0], n[1], n[2])

  const a = rad(geom.angleDeg ?? 0)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  // Patch axes rotated in the seat plane.
  const pu: Vec3 = [
    uHat[0] * ca + vHat[0] * sa,
    uHat[1] * ca + vHat[1] * sa,
    uHat[2] * ca + vHat[2] * sa,
  ]
  const pv: Vec3 = [
    -uHat[0] * sa + vHat[0] * ca,
    -uHat[1] * sa + vHat[1] * ca,
    -uHat[2] * sa + vHat[2] * ca,
  ]

  const origin: Vec3 = [
    bl[0] + uHat[0] * geom.u + vHat[0] * geom.v + (n[0] / nLen) * DRESS_LIFT,
    bl[1] + uHat[1] * geom.u + vHat[1] * geom.v + (n[1] / nLen) * DRESS_LIFT,
    bl[2] + uHat[2] * geom.u + vHat[2] * geom.v + (n[2] / nLen) * DRESS_LIFT,
  ]
  const at = (du: number, dv: number): Vec3 => [
    origin[0] + pu[0] * du + pv[0] * dv,
    origin[1] + pu[1] * du + pv[1] * dv,
    origin[2] + pu[2] * du + pv[2] * dv,
  ]
  return [origin, at(geom.width, 0), at(geom.width, geom.height), at(0, geom.height)]
}
