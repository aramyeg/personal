/**
 * The renewal-front gate — pure scalar math, ZERO imports. A leaf module so both
 * planet.ts (terrainBumpAt, surfaceYAt, the bucketed per-frame morph) and stage.ts
 * can share the gate without an import cycle: stage.ts imports planet's terrain
 * and would cycle if the gate lived there. stage.ts RE-EXPORTS everything here, so
 * `import { renewalGate } from './stage'` remains the public entry (tests + benches
 * import the pure math cheaply from either).
 *
 * The machine (Round 5): the one-shot lap-boundary world morph is replaced by a
 * per-vertex traveling flip. Each surface point flips its content once from
 * variant A (lap-1 spring) to variant B (lap-2 autumn→winter) as the planet turns
 * — and ALWAYS while it is provably occluded, so the girl only ever sees the
 * finished scene arrive over the horizon.
 */

// Primitive geometry constants. PLANET_RADIUS is owned by planet.ts; the value is
// duplicated here (not imported) to keep this a zero-import leaf — importing it
// from planet.ts would form planet→renewal→planet and crash on STANCE_ALPHA's
// eval-time use before planet finished initializing.
const PLANET_RADIUS = 2.2

/** Where the girl stands, in world z (mirrors STANCE_Z historically in stage). */
export const STANCE_Z = 0.75
/** The girl's angular offset from the planet apex, about the x axis. */
export const STANCE_ALPHA = Math.asin(STANCE_Z / PLANET_RADIUS)

const TWO_PI = Math.PI * 2
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/**
 * Flip window (in `rotation − thetaC`, radians). A vertex flips A→B as this offset
 * crosses [FLIP_START, FLIP_START + FLIP_WIDTH], which parks the transition at
 * world angle w = thetaC − rotation ∈ (−2.4, −1.4): the back-bottom, diametrically
 * opposite the 70° view axis. Proven by `.superpowers/sdd/bench/renewal-scan.mjs`
 * against the exact finite camera (dist 5.5·R, fov 38, 20° pitch) with realistic
 * relief + prop tips: the hidden `rotation − thetaC` band is (1.31, 2.53); this
 * window sits inside it with ~0.1 rad margin each side, at EVERY latitude nx.
 */
export const FLIP_START = 1.4
export const FLIP_WIDTH = 1.0

/**
 * Wrap a raw local angle (e.g. `atan2(nz, ny)` of a planet-LOCAL direction) into
 * the canonical vertex-theta range [STANCE_ALPHA, STANCE_ALPHA + 2π). The wrap
 * seam then coincides with the band-0 meridian under the girl, which today's
 * longitude-smooth content leaves content-free (Task 20 keeps a neutral band
 * there). Pure; 2π-consistent (any 2π-equivalent input maps to the same output).
 */
export function canonicalTheta(a: number): number {
  let t = a
  while (t < STANCE_ALPHA) t += TWO_PI
  while (t >= STANCE_ALPHA + TWO_PI) t -= TWO_PI
  return t
}

/**
 * A→B flip weight for a vertex at canonical `thetaC` under the unwrapped scroll
 * `rotation` ∈ [0, 4π]. Monotone in rotation, NO mod anywhere, so each vertex
 * flips exactly once across the two laps. Returns EXACTLY 0 before the window and
 * EXACTLY 1 after (smoothstep clamps), so wherever a vertex is on camera — hence
 * outside the window, by the bench — its content is a crisp variant, never a lerp.
 */
export function renewalGate(thetaC: number, rotation: number): number {
  return smoothstep((rotation - thetaC - FLIP_START) / FLIP_WIDTH)
}

/**
 * The active variant at a canonical `thetaC` under the current `rotation`:
 * 0 = A (spring), 1 = B (autumn). One shared 0.5 threshold so no consumer
 * (decks, prop toggles) hand-rolls the comparison.
 */
export function activeVariantAt(thetaC: number, rotation: number): 0 | 1 {
  return renewalGate(thetaC, rotation) >= 0.5 ? 1 : 0
}
