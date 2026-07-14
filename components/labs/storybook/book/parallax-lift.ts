/**
 * Pure math module for the desk-tilt parallax rig's clearance compensation
 * (book-scene.tsx's ParallaxRig). No three.js imports — the rig rotates its
 * group with a plain `rotation.x` / `rotation.y` (three's default 'XYZ'
 * Euler order, `rotation.z` left at 0), and this reimplements exactly that
 * composition for a flat footprint at y=0, so the result stays testable in
 * jsdom without a WebGL context.
 *
 * Why this exists: the rig rotates the whole book about its own origin,
 * which sits at the spine on the desk (y=0). A real book can't rotate its
 * cover through the table it rests on — past some tilt, a naive rotation
 * sends the book's near edge below y=0, where the opaque desk plane
 * (book-scene.tsx's Desk, y=-0.001) clips it. `parallaxLift` returns how far
 * to translate the rotated group up so nothing in its footprint dips below
 * the desk.
 */

/** The four footprint corners as unit-square multipliers of (halfW, halfD) —
 *  (x, z) = (sx * halfW, sz * halfD), y = 0. */
const FOOTPRINT_SIGNS: readonly (readonly [sx: number, sz: number])[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/**
 * World Y of a local point (x, 0, z) after a three.js 'XYZ' Euler rotation
 * (rotation.x = rx, rotation.y = ry, rotation.z = 0). Derived from the
 * 'XYZ' rotation matrix's Y row — with z = 0 that row is
 * (sin(rx)sin(ry), cos(rx), -sin(rx)cos(ry)), so a footprint point with
 * y = 0 contributes only its x and z terms.
 */
function rotatedCornerY(rx: number, ry: number, x: number, z: number): number {
  return Math.sin(rx) * Math.sin(ry) * x - Math.sin(rx) * Math.cos(ry) * z
}

/** A hair of clearance above the desk beyond exactly canceling the deepest
 *  corner's dip, on the same order as the gutter crease's own y offset
 *  above the page surface (book.tsx's CREASE_Y). Only added once the book
 *  is actually dipping (see parallaxLift) — zero at zero tilt. */
const LIFT_CLEARANCE = 0.0015

/**
 * Vertical lift (world units, >= 0) the parallax rig must add so a
 * rectangular footprint of half-extents (halfW, halfD) — corners at
 * (±halfW, 0, ±halfD) — never dips below the desk plane (y=0) under the
 * rig's current rotation (rx, ry). Zero at zero tilt (no lift at rest);
 * otherwise the deepest corner's dip plus LIFT_CLEARANCE.
 */
export function parallaxLift(rx: number, ry: number, halfW: number, halfD: number): number {
  let minY = 0
  for (const [sx, sz] of FOOTPRINT_SIGNS) {
    const y = rotatedCornerY(rx, ry, sx * halfW, sz * halfD)
    if (y < minY) minY = y
  }
  const dip = -minY
  return dip > 0 ? dip + LIFT_CLEARANCE : 0
}
