/**
 * Pure math module for the WebGL book's page-turn geometry. No three.js
 * imports here — this feeds raw Float32Arrays to a mesh later, and staying
 * three-free lets it run in jsdom tests.
 *
 * Geometry conventions: the page is a horizontal grid, x runs from the
 * spine (0) to the free edge (PAGE_W), z runs across the page height
 * (±PAGE_H/2), y is up. The turn rotates around the spine (the z axis).
 */

export const PAGE_W = 1.15
export const PAGE_H = 1.5
export const PAGE_SEGMENTS = 32
export const CURL_MAX = 0.55 // radians of trailing-edge lag

const ROW_VERTS = PAGE_SEGMENTS + 1

/**
 * Flat page template vertices: x∈[0,PAGE_W] from spine, z∈[-PAGE_H/2,PAGE_H/2], y=0.
 * Returns [positions, uvs, indices] arrays for a (PAGE_SEGMENTS+1)×2 vertex grid.
 *
 * Vertex layout: two rows of (PAGE_SEGMENTS+1) vertices — row 0 at
 * z=-PAGE_H/2 (vertices 0..PAGE_SEGMENTS), row 1 at z=+PAGE_H/2 (vertices
 * PAGE_SEGMENTS+1..2*PAGE_SEGMENTS+1). uvs are u=x/PAGE_W, v=row.
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
      uvs[vertex * 2 + 1] = row
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
 * Curl deformation around the spine (z axis). dir 'next': theta 0→π.
 *
 * For each vertex: d = template.x;
 * theta = dir === 'next' ? π·ease(t) : π·(1−ease(t));
 * sign = dir === 'next' ? 1 : −1;
 * alpha = theta − sign·CURL_MAX·sin(π·t)·(d/PAGE_W)^1.3;
 * out.x = d·cos(alpha), out.y = d·sin(alpha) + 0.005 (lift to avoid
 * z-fighting with static pages), out.z = template.z.
 */
export function curlPositions(
  template: Float32Array,
  out: Float32Array,
  t: number,
  dir: 'next' | 'prev',
  ease: (t: number) => number
): void {
  const eased = ease(t)
  const theta = dir === 'next' ? Math.PI * eased : Math.PI * (1 - eased)
  const sign = dir === 'next' ? 1 : -1
  const sinPiT = Math.sin(Math.PI * t)

  const vertexCount = template.length / 3
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const base = vertex * 3
    const d = template[base]
    const z = template[base + 2]

    const alpha = theta - sign * CURL_MAX * sinPiT * Math.pow(d / PAGE_W, 1.3)

    out[base] = d * Math.cos(alpha)
    out[base + 1] = d * Math.sin(alpha) + 0.005
    out[base + 2] = z
  }
}

/**
 * easeInOutQuint — flatter grip at both ends than easeTurn's cubic (a
 * gentler initial lift, a softer landing) with a snappier sweep through the
 * middle, so a full turn reads as a weightier hardback page instead of a
 * uniform glide (task 18). Kept as a separate export rather than changing
 * `easeTurn` in place: `easeTurn`'s cubic shape is asserted by the tests
 * above and consumed elsewhere (book.tsx's cover pivot) unchanged.
 */
export const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

/** Max fraction of `t` the +z/-z long edges of the page lead/lag each other
 *  by in curlPositionsPhased — see that function. */
export const CURL_Z_LEAD = 0.05

/**
 * Same deformation as curlPositions, but with the free corner leading: the
 * +z edge reaches a given point in the curl slightly before global `t`, the
 * -z edge slightly after, each clamped back into the page's own [0,1] time
 * so the curl never runs backward or restarts partway through. Reads as the
 * page being pinched and lifted from one corner rather than hinging evenly
 * across its whole height — a small, standard paper-turn tell that a
 * uniform curl (curlPositions) can't produce on its own.
 *
 * Also drives the trailing-edge droop's envelope off the *eased* fraction
 * rather than raw t (curlPositions uses raw t — see its own comment).
 * Feeding a heavily front/back-loaded ease (easeTurnWeighted's gentle grip
 * and soft landing) through a droop envelope keyed to raw t lets the droop
 * outrun theta at small t and briefly swings the free edge's y negative —
 * through the desk and the static page below it. Since sin(u) ≤ u for
 * u ≥ 0, keying both theta and the droop envelope to the same eased
 * fraction guarantees theta − droop ≥ 0.45·theta ≥ 0 for every t, so that
 * can't happen, whichever easing function is passed in.
 *
 * A new export rather than a change to curlPositions, so that function's
 * existing tests — and its simpler, uniform mid-turn shape — stay exactly
 * as they are (per this task's constraint that page-geometry.ts's existing
 * exports must remain intact).
 */
export function curlPositionsPhased(
  template: Float32Array,
  out: Float32Array,
  t: number,
  dir: 'next' | 'prev',
  ease: (t: number) => number
): void {
  const sign = dir === 'next' ? 1 : -1
  const vertexCount = template.length / 3

  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const base = vertex * 3
    const d = template[base]
    const z = template[base + 2]

    const zPhase = CURL_Z_LEAD * (z / (PAGE_H / 2))
    const tLocal = Math.min(1, Math.max(0, t + zPhase))
    const eased = ease(tLocal)
    const theta = dir === 'next' ? Math.PI * eased : Math.PI * (1 - eased)
    const droopEnvelope = Math.sin(Math.PI * eased)

    const alpha = theta - sign * CURL_MAX * droopEnvelope * Math.pow(d / PAGE_W, 1.3)

    out[base] = d * Math.cos(alpha)
    out[base + 1] = d * Math.sin(alpha) + 0.005
    out[base + 2] = z
  }
}
