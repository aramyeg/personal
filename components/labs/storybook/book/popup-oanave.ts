/**
 * OANAVE — origamic-architecture nave rank (E3 s7, "The Northern Treasury";
 * scene pack .superpowers/sdd/scenes/s7-scene-pack.md §4a, benches
 * e3s7-oa-foldflat.mjs + e3s7-nave-sightline.mjs).
 *
 * A gutter-spanning arched face erected as a spherical four-bar about the
 * gutter — the HOST kinematics are the shipped v-fold wall solver VERBATIM
 * (solveVFoldPose, symmetric, wall regime) — carrying:
 *   (i)  a REAL plan chevron: the central fold's plan half-angle alpha from
 *        the lateral axis, set purely by the phi/rho pairing (measured, never
 *        assumed — risk R3);
 *   (ii) a die-cut portal aperture (an alpha cutout in the painted art — the
 *        die line is art, not solver work, exactly like the skyline);
 *   (iii) OA RELIEF STRATA cut FROM the sheet (Birmingham mech 37,
 *        "parallelograms cut from the base", host fold = the rank's own
 *        central fold instead of the page spine). ZERO glue: a stratum never
 *        leaves its sheet, so the flat state IS the original sheet.
 *
 * Fold pattern per stratum (plan, symmetric): wing — VALLEY score at arm
 * distance e — relief panel — MOUNTAIN crease on the wing bisector — relief
 * panel — VALLEY score at e — wing. Arms equal (E = H, the mech-37 law): with
 * s± the score lines at in-sheet distance e and the relief crease q on the
 * bisector b of the two in-panel perpendiculars bR/bL,
 *
 *   q = 2e * (b . bR) * b   ==>   |q - s±| = e   IDENTICALLY,
 *
 * because |2e cosG b - e bR|^2 = 4e^2cos^2G - 4e^2cos^2G + e^2 = e^2 for any
 * wing half-angle G — the parallelogram closes at every dihedral with no
 * solver and no cams, and at book-closed (bR = bL = b) score points and
 * crease are collinear on the bisector: the whole pattern collapses dead
 * flat with zero lateral residual. The strata are therefore DIHEDRAL-SLAVED:
 * driven purely by the host rank's own central-fold dihedral — physically
 * inherited motion, the purest paper truth on the spread.
 *
 * Order-2 cascade (the keystone step): a child stratum whose "spine" is the
 * parent stratum's relief crease, E = H recursively, max order 2 — the same
 * construction applied to the parent relief panels' in-plane perpendiculars.
 *
 * Rendering: every patch of a rank (2 host panels + 2 quads per stratum)
 * shares one merged mesh, one material, one atlas region — relief adds ZERO
 * marginal draws (budget §5). Multi-patch and content-driven, so it routes
 * through its own layer renderer (popup-oanave-layer.tsx), like the skyline.
 */

import {
  solveVFoldPose,
  type MechPose,
  type PanelQuad,
  type Vec3,
  type VFoldGeom,
} from './popup-mechanics'

export type OanaveStratumKind = 'archMolding' | 'columnPair' | 'keystoneStep'

export type OanaveStratum = {
  kind: OanaveStratumKind
  /** Arm length e (world units): the in-sheet score distance from the fold
   *  AND the relief panel width (E = H, the mech-37 identity). */
  e: number
  /** Height band along the central crease, world units [v0, v1] up the art. */
  band: readonly [number, number]
  /** keystoneStep only: index (into `strata`) of the parent stratum whose
   *  relief crease is this child's spine (order-2 cascade, max order 2). */
  parent?: number
}

export type OanaveGeom = {
  mech: 'oanave'
  /** Apex position along the spine (world z). */
  apexZ: number
  /** Spine opening direction — the deep ranks REQUIRE -1: the sheet folds
   *  flat toward +z (the reader edge), keeping closed-book containment. */
  vDir: 1 | -1
  /** Host glue/corner angles, degrees — the shipped v-fold wall regime. */
  phiDeg: number
  rhoDeg: number
  /** Full art width across both wings / height up the central crease. */
  width: number
  height: number
  /** Apse only: the lower silhouette height of the flanking crown wings vs
   *  the dome centre (art silhouette metadata — the die-cut is alpha). */
  crownWingH?: number
  /** DOCUMENTED plan-chevron target, degrees. The real chevron is SOLVED
   *  from phi/rho by oanaveChevronDeg (risk R3: measure, never assume). */
  chevronDeg: number
  /** Die-cut portal aperture (alpha cutout in the painted face), or null
   *  for the solid apse. halfW across the fold, apexH up the arch. */
  aperture: { halfW: number; apexH: number } | null
  /** OA relief strata, order-1 first (a keystoneStep's `parent` must point
   *  at an earlier entry). Empty for the apse. */
  strata: readonly OanaveStratum[]
}

/** A rank patch: host wing panels + relief panels, each with its atlas uv
 *  rect [u0, v0, u1, v1] — relief uvs are the EXACT sheet region the stratum
 *  is cut from, so paint continuity across the cuts is automatic. */
export type OanavePatch = {
  face: 'hostL' | 'hostR' | 'reliefL' | 'reliefR'
  stratum?: number
  quad: PanelQuad
  uv: readonly [number, number, number, number]
}

const combine = (sa: number, a: Vec3, sb: number, b: Vec3): Vec3 => [
  sa * a[0] + sb * b[0],
  sa * a[1] + sb * b[1],
  sa * a[2] + sb * b[2],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** The host rank AS the shipped v-fold wall (kinematics reused verbatim):
 *  symmetric (the nave is the symmetry statement), centered crease. */
export const oanaveHostVFold = (geom: OanaveGeom): VFoldGeom => ({
  mech: 'vfold',
  apexZ: geom.apexZ,
  vDir: geom.vDir,
  phiDeg: geom.phiDeg,
  rhoDeg: geom.rhoDeg,
  width: geom.width,
  height: geom.height,
})

export const solveOanaveHostPose = (geom: OanaveGeom, thetaL: number, thetaR: number): MechPose =>
  solveVFoldPose(oanaveHostVFold(geom), thetaL, thetaR)

/** The relief frame a host pose induces: in-panel perpendiculars to the
 *  central crease (unit, pointing out along each wing), their bisector
 *  (the mountain-crease direction), and cosG = b . bR — the pop factor
 *  (equals sin(chevron plan half-angle): crease excursion = 2e cosG). */
export function oanaveReliefFrame(pose: MechPose): {
  bR: Vec3
  bL: Vec3
  b: Vec3
  cosG: number
} {
  const c = pose.crease
  const bR = normalize(combine(1, pose.glueR, -dot(pose.glueR, c), c))
  const bL = normalize(combine(1, pose.glueL, -dot(pose.glueL, c), c))
  const b = normalize(combine(1, bR, 1, bL))
  return { bR, bL, b, cosG: dot(b, bR) }
}

/** The SOLVED chevron plan half-angle (degrees) at a given page pose — the
 *  R3 measure-first number. sin(alpha) = cosG, since the wing half-angle
 *  from the bisector is the complement of the plan half-angle from the
 *  lateral axis; the rest pop of a stratum is e * sin(alpha) beyond the
 *  score chord (bench e3s7-oa-foldflat.mjs plan model). */
export function oanaveChevronDeg(geom: OanaveGeom, thetaL: number, thetaR: number): number {
  const { cosG } = oanaveReliefFrame(solveOanaveHostPose(geom, thetaL, thetaR))
  return (Math.asin(Math.min(1, Math.max(-1, cosG))) * 180) / Math.PI
}

/**
 * Every patch of a rank at a page pose: 2 host wing panels, then 2 relief
 * panels per stratum (L/R), order-1 strata popped off the host fold and the
 * order-2 keystone popped back off its parent's relief crease. All relief
 * offsets live in the plane perpendicular to the central crease, so every
 * score/crease line stays PARALLEL to the host fold (the mech-37 cutting
 * law) at every dihedral, by construction.
 */
export function oanavePatches(geom: OanaveGeom, thetaL: number, thetaR: number): OanavePatch[] {
  const pose = solveOanaveHostPose(geom, thetaL, thetaR)
  const { bR, bL, b, cosG } = oanaveReliefFrame(pose)
  const c = pose.crease
  const apex = pose.apex
  const at = (offset: Vec3, v: number): Vec3 => [
    apex[0] + offset[0] + c[0] * v,
    apex[1] + offset[1] + c[1] * v,
    apex[2] + offset[2] + c[2] * v,
  ]

  const patches: OanavePatch[] = [
    // Host wings: the standard sheared-parallelogram art mapping (fold at
    // u = 0.5, the vfold split): left wing u [0, 0.5], right u [0.5, 1].
    { face: 'hostL', quad: pose.left, uv: [0.5, 0, 0, 1] },
    { face: 'hostR', quad: pose.right, uv: [0.5, 0, 1, 1] },
  ]

  // Per-stratum relief crease offsets, kept so an order-2 child can chain.
  const creaseOffsets: Vec3[] = []
  const zero: Vec3 = [0, 0, 0]

  geom.strata.forEach((st, i) => {
    const [v0, v1] = st.band
    const t0 = v0 / geom.height
    const t1 = v1 / geom.height
    const du = st.e / geom.width
    if (st.parent === undefined) {
      // Order 1: spine = the host central fold. Scores at e out each wing,
      // mountain crease at 2e cosG on the bisector (E = H identity).
      const q = combine(2 * st.e * cosG, b, 0, zero)
      const sR = combine(st.e, bR, 0, zero)
      const sL = combine(st.e, bL, 0, zero)
      patches.push(
        {
          face: 'reliefR',
          stratum: i,
          quad: [at(q, v0), at(sR, v0), at(sR, v1), at(q, v1)],
          uv: [0.5, t0, 0.5 + du, t1],
        },
        {
          face: 'reliefL',
          stratum: i,
          quad: [at(q, v0), at(sL, v0), at(sL, v1), at(q, v1)],
          uv: [0.5, t0, 0.5 - du, t1],
        }
      )
      creaseOffsets[i] = q
      return
    }
    // Order 2 (keystone step): spine = the parent stratum's relief crease;
    // "wings" = the parent's two relief panels. Same construction, popped
    // back toward the sheet (the bisector of the parent panels' in-plane
    // perpendiculars points back by symmetry).
    const parent = geom.strata[st.parent]
    const qp = creaseOffsets[st.parent]
    if (!parent || !qp || parent.parent !== undefined) {
      throw new Error(`oanave ${geom.apexZ}: keystone stratum ${i} needs an order-1 parent before it`)
    }
    const uR = normalize(combine(parent.e, bR, -1, qp))
    const uL = normalize(combine(parent.e, bL, -1, qp))
    const b2 = normalize(combine(1, uR, 1, uL))
    const cosG2 = dot(b2, uR)
    const q2 = combine(1, qp, 2 * st.e * cosG2, b2)
    const s2R = combine(1, qp, st.e, uR)
    const s2L = combine(1, qp, st.e, uL)
    patches.push(
      {
        face: 'reliefR',
        stratum: i,
        quad: [at(q2, v0), at(s2R, v0), at(s2R, v1), at(q2, v1)],
        uv: [0.5, t0, 0.5 + du, t1],
      },
      {
        face: 'reliefL',
        stratum: i,
        quad: [at(q2, v0), at(s2L, v0), at(s2L, v1), at(q2, v1)],
        uv: [0.5, t0, 0.5 - du, t1],
      }
    )
  })

  return patches
}

/** Patch count is constant for a geometry (host pair + a pair per stratum) —
 *  the merged-mesh renderer sizes its buffers once from this. */
export const oanavePatchCount = (geom: OanaveGeom): number => 2 + geom.strata.length * 2
