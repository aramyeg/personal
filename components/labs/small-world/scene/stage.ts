import * as THREE from 'three'
import { CHAPTER_SLICE, chapterStartRotation } from '../journey-timeline'
import { PLANET_RADIUS, terrainBump } from './planet'

/**
 * Where the girl stands, in world z: slightly toward the viewer from the
 * apex, so she faces the camera while incoming terrain rises over the front
 * horizon beneath her. (Moved here from girl-proxy so pure prop math can
 * import it without touching a component file.)
 */
export const STANCE_Z = 0.75

/** The girl's angular offset from the planet apex, about the x axis. */
export const STANCE_ALPHA = Math.asin(STANCE_Z / PLANET_RADIUS)

/**
 * Planet-LOCAL angle (about x, measured from +y toward +z) of the surface
 * point under the girl's feet at fraction t of chapter `chapter`'s travel.
 * Chapter prop sets place everything through this — it is the single
 * function that changes if per-chapter turn ever grows past 60°.
 */
export function chapterTheta(chapter: number, t: number): number {
  return chapterStartRotation(chapter) + t * CHAPTER_SLICE + STANCE_ALPHA
}

const Y_UP = new THREE.Vector3(0, 1, 0)

/**
 * Transform for a prop standing ON the displaced terrain at local angle
 * `theta` with lateral offset `x` world units along the planet's x axis.
 * Children of the returned frame author with +Y up, ground at y=0.
 */
export function anchorTransform(
  theta: number,
  x: number
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
  const pre = dir.clone().multiplyScalar(PLANET_RADIUS)
  const bump = terrainBump(pre.x, pre.y, pre.z)
  const position = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
  return { position, quaternion }
}
