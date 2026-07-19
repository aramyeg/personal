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
  /** how much the streak domain is compressed ALONG the flow field (>1 elongates the
   *  ridged smears into flowing runs; only along `flowAlign`× the flow direction). */
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
  /** how much around-sphere swirl the drainage flow field carries (0 = straight
   *  poleward toward the left-ocean mouth, higher = more curved azimuthal flow). */
  flowStrength: number
  /** how strongly the streak domain is aligned to the flow field [0..1] (0 = isotropic
   *  daubs, 1 = fully flow-aligned smears). Round-9 (Task 32): the streak COLOUR runs
   *  along the flow so the daubs read as tool-dragged flowing runs. */
  flowAlign: number
}

/** Capture-gated shipped defaults (planet.tsx / tunables read these; the panel tunes
 *  live). `reliefOutward` 0.01 < 0.4×0.03 = 0.012, so it is under the hard cap.
 *  `pocketTint` 0.8 is Aram's kept value; flow defaults give clearly flow-aligned daubs
 *  out of the box. */
export const WATER_DEFAULTS: WaterParams = {
  pathWarp: 0.9,
  pathStretch: 2.5,
  pathDepth: 0.014,
  pocketTint: 0.8,
  reliefInward: 0.04,
  reliefOutward: 0.01,
  ridgeSharp: 1.4,
  octaves: 4,
  normalRough: 0.42,
  flowStrength: 0.4,
  flowAlign: 0.85,
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
// so genart relief lives only where the water is comfortably deep. This is the
// "shoreline feather" the brief keeps: relief → 0 at any shore ⇒ the water never
// crests the waterline where it meets land, by construction.
const DEEP_LO = 0.03
const DEEP_HI = 0.07

// Deck-footprint gate bands (Task 32). A bridge deck spans ±(DECK_HALF+DECK_RAMP)=±0.17
// rad of its crossing longitude and the girl's lane band (|nx|≲0.12). Round-9 REPLACES
// the old blanket lane gate (which zeroed relief across the WHOLE equatorial band and so
// smoothed every mid-face sea Aram couldn't judge) with a gate that zeroes relief ONLY
// under those deck footprints — so inter-crossing channels, mid-face seas and the delta
// now take the full clay relief, while every deck still sits over the proven v1 molded
// water. Windows are sized with margin past the physical deck span (0.17 → 0.20 in θ,
// 0.12 → 0.14 in nx) so the clearance proof holds; the bench re-derives it numerically.
const DECK_THETA_IN = 0.2 // fully blocked within this |Δθ| of any crossing longitude
const DECK_THETA_OUT = 0.34 // feathered to fully open by here
const LANE_NX_IN = 0.14 // fully blocked within this |nx| (the girl's lane)
const LANE_NX_OUT = 0.28 // feathered to fully open by here

const TWO_PI = Math.PI * 2

/** The outward crest amplitude actually used — hard-capped at 0.4× the inward budget
 *  regardless of how the two dials are set (the brief's ≤0.4× rule, enforced in code,
 *  not merely by slider maxima). */
export function effectiveOutward(p: WaterParams): number {
  return Math.min(p.reliefOutward, 0.4 * p.reliefInward)
}

/** Absolute peak OUTWARD relief across the whole dial space (for the ceiling/shoreline
 *  reasoning): max reliefOutward is 0.04 and max 0.4×reliefInward is 0.4×0.10 = 0.04. */
export const WATER_OUTWARD_CEIL = 0.04

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

/** Smallest wrapped angular gap between a longitude `theta` and a crossing `cx` (rad). */
function thetaGap(theta: number, cx: number): number {
  let d = Math.abs(theta - cx) % TWO_PI
  if (d > Math.PI) d = TWO_PI - d
  return d
}

/**
 * Deck-footprint relief gate [0,1] (Task 32, replaces waterLaneClear): 0 EXACTLY under a
 * bridge deck (near a crossing longitude AND in the girl's lane band), 1 everywhere else.
 * So mid-face seas, inter-crossing channels and the delta take the full clay relief while
 * every deck still sits over the proven v1 molded water. `crossings` is the UNION of both
 * variants' crossings, so the single shared, variant-independent water geometry keeps its
 * deck clearance on BOTH laps. Pure; the bench (scan-task31) re-derives clearance from it.
 */
export function waterFootprintClear(
  nx: number,
  theta: number,
  crossings: readonly number[]
): number {
  // 1 inside the lane band, 0 off it.
  const inLane = 1 - smoothstep01((Math.abs(nx) - LANE_NX_IN) / (LANE_NX_OUT - LANE_NX_IN))
  if (inLane <= 0) return 1
  // 1 near ANY crossing longitude, 0 well away from all of them.
  let nearDeck = 0
  for (let i = 0; i < crossings.length; i++) {
    const near = 1 - smoothstep01((thetaGap(theta, crossings[i]) - DECK_THETA_IN) / (DECK_THETA_OUT - DECK_THETA_IN))
    if (near > nearDeck) nearDeck = near
    if (nearDeck >= 1) break
  }
  return 1 - inLane * nearDeck
}

/**
 * The authored tangential FLOW field at a unit direction (Task 32): a unit tangent
 * pointing toward the nearest drainage target — the LEFT-ocean pole at −x (every channel
 * mouth drains there) — blended with a gentle around-sphere (azimuthal) swirl. The streak
 * domain is compressed along this so the colour daubs line up in flowing runs, mimicking
 * the tool-drag Aram asked for. Deterministic, variant/rotation-independent. Returns
 * [0,0,0] at the poles where the tangent frame degenerates (no preferred flow).
 */
export function waterFlowDir(
  nx: number,
  ny: number,
  nz: number,
  flowStrength: number
): [number, number, number] {
  // Poleward drainage toward −x: projection of −x̂ onto the tangent plane at n,
  // −x̂ − (−x̂·n) n = (−1 + nx², nx·ny, nx·nz).
  const dx = -1 + nx * nx
  const dy = nx * ny
  const dz = nx * nz
  // Gentle around-sphere swirl (azimuthal about the spin x-axis): ∂/∂θ of
  // (nx, ring·cosθ, ring·sinθ) ∝ (0, −nz, ny).
  const fx = dx + flowStrength * 0
  const fy = dy + flowStrength * -nz
  const fz = dz + flowStrength * ny
  const l = Math.hypot(fx, fy, fz)
  if (l < 1e-6) return [0, 0, 0]
  return [fx / l, fy / l, fz / l]
}

/**
 * The streak-path field [0,1] at a unit direction: a domain-warped ridged fBm whose
 * domain is compressed ALONG the flow field (Task 32) so ridges elongate into flowing,
 * tool-dragged smears that follow the drainage — not round blobs and not fixed-axis
 * streaks. `flowAlign` blends from isotropic (0) to fully flow-aligned (1); `pathStretch`
 * sets how long the smears run. High values ARE the drag grooves (darkened + carved a
 * touch deeper). Pure, variant-independent.
 */
export function waterStreak(nx: number, ny: number, nz: number, p: WaterParams): number {
  const stretch = p.pathStretch > 0.001 ? p.pathStretch : 1
  // Sample the noise in a domain STRETCHED along the flow: compress the base grid's
  // along-flow component by (1 − 1/stretch)·flowAlign so features run LONG along the flow
  // (slower traversal along f ⇒ elongated), then marble it with the domain warp. Warping
  // the already-stretched grid keeps the smears riding the flow instead of isotropizing
  // it. flowAlign 0 = isotropic daubs, 1 = fully flow-aligned smears.
  let sx = nx * PATH_FREQ
  let sy = ny * PATH_FREQ
  let sz = nz * PATH_FREQ
  const comp = (1 - 1 / stretch) * clamp01(p.flowAlign)
  if (comp > 0) {
    const [fx, fy, fz] = waterFlowDir(nx, ny, nz, p.flowStrength)
    if (fx !== 0 || fy !== 0 || fz !== 0) {
      const dot = sx * fx + sy * fy + sz * fz
      sx -= comp * dot * fx
      sy -= comp * dot * fy
      sz -= comp * dot * fz
    }
  }
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
