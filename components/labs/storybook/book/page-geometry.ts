/**
 * Pure math module for the WebGL book's page geometry. No three.js imports
 * here — this feeds raw Float32Arrays to a mesh later, and staying
 * three-free lets it run in jsdom tests.
 *
 * Geometry conventions: the page is a horizontal grid, x runs from the
 * spine (0) to the free edge (PAGE_W), z runs across the page height
 * (±PAGE_H/2), y is up. A page turn rotates RIGIDLY around the spine (the
 * z axis) — pop-up pages are stiff cover stock that bends only at crease
 * lines, so there is no curl deformation (see turning-page.tsx and
 * benchmark B8). The mid-turn sheet's angle comes from
 * popup-mechanics.ts's `sheetAngle`, shared with the pop-up solver.
 */

export const PAGE_W = 1.15
export const PAGE_H = 1.5
export const PAGE_SEGMENTS = 32

const ROW_VERTS = PAGE_SEGMENTS + 1

/**
 * Flat page template vertices: x∈[0,PAGE_W] from spine, z∈[-PAGE_H/2,PAGE_H/2], y=0.
 * Returns [positions, uvs, indices] arrays for a (PAGE_SEGMENTS+1)×2 vertex grid.
 *
 * Vertex layout: two rows of (PAGE_SEGMENTS+1) vertices — row 0 at
 * z=-PAGE_H/2 (vertices 0..PAGE_SEGMENTS), row 1 at z=+PAGE_H/2 (vertices
 * PAGE_SEGMENTS+1..2*PAGE_SEGMENTS+1). uvs are u=x/PAGE_W, v=1-row: the
 * camera views the desk from +Z (book-scene.tsx), so the image's top row
 * (v=1 under three's default flipY) must land on the FAR page edge at
 * z=-PAGE_H/2 — v=row put the printed sky at the reader's edge, rendering
 * every page print upside down.
 */
export function buildPageTemplate(): {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint16Array
} {
  const vertexCount = ROW_VERTS * 2
  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)

  for (let row = 0; row < 2; row++) {
    const z = row === 0 ? -PAGE_H / 2 : PAGE_H / 2
    for (let col = 0; col <= PAGE_SEGMENTS; col++) {
      const vertex = row * ROW_VERTS + col
      const x = (col / PAGE_SEGMENTS) * PAGE_W

      positions[vertex * 3] = x
      positions[vertex * 3 + 1] = 0
      positions[vertex * 3 + 2] = z

      uvs[vertex * 2] = x / PAGE_W
      uvs[vertex * 2 + 1] = 1 - row
    }
  }

  const indices = new Uint16Array(PAGE_SEGMENTS * 6)
  let cursor = 0
  for (let col = 0; col < PAGE_SEGMENTS; col++) {
    const a = col // row 0, col
    const b = col + 1 // row 0, col + 1
    const c = ROW_VERTS + col // row 1, col
    const d = ROW_VERTS + col + 1 // row 1, col + 1

    // Two CCW triangles per segment quad (normal +y when flat).
    indices[cursor++] = a
    indices[cursor++] = c
    indices[cursor++] = b

    indices[cursor++] = b
    indices[cursor++] = c
    indices[cursor++] = d
  }

  return { positions, uvs, indices }
}

/**
 * easeInOutCubic.
 */
export const easeTurn = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * easeInOutQuint — flatter grip at both ends than easeTurn's cubic (a
 * gentler initial lift, a softer landing) with a snappier sweep through the
 * middle, so a full turn reads as a weightier hardback page instead of a
 * uniform glide. Kept as a separate export rather than changing `easeTurn`
 * in place: `easeTurn`'s cubic shape is asserted by the tests and consumed
 * elsewhere (book.tsx's cover pivot) unchanged.
 */
export const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

// ---------------------------------------------------------------------------
// Bulge model: tilted rest poses from per-side stack thickness.
// Derived in .superpowers/sdd/bench/derive-bulge.mjs (theorems A16-A20,
// grid-scanned): the engine is dihedral-driven end to end, so "the left
// stack grows while the right thins" is NOT new mechanics — it is a rest
// pose of (PI - aL(spread), aR(spread)) instead of (PI, 0), already inside
// the solved space. A real pop-up book never opens dead flat; the sub-
// epsilon hand-off residuals (~0.0087 rad) ARE the visible air held around
// the folded content between pages.

/** Visual thickness of one interior sheet in the fore-edge fan. Chosen at
 *  the top of the derived feasible region (fan 0.09 tall, max tilt ~4deg,
 *  rest dihedral ~176deg): the user's bar is pages with VISIBLE width. */
export const SHEET_STACK_T = 0.01
/** Static block body under the fanned sheets (keeps the closed-book
 *  silhouette at the old blockMaxH 0.11 = pedestal + 9 sheets). */
export const STACK_PEDESTAL = 0.02
/** Hinge-valley depth factor: 0 = the gutter fold dips all the way to the
 *  pedestal between the stacks (deepest legal valley — kappa=1 was proven
 *  infeasible: it zeroes the landing residual, i.e. no bulge at all). */
export const HINGE_KAPPA = 0
/** Interior sheets in the book = SPREAD_COUNT - 1 (asserted by tests to
 *  stay bound to content.ts without importing it into this pure module). */
export const INTERIOR_SHEETS = 9

export type RestPose = {
  /** Left/right page tilt UP from the hinge plane, radians (>= 0). */
  aL: number
  aR: number
  /** Hinge-line height above the block base (world units). */
  hinge: number
  /** Stack-top heights above the block base. */
  hL: number
  hR: number
}

/** Rest pose for an OPEN spread (1..INTERIOR_SHEETS): page tilts and hinge
 *  height from how many sheets lie on each side. Spread 0 (closed cover)
 *  clamps to the spread-1 stacks — nothing open renders with it, but every
 *  caller gets finite numbers. */
export function restAngles(spread: number): RestPose {
  const left = Math.max(0, spread - 1)
  const right = Math.max(0, INTERIOR_SHEETS - Math.max(1, spread))
  const hL = STACK_PEDESTAL + left * SHEET_STACK_T
  const hR = STACK_PEDESTAL + right * SHEET_STACK_T
  const hinge = STACK_PEDESTAL + HINGE_KAPPA * Math.min(left, right) * SHEET_STACK_T
  return {
    aL: Math.asin((hL - hinge) / PAGE_W),
    aR: Math.asin((hR - hinge) / PAGE_W),
    hinge,
    hL,
    hR,
  }
}
