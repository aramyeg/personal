/**
 * ONE HIT LAW for every grab handle in the book.
 *
 * THE DEFECT IT FIXES (blind sweep 2026-07-26, BW-11 / S6-2 / S6-4): each
 * handle carried two raycast surfaces — the EXACT die-cut quad and a 1.4-1.5x
 * "slop" quad for coarse pointers — and both carried the hover handlers, while
 * `onPointerDown` accepted the exact mesh for mouse/pen ONLY and the slop mesh
 * for touch ONLY. So a mouse hovering the slop ring got a `grab` cursor and a
 * press that was silently discarded. Measured on the live page: roughly half
 * the `grab`-cursor band engaged nothing, and s6's mauve pull tab never
 * engaged at all.
 *
 * THE LAW: any pointer type may engage EITHER surface. The slop defers only
 * when the exact surface is under the pointer too, so precision still wins
 * where the reader is actually on the die-cut. Hover region == engaging
 * region, by construction, for every family.
 */

import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { PanelQuad, Vec3 } from './popup-mechanics'
import { withScreenHitFloor } from './reading-stage'

/** Slop factor for a PAGE-FLAT handle (pull tabs, cards, discs). These lie in
 *  the page plane, so the ~27deg reading camera foreshortens them to a sliver
 *  — the STIR tab measured 55x22 screen px. They get the most generous pad. */
export const HANDLE_SLOP_FLAT = 1.8
/** Slop factor for a STANDING handle (a flap the reader grabs face-on). These
 *  already present their full area to the camera. */
export const HANDLE_SLOP_STANDING = 1.5

/**
 * ABSOLUTE FLOOR on a handle's effective hit surface, in world units — roughly
 * 45 screen px at the pinned reading camera, i.e. the ordinary touch-target
 * floor. A relative pad alone is not enough: the s4 cable-carrier grab box
 * measured ~26x40 screen px and the s3 STIR tab 55x22, and 1.8x a sliver is
 * still a sliver. `handleSlopFactor` grows the pad until the piece's SHORTEST
 * edge clears this, so small handles get proportionally more help than large
 * ones and nothing is padded below its own die-cut.
 */
export const HANDLE_MIN_HIT = 0.12

const edge = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * The slop factor to enlarge `quad` by: enough that the quad's shortest edge
 * reaches `base` TIMES the floor, and never more. Capped so a degenerate (zero
 * area) quad cannot ask for an unbounded pad, and floored at 1 so no handle is
 * ever padded below its own die-cut.
 *
 * WHY IT IS A TARGET AND NOT A MULTIPLIER (E3 s2 round-2, S2R2-3b). `base` used
 * to be an unconditional 1.4-1.8x pad on top of the floor, which is right for
 * the slivers this file was written for and wrong for everything else: a blind
 * re-reader found s2's welcome rank — a die-cut already measuring 159 x 95
 * screen px, three and a half times the floor — advertising a 270 x 145 px grab
 * band, so "pinching over empty pavement and over an unrelated prop both promise
 * something and pay nothing". A hit box that reaches past its own art is not
 * generosity; it is a lie about where the paper is, and it lands on props that
 * then answer nothing.
 *
 * So the pad is stated as a TARGET SIZE. Every handle is carried to at least
 * `base * HANDLE_MIN_HIT` (0.18 world for a standing flap, 0.216 for a page-flat
 * one — about 67 and 80 screen px, comfortably over the touch floor), and a
 * handle already bigger than that is left exactly at its die-cut, where its art
 * is. The pieces this file was written to rescue are unaffected: they are far
 * under the floor, where the old and the new law agree to within their own cap.
 */
export function handleSlopFactor(quad: readonly Vec3[], base: number): number {
  if (quad.length < 4) return base
  let shortest = Infinity
  for (let i = 0; i < 4; i++) {
    const d = edge(quad[i], quad[(i + 1) % 4])
    if (d > 1e-6 && d < shortest) shortest = d
  }
  if (!Number.isFinite(shortest)) return base
  return Math.min(6, Math.max(1, (base * HANDLE_MIN_HIT) / shortest))
}

/** Scales a quad about its own centre — the shared shape of every layer's
 *  private `enlargeQuad`, kept here so the hit surface a family raycasts and the
 *  hit surface the gates measure are produced by ONE function. */
export function enlargeQuad(quad: readonly Vec3[], k: number): PanelQuad {
  const c = [0, 1, 2].map((i) => (quad[0][i] + quad[1][i] + quad[2][i] + quad[3][i]) / 4)
  const grow = (p: Vec3): Vec3 => [
    c[0] + (p[0] - c[0]) * k,
    c[1] + (p[1] - c[1]) * k,
    c[2] + (p[2] - c[2]) * k,
  ]
  return [grow(quad[0]), grow(quad[1]), grow(quad[2]), grow(quad[3])]
}

/**
 * THE HIT SURFACE a grabbable actually raycasts: the die-cut quad, padded by the
 * world-space slop rule above, then held to the screen-space floor
 * (reading-stage.ts) so a piece that has turned edge-on to the reader is still
 * something a hand can land on. Both halves are floors — a handle already facing
 * the reader comes back exactly as the world pad left it.
 */
export function hitQuadFor(quad: readonly Vec3[], base: number): PanelQuad {
  return withScreenHitFloor(enlargeQuad(quad, handleSlopFactor(quad, base)))
}

/**
 * Mark a mesh that lives inside a handle's group but is NOT a grab surface —
 * a lift flap's key-board plaque, a volvelle's static window card. Put it in the
 * mesh's `userData` and `acceptsHandleHit` will stop yielding to it.
 *
 * WHY IT EXISTS (E3 s7 round-2, S7R2-3: "the card flap is one-way. Once lifted
 * it never closes"). The deferral rule below reads "defer to the EXACT surface",
 * and every family's handlers are bound on the GROUP, so `eventObject` is the
 * group and every sibling mesh in it looked like the exact surface. A lift
 * flap's group is [board, door front, door back, slop] — so with the board under
 * the pointer, which it is everywhere inside the piece, the slop pad was
 * REJECTED and the door's own quad was the only live surface the family ever
 * had. Shut, that quad is right where the reader presses and nobody noticed.
 * Open at 95 deg it is a 19 px sliver somewhere else, and the pad that exists
 * precisely to rescue it never got a vote: measured live
 * (bench/s7r2-coffer-map.mjs), the coffer went from 27 grabbable cells shut to
 * ZERO across a 360 x 320 px window at full open, in every direction.
 *
 * Marking the non-handle surfaces — rather than marking the handle ones — keeps
 * every other family bit-identical: a layer that marks nothing behaves exactly
 * as it did.
 */
export const HANDLE_INERT = { handleInert: true } as const

/**
 * Whether this pointerdown should be consumed by the surface it landed on.
 * `slop` is the layer's coarse-pointer mesh (or null if it has none).
 */
export function acceptsHandleHit(
  e: ThreeEvent<PointerEvent>,
  slop: THREE.Object3D | null
): boolean {
  if (!slop || e.object !== slop) return true
  // A slop-only hit engages; a slop hit that ALSO has the exact surface under
  // the pointer defers to the pass this same handler makes for that surface.
  // Scenery inside the same group (HANDLE_INERT) is not a surface to defer to:
  // it takes no grab, so yielding to it drops the press on the floor.
  return !e.intersections.some(
    (i) =>
      i.eventObject === e.eventObject &&
      i.object !== slop &&
      i.object.userData?.handleInert !== true
  )
}
