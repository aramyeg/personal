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
 *  is cut from, so paint continuity across the cuts is automatic.
 *
 *  The wing panels are emitted as sub-quads that NOTCH OUT every stratum's
 *  cut band: in real cut-from paper the sheet between the valley scores IS
 *  the relief — there is no material left at the wing plane inside a band —
 *  so the wing quads stop at the score line and the relief quads carry that
 *  sheet region popped back, sharing the score-line edge EXACTLY (the two
 *  parametrizations meet at a = e / sin(rho), welded by construction).
 *  `sRange` is a relief quad's in-sheet span measured perpendicular from
 *  the central fold — the family test uses it to prove material
 *  conservation (a stratum's quads tile [0, e] with no gap or overlap). */
export type OanavePatch = {
  face: 'hostL' | 'hostR' | 'reliefL' | 'reliefR'
  stratum?: number
  quad: PanelQuad
  uv: readonly [number, number, number, number]
  sRange?: readonly [number, number]
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

/** Split [0, height] at every order-1 band edge. Returns segments
 *  [h0, h1, stratumIndex | -1] — each segment is covered by at most one
 *  order-1 stratum (the covenant: order-1 bands are disjoint; asserted). */
function wingSegments(geom: OanaveGeom): ReadonlyArray<readonly [number, number, number]> {
  const order1 = geom.strata
    .map((st, i) => ({ st, i }))
    .filter(({ st }) => st.parent === undefined)
    .sort((a, b) => a.st.band[0] - b.st.band[0])
  for (let k = 1; k < order1.length; k++) {
    if (order1[k].st.band[0] < order1[k - 1].st.band[1] - 1e-12) {
      throw new Error('oanave: order-1 stratum bands must be disjoint (one cut band per height)')
    }
  }
  const segs: (readonly [number, number, number])[] = []
  let h = 0
  for (const { st, i } of order1) {
    if (st.band[0] > h + 1e-12) segs.push([h, st.band[0], -1])
    segs.push([st.band[0], st.band[1], i])
    h = st.band[1]
  }
  if (h < geom.height - 1e-12) segs.push([h, geom.height, -1])
  return segs
}

/** Sub-segments of an order-1 band split at its children's bands:
 *  [h0, h1, childIndex | -1]. */
function bandSegments(
  geom: OanaveGeom,
  parentIndex: number
): ReadonlyArray<readonly [number, number, number]> {
  const parent = geom.strata[parentIndex]
  const kids = geom.strata
    .map((st, i) => ({ st, i }))
    .filter(({ st }) => st.parent === parentIndex)
    .sort((a, b) => a.st.band[0] - b.st.band[0])
  const segs: (readonly [number, number, number])[] = []
  let h = parent.band[0]
  for (const { st, i } of kids) {
    if (st.band[0] > h + 1e-12) segs.push([h, st.band[0], -1])
    segs.push([Math.max(h, st.band[0]), Math.min(parent.band[1], st.band[1]), i])
    h = st.band[1]
  }
  if (h < parent.band[1] - 1e-12) segs.push([h, parent.band[1], -1])
  return segs
}

/**
 * Every patch of a rank at a page pose — the TRUE die: wing sub-quads that
 * notch out each stratum's cut band, plus the relief panels carrying the
 * notched material popped onto the wings' bisector, plus the order-2
 * keystone popped back off its parent's relief crease.
 *
 * Exact in-sheet parametrization (zero shear approximation): a point of the
 * flat die is (a, h) — a along the glue line, h along the central fold. On
 * the standing wing it maps to `apex + g*a + c*h`; art u is linear in a and
 * art v = h / height, so the cut edges (constant h) run along the glue
 * direction, exactly the die's horizontal. A relief point at in-sheet
 * distance s from the fold maps to
 *
 *   apex + c*(h + s*cot(rho)) + profile(s),
 *
 * where profile(s) linearly spans crease -> score in the plane
 * perpendicular to the fold (an isometry: |score - crease| = e = the
 * in-sheet arm, the E = H law). At s = e this equals the wing point at
 * a = e / sin(rho) — the score-line weld is corner-exact. All score and
 * crease lines stay PARALLEL to the host fold at every dihedral (the
 * mech-37 cutting law) by construction.
 */
export function oanavePatches(geom: OanaveGeom, thetaL: number, thetaR: number): OanavePatch[] {
  const pose = solveOanaveHostPose(geom, thetaL, thetaR)
  const { bR, bL, b, cosG } = oanaveReliefFrame(pose)
  const c = pose.crease
  const apex = pose.apex
  const H = geom.height
  const halfW = geom.width / 2
  const rho = (geom.rhoDeg * Math.PI) / 180
  const sinR = Math.sin(rho)
  const cotR = Math.cos(rho) / sinR
  const glueLen = halfW / sinR

  const wingPt = (g: Vec3, a: number, h: number): Vec3 => [
    apex[0] + g[0] * a + c[0] * h,
    apex[1] + g[1] * a + c[1] * h,
    apex[2] + g[2] * a + c[2] * h,
  ]
  const reliefPt = (p0: Vec3, p1: Vec3, sSpan: number, s: number, h: number): Vec3 => {
    // profile(s) = lerp(p0 -> p1 over sSpan), lifted by the in-sheet shear
    // shift s*cot(rho) along the crease (cut edges follow the die's
    // glue-parallel horizontals).
    const t = s / sSpan
    const hc = h + s * cotR
    return [
      apex[0] + c[0] * hc + p0[0] + (p1[0] - p0[0]) * t,
      apex[1] + c[1] * hc + p0[1] + (p1[1] - p0[1]) * t,
      apex[2] + c[2] * hc + p0[2] + (p1[2] - p0[2]) * t,
    ]
  }
  const uAt = (side: 1 | -1, s: number): number => 0.5 + (side * s) / geom.width

  const patches: OanavePatch[] = []

  // ---- wing sub-quads (the die minus its cut bands) ----
  const segs = wingSegments(geom)
  const sides: ReadonlyArray<readonly [OanavePatch['face'], Vec3, 1 | -1]> = [
    ['hostL', pose.glueL, -1],
    ['hostR', pose.glueR, 1],
  ]
  for (const [face, g, side] of sides) {
    for (const [h0, h1, si] of segs) {
      const aCut = si >= 0 ? geom.strata[si].e / sinR : 0
      patches.push({
        face,
        quad: [wingPt(g, aCut, h0), wingPt(g, glueLen, h0), wingPt(g, glueLen, h1), wingPt(g, aCut, h1)],
        uv: [uAt(side, aCut * sinR), h0 / H, uAt(side, halfW), h1 / H],
      })
    }
  }

  // ---- relief panels: order-1 off the host fold, order-2 off the parent
  // crease. Kept per-stratum so the family gates can audit each cut. ----
  const creaseOffsets: Vec3[] = []
  const zero: Vec3 = [0, 0, 0]
  geom.strata.forEach((st, i) => {
    if (st.parent !== undefined) return
    const q = combine(2 * st.e * cosG, b, 0, zero)
    const sR = combine(st.e, bR, 0, zero)
    const sL = combine(st.e, bL, 0, zero)
    creaseOffsets[i] = q
    for (const [h0, h1, child] of bandSegments(geom, i)) {
      // where a keystone child owns the inner material, the parent panel
      // starts at the child's score line instead of the crease.
      const s0 = child >= 0 ? geom.strata[child].e : 0
      for (const [face, sEnd, side] of [
        ['reliefR', sR, 1],
        ['reliefL', sL, -1],
      ] as ReadonlyArray<readonly [OanavePatch['face'], Vec3, 1 | -1]>) {
        patches.push({
          face,
          stratum: i,
          sRange: [s0, st.e],
          quad: [
            reliefPt(q, sEnd, st.e, s0, h0),
            reliefPt(q, sEnd, st.e, st.e, h0),
            reliefPt(q, sEnd, st.e, st.e, h1),
            reliefPt(q, sEnd, st.e, s0, h1),
          ],
          uv: [uAt(side, s0), h0 / H, uAt(side, st.e), h1 / H],
        })
      }
    }
  })
  geom.strata.forEach((st, i) => {
    if (st.parent === undefined) return
    const parent = geom.strata[st.parent]
    const qp = creaseOffsets[st.parent]
    if (!parent || !qp || parent.parent !== undefined) {
      throw new Error(`oanave ${geom.apexZ}: keystone stratum ${i} needs an order-1 parent before it`)
    }
    if (st.e > parent.e) {
      throw new Error(`oanave ${geom.apexZ}: keystone arm ${st.e} exceeds its parent arm ${parent.e}`)
    }
    // The keystone's scores sit ON the parent panels at in-sheet distance e
    // from the parent crease (isometry along the profile); its own crease
    // pops back along the parent panels' bisector — the E = H construction
    // one generation down (order-2 cascade, max order 2).
    const uR = normalize(combine(parent.e, bR, -1, qp))
    const uL = normalize(combine(parent.e, bL, -1, qp))
    const b2 = normalize(combine(1, uR, 1, uL))
    const cosG2 = dot(b2, uR)
    const q2 = combine(1, qp, 2 * st.e * cosG2, b2)
    const s2R = combine(1, qp, st.e, uR)
    const s2L = combine(1, qp, st.e, uL)
    const [h0, h1] = st.band
    for (const [face, sEnd, side] of [
      ['reliefR', s2R, 1],
      ['reliefL', s2L, -1],
    ] as ReadonlyArray<readonly [OanavePatch['face'], Vec3, 1 | -1]>) {
      patches.push({
        face,
        stratum: i,
        sRange: [0, st.e],
        quad: [
          reliefPt(q2, sEnd, st.e, 0, h0),
          reliefPt(q2, sEnd, st.e, st.e, h0),
          reliefPt(q2, sEnd, st.e, st.e, h1),
          reliefPt(q2, sEnd, st.e, 0, h1),
        ],
        uv: [uAt(side, 0), h0 / H, uAt(side, st.e), h1 / H],
      })
    }
  })

  return patches
}

/** Patch count is constant for a geometry (the segmentation depends only on
 *  the die, never the dihedral) — the merged-mesh renderer sizes its
 *  buffers once from this. */
export const oanavePatchCount = (geom: OanaveGeom): number =>
  oanavePatches(geom, Math.PI, 0).length
