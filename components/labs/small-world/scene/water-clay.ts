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
  /** Round-9 (Task 33) render-only water-altitude rise as a fraction of PLANET_RADIUS,
   *  added to the RENDER sphere radius on top of WATER_LEVEL (0 = today's recessed look;
   *  MAX lifts the slab flush-to-proud of the shore). NOT part of the pure unit-direction
   *  fields (streak/relief/flow are all altitude-independent) — the water bake reads it to
   *  size the base sphere. The geography classifier WATER_LEVEL is untouched. */
  waterRise: number
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
  waterRise: 0,
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

// --- Icy winter lake (Task 40) ----------------------------------------------
//
// Aram: "let's make the small lake on the winter terrain be icy." The winter (B2)
// wedge's pond reads as SOLID PALE ICE instead of liquid: a pale blue-white sheet,
// FLATTENED relief (the molded clay lumps pressed out so it sits as a glassy sheet at
// the waterline), sparse pressed CRACK veins and a SNOW-DUSTED rim where the ice meets
// the bank.
//
// FOOTPRINT: the winter wedge has two water bodies besides the left ocean —
// biomes.B2_FROZEN (a tiny shallow pond, dir place(0.34, 5.55) r0.14) and biomes.B2_SHELF
// (the larger shelf sea, dir place(0.6, 5.72) r0.28, whose own biomes comment calls it
// "the frozen sea" and on which the delights.tsx B2 ice-floe props actually sit). The
// visible "winter lake" a viewer sees is B2_SHELF; B2_FROZEN is nearly hidden under the
// snow relief. So the ice footprint is the UNION of both B2 caps — the whole winter
// pond region — and EXACTLY 0 elsewhere: 0 outside those caps, 0 at every bridge deck
// (both caps sit off the girl's lane), 0 on the left ocean (nx<0), and 0 at the tide
// limb (both caps end by |nx|≈0.80 = TIDE_LAT_LO, so the rotation-driven flood ring is
// never frozen). Pure + deterministic (seeded clay-noise); the geometry is variant-
// INDEPENDENT (the shared sphere) and the render applies the ice COLOUR only to the
// variant-B water bake, so the A-variant longitude keeps its look (the A/B flip is
// hidden by the same renewal paint pass as all wedge paint — both ponds are already
// water-morph cells there).

const clampU = (t: number): number => (t < -1 ? -1 : t > 1 ? 1 : t)

/** Unit direction at latitude nx and longitude theta (mirrors biomes.place — kept
 *  local so water-clay stays a dependency-light leaf; biomes never imports this file). */
function iceDir(nx: number, theta: number): [number, number, number] {
  const ring = Math.sqrt(Math.max(0, 1 - nx * nx))
  return [nx, ring * Math.cos(theta), ring * Math.sin(theta)]
}

type IceCap = { dir: readonly [number, number, number]; radius: number; feather: number }
/** The two B2 winter water caps, DUPLICATED from biomes.B2_FROZEN / biomes.B2_SHELF.
 *  biomes never imports this module, so they are kept literal here and pinned against
 *  the live biomes ponds in the water-clay test (via waterMask at each centre). T41 does
 *  not touch B2, so these stay in sync; if a pond ever moves, update both. */
const ICE_CAPS: readonly IceCap[] = [
  { dir: iceDir(0.34, 5.55), radius: 0.14, feather: 0.1 }, // B2_FROZEN — small shallow pond
  { dir: iceDir(0.6, 5.72), radius: 0.28, feather: 0.13 }, // B2_SHELF  — the visible frozen sea
]

/** Feathered 0..1 membership of one cap: 1 in the core, EXACTLY 0 at/beyond its radius. */
function iceCapMask(nx: number, ny: number, nz: number, cap: IceCap): number {
  const dot = clampU(nx * cap.dir[0] + ny * cap.dir[1] + nz * cap.dir[2])
  const d = Math.acos(dot)
  return smoothstep01((cap.radius - d) / cap.feather)
}

/**
 * Hard 0..1 membership of the winter pond region (the UNION of the two B2 caps): 1 in a
 * pond core, ramping to EXACTLY 0 beyond both cap radii — so it is 0 everywhere outside
 * the winter ponds and, because both caps sit off the girl's lane, off the left ocean and
 * below the tide limb, 0 at every bridge deck / the flooded limb / the ocean. THE ice
 * footprint mask: all ice treatment (colour + relief flatten) is multiplied by it, so the
 * ice is exactly contained. Pure. */
export function iceFootprint(nx: number, ny: number, nz: number): number {
  let m = 0
  for (let i = 0; i < ICE_CAPS.length; i++) {
    const v = iceCapMask(nx, ny, nz, ICE_CAPS[i])
    if (v > m) m = v
  }
  return m
}

/** 0..1 snow-dust weight for the pond RIM (where the ice meets the bank): derived from
 *  the footprint mask itself so it works for either cap — 0 in a pond core, rising across
 *  the feathered edge, 0 outside the footprint. Pure. */
export function iceRim(nx: number, ny: number, nz: number): number {
  const m = iceFootprint(nx, ny, nz)
  if (m <= 0) return 0
  return smoothstep01((m - 0.06) / 0.3) * (1 - smoothstep01((m - 0.5) / 0.4))
}

const ICE_CRACK_FREQ = 8.5
const ICE_CRACK_SHARP = 3.2
const ICE_CRACK_THRESH = 0.86
/** 0..1 sparse pressed CRACK veins across the ice: a seeded ridged clay-noise whose
 *  thin, sharp ridge crests (past ICE_CRACK_THRESH) become dark vein lines. Not
 *  footprint-gated itself — the caller multiplies by iceFootprint so cracks live only
 *  on the pond. Deterministic, variant-independent. */
export function iceCrack(nx: number, ny: number, nz: number): number {
  const r = ridged3(PERM, nx * ICE_CRACK_FREQ, ny * ICE_CRACK_FREQ, nz * ICE_CRACK_FREQ, 2, LACUNARITY, GAIN, ICE_CRACK_SHARP)
  return smoothstep01((r - ICE_CRACK_THRESH) / (1 - ICE_CRACK_THRESH))
}

/** How strongly the ice sheet flattens the molded-clay water lumps within the footprint
 *  (the render multiplies the molded inward push by (1 − ICE_FLATTEN·footprint·iceAmount)).
 *  Just under 1 so a faint clay swell survives — claymation ice, not glass. Flattening
 *  only ever RAISES the surface toward the waterline (never above it), so the shoreline
 *  contract is untouched. */
export const ICE_FLATTEN = 0.9
