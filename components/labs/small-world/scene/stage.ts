import * as THREE from 'three'
import { CHAPTER_SLICE, chapterStartRotation } from '../journey-timeline'
import { PLANET_RADIUS, surfaceYAt, terrainBump, terrainBumpB } from './planet'
import { CROSSINGS_A, B_CROSSING_BY_BAND } from './biomes'
import { STANCE_ALPHA, activeVariantAt, canonicalTheta } from './renewal'

// The renewal gate is the single source of the A/B flip. It lives in the leaf
// renewal.ts (planet.ts needs it too, and stage.ts imports planet — a cycle if it
// lived here); re-exported so `from './stage'` stays the public entry.
export {
  STANCE_Z,
  STANCE_ALPHA,
  FLIP_START,
  FLIP_WIDTH,
  canonicalTheta,
  renewalGate,
  activeVariantAt,
} from './renewal'

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
 * river carves ~RIVER_DEPTH·R below the meadow, so this lifts the deck back to
 * ground level plus a plank thickness. Matched by ClayBridge's plank offset (it
 * reads DECK_RISE) so the girl's feet land on the planks; tuned by capture.
 *
 * Task 33 (Round-9 water altitude): raised 0.13 → 0.16 to buy headroom for the
 * render water-altitude dial (waterRise). At MAX rise (0.008·R ≈ 0.0176 world) the
 * water climbs under every deck, so the decks — and the girl who rides them — lift
 * with it. Re-derived so the tightest deck (B1) keeps a healthy clearance over the
 * risen + max-roughness water (scan-task33 / scan-task31). This is a deliberate
 * ground-truth change to walkYAt's deck heights (the girl rides ~0.03 world higher
 * on every bridge); the stage.test deck pins are relational (Task 20) and hold unchanged.
 */
export const DECK_RISE = 0.16

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
  for (let i = 0; i < CROSSINGS_A.length; i++) {
    // The deck present at a crossing is the one whose variant is active there:
    // renewalGate > 0.5 ⇒ B list live, else A. Carve depth samples the matching
    // variant's terrain. Task 46: band 0's B variant (the desert) has NO crossing
    // (B_CROSSING_BY_BAND[0] === null) — the girl walks continuous dry sand there, so
    // skip it and let walkYAt fall through to the terrain (bridgeDeckYAt returns -Inf).
    const variant = activeVariantAt(canonicalTheta(CROSSINGS_A[i]), rotation)
    const tc = variant === 1 ? B_CROSSING_BY_BAND[i] : CROSSINGS_A[i]
    if (tc === null) continue
    const gap = angularGap(theta, tc)
    if (gap > DECK_HALF + DECK_RAMP) continue
    const cy = PLANET_RADIUS * Math.cos(tc)
    const cz = PLANET_RADIUS * Math.sin(tc)
    const bumpFn = variant === 1 ? terrainBumpB : terrainBump
    const carvedR = PLANET_RADIUS * (1 + bumpFn(0, cy, cz))
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
 *
 * Variant selection (folds in the old anchorTransformB): chapters 3–5 pass an
 * UNWRAPPED chapterTheta ≥ 2π, so they seat on the lap-2 terrain (B); chapters
 * 0–2 (< 2π) seat on A. A caller may force a variant (the lap-2 flank dressing
 * passes 1). On the spine band terrainBumpB === terrainBump, so chapters 0–2 seat
 * byte-identically to today regardless of which branch is taken.
 */
export function anchorTransform(
  theta: number,
  x: number,
  variant?: 0 | 1
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const isB = variant !== undefined ? variant === 1 : theta >= Math.PI * 2
  const bumpFn = isB ? terrainBumpB : terrainBump
  const xN = THREE.MathUtils.clamp(x / PLANET_RADIUS, -0.95, 0.95)
  const ring = Math.sqrt(1 - xN * xN)
  const dir = new THREE.Vector3(xN, ring * Math.cos(theta), ring * Math.sin(theta))
  const pre = dir.clone().multiplyScalar(PLANET_RADIUS)
  const bump = bumpFn(pre.x, pre.y, pre.z)
  const position = dir.clone().multiplyScalar(PLANET_RADIUS * (1 + bump))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
  return { position, quaternion }
}
