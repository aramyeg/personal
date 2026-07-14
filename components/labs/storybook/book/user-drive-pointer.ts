/**
 * Shared pointer-ray helper for the D6 handle layers (hand-interaction-laws
 * H3/H4). r3f delivers the pointer ray in WORLD space, but every popup solver
 * works in its layer's own local frame (spine at the local origin, the page
 * plane through it). This transforms the ray into the hit object's local frame
 * via its world matrix, so the parallax rig's tilt and the book's placement
 * are cancelled out generically — the projection can never desync from the
 * paper the reader is dragging. No react, one shared scratch ray (pointer
 * events are one-at-a-time, and every caller consumes the result immediately).
 */

import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'

const invMatrix = new THREE.Matrix4()
const localRay = new THREE.Ray()

/** The pointer ray in the hit object's local (solver) frame. */
export function pointerLocalRay(e: ThreeEvent<PointerEvent>): THREE.Ray {
  invMatrix.copy(e.object.matrixWorld).invert()
  return localRay.copy(e.ray).applyMatrix4(invMatrix)
}
