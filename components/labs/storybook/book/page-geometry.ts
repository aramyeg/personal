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

// ---------------------------------------------------------------------------
// Gutter shade: the fold's ambient occlusion, baked into the page template
// as vertex colors. The shadow where a page dives into the binding is a
// property of the PAGE SURFACE, not of the air above the gutter — a flat
// shadow strip floating at the valley floor breaks twice under the bulge
// model: the tilted page planes rise above and occlude it (the shadow all
// but vanished at the steep-tilt chapters), and it stays behind when the
// sheet lifts, so the seam popped off the flying page at lift-off and
// snapped back at landing ("click into place", C6 round 5). Baking it into
// the ONE template that both static pages and the turning sheet build from
// makes the crease ride the page through the whole sweep, and makes the
// lift-off/landing hand-off pixel-identical by construction.

/** Column-density warp exponent: x = PAGE_W * (col/N)^GRID_WARP packs grid
 *  columns toward the spine, where the gutter-shade ramp needs resolution
 *  (~7 columns inside the falloff instead of 2 — a uniform grid banded).
 *  The page is rigid and flat, so the fore-edge's coarser columns cost
 *  nothing: endpoints are preserved and uv stays u = x/PAGE_W. */
const GRID_WARP = 1.6
/** Where the fold shadow fades to clean paper, as a fraction of page width
 *  (~0.08 world units — the half-span the old floating strip covered). */
export const GUTTER_SHADE_U = 0.07
/** Multiply factors at the fold line (u = 0): warm brown, not gray — the
 *  same composite the approved round-4 strip produced over aged paper. */
const GUTTER_DARK: readonly [number, number, number] = [0.45, 0.4, 0.34]

/** Per-channel multiply factor of the fold shadow at page coordinate u.
 *  (1 - t)^1.7 keeps the dark hugging the spine and eases into clean paper
 *  — the concave "paper curving down into the binding" falloff. */
export function gutterShade(u: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, u / GUTTER_SHADE_U))
  const rise = 1 - Math.pow(1 - t, 1.7)
  return [
    GUTTER_DARK[0] + (1 - GUTTER_DARK[0]) * rise,
    GUTTER_DARK[1] + (1 - GUTTER_DARK[1]) * rise,
    GUTTER_DARK[2] + (1 - GUTTER_DARK[2]) * rise,
  ]
}

/**
 * Flat page template vertices: x∈[0,PAGE_W] from spine, z∈[-PAGE_H/2,PAGE_H/2], y=0.
 * Returns [positions, uvs, indices] arrays for a (PAGE_SEGMENTS+1)×2 vertex grid.
 *
 * Vertex layout: two rows of (PAGE_SEGMENTS+1) vertices — row 0 at
 * z=-PAGE_H/2 (vertices 0..PAGE_SEGMENTS), row 1 at z=+PAGE_H/2 (vertices
 * PAGE_SEGMENTS+1..2*PAGE_SEGMENTS+1). Columns are spine-dense (GRID_WARP
 * above). uvs are u=x/PAGE_W, v=1-row: the camera views the desk from +Z
 * (book-scene.tsx), so the image's top row (v=1 under three's default
 * flipY) must land on the FAR page edge at z=-PAGE_H/2 — v=row put the
 * printed sky at the reader's edge, rendering every page print upside down.
 *
 * `colors` carries the gutter-shade AO ramp (gutterShade above); consumers
 * attach it as the geometry's `color` attribute and render with
 * `vertexColors: true` so the fold shadow multiplies whatever print the
 * page currently wears.
 */
export function buildPageTemplate(): {
  positions: Float32Array
  uvs: Float32Array
  colors: Float32Array
  indices: Uint16Array
} {
  const vertexCount = ROW_VERTS * 2
  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const colors = new Float32Array(vertexCount * 3)

  for (let row = 0; row < 2; row++) {
    const z = row === 0 ? -PAGE_H / 2 : PAGE_H / 2
    for (let col = 0; col <= PAGE_SEGMENTS; col++) {
      const vertex = row * ROW_VERTS + col
      const u = Math.pow(col / PAGE_SEGMENTS, GRID_WARP)
      const x = u * PAGE_W

      positions[vertex * 3] = x
      positions[vertex * 3 + 1] = 0
      positions[vertex * 3 + 2] = z

      uvs[vertex * 2] = u
      uvs[vertex * 2 + 1] = 1 - row

      const [r, g, b] = gutterShade(u)
      colors[vertex * 3] = r
      colors[vertex * 3 + 1] = g
      colors[vertex * 3 + 2] = b
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

  return { positions, uvs, colors, indices }
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
 * uniform glide. Since the cover-mechanics rework this is the ONE easing
 * every turn consumer shares — sheet, cover board, block relaxation and
 * pop-up gearing — so nothing glued together can shear apart mid-flight
 * (`easeTurn` above remains as the tests' reference cubic).
 */
export const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

/**
 * Closed-form inverse of easeTurnWeighted, exact on [0,1]. Lets the turn
 * driver publish an arbitrary eased-progress curve through the ONE raw `t`
 * every consumer already runs back through easeTurnWeighted: publish
 * `easeTurnWeightedInv(E)` and every geared piece sees exactly `E`. That is
 * how the landing settle (use-turn-driver's SETTLE_MS tail) reaches the
 * sheet, the popups and the cover with zero per-piece code.
 */
export const easeTurnWeightedInv = (e: number): number =>
  e < 0.5 ? Math.pow(e / 16, 0.2) : 1 - Math.pow((1 - e) / 16, 0.2)

// ---------------------------------------------------------------------------
// Bulge model: tilted rest poses from per-side stack thickness.
// Derived in .superpowers/sdd/bench/derive-bulge.mjs (theorems A16-A20,
// grid-scanned): the engine is dihedral-driven end to end, so "the left
// stack grows while the right thins" is NOT new mechanics — it is a rest
// pose of (PI - aL(spread), aR(spread)) instead of (PI, 0), already inside
// the solved space. A real pop-up book never opens dead flat; the sub-
// epsilon hand-off residuals (~0.0087 rad) ARE the visible air held around
// the folded content between pages.

/** Visual thickness of one interior sheet in the fore-edge fan. Round-6
 *  chunkiness bump (0.01 -> 0.014, re-derived with the corrected stack
 *  count): max tilt ~6.3deg, rest bloom ~173.7deg, hand-off residual
 *  0.0122 rad — 61% of FLAT_EPSILON, comfortable margin. The user's bar
 *  is pages with clearly VISIBLE width, each one distinct. */
export const SHEET_STACK_T = 0.014
/** Static block body under the fanned sheets (endpapers/binding margin). */
export const STACK_PEDESTAL = 0.02
/** Full stack height when every sheet lies on one side — the closed-book
 *  block silhouette. book.tsx keys the cover rest heights off this. */
export const STACK_TOTAL_H = STACK_PEDESTAL + 9 * SHEET_STACK_T
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
 *  height from how many sheets of PAPER lie under each visible surface.
 *  The left surface is the BACK of sheet spread-1, so spread-1 sheets lie
 *  under it; the right surface is the FRONT of sheet `spread`, which stays
 *  IN the right stack until it flies — sheets spread..9 lie under it (at
 *  chapter I all NINE sheets are on the right). Spread 0 (closed cover)
 *  clamps to the spread-1 stacks — nothing open renders with it, but
 *  every caller gets finite numbers. */
export function restAngles(spread: number): RestPose {
  const left = Math.max(0, spread - 1)
  const right = INTERIOR_SHEETS + 1 - Math.max(1, spread)
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

/**
 * Morphing stack block: the per-side page stack in EVERY book state, one
 * geometry with two driven heights.
 *
 *   spineH = foreH        -> the SHUT slab (closed book / cover-turn start)
 *   spineH = 0            -> the OPEN wedge (sheet edges climbing from the
 *                            gutter valley to the fore-edge — a rigid
 *                            tilted page can't drape over a full box)
 *   spineH in between     -> the binding RELAXING while the cover opens:
 *                            the spine side sinks into the valley while
 *                            the fore-edge stays put, which is exactly what
 *                            a real block does as the board comes over
 *
 * The old closed box / open wedge pair swapped shapes in one React commit
 * at the cover turn's end — the round-5 "morph pop". This block is updated
 * per frame on the driver clock instead (updateStackBlock below), so the
 * silhouette never jumps.
 *
 * UVs carry the per-sheet edge stripes (book.tsx's stack-edge canvases):
 * v = height / foreH, so on the fore face a horizontal stripe = one
 * sheet's cut edge, and on the z-end faces the spine-top corner sits at
 * v = spineH/foreH — stripes squeeze toward the binding as the spine side
 * relaxes, converging exactly like real fanned sheets (at spineH = 0 they
 * meet AT the binding, the old wedge's look; at spineH = foreH they run
 * level, the shut block's).
 */
export function buildStackBlock(
  width: number,
  depth: number
): { positions: Float32Array; uvs: Float32Array; indices: Uint16Array } {
  const d = depth / 2
  // Flat-shaded (duplicated verts), 24 vertices / 6 faces. Top-edge y and
  // side-face v values here are placeholders — updateStackBlock writes
  // them before first render.
  // prettier-ignore
  const positions = new Float32Array([
    // bottom (-y): CCW from below
    0, 0, -d,  width, 0, -d,  width, 0, d,  0, 0, d,
    // top slope: spine edge (y=spineH) to fore edge (y=foreH)
    0, 1, -d,  0, 1, d,  width, 1, d,  width, 1, -d,
    // fore face (+x)
    width, 0, d,  width, 0, -d,  width, 1, -d,  width, 1, d,
    // spine face (-x), zero-height when fully open
    0, 0, -d,  0, 0, d,  0, 1, d,  0, 1, -d,
    // near end (+z): trapezoid spine-bottom, fore-bottom, fore-top, spine-top
    0, 0, d,  width, 0, d,  width, 1, d,  0, 1, d,
    // far end (-z), mirrored u so the print reads outward
    0, 0, -d,  0, 1, -d,  width, 1, -d,  width, 0, -d,
  ])
  // prettier-ignore
  const uvs = new Float32Array([
    // bottom: unseen, park at the stripe map's base
    0, 0,  1, 0,  1, 0,  0, 0,
    // top slope: the top sheet's surface — sample the top stripe row
    0, 1,  1, 1,  1, 1,  0, 1,
    // fore face: full stripe run, v = height
    0, 0,  1, 0,  1, 1,  0, 1,
    // spine face: hidden behind the spine board; v tracks spineH
    0, 0,  1, 0,  1, 1,  0, 1,
    // +z end trapezoid: fore corners span 0..1, spine-top at v=spineV
    0, 0,  1, 0,  1, 1,  0, 1,
    // -z end trapezoid (mirrored u)
    1, 0,  1, 1,  0, 1,  0, 0,
  ])
  // prettier-ignore
  const indices = new Uint16Array([
    0, 3, 2, 0, 2, 1,       // bottom (wound for -y)
    4, 5, 6, 4, 6, 7,       // top slope
    8, 9, 10, 8, 10, 11,    // fore
    12, 13, 14, 12, 14, 15, // spine (wound for -x)
    16, 17, 18, 16, 18, 19, // +z end
    20, 21, 22, 20, 22, 23, // -z end
  ])
  const template = { positions, uvs, indices }
  updateStackBlock(positions, uvs, 1, 1)
  return template
}

// Vertex indices of buildStackBlock's spine-top corners (y = spineH) and
// fore-top corners (y = foreH), per the layout above.
const BLOCK_SPINE_TOP = [4, 5, 14, 15, 19, 21] as const
const BLOCK_FORE_TOP = [6, 7, 10, 11, 18, 22] as const
// Of those, the ones whose uv v tracks spineH/foreH (the z-end trapezoids'
// spine-top corners and the spine face's top edge).
const BLOCK_SPINE_V = [14, 15, 19, 21] as const

/**
 * Writes the block's two driven heights (world units) into a
 * buildStackBlock geometry's attribute arrays. Pure array-in/array-out so
 * the morph invariants are testable in jsdom; the caller flags
 * needsUpdate / recomputes normals. foreH must be > 0 (clamp a hidden
 * stack to epsilon, exactly like the old wedge's minimum y scale).
 */
export function updateStackBlock(
  positions: Float32Array,
  uvs: Float32Array,
  spineH: number,
  foreH: number
): void {
  const spineV = Math.min(1, spineH / foreH)
  for (const i of BLOCK_SPINE_TOP) positions[i * 3 + 1] = spineH
  for (const i of BLOCK_FORE_TOP) positions[i * 3 + 1] = foreH
  for (const i of BLOCK_SPINE_V) uvs[i * 2 + 1] = spineV
}
