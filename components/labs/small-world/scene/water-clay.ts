/**
 * water-clay.ts — Task 31 (Round 9). The clay-water genart composition, built on the
 * pure noise kit (clay-noise.ts). Aram's worked example for clay-ness was WATER:
 * "some random rougher paths, deeper colors, elevation of the material and non
 * smootheness" — and he invited Perlin techniques. This module turns that into four
 * pure, deterministic, dial-driven channels the water bake reads:
 *
 *  1. STREAK PATHS  — a domain-warped, anisotropically-stretched ridged-fBm field
 *     (`waterStreak`): elongated tool-dragged smears, not ripple dots. Drives both a
 *     colour darkening (deeper blue in the drag grooves) and a small extra carve.
 *  2. DEEPER COLOURS — the streak field + depth push pockets/troughs toward ink
 *     (applied in planet.tsx paintDepth, layered OVER the existing depth/abyss/deck/
 *     tide tints — those still win; this only deepens).
 *  3. ELEVATION     — multi-octave RIDGED-fBm relief (`waterRelief`): inward-dominant
 *     pressed troughs with a SMALL outward crest allowance, hard-capped at 0.4× the
 *     inward budget and gated to DEEP water away from the lane so the shoreline
 *     contract (water never above WATER_LEVEL where it meets land) and every bridge
 *     deck clearance hold by construction — near shore/lane the water stays exactly
 *     the proven v1 molded sheet (relief → 0).
 *  4. NON-SMOOTHNESS — a per-face normal tilt (`waterNormalTilt`) so the toon bands
 *     break across the water surface (normals only — no contact term).
 *
 * INVARIANCE: every geometry channel here is a function of the UNIT DIRECTION only
 * (never rotation/time), so water positions stay static per tunable state and
 * variant-INDEPENDENT — the deep-gate reads the MIN depth across both terrain bakes,
 * so a single shared water geometry satisfies the shoreline contract on BOTH laps.
 *
 * Imports only clay-noise (Vitest/Next resolve the chain). The raw-Node bench
 * (scan-task31.mjs) PORTS this math inline — the established bench discipline.
 */
import { makePermutation, ridged3, domainWarp3, perlin3 } from './clay-noise'

/** Duplicated from biomes.WATER_LEVEL (kept dependency-light — biomes never imports
 *  this module, so there is no cycle; the value is pinned by the tunables test's peer
 *  and by scan-task31). */
const WATER_LEVEL = 0.972

/** One fixed seed for the whole water field — the look is tuned by the dials, never by
 *  reseeding, so a given dial state is fully reproducible (bench + both bakes agree). */
const PERM = makePermutation(1337)

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smoothstep01 = (t: number): number => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Every live-tunable clay-water parameter (the "water" dial group). */
export type WaterParams = {
  /** domain-warp strength k for the streak paths (0 = straight, higher = more drag). */
  pathWarp: number
  /** how much the streak domain is stretched along flow (>1 elongates smears). */
  pathStretch: number
  /** extra inward carve along the streak grooves (fraction of WATER_LEVEL radius). */
  pathDepth: number
  /** how hard the pockets/grooves push the colour toward ink [0..1]. */
  pocketTint: number
  /** ridged-relief INWARD amplitude budget (fraction of WATER_LEVEL radius). */
  reliefInward: number
  /** ridged-relief OUTWARD crest allowance — HARD-CAPPED at 0.4× reliefInward. */
  reliefOutward: number
  /** ridge crest sharpness exponent (higher = pinched crests). */
  ridgeSharp: number
  /** ridged-relief octave count (integer 1..6). */
  octaves: number
  /** per-face normal tilt amplitude — facet-scale non-smoothness. */
  normalRough: number
}

/** Capture-gated shipped defaults (planet.tsx / tunables read these; the panel tunes
 *  live). `reliefOutward` 0.007 < 0.4×0.02 = 0.008, so it is under the hard cap. */
export const WATER_DEFAULTS: WaterParams = {
  pathWarp: 0.9,
  pathStretch: 2.5,
  pathDepth: 0.014,
  pocketTint: 0.5,
  reliefInward: 0.03,
  reliefOutward: 0.01,
  ridgeSharp: 1.4,
  octaves: 4,
  normalRough: 0.32,
}

// Field frequencies over the UNIT sphere (tuned so relief reads as ~10–20 broad
// pressed lobes and streaks as long dragged smears, not high-frequency fizz).
const RELIEF_FREQ = 3.2
const PATH_FREQ = 2.4
const LACUNARITY = 2.0
const GAIN = 0.5
const STREAK_OCTAVES = 4
const STREAK_SHARP = 1.4

// Deep-water gate band (terrain depth below the waterline, as a radius fraction).
// 0 until terrain is DEEP_LO below the surface (shore/shallow), full by DEEP_HI —
// so genart relief lives only where the water is comfortably deep.
const DEEP_LO = 0.03
const DEEP_HI = 0.07

// Lane clear band (|nx|): relief is 0 on the girl's lane (|nx| < 0.15) so every bridge
// deck sits over the proven v1 molded water; fades in to full by |nx| = 0.30.
const LANE_LO = 0.15
const LANE_HI = 0.3

/** The outward crest amplitude actually used — hard-capped at 0.4× the inward budget
 *  regardless of how the two dials are set (the brief's ≤0.4× rule, enforced in code,
 *  not merely by slider maxima). */
export function effectiveOutward(p: WaterParams): number {
  return Math.min(p.reliefOutward, 0.4 * p.reliefInward)
}

/** Absolute peak OUTWARD relief across the whole dial space (for the ceiling/shoreline
 *  reasoning): max reliefOutward is 0.02 and max 0.4×reliefInward is 0.4×0.05 = 0.02. */
export const WATER_OUTWARD_CEIL = 0.02

/**
 * Deep-water gate [0,1] from BOTH variant terrain bumps. Uses the SHALLOWER of the two
 * (min depth) so the single shared water geometry stays below the waterline wherever
 * EITHER lap has land near the surface — the shoreline contract then holds on both laps
 * with one variant-independent position buffer. 0 at any shore, 1 in deep water.
 */
export function waterDeepGate(bumpA: number, bumpB: number): number {
  const depthA = WATER_LEVEL - (1 + bumpA) // >0 ⇒ terrain below the waterline
  const depthB = WATER_LEVEL - (1 + bumpB)
  const minDepth = depthA < depthB ? depthA : depthB
  return smoothstep01((minDepth - DEEP_LO) / (DEEP_HI - DEEP_LO))
}

/** Lane-clear gate [0,1]: 0 on the girl's lane, 1 off it — keeps relief away from the
 *  bridge decks so their clearance is unchanged from the proven v1 water. */
export function waterLaneClear(nx: number): number {
  return smoothstep01((Math.abs(nx) - LANE_LO) / (LANE_HI - LANE_LO))
}

/**
 * The streak-path field [0,1] at a unit direction: a domain-warped ridged fBm whose
 * domain is stretched along the tangential (y,z) plane so ridges elongate into dragged
 * smears. High values ARE the drag grooves (darkened + carved a touch deeper). Pure,
 * variant-independent.
 */
export function waterStreak(nx: number, ny: number, nz: number, p: WaterParams): number {
  // Stretch: sample the tangential axes at LOWER frequency (÷ pathStretch) so features
  // run long across them — elongated smears rather than round blobs.
  const stretch = p.pathStretch > 0.001 ? p.pathStretch : 1
  const sx = nx * PATH_FREQ
  const sy = (ny * PATH_FREQ) / stretch
  const sz = (nz * PATH_FREQ) / stretch
  const [wx, wy, wz] = domainWarp3(PERM, sx, sy, sz, p.pathWarp)
  return ridged3(PERM, wx, wy, wz, STREAK_OCTAVES, LACUNARITY, GAIN, STREAK_SHARP)
}

/**
 * Signed radial relief (fraction of the WATER_LEVEL radius) at a unit direction, given
 * the precomputed `gate` = waterDeepGate·waterLaneClear and the streak value. Ridged
 * fBm crests bulge slightly OUTWARD (≤ effectiveOutward) while the troughs between them
 * — plus the streak grooves — carve INWARD (up to reliefInward + pathDepth). Multiplied
 * by `gate`, so it is exactly 0 near any shore or the lane (⇒ water = the v1 molded
 * sheet there, and never crests the waterline where it meets land). Never rotation/time
 * dependent. Positive = outward, negative = inward.
 */
export function waterRelief(
  nx: number,
  ny: number,
  nz: number,
  gate: number,
  streak: number,
  p: WaterParams
): number {
  if (gate <= 0) return 0
  const oct = p.octaves < 1 ? 1 : Math.round(p.octaves)
  const r = ridged3(PERM, nx * RELIEF_FREQ, ny * RELIEF_FREQ, nz * RELIEF_FREQ, oct, LACUNARITY, GAIN, p.ridgeSharp)
  const outward = effectiveOutward(p) * r
  const inward = p.reliefInward * (1 - r) + p.pathDepth * streak
  return gate * (outward - inward)
}

/**
 * A per-FACE normal tilt vector (facet-scale non-smoothness), from three decorrelated
 * Perlin fields at the face centroid scaled by `amp`. Added to a face's flat normal
 * (same vector on all three verts, so the facet stays flat) and renormalized — the toon
 * ramp then band-splits across the water like tool-worked clay. Normals only.
 */
export function waterNormalTilt(cx: number, cy: number, cz: number, amp: number): [number, number, number] {
  if (amp <= 0) return [0, 0, 0]
  const f = 7.0
  const dx = amp * perlin3(PERM, cx * f + 2.1, cy * f - 1.3, cz * f + 4.7)
  const dy = amp * perlin3(PERM, cx * f + 8.3, cy * f + 5.9, cz * f - 2.2)
  const dz = amp * perlin3(PERM, cx * f - 3.7, cy * f + 1.1, cz * f + 6.4)
  return [dx, dy, dz]
}
