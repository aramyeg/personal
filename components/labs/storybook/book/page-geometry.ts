/**
 * Pure page-curl math for the pop-up book — no three.js imports, so it runs
 * in jsdom tests as-is.
 *
 * v3 orientation (the authentic pop-up orientation, user-approved): the
 * spine/gutter runs along X at z=0 — horizontal on screen. The NEAR page
 * (unread stack) extends toward the camera, z ∈ [0, PAGE_DEPTH]; the FAR
 * page (read stack) mirrors it, z ∈ [-PAGE_DEPTH, 0]. +Y is up. A page turn
 * rotates about the gutter (the X axis): 'next' lifts the near page up and
 * over, away from the reader; 'prev' brings the far stack's top sheet back
 * over toward them. This is what makes the pop-up mechanics honest: the
 * pieces' fold lines (parallel to X — see popup-spread.tsx) are parallel to
 * the gutter, so the turning page and the paper it drives rotate on
 * parallel hinges, exactly like glued paper in a real book.
 */

export const PAGE_SPAN = 2.3 // across the spread, along the spine/gutter (x)
export const PAGE_DEPTH = 0.75 // one page, gutter -> free edge (z)
export const PAGE_SEGMENTS = 32
export const CURL_MAX = 0.55

const COLS = 2

/**
 * Flat page template vertices: two columns at x = ∓PAGE_SPAN/2, and
 * PAGE_SEGMENTS+1 rows at z = d ∈ [0, PAGE_DEPTH] from the gutter, y = 0.
 * Vertex order: row r holds vertices r·2 (x = -PAGE_SPAN/2) and r·2+1
 * (x = +PAGE_SPAN/2). uvs are u = column, v = d/PAGE_DEPTH (v = 0 at the
 * gutter). Triangles wound CCW for a +y normal when flat.
 */
export function buildPageTemplate(): {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint16Array
} {
  const rows = PAGE_SEGMENTS + 1
  const positions = new Float32Array(rows * COLS * 3)
  const uvs = new Float32Array(rows * COLS * 2)
  const indices = new Uint16Array(PAGE_SEGMENTS * 6)

  for (let row = 0; row < rows; row++) {
    const d = (row / PAGE_SEGMENTS) * PAGE_DEPTH
    for (let col = 0; col < COLS; col++) {
      const vertex = row * COLS + col
      positions[vertex * 3] = col === 0 ? -PAGE_SPAN / 2 : PAGE_SPAN / 2
      positions[vertex * 3 + 1] = 0
      positions[vertex * 3 + 2] = d
      uvs[vertex * 2] = col
      uvs[vertex * 2 + 1] = d / PAGE_DEPTH
    }
  }

  let cursor = 0
  for (let seg = 0; seg < PAGE_SEGMENTS; seg++) {
    const a = seg * COLS // row seg, -x
    const b = a + 1 // row seg, +x
    const c = a + COLS // row seg+1, -x
    const d = c + 1 // row seg+1, +x

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
 * Curl deformation around the gutter (the x axis). dir 'next': theta 0→π,
 * the near page sweeping up and over to the far side.
 *
 * For each vertex: d = template.z (distance from the gutter);
 * theta = dir === 'next' ? π·ease(t) : π·(1−ease(t));
 * sign = dir === 'next' ? 1 : −1;
 * alpha = theta − sign·CURL_MAX·sin(π·t)·(d/PAGE_DEPTH)^1.3;
 * out.z = d·cos(alpha), out.y = d·sin(alpha) + 0.005 (lift to avoid
 * z-fighting with static pages), out.x = template.x.
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
    const x = template[base]
    const d = template[base + 2]

    const alpha = theta - sign * CURL_MAX * sinPiT * Math.pow(d / PAGE_DEPTH, 1.3)

    out[base] = x
    out[base + 1] = d * Math.sin(alpha) + 0.005
    out[base + 2] = d * Math.cos(alpha)
  }
}

/**
 * easeInOutQuint — flatter grip at both ends than easeTurn's cubic (a
 * gentler initial lift, a softer landing) with a snappier sweep through the
 * middle, so a full turn reads as a weightier hardback page instead of a
 * uniform glide (task 18). Kept as a separate export rather than changing
 * `easeTurn` in place: `easeTurn`'s cubic shape is asserted by the tests
 * and consumed elsewhere (book.tsx's cover pivot) unchanged.
 */
export const easeTurnWeighted = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2

/** Max fraction of `t` the +x/-x side edges of the page lead/lag each other
 *  by in curlPositionsPhased — see that function. */
export const CURL_X_LEAD = 0.05

/**
 * Same deformation as curlPositions, but with the free corner leading: the
 * +x edge reaches a given point in the curl slightly before global `t`, the
 * -x edge slightly after, each clamped back into the page's own [0,1] time
 * so the curl never runs backward or restarts partway through. Reads as the
 * sheet being pinched and lifted from one corner rather than hinging evenly
 * across its whole span — a small, standard paper-turn tell that a uniform
 * curl (curlPositions) can't produce on its own.
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
 * A separate export rather than a change to curlPositions, so that
 * function's existing tests — and its simpler, uniform mid-turn shape —
 * stay exactly as they are.
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
    const x = template[base]
    const d = template[base + 2]

    const xPhase = CURL_X_LEAD * (x / (PAGE_SPAN / 2))
    const tLocal = Math.min(1, Math.max(0, t + xPhase))
    const eased = ease(tLocal)
    const theta = dir === 'next' ? Math.PI * eased : Math.PI * (1 - eased)
    const droopEnvelope = Math.sin(Math.PI * eased)

    const alpha = theta - sign * CURL_MAX * droopEnvelope * Math.pow(d / PAGE_DEPTH, 1.3)

    out[base] = x
    out[base + 1] = d * Math.sin(alpha) + 0.005
    out[base + 2] = d * Math.cos(alpha)
  }
}
