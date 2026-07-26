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

/** Slop factor for a PAGE-FLAT handle (pull tabs, cards, discs). These lie in
 *  the page plane, so the ~27deg reading camera foreshortens them to a sliver
 *  — the STIR tab measured 55x22 screen px. They get the most generous pad. */
export const HANDLE_SLOP_FLAT = 1.8
/** Slop factor for a STANDING handle (a flap the reader grabs face-on). These
 *  already present their full area to the camera. */
export const HANDLE_SLOP_STANDING = 1.5

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
  return !e.intersections.some((i) => i.eventObject === e.eventObject && i.object !== slop)
}
