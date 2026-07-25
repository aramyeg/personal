/**
 * MULTI-FOLD RANGE (E3 s5; Birmingham mech 28 "M-fold" / 57 "chained
 * quadrilaterals") — family #21: ONE card carrying k standing dune ranks.
 *
 * Each rank is a standard page-glued v-fold — solved by `solveVFoldPose`
 * VERBATIM — at its own apexZ station; between consecutive glue bands the
 * same card lies FLAT on the pages as painted gusset strips (the valley
 * floor). Cut, paint, mesh, and texture are one unit: one content entry,
 * one atlas, one draw.
 *
 * Why this is its OWN family, not a fan (kinematic distinction, pack §4.1):
 * a fan is k planes concurrent at ONE spine apex — one depth station,
 * nested angles. The range's ranks sit at DISTINCT apexZ stations connected
 * through the shared card's page-glued gussets: sequential dihedrals along
 * the card's depth run, each with its own closed-form response curve. The
 * back->front BLOOM WAVE lives here — phi graded back-to-front makes the
 * front ranks complete later purely in the v-fold closed form (no straps,
 * no cams: a page-glued v-fold cannot lag its own dihedral). Per Birmingham
 * 57, "heights and shapes of the planes can all differ — only the lengths
 * between folds must be right"; the gussets ARE those lengths, solved flat.
 *
 * Fold-flat is exact with no envelope: every rank is a symmetric v-fold
 * (Lambda(0) = phi + rho closes it by the closed form) and the gussets are
 * page-plane prints, flat by construction; at book-closed the card
 * superposes to plies (accordion-superposition precedent, playbook §1).
 *
 * Derived + gate-checked in .superpowers/sdd/bench/e3s5-mfoldrange.mjs.
 */

import {
  solveVFoldPose,
  type MechPose,
  type PanelQuad,
  type Vec3,
  type VFoldGeom,
} from './popup-mechanics'

export type MFoldRangeRank = {
  /** This rank's apex station on the spine (world z). Ranks are listed
   *  back->front: apexZ strictly ascending. */
  apexZ: number
  /** Glue-line angle from the gutter, degrees — the bloom-wave dial: graded
   *  smaller at the back so deep ranks complete their stand earlier. */
  phiDeg: number
  /** Panel corner angle, degrees. Standing-when-open requires rho > phi. */
  rhoDeg: number
  /** Crest position across the art (fraction from the LEFT edge). The pack
   *  alternates these off-center for the diagonal-drama silhouette. */
  creaseU?: number
  /** Per-rank fold direction override (default: the card's vDir). The true
   *  Birmingham M-fold alternates mountain/valley along the chain — a rank
   *  may lean forward where a backward lean would sweep through a piece
   *  standing between the stations (s5: r2 folds +z clear of the hoard). */
  vDir?: 1 | -1
  /** Full art width across both panels. Graded monotone non-increasing
   *  back->front (mech 118 law: the front rank is the narrowest). */
  width: number
  /** Art height along the central crease. */
  height: number
}

export type MFoldRangeGeom = {
  mech: 'mfoldrange'
  /** Which way along the spine every rank's V opens (they share the card). */
  vDir: 1 | -1
  /** The standing dune ranks, back->front (apexZ ascending), 4-8 ranks;
   *  the flat gusset strips between them are derived. */
  ranks: readonly MFoldRangeRank[]
  /** Cap on the gussets' lateral reach from the spine (world units). The
   *  die-cut narrows the printed valley floor to the spine channel so it
   *  clears the glue bands of pieces standing BETWEEN the rank stations
   *  (s5: the hoard platform's struts glue at 0.14 from the spine).
   *  Default: bounded only by the adjacent ranks' own glue feet. */
  gussetReach?: number
}

/** One valley-floor strip between two adjacent ranks: a pair of quads lying
 *  IN the page planes (left page / right page), flat at every dihedral. */
export type MFoldRangeGusset = {
  left: PanelQuad
  right: PanelQuad
}

export type MFoldRangePose = {
  /** Per-rank v-fold poses, in rank (back->front) order. */
  ranks: readonly MechPose[]
  /** Valley strips between consecutive ranks (length = ranks.length - 1). */
  gussets: readonly MFoldRangeGusset[]
}

const rad = (d: number): number => (d * Math.PI) / 180

/** The plain v-fold a rank IS — the family reuses solveVFoldPose verbatim,
 *  so every per-rank law (wedge containment, worst-step envelope) inherits
 *  from the shipped v-fold family. Exported for the tests + covenant. */
export const rankVFoldGeom = (geom: MFoldRangeGeom, rank: MFoldRangeRank): VFoldGeom => ({
  mech: 'vfold',
  apexZ: rank.apexZ,
  vDir: rank.vDir ?? geom.vDir,
  phiDeg: rank.phiDeg,
  rhoDeg: rank.rhoDeg,
  creaseU: rank.creaseU,
  width: rank.width,
  height: rank.height,
})

/** Lateral reach of a rank's glue band on one page: glue-line length times
 *  sin(phi) — how far from the spine the rank's foot prints. The gusset
 *  between two ranks tucks inside the NARROWER foot so the valley floor
 *  never paints past paper that exists. */
const glueReach = (rank: MFoldRangeRank, side: 'left' | 'right'): number => {
  const split = rank.creaseU ?? 0.5
  const share = side === 'right' ? 1 - split : split
  return ((rank.width * share) / Math.sin(rad(rank.rhoDeg))) * Math.sin(rad(rank.phiDeg))
}

/**
 * Solves the whole card: a loop of the existing v-fold closed form per rank
 * plus static page-plane gusset quads. No new kinematic mathematics.
 *
 * Gusset corner order is [bottom-inner, bottom-outer, top-outer, top-inner]
 * in the PanelQuad convention, with the "top" edge at the FAR (up-screen,
 * smaller z) rank station — matching the parallel-strip uv law that the
 * image top must land up-screen.
 */
export function solveMFoldRangePose(
  geom: MFoldRangeGeom,
  thetaL: number,
  thetaR: number
): MFoldRangePose {
  const ranks = geom.ranks.map((rank) => solveVFoldPose(rankVFoldGeom(geom, rank), thetaL, thetaR))

  const pR: Vec3 = [Math.cos(thetaR), Math.sin(thetaR), 0]
  const pL: Vec3 = [Math.cos(thetaL), Math.sin(thetaL), 0]
  const gussets: MFoldRangeGusset[] = []
  for (let k = 0; k + 1 < geom.ranks.length; k++) {
    const back = geom.ranks[k]
    const front = geom.ranks[k + 1]
    const zFar = back.apexZ
    const zNear = front.apexZ
    const cap = geom.gussetReach ?? Infinity
    const reachR = Math.min(cap, glueReach(back, 'right'), glueReach(front, 'right'))
    const reachL = Math.min(cap, glueReach(back, 'left'), glueReach(front, 'left'))
    const strip = (p: Vec3, reach: number): PanelQuad => [
      [0, 0, zNear],
      [p[0] * reach, p[1] * reach, zNear],
      [p[0] * reach, p[1] * reach, zFar],
      [0, 0, zFar],
    ]
    gussets.push({ left: strip(pL, reachL), right: strip(pR, reachR) })
  }

  return { ranks, gussets }
}

// ---------------------------------------------------------------------------
// Atlas layout — the whole card is ONE 1024x1024 painting (pack §4.4): one
// row per rank top->bottom (back rank first, the tallest row), then two
// 24px valley-floor rows (left-page strips, right-page strips). Shared by
// the layer renderer's uvs and the generate-art painter, so the mapping can
// never drift between them.

/** Row heights in atlas pixels, top->bottom, for the canonical 4-rank card:
 *  r4 380 / r3 270 / r2 190 / r1 136 / gusset-left 24 / gusset-right 24. */
export const MFOLD_ATLAS_ROWS: readonly number[] = [380, 270, 190, 136, 24, 24]
export const MFOLD_ATLAS_SIZE = 1024

/** A row's v-band [vBottom, vTop] under three's default flipY (v=1 = image
 *  top). Row 0 is the TOP row of the image. */
export function mfoldAtlasBand(row: number): readonly [number, number] {
  let top = 0
  for (let r = 0; r < row; r++) top += MFOLD_ATLAS_ROWS[r]
  const bottom = top + MFOLD_ATLAS_ROWS[row]
  return [1 - bottom / MFOLD_ATLAS_SIZE, 1 - top / MFOLD_ATLAS_SIZE]
}

/** Atlas row index carrying rank i's art (rank 0 = the back rank = row 0). */
export const mfoldRankRow = (rankIndex: number): number => rankIndex

/** Atlas rows carrying the valley-floor strips (shared by every gap). */
export const MFOLD_GUSSET_ROW_LEFT = 4
export const MFOLD_GUSSET_ROW_RIGHT = 5
