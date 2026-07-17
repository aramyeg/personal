import * as THREE from 'three'
import { CHAPTER_SLICE, chapterStartRotation } from '../journey-timeline'
import { PLANET_RADIUS, surfaceYAt, terrainBump, terrainBumpB } from './planet'
import { RIVER_CROSSINGS } from './biomes'

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

/** Flat plank span of a bridge deck about its crossing centre (rad). */
const DECK_HALF = 0.08
/** Smooth ramp from deck height down to terrain beyond the flat span (rad). */
const DECK_RAMP = 0.09
/**
 * Height the plank deck rides above the carved river floor (world units). The
 * river carves ~RIVER_DEPTH·R below the meadow, so ~0.13 lifts the deck back to
 * ground level plus a plank thickness. Matched by ClayBridge's plank offset so
 * the girl's feet land on the planks; tuned by capture.
 */
export const DECK_RISE = 0.13

/** Shortest signed angular distance |a-b| wrapped to [0, π]. */
function angularGap(a: number, b: number): number {
  const TWO_PI = Math.PI * 2
  let d = (a - b) % TWO_PI
  if (d < 0) d += TWO_PI
  if (d > Math.PI) d = TWO_PI - d
  return d
}

/**
 * World-space top-of-deck height for the girl's lane, or -Infinity where no
 * bridge spans. Flat across the channel at the deck level, ramping smoothly
 * down to the carved terrain over ±DECK_RAMP so walkYAt stays continuous.
 */
export function bridgeDeckYAt(worldZ: number, rotation: number): number {
  const theta = rotation + STANCE_ALPHA
  for (let i = 0; i < RIVER_CROSSINGS.length; i++) {
    const tc = RIVER_CROSSINGS[i]
    const gap = angularGap(theta, tc)
    if (gap > DECK_HALF + DECK_RAMP) continue
    const cy = PLANET_RADIUS * Math.cos(tc)
    const cz = PLANET_RADIUS * Math.sin(tc)
    const carvedR = PLANET_RADIUS * (1 + terrainBump(0, cy, cz))
    const deckR = carvedR + DECK_RISE
    const deckY = Math.sqrt(Math.max(0, deckR * deckR - worldZ * worldZ))
    if (gap <= DECK_HALF) return deckY
    const rampT = (gap - DECK_HALF) / DECK_RAMP
    const s = rampT * rampT * (3 - 2 * rampT)
    const terrainY = surfaceYAt(worldZ, rotation)
    return deckY + (terrainY - deckY) * s
  }
  return -Infinity
}

/**
 * The height the WALKERS follow (girl, her shadow, the discovery badge): the
 * higher of the pure terrain and any bridge deck, so she rides the planks over
 * a river crossing and the meadow everywhere else. Prop anchors keep terrain.
 */
export function walkYAt(worldZ: number, rotation: number): number {
  return Math.max(surfaceYAt(worldZ, rotation), bridgeDeckYAt(worldZ, rotation))
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

/**
 * Parallel to anchorTransform but seats the prop on the LAP-2 terrain
 * (terrainBumpB) — used only by the lap-2 flank dressing. anchorTransform (the
 * chapter-set / bridge contract) is intentionally left untouched; the two agree
 * exactly on the spine band where terrainBumpB === terrainBump.
 */
export function anchorTransformB(
  theta: number,
  x: number
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
  const pre = dir.clone().multiplyScalar(PLANET_RADIUS)
  const bump = terrainBumpB(pre.x, pre.y, pre.z)
  const position = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
  return { position, quaternion }
}
