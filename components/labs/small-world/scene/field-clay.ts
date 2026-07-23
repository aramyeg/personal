/**
 * Task 29 — "thumbiness": field imperfections that make the open ground read as
 * pressed clay, not smooth CG plastic. Two channels, per the clay research
 * (docs/superpowers/research/2026-07-18-clay-look-research.md):
 *
 *  - COLOUR mottling (the unquantized channel — the 4-step ramp quantizes LIGHT
 *    then multiplies albedo, so vertex-colour variance survives at any frequency):
 *    multi-scale value drift + deeper-hue pockets + drier "high-touch" smudges +
 *    sparse marbling veins + rare grime specks. All palette-derived lerps.
 *  - Field press-DENTS (render-only displacement): shallow inward oval hollows on
 *    OPEN off-lane ground, gated EXACTLY 0 on the girl's lane band (same discipline
 *    as claySignature) so the spine contact budget never moves.
 *
 * Every function is a pure hash/sine of the UNIT direction, so both renewal bakes
 * (A and B) agree byte-for-byte and the front lerp stays seamless.
 */
import * as THREE from 'three'
import { DIALS } from './tunables'
import { makePermutation, ridged3, domainWarp3 } from './clay-noise'

/** The planet colour palette the bake feeds in (built once in planet.tsx). */
export type Pal = {
  leaf: THREE.Color; meadow: THREE.Color; sprout: THREE.Color; clay: THREE.Color
  deep: THREE.Color; honey: THREE.Color; snow: THREE.Color; earth: THREE.Color
  pine: THREE.Color; dune: THREE.Color; blossom: THREE.Color; blossomDeep: THREE.Color
  springGreen: THREE.Color; petal: THREE.Color; sand: THREE.Color; goldSand: THREE.Color
  earthDeep: THREE.Color; rust: THREE.Color; ice: THREE.Color; tuff: THREE.Color
  foliageDeep: THREE.Color; pineDeep: THREE.Color; meadowDry: THREE.Color
  jungleFloor: THREE.Color; jungleDeep: THREE.Color; jungleMoss: THREE.Color
}

/** Degenerate flow (a pole, or the flow field disabled) — no directional streak. */
const ZERO_FLOW: readonly [number, number, number] = [0, 0, 0]

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const smooth = (x: number, lo: number, hi: number): number => {
  const t = clamp01((x - lo) / (hi - lo))
  return t * t * (3 - 2 * t)
}

/**
 * Shallow oval press-dents on OPEN off-lane fields (inward-only). Two anisotropic
 * product-noise pocket sets (~3–5% of the planet diameter across) give the "thumb
 * pressed into a ping-pong ball" read where no authored feature owns the ground.
 *  - `lat` is EXACTLY 0 for |nx| < 0.14 (identical gate to claySignature), so this
 *    adds NO spine-band render term — the contact budget (0.01247R vs 0.0128R) is
 *    unchanged and the analytic bound survives.
 *  - `open` fades the dents out as relief rises (a feature already carries its own
 *    signature there), so dents live only on the quiet fields Aram flagged.
 * Depth is DIALS.dentDepth (default FIELD_DENT_DEPTH), and it only ever REMOVES radius,
 * so the 1.35R ceiling can only drop. Pure function of direction + the variant's bump.
 */
/** Pinned default of the press-dent depth dial (DIALS.dentDepth). Round-9: Aram likes the
 *  higher settings, so the shipped default is baked up from 0.012. The value here is only
 *  the cross-pin for the tunables test; fieldDents reads the LIVE DIALS.dentDepth.value. */
export const FIELD_DENT_DEPTH = 0.0375
export function fieldDents(nx: number, ny: number, nz: number, bump: number): number {
  const lat = smooth(Math.abs(nx), 0.14, 0.24)
  if (lat <= 0) return 0
  const open = 1 - smooth(bump, 0.05, 0.12)
  if (open <= 0) return 0
  const p = Math.sin(11.3 * nx + 0.4) * Math.sin(14.9 * ny - 1.1) * Math.sin(12.1 * nz + 2.0)
  const dentA = smooth(p, 0.45, 0.85)
  const q = Math.sin(7.1 * ny + 2.3) * Math.sin(6.7 * nz - 0.6) * Math.sin(7.7 * nx + 1.4)
  const dentB = smooth(q, 0.6, 0.95)
  const dent = clamp01(dentA + 0.6 * dentB)
  return -DIALS.dentDepth.value * dent * open * lat
}

const _deep = new THREE.Color()
const _dry = new THREE.Color()
const _flow = new THREE.Color()

// Task 33 — TERRAIN flow streak. Reuses the water clay-noise vocabulary (clay-noise.ts):
// a domain-warped ridged field sampled in a domain COMPRESSED along the terrain flow, so
// the deepened streaks elongate into tool-dragged flowing runs down the slope/drainage.
// One fixed seed (distinct from the water's 1337) so both renewal bakes + the bench agree.
const FPERM = makePermutation(7919)
const F_FREQ = 3.0
const F_STRETCH = 4.0 // how long the streaks run along the flow (matches the water feel)
const F_WARP = 0.7
const F_OCT = 4
const F_LAC = 2.0
const F_GAIN = 0.5
const F_SHARP = 1.3

/**
 * The flow-aligned streak field [0,1] at a unit direction, given the authored terrain
 * flow unit tangent `flow` (downslope blended with the poleward/swirl drainage — computed
 * by the caller, which has the terrain gradient) and `flowAlign` [0,1]. The base grid is
 * compressed by (1−1/F_STRETCH)·flowAlign along `flow` so ridges run LONG along the flow,
 * then domain-warped into marbled smears. flowAlign 0 (or a degenerate [0,0,0] flow at a
 * pole) ⇒ isotropic (no directional bias). Pure, variant-independent.
 */
export function terrainStreak(
  nx: number,
  ny: number,
  nz: number,
  flow: readonly [number, number, number],
  flowAlign: number
): number {
  let sx = nx * F_FREQ
  let sy = ny * F_FREQ
  let sz = nz * F_FREQ
  const comp = (1 - 1 / F_STRETCH) * clamp01(flowAlign)
  const [fx, fy, fz] = flow
  if (comp > 0 && (fx !== 0 || fy !== 0 || fz !== 0)) {
    const dot = sx * fx + sy * fy + sz * fz
    sx -= comp * dot * fx
    sy -= comp * dot * fy
    sz -= comp * dot * fz
  }
  const [wx, wy, wz] = domainWarp3(FPERM, sx, sy, sz, F_WARP)
  return ridged3(FPERM, wx, wy, wz, F_OCT, F_LAC, F_GAIN, F_SHARP)
}

/**
 * Multi-scale colour mottling for one already-painted field vertex. `kind` is the
 * biomeTint class; `bump` the local relief. Mutates `c` in place (bake-loop hot
 * path, matches the existing scratch-colour convention).
 *
 * The pocket/smudge targets are chosen from the CURRENT colour's own character so
 * a green field deepens to green, a gold dune deepens to gold — "variance within a
 * colour", never a foreign hue. Greenish meadow (the motivating ch-1 field) also
 * gets the richer deep-foliage pockets, drier sage smudges, sparse veins + grime.
 * Canyon strata already carry their variance, so it takes only the value drift.
 */
export function applyFieldMottle(
  c: THREE.Color,
  pal: Pal,
  kind: 'underwater' | 'beach' | 'canyon' | 'snow' | 'meadow',
  nx: number,
  ny: number,
  nz: number,
  flow: readonly [number, number, number] = ZERO_FLOW
): void {
  if (kind === 'underwater') return
  // Task 33 — flow-aligned streak deepening (extended from the water's Task-32 lever onto
  // the land). Sample the flow-stretched ridged field and darken toward a deeper shade of
  // the CURRENT colour along the flow, so the ground reads as clay dragged downslope. Its
  // magnitude REUSES the mottle saturation amp (turning mottle down shrinks the streak);
  // its anisotropy is DIALS.terrainFlowAlign. Feathered to EXACTLY 0 on the girl's lane
  // (|nx| < 0.14) so her path never stripes; colour-only, no displacement.
  const flowAlign = DIALS.terrainFlowAlign.value
  if (flowAlign > 0 && (flow[0] !== 0 || flow[1] !== 0 || flow[2] !== 0)) {
    const laneG = smooth(Math.abs(nx), 0.14, 0.24)
    if (laneG > 0) {
      const streak = terrainStreak(nx, ny, nz, flow, flowAlign)
      // deepen where the streak is strong (ridge crest = 1); ease it in so faint field
      // stays clean. Amount = mottle saturation × alignment × lane feather × streak.
      const amt = DIALS.mottleSaturation.value * flowAlign * laneG * smooth(streak, 0.35, 0.9)
      if (amt > 0) {
        _flow.copy(c).multiplyScalar(0.78)
        c.lerp(_flow, amt)
      }
    }
  }
  const coarse =
    Math.sin(4.7 * nx + 1.3) * Math.sin(5.1 * ny - 0.7) * Math.sin(4.3 * nz + 2.1)
  const fine =
    Math.sin(11.9 * ny + 0.4) * Math.sin(12.7 * nz - 1.9) * Math.sin(10.3 * nx + 0.8)
  // gentle value drift within the colour (pastel: canyon quieter, it is already tinted).
  // Two independent amplitudes (macro = coarse scale, micro = fine); the default pair
  // 0.035/0.015 reproduces the legacy 0.05·(0.7·coarse + 0.3·fine). Canyon keeps its
  // 0.6 ratio (0.03 vs 0.05) so it stays the quieter, already-tinted read.
  const canyonK = kind === 'canyon' ? 0.6 : 1
  c.multiplyScalar(1 + canyonK * (DIALS.mottleMacro.value * coarse + DIALS.mottleMicro.value * fine))
  if (kind === 'canyon') return

  // Green-field marbling (deep-foliage pockets, sage smudges, pine veins, grime) applies
  // only where the current colour actually reads green (each side of a hard boundary
  // marbles per its own accent — a gold dune never gets green veins).
  const greenish = c.g > c.r * 1.02 && c.g > c.b * 1.02
  // deeper-hue pockets (Aram's "some parts deeper green")
  const pocket = smooth(-coarse, 0.25, 0.75)
  if (pocket > 0) {
    if (greenish) c.lerp(pal.foliageDeep, DIALS.mottleSaturation.value * pocket)
    else {
      _deep.copy(c).multiplyScalar(0.8)
      c.lerp(_deep, 0.6 * pocket)
    }
  }
  // drier "high-touch" smudges
  const smudge = smooth(fine, 0.5, 0.92)
  if (smudge > 0) {
    if (greenish) c.lerp(pal.meadowDry, 0.14 * smudge)
    else {
      _dry.copy(c).multiplyScalar(1.07)
      c.lerp(_dry, 0.5 * smudge)
    }
  }
  if (!greenish) return
  // sparse marbling veins (thin adjacent-hue streaks, only in some regions)
  const region = Math.sin(2.1 * nx + 0.5) * Math.sin(1.9 * nz - 1.0)
  const streak = 1 - smooth(Math.abs(Math.sin(9.0 * ny - 6.0 * nz + 3.0 * nx)), 0.0, 0.06)
  const vein = streak * smooth(region, 0.35, 0.85)
  if (vein > 0) c.lerp(pal.pineDeep, DIALS.veinDensity.value * vein)
  // rare grime specks (tiny darkening)
  const gr = Math.sin(53.1 * nx + 9.0) * Math.sin(61.7 * ny - 3.0) * Math.sin(57.3 * nz + 5.0)
  if (gr > 0.9) c.multiplyScalar(1 - DIALS.grimeDensity.value * smooth(gr, 0.9, 0.99))
}
