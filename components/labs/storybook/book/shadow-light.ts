/**
 * The book's single KEY LIGHT (gate D-G6, shadow system v2). ONE light for
 * the whole tome, expressed as a fixed cast direction on the page plane plus
 * an elevation response — imported by every layer renderer so the covenant's
 * "shadow offset direction identical across all spreads" holds BY
 * CONSTRUCTION: no renderer invents its own light.
 *
 * The lamp sits up-screen-left, high and a little behind the reader's
 * shoulder, so every lifted piece throws its contact pool DOWN-SCREEN-RIGHT.
 * On the page that is +x (screen-right) and +z (screen-down, toward the
 * reader) — see popup-spread.ts SCREEN_UP for the camera basis.
 *
 * Physics, kept to one line so it reads as a real key light rather than a
 * decal: a piece standing `h` above the page throws its pool `h * cot(alpha)`
 * along the cast azimuth, where alpha is the (fixed) light elevation. Taller
 * pieces slide their pool further out, deepen it, and spread it — exactly how
 * a hero anchors harder than a low swell. All three responses are pure
 * functions of geometry, so each renderer computes them ONCE at mount; only
 * the sin^2(beta/2) bloom (the D-G3 floor) stays per-frame.
 */

import type { PanelQuad, Vec3 } from './popup-mechanics'

// Cast azimuth on the page, raw (x = screen-right, z = screen-down). More
// right than down: down-screen is foreshortened under the high reading
// camera, so an equal-looking diagonal needs the x component to lead.
const CAST_RAW_X = 1
const CAST_RAW_Z = 0.72
const CAST_LEN = Math.hypot(CAST_RAW_X, CAST_RAW_Z)
/** Unit cast direction components on the page plane. */
export const CAST_X = CAST_RAW_X / CAST_LEN
export const CAST_Z = CAST_RAW_Z / CAST_LEN

// cot(light elevation): pool offset = characteristic height * this. 0.5 reads
// as a lamp well above the desk — the direction is legible without a
// theatrical raking streak that would fight the art's own painted shading.
export const THROW_PER_HEIGHT = 0.6

// The standing height the per-renderer base opacities were tuned at; the
// elevation response is measured against it, so a piece at this height lands
// near its already-approved value and only departs from there.
const REF_HEIGHT = 0.34

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Opacity gain vs. elevation: a tall hero deepens, a low swell lightens,
 *  both gently and clamped so nothing washes out or turns into a hard slab. */
export const elevationDepth = (height: number): number =>
  clamp(0.76 + 0.52 * (height / REF_HEIGHT), 0.76, 1.42)

/** Footprint gain vs. elevation: a taller pool is slightly larger and softer,
 *  a lower one tighter. */
export const elevationSpread = (height: number): number =>
  clamp(0.94 + 0.28 * (height / REF_HEIGHT), 0.94, 1.35)

export type ShadowLift = {
  /** Offset to ADD to the pool centre, in page-plane world units. */
  dx: number
  dz: number
  /** Multiplier on the renderer's base MAX opacity. */
  depth: number
  /** Multiplier on the footprint size. */
  spread: number
}

/** The full key-light response for a piece of the given characteristic
 *  height (its rest peak above the page — see `peakHeight`). */
export function shadowLift(height: number): ShadowLift {
  const reach = Math.max(0, height) * THROW_PER_HEIGHT
  return {
    dx: CAST_X * reach,
    dz: CAST_Z * reach,
    depth: elevationDepth(height),
    spread: elevationSpread(height),
  }
}

/** Peak height above the page plane (world y) over a set of solved quads —
 *  the characteristic elevation a piece's contact shadow answers to. Pieces
 *  glue at y=0 (the page surface), so this is the piece's stand height. */
export function peakHeight(quads: readonly PanelQuad[]): number {
  let peak = 0
  for (const quad of quads) {
    for (const corner of quad as readonly Vec3[]) {
      if (corner[1] > peak) peak = corner[1]
    }
  }
  return peak
}
