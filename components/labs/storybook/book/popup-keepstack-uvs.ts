/**
 * The keep's split-across-a-crease UV tables, shared by the per-mesh renderer
 * (popup-keepstack-layer.tsx) and the merged one (popup-keepstack-merged.tsx)
 * so the two paths can never drift into printing the same art differently.
 *
 * Every table below is authored in the UNIT SQUARE. An atlas-backed keep remaps
 * them into a sub-rect at build time (art-atlas.ts `applyUvRect`); the affine
 * remap preserves flips, so these stay the single source of truth.
 */

/** The pale core color of a cut paper edge (C5 physicality) — the hairline
 *  drawn around the balcony deck and the fan-spire members. */
export const CUT_EDGE_COLOR = '#f6eedb'

// Balcony deck UVs — the art (a single gold desk, arch frame at image-top, front
// rail at image-bottom) is ONE painting split across the spine crease, not printed
// twice. Each half-deck's quad is [seam-z0, seam-z1, outer-z1, outer-z0]
// (keepStackBalconyDeck). art-u (image WIDTH) fans ACROSS the crease: 0.5 at both
// seam corners (t=0) -> 0 on deckL / 1 on deckR at the outer edge, so the desk runs
// continuously left-to-right (deckL rides +y = world -x = reader LEFT, verified by
// corner math). art-v (image HEIGHT) runs along z; with the default flipY, v=1 is
// image-top (the arch), mapped to z0 (the facade-attachment edge toward the tower),
// v=0 (the rail) to z1 (the reader-facing jut). Corner->uv table (deckL): seam-z0
// (0.5,1), seam-z1 (0.5,0), outer-z1 (0,0), outer-z0 (0,1).
export const BALCONY_DECK_UVS: readonly [Float32Array, Float32Array] = [
  new Float32Array([0.5, 1, 0.5, 0, 0, 0, 0, 1]), // deckL (solved.a): seam art-u 0.5 -> outer 0; arch(v1)@z0
  new Float32Array([0.5, 1, 0.5, 0, 1, 0, 1, 1]), // deckR (solved.b): seam art-u 0.5 -> outer 1; arch(v1)@z0
]

// Raven finial UVs — the raven art split across the crown crease, same idiom as
// the balcony. The finial half-quads are [crease-bottom, crease-top, outer-top,
// outer-bottom] (keepStackSpireRaven). art-u fans 0.5 at the crease -> 0 (crestL,
// +y = reader LEFT) / 1 (crestR) at the outer edge; art-v runs bottom (cap top
// edge, v=0) -> top (finial top, v=1) so the bird stands upright (head at v=1).
export const RAVEN_FINIAL_UVS: readonly [Float32Array, Float32Array] = [
  new Float32Array([0.5, 0, 0.5, 1, 0, 1, 0, 0]), // crestL: crease 0.5 -> outer 0
  new Float32Array([0.5, 0, 0.5, 1, 1, 1, 1, 0]), // crestR: crease 0.5 -> outer 1
]

// Facade plate UVs — the tier front art split across the capFront crease, same
// idiom and corner order as the raven finial (keepStackFacadePlate returns
// [crease-bottom, crease-top, outer-top, outer-bottom]), so it reuses the raven
// UV table verbatim: art-u 0.5 at the crease -> 0 (plateL, reader LEFT) / 1
// (plateR) at the outer edge; art-v 0 at the cap base edge -> 1 at the plate top.
export const FACADE_PLATE_UVS = RAVEN_FINIAL_UVS

// Fan spire member UVs — each member's art split across the SHARED CREASE (apex
// -> ridge tip), the two panels having OPPOSITE front-face normals like the
// balcony/raven, so DoubleSide + one painting reads continuous. Panel corner
// order is the parallelogram [apex(=crease-bottom), glue-out-bottom, glue-out-
// top, crease-top] (keepStackSpirePoses), so art-u fans 0.5 at the crease -> 0
// (left) / 1 (right) at the outer glue edge; art-v 0 at the apex -> 1 at the tip.
export const SPIRE_MEMBER_UVS: readonly [Float32Array, Float32Array] = [
  new Float32Array([0.5, 0, 0, 0, 0, 1, 0.5, 1]), // left: crease 0.5 -> outer 0
  new Float32Array([0.5, 0, 1, 0, 1, 1, 0.5, 1]), // right: crease 0.5 -> outer 1
]
