/**
 * THE READING STAGE — the book's pinned camera, and the screen-space arithmetic
 * that depends on it. No react, no r3f: importable from the layers, from
 * book-scene (which mounts the camera from these very numbers) and from the
 * unit gates, which is the point — every "screen px" claim in this lab is
 * derived from ONE definition of where the reader's eye is.
 *
 * WHY IT EXISTS (E3 R-3, the re-review's second blocker): "The seated vendor
 * folds flat rightward and can NEVER be re-grabbed — reload is the only
 * recovery." The handle was not gone; it had turned nearly EDGE-ON to the
 * reading camera. Measured across his own travel window (the projected slop
 * quad at this camera, 1600x900): 8355 px^2 / 96x94 px standing at 90 deg,
 * collapsing to 3063 px^2 / 108x37 px at his 50 deg latch — and the s6 stall
 * row passes through 894 px^2 / 474x21 px mid-travel, and a lift-flap door at
 * full open measures 19 px across. Every one of those is a state a reader can
 * LATCH the piece in (release law, BW-12), and a latched state whose own handle
 * is a sliver is a piece the reader can no longer take back.
 *
 * The existing pad (handle-hit.ts) cannot see this: it measures the piece's
 * WORLD edges, and rotating a quad does not change its edge lengths — only its
 * projection. So the floor has to be applied in screen space, along the axis
 * that is actually collapsing, which is what `screenAxisSlop` measures and
 * `stretchQuadAxis` applies.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

/** book-scene.tsx mounts the Canvas camera from exactly these three. */
export const CAMERA_POSITION: readonly [number, number, number] = [0, 1.85, 3.05]
export const CAMERA_LOOKAT: readonly [number, number, number] = [0, 0.38, 0.05]
export const CAMERA_FOV = 34

/** The reference viewport every blind review and every screen-px gate in this
 *  lab is measured at. The pad derived here is a floor, so a smaller window
 *  (which magnifies nothing) only ever gets a slightly generous handle. */
export const REFERENCE_VIEW = { w: 1600, h: 900 } as const

/**
 * Minimum projected extent of a handle's hit surface, in reference-viewport
 * pixels. The ordinary touch-target floor, and the screen-space twin of
 * handle-hit.ts's world-space HANDLE_MIN_HIT (~45 px at this camera for a
 * page-flat piece — the same bar, now enforced at every POSE rather than only
 * where the paper happens to face the reader).
 */
export const HANDLE_MIN_SCREEN_PX = 44

/**
 * How far a hit surface may be stretched to reach that floor. A quad seen
 * exactly edge-on projects to nothing and no finite stretch saves it, so the
 * pad is capped rather than unbounded. 5x is the smallest cap that carries every
 * shipped flap over the floor (the title page's quill is the binding case: 9.7
 * px across at 36 deg, the thinnest handle in the book), and it only ever
 * applies to a piece that is ALREADY nearly edge-on — where the padding grows
 * into the empty air along the piece's own plane, not across the page.
 */
export const MAX_SCREEN_STRETCH = 5

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2])
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]
}

const EYE: Vec3 = [...CAMERA_POSITION] as unknown as Vec3
const FWD = norm(sub([...CAMERA_LOOKAT] as unknown as Vec3, EYE))
const RIGHT = norm(cross(FWD, [0, 1, 0]))
const UP = norm(cross(RIGHT, FWD))
const TAN_H = Math.tan((CAMERA_FOV * Math.PI) / 360)

/** A world point in reference-viewport pixels (y down). Points behind the eye
 *  come back at the clamped near depth rather than mirrored. */
export function toScreenPx(p: Vec3): { x: number; y: number } {
  const rel = sub(p, EYE)
  const depth = Math.max(1e-3, dot(rel, FWD))
  const sx = dot(rel, RIGHT) / (depth * TAN_H * (REFERENCE_VIEW.w / REFERENCE_VIEW.h))
  const sy = dot(rel, UP) / (depth * TAN_H)
  return { x: (sx * 0.5 + 0.5) * REFERENCE_VIEW.w, y: (1 - (sy * 0.5 + 0.5)) * REFERENCE_VIEW.h }
}

/** The two in-plane axes of a quad given in ring order, as world vectors
 *  through its centre (a parallelogram's own basis). */
function quadAxes(q: readonly Vec3[]): { a1: Vec3; a2: Vec3 } {
  const a1: Vec3 = [
    (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2,
    (q[1][1] - q[0][1] + q[2][1] - q[3][1]) / 2,
    (q[1][2] - q[0][2] + q[2][2] - q[3][2]) / 2,
  ]
  const a2: Vec3 = [
    (q[3][0] - q[0][0] + q[2][0] - q[1][0]) / 2,
    (q[3][1] - q[0][1] + q[2][1] - q[1][1]) / 2,
    (q[3][2] - q[0][2] + q[2][2] - q[1][2]) / 2,
  ]
  return { a1, a2 }
}

const centroid = (q: readonly Vec3[]): Vec3 => [
  (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
  (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
  (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4,
]

/** Projected length (reference px) of the quad's axis `a` through its centre. */
function axisScreenPx(q: readonly Vec3[], a: Vec3): number {
  const c = centroid(q)
  const p = toScreenPx([c[0] - a[0] / 2, c[1] - a[1] / 2, c[2] - a[2] / 2])
  const r = toScreenPx([c[0] + a[0] / 2, c[1] + a[1] / 2, c[2] + a[2] / 2])
  return Math.hypot(r.x - p.x, r.y - p.y)
}

/**
 * How much (and along which of its own axes) a quad must be stretched for its
 * SHORTER projected extent to clear HANDLE_MIN_SCREEN_PX. `k` is 1 when the
 * handle already presents a real target — which is the common case, so a piece
 * facing the reader is never padded further than it is today.
 */
export function screenAxisSlop(quad: readonly Vec3[]): { axis: Vec3; k: number } {
  if (quad.length < 4) return { axis: [0, 0, 0], k: 1 }
  const { a1, a2 } = quadAxes(quad)
  const l1 = axisScreenPx(quad, a1)
  const l2 = axisScreenPx(quad, a2)
  const short = l1 <= l2 ? { axis: a1, len: l1 } : { axis: a2, len: l2 }
  if (short.len >= HANDLE_MIN_SCREEN_PX) return { axis: short.axis, k: 1 }
  if (short.len <= 1e-6) return { axis: short.axis, k: MAX_SCREEN_STRETCH }
  return { axis: short.axis, k: Math.min(MAX_SCREEN_STRETCH, HANDLE_MIN_SCREEN_PX / short.len) }
}

/**
 * Scales `quad` by `k` about its centre ALONG `axis` only — the collapsing
 * direction — leaving the direction the reader can already hit untouched. A
 * uniform pad would have to grow the long axis by the same factor, which on the
 * s6 stall row (474 px wide, 21 px tall mid-travel) would have swallowed half
 * the page to win 23 px of height.
 */
export function stretchQuadAxis(quad: readonly Vec3[], axis: Vec3, k: number): Vec3[] {
  if (k <= 1) return quad.map((p) => [p[0], p[1], p[2]] as Vec3)
  const u = norm(axis)
  const c = centroid(quad)
  return quad.map((p) => {
    const d = dot(sub(p, c), u) * (k - 1)
    return [p[0] + u[0] * d, p[1] + u[1] * d, p[2] + u[2] * d] as Vec3
  })
}

/** The whole law in one call: the hit quad a layer should actually raycast. */
export function withScreenHitFloor(quad: readonly Vec3[]): PanelQuad {
  const { axis, k } = screenAxisSlop(quad)
  const out = stretchQuadAxis(quad, axis, k)
  return [out[0], out[1], out[2], out[3]]
}
